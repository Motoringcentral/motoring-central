// Fetches a dealer's stock feed (a CSV file at a web address they give us) so the site can update their adverts.
// Only approved dealers can use it. Only public https addresses; at most 1 MB; 10 second limit.
// - From the dashboard (the dealer logged in): returns the file for the page to read.
// - Overnight ({cron:true} with the private x-cron-key, see migration 20261126l): checks every saved feed in
//   public.dealer_feeds: price, mileage and description changes are made, vehicles no longer in the feed are taken down,
//   and the dealer is emailed about new vehicles to list on their dashboard. If a feed cannot be read, looks empty, or
//   would take down more than half the dealer's feed vehicles, nothing is taken down and the dealer is told.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function badHost(h: string): boolean {
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^[0-9.]+$/.test(h) || h.includes(":")) return true; // no IP addresses at all
  return false;
}

// the file at a web address, with every safety rule: {ok:true, text} or {ok:false, error, status}
async function fetchCsv(raw: string): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  let target: URL;
  try { target = new URL(String(raw || "").trim()); } catch (_) { return { ok: false, error: "bad_url", status: 400 }; }
  if (target.protocol !== "https:" || target.username || target.password || (target.port && target.port !== "443") || badHost(target.hostname)) {
    return { ok: false, error: "bad_url", status: 400 };
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(target.toString(), { signal: ctl.signal, redirect: "manual", headers: { Accept: "text/csv,text/plain,*/*" } });
    if (r.status >= 300 && r.status < 400) { clearTimeout(t); return { ok: false, error: "redirect", status: 400 }; }
    if (!r.ok || !r.body) { clearTimeout(t); return { ok: false, error: "upstream_" + r.status, status: 502 }; }
    const reader = r.body.getReader();
    const parts: Uint8Array[] = [];
    let n = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // a web page (not a CSV file) is spotted from its first bytes, before its size can matter
      if (n === 0 && /^\s*</.test(new TextDecoder().decode(value.slice(0, 200)))) {
        clearTimeout(t); try { await reader.cancel(); } catch (_) { /* ignore */ } return { ok: false, error: "not_csv", status: 400 };
      }
      n += value.length;
      if (n > 1_000_000) { clearTimeout(t); try { await reader.cancel(); } catch (_) { /* ignore */ } return { ok: false, error: "too_big", status: 413 }; }
      parts.push(value);
    }
    clearTimeout(t);
    const all = new Uint8Array(n);
    let o = 0;
    for (const x of parts) { all.set(x, o); o += x.length; }
    const text = new TextDecoder().decode(all);
    if (/^\s*</.test(text)) return { ok: false, error: "not_csv", status: 400 };
    return { ok: true, text };
  } catch (_) {
    return { ok: false, error: "timeout", status: 504 };
  }
}

// the same reading as the page (csvRows and col in index.html)
function csvRows(txt: string): string[][] {
  const R: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x.trim())) R.push(row); row = []; }
    else f += ch;
  }
  row.push(f); if (row.some((x) => x.trim())) R.push(row);
  return R;
}
const col = (H: string[], names: string[]) => H.findIndex((h) => names.includes(String(h).toLowerCase().replace(/[^a-z]/g, "")));
const nreg = (s: unknown) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const money = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

const ERR: Record<string, string> = {
  bad_url: "the web address cannot be used (it must start with https:// and be a public address)",
  redirect: "the address redirects somewhere else", too_big: "the file is over 1 MB", not_csv: "the address returns a web page, not a CSV file",
  timeout: "your server did not answer within 10 seconds", empty: "the file had no vehicles in it (it needs columns called reg, price and mileage)",
};

