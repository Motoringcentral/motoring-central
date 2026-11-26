// MOT history from the free DVSA MOT History API.
// - Adverts: the MOT history of a car or van advertised on the site. Anyone can see it for a live advert; for an
//   advert still waiting for approval, only staff and the seller can. So it cannot be used as a free MOT checker.
// - {mode:"vehicle"}: the make and model only (no history), for a logged-in person typing their own registration
//   when they list a vehicle. At most 20 a day per person.
// - {probe:true}: whether the DVSA details are in place and accepted (true/false only, never the details).
// - {sweep:true} with the private x-cron-key (from the database, see migration 20261126j): adverts waiting for automatic
//   approval are checked against their MOT record. Clean -> live; a warning -> they wait for our team with the reason.
// Answers are kept for a day in mot_cache.
// Secrets (Supabase > Edge Functions > Secrets), from the DVSA email with your credentials:
//   DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY, DVSA_TOKEN_URL (optional: DVSA_SCOPE)
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "Access-Control-Allow-Origin": ok ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const configured = () => !!(Deno.env.get("DVSA_API_KEY") && Deno.env.get("DVSA_CLIENT_ID") && Deno.env.get("DVSA_CLIENT_SECRET") && Deno.env.get("DVSA_TOKEN_URL"));

let token = "", tokenExp = 0;
async function getToken() {
  if (token && Date.now() < tokenExp - 60000) return token;
  const url = Deno.env.get("DVSA_TOKEN_URL") || "";
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: Deno.env.get("DVSA_CLIENT_ID") || "", client_secret: Deno.env.get("DVSA_CLIENT_SECRET") || "", scope: Deno.env.get("DVSA_SCOPE") || "https://tapi.dvsa.gov.uk/.default" });
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("token");
  token = j.access_token; tokenExp = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  return token;
}
// one registration from the DVSA: {status, body}; a busy answer (429) is tried again once
async function ask(reg: string): Promise<{ status: number; body: any }> {
  for (let i = 0; i < 2; i++) {
    const t = await getToken();
    const r = await fetch("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + encodeURIComponent(reg), { headers: { Authorization: "Bearer " + t, "X-API-Key": Deno.env.get("DVSA_API_KEY")!, Accept: "application/json" } });
    if (r.status === 401) token = ""; // the token may have run out: get a new one next time
    if ((r.status === 429 || r.status === 401) && i === 0) { await new Promise((s) => setTimeout(s, 1000)); continue; }
    return { status: r.status, body: await r.json().catch(() => null) };
  }
  return { status: 429, body: null };
}

const miles = (v: unknown, unit: unknown) => { const n = Number(v); if (!isFinite(n) || n <= 0) return null; return String(unit || "").toUpperCase().startsWith("K") ? Math.round(n * 0.621371) : Math.round(n); };
const day = (v: unknown) => { const s = String(v || "").slice(0, 10).replace(/\./g, "-"); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
// "FIESTA" -> "Fiesta", "3 SERIES" -> "3 Series", short or coded words ("CR-V", "XC90", "GTI") stay as they are
const nice = (s: unknown) => String(s || "").trim().split(/\s+/).filter(Boolean).map((w) => /[0-9\-]/.test(w) || w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
function shapeOf(j: any) {
  const tests = (Array.isArray(j.motTests) ? j.motTests : []).slice(0, 40).map((t: any) => {
    const d = Array.isArray(t.defects) ? t.defects : [];
    const pick = (re: RegExp) => d.filter((x: any) => re.test(String(x.type || ""))).map((x: any) => String(x.text || "").slice(0, 200)).slice(0, 30);
    return {
      date: day(t.completedDate) || "", at: String(t.completedDate || "").slice(0, 25), result: /pass/i.test(String(t.testResult || "")) ? "pass" : "fail",
      miles: miles(t.odometerValue, t.odometerUnit), expiry: day(t.expiryDate),
      fail: pick(/fail|major|dangerous|prs/i), minor: pick(/^minor$/i), adv: pick(/advisory|user entered/i),
    };
  });
  // the DVSA says "Yes", "No", "Unknown" or "Unavailable" for an outstanding safety recall
  const rc = String(j.hasOutstandingRecall ?? "").toLowerCase();
  return {
    first: day(j.firstUsedDate || j.registrationDate), due: day(j.motTestDueDate),
    recall: rc === "yes" || j.hasOutstandingRecall === true ? "yes" : rc === "no" || j.hasOutstandingRecall === false ? "no" : "unknown",
    make: nice(j.make), model: nice(j.model), fuel: nice(j.fuelType), col: nice(j.primaryColour),
    tests,
  };
}

// the MOT record for one registration: from the day's copy, or the DVSA ({ok:false} if the DVSA could not answer)
async function getMot(db: any, reg: string): Promise<{ ok: boolean; mot?: any; error?: string }> {
  const { data: c } = await db.from("mot_cache").select("data,fetched_at").eq("reg", reg).maybeSingle();
  if (c && Date.now() - Date.parse(c.fetched_at) < 864e5) return { ok: true, mot: c.data };
  if (!configured()) return { ok: false, error: "not_configured" };
  try {
    const r = await ask(reg);
    if (r.status === 404) { const mot = { first: null, due: null, recall: "unknown", make: "", model: "", tests: [] }; await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() }); return { ok: true, mot }; }
    if (r.status !== 200 || !r.body) return { ok: false, error: r.status === 401 || r.status === 403 ? "dvsa_refused" : "upstream_" + r.status };
    const mot = shapeOf(Array.isArray(r.body) ? r.body[0] || {} : r.body);
    await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() });
    return { ok: true, mot };
  } catch (_e) {
    return { ok: false, error: "unavailable" };
  }
}
// the same warnings the page shows (a recall alone does not stop an advert: buyers are told about it on the advert)
const brand = (x: unknown) => { const s = String(x || "").toLowerCase().replace(/[^a-z]/g, ""); return ({ vw: "volkswagen", merc: "mercedesbenz", mercedes: "mercedesbenz", chevy: "chevrolet", rangerover: "landrover" } as any)[s] || s; };
const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
function warnings(mot: any, d: any): string[] {
  const W: string[] = [];
  const T = ((mot && mot.tests) || []).slice().sort((a: any, b: any) => ((b.at || b.date) > (a.at || a.date) ? 1 : (b.at || b.date) < (a.at || a.date) ? -1 : 0));
  if (!T.length && !(mot && mot.make)) { W.push("MOT: the DVSA has no record of this registration"); return W; }
  for (let i = 0; i < T.length - 1; i++) if (T[i].miles && T[i + 1].miles && T[i].miles < T[i + 1].miles - 50) { W.push("MOT: the recorded mileage went down between tests"); break; }
  const last = T.find((t: any) => t.miles), am = Number(d && d.miles);
  if (last && am > 0 && am < last.miles - 100) W.push("MOT: the advert says " + n0(am) + " miles, the last MOT recorded " + n0(last.miles));
  const a = brand(d && d.make), b = brand(mot && mot.make);
  if (a && b && !a.startsWith(b.slice(0, 4)) && !b.startsWith(a.slice(0, 4))) W.push("MOT: the registration belongs to a " + [mot.make, mot.model].filter(Boolean).join(" "));
  return W;
}

