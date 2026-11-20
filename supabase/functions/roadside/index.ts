// Recovery and mobile EV charging: real distances, the partners who cover the place, their prices, and booking.
// Locations come from postcodes.io (free, open data, no key). Prices are worked out here from each partner's own
// rates, so a customer's page cannot change them. Bookings are written here with the customer's own account
// (the function checks the customer's sign-in itself, so the gateway JWT check is off, like the other functions).
//   POST {action:"quote", kind:"recovery"|"evcharge", from:{pc}|{lat,lng}, to:{pc}, opt:{when, winch, vtype, plug, need}}
//   POST {action:"book", ...same, partner:"<uuid>", vehicle:{...}, info:{...}, paid:"<payment ref>"} with the customer's sign-in
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "Access-Control-Allow-Origin": ok ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const BOOKING_FEE = 3; // customer's booking fee, includes VAT (launch offer, usually £5.99)
const DEFAULT_RATE = 0.06; // our fee on pay as you go: 5% + VAT
const SAMPLES: Record<string, any[]> = {
  recovery: [{ n: "Swift Recovery", t: "Leeds", call: 65, mile: 2.4 }, { n: "Highway Rescue 24h", t: "Wakefield", call: 75, mile: 2.2 }, { n: "Metro Tow and Transport", t: "Bradford", call: 60, mile: 3.1 }],
  evcharge: [{ n: "ChargeUp Mobile", t: "Leeds", call: 95, mile: 1.8 }, { n: "Volt Rescue 24/7", t: "Manchester", call: 110, mile: 1.5 }, { n: "PlugIn Roadside", t: "Sheffield", call: 89, mile: 2.2 }],
};
type Pt = { lat: number; lng: number; pc: string; label: string; area?: string };
const clean = (s: unknown, n = 200) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const normPc = (s: unknown) => { const p = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(p) ? p.slice(0, -3) + " " + p.slice(-3) : ""; };
const r2 = (n: number) => Math.round(n * 100) / 100;

