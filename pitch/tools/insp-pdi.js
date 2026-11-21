const C=require('./insp-common.js');
module.exports=async(t,mode)=>{const S=i=>t.locator('section.card').nth(i);
 await t.fill('#staff','Sam Hughes');await t.fill('#mileage','61200');await t.fill('#bname','Jordan Ellis');await t.fill('#bphone','07700 900456');
 await S(1).locator('button',{hasText:/^Buyer collecting$/}).click().catch(()=>{});await S(1).locator('button',{hasText:/^3 months$/}).click().catch(()=>{});
 await S(4).locator('button',{hasText:'Mark everything not yet answered as OK'}).click();await t.waitForTimeout(400);
 for(const [k,v] of [['Spare key','Advise'],['Service history handed over','Fixed']]){const r=S(4).locator('div,li,tr').filter({hasText:new RegExp('^\\s*'+k)}).filter({has:t.locator('button')}).last();await r.locator('button',{hasText:new RegExp('^'+v+'$')}).first().click().catch(()=>console.log('fail',k))}
 const nums=S(5).locator('input[type=number]');const vals=['6.5','32','6.0','32','5.5','30','5.5','30','7.0','60'];for(let i=0;i<Math.min(await nums.count(),vals.length);i++)await nums.nth(i).fill(vals[i]).catch(()=>{});
 await C.pin(t,S(6),0.70,0.30,'Chip',1);
 await t.fill('#advice','Spare key not supplied: buyer told and price agreed on that basis.').catch(()=>{});

 console.log('progress:',((await t.evaluate(()=>(document.querySelector('.actions')||{}).innerText))||'').split('\n')[0]);
 await t.evaluate(()=>scrollTo(0,0));await t.addStyleTag({content:'.actions,#toast{display:none!important}'});await t.screenshot({path:__dirname+'/img/pdi-1.png',fullPage:true,clip:{x:0,y:0,width:430,height:930}});
 await C.shoot(t,S(4),'pdi-2.png',930);await C.shoot(t,S(5),'pdi-3.png');await C.shoot(t,S(6),'pdi-5.png');await C.shoot(t,S(9),'pdi-4.png');
};
