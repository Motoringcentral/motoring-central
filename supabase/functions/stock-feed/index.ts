// Fetches a dealer's stock feed (a CSV file at a web address they give us) so the site can update their adverts.
// Only approved dealers can use it. Only public https addresses; at most 1 MB; 10 second limit.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u || !u.user) return json({ ok: false, error: "login" }, 401);
  const { data: p } = await sb.from("partners").select("role,status").eq("id", u.user.id).maybeSingle();
  if (!p || p.role !== "dealer" || p.status !== "approved") return json({ ok: false, error: "dealers_only" }, 403);
  let body: { url?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  let target: URL;
  try { target = new URL(String(body.url || "").trim()); } catch (_) { return json({ ok: false, error: "bad_url" }, 400); }
  if (target.protocol !== "https:" || target.username || target.password || (target.port && target.port !== "443") || badHost(target.hostname)) {
    return json({ ok: false, error: "bad_url" }, 400);
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(target.toString(), { signal: ctl.signal, redirect: "manual", headers: { Accept: "text/csv,text/plain,*/*" } });
    if (r.status >= 300 && r.status < 400) { clearTimeout(t); return json({ ok: false, error: "redirect" }, 400); }
    if (!r.ok || !r.body) { clearTimeout(t); return json({ ok: false, error: "upstream_" + r.status }, 502); }
    const reader = r.body.getReader();
    const parts: Uint8Array[] = [];
    let n = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > 1_000_000) { clearTimeout(t); try { await reader.cancel(); } catch (_) { /* ignore */ } return json({ ok: false, error: "too_big" }, 413); }
      parts.push(value);
    }
    clearTimeout(t);
    const all = new Uint8Array(n);
    let o = 0;
    for (const x of parts) { all.set(x, o); o += x.length; }
    const text = new TextDecoder().decode(all);
    if (/^\s*</.test(text)) return json({ ok: false, error: "not_csv" }, 400);
    return json({ ok: true, text });
  } catch (_) {
    return json({ ok: false, error: "timeout" }, 504);
  }
});
