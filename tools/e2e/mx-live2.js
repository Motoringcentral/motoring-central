// last check on the live preview: send two extras, see them as the customer, then withdraw (leaves nothing waiting)
const L = require('./lib'); const TAG = 'TEST full check';
(async () => {
  let { b, p } = await L.open(); await L.partnerLogin(p, 'vimen+recovery@motoringcentral.co.uk'); await p.go('dashboard'); await p.waitForTimeout(9000);
  let job = p.locator('#mc-rsp .rsj', { hasText: TAG }).first();
  await job.locator('[data-rxadd]').click(); await p.waitForTimeout(800);
  await p.check('#mc-rsp [data-xc="skates"]'); await p.check('#mc-rsp [data-xc="low"]'); await p.fill('#rsx-why', 'Low car on a tight car park ramp (TEST).');
  console.log('total:', await p.innerText('#rsx-tot'));
  await p.locator('#mc-rsp [data-rxsend$="|send"]').click(); await p.waitForTimeout(4500); console.log('after send:', await p.txt('#mctoast'));
  console.log('errors', p.errs); await b.close();
  ({ b, p } = await L.open()); await L.custLogin(p); await p.waitForFunction(() => window.GGuser && GGuser.sbid, null, { timeout: 20000 });
  await p.evaluate(() => { const d = document.getElementById('mc-intro'); if (d && d.open) d.close(); }); await p.go('account'); await p.waitForTimeout(8000);
  console.log('CUSTOMER SEES:', (await p.txt('#mc-cx')).slice(230, 700)); console.log('errors', p.errs); await b.close();
  ({ b, p } = await L.open()); await L.partnerLogin(p, 'vimen+recovery@motoringcentral.co.uk'); await p.go('dashboard'); await p.waitForTimeout(9000);
  job = p.locator('#mc-rsp .rsj', { hasText: TAG }).first(); await job.locator('[data-rxwd]').click(); await p.waitForTimeout(4000);
  console.log('after withdraw:', await p.txt('#mctoast'), '| waiting now:', await job.locator('[data-rxwd]').count(), '| add button:', await job.locator('[data-rxadd]').count());
  console.log('errors', p.errs); await b.close();
})();
