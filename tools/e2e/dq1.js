// Demo on request: the public side. SITE=http://localhost:8765/ tests the working copy against the real database.
// node dq1.js [trade]   -> asks for a demo as a test business, and checks the demo cannot be opened without a link
const L = require('./lib'); const trade = process.argv[2] || 'valet'; const PHONE = !!process.env.PHONE;
(async () => {
  const { b, p } = await L.open(PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  // 1. nothing public opens the demo
  await p.go('network'); await p.waitForTimeout(1500);
  console.log('menu:', await p.evaluate(() => [...document.querySelectorAll('#tabs-net a')].filter(a => !a.hidden).map(a => a.textContent.trim()).join(' | ')));
  console.log('buttons that open a demo on the public pages:', await p.evaluate(() => [...document.querySelectorAll('[data-demo]')].filter(e => e.offsetWidth).length));
  console.log('start without a link:', await p.evaluate(() => window.MCdemo.start('valet')), '| now at', await p.evaluate(() => location.hash), '| demo on:', await p.evaluate(() => window.MCdemo.on()));
  // 2. a join page offers to ask for one
  await p.go('valets'); await p.waitForTimeout(2500);
  console.log('join page button:', await p.evaluate(() => { const e = document.querySelector('.rjdemo'); return e ? e.innerText.replace(/\n+/g, ' / ') : 'none'; }));
  // 3. the link for a trade
  await p.goto((process.env.SITE || 'https://preview.motoringcentral.co.uk/') + '?src=email-' + trade + '#demo-' + trade, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  const ck = await p.$('.ckbar button'); if (ck && await ck.isVisible()) await ck.click().catch(() => {});
  console.log('heading:', await p.txt('#dq-h1'), '| trade chosen:', await p.inputValue('#dq-trade'), '| chooser hidden:', await p.evaluate(() => document.getElementById('dq-all').hidden));
  await p.click('#dq-go'); console.log('empty form:', await p.txt('#dq-err'));
  await p.fill('#dq-biz', 'TEST Demo Request ' + trade); await p.fill('#dq-name', 'Test Person'); await p.fill('#dq-mail', 'not-an-email'); await p.click('#dq-go'); console.log('bad email:', await p.txt('#dq-err'));
  await p.fill('#dq-mail', 'vimen+demo-' + trade + '@motoringcentral.co.uk'); await p.fill('#dq-phone', '07700 900123'); await p.fill('#dq-town', 'Dartford DA1'); await p.fill('#dq-note', 'TEST request, please ignore.');
  await p.shot('dq-form-' + trade + (PHONE ? '-phone' : ''));
  await p.click('#dq-go'); await p.waitForTimeout(4000);
  console.log('after sending:', await p.txt('#dq-ok'), '| err:', await p.txt('#dq-err'));
  await p.shot('dq-sent-' + trade + (PHONE ? '-phone' : ''));
  // 4. links that are not right
  await p.goto((process.env.SITE || 'https://preview.motoringcentral.co.uk/') + '#mydemo-000000000000', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000);
  console.log('wrong link:', await p.txt('#dq-msg'), '| demo on:', await p.evaluate(() => window.MCdemo.on()));
  console.log('errors', p.errs); await b.close();
})();
