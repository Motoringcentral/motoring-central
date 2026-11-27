// Business accounts: card payments through Stripe (27 Nov 2026).
//
// SWITCHED OFF until these secrets are set (Supabase > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY       sk_live_... (or sk_test_... while testing)
//   STRIPE_WEBHOOK_SECRET   whsec_... from Stripe > Developers > Webhooks, endpoint:
//                           https://hctboldpuyztugpwexdy.supabase.co/functions/v1/business-pay?hook=1
//                           events: checkout.session.completed, payment_intent.succeeded
// Until then every card action answers {error:"card_payments_off"} and businesses use the prepaid balance
// topped up by bank transfer.
//
// What it does (the website never sees a card number: Stripe's own pages take the card):
//   card_setup   an owner/admin adds a company card: Stripe Checkout in "setup" mode, card saved for later.
//   card_remove  an owner/admin removes the card.
//   topup_card   an owner/admin tops up the balance by card: Stripe Checkout; the balance goes up only when
//                Stripe's signed webhook says it is paid (never because the page says so).
//   pay_job      a booking paid by the card on file: charged straight away, then the booking is made. If the
//                booking cannot be made (slot gone, partner closed) the card is refunded automatically.
//   webhook      Stripe -> us. The signature is checked (HMAC SHA-256, 5 minute window) before anything is read.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
const SK = Deno.env.get("STRIPE_SECRET_KEY") || "";
const WH = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

// Stripe's API takes form fields; nested objects become a[b][c]=v.
function form(o: Record<string, unknown>, pre = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as any, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as any, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(path: string, method = "GET", body?: Record<string, unknown>, idem?: string) {
  const h: Record<string, string> = { Authorization: `Bearer ${SK}` };
  if (body) h["Content-Type"] = "application/x-www-form-urlencoded";
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: h, body: body ? form(body) : undefined });
  const j = await r.json();
  if (!r.ok) { const e: any = new Error(j?.error?.code || j?.error?.type || "stripe_error"); e.stripe = j?.error; throw e; }
  return j;
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
async function siteUrl() {
  const { data } = await admin.from("app_settings").select("value").eq("key", "site_url").maybeSingle();
  const u = typeof data?.value === "string" ? data.value : "";
  return ORIGINS.includes(u) ? u : ORIGINS[0];
}

// --- the webhook signature (https://stripe.com/docs/webhooks#verify-manually) ---
const enc = new TextEncoder();
function safeEq(a: string, b: string) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function signedOk(raw: string, header: string | null) {
  if (!header || !WH) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2)) as Record<string, string>;
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !sigs.length) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(WH), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => safeEq(s, hex));
}

async function cardSaved(sess: any) {
  const acct = sess.metadata?.account_id, by = sess.metadata?.user_id;
  if (!UUID.test(acct || "") || !UUID.test(by || "")) return;
  const a = await rpc("biz_srv_account", { p_account: acct });
  if (!a || a.stripe_customer !== sess.customer) return;                 // the card must belong to this account's Stripe customer
  const role = await rpc("biz_srv_role", { p_account: acct, p_user: by });
  if (role !== "owner" && role !== "admin") return;
  const si = await stripe(`setup_intents/${sess.setup_intent}`);
  if (si.status !== "succeeded" || !si.payment_method) return;
  const pm = await stripe(`payment_methods/${si.payment_method}`);
  if (a.stripe_pm && a.stripe_pm !== pm.id) { try { await stripe(`payment_methods/${a.stripe_pm}/detach`, "POST", {}); } catch (_) { /* already gone */ } }
  await rpc("biz_srv_card_saved", { p_account: acct, p_customer: sess.customer, p_pm: pm.id, p_brand: pm.card?.brand || "card",
    p_last4: pm.card?.last4 || "0000", p_m: pm.card?.exp_month || null, p_y: pm.card?.exp_year || null, p_by: by });
}

