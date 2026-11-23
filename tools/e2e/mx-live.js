// several extras in one request against the real database. SITE=http://localhost:8765/ tests the working copy.
// node mx-live.js send | cust-part | sign | cust-pay | show
const L = require('./lib'); const TAG = process.env.TAG || 'TEST full check';
const closeIntro = p => p.evaluate(() => { const d = document.getElementById('mc-intro'); if (d && d.open) d.close(); });
async function partner(step) {
  const { b, p } = await L.open(process.env.PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  await L.partnerLogin(p, 'vimen+recovery@motoringcentral.co.uk'); await p.go('dashboard'); await p.waitForTimeout(9000);
  const job = p.locator('#mc-rsp .rsj', { hasText: TAG }).first();
  if (step === 'send') {
    await job.locator('[data-rxadd]').click(); await p.waitForTimeout(800);
    console.log('choices:', await p.evaluate(() => [...document.querySelectorAll('#mc-rsp .rsx-o')].map(e => e.innerText.replace(/\n+/g, ' ').trim()).join(' ; ')));
    await p.check('#mc-rsp [data-xc="dollies"]'); await p.check('#mc-rsp [data-xc="spill"]'); await p.check('#mc-rsp [data-xc="wait"]'); await p.fill('#mc-rsp [data-xq="wait"]', '2');
    await p.check('#mc-rsp [data-xc="other"][data-xi="0"]'); await p.fill('#mc-rsp [data-xn="0"]', 'Replacement wheel nut key'); await p.fill('#mc-rsp [data-xp="0"]', '18');
    await p.fill('#rsx-why', 'Rear wheels are locked and oil is on the road, so dollies and a clean-up are needed.');
    console.log('running total:', await p.innerText('#rsx-tot'));
    await p.locator('#mc-rsp .rsx-new').screenshot({ path: L.DIR + '/mx-live-form' + (process.env.PHONE ? '-phone' : '') + '.png' });
    await p.locator('#mc-rsp [data-rxsend$="|send"]').click(); await p.waitForTimeout(4500); console.log('after send:', await p.txt('#mctoast'));
  }
  if (step === 'sign') {
    await job.locator('[data-rxadd]').click(); await p.waitForTimeout(800);
    await p.check('#mc-rsp [data-xc="winch"]'); await p.check('#mc-rsp [data-xc="nokeys"]'); await p.fill('#rsx-why', 'Car is on soft ground and the keys are lost.');
    await p.locator('#mc-rsp [data-rxsend$="|sign"]').click(); await p.waitForTimeout(5000);
    console.log('SIGN SCREEN:', (await p.locator('.rsx-sig').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
    const pad = await p.$('#rsx-pad'); await pad.scrollIntoViewIfNeeded(); const bb = await pad.boundingBox(); await p.mouse.move(bb.x + 30, bb.y + bb.height * 0.6); await p.mouse.down();
    for (let i = 0; i < 20; i++) await p.mouse.move(bb.x + 30 + i * 12, bb.y + bb.height * (0.6 + 0.25 * Math.sin(i / 2))); await p.mouse.up();
    await p.fill('#rsx-nm', 'Test Customer'); await p.locator('#mc-rsp [data-rxok]').click(); await p.waitForTimeout(5000); console.log('after sign:', await p.txt('#mctoast'));
  }
  await p.waitForTimeout(1000);
  const j2 = p.locator('#mc-rsp .rsj', { hasText: TAG }).first();
  console.log('EXTRAS ON JOB:', (await j2.locator('.rsx').innerText()).replace(/\n+/g, ' | ').slice(0, 900));
  await j2.locator('.rsx').screenshot({ path: L.DIR + '/mx-live-job-' + step + '.png' }); console.log('errors', p.errs); await b.close();
}
async function customer(step) {
  const { b, p } = await L.open();
  await L.custLogin(p); await p.waitForFunction(() => window.GGuser && GGuser.sbid, null, { timeout: 20000 }); await closeIntro(p); if (process.env.PHONE) await p.setViewportSize({ width: 390, height: 844 }); await p.go('account'); await p.waitForTimeout(8000); await closeIntro(p);
  console.log('CUSTOMER CARD:', (await p.txt('#mc-cx')).slice(0, 900)); if (!(await p.vis('#mc-cx'))) { await b.close(); return; }
  await p.locator('#mc-cx').screenshot({ path: L.DIR + '/mx-live-cust-' + step + (process.env.PHONE ? '-phone' : '') + '.png' });
  if (step === 'show') { await b.close(); return; }
  if (step === 'cust-part') { // say no to one of them, pay for the rest
    const box = p.locator('#mc-cx label.cx-i', { hasText: 'Waiting time' }).locator('input'); await box.uncheck(); await p.waitForTimeout(300);
    console.log('after unticking the waiting time:', await p.txt('#mc-cx [data-cxok]'), '| total:', await p.txt('#mc-cx [data-cxt]'));
    await p.locator('#mc-cx').screenshot({ path: L.DIR + '/mx-live-cust-unticked.png' });
  }
  await p.locator('#mc-cx [data-cxok],#mc-cx [data-cxpay]').first().click(); await p.waitForTimeout(2500);
  console.log('PAY BOX:', (await p.txt('#paydlg')).slice(0, 300));
  await p.fill('#py-card', '4242 4242 4242 4242'); await p.fill('#py-exp', '12/30'); await p.fill('#py-cvc', '123'); if (await p.vis('#py-pc')) await p.fill('#py-pc', 'DA1 2EN');
  await p.click('#py-go'); await p.waitForTimeout(5000); await p.locator('#paydlg button:visible', { hasText: 'Continue' }).click(); await p.waitForTimeout(5000);
  console.log('after pay:', await p.txt('#mctoast'), '| card now:', (await p.txt('#mc-cx')).slice(0, 200) || 'gone'); console.log('errors', p.errs); await b.close();
}
(async () => { const s = process.argv[2]; if (/^(cust|show)/.test(s)) await customer(s); else await partner(s); })();
