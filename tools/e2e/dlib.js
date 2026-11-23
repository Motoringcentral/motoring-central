// local test helper for the demos: serves the working copy from http://localhost:8765
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8765/';
exports.DIR=__dirname+'/../demo';
exports.open=async function(opts){const b=await chromium.launch();const ctx=await b.newContext(Object.assign({viewport:{width:1280,height:900},deviceScaleFactor:1},opts||{}));
 const net=[];await ctx.route('**/*',r=>{const u=r.request().url();if(/supabase\.co/.test(u))net.push(r.request().method()+' '+u.replace(/^https:\/\/[^/]+/,'').split('?')[0]);
  return /localhost:8765|preview\.motoringcentral\.co\.uk|supabase\.co|cdnjs\.cloudflare\.com|tile\.openstreetmap\.org|api\.postcodes\.io/.test(u)?r.continue():r.abort()});
 const p=await ctx.newPage();p.errs=[];p.net=net;p.on('pageerror',e=>p.errs.push(String(e.stack||e).slice(0,500)));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text()))p.errs.push('console: '+m.text().slice(0,300))});
 p.go=async h=>{await p.goto(SITE+'#'+h,{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);const ck=await p.$('.ckbar button');if(ck&&await ck.isVisible())await ck.click().catch(()=>{})};
 /* the demo opens only from a personal link: give a staff demo link in MC_DEMO_LINK (admin page > Partners > Demo requests > Show a demo in person) */
 p.demo=async k=>{const link=(process.env.MC_DEMO_LINK||require('fs').readFileSync(__dirname+'/dq-own.txt','utf8')).trim().replace('https://preview.motoringcentral.co.uk/',SITE);await p.goto(link,{waitUntil:'domcontentloaded'});await p.waitForTimeout(6000);const ck=await p.$('.ckbar button');if(ck&&await ck.isVisible())await ck.click().catch(()=>{});await p.click('#dq-all [data-demo="'+k+'"]');await p.waitForTimeout(5500);return p.evaluate(()=>!!window.MCdemo.on())};
 p.tabs=()=>p.evaluate(()=>[...document.querySelectorAll('#mc-ptabs [data-ptab]')].map(e=>[e.getAttribute('data-ptab'),e.textContent.trim()]));
 p.tab=async(t,s)=>{await p.evaluate(([t,s])=>window.MCpt.go(t,s||''),[t,s]);await p.waitForTimeout(1800)};
 p.cards=()=>p.evaluate(()=>{const vis=e=>!!(e.offsetWidth||e.offsetHeight);return [...document.querySelectorAll('#dash-body > *')].filter(vis).map(e=>(e.id?'#'+e.id:'.'+(e.className||'').split(' ')[0])+' '+((e.querySelector('h2,h3')||{}).textContent||'').trim().slice(0,38)+' ['+e.offsetHeight+']')});
 p.shot=n=>p.screenshot({path:exports.DIR+'/'+n+'.png'});
 return {b,ctx,p}};
