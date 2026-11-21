// node chat.js <customer|recovery|mot|ev> "<message to send or empty>"
const L=require('./lib');const who=process.argv[2],msg=process.argv[3]||'';
const EM={recovery:'vimen+recovery@motoringcentral.co.uk',mot:'vimen+mot@motoringcentral.co.uk',ev:'vimen+ev@motoringcentral.co.uk'};
(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-'+who+'.json'});
 await p.go('drivers');await p.waitForTimeout(3000);if(!(await p.evaluate(()=>window.GGuser))){if(who==='customer')await L.custLogin(p);else await L.partnerLogin(p,EM[who])}
 if(who==='customer'){await p.evaluate(()=>{location.hash='account'});await p.waitForTimeout(4000);const t=await p.txt('#acc-body');console.log('ACCOUNT:',(t.match(/Recovery and EV charging.{0,420}/)||t.match(/MOT.{0,300}/)||[t.slice(0,300)])[0])}
 await p.evaluate(()=>{location.hash='drivers'});await p.waitForTimeout(6000);
 console.log('messages button:',await p.evaluate(()=>document.getElementById('hub-btn').getAttribute('aria-label')),'| header:',await p.txt('#mc-msglink'));
 await p.click('#hub-btn');await p.waitForTimeout(800);console.log('HUB:',(await p.txt('#hub')).slice(0,600));
 const row=p.locator('#hub [data-pmopen^="b:"]').first();if(await row.count()){await row.click();await p.waitForTimeout(800);console.log('THREAD:',(await p.txt('#mc-pm-b')).slice(0,600));
  if(msg){await p.fill('#pm-ta',msg);await p.click('[data-pmsend]');await p.waitForTimeout(3500);console.log('AFTER SEND:',(await p.txt('#mc-pm-b')).slice(-260),'| err:',await p.txt('#pm-err'))}
  await p.shot('chat-'+who)}else console.log('no booking conversation row');
 console.log('errors',p.errs);await p.context().storageState({path:L.DIR+'/state-'+who+'.json',indexedDB:true});await b.close()})();
