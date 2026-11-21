const L=require('./lib');const who=process.argv[2],em='vimen+'+who+'@motoringcentral.co.uk';(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-'+who+'.json'});
 console.log('login:',JSON.stringify(await L.partnerLogin(p,em)),'| err:',await p.txt('#lg-err'));await p.waitForTimeout(10000);
 console.log('docs:',JSON.stringify(await p.evaluate(()=>(GGuser.docs||[]).map(d=>d.name+':'+(d.path?'stored':'not stored')))));
 await p.context().storageState({path:L.DIR+'/state-'+who+'.json',indexedDB:true});console.log('errors',p.errs);await b.close()})();
