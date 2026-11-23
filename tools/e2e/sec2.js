// Valid links after the change. node sec2.js all   -> the staff link: every trade opens and every guide step finds its place
//                               node sec2.js one   -> a valeter's link carries only the valeter demo
const L = require('./lib'); const fs = require('fs'); const SITE = process.env.SITE || 'https://preview.motoringcentral.co.uk/';
const local = u => u.replace('https://preview.motoringcentral.co.uk/', SITE);
const T = ['mot', 'valet', 'instructor', 'body', 'autoelec', 'dealer', 'recovery', 'evcharge'];
(async () => {
  const which = process.argv[2] || 'all'; const { b, p } = await L.open(); const real = []; let kitText = '';
  p.on('request', r => { const u = r.url(); if (/supabase\.co\/(rest|functions|storage)/.test(u)) real.push(r.method() + ' ' + u.replace(/^https:\/\/[^/]+/, '').split('?')[0]); });
  p.on('response', async r => { if (/rpc\/demo_kit$/.test(r.url())) { try { const j = await r.json(); if (j && j.kit) kitText = j.kit; } catch (e) {} } });
  if (which === 'one') {
    await p.goto(local(fs.readFileSync(L.DIR + '/dq-link.txt', 'utf8').trim()), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(7000);
    console.log('demo on:', await p.evaluate(() => window.MCdemo.on()), '| trades in what the server sent:', await p.evaluate(() => window.MCdemoList().join(',')), '| size', Math.round(kitText.length / 1024) + 'KB');
    console.log('other trades in what was sent:', ['Sample Motors', 'Sample MOT Centre', 'Sample Recovery', 'Sample Driving School', 'Sample EV Charging', 'Sample Body', 'Sample Auto Electrics'].filter(n => kitText.includes(n)).join(', ') || 'none');
    console.log('errors', p.errs); await b.close(); return;
  }
  await p.goto(local(fs.readFileSync(L.DIR + '/dq-own.txt', 'utf8').trim()), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000);
  const ck = await p.$('.ckbar button'); if (ck && await ck.isVisible()) await ck.click().catch(() => {});
  console.log('chooser:', await p.evaluate(() => [...document.querySelectorAll('#dq-all [data-demo]')].filter(e => e.offsetWidth).length, 'trades'), '| sent', Math.round(kitText.length / 1024) + 'KB');
  for (const k of T) {
    const n0 = real.length; await p.evaluate(() => { location.hash = 'demo'; }); await p.waitForTimeout(700);
    await p.click('#dq-all [data-demo="' + k + '"]'); await p.waitForTimeout(5500);
    const info = await p.evaluate(() => ({ on: window.MCdemo.on(), name: (window.GGuser || {}).name, steps: (window.MCdemo.state() || { steps: [] }).steps.length, hash: location.hash }));
    let found = 0; const miss = [];
    for (let i = 0; i < info.steps; i++) {
      await p.evaluate(i => { const g = document.querySelector('#mc-demo-guide'); if (g && g.classList.contains('min')) g.querySelector('[data-dg="toggle"]').click(); const s = document.querySelector('[data-dg="step:' + i + '"]'); if (s) s.click(); }, i); await p.waitForTimeout(250);
      await p.evaluate(i => { const s = document.querySelector('[data-dg="show:' + i + '"]'); if (s) s.click(); }, i); await p.waitForTimeout(1900);
      if (await p.evaluate(() => !!document.querySelector('.mc-demo-hl'))) found++; else miss.push(i + 1);
    }
    const calls = real.slice(n0).filter(c => !/partner_directory|app_settings|founding|rpc\/demo_kit|partners_near/.test(c));
    console.log(k.padEnd(10), '| on:', info.on, '| business:', info.name, '| steps found:', found + '/' + info.steps + (miss.length ? ' MISSING ' + miss.join(',') : ''), '| real database calls:', calls.length ? calls.slice(0, 3).join(', ') : 0);
    await p.evaluate(() => window.MCdemo.stop('demo')); await p.waitForTimeout(900);
  }
  console.log('errors', p.errs.slice(0, 5)); await b.close();
})();
