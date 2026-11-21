const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-mot.json'});
 await p.go('drivers');await p.waitForTimeout(3000);if(!(await p.evaluate(()=>window.GGuser)))await L.partnerLogin(p,'vimen+mot@motoringcentral.co.uk');await p.evaluate(()=>{location.hash='dashboard'});await p.waitForTimeout(4500);
 for(const label of (process.argv[2]||'').split(',').filter(Boolean)){const bt=p.locator('#dash-body button:visible, #dash-body a:visible',{hasText:label}).first();if(!(await bt.count())){console.log('no button',label);break}await bt.click();await p.waitForTimeout(3500);console.log('after "'+label+'": toast=',await p.txt('#mctoast'))}
 console.log('DASH:',(await p.txt('#dash-body')).slice(0,+process.argv[3]||900));
 if(process.argv[4])console.log(await L.dump(p,'#dash-body'));
 await p.shot('mot-3-dash');console.log('errors',p.errs);await p.context().storageState({path:L.DIR+'/state-mot.json',indexedDB:true});await b.close()})();
