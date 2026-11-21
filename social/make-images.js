const {chromium}=require('playwright');
const LOGO='<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="30" fill="#0B1C35"/><path d="M30.3 89.7 A42 42 0 1 1 89.7 89.7" fill="none" stroke="#38BDF8" stroke-width="7" stroke-linecap="round"/><polyline points="38,82 38,46 60,68 82,46 82,82" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="68" r="8" fill="#FFD43B"/></svg>';
const MARK='<svg viewBox="0 0 120 120" width="100%" height="100%"><path d="M30.3 89.7 A42 42 0 1 1 89.7 89.7" fill="none" stroke="#38BDF8" stroke-width="7" stroke-linecap="round"/><polyline points="38,82 38,46 60,68 82,46 82,82" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="68" r="8" fill="#FFD43B"/></svg>';
const base=`*{box-sizing:border-box;margin:0}body{font-family:Inter,Arial,sans-serif;background:#0B1C35;color:#fff;overflow:hidden}`;
const word=(s)=>`<div style="display:flex;flex-direction:column;line-height:1;gap:${s*0.16}px"><span style="font-size:${s*0.42}px;font-weight:700;letter-spacing:.5em;color:#B9C7DA">THE</span><span style="font-size:${s}px;font-weight:800;letter-spacing:-.02em">MOTORING</span><span style="align-self:flex-start;font-size:${s*0.46}px;font-weight:800;letter-spacing:.38em;padding:${s*0.16}px ${s*0.16}px ${s*0.16}px ${s*0.38}px;border-radius:${s*0.14}px;background:#38BDF8;color:#0B1C35">CENTRAL</span></div>`;
const glow=`background:radial-gradient(circle at 85% 20%,rgba(56,189,248,.35),transparent 45%),radial-gradient(circle at 5% 100%,rgba(255,212,59,.12),transparent 40%),#0B1C35`;
function banner(w,h,safeW,safeH,scale,wide){const s=scale;return `<style>${base}#safe{width:${safeW}px;height:${safeH}px;display:flex;flex-direction:${wide?'row':'column'};align-items:center;justify-content:center;gap:${wide?s*0.9:s*0.32}px;text-align:center}</style><div style="width:${w}px;height:${h}px;${glow};display:flex;align-items:center;justify-content:center">
 <div id="safe"><div style="display:flex;align-items:center;gap:${s*0.35}px;flex:none"><div style="width:${s*1.7}px;height:${s*1.7}px;flex:none">${LOGO}</div>${word(s*0.56)}</div>
  <div style="flex:none;${wide?'text-align:left;border-left:3px solid rgba(255,255,255,.18);padding-left:'+s*0.9+'px':''}"><div style="font-size:${s*0.48}px;font-weight:800;letter-spacing:-.015em;line-height:1.12;white-space:nowrap">Everything your car needs, <span style="color:#FFD43B">in one place.</span></div>
   <div style="margin-top:${s*0.2}px;font-size:${s*0.21}px;font-weight:700;letter-spacing:.07em;color:#B9C7DA;white-space:nowrap">MOTs · REPAIRS · TYRES · RECOVERY · EV CHARGING · CARS FOR SALE</div></div></div></div>`}
const items=[
 ['profile-picture-1080.png',1080,1080,`<style>${base}</style><div style="width:1080px;height:1080px;background:#0B1C35;display:grid;place-items:center"><div style="width:640px;height:640px">${MARK}</div></div>`],
 ['facebook-cover-1640x624.png',1640,624,(k)=>banner(1640,624,1180,400,k,false),150],
 ['x-twitter-header-1500x500.png',1500,500,(k)=>banner(1500,500,1150,330,k,false),130],
 ['linkedin-cover-1128x191.png',1128,191,(k)=>banner(1128,191,1040,150,k,true),70],
 ['youtube-banner-2560x1440.png',2560,1440,(k)=>banner(2560,1440,1500,400,k,true),160],
];
(async()=>{const b=await chromium.launch();for(const it of items){const [f,w,h,html0,k0]=it;const p=await b.newPage({viewport:{width:w,height:h}});
 let k=k0||0,fits=false;for(let i=0;i<40;i++){await p.setContent(typeof html0==='function'?html0(k):html0);await p.waitForTimeout(60);
  fits=await p.evaluate(()=>{const s=document.getElementById('safe');if(!s)return true;const r=s.getBoundingClientRect();return [...s.querySelectorAll('*')].every(e=>{const q=e.getBoundingClientRect();return q.left>=r.left-1&&q.right<=r.right+1&&q.top>=r.top-1&&q.bottom<=r.bottom+1})});
  if(fits||typeof html0!=='function')break;k=k*0.95}
 await p.screenshot({path:f});console.log(f,w+'x'+h,fits?'fits':'DOES NOT FIT',k?'scale '+Math.round(k):'');await p.close()}await b.close()})();
