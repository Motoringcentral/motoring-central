// a visitor has the valeter demo open; staff stop the link; the visitor's next page load must end the demo
const L=require('./lib'),A=require('./adm1'),fs=require('fs');
(async()=>{const v=await L.open();const p=v.p;await p.goto(fs.readFileSync(L.DIR+'/dq-link.txt','utf8').trim(),{waitUntil:'domcontentloaded'});await p.waitForTimeout(7000);
 console.log('visitor: demo on =',await p.evaluate(()=>window.MCdemo.on()),'at',await p.evaluate(()=>location.hash));
 const s=await A.login();const q=s.p;q.on('dialog',d=>d.accept());await q.waitForTimeout(2500);await q.click('#admin-body .adm-todo [data-tab="demo"]');await q.waitForTimeout(4000);
 const it=q.locator('#mc-dmr .job',{hasText:'TEST Demo Request valet'}).first();await it.locator('[data-dmrset$=":stop"]').click();await q.waitForTimeout(4000);
 console.log('staff: ',(await q.locator('#mc-dmr .job',{hasText:'TEST Demo Request valet'}).first().locator('.sst').innerText()));await s.b.close();
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(7000);
 console.log('visitor after reload: demo on =',JSON.stringify(await p.evaluate(()=>window.MCdemo.on())),'| at',await p.evaluate(()=>location.hash),'| message:',await p.txt('#dq-msg'),'| "open it again" card showing:',await p.evaluate(()=>{const e=document.getElementById('dq-back');return !!e&&!e.hidden}),'| content still in the page:',await p.evaluate(()=>typeof window.MCdemoMake),'| bar:',await p.evaluate(()=>!!document.getElementById('mc-demo-bar')));
 await p.shot('sec-stopped');console.log('errors',p.errs);await v.b.close()})();
