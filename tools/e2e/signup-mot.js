const L=require('./lib');(async()=>{const {b,p}=await L.open();const em='vimen+mot@motoringcentral.co.uk';await p.go('mot-station');await p.waitForTimeout(1500);
 await p.fill('#name','Test Tester');await p.fill('#tel','020 8191 4290');await p.fill('#mail',em);await p.fill('#m-pass',L.PW);
 await p.click('#form [data-pf="1"]');await p.waitForTimeout(800);
 console.log('step2 first look: gmot checked=',await p.isChecked('#gmot'),'| gvts visible=',await p.vis('#gvts'),'| workshop bays visible=',await p.vis('#gbays'));
 await p.fill('#post','DA1 1LN');await p.fill('#gname','TEST MOT Station Dartford');await p.fill('#gaddr','1 Test Street, Dartford');if(!(await p.isChecked('#gmot')))await p.check('#gmot');await p.waitForTimeout(500);
 await p.fill('#gvts','11423');await p.locator('#gvts').blur();await p.waitForTimeout(4000);
 console.log('VTS check text:',await p.evaluate(()=>{const e=document.getElementById('gvts');const n=e.closest('div')||e.parentNode;return [...(n.parentNode.querySelectorAll('.note,.err,[role=status]'))].filter(x=>x.offsetWidth).map(x=>x.textContent.trim().slice(0,160)).join(' || ')}));
 if(!(await p.isChecked('#gm-c-4-car')))await p.check('#gm-c-4-car');
 await p.click('#form [data-pf="2"]');await p.waitForTimeout(800);console.log('err2:',await p.txt('#merr'));
 if(process.argv[2]==='dump'){console.log(await L.dump(p,'#form'));await b.close();return}
 await p.setInputFiles('#m-doc1',L.DIR+'/test-trade-insurance.png');await p.fill('#m-exp1',L.future(200));
 await p.setInputFiles('#m-doc2',L.DIR+'/test-public-liability.png');await p.fill('#m-exp2',L.future(220));
 await p.selectOption('#m-idtype','Passport');await p.setInputFiles('#m-doc3',L.DIR+'/test-photo-id.png');await p.fill('#m-exp3',L.future(900));
 const c2=p.locator('#form input[type=checkbox]:visible');for(let i=0;i<await c2.count();i++)await c2.nth(i).check().catch(()=>{});
 const nx=p.locator('#form button:visible',{hasText:/^Next/}).first();if(await nx.count()){await nx.click();await p.waitForTimeout(800);console.log('err3:',await p.txt('#merr'));
  const c3=p.locator('#form input[type=checkbox]:visible');for(let i=0;i<await c3.count();i++)await c3.nth(i).check().catch(()=>{})}
 await p.shot('mot-2-last-step');console.log('LAST STEP:',(await p.evaluate(()=>[...document.querySelectorAll('#form fieldset, #form .step')].filter(e=>e.offsetWidth).map(e=>e.innerText.replace(/\n+/g,' | ').slice(0,500)).join(' ## '))).slice(0,900));
 await p.locator('#form button[type=submit]:visible').click();await p.waitForTimeout(9000);
 console.log('form err:',await p.txt('#merr'));console.log('OK:',await p.vis('#ok'),'|',(await p.txt('#ok')).slice(0,260));
 await p.context().storageState({path:L.DIR+'/state-mot.json',indexedDB:true});console.log('errors',p.errs);await b.close()})();
