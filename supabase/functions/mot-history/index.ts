// MOT history for a car or van that is advertised on the site (free DVSA MOT history API).
// Only answers for registrations of live adverts, so it cannot be used as a free MOT checker.
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
const miles = (v: unknown, unit: unknown) => { const n = Number(v); if (!isFinite(n) || n <= 0) return null; return String(unit || "").toUpperCase().startsWith("K") ? Math.round(n * 0.621371) : Math.round(n); };
function shapeOf(j: any) {
  const tests = (Array.isArray(j.motTests) ? j.motTests : []).slice(0, 40).map((t: any) => {
    const d = Array.isArray(t.defects) ? t.defects : [];
    const pick = (re: RegExp) => d.filter((x: any) => re.test(String(x.type || ""))).map((x: any) => String(x.text || "").slice(0, 200)).slice(0, 30);
    return {
      date: String(t.completedDate || "").slice(0, 10), result: /pass/i.test(String(t.testResult || "")) ? "pass" : "fail",
      miles: miles(t.odometerValue, t.odometerUnit), expiry: t.expiryDate ? String(t.expiryDate).slice(0, 10) : null,
      fail: pick(/fail|major|dangerous|prs/i), minor: pick(/^minor$/i), adv: pick(/advisory|user entered/i),
    };
  });
  return { first: j.firstUsedDate ? String(j.firstUsedDate).slice(0, 10) : null, recall: !!j.hasOutstandingRecall, tests };
}
Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_e) { /* empty */ }
  const reg = String(b.reg || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (reg.length < 2 || reg.length > 8) return out({ ok: false, error: "bad_reg" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: ad } = await db.from("adverts").select("id").eq("status", "live").eq("data->>reg", reg).limit(1);
  if (!ad || !ad.length) return out({ ok: false, error: "not_listed" }, 404);
  const { data: c } = await db.from("mot_cache").select("data,fetched_at").eq("reg", reg).maybeSingle();
  if (c && Date.now() - Date.parse(c.fetched_at) < 864e5) return out({ ok: true, mot: c.data });
  if (!Deno.env.get("DVSA_API_KEY") || !Deno.env.get("DVSA_CLIENT_ID") || !Deno.env.get("DVSA_TOKEN_URL")) return out({ ok: false, error: "not_configured" });
  try {
    const t = await getToken();
    const r = await fetch("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + encodeURIComponent(reg), { headers: { Authorization: "Bearer " + t, "X-API-Key": Deno.env.get("DVSA_API_KEY")!, Accept: "application/json" } });
    if (r.status === 404) { const mot = { first: null, recall: false, tests: [] }; await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() }); return out({ ok: true, mot }); }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return out({ ok: false, error: "upstream_" + r.status }, 502);
    const mot = shapeOf(Array.isArray(j) ? j[0] || {} : j);
    await db.from("mot_cache").upsert({ reg, data: mot, fetched_at: new Date().toISOString() });
    return out({ ok: true, mot });
  } catch (_e) {
    return out({ ok: false, error: "unavailable" }, 502);
  }
});
