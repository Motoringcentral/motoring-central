const L=require('./lib'),fs=require('fs');(async()=>{const {b,p}=await L.open();await p.goto(fs.readFileSync(L.DIR+'/dq-link.txt','utf8').trim(),{waitUntil:'domcontentloaded'});await p.waitForTimeout(6000);
 console.log('stopped link:',await p.txt('#dq-msg'),'| demo on:',await p.evaluate(()=>window.MCdemo.on()),'| trade chosen:',await p.inputValue('#dq-trade'),'| at',await p.evaluate(()=>location.hash));
 await p.shot('dq-ended');console.log('errors',p.errs);await b.close()})();
