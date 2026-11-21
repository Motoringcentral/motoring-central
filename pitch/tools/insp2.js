const {chromium}=require('playwright');const [em,btn,name,mode]=process.argv.slice(2);
(async()=>{const b=await chromium.launch({args:['--lang=en-GB'],env:Object.assign({},process.env,{LANG:'en_GB.UTF-8',LC_ALL:'en_GB.UTF-8',LANGUAGE:'en_GB'})});const ctx=await b.newContext({viewport:{width:430,height:900},deviceScaleFactor:3,hasTouch:true,locale:'en-GB',timezoneId:'Europe/London'});
 await ctx.route('**/*',r=>{const u=r.request().url();return /preview\.motoringcentral\.co\.uk|supabase\.co/.test(u)?r.continue():r.abort()});
 const p=await ctx.newPage();await p.clock.setFixedTime(new Date('2026-11-23T09:05:00'));await p.goto('https://preview.motoringcentral.co.uk/#login');await p.waitForTimeout(2500);
 await p.fill('#lg-mail',em);await p.fill('#lg-pass','demo1234');await p.click('#lg-form button[type=submit]');await p.waitForTimeout(2500);await p.evaluate(()=>{location.hash='dashboard'});await p.waitForTimeout(2500);
 const [np]=await Promise.all([ctx.waitForEvent('page',{timeout:8000}).catch(()=>null),p.locator('#dash-body button:visible, #dash-body a:visible',{hasText:btn}).first().click()]);
 const t=np||p;await t.waitForTimeout(3000);
 const secs=await t.evaluate(()=>[...document.querySelectorAll('section,.card,fieldset')].filter(e=>e.offsetWidth&&e.querySelector('h2,h3,legend')).map((e,i)=>i+':'+e.tagName+'.'+e.className+'#'+e.id+' "'+(e.querySelector('h2,h3,legend').textContent.trim().slice(0,30))+'" '+e.offsetHeight).join('\n'));
 if(mode==='list'){console.log(secs);console.log('SVG:',await t.evaluate(()=>[...document.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().height>200).map(s=>s.id+'/'+s.getAttribute('class')+' '+Math.round(s.getBoundingClientRect().width)+'x'+Math.round(s.getBoundingClientRect().height)).join(' | ')));
  console.log('inputs:',await t.evaluate(()=>[...document.querySelectorAll('input,textarea,select')].filter(e=>e.offsetWidth).map(e=>e.id||e.name||e.type).slice(0,60).join(',')));
  console.log('fixed:',await t.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed'||getComputedStyle(e).position==='sticky').map(e=>e.tagName+'.'+e.className+'#'+e.id).join(' | ')))}
 global.T=t;require('./insp-'+name+'.js')(t,mode).then(()=>b.close())})();
