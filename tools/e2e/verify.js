const L=require('./lib');(async()=>{let {b,p}=await L.open();await p.go('mot-station');await p.waitForTimeout(1500);
 await p.fill('#name','X Y');await p.fill('#tel','020 8191 4290');await p.fill('#mail','nobody@example.com');await p.fill('#m-pass','password123');await p.click('#form [data-pf="1"]');await p.waitForTimeout(900);
 console.log('MOT link step 2: MOT ticked=',await p.isChecked('#gmot'),'| station number box visible=',await p.vis('#gvts'),'| workshop bays hidden=',!(await p.vis('#gbays')));await b.close();
 ({b,p}=await L.open({storageState:L.DIR+'/state-customer.json'}));await p.go('drivers');await p.waitForTimeout(2500);if(!(await p.evaluate(()=>window.GGuser)))await L.custLogin(p);
 await p.locator('button:visible',{hasText:/^MOT$/}).first().click();await p.waitForTimeout(1200);await p.click('[data-qi="0"]');await p.waitForTimeout(2000);await p.click('[data-sid="mot-4-car"]');await p.waitForTimeout(2000);await p.fill('#unl-vrm','AB12CDE');await p.click('#unl-go');await p.waitForTimeout(6000);
 console.log('rating shown for real station:',await p.evaluate(()=>{const e=document.querySelector('[data-prof="TEST MOT Station Dartford"]');return e?e.textContent.trim():'not listed'}));
 await p.evaluate(()=>{location.hash='account'});await p.waitForTimeout(3000);await p.click('#hub-btn');await p.waitForTimeout(800);console.log('HUB rows:',(await p.txt('#hub')).slice(0,520));
 console.log('errors',p.errs);await b.close()})();
