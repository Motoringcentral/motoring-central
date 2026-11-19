// Sends the queued confirmation emails and texts (public.notifications) for a booking.
// Called by the website straight after an MOT is booked or moved: POST { booking_id }.
// Only the customer or the garage on that booking (or staff) can trigger it. Staff can send { all: true }
// to retry everything still queued.
// Secrets (Supabase > Edge Functions > Secrets):
//   Email (Resend):  RESEND_API_KEY, NOTIFY_FROM  e.g. "The Motoring Central <bookings@motoringcentral.co.uk>"
//   Texts (Twilio):  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM  (a UK number or an approved sender ID)
// Until a provider's secrets are set, its messages stay queued and are sent on the next call after they are added.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "Access-Control-Allow-Origin": ok ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
function html(subject: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0B1C35">
<div style="background:#0B1C35;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:800;letter-spacing:.04em">THE MOTORING <span style="color:#FFD43B">CENTRAL</span></div>
<div style="border:1px solid #D6E2F0;border-top:0;padding:18px;border-radius:0 0 10px 10px"><h2 style="margin:0 0 12px;font-size:18px">${esc(subject)}</h2>
<p style="white-space:pre-line;line-height:1.5;margin:0">${esc(body)}</p></div></div>`;
}
async function sendEmail(to: string, subject: string, body: string) {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("NOTIFY_FROM");
  if (!key || !from) return "not_set_up";
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: body, html: html(subject, body) }) });
  if (!r.ok) throw new Error("email " + r.status + " " + (await r.text()).slice(0, 200));
  return "sent";
}
async function sendSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), tok = Deno.env.get("TWILIO_AUTH_TOKEN"), from = Deno.env.get("TWILIO_FROM");
  if (!sid || !tok || !from) return "not_set_up";
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }) });
  if (!r.ok) throw new Error("sms " + r.status + " " + (await r.text()).slice(0, 200));
  return "sent";
}

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userDb.auth.getUser();
  if (!u?.user) return out({ error: "login" }, 401);
  const admin = createClient(url, svc);
  const body = await req.json().catch(() => ({}));
  const { data: st } = await admin.from("staff").select("user_id").eq("user_id", u.user.id).maybeSingle();
  let q = admin.from("notifications").select("*").eq("status", "queued").lt("tries", 5).order("id").limit(50);
  if (body.all && st) { /* staff: everything queued */ }
  else {
    const id = String(body.booking_id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return out({ error: "booking" }, 400);
    const { data: b } = await admin.from("bookings").select("customer_id,partner_id").eq("id", id).maybeSingle();
    if (!b || (b.customer_id !== u.user.id && b.partner_id !== u.user.id && !st)) return out({ error: "not_yours" }, 403);
    q = q.eq("booking_id", id);
  }
  const { data: list } = await q;
  let sent = 0, waiting = 0, failed = 0;
  for (const n of list || []) {
    try {
      const r = n.channel === "email" ? await sendEmail(n.to_addr, n.subject || "The Motoring Central", n.body) : await sendSms(n.to_addr, n.body);
      if (r === "sent") { sent++; await admin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", n.id); }
      else waiting++;
    } catch (e) {
      failed++;
      await admin.from("notifications").update({ tries: n.tries + 1, error: String(e).slice(0, 300), status: n.tries + 1 >= 5 ? "failed" : "queued" }).eq("id", n.id);
    }
  }
  return out({ sent, waiting, failed });
});
