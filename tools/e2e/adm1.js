// staff log-in for tests. The two-step secret comes from MC_STAFF_TOTP (or a local staff-secret.txt that is never committed)
const L=require('./lib'),T=require('./totp'),fs=require('fs');
exports.login=async()=>{const {b,p}=await L.open();await p.go('staff');await p.waitForTimeout(1500);await p.fill('#st-mail','vimen+staff@motoringcentral.co.uk');await p.fill('#st-pass',L.PW);await p.click('#st-go');await p.waitForTimeout(6000);
 if(await p.vis('#mc-mfa')){await p.fill('#mfa-code',T(process.env.MC_STAFF_TOTP||fs.readFileSync(L.DIR+'/staff-secret.txt','utf8').trim()));await p.click('#mfa-go');await p.waitForTimeout(7000)}return {b,p}};
if(require.main===module)(async()=>{const {b,p}=await exports.login();console.log('user',await p.evaluate(()=>window.GGuser&&GGuser.role+'/'+GGuser.level+' '+location.hash));await p.waitForTimeout(6000);
 const tabs=await p.evaluate(()=>[...document.querySelectorAll('#admin-body [data-tab]')].map(e=>e.dataset.tab));
 for(const t of tabs){await p.click('#admin-body [data-tab="'+t+'"]');await p.waitForTimeout(3500);
  console.log(t,'=>',await p.evaluate(()=>[...document.querySelectorAll('#admin-body > *, #admin-body > div > .card')].filter(e=>e.offsetHeight>0).map(e=>(e.id?'#'+e.id+' ':'')+((e.querySelector('h2')||{}).textContent||e.textContent||'').trim().slice(0,45)+' ['+e.offsetHeight+'px]').join(' || ')))}
 await p.click('#admin-body [data-tab="pending"]');await p.waitForTimeout(3000);await p.screenshot({path:L.DIR+'/adm-before.png',fullPage:true});console.log('errors',p.errs);await b.close()})();
