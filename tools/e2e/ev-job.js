const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-ev.json'});
 await p.go('drivers');await p.waitForTimeout(3000);if(!(await p.evaluate(()=>window.GGuser&&GGuser.role==='evcharge')))await L.partnerLogin(p,'vimen+ev@motoringcentral.co.uk');await p.evaluate(()=>{location.hash='dashboard'});await p.waitForTimeout(4000);
 const card=async()=>((await p.txt('#dash-body')).match(/Jobs to do.{0,700}/)||[''])[0];
 console.log('JOB CARD:',await card());
 console.log('job buttons:',await p.evaluate(()=>[...document.querySelectorAll('#dash-body button')].filter(e=>e.offsetWidth&&[...e.attributes].some(a=>/^data-rs(st|job|dec|go|step)/.test(a.name))).map(e=>[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join(',')+':'+e.textContent.trim()).join(' | ')));
 for(const label of (process.argv[2]||'').split(',').filter(Boolean)){const bt=p.locator('#dash-body button:visible',{hasText:label}).first();if(!(await bt.count())){console.log('no button',label);break}
  await bt.click();await p.waitForTimeout(4500);console.log('after "'+label+'": toast=',await p.txt('#mctoast'),'|',(await card()).slice(0,260))}
 await p.shot('ev-4-job');console.log('errors',p.errs);await p.context().storageState({path:L.DIR+'/state-ev.json',indexedDB:true});await b.close()})();
