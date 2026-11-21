exports.sign=async(t,sel,seed)=>{const cs=t.locator(sel);const n=await cs.count();for(let i=0;i<n;i++){const c=cs.nth(i);await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();if(!b)continue;
  const x0=b.x+b.width*0.14,y0=b.y+b.height*0.56,W=b.width*0.5,A=b.height*0.17,f=0.33+i*0.07+seed*0.02,N=150;
  const pt=k=>[x0+k/N*W+A*0.55*Math.sin(k*f),y0-A*Math.cos(k*f)*(1-0.45*k/N)-(k<12?A*0.5*(1-k/12):0)];
  let [x,y]=pt(0);await t.mouse.move(x,y);await t.mouse.down();for(let k=1;k<=N;k++){[x,y]=pt(k);await t.mouse.move(x,y)}
  await t.mouse.move(x+W*0.35,y+A*0.5,{steps:8});await t.mouse.up();
  await t.mouse.move(x0+W*0.2,y0+A*1.25);await t.mouse.down();await t.mouse.move(x0+W*1.25,y0+A*1.05,{steps:10});await t.mouse.up();await t.waitForTimeout(150)}};
exports.pin=async(t,sec,fx,fy,type,size)=>{const car=t.locator('svg#car');await car.scrollIntoViewIfNeeded();const bb=await car.boundingBox();await t.mouse.click(bb.x+bb.width*fx,bb.y+bb.height*fy);await t.waitForTimeout(400);
  await sec.locator('button',{hasText:new RegExp('^'+type+'$')}).last().click().catch(e=>console.log('type',type,'fail'));await t.waitForTimeout(200);
  const s=sec.locator('select').last();if(await s.count())await s.selectOption({index:size}).catch(()=>{})};
exports.shoot=async(t,loc,file,maxH)=>{await t.addStyleTag({content:'.actions,#toast{display:none!important}'});await loc.scrollIntoViewIfNeeded();await t.waitForTimeout(300);const y=await t.evaluate(()=>scrollY);const b=await loc.boundingBox();
  await t.screenshot({path:__dirname+'/img/'+file,fullPage:true,clip:{x:0,y:Math.max(0,b.y+y-8),width:430,height:Math.min(b.height+16,maxH||9999)}});console.log('saved',file,Math.round(Math.min(b.height+16,maxH||9999)))};