let probeAt = 0, probeAns: any = null;

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_e) { /* empty */ }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // adverts waiting for automatic approval: check each against its MOT record
  if (b.sweep) {
    const { data: keyOk } = await db.rpc("notify_cron_ok", { p_key: req.headers.get("x-cron-key") || "" });
    if (keyOk !== true) return out({ ok: false, error: "key" }, 401);
    const { data: st } = await db.from("app_settings").select("value").eq("key", "auto_approve_adverts").maybeSingle();
    const autoOn = !!(st && st.value === true);
    const { data: rows } = await db.from("adverts").select("id,data,flags,created_at").eq("status", "pending").eq("mot_wait", true).order("created_at").limit(20);
    const done: any[] = [];
    for (const a of rows || []) {
      const { data: mine } = await db.rpc("mot_claim", { p_id: a.id });
      if (mine !== true) continue;
      const d = a.data || {}, old = Date.now() - Date.parse(a.created_at) > 30 * 60000;
      if (!autoOn) { await db.from("adverts").update({ mot_wait: false }).eq("id", a.id); done.push({ id: a.id, to: "staff (automatic approval is off)" }); continue; }
      const reg = String(d.reg || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const m = reg ? await getMot(db, reg) : { ok: true, mot: null };
      let W: string[];
      if (!m.ok && m.error === "not_configured") W = [];
      else if (!m.ok) {
        if (!old) { await db.from("adverts").update({ mot_claim: null }).eq("id", a.id); done.push({ id: a.id, to: "try again" }); continue; }
        W = ["MOT check not available"];
      } else W = reg ? warnings(m.mot, d) : ["MOT: no registration to check"];
      if (W.length) {
        await db.from("adverts").update({ mot_wait: false, flags: [...(a.flags || []), ...W] }).eq("id", a.id);
        done.push({ id: a.id, to: "staff", why: W });
      } else {
        await db.from("adverts").update({ status: "live", mot_wait: false, review_note: m.ok ? "Approved automatically after the MOT check" : "Approved automatically" }).eq("id", a.id);
        done.push({ id: a.id, to: "live" });
      }
    }
    return out({ ok: true, done });
  }

  // is it connected? Checked against the DVSA at most every 10 minutes
  if (b.probe) {
    if (!configured()) return out({ ok: true, configured: false, connected: false });
    if (probeAns && Date.now() - probeAt < 600000) return out(probeAns);
    let ans: any;
    try {
      const { data: ad } = await db.from("adverts").select("data").eq("status", "live").limit(1);
      const reg = String(ad && ad[0] && ad[0].data && ad[0].data.reg || "FV16WDY").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const r = await ask(reg);
      ans = r.status === 200 || r.status === 404 ? { ok: true, configured: true, connected: true }
        : { ok: true, configured: true, connected: false, error: r.status === 401 || r.status === 403 ? "dvsa_refused" : "dvsa_" + r.status };
    } catch (_e) {
      ans = { ok: true, configured: true, connected: false, error: "token_refused" };
    }
    probeAt = Date.now(); probeAns = ans;
    return out(ans);
  }

  const reg = String(b.reg || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (reg.length < 2 || reg.length > 8) return out({ ok: false, error: "bad_reg" }, 400);

  // who is asking (only needed for adverts waiting for approval and for the make and model)
  let uid = "";
  const auth = req.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(auth)) {
    const { data: u } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, "")).catch(() => ({ data: null as any }));
    uid = u && u.user ? u.user.id : "";
  }
  const vehicleOnly = b.mode === "vehicle";
  if (vehicleOnly) {
    if (!uid) return out({ ok: false, error: "login" }, 401);
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await db.from("mot_lookups").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("at", since);
    if ((count || 0) >= 20) return out({ ok: false, error: "too_many" }, 429);
  } else {
    const { data: ad } = await db.from("adverts").select("id,owner_id,status").in("status", ["live", "pending"]).eq("data->>reg", reg).limit(5);
    const L = ad || [];
    let allowed = L.some((x: any) => x.status === "live");
    if (!allowed && uid && L.length) {
      if (L.some((x: any) => x.owner_id === uid)) allowed = true;
      else { const { data: st } = await db.from("staff").select("user_id").eq("user_id", uid).maybeSingle(); allowed = !!st; }
    }
    if (!allowed) return out({ ok: false, error: "not_listed" }, 404);
  }

  const send = (mot: any) => out(vehicleOnly ? { ok: true, vehicle: mot && mot.make ? { make: mot.make || "", model: mot.model || "", fuel: mot.fuel || "", col: mot.col || "" } : null } : { ok: true, mot });
  if (vehicleOnly) {
    const { data: c } = await db.from("mot_cache").select("fetched_at").eq("reg", reg).maybeSingle();
    if (!(c && Date.now() - Date.parse(c.fetched_at) < 864e5) && configured()) await db.from("mot_lookups").insert({ user_id: uid, reg });
  }
  const m = await getMot(db, reg);
  if (!m.ok) return m.error === "not_configured" ? out({ ok: false, error: "not_configured" }) : out({ ok: false, error: m.error }, 502);
  return send(m.mot);
});
