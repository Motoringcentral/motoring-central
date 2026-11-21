const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-recovery.json'});
 console.log('login:',JSON.stringify(await L.partnerLogin(p,'vimen+recovery@motoringcentral.co.uk')));
 await p.go('dashboard');await p.waitForTimeout(3000);console.log(await L.dump(p,'#dash-body'));await p.shot('rec-4-dash');await b.close()})();