// one dealer's feed, overnight
async function runFeed(admin: any, f: any) {
  const res: any = { at: new Date().toISOString(), updated: [], removed: [], new: [], error: null, held: false };
  const got = await fetchCsv(f.url);
  let rows: { reg: string; price: number; miles: number; desc: string }[] = [];
  if (!got.ok) res.error = got.error;
  else {
    const R = csvRows(got.text || ""), H = R[0] || [];
    const ci = { reg: col(H, ["reg", "registration", "vrm", "regnumber"]), price: col(H, ["price", "askingprice"]), miles: col(H, ["mileage", "miles", "odometer"]), desc: col(H, ["description", "desc", "notes"]) };
    if (ci.reg < 0 || ci.price < 0 || ci.miles < 0) res.error = "empty";
    else rows = R.slice(1, 1001).map((r) => ({ reg: nreg(r[ci.reg]), price: +String(r[ci.price] || "").replace(/[^0-9.]/g, ""), miles: +String(r[ci.miles] || "").replace(/[^0-9]/g, ""), desc: ci.desc > -1 ? String(r[ci.desc] || "").trim() : "" })).filter((r) => r.reg.length >= 2 && r.reg.length <= 8);
    if (!res.error && !rows.length) res.error = "empty";
  }
  if (!res.error) {
    const inFile = new Map(rows.map((r) => [r.reg, r]));
    const { data: ads } = await admin.from("adverts").select("id,status,flags,data").eq("owner_id", f.dealer_id).in("status", ["live", "pending"]);
    const mine = ads || [];
    const have = new Set(mine.map((a: any) => nreg(a.data && a.data.reg)));
    // vehicles no longer in the file (only ones that came from the feed)
    const gone = mine.filter((a: any) => a.data && a.data.feed && !inFile.has(nreg(a.data.reg)));
    const fromFeed = mine.filter((a: any) => a.data && a.data.feed).length;
    if (gone.length > 2 && gone.length > fromFeed / 2) { res.held = true; res.missing = gone.length; res.fromFeed = fromFeed; }
    for (const a of mine) {
      const r = inFile.get(nreg(a.data && a.data.reg));
      if (!r) continue;
      const d = { ...a.data }, ch: string[] = [];
      if (r.price > 0 && +d.price !== r.price) { ch.push("price " + money(+d.price || 0) + " to " + money(r.price)); d.price = r.price; }
      if (r.miles > 0 && +d.miles !== r.miles) { ch.push("mileage"); d.miles = r.miles; }
      if (r.desc && r.desc !== d.desc) { ch.push("description"); d.desc = r.desc.slice(0, 4000); }
      if (!ch.length && d.feed) continue;
      d.feed = 1;
      const { data: up } = await admin.from("adverts").update({ data: d }).eq("id", a.id).select("flags,status").maybeSingle();
      // the same rule as a change by the dealer: a new warning sends a live advert back to our team
      if (up && a.status === "live" && (up.flags || []).some((x: string) => !(a.flags || []).includes(x))) {
        await admin.from("adverts").update({ status: "pending" }).eq("id", a.id);
        ch.push("sent back to our team to check");
      }
      if (ch.length) res.updated.push({ reg: d.reg, what: ch.join(", ") });
    }
    if (!res.held) for (const a of gone) { await admin.from("adverts").update({ status: "removed" }).eq("id", a.id); res.removed.push(a.data.reg); }
    res.new = rows.filter((r) => !have.has(r.reg)).map((r) => r.reg).filter((x, i, A) => A.indexOf(x) === i).slice(0, 50);
  }
  await admin.from("dealer_feeds").update({ last_run_at: res.at, last_result: res }).eq("dealer_id", f.dealer_id);
  // email the dealer when something changed, needs listing, or went wrong
  const L: string[] = [];
  if (res.error) L.push("We could not read your stock feed last night: " + (ERR[res.error] || "your server gave an error (" + res.error + ")") + ". Nothing was changed. Check the address under Tools, Automatic stock feed.");
  if (res.updated.length) L.push("Updated:\n" + res.updated.map((x: any) => "- " + x.reg + ": " + x.what).join("\n"));
  if (res.removed.length) L.push("Taken down (no longer in your feed):\n" + res.removed.map((x: string) => "- " + x).join("\n"));
  if (res.held) L.push("Your feed was missing " + res.missing + " of the " + res.fromFeed + " vehicles that came from it, so to be safe we did not take any down. If they have really sold, open your dashboard and tap Update now under Automatic stock feed.");
  if (res.new.length) L.push(res.new.length + " new vehicle" + (res.new.length === 1 ? " is" : "s are") + " in your feed and not listed yet: " + res.new.slice(0, 10).join(", ") + (res.new.length > 10 ? " and more" : "") + ".\nOpen your dashboard and tap Update now under Automatic stock feed to list " + (res.new.length === 1 ? "it" : "them") + " (each uses a history check from your plan, and our team checks each advert).");
  if (L.length) {
    await admin.rpc("feed_mail", { p_dealer: f.dealer_id, p_subject: res.error ? "Your stock feed could not be read" : "Your stock feed: overnight update", p_body: "Hello,\n\n" + L.join("\n\n") + "\n\nThe Motoring Central team" });
  }
  return { dealer: f.dealer_id, updated: res.updated.length, removed: res.removed.length, new: res.new.length, error: res.error, held: res.held };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  let body: { url?: string; cron?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }

  // overnight: every saved feed that has not been checked in the last 20 hours, oldest first, for up to 2 minutes
  if (body.cron) {
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: keyOk } = await admin.rpc("notify_cron_ok", { p_key: req.headers.get("x-cron-key") || "" });
    if (keyOk !== true) return json({ ok: false, error: "key" }, 401);
    const since = new Date(Date.now() - 20 * 3600e3).toISOString();
    const { data: feeds } = await admin.from("dealer_feeds").select("dealer_id,url,last_run_at,partners(role,status)")
      .or('last_run_at.is.null,last_run_at.lt."' + since + '"').order("last_run_at", { ascending: true, nullsFirst: true }).limit(200);
    const started = Date.now(), done: any[] = [];
    for (const f of feeds || []) {
      if (Date.now() - started > 120000) break;
      const p = f.partners || {};
      if (p.role !== "dealer" || p.status !== "approved") continue;
      try { done.push(await runFeed(admin, f)); } catch (e) { done.push({ dealer: f.dealer_id, error: String(e).slice(0, 80) }); }
    }
    return json({ ok: true, done });
  }

  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u || !u.user) return json({ ok: false, error: "login" }, 401);
  const { data: p } = await sb.from("partners").select("role,status").eq("id", u.user.id).maybeSingle();
  if (!p || p.role !== "dealer" || p.status !== "approved") return json({ ok: false, error: "dealers_only" }, 403);
  const got = await fetchCsv(String(body.url || ""));
  if (!got.ok) return json({ ok: false, error: got.error }, got.status || 400);
  return json({ ok: true, text: got.text });
});
