const L=require('./lib');(async()=>{const {b,p}=await L.open();await p.go('drivers');await p.click('#cust-in');await p.waitForTimeout(600);await p.click('#cu-tab-new');await p.waitForTimeout(500);
 if(process.argv[2]==='dump'){console.log(await L.dump(p,'#cust-dlg'));await b.close();return}
 await p.fill('#cu-name','Test Customer');await p.fill('#cu-mail','vimen+customer@motoringcentral.co.uk');await p.fill('#cu-tel','07700 900123');await p.fill('#cu-post','DA1 2EN');await p.fill('#cu-pass',L.PW);
 for(const id of ['cu-tc','cu-terms','cu-agree'])if(await p.$('#'+id))await p.check('#'+id).catch(()=>{});
 await p.locator('#cust-dlg button[type=submit]:visible').click();await p.waitForTimeout(7000);
 console.log('dialog text:',(await p.txt('#cust-dlg')).slice(0,400));await p.shot('cust-1-signup');console.log('errors',p.errs);await b.close()})();
