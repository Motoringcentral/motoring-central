const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-customer.json'});
 await p.go('drivers');await p.waitForTimeout(2500);if(!(await p.evaluate(()=>window.GGuser)))await L.custLogin(p);
 await p.locator('button:visible,a:visible',{hasText:/^Mobile EV charging/}).first().click();await p.waitForTimeout(2500);
 console.log('ev form visible:',await p.vis('#evc-find'));
 if(!(await p.vis('#evc-find'))){await p.shot('ev-1');console.log((await p.evaluate(()=>[...document.querySelectorAll('#v-cust button')].filter(e=>e.offsetWidth).map(e=>(e.id||'')+':'+e.textContent.trim().slice(0,30)).slice(0,40).join(' | '))));await b.close();return}
 await p.fill('#ev-from','DA9 9ST');await p.fill('#ev-spot','Car park level 2 (TEST booking)');await p.fill('#ev-reg','EV21TST');
 await p.click('#evc-find');await p.waitForTimeout(8000);console.log('err:',await p.txt('#evc-err'),'| sum:',await p.txt('#ev-sum'));console.log('PROVIDERS:',(await p.txt('#evc-prov')).slice(0,500));
 const pick=p.locator('#evc-prov [data-dec]',{hasText:'TEST EV'}).first();if(!(await pick.count())){console.log('test partner not listed');await p.shot('ev-2');await b.close();return}
 await pick.click();await p.waitForTimeout(1200);console.log('BREAKDOWN:',await p.txt('#ev-break'));
 await p.check('#tc-ego');await p.click('#ego');await p.waitForTimeout(2500);await p.fill('#py-card','4242 4242 4242 4242');await p.fill('#py-exp','12/30');await p.fill('#py-cvc','123');
 await p.click('#py-go');await p.waitForTimeout(6000);await p.locator('#paydlg button:visible',{hasText:'Continue'}).click();await p.waitForTimeout(8000);
 console.log('DONE:',await p.vis('#evc-done'),'|',(await p.txt('#evc-done')).slice(0,400),'| err:',await p.txt('#evc-err'));await p.shot('ev-3-done');console.log('errors',p.errs);
 await p.context().storageState({path:L.DIR+'/state-customer.json',indexedDB:true});await b.close()})();
