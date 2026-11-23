const A=require('./adm1'),L=require('./lib');(async()=>{const {b,p}=await A.login();await p.waitForTimeout(3000);await p.click('#admin-body .adm-todo [data-tab="demo"]');await p.waitForTimeout(4000);
 await p.locator('#mc-dmr [data-dmrown="get"]').click();await p.waitForTimeout(3500);
 console.log(await p.evaluate(()=>[...document.querySelectorAll('#mc-dmr .job [data-dmrcopy]')].map(e=>e.getAttribute('data-dmrcopy')).filter(x=>/#demo-/.test(x)).join('\n')));
 console.log('filter shown on this page:',await p.evaluate(()=>!!document.getElementById('ad-role')));
 await p.evaluate(()=>{const h=document.querySelector('header');if(h)h.style.position='static'});
 await p.locator('#mc-dmr').screenshot({path:L.DIR+'/dq-admin-live.png'});console.log('errors',p.errs);await b.close()})();
