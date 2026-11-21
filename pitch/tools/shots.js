const {chromium}=require('playwright');const OUT=__dirname+'/img/';const mode=process.argv[2]||'list';
(async()=>{const b=await chromium.launch({args:['--lang=en-GB'],env:Object.assign({},process.env,{LANG:'en_GB.UTF-8',LC_ALL:'en_GB.UTF-8',LANGUAGE:'en_GB'})});
 async function page(w){const ctx=await b.newContext({viewport:{width:w||1180,height:900},deviceScaleFactor:2,locale:'en-GB',timezoneId:'Europe/London'});
  await ctx.route('**/*',r=>{const u=r.request().url();return /preview\.motoringcentral\.co\.uk|supabase\.co|fonts\.(googleapis|gstatic)\.com/.test(u)?r.continue():r.abort()});
  const p=await ctx.newPage();await p.clock.setFixedTime(new Date('2026-11-23T10:40:00'));
  await p.addInitScript(()=>{try{localStorage.setItem('mc-cookie','{"a":1}')}catch(e){}});
  p.go=async h=>{await p.goto('https://preview.motoringcentral.co.uk/#'+h,{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);const ck=await p.$('.ckbar button');if(ck&&await ck.isVisible())await ck.click().catch(()=>{});
   await p.addStyleTag({content:'#hub-btn,.ckbar,.banner,#mctoast,.launch,[class*=totop],#totop,header{display:none!important}'}).catch(()=>{})};
  p.login=async(em,pw)=>{await p.go('login');await p.fill('#lg-mail',em);await p.fill('#lg-pass',pw||'demo1234');await p.click('#lg-form button[type=submit]');await p.waitForTimeout(2500);await p.evaluate(()=>{location.hash='dashboard'});await p.waitForTimeout(2500)};
  p.heads=async sel=>p.evaluate(sel=>[...document.querySelectorAll(sel+' .card')].filter(c=>c.offsetWidth).map(c=>{const h=c.querySelector('h2,h3,b');return (h?h.textContent.trim().slice(0,40):'?')+' ['+c.offsetWidth+'x'+c.offsetHeight+']'}).join(' | '),sel);
  p.region=async(sel,file,h,dy)=>{const c=p.locator(sel).first();if(!(await c.count())){console.log('no',sel);return}await c.scrollIntoViewIfNeeded();await p.waitForTimeout(400);await p.evaluate(()=>scrollBy(0,-20));await p.waitForTimeout(300);const bb=await c.boundingBox();const full=await p.screenshot({path:OUT+file,fullPage:true,clip:{x:bb.x,y:bb.y+(await p.evaluate(()=>scrollY))+(dy||0),width:bb.width,height:h}});console.log('saved',file)};
  p.card=async(sel,txt,file,maxH)=>{const c=p.locator(sel+' .card:visible',{has:p.locator('h2,h3,b',{hasText:txt})}).first();if(!(await c.count())){console.log('no card',txt);return}await c.scrollIntoViewIfNeeded();await p.waitForTimeout(300);
   const bb=await c.boundingBox();await p.screenshot({path:OUT+file,clip:{x:bb.x,y:bb.y,width:bb.width,height:Math.min(bb.height,maxH||9999)}});console.log('saved',file,Math.round(bb.width)+'x'+Math.round(Math.min(bb.height,maxH||9999)))};
  return p}
 let p=await page();await p.login('dealer@demo.com');await p.go('jobs');await p.waitForTimeout(1000);await p.region('#v-jobs','jobs.png',900);await p.context().close();
 for(const [em,pw,file] of [['recovery@demo.com','demo1234','recovery.png'],['vimen+ev@motoringcentral.co.uk',process.env.MC_TEST_PW,'ev.png']]){p=await page();await p.login(em,pw);await p.waitForTimeout(2500);console.log(file,await p.heads('#dash-body'));
  await p.region('#dash-body .card:has(h2:text("call-outs"))',file,860)}
 await p.context().close();await b.close()})();
