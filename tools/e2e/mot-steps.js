async function mot(p,vis,steps){
 const flow=async()=>p.evaluate(()=>{const f=document.getElementById('flowchg');const box=f?f.closest('section,.card,div[id]'):document.getElementById('v-cust');return [...document.querySelectorAll('#v-cust button, #v-cust input, #v-cust select')].filter(e=>e.offsetWidth&&!e.closest('#rec,#evc')&&!/^data-(qc|qi|svc|d|sid)$/.test(([...e.attributes].find(a=>a.name.startsWith('data-'))||{}).name||'')).map(e=>e.tagName[0]+':'+(e.id||[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value.slice(0,30)).join(','))+':'+(e.tagName==='INPUT'?(e.placeholder||e.value):e.tagName==='SELECT'?[...e.options].slice(0,4).map(o=>o.text).join('/'):e.textContent.trim().slice(0,40))).join(' | ')});
 await p.click('[data-qi="0"]');await p.waitForTimeout(2500);
 await p.click('[data-sid="mot-4-car"]');await p.waitForTimeout(2500);
 await p.fill('#unl-vrm','AB12CDE');await p.click('#unl-go');await p.waitForTimeout(6000);
 await p.fill('#mpost','DA1 2EN');await p.click('#mfind');await p.waitForTimeout(6000);
 const names=await p.evaluate(()=>[...document.querySelectorAll('#v-cust [data-dec]')].filter(e=>e.offsetWidth).map(e=>e.textContent.trim().slice(0,90)));console.log('GARAGES:',names.join(' || '));
 const t=p.locator('#v-cust [data-dec]:visible',{hasText:'TEST MOT'}).first();
 if(!(await t.count())){console.log('TEST MOT station is NOT in the list');await p.shot('mot-4-e');return}
 await t.click();await p.waitForTimeout(5000);
 await p.selectOption('#mday',{index:2});await p.waitForTimeout(1500);await p.selectOption('#mtime',{index:2});await p.waitForTimeout(500);
 console.log('chosen:',await p.evaluate(()=>mday.options[mday.selectedIndex].text+' at '+mtime.options[mtime.selectedIndex].text));
 await p.check('#tc-mgo');await p.click('#mgo');await p.waitForTimeout(2500);
 if(await p.vis('#paydlg')){console.log('PAY:',(await p.txt('#paydlg')).slice(0,260));await p.fill('#py-card','4242 4242 4242 4242');await p.fill('#py-exp','12/30');await p.fill('#py-cvc','123');await p.click('#py-go');await p.waitForTimeout(6000);await p.locator('#paydlg button:visible',{hasText:'Continue'}).click();await p.waitForTimeout(8000)}
 console.log('DONE:',await p.vis('#mdone'),'|',(await p.txt('#mdone')).slice(0,500));await p.shot('mot-5-done');
}