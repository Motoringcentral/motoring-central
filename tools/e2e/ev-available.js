const L=require('./lib');(async()=>{const {b,p}=await L.open({storageState:L.DIR+'/state-ev.json'});
 await L.partnerLogin(p,'vimen+ev@motoringcentral.co.uk');await p.go('dashboard');await p.waitForTimeout(3000);
 await p.click('[data-rspsave]');await p.waitForTimeout(3500);console.log('toast after save:',await p.txt('#mctoast'));
 await p.click('[data-rspon="4"]');await p.waitForTimeout(3500);console.log('toast after available:',await p.txt('#mctoast'));
 console.log('CARD:',(await p.txt('#dash-body')).slice(0,420));await p.shot('rec-5-available');console.log('errors',p.errs);await b.close()})();
