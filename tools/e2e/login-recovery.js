const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-recovery.json'});
 console.log('login:',JSON.stringify(await L.partnerLogin(p,'vimen+recovery@motoringcentral.co.uk')),'| err:',await p.txt('#lg-err'));
 await p.waitForTimeout(9000);await p.go('dashboard');await p.waitForTimeout(3000);
 console.log('after wait:',JSON.stringify(await p.evaluate(()=>(GGuser.docs||[]).map(d=>d.name+':'+(d.path||'no path')))));
 console.log('DASH:',(await p.txt('#dash-body')).slice(0,700));await p.shot('rec-3-dash');
 console.log('stash left:',await p.evaluate(async()=>!!(await window.MCdocStash.get('vimen+recovery@motoringcentral.co.uk'))));
 await p.context().storageState({path:L.DIR+'/state-recovery.json',indexedDB:true});console.log('errors',p.errs);await b.close()})();
