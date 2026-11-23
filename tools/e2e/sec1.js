// Can the demo be opened WITHOUT a valid link? Tries the ways a technical person would. SITE=http://localhost:8765/ for the working copy.
const L = require('./lib'); const SITE = process.env.SITE || 'https://preview.motoringcentral.co.uk/';
(async () => {
  const { b, p } = await L.open(); const kitCalls = []; p.on('response', async r => { if (/rpc\/demo_/.test(r.url())) kitCalls.push(r.url().split('/rpc/')[1] + ' -> ' + r.status()); });
  // 1. the old public file
  await p.go('demo'); await p.waitForTimeout(1500);
  console.log('1. old file js/demo.js:', await p.evaluate(async () => { const r = await fetch('js/demo.js?x=' + Date.now()); const t = await r.text(); return r.status + ' ' + (/MCdemoMake/.test(t) ? 'STILL THERE' : 'gone (no demo content in the reply)'); }));
  console.log('2. demo content in the page as loaded:', await p.evaluate(() => typeof window.MCdemoMake), '| sample business names in the page source:', await p.evaluate(() => /Sample Valeting Co|Sample Motors|Sample MOT Centre/.test(document.documentElement.innerHTML)));
  // 3. flip the browser-side flags that used to be the only check
  for (const [name, ok, saved] of [['"all" flag', '{"all":1}', null], ['flag + made-up code', '{"all":1,"code":"000000000000"}', null], ['flag + made-up code + a saved demo', '{"all":1,"valet":1,"code":"abcdefabcdef"}', '{"key":"valet","done":{}}']]) {
    await p.evaluate(([ok, saved]) => { sessionStorage.setItem('mc-demo-ok', ok); if (saved) sessionStorage.setItem('mc-demo', saved); else sessionStorage.removeItem('mc-demo'); }, [ok, saved]);
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4500);
    const st = await p.evaluate(() => window.MCdemo.start('valet').then(x => x, e => 'error ' + e)); await p.waitForTimeout(2500);
    console.log('3. ' + name + ':', 'start ->', st, '| demo on:', JSON.stringify(await p.evaluate(() => window.MCdemo.on())), '| content loaded:', await p.evaluate(() => typeof window.MCdemoMake), '| at', await p.evaluate(() => location.hash), '| chooser showing:', await p.evaluate(() => { const e = document.getElementById('dq-all'); return !!e && !e.hidden && e.offsetHeight > 0; }));
  }
  await p.evaluate(() => sessionStorage.clear());
  // 4. ask the server directly
  const ask = (fn, args) => p.evaluate(async ([fn, args]) => { const m = /SB_URL='([^']+)',SB_KEY='([^']+)'/.exec(document.documentElement.innerHTML); const r = await fetch(m[1] + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: m[2], Authorization: 'Bearer ' + m[2], 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); return r.status + ' ' + (await r.text()).slice(0, 110); }, [fn, args]);
  console.log('4. server, made-up code:', await ask('demo_kit', { p_code: '000000000000', p_resume: false }));
  console.log('   server, no code:', await ask('demo_kit', { p_code: '', p_resume: true }));
  console.log('   server, old check:', await ask('demo_open', { p_code: '000000000000' }));
  console.log('   server, read the kit with no key:', await ask('demo_kit_get', { p_key: 'x'.repeat(40) }));
  console.log('   server, replace the kit with no key:', await ask('demo_kit_put', { p_key: 'x'.repeat(40), p_parts: [] }));
  console.log('   server, the tables directly:', await p.evaluate(async () => { const m = /SB_URL='([^']+)',SB_KEY='([^']+)'/.exec(document.documentElement.innerHTML); const o = []; for (const t of ['demo_kit', 'demo_requests', 'demo_kit_key']) { const r = await fetch(m[1] + '/rest/v1/' + t + '?select=*&limit=1', { headers: { apikey: m[2], Authorization: 'Bearer ' + m[2] } }); o.push(t + ': ' + r.status + ' ' + (await r.text()).slice(0, 60)); } return o.join(' | '); }));
  console.log('server calls made by the page itself:', kitCalls.join(', ') || 'none', '| errors', p.errs); await b.close();
})();
