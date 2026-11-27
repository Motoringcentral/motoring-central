// Sends the queued emails and texts in public.notifications.
// Who calls it:
//  - the timed job in the database (pg_cron, every 2 minutes while anything is waiting), with the x-cron-key header;
//  - the website straight after an MOT is booked or moved: POST { booking_id } (customer, garage or staff only);
//  - staff: POST { all: true } to send everything still waiting.
// Secrets (Supabase > Edge Functions > Secrets):
//   Email (Resend):  RESEND_API_KEY (required). Optional: NOTIFY_FROM, default "The Motoring Central <bookings@motoringcentral.co.uk>",
//                    NOTIFY_REPLY_TO, default "support@motoringcentral.co.uk".
//   Texts (Twilio):  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM  (a UK number or an approved sender ID)
// Until a provider's secrets are set, its messages wait. Anything waiting more than 24 hours is dropped (status "skipped"),
// so test messages from before the email service was switched on are never sent later by surprise.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://preview.motoringcentral.co.uk", "https://motoringcentral.co.uk", "https://www.motoringcentral.co.uk"];
const MAX_AGE_MS = 24 * 3600 * 1000;
function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "Access-Control-Allow-Origin": ok ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function buttonText(link: string) {
  if (/#mydemo-/.test(link)) return "Open your demo";
  if (/#dashboard/.test(link)) return "Open your dashboard";
  if (/#account/.test(link)) return "Open your account";
  if (/#review/.test(link)) return "Leave a review";
  if (/#(admin|staff)/.test(link)) return "Open the admin page";
  if (/#login/.test(link)) return "Log in";
  if (/#(cars|vans)/.test(link)) return "See it on the site";
  return "Open The Motoring Central";
}
// The company's legal details (app_settings "company", filled in by the owner on the Staff page), printed at the foot
// of every email once they are there. Read once per run.
type Co = { name?: string; number?: string; office?: string; vat?: string };
function coLine(c: Co) {
  if (!c || !c.name || !c.number) return "";
  return `${c.name} is a company registered in England and Wales, number ${c.number}.` + (c.office ? ` Registered office: ${c.office}.` : "") + (c.vat ? ` VAT number ${c.vat}.` : "");
}
// Branded email: navy header with the wordmark, white card, yellow button, plain footer.
function html(subject: string, body: string, link: string | null, co = "") {
  let site = ORIGINS[0];
  try { if (link) site = new URL(link).origin; } catch { /* keep the default */ }
  const btn = link && /^https:\/\//.test(link)
    ? `<tr><td style="padding:6px 24px 24px"><a href="${esc(link)}" style="display:inline-block;background:#FFD43B;color:#0B1C35;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px">${esc(buttonText(link))}</a></td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F1F6FB;font-family:Arial,Helvetica,sans-serif;color:#0B1C35">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F6FB;padding:20px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6E2F0">
<tr><td style="background:#0B1C35;padding:16px 24px">
<div style="color:#38BDF8;font-size:10px;font-weight:700;letter-spacing:.5em">THE</div>
<div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.05">MOTORING</div>
<div style="display:inline-block;background:#FFD43B;color:#0B1C35;font-size:11px;font-weight:800;letter-spacing:.4em;padding:2px 4px 2px 8px;border-radius:4px;margin-top:3px">CENTRAL</div>
</td></tr>
<tr><td style="padding:22px 24px 8px"><h1 style="margin:0 0 14px;font-size:19px;line-height:1.3">${esc(subject)}</h1>
<div style="font-size:15px;line-height:1.55;white-space:pre-line">${esc(body)}</div></td></tr>
${btn}
<tr><td style="background:#F7FAFD;border-top:1px solid #E3ECF5;padding:14px 24px;font-size:12px;line-height:1.5;color:#5A6B82">
You are getting this email because of your account, booking or request with The Motoring Central. Questions? Just reply to this email.<br>
<a href="${esc(site)}" style="color:#0B1C35">${esc(site.replace(/^https:\/\//, ""))}</a>${co ? `<br><span style="font-size:11px;color:#7A8BA2">${esc(co)}</span>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

class Limited extends Error {}
async function sendEmail(n: { to_addr: string; subject: string | null; body: string; link: string | null; id: number }, co = "") {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "not_set_up";
  const from = Deno.env.get("NOTIFY_FROM") || "The Motoring Central <bookings@motoringcentral.co.uk>";
  const replyTo = Deno.env.get("NOTIFY_REPLY_TO") || "support@motoringcentral.co.uk";
  const subject = n.subject || "The Motoring Central";
  const text = n.body + (n.link ? `\n\n${n.link}` : "") + (co ? `\n\n--\n${co}` : "");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `tmc-notification-${n.id}` },
    body: JSON.stringify({ from, to: [n.to_addr], reply_to: replyTo, subject, text, html: html(subject, n.body, n.link, co) }),
  });
  if (r.status === 429) throw new Limited("email rate limit");
  if (!r.ok) throw new Error("email " + r.status + " " + (await r.text()).slice(0, 200));
  return "sent";
}
async function sendSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), tok = Deno.env.get("TWILIO_AUTH_TOKEN"), from = Deno.env.get("TWILIO_FROM");
  if (!sid || !tok || !from) return "not_set_up";
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }) });
  if (r.status === 429) throw new Limited("sms rate limit");
  if (!r.ok) throw new Error("sms " + r.status + " " + (await r.text()).slice(0, 200));
  return "sent";
}

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, svc);
  const body = await req.json().catch(() => ({}));

  // who is calling?
  let everything = false;
  let q = admin.from("notifications").select("*").eq("status", "queued").lt("tries", 5).order("id").limit(100);
  const cronKey = req.headers.get("x-cron-key");
  if (cronKey) {
    const { data: ok } = await admin.rpc("notify_cron_ok", { p_key: cronKey });
    if (ok !== true) return out({ error: "key" }, 401);
    everything = true;
  } else {
    const auth = req.headers.get("Authorization") || "";
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userDb.auth.getUser();
    if (!u?.user) return out({ error: "login" }, 401);
    const { data: st } = await admin.from("staff").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (body.all && st) everything = true;
    else {
      const id = String(body.booking_id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return out({ error: "booking" }, 400);
      const { data: b } = await admin.from("bookings").select("customer_id,partner_id").eq("id", id).maybeSingle();
      if (!b || (b.customer_id !== u.user.id && b.partner_id !== u.user.id && !st)) return out({ error: "not_yours" }, 403);
      q = q.eq("booking_id", id);
    }
  }
  if (everything) {
    // drop anything that has waited too long (for example while the email service was not set up yet)
    await admin.from("notifications").update({ status: "skipped", error: "Waited more than 24 hours: not sent" })
      .eq("status", "queued").lt("created_at", new Date(Date.now() - MAX_AGE_MS).toISOString());
  }

  const { data: list } = await q;
  let co = "";
  if ((list || []).some((n) => n.channel === "email")) {
    const { data: cs } = await admin.from("app_settings").select("value").eq("key", "company").maybeSingle();
    co = coLine((cs?.value || {}) as Co);
  }
  let sent = 0, waiting = 0, failed = 0, limited = false;
  for (const n of list || []) {
    if (Date.now() - new Date(n.created_at).getTime() > MAX_AGE_MS) {
      await admin.from("notifications").update({ status: "skipped", error: "Waited more than 24 hours: not sent" }).eq("id", n.id);
      continue;
    }
    if (limited && n.channel === "email") { waiting++; continue; }
    try {
      const r = n.channel === "email" ? await sendEmail(n, co) : await sendSms(n.to_addr, n.body);
      if (r === "sent") {
        sent++; await admin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", n.id);
        await new Promise((res) => setTimeout(res, 550)); // Resend allows 2 emails a second
      } else waiting++;
    } catch (e) {
      if (e instanceof Limited) { limited = true; waiting++; continue; } // over the provider's limit: try again on the next run
      failed++;
      await admin.from("notifications").update({ tries: n.tries + 1, error: String(e).slice(0, 300), status: n.tries + 1 >= 5 ? "failed" : "queued" }).eq("id", n.id);
    }
  }
  return out({ sent, waiting, failed });
});