async function geoPc(pc: string): Promise<Pt | null> {
  const p = normPc(pc); if (!p) return null;
  const r = await fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(p)).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  if (j && j.result && isFinite(j.result.latitude)) return { lat: j.result.latitude, lng: j.result.longitude, pc: j.result.postcode, label: j.result.postcode, area: j.result.admin_district || "" };
  // terminated postcodes still have a location
  const t = await fetch("https://api.postcodes.io/terminated_postcodes/" + encodeURIComponent(p)).catch(() => null);
  const k = t && t.ok ? await t.json().catch(() => null) : null;
  if (k && k.result && isFinite(k.result.latitude)) return { lat: k.result.latitude, lng: k.result.longitude, pc: p, label: p };
  return null;
}
async function geoLL(lat: number, lng: number): Promise<Pt | null> {
  if (!isFinite(lat) || !isFinite(lng) || lat < 49.8 || lat > 60.9 || lng < -8.7 || lng > 1.9) return null;
  const r = await fetch(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1&radius=2000`).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  const x = j && Array.isArray(j.result) && j.result[0];
  const near = x ? x.postcode : "";
  return { lat, lng, pc: near, label: near ? "Near " + near : lat.toFixed(5) + ", " + lng.toFixed(5), area: x ? x.admin_district || "" : "" };
}
async function where(w: any): Promise<Pt | null> {
  if (!w) return null;
  if (w.lat != null && w.lng != null) return geoLL(Number(w.lat), Number(w.lng));
  return geoPc(w.pc);
}
function miles(a: Pt | { lat: number; lng: number }, b: Pt | { lat: number; lng: number }) {
  const R = 3958.8, t = Math.PI / 180, dl = (b.lat - a.lat) * t, dg = (b.lng - a.lng) * t;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dg / 2) ** 2;
  return Math.max(1, Math.round(2 * R * Math.asin(Math.sqrt(x)) * 1.25)); // straight line x 1.25 for roads
}
function radiusOf(d: any): number | null {
  if (!d) return 30;
  const set = Object.prototype.hasOwnProperty.call(d, "radius"), v = set ? d.radius : d.rad;
  if (set && v === null) return null; // "Nationwide" chosen on the dashboard
  if (v == null || v === "") return 30;
  if (/nation/i.test(String(v))) return null;
  const n = parseInt(String(v), 10); return isFinite(n) && n > 0 ? n : 30;
}
const arr = (v: unknown) => Array.isArray(v) ? v.map((x) => String(x)) : [];

async function partners(db: any, kind: string) {
  const { data } = await db.from("partners").select("id,name,town,phone,plan,rates,details,base_pc,base_lat,base_lng,online_until").eq("status", "approved").eq("role", kind).limit(1000);
  const list = data || [];
  const need = list.filter((p: any) => p.base_lat == null);
  if (need.length) {
    const pcs = need.map((p: any) => normPc(p.base_pc || (p.details && p.details.post) || p.town)).filter(Boolean);
    if (pcs.length) {
      const r = await fetch("https://api.postcodes.io/postcodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postcodes: pcs.slice(0, 100) }) }).catch(() => null);
      const j = r && r.ok ? await r.json().catch(() => null) : null;
      const m: Record<string, any> = {};
      (j && j.result || []).forEach((x: any) => { if (x.result) m[normPc(x.query)] = x.result; });
      for (const p of need) {
        const pc = normPc(p.base_pc || (p.details && p.details.post) || p.town), g = m[pc];
        if (g) { p.base_lat = g.latitude; p.base_lng = g.longitude; p.base_pc = g.postcode; await db.from("partners").update({ base_lat: g.latitude, base_lng: g.longitude, base_pc: g.postcode }).eq("id", p.id); }
      }
    }
  }
  return list.filter((p: any) => p.base_lat != null);
}

function priceFor(kind: string, p: any, from: Pt, to: Pt | null, opt: any) {
  const R = p.rates || {}, call = Math.max(0, Number(R.call) || (kind === "recovery" ? 65 : 95)), mile = Math.max(0, Number(R.mile) || (kind === "recovery" ? 2.4 : 1.5));
  const base = { lat: p.base_lat, lng: p.base_lng }, d0 = miles(base, from), rad = radiusOf(p.details);
  let price = 0, loaded = 0, extraMiles = 0, winch = 0;
  if (kind === "recovery") {
    loaded = to ? miles(from, to) : 0;
    winch = opt.winch ? Math.max(0, Number(R.winch) || 0) : 0;
    price = call + mile * loaded + winch;
  } else {
    extraMiles = rad == null ? 0 : Math.max(0, d0 - rad);
    price = call + mile * extraMiles;
  }
  const rate = p.plan === "pro" && p.details && p.details.proActive ? 0 : DEFAULT_RATE;
  return { d0, rad, call: r2(call), mile: r2(mile), loaded, extraMiles, winch: r2(winch), price: r2(price), rate };
}
function covers(kind: string, p: any, q: any, opt: any) {
  if (q.rad != null && q.d0 > q.rad + (kind === "evcharge" ? 40 : 0)) return false;
  if (opt.when === "now" && !(p.online_until && Date.parse(p.online_until) > Date.now())) return false;
  const d = p.details || {};
  if (kind === "evcharge" && opt.plug && !/not sure/i.test(opt.plug)) { const pl = arr(d.plugs); if (pl.length && !pl.some((x) => x.toLowerCase().includes(String(opt.plug).toLowerCase()))) return false; }
  if (kind === "recovery" && opt.winch) { const ty = arr(d.types); if (ty.length && !ty.some((x) => /winch|flatbed/i.test(x))) return false; }
  if (kind === "recovery" && opt.vtype === "bike") { const ty = arr(d.types); if (ty.length && !ty.some((x) => /flatbed|trailer|van/i.test(x))) return false; }
  return true;
}
const eta = (d0: number) => Math.max(20, Math.round((15 + d0 / 35 * 60) / 5) * 5);

async function quote(db: any, b: any) {
  const kind = b.kind === "evcharge" ? "evcharge" : "recovery", opt = b.opt || {};
  const from = await where(b.from); if (!from) return { ok: false, error: "bad_from" };
  let to: Pt | null = null;
  if (kind === "recovery") { to = await where(b.to); if (!to) return { ok: false, error: "bad_to" }; }
  const P = await partners(db, kind), list: any[] = [];
  for (const p of P) {
    const q = priceFor(kind, p, from, to, opt);
    if (!covers(kind, p, q, opt)) continue;
    list.push({ id: p.id, name: p.name, town: p.town || "", price: q.price, total: r2(q.price + BOOKING_FEE), call: q.call, mile: q.mile, loaded: q.loaded, extraMiles: q.extraMiles, winch: q.winch, away: q.d0, eta: opt.when === "now" ? eta(q.d0) : null, kit: arr((p.details || {}).kit).slice(0, 3), _q: q, _p: p });
  }
  list.sort((a, b2) => a.price - b2.price || a.away - b2.away);
  let samples: any[] = [];
  if (!list.length && Deno.env.get("ROADSIDE_SAMPLES") !== "0") {
    samples = SAMPLES[kind].map((s, i) => {
      const loaded = to ? miles(from, to) : 0, price = r2(kind === "recovery" ? s.call + s.mile * loaded + (opt.winch ? 25 : 0) : s.call);
      return { sample: true, name: s.n, town: s.t, price, total: r2(price + BOOKING_FEE), call: s.call, mile: s.mile, loaded, extraMiles: 0, winch: opt.winch && kind === "recovery" ? 25 : 0, eta: opt.when === "now" ? 35 + i * 10 : null };
    });
  }
  return { ok: true, kind, fee: BOOKING_FEE, from, to, loaded: to ? miles(from, to) : null, list, samples };
}

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b, (k, v) => (k === "_q" || k === "_p") ? undefined : v), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_e) { /* empty */ }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    if (b.action === "quote") return out(await quote(db, b));
    if (b.action !== "book") return out({ ok: false, error: "action" }, 400);
    // booking: must be a signed-in customer
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return out({ ok: false, error: "sign_in" }, 401);
    const { data: ud } = await db.auth.getUser(jwt);
    const uid = ud && ud.user && ud.user.id;
    if (!uid) return out({ ok: false, error: "sign_in" }, 401);
    const { data: prof } = await db.from("profiles").select("id,name,phone").eq("id", uid).maybeSingle();
    if (!prof) return out({ ok: false, error: "not_customer" }, 403);
    if (!clean(b.paid, 80)) return out({ ok: false, error: "not_paid" }, 402);
    const q: any = await quote(db, b);
    if (!q.ok) return out(q, 400);
    const pick = (q.list as any[]).find((x) => x.id === b.partner);
    if (!pick) return out({ ok: false, error: "partner_unavailable" }, 409);
    const kind = q.kind === "evcharge" ? "EV charging" : "Recovery", opt = b.opt || {}, info = b.info || {}, v = b.vehicle || {};
    // the same customer pressing twice: return the booking already made
    const { data: dup } = await db.from("bookings").select("id,price_total").eq("customer_id", uid).eq("partner_id", pick.id).eq("kind", kind).gte("made_at", new Date(Date.now() - 120000).toISOString()).limit(1);
    if (dup && dup.length) return out({ ok: true, id: dup[0].id, ref: String(dup[0].id).slice(0, 8).toUpperCase(), total: dup[0].price_total, partner: pick.name, phone: pick._p.phone || "", eta: pick.eta, again: true });
    const veh = { reg: clean(v.reg, 10).toUpperCase(), make: clean(v.make, 40), model: clean(v.model, 60), year: clean(v.year, 4), fuel: clean(v.fuel, 20), col: clean(v.col, 30), type: clean(opt.vtype, 10) };
    const when = opt.when === "now" ? "now" : clean(opt.when, 40);
    if (when !== "now") { const t = Date.parse(when); if (!isFinite(t) || t < Date.now() - 600000 || t > Date.now() + 60 * 864e5) return out({ ok: false, error: "bad_time" }, 400); }
    const whenTxt = when === "now" ? "now" : new Date(when).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const fromTxt = q.from.label + (clean(info.spot, 160) ? " (" + clean(info.spot, 160) + ")" : "");
    let summary = "";
    if (kind === "Recovery") {
      summary = "Recovery: " + (clean(info.what, 80) || "Breakdown") + ". Collect from " + fromTxt + ", take to " + q.to.label + (clean(info.dest, 60) ? " (" + clean(info.dest, 60) + ")" : "") + ", " + pick.loaded + " miles. " +
        (opt.winch ? "Will not roll: needs winching. " : "") + (info.keys === "no" ? "No keys with the vehicle. " : "") + (Number(info.pass) > 0 ? Number(info.pass) + " passenger(s) need a lift. " : "") +
        (when === "now" ? "Needed now." : "Booked for " + whenTxt + ".");
    } else {
      const NEED: Record<string, string> = { rescue: "Out of charge: enough to reach a charge point", home: "Out of charge: enough to get home", booked: "Booked top-up" };
      summary = "EV charging: " + (NEED[clean(opt.need, 20)] || "Charge") + ". At " + fromTxt + ". Plug: " + (clean(opt.plug, 20) || "not sure") + "." +
        (clean(info.battery, 10) ? " Battery " + clean(info.battery, 10) + "%." : "") + (when === "now" ? " Needed now." : " Booked for " + whenTxt + ".");
    }
    const price = pick.price, rate = pick._q.rate, our = r2(BOOKING_FEE + price * rate), pay = r2(price * (1 - rate));
    const details = { from: q.from, to: q.to, loaded: pick.loaded, away: pick.away, eta: pick.eta, when, spot: clean(info.spot, 160), dest: clean(info.dest, 60), what: clean(info.what, 80),
      winch: !!opt.winch, keys: clean(info.keys, 5), pass: Math.max(0, Math.min(8, Number(info.pass) || 0)), need: clean(opt.need, 20), plug: clean(opt.plug, 20), battery: clean(info.battery, 10), note: clean(info.note, 300),
      price: { call: pick.call, mile: pick.mile, loaded: pick.loaded, extraMiles: pick.extraMiles, winch: pick.winch, partner: price, fee: BOOKING_FEE, rate }, paid: clean(b.paid, 80) };
    const row = { customer_id: uid, kind, service: kind === "Recovery" ? (clean(info.what, 80) || "Recovery") : "Mobile EV charging", summary: summary.slice(0, 2000), vehicle: veh, status: "confirmed",
      made_at: new Date().toISOString(), partner_id: pick.id, partner_name: pick.name, price_total: r2(price + BOOKING_FEE), our_share: our, partner_payout: pay, paid: true, details };
    const { data: ins, error } = await db.from("bookings").insert(row).select("id").single();
    if (error || !ins) return out({ ok: false, error: "save_failed" }, 500);
    return out({ ok: true, id: ins.id, ref: String(ins.id).slice(0, 8).toUpperCase(), total: row.price_total, partner: pick.name, phone: pick._p.phone || "", eta: pick.eta });
  } catch (_e) {
    return out({ ok: false, error: "server" }, 500);
  }
});
