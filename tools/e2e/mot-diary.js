const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-mot.json'});
 await p.go('drivers');await p.waitForTimeout(3000);if(!(await p.evaluate(()=>window.GGuser)))await L.partnerLogin(p,'vimen+mot@motoringcentral.co.uk');await p.evaluate(()=>{location.hash='dashboard'});await p.waitForTimeout(4500);
 await p.locator('#dash-body button:visible',{hasText:'Booking diary'}).first().click();await p.waitForTimeout(3000);
 await p.click('[data-dmove="7"]');await p.waitForTimeout(2500);await p.click('[data-dday="2026-11-23"]');await p.waitForTimeout(3000);await p.locator('[data-dv="list"]').click();await p.waitForTimeout(2000);
 const t=await p.txt('#dash-body');console.log('DIARY:',(t.match(/Mon ?23.{0,700}/)||[t.slice(0,600)])[0].slice(0,700));await p.shot('mot-6-diary');console.log('errors',p.errs);
 await p.context().storageState({path:L.DIR+'/state-mot.json',indexedDB:true});await b.close()})();
