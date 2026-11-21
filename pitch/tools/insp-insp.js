const C=require('./insp-common.js');
module.exports=async(t,mode)=>{const S=i=>t.locator('section.card').nth(i);
 await t.fill('#tech','Chris Ward');await t.fill('#mileage','48210');
 await C.pin(t,S(3),0.30,0.20,'Scratch',2);await C.pin(t,S(3),0.72,0.52,'Dent',1);await C.pin(t,S(3),0.36,0.86,'Scuff',2);
 const rows=S(4).locator('.row, .chk, li, tr, .q').filter({has:t.locator('button')});
 const picks={'Windscreen':'Chipped','Front left alloy':'Kerbed','Front right alloy':'OK','Rear left alloy':'OK','Rear right alloy':'OK','Lights':'OK','Mirrors':'OK','Interior':'OK','Dashboard warning':'None','Valuables':'None','Keys received':'1'};
 for(const k in picks){const r=S(4).locator('div,li,tr').filter({hasText:new RegExp('^\\s*'+k)}).filter({has:t.locator('button')}).last();await r.locator('button',{hasText:new RegExp('^'+picks[k]+'$')}).first().click().catch(()=>console.log('check fail',k))}
 await t.fill('#notes','Customer says the scratch on the front wing happened in a car park last month. Spare key not supplied.');

 
 console.log('progress:',await t.evaluate(()=>(document.querySelector('.actions')||{}).innerText));
 await C.shoot(t,S(0),'insp-1.png',900);   // header is above; take from the top instead
 await t.evaluate(()=>scrollTo(0,0));await t.addStyleTag({content:'.actions,#toast{display:none!important}'});await t.screenshot({path:__dirname+'/img/insp-1.png',fullPage:true,clip:{x:0,y:0,width:430,height:930}});
 await C.shoot(t,S(3),'insp-2.png');await C.shoot(t,S(4),'insp-3.png');await C.shoot(t,S(7),'insp-4.png');
};
