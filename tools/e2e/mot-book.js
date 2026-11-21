const L=require('./lib');const steps=+process.argv[2]||1;(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-customer.json'});
 await p.go('drivers');await p.waitForTimeout(2500);if(!(await p.evaluate(()=>window.GGuser)))await L.custLogin(p);
 const vis=async()=>p.evaluate(()=>[...document.querySelectorAll('#v-cust button, #v-cust input, #v-cust select')].filter(e=>e.offsetWidth&&!e.closest('#rec,#evc')).map(e=>e.tagName[0]+':'+(e.id||[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value.slice(0,24)).join(','))+':'+(e.tagName==='INPUT'?(e.placeholder||e.value):e.textContent.trim().slice(0,34))).slice(0,70).join(' | '));
 await p.locator('button:visible',{hasText:/^MOT$/}).first().click();await p.waitForTimeout(1500);
 if(steps===1){console.log(await vis());await p.shot('mot-4-a');await b.close();return}
 eval(require('fs').readFileSync(L.DIR+'/mot-steps.js','utf8'));
 await mot(p,vis,steps);console.log('errors',p.errs);await p.context().storageState({path:L.DIR+'/state-customer.json',indexedDB:true});await b.close()})();
