const fs=require('fs');const {chromium}=require('playwright');
const qrcode=require('../js/qrcode.min.js');
function qr(url){const q=qrcode(0,'M');q.addData(url);q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true})}
const LOGO='<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="30" fill="#0B1C35"/><path d="M30.3 89.7 A42 42 0 1 1 89.7 89.7" fill="none" stroke="#38BDF8" stroke-width="7" stroke-linecap="round"/><polyline points="38,82 38,46 60,68 82,46 82,82" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="68" r="8" fill="#FFD43B"/></svg>';
const CSS=`
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,Arial,sans-serif;color:#0B1C35;font-size:10.4pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;padding:15mm 16mm 14mm;position:relative;page-break-after:always;overflow:hidden;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.hd{display:flex;align-items:center;justify-content:space-between;border-bottom:1.2pt solid #0B1C35;padding-bottom:3.2mm;margin-bottom:6mm}
.brand{display:flex;align-items:center;gap:3mm}
.brand .lg{width:10.5mm;height:10.5mm}
.brand b{font-size:11.5pt;font-weight:800;letter-spacing:-.01em;display:block;line-height:1.05}
.brand small{font-size:7.4pt;color:#4A5B72;letter-spacing:.04em}
.hd .tag{font-size:8pt;color:#4A5B72;text-align:right}
.ft{margin-top:auto;padding-top:3mm;border-top:.6pt solid #C9D3E0;display:flex;justify-content:space-between;font-size:7.6pt;color:#5A6B82}
h1{font-size:30pt;line-height:1.06;letter-spacing:-.025em;font-weight:800;margin:0 0 3mm}
h2{font-size:16pt;line-height:1.15;letter-spacing:-.015em;font-weight:800;margin:0 0 3.2mm}
h3{font-size:10.8pt;font-weight:800;margin:0 0 1mm}
p{margin:0 0 2.6mm}
.lead{font-size:12.4pt;line-height:1.42;color:#22344D}
.kick{font-size:8.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0B6FA4;margin:0 0 2.4mm}
.cover{background:#0B1C35;color:#fff;margin:-15mm -16mm 7mm;padding:15mm 16mm 11mm}
.cover .brand b{color:#fff}.cover .brand small{color:#B9C7DA}
.cover h1{color:#fff;margin-top:13mm;font-size:34pt}
.cover h1 em{font-style:normal;color:#FFD43B}
.cover .lead{color:#D5DEEA;max-width:150mm}
.cover .kick{color:#38BDF8;margin-top:11mm}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:0 0 7mm}
.stat{border:1.2pt solid #0B1C35;border-radius:3mm;padding:4mm 4mm 3.4mm}
.stat b{display:block;font-size:21pt;font-weight:800;letter-spacing:-.02em;line-height:1.05}
.stat span{font-size:9pt;color:#33455E}
.two{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.card{border:.8pt solid #C9D3E0;border-radius:2.6mm;padding:3.6mm 3.8mm;break-inside:avoid}
.card p{margin:0;font-size:9.6pt;color:#22344D}
.card.navy{background:#0B1C35;border-color:#0B1C35;color:#fff}.card.navy p{color:#D5DEEA}.card.navy h3{color:#fff}
.card.sky{background:#E6F6FE;border-color:#9BDCFB}
.card.yel{background:#FFF7D6;border-color:#F2D25A}
table{width:100%;border-collapse:collapse;font-size:9.8pt;margin:0 0 3mm}
th{background:#0B1C35;color:#fff;text-align:left;font-weight:700;padding:2.2mm 2.6mm;font-size:9pt}
td{padding:2.2mm 2.6mm;border-bottom:.6pt solid #D5DEEA;vertical-align:top}
td.n,th.n{text-align:right;white-space:nowrap}
tr.hl td{background:#E6F6FE;font-weight:700}
.steps{counter-reset:s;display:grid;gap:2.5mm}
.step{display:grid;grid-template-columns:9mm 1fr;gap:3mm;align-items:start;break-inside:avoid}
.step:before{counter-increment:s;content:counter(s);width:8mm;height:8mm;border-radius:50%;background:#0B1C35;color:#fff;font-weight:800;font-size:10pt;display:grid;place-items:center}
.step p{margin:0;font-size:9.8pt}
ul{margin:0 0 2.6mm;padding-left:4.6mm}li{margin:0 0 1.3mm}
ul.tick{list-style:none;padding:0}ul.tick li{padding-left:5.6mm;position:relative}
ul.tick li:before{content:"";position:absolute;left:0;top:1.1mm;width:3.2mm;height:1.6mm;border-left:1.6pt solid #0B6FA4;border-bottom:1.6pt solid #0B6FA4;transform:rotate(-45deg)}
.note{font-size:8.2pt;color:#5A6B82}
.qa b{display:block;margin-top:2.4mm}.qa p{margin:0;font-size:9.6pt;color:#22344D}
.contact{display:grid;grid-template-columns:1fr 31mm;gap:6mm;align-items:center;background:#0B1C35;color:#fff;border-radius:3mm;padding:5mm 6mm;margin-top:4mm}
.contact h2{color:#fff;margin-bottom:1.6mm}.contact p{color:#D5DEEA;margin:0 0 1mm}.contact b{color:#FFD43B}
.contact .qr{background:#fff;border-radius:2mm;padding:2mm;width:31mm;height:31mm}.contact .qr svg{width:100%;height:100%;display:block}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:3mm;font-size:8.6pt;color:#5A6B82}
.sign div{border-top:.6pt solid #8A99AD;padding-top:1.2mm}
.t1 .card{padding:3mm 3.4mm}.t1 .card p{font-size:9.2pt;line-height:1.38}.t1 h2{margin-bottom:2.4mm}.t1 .three{gap:3mm}.t1 table{font-size:9.5pt}.t1 td,.t1 th{padding:1.8mm 2.6mm}
.t2 .card{padding:3mm 3.6mm}.t2 ul.tick{font-size:9.05pt!important;line-height:1.36}.t2 li{margin-bottom:.9mm}.t2 .two{gap:3.4mm}.t2 h2{margin-bottom:2.4mm}
.c2 .cover{padding-bottom:9mm;margin-bottom:6mm}.c2 .cover h1{font-size:29pt;margin-top:9mm}.c2 .cover .kick{margin-top:8mm}.c2 .stat b{font-size:16pt;margin-bottom:.6mm}.c2 .stats{margin-bottom:5.5mm}.c2 h2{font-size:15pt}.c2 p{font-size:10pt}
.t4 table{font-size:9.3pt;margin-bottom:2mm}.t4 td,.t4 th{padding:1.6mm 2.4mm}.t4 h2{margin-bottom:2.2mm}.t4 h3{font-size:10.2pt}.t4 ul.tick li{margin-bottom:.8mm}.t4 .qa b{margin-top:1.4mm}.t4 .sign{margin-top:2mm}
.page>.shot{flex-shrink:1;min-height:60mm}.page>.shot+.cap,.page>.two,.page>p,.page>h2{flex-shrink:0}.see .two{margin-bottom:4mm}
.shot{margin:0 0 3mm;border:.8pt solid #0B1C35;border-radius:2.6mm;overflow:hidden;background:#0B1C35}.shot img{display:block;width:100%}
.cap{font-size:8.2pt;color:#5A6B82;margin:0 0 3mm}
.pill{display:inline-block;background:#0B1C35;color:#fff;border-radius:99px;padding:.8mm 3mm;font-size:8.4pt;font-weight:700;margin:0 1.2mm 1.4mm 0}
.pill.y{background:#FFD43B;color:#0B1C35}.pill.s{background:#E6F6FE;color:#0B1C35;border:.6pt solid #9BDCFB}
.phones{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin:1mm auto 3mm;width:144mm}.phone{border:.8pt solid #9FB0C6;border-radius:3mm;overflow:hidden;background:#F1F5F9}.phone img{display:block;width:100%}.phones figure{margin:0}.phones figcaption{font-size:8.6pt;color:#22344D;margin-top:1.6mm;line-height:1.35}.phones figcaption b{display:block;font-size:9.4pt;color:#0B1C35}
.t3 .steps{gap:1.9mm}.t3 .step p{font-size:9.5pt;line-height:1.4}.t3 .qa p,.t3 ul.tick{font-size:9.3pt}.t3 .qa b{margin-top:1.8mm}.t3 .contact{padding:4mm 6mm;margin-top:3mm}
`;
const head=(tag)=>`<div class="hd"><div class="brand"><div class="lg">${LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div><div class="tag">${tag}</div></div>`;
const foot=(l,n,t)=>`<div class="ft"><span>${l}</span><span>Page ${n} of ${t}</span></div>`;
function doc(title,pages){return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${pages.join('')}</body></html>`}
const img=n=>'data:image/jpeg;base64,'+fs.readFileSync(__dirname+'/img/'+n+'.jpg').toString('base64');
const shot=(n,cap,w)=>`<div class="shot"${w?' style="width:'+w+'"':''}><img src="${img(n)}" alt=""></div>${cap?'<p class="cap">'+cap+'</p>':''}`;
const tick=a=>'<ul class="tick" style="margin:1.2mm 0 0;font-size:9.4pt">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
/* the page every proposal shares: the whole platform */
function platform(tag,F,n,T,o){o=o||{};return `<section class="page">${head(tag)}
 <p class="kick">The whole picture</p><h2>More than bookings: a platform for the whole motor trade</h2>
 <p>We are not building a single listings site. We are building the place where the independent motor trade and its customers meet: drivers on one side, and every kind of motor business on the other, each sending work to the next.</p>
 <p style="margin-bottom:1.5mm"><b>What drivers come to us for:</b></p>
 <div style="margin-bottom:3mm"><span class="pill">MOT</span><span class="pill">Servicing and repairs</span><span class="pill">Mobile mechanics</span><span class="pill">Auto electrics</span><span class="pill">Tyres</span><span class="pill">Valeting</span><span class="pill">Bodywork and alloys</span><span class="pill">Recovery</span><span class="pill">EV charging</span><span class="pill">Cars for sale</span><span class="pill">Vans for sale</span><span class="pill">Breakdown cover</span></div>
 <div class="card sky" style="margin-bottom:4mm"><p>${o.loop||'A driver who books an MOT with us needs tyres, a repair, a valet and one day their next car. Every one of those is another business on the network. The more of the trade that joins, the more work there is for each member.'}</p></div>
 <div class="two" style="gap:5mm;margin-bottom:3mm">
 <div><h3>Trade cars and vans</h3>${shot('trade-c')}<p style="font-size:9.5pt;margin:0">A trade-only market for every partner, not only dealers. Sell a part exchange, a non-runner or surplus stock to other businesses on the network, sold as seen, with a minimum price or offers invited. ${o.trade||'A trade listing is £9.99 + VAT.'}</p></div>
 <div><h3>Work in the motor trade</h3>${shot('jobs-c')}<p style="font-size:9.5pt;margin:0">Our jobs board for the industry: technicians, MOT testers, valeters, recovery drivers, sales staff and apprentices. Free to search and apply. Any partner can advertise a vacancy for £9.99 + VAT, live for 90 days.</p></div></div>
 <div class="three" style="gap:3mm;margin-bottom:3mm">
 <div class="card navy"><h3>Paid every week</h3><p>${o.pay||'Once you are set up, we pay out every week, to every partner we take payment for. No waiting for month end.'}</p></div>
 <div class="card"><h3>One Messages panel</h3><p>Customers, other traders and our team in one place, with an email each time someone writes to you.</p></div>
 <div class="card"><h3>Tools on your phone</h3><p>Vehicle inspection, service sheet and pre-delivery inspection forms, your profile, your reviews and your statements.</p></div></div>
 <p class="cap" style="margin:0">Screens are from our preview site and show sample businesses and figures.</p>
 ${foot(F,n,T)}</section>`}
/* protection page: the vehicle inspection report, or the pre-delivery inspection for dealers */
function protect(tag,F,n,T,o){const ph=(f,b,c)=>`<figure><div class="phone"><img src="${img(f)}" alt=""></div><figcaption><b>${b}</b>${c}</figcaption></figure>`;
 return `<section class="page">${head(tag)}
 <p class="kick">Protection built in</p><h2>${o.h}</h2>
 <p>${o.intro}</p>
 <div class="phones">${o.shots.map(x=>ph(x[0],x[1],x[2])).join('')}</div>
 <div class="two" style="gap:5mm"><div class="card"><h3>What it records</h3>${tick(o.records)}</div>
 <div><div class="card navy" style="margin-bottom:3mm"><h3>Why it matters</h3><p>${o.why}</p></div>${o.extra?'<div class="card yel"><p>'+o.extra+'</p></div>':''}</div></div>
 <p class="cap" style="margin:3mm 0 0">Screens are from our preview site, filled in with a sample ${o.sample}.</p>
 ${foot(F,n,T)}</section>`}
const INSP=(when)=>({h:'The vehicle inspection report: your record before work starts',
 intro:'Every partner gets this free. Before you '+when+', record the vehicle\'s condition on your phone. It takes about 3 minutes. If a customer later says you caused damage, you have a dated record, made before you started, that both of you signed.',
 shots:[['insp-1-c','1. It fills itself in','The job, the customer and the vehicle come straight from the booking.'],['insp-2-c','2. Mark existing damage','Tap the car to add a numbered pin, then choose scratch, dent, chip, crack, scuff, rust or missing, and its size.'],['insp-4-c','3. Both sign','You and the customer sign on the screen. Then save the report as a PDF.']],
 records:['The job number, date and time, and who inspected the vehicle','Registration, make and model, mileage and fuel or charge level','Every mark on the bodywork, by panel, type and size','Quick checks: windscreen, each alloy wheel, lights, mirrors, interior, warning lights, valuables left in the vehicle and keys received','Photos: front, back, both sides, each damage and the mileage','Your notes, and both signatures','If the customer is not there: photos taken as the record instead'],
 why:'Damage that was already on the vehicle is on record, with photos, before you start. That protects you against a claim that you caused it, and it protects the customer too, because both of you agreed the condition at the start.',
 extra:'It is built into every job: tap <b>Start vehicle inspection</b> on a booking and the details are already there.',sample:'job'});
const PDI={h:'The pre-delivery inspection: your record of every handover',
 intro:'Included for every dealer. Before a vehicle leaves you, complete the PDI on your phone from your stock book. It records exactly what the buyer received and the condition they accepted, so you have the evidence if there is ever a dispute after the sale.',
 shots:[['pdi-1-c','1. It fills itself in','The vehicle, price and stock number come from your stock book. Add the buyer and the warranty you are giving.'],['pdi-2-c','2. Work through the checklist','Mark each item OK, Fixed, Advise or N/A: documents, exterior, interior, under the bonnet, brakes and suspension, road test.'],['pdi-4-c','3. The buyer signs','The buyer confirms they have seen the vehicle, received the documents and keys, and accept its condition as recorded.']],
 records:['The sale: price, date, handover method and the warranty given','The buyer\'s details','Documents and keys handed over: V5C, service history, MOT, handbook, spare key, locking wheel nut key','The full inspection checklist, with anything you advised the buyer about','Tyre tread and pressures on every wheel','Bodywork condition at handover, marked on a diagram','Photos, work done, advisories and both signatures'],
 why:'If a buyer comes back weeks later about a scratch, a missing key or a fault you told them about, you have a signed record of the vehicle\'s condition and what was handed over on the day. It also shows the buyer you prepared the car properly.',
 extra:'Taking a part exchange, or collecting a vehicle? Use the <b>vehicle inspection report</b> in the same way to record its condition before you accept it.',sample:'sale'};
module.exports={qr,LOGO,head,foot,doc,shot,tick,platform,protect,INSP,PDI};
if(require.main===module)(async()=>{const b=await chromium.launch();const NAMES=[['mot-station','MOT-Stations'],['car-van-dealers','Car-and-Van-Dealers'],['recovery','Recovery-Companies'],['ev-charging','EV-Charging-Companies']];const bodies=[];
 async function make(html,out,shots){const p=await b.newPage();await p.setContent(html,{waitUntil:'load'});await p.waitForTimeout(400);
  const over=await p.evaluate(()=>[...document.querySelectorAll('.page')].map((pg,i)=>{const ft=pg.querySelector('.ft');const last=[...pg.children].filter(c=>c!==ft).pop();return 'p'+(i+1)+':'+Math.round(ft.getBoundingClientRect().top-last.getBoundingClientRect().bottom)+'/'+(pg.scrollHeight-pg.clientHeight)}));
  console.log(out,'(gap/overflow)',over.join(' '));await p.pdf({path:out,format:'A4',printBackground:true,preferCSSPageSize:true});
  if(shots){const n=await p.evaluate(()=>document.querySelectorAll('.page').length);for(let i=0;i<n;i++)await p.locator('.page').nth(i).screenshot({path:shots+'-p'+(i+1)+'.png'})}await p.close()}
 for(const [name,label] of NAMES){const html=require('./'+name+'.js')(module.exports);fs.writeFileSync(name+'.html',html);bodies.push(html.split('<body>')[1].split('</body>')[0]);await make(html,'The-Motoring-Central-'+label+'.pdf',name)}
 const all=doc('The Motoring Central: partner proposals',bodies);await make(all,'The-Motoring-Central-Partner-Proposals.pdf',null);
 await b.close()})();
