// Demo on request: open a personal link as a visitor. node dq3.js one   (the link from dq2 send)   |   node dq3.js own   (the staff link)
const L = require('./lib'); const fs = require('fs'); const PHONE = !!process.env.PHONE;
const local = u => process.env.SITE ? u.replace('https://preview.motoringcentral.co.uk/', process.env.SITE) : u;
(async () => {
  const which = process.argv[2] || 'one';
  const link = local(fs.readFileSync(L.DIR + (which === 'own' ? '/dq-own.txt' : '/dq-link.txt'), 'utf8').trim());
  const { b, p } = await L.open(PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  const calls = []; p.on('request', r => { const u = r.url(); if (/supabase\.co\/rest\/v1\/rpc\//.test(u)) calls.push(u.split('/rpc/')[1]); });
  await p.goto(link, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(7000);
  const ck = await p.$('.ckbar button'); if (ck && await ck.isVisible()) await ck.click().catch(() => {});
  if (which === 'one') {
    console.log('at:', await p.evaluate(() => location.hash), '| demo on:', await p.evaluate(() => window.MCdemo.on()), '| bar:', (await p.txt('#mc-demo-bar')).slice(0, 110));
    console.log('guide:', await p.evaluate(() => { const g = document.getElementById('mc-demo-guide'); return g ? g.innerText.replace(/\n+/g, ' | ').slice(0, 160) : 'none'; }));
    console.log('guide footer buttons:', await p.evaluate(() => [...document.querySelectorAll('#mc-demo-guide .mdg-f button')].map(e => e.textContent).join(' | ')));
    await p.shot('dq-open' + (PHONE ? '-phone' : ''));
    // reload keeps the demo; leaving goes to the request page with a way back
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(5000); console.log('after reload, demo on:', await p.evaluate(() => window.MCdemo.on()));
    await p.evaluate(() => window.MCdemo.stop('demo')); await p.waitForTimeout(1500);
    console.log('after leaving:', await p.evaluate(() => location.hash), '| back card:', await p.txt('#dq-back'), '| form title:', await p.txt('#dq-card h2'));
    await p.click('#dq-back [data-demo]'); await p.waitForTimeout(5000); console.log('opened again:', await p.evaluate(() => window.MCdemo.on()));
    console.log('another trade without asking:', await p.evaluate(() => window.MCdemo.start('dealer')), await p.evaluate(() => location.hash));
  } else {
    console.log('at:', await p.evaluate(() => location.hash), '| heading:', await p.txt('#dq-h1'), '| trades offered:', await p.evaluate(() => [...document.querySelectorAll('#dq-all [data-demo]')].filter(e => e.offsetWidth).map(e => e.getAttribute('data-demo')).join(',')));
    await p.screenshot({ path: L.DIR + '/dq-own-page' + (PHONE ? '-phone' : '') + '.png', fullPage: true });
    for (const k of ['recovery', 'dealer']) {
      await p.click('#dq-all [data-demo="' + k + '"]'); await p.waitForTimeout(6000);
      console.log(k, '-> demo on:', await p.evaluate(() => window.MCdemo.on()), '| footer:', await p.evaluate(() => [...document.querySelectorAll('#mc-demo-guide .mdg-f button')].map(e => e.textContent).join(' | ')));
      await p.evaluate(() => window.MCdemo.stop('demo')); await p.waitForTimeout(1500);
    }
  }
  console.log('server calls:', calls.filter(c => /demo/.test(c)).join(', '), '| errors', p.errs); await b.close();
})();
