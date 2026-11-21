const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-customer.json'});
 await p.go('drivers');await p.waitForTimeout(2500);if(!(await p.evaluate(()=>window.GGuser)))await L.custLogin(p);
 await p.locator('button:visible,a:visible',{hasText:/^Broken down$/}).first().click();await p.waitForTimeout(1000);
 await p.locator('button:visible,a:visible',{hasText:/broken down or need a tow/}).first().click();await p.waitForTimeout(2000);
 console.log('rec form visible:',await p.vis('#rfind'));
 if(!(await p.vis('#rfind'))){await p.shot('rec-7');console.log((await p.txt('#v-cust')).slice(0,800));await b.close();return}
 await p.fill('#rs-from','DA1 1DR');await p.fill('#rs-spot','Outside the Civic Centre (TEST booking)');
 await p.selectOption('#rdest','other');await p.fill('#rdrop','DA9 9ST');await p.fill('#rs-reg','AB12CDE');
 await p.click('#rfind');await p.waitForTimeout(8000);
 console.log('err:',await p.txt('#rec-err'),'| sum:',await p.txt('#rs-sum'));
 console.log('PROVIDERS:',(await p.txt('#rprov')).slice(0,900));await p.shot('rec-8-prices');
 await p.click('#rprov [data-dec]');await p.waitForTimeout(1200);console.log('BREAKDOWN:',await p.txt('#rs-break'));
 await p.check('#tc-rgo');await p.click('#rgo');await p.waitForTimeout(2500);
 const dlg=await p.evaluate(()=>{const d=[...document.querySelectorAll('[role=dialog],dialog,.modal,.pay')].filter(e=>e.offsetWidth&&e.id!=='hub')[0];return d?(d.id||d.className):''});console.log('dialog:',dlg);
 if(dlg){console.log('PAY TEXT:',(await p.txt('#'+dlg)).slice(0,500));console.log(await L.dump(p,'#'+dlg));await p.shot('rec-9-pay')}
 if(process.argv[2]==='pay'&&dlg){
  for(const [sel,val] of [['#py-card','4242 4242 4242 4242'],['#py-exp','12/30'],['#py-cvc','123']]){if(await p.vis(sel))await p.fill(sel,val)}
  await p.click('#py-go');await p.waitForTimeout(6000);await p.locator('#paydlg button:visible',{hasText:'Continue'}).click();await p.waitForTimeout(8000);
  console.log('DONE visible:',await p.vis('#rdone'),'|',(await p.txt('#rdone')).slice(0,500),'| err:',await p.txt('#rec-err'));await p.shot('rec-10-done')}
 console.log('errors',p.errs);
 await p.context().storageState({path:L.DIR+'/state-customer.json',indexedDB:true});await b.close()})();
