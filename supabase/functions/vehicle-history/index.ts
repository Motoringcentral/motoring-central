// Vehicle history check for cars and vans FOR SALE (finance, insurance write-off, stolen).
// Separate from the repair look-up (/api/vrm on Vercel), which only reads make, model and so on.
// Runs in London (eu-west-2). Only this function can add rows to vehicle_checks, so a seller cannot fake a result.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   VDG_API_KEY          Vehicle Data Global key (the same one as Vercel's VDG_API_KEY)
//   HISTORY_LIVE=1       real checks; anything else = sample results only (nothing is charged)
//   VDG_HISTORY_PACKAGE  package name for the history check (default "VDICheck"; confirm with Vehicle Data Global)
//   VDG_DEBUG=1          lets a staff member see the raw answer, to tune the reading below
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
const ALLOW = [5, 10, 15, 25, 50]; // history checks included each month in dealer plans Starter..Premier
const EXTRA = 3.5;                 // price of an extra check for a dealer, + VAT
const TRIAL_DAYS = 92;             // dealers' free first 3 months: checks are not included

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|y|1)$/i.test(v.trim())) || (typeof v === "number" && v > 0);

// Walk the answer; every key is seen with the path above it.
function walk(o: any, path: string[], fn: (k: string, v: any, path: string[]) => void, depth = 0) {
  if (!o || typeof o !== "object" || depth > 14) return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    fn(k, v, path);
    if (v && typeof v === "object") walk(v, path.concat(k), fn, depth + 1);
  }
}
const SEV = ["A", "B", "S", "C", "N", "D"];
function catOf(x: any): string {
  for (const k of Object.keys(x || {})) {
    if (/^(category|writeoffcategory|cat)$/i.test(k) && x[k] != null) {
      const m = /\b([ABCDSN])\b/i.exec(String(x[k]));
      if (m) return m[1].toUpperCase();
    }
  }
  return "";
}
function dateOf(x: any, names: RegExp): string | null {
  for (const k of Object.keys(x || {})) if (names.test(k) && x[k]) { const d = String(x[k]).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; }
  return null;
}

// Read the parts we need. A section counts as "checked" only if the answer contains it;
// if it is missing we say "not available" rather than "clear".
function parse(j: any) {
  let woSec = false, finSec = false, stSec = false, woFlag = false, finFlag = false, stolen = false;
  let keepers: number | null = null, imported = false, scrapped = false, exported = false, mileage = false;
  const wo: any[] = [], fin: any[] = [];
  walk(j, [], (k, v, path) => {
    const K = k.toLowerCase(), P = (path.join("/") + "/" + k).toLowerCase();
    if (/miaftr|writeoff|writtenoff|write_off/.test(K)) woSec = true;
    if (/finance/.test(K)) finSec = true;
    if (/stolen|pnc|police/.test(K)) stSec = true;
    if (Array.isArray(v) && /writeoff|miaftr/.test(P)) v.forEach((x) => { if (x && typeof x === "object" && !x.DateRemoved && !x.dateRemoved && Object.keys(x).length) wo.push(x); });
    if (Array.isArray(v) && /finance/.test(P)) v.forEach((x) => { if (x && typeof x === "object" && Object.keys(x).length) fin.push(x); });
    if (/^(iswrittenoff|writtenoff|haswriteoff|haswriteoffs)$/.test(K) && truthy(v)) woFlag = true;
    if (/^(hasoutstandingfinance|outstandingfinance|hasfinance|financerecordcount|financecount)$/.test(K) && truthy(v)) finFlag = true;
    if (/stolen/.test(K) && !/previously|recovered|not|date/.test(K) && truthy(v)) stolen = true;
    if (/theftindicatorliteral|stolenstatus|policestatus|pncstatus/.test(K) && typeof v === "string" && /stolen/i.test(v) && !/not\s+stolen/i.test(v)) stolen = true;
    if (/numberofpreviouskeepers|previouskeepers|keepercount|formerkeepers|numberofkeepers/.test(K) && v != null && typeof v !== "object" && !isNaN(+v)) keepers = +v;
    if (/^(isimported|imported)$/.test(K) && truthy(v)) imported = true;
    if (/^(isexported|exported)$/.test(K) && truthy(v)) exported = true;
    if (/^(isscrapped|scrapped)$/.test(K) && truthy(v)) scrapped = true;
    if (/mileageanomaly|mileagediscrepancy|mileageissue|hasmileageanomaly|mileageinconsistency/.test(K) && truthy(v)) mileage = true;
  });
  let writeoff: any = null, finance: any = null;
  if (woSec || wo.length || woFlag) {
    const recs = wo.map((x) => ({ cat: catOf(x), date: dateOf(x, /lossdate|miaftrentrydate|date/i) }))
      .sort((a, b) => (SEV.indexOf(a.cat) + 9) % 9 - (SEV.indexOf(b.cat) + 9) % 9);
    writeoff = recs.length || woFlag ? { found: true, cat: recs[0] ? recs[0].cat : "", date: recs[0] ? recs[0].date : null } : { found: false };
  }
  if (finSec || fin.length || finFlag) {
    finance = fin.length || finFlag ? { found: true, count: fin.length || 1, date: fin.length ? dateOf(fin[0], /agreementdate|startdate|financedate|date/i) : null } : { found: false };
  }
  return {
    writeoff, finance,
    stolen: stSec || stolen ? { found: stolen } : null,
    keepers, imported, exported, scrapped, mileage_issue: mileage,
  };
}

