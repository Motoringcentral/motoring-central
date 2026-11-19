// Loads the DVSA list of active MOT test stations (gov.uk "Active MOT test stations", updated every 3 months)
// into public.mot_stations, so the site can check the test station number (VTS) partners give.
// Anyone may call it, but it only reloads when the list is more than 7 days old (staff can force with ?force=1).
// The list is public data under the Open Government Licence.
import { createClient } from "npm:@supabase/supabase-js@2";

const PAGE = "https://www.gov.uk/api/content/government/publications/active-mot-test-stations";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const yes = (v: string) => { const s = (v || "").trim().toLowerCase(); return !!s && !["n", "no", "0", "false", "-"].includes(s); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  let force = false;
  if (url.searchParams.get("force") === "1") {
    const auth = req.headers.get("Authorization") || "";
    const u = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } }).auth.getUser();
    if (u.data?.user) { const { data: st } = await db.from("staff").select("user_id").eq("user_id", u.data.user.id).maybeSingle(); force = !!st; }
  }
  const { data: last } = await db.from("mot_stations_sync").select("*").eq("id", 1).maybeSingle();
  if (!force && last?.synced_at && Date.now() - new Date(last.synced_at).getTime() < 7 * 864e5) return out({ fresh: true, synced_at: last.synced_at, rows: last.rows });
  try {
    const page = await (await fetch(PAGE)).json();
    const docs = JSON.stringify(page);
    const m = docs.match(/https:\/\/assets\.publishing\.service\.gov\.uk\/[^"\\]+\.csv/);
    if (!m) throw new Error("no csv link on the gov.uk page");
    const csv = await (await fetch(m[0])).text();
    const rows = parseCsv(csv);
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (n: string) => head.indexOf(n);
    const iNum = col("site_number"), iName = col("trading_name"), iTown = col("town"), iPc = col("postcode"), iPh = col("phone");
    if (iNum < 0) throw new Error("unexpected columns: " + head.join(","));
    const addr = ["address1", "address2", "address3"].map(col).filter((i) => i > -1);
    const cls = head.map((h, i) => [h, i] as [string, number]).filter(([h]) => /^class_\w+$/.test(h));
    const recs = rows.slice(1).filter((r) => r[iNum]).map((r) => ({
      site_number: r[iNum].trim().toUpperCase().replace(/\s/g, ""),
      trading_name: (r[iName] || "").trim(), address: addr.map((i) => (r[i] || "").trim()).filter(Boolean).join(", "),
      town: (r[iTown] || "").trim(), postcode: (r[iPc] || "").trim().toUpperCase(), phone: (r[iPh] || "").trim(),
      classes: cls.filter(([, i]) => yes(r[i])).map(([h]) => h.replace("class_", "")), updated_at: new Date().toISOString(),
    }));
    const seen = new Set<string>(); const uniq = recs.filter((r) => !seen.has(r.site_number) && seen.add(r.site_number));
    for (let i = 0; i < uniq.length; i += 1000) {
      const { error } = await db.from("mot_stations").upsert(uniq.slice(i, i + 1000));
      if (error) throw new Error(error.message);
    }
    await db.from("mot_stations_sync").upsert({ id: 1, synced_at: new Date().toISOString(), rows: uniq.length, source: m[0], error: null });
    return out({ synced: true, rows: uniq.length, source: m[0] });
  } catch (e) {
    await db.from("mot_stations_sync").upsert({ id: 1, synced_at: last?.synced_at || null, rows: last?.rows || null, source: last?.source || null, error: String(e).slice(0, 300) });
    return out({ error: String(e) }, 500);
  }
});
