// several extras in one request, in the recovery try-it demo (no database): tick three, send, withdraw, then tick two and sign
const L = require('./dlib');
(async () => {
  const { b, p } = await L.open(process.env.PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  console.log('demo started:', await p.demo('recovery')); await p.tab('jobs');
  const job = p.locator('#mc-rsp .rsj').first();
  console.log('guide steps:', await p.evaluate(() => [...document.querySelectorAll('#mc-demo-guide .mdg-s,#mc-demo-guide li')].map(e => e.textContent.trim().slice(0, 40)).join(' / ')));
  await job.locator('[data-rxadd]').click(); await p.waitForTimeout(600);
  console.log('choices:', await p.evaluate(() => [...document.querySelectorAll('#mc-rsp .rsx-o')].map(e => e.innerText.replace(/\n+/g, ' ').trim()).join(' ; ')));
  await p.check('#mc-rsp [data-xc="dollies"]'); await p.check('#mc-rsp [data-xc="spill"]'); await p.check('#mc-rsp [data-xc="wait"]'); await p.fill('#mc-rsp [data-xq="wait"]', '2');
  await p.check('#mc-rsp [data-xc="other"][data-xi="0"]'); await p.fill('#mc-rsp [data-xn="0"]', 'Replacement wheel nut key'); await p.fill('#mc-rsp [data-xp="0"]', '18');
  await p.waitForTimeout(300); console.log('running total:', await p.innerText('#rsx-tot'));
  await p.locator('#mc-rsp .rsx-new').screenshot({ path: L.DIR + '/mx-form' + (process.env.PHONE ? '-phone' : '') + '.png' });
  // no reason yet
  await p.locator('#mc-rsp [data-rxsend$="|send"]').click(); await p.waitForTimeout(500); console.log('without a reason:', await p.innerText('#mctoast').catch(() => ''));
  await p.fill('#rsx-why', 'Rear wheels are locked and oil is on the road, so dollies and a clean-up are needed.');
  await p.locator('#mc-rsp [data-rxsend$="|send"]').click(); await p.waitForTimeout(1500);
  console.log('after send:', await p.innerText('#mctoast').catch(() => ''));
  console.log('ON THE JOB:', (await job.locator('.rsx').innerText()).replace(/\n+/g, ' | '));
  await job.locator('.rsx').screenshot({ path: L.DIR + '/mx-sent.png' });
  console.log('add button while one is waiting:', await job.locator('[data-rxadd]').count());
  await job.locator('[data-rxwd]').click(); await p.waitForTimeout(1500); console.log('after withdraw:', (await job.locator('.rsx').innerText()).replace(/\n+/g, ' | ').slice(0, 200));
  // sign on the phone
  const before = await p.evaluate(() => { const D = window.MCdemo.state(); return D && D.tables ? D.tables.bookings[0].price_total : null; });
  await job.locator('[data-rxadd]').click(); await p.waitForTimeout(500);
  await p.check('#mc-rsp [data-xc="winch"]'); await p.check('#mc-rsp [data-xc="nokeys"]'); await p.fill('#rsx-why', 'Car is on soft ground and the keys are lost.');
  await p.locator('#mc-rsp [data-rxsend$="|sign"]').click(); await p.waitForTimeout(1500);
  console.log('SIGN SCREEN:', (await p.locator('.rsx-sig').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  const pad = await p.$('#rsx-pad'); const bb = await pad.boundingBox(); await p.mouse.move(bb.x + 30, bb.y + bb.height * 0.6); await p.mouse.down();
  for (let i = 0; i < 20; i++) await p.mouse.move(bb.x + 30 + i * 12, bb.y + bb.height * (0.6 + 0.25 * Math.sin(i / 2))); await p.mouse.up();
  await p.locator('.rsx-sig').screenshot({ path: L.DIR + '/mx-sign.png' });
  await p.fill('#rsx-nm', 'Sample Customer'); await p.locator('#mc-rsp [data-rxok]').click(); await p.waitForTimeout(1800);
  console.log('after sign:', await p.innerText('#mctoast').catch(() => ''));
  console.log('ON THE JOB:', (await p.locator('#mc-rsp .rsj').first().locator('.rsx').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  const after = await p.evaluate(() => { const D = window.MCdemo.state(); return D && D.tables ? D.tables.bookings[0].price_total : null; });
  console.log('booking total before / after:', before, after);
  console.log('database calls during the demo:', p.net.filter(x => !/partner_directory|app_settings|founding/.test(x)).length, '| errors:', p.errs);
  await p.shot('mx-end' + (process.env.PHONE ? '-phone' : '')); await b.close();
})();