function statusOf(s: any) {
  if (s.stolen && s.stolen.found) return "stolen";
  if (s.writeoff && s.writeoff.found) return "writeoff";
  if (s.finance && s.finance.found) return "finance";
  if (!s.writeoff || !s.finance || !s.stolen) return "incomplete";
  return "clear";
}

// Sample results for the preview. Try a reg containing WO (Cat S), CATN (Cat N), FIN (finance) or STO (stolen).
function sample(reg: string) {
  const s: any = { writeoff: { found: false }, finance: { found: false }, stolen: { found: false }, keepers: 2, imported: false, exported: false, scrapped: false, mileage_issue: false };
  if (/CATN/.test(reg)) s.writeoff = { found: true, cat: "N", date: "2022-06-14" };
  else if (/WO/.test(reg)) s.writeoff = { found: true, cat: "S", date: "2021-03-12" };
  if (/FIN/.test(reg)) s.finance = { found: true, count: 1, date: "2024-02-01" };
  if (/STO/.test(reg)) s.stolen = { found: true };
  return s;
}

// Real card payments are not connected yet. Until they are, only the preview's pretend payment is accepted,
// and only for sample checks, so no real check can be bought for free.
async function verifyPayment(payment: string, live: boolean): Promise<string> {
  if (!live) return payment === "demo" ? "sample" : "";
  return "";
}

async function vdg(reg: string) {
  const ep = Deno.env.get("VDG_ENDPOINT") || "https://uk.api.vehicledataglobal.com/r2/lookup";
  const pkg = Deno.env.get("VDG_HISTORY_PACKAGE") || "VDICheck";
  const u = ep + "?packageName=" + encodeURIComponent(pkg) + "&apiKey=" + encodeURIComponent(Deno.env.get("VDG_API_KEY") || "") + "&vrm=" + encodeURIComponent(reg);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { Accept: "application/json" } });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return { ok: false, error: "upstream_" + r.status };
    return { ok: true, summary: parse(j), raw: j };
  } catch (_e) {
    return { ok: false, error: "timeout" };
  } finally {
    clearTimeout(t);
  }
}

const shape = (r: any) => ({ id: r.id, status: r.status, summary: r.summary, source: r.source, at: r.created_at });

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: ud, error: ue } = await db.auth.getUser(jwt);
  const user = ud && ud.user;
  if (ue || !user) return out({ ok: false, error: "login" }, 401);

  let b: any = {};
  try { b = await req.json(); } catch (_e) { /* empty body */ }
  const kind = b.kind === "vans" ? "vans" : "cars";
  const reg = String(b.reg || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (reg.length < 2 || reg.length > 8) return out({ ok: false, error: "bad_reg" }, 400);
  const payment = typeof b.payment === "string" ? b.payment.slice(0, 100) : "";

  const { data: p } = await db.from("partners").select("role,status,plan,created_at").eq("id", user.id).maybeSingle();
  const trade = !!p;
  if (p && p.status !== "approved") return out({ ok: false, error: "not_approved" }, 403);

  // The same person checked the same vehicle in the last 24 hours: reuse it, nothing is charged.
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data: prev } = await db.from("vehicle_checks").select("id,status,summary,source,created_at")
    .eq("owner_id", user.id).eq("reg", reg).eq("kind", kind).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  if (prev && prev[0]) return out({ ok: true, check: shape(prev[0]), reused: true });

  const { count } = await db.from("vehicle_checks").select("id", { count: "exact", head: true }).eq("owner_id", user.id).gte("created_at", since);
  if ((count || 0) >= 30) return out({ ok: false, error: "too_many" }, 429);

  const live = !!Deno.env.get("VDG_API_KEY") && Deno.env.get("HISTORY_LIVE") === "1";

  // Who pays for this check?
  let paid = "";
  if (trade) {
    const trial = p.created_at && Date.now() - Date.parse(p.created_at) < TRIAL_DAYS * 864e5;
    if (!trial && p.role === "dealer") {
      const i = Math.max(0, Math.min(ALLOW.length - 1, parseInt(String(p.plan), 10) || 0));
      const m = new Date(); m.setUTCDate(1); m.setUTCHours(0, 0, 0, 0);
      const { count: used } = await db.from("vehicle_checks").select("id", { count: "exact", head: true })
        .eq("owner_id", user.id).eq("paid", "allowance").gte("created_at", m.toISOString());
      if ((used || 0) < ALLOW[i]) paid = "allowance";
    }
    if (!paid && !payment) return out({ ok: false, need: "payment", why: trial ? "trial" : "allowance", price: EXTRA });
  } else if (!payment) {
    return out({ ok: false, need: "payment", why: "private" });
  }
  if (!paid) {
    paid = await verifyPayment(payment, live);
    if (!paid) return out({ ok: false, error: live ? "payments_not_live" : "payment" }, 402);
  }

  let summary: any, source: string, raw: any = null;
  if (live) {
    const r: any = await vdg(reg);
    if (!r.ok) return out({ ok: false, error: r.error }, 502);
    summary = r.summary; source = "live"; raw = r.raw;
  } else {
    summary = sample(reg); source = "sample";
  }
  const status = statusOf(summary);
  const { data: row, error } = await db.from("vehicle_checks")
    .insert({ owner_id: user.id, reg, kind, status, summary, source, trade, paid })
    .select("id,status,summary,source,created_at").single();
  if (error || !row) return out({ ok: false, error: "save" }, 500);

  const res: any = { ok: true, check: shape(row) };
  if (raw && b.debug && Deno.env.get("VDG_DEBUG") === "1") {
    const { data: st } = await db.from("staff").select("user_id").eq("user_id", user.id).maybeSingle();
    if (st) res.raw = raw;
  }
  return out(res);
});
