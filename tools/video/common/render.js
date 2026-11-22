// node render.js DIR : draws DIR/slides.html and saves one picture per "build" step of each slide (f_<slide>_<build>.png)
const {chromium}=require('playwright');const D=require('path').resolve(process.argv[2]);(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await p.goto('file://'+D+'/slides.html');await p.waitForTimeout(1800);const n=await p.evaluate(()=>document.querySelectorAll('.s').length);const out={};
 for(let i=0;i<n;i++){const m=await p.evaluate(i=>builds(i),i);out[i]=m;for(let j=0;j<=m;j++){await p.evaluate(([i,j])=>show(i,j),[i,j]);await p.waitForTimeout(120);await p.screenshot({path:D+`/f_${i}_${j}.png`})}}
 const ov=await p.evaluate(n=>{const r=[];for(let i=0;i<n;i++){show(i,99);const s=document.getElementById('s'+i);s.querySelectorAll('.L,.R,.shot,.cards,.steps,.ex,.plans,h1').forEach(e=>{if(e.closest('.front,.pf'))return;const q=e.getBoundingClientRect();if(q.bottom>716||q.right>1276||q.top<4)r.push(i+':'+e.className+' '+Math.round(q.top)+'-'+Math.round(q.bottom)+' r'+Math.round(q.right))})}return r},n);
 const broken=await p.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')));
 console.log('slides',n,JSON.stringify(out),'| overflow:',ov.join(' | ')||'none','| missing pictures:',broken.join(',')||'none');await b.close()})();
