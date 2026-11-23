// EV charging with a price per kWh, on the live preview: the customer's form and price, a paid booking, and the
// partner's job card and prices page.
const L = require('./lib');
(async () => {
  let { b, p } = await L.open(require('fs').existsSync(L.DIR + '/state-customer.json') ? { storageState: L.DIR + '/state-customer.json' } : {});
  await p.go('drivers'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const d = document.getElementById('mc-intro'); if (d && d.open) d.close(); });
  if (!(await p.evaluate(() => window.GGuser))) { await L.custLogin(p); await p.evaluate(() => { const d = document.getElementById('mc-intro'); if (d && d.open) d.close(); }); }
  await p.locator('button:visible,a:visible', { hasText: /^Mobile EV charging/ }).first().click(); await p.waitForTimeout(2500);
  console.log('kWh choices:', await p.evaluate(() => [...document.querySelectorAll('#evc-kwh option')].map(o => o.textContent).join(' | ')));
  console.log('default kWh:', await p.inputValue('#evc-kwh'));
  await p.selectOption('#evc-need', 'booked'); await p.waitForTimeout(300);
  console.log('after choosing a booked top-up:', await p.inputValue('#evc-kwh'));
  await p.selectOption('#evc-need', 'rescue'); await p.selectOption('#evc-kwh', '20'); await p.waitForTimeout(300);
  await p.fill('#ev-from', 'DA9 9ST'); await p.fill('#ev-spot', 'Car park level 2 (TEST kWh booking)'); await p.fill('#ev-reg', 'EV21TST');
  await p.click('#evc-find'); await p.waitForTimeout(8000);
  console.log('err:', await p.txt('#evc-err'), '| sum:', await p.txt('#ev-sum'));
  console.log('COMPANIES:', (await p.txt('#evc-prov')).slice(0, 500));
  const pick = p.locator('#evc-prov button', { hasText: 'TEST EV' }).first();
  if (!(await pick.count())) { console.log('test partner not listed'); await p.shot('evk-1'); await b.close(); return; }
  await pick.click(); await p.waitForTimeout(1200);
  console.log('PRICE:', await p.txt('#ev-break')); console.log('button:', await p.txt('#ego'));
  await p.shot('evk-2-price');
  await p.check('#tc-ego'); await p.click('#ego'); await p.waitForTimeout(2500);
  await p.fill('#py-card', '4242 4242 4242 4242'); await p.fill('#py-exp', '12/30'); await p.fill('#py-cvc', '123');
  await p.click('#py-go'); await p.waitForTimeout(6000);
  await p.locator('#paydlg button:visible', { hasText: 'Continue' }).click(); await p.waitForTimeout(8000);
  console.log('DONE:', await p.vis('#evc-done'), '|', (await p.txt('#evc-done')).slice(0, 300), '| err:', await p.txt('#evc-err'));
  console.log('customer errors', p.errs.slice(0, 3)); await b.close();
  // the charging company
  ({ b, p } = await L.open());
  console.log('partner:', JSON.stringify(await L.partnerLogin(p, 'vimen+ev@motoringcentral.co.uk')).slice(0, 120)); await p.waitForTimeout(3500);
  console.log('JOB CARD:', (await p.evaluate(() => { const j = document.querySelector('#mc-rsp .rsj'); return j ? j.innerText.replace(/\n+/g, ' | ') : 'none'; })).slice(0, 700));
  await p.evaluate(() => window.MCpt.go('setup', 'prices')); await p.waitForTimeout(1800);
  console.log('PRICES PAGE:', await p.evaluate(() => [...document.querySelectorAll('#dash-body input[type=number]')].filter(e => e.offsetWidth).map(e => e.id + '=' + e.value).join(', ')));
  console.log('note:', await p.evaluate(() => { const c = [...document.querySelectorAll('#dash-body .card')].find(x => x.querySelector('#dr-kwh')); return c ? c.querySelector('p.note').textContent : ''; }));
  await p.fill('#dr-kwh', '0.9'); await p.click('#dr-save'); await p.waitForTimeout(5500);
  await p.shot('evk-3-prices'); console.log('partner errors', p.errs.slice(0, 3)); await b.close();
})();