async function jobPaid(job: string, piId: string) {
  const r = await rpc("biz_srv_job_paid", { p_job: job, p_pi: piId });
  if (r?.error) {                                                          // could not be booked: give the money straight back
    try { await stripe("refunds", "POST", { payment_intent: piId, metadata: { job_id: job, reason: String(r.error).slice(0, 100) } }, `refund-${job}`); } catch (_) { /* staff see it as failed */ }
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "bad_request" }, 405);
  const url = new URL(req.url);

  // ---------- Stripe -> us ----------
  if (url.searchParams.get("hook") === "1") {
    const raw = await req.text();
    if (!SK || !(await signedOk(raw, req.headers.get("stripe-signature")))) return new Response("bad signature", { status: 400 });
    const ev = JSON.parse(raw);
    try {
      const o = ev.data?.object || {};
      if (ev.type === "checkout.session.completed" && o.mode === "setup") await cardSaved(o);
      if (ev.type === "checkout.session.completed" && o.mode === "payment" && o.payment_status === "paid" && UUID.test(o.metadata?.topup_id || "")) {
        await rpc("biz_srv_topup_paid", { p_topup: o.metadata.topup_id, p_session: o.id, p_paid: (o.amount_total || 0) / 100 });
      }
      if (ev.type === "payment_intent.succeeded" && UUID.test(o.metadata?.job_id || "")) await jobPaid(o.metadata.job_id, o.id);
    } catch (e) {
      console.error("webhook", ev.type, String(e));
      return new Response("retry", { status: 500 });                     // Stripe tries again later
    }
    return new Response("ok");
  }

  // ---------- the website -> us (signed-in members only) ----------
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json(req, { error: "not_logged_in" }, 401);
  const uid = u.user.id;
  let b: any = {};
  try { b = await req.json(); } catch (_) { return json(req, { error: "bad_request" }, 400); }
  if (b.action === "status") return json(req, { on: !!(SK && WH) });
  if (!SK || !WH) return json(req, { error: "card_payments_off" });

  try {
    if (b.action === "pay_job") {
      if (!UUID.test(b.job || "")) return json(req, { error: "bad_request" }, 400);
      const j = await rpc("biz_srv_job", { p_job: b.job, p_user: uid });
      const a = await rpc("biz_srv_account", { p_account: j.account });
      if (!a?.stripe_customer || !a?.stripe_pm) return json(req, { error: "no_card" });
      let pi: any;
      try {
        pi = await stripe("payment_intents", "POST", {
          amount: Math.round(Number(j.total) * 100), currency: "gbp", customer: a.stripe_customer, payment_method: a.stripe_pm,
          off_session: true, confirm: true, description: `${j.kind} ${j.reg} (${j.ref}) for ${a.name}`.slice(0, 200),
          metadata: { job_id: j.id, account_id: j.account, ref: j.ref },
        }, `job-${j.id}`);
      } catch (e: any) {
        await rpc("biz_srv_job_failed", { p_job: j.id, p_reason: `card declined: ${e?.stripe?.decline_code || e?.message || "error"}` });
        return json(req, { error: "card_declined", detail: e?.stripe?.decline_code || null });
      }
      await rpc("biz_srv_job_pi", { p_job: j.id, p_pi: pi.id });
      if (pi.status !== "succeeded") {
        try { await stripe(`payment_intents/${pi.id}/cancel`, "POST", {}); } catch (_) { /* nothing taken */ }
        await rpc("biz_srv_job_failed", { p_job: j.id, p_reason: `card needs the bank's check (${pi.status})` });
        return json(req, { error: "card_needs_check" });
      }
      const r = await jobPaid(j.id, pi.id);
      return json(req, r?.error ? { error: "could_not_book", why: r.error, refunded: true } : { ok: true, booking: r.booking });
    }

    if (!UUID.test(b.account || "")) return json(req, { error: "bad_request" }, 400);
    const role = await rpc("biz_srv_role", { p_account: b.account, p_user: uid });
    if (role !== "owner" && role !== "admin") return json(req, { error: "not_allowed" }, 403);
    const a = await rpc("biz_srv_account", { p_account: b.account });
    if (!a || a.status !== "approved") return json(req, { error: "account_not_approved" });
    const site = await siteUrl();
    let customer = a.stripe_customer;
    if (!customer && (b.action === "card_setup" || b.action === "topup_card")) {
      const c = await stripe("customers", "POST", { name: a.name, email: a.billing_email, metadata: { account_id: b.account, ref: a.ref } }, `cust-${b.account}`);
      await rpc("biz_srv_customer", { p_account: b.account, p_customer: c.id });
      customer = (await rpc("biz_srv_account", { p_account: b.account })).stripe_customer;
    }

    if (b.action === "card_setup") {
      const s = await stripe("checkout/sessions", "POST", {
        mode: "setup", currency: "gbp", customer, payment_method_types: ["card"],
        success_url: `${site}/business.html#card-added`, cancel_url: `${site}/business.html#card-cancelled`,
        metadata: { account_id: b.account, user_id: uid },
        setup_intent_data: { metadata: { account_id: b.account, user_id: uid } },
      });
      return json(req, { url: s.url });
    }
    if (b.action === "card_remove") {
      if (a.stripe_pm) { try { await stripe(`payment_methods/${a.stripe_pm}/detach`, "POST", {}); } catch (_) { /* already gone */ } }
      await rpc("biz_srv_card_removed", { p_account: b.account, p_by: uid });
      return json(req, { ok: true });
    }
    if (b.action === "topup_card") {
      const amt = Math.round(Number(b.amount) * 100) / 100;
      if (!(amt >= Number(a.min_topup) && amt <= Number(a.max_topup))) return json(req, { error: "bad_amount" });
      const t = await rpc("biz_srv_topup_new", { p_account: b.account, p_user: uid, p_amount: amt });
      const s = await stripe("checkout/sessions", "POST", {
        mode: "payment", customer, payment_method_types: ["card"],
        line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: Math.round(amt * 100), product_data: { name: `Business account top up ${t.ref}` } } }],
        success_url: `${site}/business.html#topup-paid`, cancel_url: `${site}/business.html#topup-cancelled`,
        metadata: { account_id: b.account, topup_id: t.id, user_id: uid },
        payment_intent_data: { metadata: { account_id: b.account, topup_id: t.id } },
      }, `topup-${t.id}`);
      await rpc("biz_srv_topup_session", { p_topup: t.id, p_session: s.id });
      return json(req, { url: s.url, ref: t.ref });
    }
    return json(req, { error: "bad_request" }, 400);
  } catch (e) {
    console.error("business-pay", b.action, String(e));
    const m = String((e as Error).message || "");
    return json(req, { error: /not_allowed|not_payable|account_frozen|bad_amount|account_not_approved|not_found/.exec(m)?.[0] || "server_error" });
  }
});
