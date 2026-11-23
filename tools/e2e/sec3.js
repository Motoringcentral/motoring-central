const L=require('./lib'),fs=require('fs');const SITE=process.env.SITE||'https://preview.motoringcentral.co.uk/';
(async()=>{const {b,p}=await L.open();await p.goto(fs.readFileSync(L.DIR+'/dq-own.txt','utf8').trim().replace('https://preview.motoringcentral.co.uk/',SITE),{waitUntil:'domcontentloaded'});await p.waitForTimeout(6000);
 await p.click('#dq-all [data-demo="valet"]');await p.waitForTimeout(6000);
 for(const w of [1900,4000]){await p.evaluate(()=>{const s=document.querySelector('[data-dg="step:2"]');if(s)s.click()});await p.waitForTimeout(300);await p.evaluate(()=>{const s=document.querySelector('[data-dg="show:2"]');if(s)s.click()});await p.waitForTimeout(w);
  console.log('wait',w,'-> highlighted:',await p.evaluate(()=>{const e=document.querySelector('.mc-demo-hl');return e?(e.id||e.className).slice(0,60):'nothing'}),'| target exists:',await p.evaluate(()=>{const s=window.MCdemo.state().steps[2];const q=String(s.sel).split('|')[0].replace(/^text:/,'');return s.sel+' -> '+document.querySelectorAll(q).length}))}
 await b.close()})();
