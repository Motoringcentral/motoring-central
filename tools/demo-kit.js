/* The demo kit: the sample businesses, sample jobs and step-by-step guide behind the partner demo.

   It is NOT a file on the website and must NEVER be committed to this repository (the repository is public). It lives
   in the database (private.demo_kit) and the server hands it only to a visitor whose personal demo link is valid, and
   only the part for that link's trade (public.demo_kit). This tool fetches it to edit, and puts it back.

   To change the demo:
     1. Make a one-time key (any 32+ random characters) and switch it on for 15 minutes, in the database:
          insert into private.demo_kit_key (hash, ends_at)
          values (encode(sha256(convert_to('<the key>', 'UTF8')), 'hex'), now() + interval '15 minutes');
     2. node tools/demo-kit.js get <the key> <file>      writes the whole kit to <file> (keep it outside the repository)
     3. edit <file>
     4. node tools/demo-kit.js put <the key> <file>      checks it, splits it by trade and replaces the kit
     5. delete from private.demo_kit_key;
   Without a key that is switched on, get and put are refused.

   node tools/demo-kit.js check <file>   only checks a file: that it splits and joins back exactly, and that the kit for
                                         each single trade is valid JavaScript on its own. */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const TRADES = ['valet', 'body', 'autoelec', 'mot', 'instructor', 'recovery', 'evcharge', 'dealer'];

/* A trade's part is its "MAKE.<trade>=function(){" line and the indented lines under it. Everything else is shared. */
function split(text) {
  const lines = text.split('\n'); const parts = []; let cur = null, shared = 0;
  const push = (trade) => { cur = { part: trade || 'shared-' + (++shared), trade: trade || null, lines: [] }; parts.push(cur); };
  for (const ln of lines) {
    const m = /^MAKE\.([a-z]+)=function\(\)\{/.exec(ln);
    if (m) { if (!TRADES.includes(m[1])) throw new Error('unknown trade in the kit: ' + m[1]); push(m[1]); cur.lines.push(ln); continue; }
    const inside = cur && cur.trade && (ln === '' || /^\s/.test(ln));
    if (!cur || (cur.trade && !inside)) push(null);
    cur.lines.push(ln);
  }
  return parts.map((p, i) => ({ pos: (i + 1) * 10, part: p.part, trade: p.trade, body: p.lines.join('\n') }));
}
const join = (parts, trade) => parts.filter(p => !p.trade || !trade || p.trade === trade).sort((a, b) => a.pos - b.pos).map(p => p.body).join('\n');
function check(text) {
  const parts = split(text);
  if (join(parts) !== text) throw new Error('the kit does not join back to the same text');
  const have = parts.filter(p => p.trade).map(p => p.trade);
  for (const t of TRADES) if (have.filter(x => x === t).length !== 1) throw new Error('the kit must have exactly one part for ' + t);
  for (const t of [null].concat(TRADES)) { try { new vm.Script(join(parts, t)); } catch (e) { throw new Error('not valid JavaScript' + (t ? ' for ' + t + ' alone' : '') + ': ' + e.message); } }
  return parts;
}
function site() { // the database address and public key are the ones the website itself uses
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const u = /SB_URL\s*=\s*['"]([^'"]+)['"]/.exec(html), k = /SB_KEY\s*=\s*['"]([^'"]+)['"]/.exec(html);
  if (!u || !k) throw new Error('could not read the database address from index.html'); return { url: u[1], key: k[1] };
}
async function rpc(name, args) {
  const s = site(); const r = await fetch(s.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const t = await r.text(); if (!r.ok) throw new Error(name + ' refused: ' + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'check') { const p = check(fs.readFileSync(a, 'utf8')); console.log('ok:', p.length, 'parts,', p.filter(x => x.trade).length, 'trades'); return; }
  if (cmd === 'put') { const p = check(fs.readFileSync(b, 'utf8')); console.log('saved:', await rpc('demo_kit_put', { p_key: a, p_parts: p })); return; }
  if (cmd === 'get') { const p = await rpc('demo_kit_get', { p_key: a }); fs.writeFileSync(b, join(p)); console.log('written:', b, '(' + p.length + ' parts)'); return; }
  console.log('node tools/demo-kit.js check <file> | get <key> <file> | put <key> <file>');
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
