// try a new stylesheet on real windscreen cards: opens the dealer demo, opens the print window, swaps the styles,
// can also stretch the content (long title, many badges, long description, no photo) and prints to PDF three ways
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/../ws/';
const SITE = process.env.SITE || 'https://preview.motoringcentral.co.uk/';
const CSS = fs.existsSync(__dirname + '/ws-new.css') ? fs.readFileSync(__dirname + '/ws-new.css', 'utf8') : '';
const CASE = process.env.CASE || 'normal';
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
  const all = process.env.ALL === '1';
  const btn = all ? await p.$('[data-wsall]') : (await p.$$('[data-wsc]'))[0];
  const [w] = await Promise.all([ctx.waitForEvent('page'), btn.click()]);
  await w.waitForTimeout(2500);
  if (CSS && process.env.OLD !== '1') await w.evaluate(css => { document.querySelector('style').textContent = css; }, CSS);
  await w.evaluate(kase => {
    const s = document.querySelector('.ws');
    if (kase === 'long' || kase === 'worst' || kase === 'worstnophoto') {
      s.querySelector('h1').textContent = '2021 Mercedes-Benz Sprinter 314 CDI Long Wheelbase High Roof';
      s.querySelector('.ws-var').textContent = '2.1 CDI 140 Premium 7G-Tronic Plus, Euro 6, air conditioning';
      const pr = s.querySelector('.ws-pr'); pr.innerHTML = '<div class="ws-price">£27,995 <small>+ VAT</small></div><div class="ws-was">Was £29,495<b>Save £1,500</b></div>';
      let bd = s.querySelector('.ws-badges'); if (!bd) { bd = document.createElement('div'); bd.className = 'ws-badges'; s.querySelector('.ws-grid').after(bd); }
      bd.innerHTML = '<span>✓ History checked: no write-off, finance or theft found</span><span>✓ ULEZ and Clean Air Zone ready</span><span>VAT qualifying</span>';
      let d = s.querySelector('.ws-desc'); if (!d) { d = document.createElement('p'); d.className = 'ws-desc'; s.querySelector('.ws-body').appendChild(d); }
      d.textContent = 'One owner from new with full main dealer service history, the last service at 61,000 miles. Ply lined, bulkhead, side loading door, reversing camera, cruise control and Bluetooth. Two keys. Just had four new tyres and a fresh MOT with no advisories. Finance and delivery available…';
      const hd = s.querySelector('.ws-hd > div:last-child'); hd.insertAdjacentHTML('beforeend', '<div class="ws-rate">★ 4.8 from 37 customer reviews</div>');
      s.querySelector('.ws-hs').textContent = 'Dartford DA1 1DE · samplemotors.co.uk';
      const hdr = s.querySelector('.ws-hd'); hdr.insertAdjacentHTML('afterbegin', '<div class="ws-logo"><img alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#0B1C35"/><text x="100" y="72" font-size="34" fill="#fff" text-anchor="middle" font-family="Arial">LOGO</text></svg>') + '"></div>');
      const ph = s.querySelector('.ws-ft span:last-child'); if (ph && !s.querySelector('.ws-ph')) ph.insertAdjacentHTML('afterend', '<span class="ws-ph">01632 960130</span>');
    }
    if (kase === 'nophoto' || kase === 'worstnophoto') { const ph = s.querySelector('.ws-photo'); if (ph) ph.remove(); s.classList.add('ws-np'); }
  }, CASE);
  // the same tidy-up the site runs before printing, run again here because the test changed the wording afterwards
  await w.evaluate(() => { document.querySelectorAll('.ws').forEach(s => { const d = s.querySelector('.ws-desc'); if (!d) return; d.style.display = ''; d.style.maxHeight = ''; d.style.webkitLineClamp = ''; const h = d.clientHeight; if (d.scrollHeight <= h + 1) return;
    const lh = parseFloat(getComputedStyle(d).lineHeight) || 19, n = Math.floor((h + 1) / lh); if (n < 1) { d.style.display = 'none'; return; } d.style.display = '-webkit-box'; d.style.webkitBoxOrient = 'vertical'; d.style.webkitLineClamp = String(n); d.style.maxHeight = (n * lh) + 'px'; }); });
  await w.waitForTimeout(400);
  const tag = process.env.TAG || CASE;
  const modes = [['designed', { preferCSSPageSize: true }], ['margins13', { format: 'A4', margin: { top: '12.7mm', bottom: '12.7mm', left: '12.7mm', right: '12.7mm' } }], ['margins20', { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } }], ['letter', { format: 'Letter', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }]];
  for (const [name, opt] of modes) await w.pdf(Object.assign({ path: OUT + tag + '-' + name + '.pdf', printBackground: true }, opt));
  await w.emulateMedia({ media: 'print' });
  await w.setViewportSize({ width: 733, height: 1062 });   // A4 less 8mm margins, in CSS pixels
  const m = await w.evaluate(() => { const mm = v => Math.round(v / 96 * 25.4 * 10) / 10; return [...document.querySelectorAll('.ws')].map(s => { const body = s.querySelector('.ws-body'), ph = s.querySelector('.ws-photo'), ft = s.querySelector('.ws-ft');
    return { card: mm(s.getBoundingClientRect().height) + ' x ' + mm(s.getBoundingClientRect().width), needs: mm(s.scrollHeight), bodyClipped: mm(body.scrollHeight - body.clientHeight), photo: ph ? mm(ph.getBoundingClientRect().height) : 'none', footerBottom: mm(ft.getBoundingClientRect().bottom - s.getBoundingClientRect().top) }; }); });
  console.log(CASE, JSON.stringify(m));
  await b.close();
})();
