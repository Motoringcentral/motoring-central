const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await p.goto('file://'+__dirname+'/slides.html');await p.waitForTimeout(1500);const out={};
 for(let i=0;i<14;i++){const n=await p.evaluate(i=>builds(i),i);out[i]=n;for(let j=0;j<=n;j++){await p.evaluate(([i,j])=>show(i,j),[i,j]);await p.waitForTimeout(120);await p.screenshot({path:__dirname+`/f_${i}_${j}.png`})}}
 // banner without the lower third, for the opening
 await p.evaluate(()=>{show(0,0)});await p.screenshot({path:__dirname+'/f_0_0.png'});
 // overflow check
 const ov=await p.evaluate(()=>{const r=[];for(let i=0;i<14;i++){show(i,99);const s=document.getElementById('s'+i);s.querySelectorAll('.L,.R,.shot,.cards,.steps,.ex,h1').forEach(e=>{const q=e.getBoundingClientRect();if(q.bottom>716||q.right>1276||q.top<4)r.push(i+':'+e.className+' '+Math.round(q.top)+'-'+Math.round(q.bottom)+' r'+Math.round(q.right))})}return r});
 console.log(JSON.stringify(out),'overflow:',ov.join(' | ')||'none');await b.close()})();
