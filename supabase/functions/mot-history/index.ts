// MOT history from the free DVSA MOT History API.
// - Adverts: the MOT history of a car or van advertised on the site. Anyone can see it for a live advert; for an
//   advert still waiting for approval, only staff and the seller can. So it cannot be used as a free MOT checker.
// - {mode:"vehicle"}: the make and model only (no history), for a logged-in person typing their own registration
//   when they list a vehicle. At most 20 a day per person.
// - {probe:true}: whether the DVSA details are in place and accepted (true/false only, never the details).
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

let probeAt = 0, probeAns: any = null;

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_e) { /* empty */ }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

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

  const send = (mot: any) => out(vehicleOnly ? { ok: true, vehicle: mot ? { make: mot.make || "", model: mot.model || "", fuel: mot.fuel || "", col: mot.col || "" } : null } : { ok: true, mot });
  const { data: c } = await db.from("mot_cache").select("data,fetched_at").eq("reg", reg).maybeSingle();
  if (c && Date.now() - Date.parse(c.fetched_at) < 864e5) return send(c.data);
  if (!configured()) return out({ ok: false, error: "not_configured" });
  try {
    if (vehicleOnly) await db.from("mot_lookups").insert({ user_id: uid, reg });
    const r = await ask(reg);
    if (r.status === 404) { const mot = { first: null, due: null, recall: "unknown", make: "", model: "", tests: [] }; await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() }); return send(vehicleOnly ? null : mot); }
    if (r.status !== 200 || !r.body) return out({ ok: false, error: r.status === 401 || r.status === 403 ? "dvsa_refused" : "upstream_" + r.status }, 502);
    const mot = shapeOf(Array.isArray(r.body) ? r.body[0] || {} : r.body);
    await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() });
    return send(mot);
  } catch (_e) {
    return out({ ok: false, error: "unavailable" }, 502);
  }
});
