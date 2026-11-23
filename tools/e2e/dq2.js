// Demo on request: the admin side. node dq2.js look | send <text on the request> | own
// Prints the links it finds so the next test can open them as a visitor.
const A = require('./adm1'); const L = require('./lib'); const fs = require('fs');
(async () => {
  const step = process.argv[2] || 'look', tag = process.argv[3] || 'TEST Demo Request valet';
  const { b, p } = await A.login(); await p.waitForTimeout(3000);
  console.log('user', await p.evaluate(() => window.GGuser && GGuser.role + '/' + GGuser.level + ' ' + location.hash));
  console.log('to-do line:', await p.evaluate(() => { const e = [...document.querySelectorAll('#admin-body .adm-todo button')].find(x => /Demo requests/.test(x.textContent)); return e ? e.innerText.replace(/\n+/g, ' | ') : 'none'; }));
  console.log('Partners badge:', await p.evaluate(() => { const e = document.querySelector('#admin-body .acats [data-acount="pd"]'); return e ? (e.hidden ? 'hidden' : e.textContent) : 'none'; }));
  await p.click('#admin-body .adm-todo [data-tab="demo"]'); await p.waitForTimeout(4000);
  console.log('help:', await p.txt('#admin-body .adm-help'));
  const box = p.locator('#mc-dmr'); console.log('headings:', await p.evaluate(() => [...document.querySelectorAll('#mc-dmr h3')].map(e => e.textContent).join(' | ')));
  const item = box.locator('.job', { hasText: tag }).first();
  if (step === 'look') { console.log('REQUEST:', (await item.innerText()).replace(/\n+/g, ' | ')); await p.screenshot({ path: L.DIR + '/dq-admin.png', fullPage: true }); }
  if (step === 'send') {
    console.log('BEFORE:', (await item.innerText()).replace(/\n+/g, ' | ').slice(0, 300));
    await item.locator('[data-dmrsend$=":1"]').click(); await p.waitForTimeout(5000); console.log('toast:', await p.txt('#mctoast'));
    const it2 = p.locator('#mc-dmr .job', { hasText: tag }).first(); console.log('AFTER:', (await it2.innerText()).replace(/\n+/g, ' | ').slice(0, 500));
    const link = await it2.locator('[data-dmrcopy]').getAttribute('data-dmrcopy'); console.log('LINK:', link); fs.writeFileSync(L.DIR + '/dq-link.txt', link);
    await it2.screenshot({ path: L.DIR + '/dq-admin-sent.png' });
  }
  if (step === 'stop' || step === 'close' || step === 'reopen') {
    p.on('dialog', d => d.accept());
    if (step === 'reopen') { await box.locator('[data-dmrshow="all"]').click(); await p.waitForTimeout(800); }
    const it = p.locator('#mc-dmr .job', { hasText: tag }).first(); await it.locator('[data-dmrset$=":' + step + '"]').click(); await p.waitForTimeout(4500);
    if (step === 'close') { await p.locator('#mc-dmr [data-dmrshow="all"]').click(); await p.waitForTimeout(800); }
    console.log('AFTER ' + step + ':', (await p.locator('#mc-dmr .job', { hasText: tag }).first().innerText()).replace(/\n+/g, ' | ').slice(0, 420));
  }
  if (step === 'own') {
    await box.locator('[data-dmrown="get"]').click(); await p.waitForTimeout(4000);
    const link = await box.locator('button', { hasText: 'Copy my link' }).getAttribute('data-dmrcopy'); console.log('OWN LINK:', link); fs.writeFileSync(L.DIR + '/dq-own.txt', link);
    console.log('links to email:', await p.evaluate(() => [...document.querySelectorAll('#mc-dmr .job [data-dmrcopy]')].map(e => e.getAttribute('data-dmrcopy')).filter(x => /#demo-/.test(x)).join('\n')));
    await p.screenshot({ path: L.DIR + '/dq-admin-own.png', fullPage: true });
  }
  console.log('errors', p.errs); await b.close();
})();
