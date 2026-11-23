// Demo on request, on the live preview: every trade's link shows the form with that trade chosen, and old public ways in are gone.
const L = require('./lib'); const SITE = process.env.SITE || 'https://preview.motoringcentral.co.uk/';
const T = ['mot', 'valet', 'instructor', 'body', 'autoelec', 'dealer', 'recovery', 'evcharge'];
(async () => {
  const { b, p } = await L.open();
  for (const k of T) {
    await p.goto(SITE + '?src=email-' + k + '#demo-' + k, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200);
    console.log(k.padEnd(10), '|', await p.txt('#dq-h1'), '| chosen:', await p.inputValue('#dq-trade'), '| demo buttons showing:', await p.evaluate(() => [...document.querySelectorAll('[data-demo]')].filter(e => e.offsetWidth).length), '| came-from tag:', await p.evaluate(() => window.MCsrc()));
    await p.evaluate(() => { localStorage.removeItem('mc-src'); document.getElementById('dq-trade').__set = 0; });
  }
  // the "what you get" card appears when scrolled to
  await p.evaluate(() => document.querySelector('#v-demo main > .card:last-of-type').scrollIntoView()); await p.waitForTimeout(1500);
  console.log('what-you-get card visible:', await p.evaluate(() => getComputedStyle(document.querySelector('#v-demo main > .card:last-of-type')).opacity));
  // join pages offer "Ask for a demo first" and it leads to the form with the trade chosen
  for (const [hash, k] of [['recovery', 'recovery'], ['dealers', 'dealer'], ['mot-station', 'mot'], ['instructors', 'instructor']]) {
    await p.go(hash); await p.waitForTimeout(2600); const btn = p.locator('.rjdemo [data-demoask]:visible').first();
    if (!(await btn.count())) { console.log(hash, 'no button'); continue; }
    await btn.click(); await p.waitForTimeout(1200); console.log(hash.padEnd(12), '-> ', await p.evaluate(() => location.hash), '| chosen:', await p.inputValue('#dq-trade'), k === (await p.inputValue('#dq-trade')) ? 'OK' : 'WRONG');
    await p.evaluate(() => { document.getElementById('dq-trade').__set = 0; });
  }
  // search and FAQ wording
  await p.go('faq'); await p.waitForTimeout(1200);
  console.log('FAQ:', await p.evaluate(() => { const d = [...document.querySelectorAll('#v-faq details')].find(x => /try it before/i.test(x.textContent)); return d ? d.textContent.slice(0, 160) : 'none'; }));
  console.log('errors', p.errs); await b.close();
})();
