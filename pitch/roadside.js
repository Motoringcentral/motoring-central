// one template for the two roadside trades
module.exports=function(K,o){const T=7,F='A proposal for '+o.aud+' · The Motoring Central',tag='For '+o.aud;
const li=a=>'<ul class="tick" style="margin:1.5mm 0 0;font-size:9.6pt">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
const gbp=n=>'£'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const fee=o.job*0.12,keep=o.job-fee;
const p1=`<section class="page c2"><div class="cover">
 <div class="brand"><div class="lg">${K.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div>
 <p class="kick">A proposal for ${o.aud}</p>
 <h1>${o.h1a}<br><em>${o.h1b}</em></h1>
 <p class="lead">${o.lead}</p></div>
 <div class="stats"><div class="stat"><b>Your rates</b><span>You set your own prices. Customers see your price before they choose you</span></div><div class="stat"><b>Paid up front</b><span>The driver pays in full when they book. You are paid weekly</span></div><div class="stat"><b>24/7</b><span>jobs when you want them, in the hours and the area you choose</span></div></div>
 <div class="two"><div><p class="kick">Who we are</p><h2>One place for everything a car needs</h2>
 <p>The Motoring Central is a new UK website where drivers buy, fix, clean and rescue their vehicles in one place: ${o.list}.</p>
 <p>${o.who2}</p></div>
 <div><p class="kick">Our vision</p><h2>Fair for drivers. Fair for the trade.</h2>
 <p>${o.vision1}</p>
 <p>So we built one place where drivers see the full price first and choose who they want, and where independent operators set their own rates and keep more of what they earn. We want to be the UK's network of trusted, independent motor traders.</p></div></div>
 <div class="card sky" style="margin-top:5mm"><h3>Why we are talking to you</h3><p>${o.why}</p></div>
 ${K.foot(F,1,T)}</section>`;
const p2=`<section class="page t1">${K.head(tag)}
 <p class="kick">What we offer</p><h2>Everything your business gets</h2>
 <div class="three" style="margin-bottom:5mm">${o.cards.map(c=>'<div class="card"><h3>'+c[0]+'</h3><p>'+c[1]+'</p></div>').join('')}</div>
 <p class="kick">How the price is worked out</p><h2>${o.priceH}</h2>
 <p>${o.priceP}</p>
 <table><tr><th>${o.exH}</th><th class="n">Amount</th></tr>${o.ex.map((r,i)=>'<tr'+(i===o.ex.length-1?' class="hl"':'')+'><td>'+r[0]+'</td><td class="n">'+r[1]+'</td></tr>').join('')}</table>
 <p class="note">${o.exNote}</p>
 ${K.foot(F,2,T)}</section>`;
const p3=`<section class="page">${K.head(tag)}
 <p class="kick">How it works</p><h2>From joining to being paid, step by step</h2>
 <div class="steps" style="margin-bottom:6mm">${o.steps.map(s=>'<div class="step"><p><b>'+s[0]+'</b> '+s[1]+'</p></div>').join('')}</div>
 <div class="two"><div class="card"><h3>In your dashboard</h3>${li(o.dash)}</div><div class="card"><h3>Working with your customers</h3>${li(o.cust)}</div></div>
 <div class="card yel" style="margin-top:5mm"><h3>${o.tipH}</h3><p>${o.tipP}</p></div>
 ${K.foot(F,3,T)}</section>`;
const pS=`<section class="page see">${K.head(tag)}
 <p class="kick">See it</p><h2>${o.seeH}</h2>
 <p>${o.seeP}</p>
 ${K.shot(o.seeImg,o.seeCap,o.seeW)}
 <div class="two"><div class="card"><h3>What you are looking at</h3>${K.tick(o.seeA)}</div><div class="card"><h3>What you can do from it</h3>${K.tick(o.seeB)}</div></div>
 ${K.foot(F,4,T)}</section>`;
const pG=K.protect(tag,F,5,T,K.INSP(o.before));
const pP=K.platform(tag,F,6,T,{loop:o.loop});
const p4=`<section class="page t3 t4">${K.head(tag)}
 <p class="kick">Plans and prices</p><h2>Two ways to work with us</h2>
 <table><tr><th>Plan</th><th>What you pay us</th><th>Best for</th></tr>
 <tr><td><b>Pay as you go</b></td><td><b>10% + VAT</b> of each job. No monthly fee and no joining fee. You only pay when you earn.</td><td>Fewer than about ${o.breakeven} jobs a month</td></tr>
 <tr class="hl"><td><b>Pro</b></td><td><b>£149 + VAT a month</b> and 0% per job: you keep everything you charge. Charged only once your documents are verified.</td><td>About ${o.breakeven} jobs a month or more</td></tr></table>
 <p class="note" style="margin-bottom:4mm">Switch plans or cancel at the end of any month. The driver pays a separate booking fee to us on top of your price. It never comes out of what you charge.</p>
 <div class="two" style="margin-bottom:4mm"><div><h3>Where the money goes, on Pay as you go</h3>
 <table><tr><th>${o.jobName}</th><th class="n">Amount</th></tr><tr><td>Job price the customer pays you</td><td class="n">${gbp(o.job)}</td></tr><tr><td>Our fee (10% + VAT)</td><td class="n">−${gbp(fee)}</td></tr><tr class="hl"><td>You keep</td><td class="n">${gbp(keep)}</td></tr></table></div>
 <div><h3>Example month: 20 jobs at ${gbp(o.job)}</h3>
 <table><tr><th>Plan</th><th class="n">You pay us</th></tr><tr><td>Pay as you go (10% + VAT of ${gbp(o.job*20)})</td><td class="n">${gbp(o.job*20*0.1)} + VAT</td></tr><tr class="hl"><td>Pro</td><td class="n">£149.00 + VAT</td></tr></table>
 <p class="note">Example figures only, not a forecast or a guarantee.</p></div></div>
 <div class="two"><div><p class="kick">What you need to join</p><ul class="tick">${o.need.map(x=>'<li>'+x+'</li>').join('')}</ul></div>
 <div class="qa"><p class="kick">Common questions</p>${o.qa.map(q=>'<b>'+q[0]+'</b><p>'+q[1]+'</p>').join('')}</div></div>
 <div class="contact"><div><h2>Join the network</h2><p>Scan the code or go to <b>preview.motoringcentral.co.uk</b> and choose For partners, then ${o.pick}.</p>
 <p>Call <b>020 8191 4290</b> &nbsp;·&nbsp; Monday to Friday 8am to 6pm, Saturday 9am to 1pm</p><p>Email <b>partners@motoringcentral.co.uk</b></p></div><div class="qr">${K.qr(o.url)}</div></div>
 <div class="sign"><div>Your contact at The Motoring Central</div><div>Date</div></div>
 ${K.foot('Prices and terms are correct at 21 November 2026 and may change. Fees and Pro membership are plus VAT.',7,T)}</section>`;
return K.doc('The Motoring Central: for '+o.aud,[p1,p2,p3,pS,pG,pP,p4])};
