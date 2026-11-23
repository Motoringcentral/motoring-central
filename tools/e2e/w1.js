// open the dealer demo, print a windscreen card and measure how it sits on the page
const { chromium } = require('playwright');
const OUT = __dirname + '/../ws/';
const SITE = process.env.SITE || 'https://preview.motoringcentral.co.uk/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.route('**/*', r => { const u = r.request().url(); return /localhost:8765|preview\.motoringcentral\.co\.uk|supabase\.co|cdnjs\.cloudflare\.com|api\.postcodes\.io/.test(u) ? r.continue() : r.abort(); });
  const p = await ctx.newPage();
  await p.goto(SITE + '#demo-dealer', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const ck = await p.$('.ckbar button');
  if (ck && await ck.isVisible()) await ck.click().catch(() => {});
  await p.evaluate(() => window.MCpt.go('adverts', ''));
  await p.waitForTimeout(2000);
  const btns = await p.$$('[data-wsc]');
  console.log('card buttons', btns.length, 'print-all', !!(await p.$('[data-wsall]')));
  const which = +(process.env.CARD || 0);
  const [w] = await Promise.all([ctx.waitForEvent('page'), btns[which].click()]);
  await w.waitForTimeout(2500);
  await w.emulateMedia({ media: 'print' });
  const m = await w.evaluate(() => {
    const mm = v => Math.round(v / 96 * 25.4 * 10) / 10;
    return [...document.querySelectorAll('.ws')].map(s => ({
      cardHeight: mm(s.getBoundingClientRect().height), cardWidth: mm(s.getBoundingClientRect().width), contentHeight: mm(s.scrollHeight),
      parts: [...s.children].map(c => c.className + ':' + mm(c.getBoundingClientRect().height)).join('  '),
      body: [...s.querySelector('.ws-body').children].map(c => (c.className || c.tagName) + ':' + mm(c.getBoundingClientRect().height)).join('  ')
    }));
  });
  console.log(JSON.stringify(m, null, 1));
  const tag = process.env.TAG || 'before';
  await w.pdf({ path: OUT + tag + '-as-designed.pdf', preferCSSPageSize: true, printBackground: true });
  await w.pdf({ path: OUT + tag + '-browser-margins.pdf', format: 'A4', printBackground: true, margin: { top: '12.7mm', bottom: '12.7mm', left: '12.7mm', right: '12.7mm' } });
  await w.pdf({ path: OUT + tag + '-no-margins.pdf', format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await b.close();
})();
