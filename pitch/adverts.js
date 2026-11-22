/* Advert pictures and wording for recruiting partners (22 Nov 2026). NOT to be run as adverts until the company is registered.
   node adverts.js   makes, in adverts/: <trade>-square.jpg (1080 x 1080, feeds), <trade>-story.jpg (1080 x 1920, stories and reels)
                     and The-Motoring-Central-Advert-Pack.pdf with the wording, links and test plan.
   Wording and figures must match the leaflets (leaflets.js), the join pages and the terms. The photos are cropped so that
   none of the banner artwork's own claims (nationwide network and so on) appear in an advert. */
const fs = require('fs'); const { chromium } = require('playwright'); const B = require('./build.js');
const SITE = 'https://motoringcentral.co.uk/';
const FND = 'First 10 get first place in local results for 3 months', FNDS = 'First 10 get first place for 3 months';
const T = [
  { key: 'mot', hash: 'mot-station', name: 'MOT test stations', img: 'mot-network.webp', box: [100, 152, 736, 470], who: 'For MOT test stations',
    h: 'Fill your MOT bays. <em>Free to join.</em>', line: '&pound;49.85 paid to you for every car MOT, booked and paid online.', ticks: ['No commission, no monthly fee', 'Booked 24/7, even when you are closed', 'Paid every week'], pill: FND,
    text: 'MOT station owners near Dartford: get £49.85 paid to you for every car MOT, booked and paid online, even when you are closed. No commission, no monthly fee, no contract. The first 10 stations we approve get first place in local results for 3 months.',
    head: 'Fill your MOT bays. Free to join.', desc: '£49.85 per MOT, paid weekly' },
  { key: 'valet', hash: 'valets', name: 'Valeters', img: 'valet.webp', box: [110, 165, 826, 523], who: 'For valeters',
    h: 'A full diary of valets, <em>paid up front.</em>', line: 'Customers book and pay online. Your prices, your days, your area.', ticks: ['One flat fee: 10% + VAT', 'No monthly fee, no joining fee', 'Paid every week'], pill: FND,
    text: 'Valeters near Dartford: customers book and pay for your full valet online. You set your prices, your days and the area you cover. One flat fee of 10% + VAT, only on jobs you do. No monthly fee. The first 10 valeters we approve get first place in local results for 3 months.',
    head: 'A full diary of valets, paid up front', desc: 'No monthly fee. Paid weekly.' },
  { key: 'instructor', hash: 'instructors', name: 'Driving instructors', img: 'driving-instructors-poster.webp', box: [520, 660, 1199, 1000], who: 'For driving instructors',
    h: 'Every lesson <em>paid up front.</em>', line: 'Learners pick a free time in your diary and pay online.', ticks: ['You set your hourly rate', 'Late cancellations and no-shows still paid', '10% + VAT per lesson, nothing monthly'], pill: FND,
    text: 'Driving instructors near Dartford: learners pick a free time in your diary and pay online. No cash in the car and no chasing. You set your hourly rate. 10% + VAT per lesson given, nothing monthly. The first 10 instructors we approve get first place in local results for 3 months.',
    head: 'Every lesson paid up front', desc: 'No-shows are still paid' },
  { key: 'body', hash: 'bodyshop', name: 'Body shops and alloy wheels', img: 'bodyshop.webp', box: [250, 90, 1157, 544], who: 'For body shops and wheel refurbishers',
    h: 'More repairs, <em>no chasing.</em>', line: 'Quote from the customer&rsquo;s photos. Paid when they accept.', ticks: ['One flat fee: 10% + VAT', 'No monthly fee, no joining fee', 'Paid every week'], pill: FND,
    text: 'Body shops and wheel refurbishers near Dartford: quote from the customer’s photos and get paid when they accept. Alloy refurbs are booked at your own prices. One flat fee of 10% + VAT, only on work you do. The first 10 we approve get first place in local results for 3 months.',
    head: 'More repairs, no chasing', desc: 'No monthly fee. Paid weekly.' },
  { key: 'autoelec', hash: 'auto-electrician', name: 'Auto electricians and locksmiths', img: 'auto-electrician-locksmith.webp', box: [240, 120, 1164, 582], who: 'For auto electricians and locksmiths',
    h: 'More jobs, <em>paid up front.</em>', line: 'The customer describes the job. You quote. They pay.', ticks: ['No paying for leads', 'One flat fee: 10% + VAT', 'Paid every week'], pill: FND,
    text: 'Auto electricians and vehicle locksmiths near Dartford: the customer describes the job, you quote, and it is paid before you turn up. No paying for leads. 10% + VAT, only on jobs you do. The first 10 we approve get first place in local results for 3 months.',
    head: 'More jobs, paid up front', desc: 'No paying for leads' },
  { key: 'dealer', hash: 'dealers', name: 'Car and van dealers', img: 'car-sales.webp', box: [0, 180, 756, 558], who: 'For car and van dealers',
    h: 'Sell more stock. <em>30 days free.</em>', line: 'Your cars in front of local buyers, with the tools to run your forecourt.', ticks: ['No commission on the cars you sell', 'From &pound;169 + VAT a month after your trial', 'Cancel any time in your trial'], pill: 'First 30 dealers: pay for 8 months, get 12',
    text: 'Car and van dealers near Dartford: put your stock in front of local buyers. 30 days free, no commission on the cars you sell, and a stock book, sales invoices and windscreen cards included. From £169 + VAT a month after your trial. Cancel any time in the trial and pay nothing.',
    head: 'Sell more stock. 30 days free.', desc: 'No commission on cars you sell' },
  { key: 'recovery', hash: 'recovery', name: 'Recovery companies', img: 'vehicle-transport.webp', box: [160, 250, 1236, 788], who: 'For recovery companies',
    sm: 1, h: 'More jobs, <em>paid before you set off.</em>', line: 'Breakdown and transport jobs sent straight to your drivers.', ticks: ['Your trucks, your prices', 'One flat fee: 10% + VAT', 'Paid every week'], pill: FND,
    text: 'Recovery operators near Dartford: breakdown, accident and transport jobs sent straight to your drivers and paid before you set off. Your trucks, your prices. 10% + VAT per job, nothing monthly. The first 10 we approve get first place in local results for 3 months.',
    head: 'More jobs, paid before you set off', desc: 'Your trucks, your prices' },
  { key: 'evcharge', hash: 'evcharging', name: 'Mobile EV charging companies', img: 'ev-charging.webp', box: [80, 170, 640, 450], who: 'For mobile EV charging companies',
    h: 'Get paid to rescue <em>stranded EVs.</em>', line: 'Out-of-charge rescues and booked top-ups, sent to your vans.', ticks: ['Your call-out, your price per mile', 'One flat fee: 10% + VAT', 'Paid every week'], pill: FND,
    text: 'Mobile EV charging companies: out-of-charge rescues and booked top-ups sent straight to your vans, paid up front. Your call-out charge and your price per mile. 10% + VAT per job, nothing monthly.',
    head: 'Get paid to rescue stranded EVs', desc: 'Paid up front, every job' }];
const BASE = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Inter,Arial,sans-serif;background:#0B1C35;color:#fff;-webkit-font-smoothing:antialiased}
.ad{position:relative;overflow:hidden;background:#0B1C35}
.ph{position:absolute;left:0;width:1080px;height:540px;background-size:cover;background-position:center}
.ph:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,28,53,0) 62%,rgba(11,28,53,.92) 96%,#0B1C35 100%)}
.br{position:absolute;display:flex;align-items:center;gap:16px;z-index:2}.br .lg{width:64px;height:64px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.br b{font-size:30px;font-weight:800;letter-spacing:-.01em;line-height:1.05;display:block}.br small{font-size:17px;color:#B9C7DA;letter-spacing:.04em}
.kick{font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#38BDF8}
h1{margin:0;font-weight:800;letter-spacing:-.03em;line-height:1.03;text-wrap:balance}h1 em{font-style:normal;color:#FFD43B;display:block}
.line{color:#D5DEEA;line-height:1.3;text-wrap:balance}
.pill{display:inline-block;background:#FFD43B;color:#0B1C35;font-weight:800;border-radius:999px;line-height:1.15;white-space:nowrap}
.url{font-weight:700;color:#fff}.url span{color:#38BDF8}
ul{list-style:none;margin:0;padding:0}li{position:relative;color:#fff;font-weight:600}
li:before{content:"";position:absolute;left:0;border-left:5px solid #38BDF8;border-bottom:5px solid #38BDF8;transform:rotate(-45deg)}`;
const SQ = `.ad{width:1080px;height:1080px}.ph{top:0}
.pan{position:absolute;left:56px;right:56px;top:532px;bottom:136px;display:flex;flex-direction:column;justify-content:center}.kick{font-size:23px;margin-bottom:14px}h1{font-size:78px}h1.sm{font-size:68px}.line{font-size:32px;margin-top:20px}
.bt{position:absolute;left:56px;right:56px;bottom:46px;display:flex;align-items:center;justify-content:space-between;gap:20px}.pill{font-size:24px;padding:15px 24px}
.url{font-size:24px;white-space:nowrap;display:flex;align-items:center;gap:12px}.url .lg{width:46px;height:46px;display:inline-block}`;
const ST = `.ad{width:1080px;height:1920px}.br{left:64px;top:278px}.br .lg{width:84px;height:84px}.br b{font-size:40px}.br small{font-size:22px}
.ph{top:392px}.tx{position:absolute;left:64px;right:64px;top:958px}.kick{font-size:27px;margin-bottom:16px}h1{font-size:86px}h1.sm{font-size:75px}.line{font-size:34px;margin-top:22px}
ul{margin-top:28px}li{font-size:33px;padding-left:54px;margin-bottom:14px}li:before{top:8px;width:25px;height:12px}
.pill{font-size:28px;padding:17px 30px;margin-top:20px}`;
const uri = t => { const f = __dirname + '/../img/' + t.img; return 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64'); };
// the photo is shown through a 1080 x 540 window; the crop box is in pixels of the original picture
function photo(t, dim) { const [x0, y0, x1] = t.box; const s = 1080 / (x1 - x0);
  return `<div class="ph" style="background-image:url(${uri(t)});background-size:${Math.round(dim[0] * s)}px ${Math.round(dim[1] * s)}px;background-position:${-Math.round(x0 * s)}px ${-Math.round(y0 * s)}px"></div>`; }
const brand = `<div class="br"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div>`;
const url = `<div class="url"><i class="lg">${B.LOGO}</i><b>motoringcentral<span>.co.uk</span></b></div>`;
const page = (css, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;
const square = (t, dim) => page(SQ, `<div class="ad">${photo(t, dim)}<div class="pan"><div class="tx"><div class="kick">${t.who}</div><h1${t.sm ? ' class="sm"' : ''}>${t.h}</h1><div class="line">${t.line}</div></div></div><div class="bt"><div class="pill">${t.pill === FND ? FNDS : t.pill}</div>${url}</div></div>`);
const story = (t, dim) => page(ST, `<div class="ad">${brand}${photo(t, dim)}<div class="tx"><div class="kick">${t.who}</div><h1${t.sm ? ' class="sm"' : ''}>${t.h}</h1><div class="line">${t.line}</div><ul>${t.ticks.map(x => '<li>' + x + '</li>').join('')}</ul><div class="pill">${t.pill}</div></div></div>`);
const PCSS = `.ap h1{font-size:24pt}.ap h2{font-size:14pt;margin-top:5mm}.ap table{font-size:10.2pt}.ap td:first-child{width:22%;font-weight:700}
.ap .pics{display:grid;grid-template-columns:84mm 47.25mm 1fr;gap:6mm;align-items:start;margin:2mm 0 6mm}.ap .pics img{width:100%;display:block;border-radius:2mm;border:.6pt solid #C9D3E0}
.ap .pics small{display:block;font-size:7.6pt;color:#5A6B82;margin-top:1mm}.ap .copy{border:.8pt solid #C9D3E0;border-radius:2.6mm;padding:3.4mm 3.8mm;font-size:10pt;line-height:1.45}
.ap .lab{font-size:7.6pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0B6FA4;margin:3mm 0 .8mm}.ap .lab:first-child{margin-top:0}.ap .mono{font-size:8.4pt;word-break:break-all;color:#22344D}`;
const hd = tag => `<div class="hd"><div class="brand"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div><div class="tag">${tag}</div></div>`;
const ft = `<div class="ft"><span>The Motoring Central &nbsp;&middot;&nbsp; advert pack &nbsp;&middot;&nbsp; not to be used until the company is registered</span><span>22 November 2026</span></div>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function plan() {
  return `<section class="page ap">${hd('Advert pack: recruiting partners')}<p class="kick">Ready for when the company is registered</p><h1>Adverts to recruit partners</h1>
 <p class="lead">A picture in two shapes and the wording for each trade, plus a small paid test to see which trades answer.</p>
 <h2>The test</h2><table>
 <tr><td>When</td><td>Only after the company is registered and motoringcentral.co.uk opens the live site. Nothing here should be posted or paid for before then.</td></tr>
 <tr><td>Where</td><td>Facebook and Instagram, run from one Meta Ads account. Square picture for the feeds, upright picture for Stories and Reels.</td></tr>
 <tr><td>Budget</td><td>&pound;300 to &pound;500 in total over 14 days. Suggested: four trades at &pound;7 a day each, which comes to &pound;392.</td></tr>
 <tr><td>Which trades first</td><td>MOT test stations, valeters, driving instructors, and body shops. Add the others once you see which of these work.</td></tr>
 <tr><td>Who sees them</td><td>People within 15 miles of Dartford. Narrow by job or interest where Meta offers it: business page admins, small business owners, and the trade itself (MOT testing, car valeting and detailing, driving instructor, body repair).</td></tr>
 <tr><td>How to judge it</td><td>Each link carries a tag (for example fb-valet), so the staff page shows &ldquo;Came from&rdquo; on every application. Divide the spend by the registrations. After 5 days, pause any advert with none and move its money to the best one.</td></tr></table>
 <h2>Things to know before you press go</h2><ul class="tick">
 <li>Meta may ask whether the advert is about <b>employment</b>. Recruiting independent businesses is not a job advert, but if Meta classes it that way it limits who you can aim at (no age or narrow postcode choices). A 15-mile circle still works.</li>
 <li>Keep to the wording here. It matches the leaflets, the site and the terms. Do not add promises about how much work a partner will get.</li>
 <li>Reply to every comment and message within a day. Early replies are what other businesses read.</li></ul>
 <h2>Free places to post once you are live</h2><ul class="tick">
 <li>Your own Facebook and Instagram pages and a Google Business Profile, using the square pictures.</li>
 <li>Local and trade Facebook groups, where the rules allow business posts. Ask for opinions before you ask for sign-ups.</li></ul>${ft}</section>`;
}
function tradePage(t, sq, st) {
  const link = SITE + '?src=fb-' + t.key + '#' + t.hash;
  return `<section class="page ap">${hd('Advert pack: ' + t.name.toLowerCase())}<p class="kick">${t.who}</p><h1>${t.name}</h1>
 <div class="pics"><div><img src="${sq}"><small>Square, 1080 &times; 1080. File: ${t.key}-square.jpg</small></div><div><img src="${st}"><small>Upright, 1080 &times; 1920. File: ${t.key}-story.jpg</small></div>
 <div class="copy"><div class="lab">Where each picture goes</div><b>Square:</b> Facebook and Instagram feeds.<br><b>Upright:</b> Stories and Reels. The top and bottom are left clear for the app&rsquo;s own buttons.<div class="lab">Who to show it to</div>${t.name}, within 15 miles of Dartford.</div></div>
 <h2>Wording to paste in</h2><table><tr><td>Main text</td><td>${esc(t.text)}</td></tr><tr><td>Headline</td><td><b>${esc(t.head)}</b></td></tr><tr><td>Description</td><td>${esc(t.desc)}</td></tr><tr><td>Button</td><td>Sign up</td></tr><tr><td>Link</td><td><span class="mono">${link}</span></td></tr></table>
 <p class="note">Headline ${t.head.length} characters, description ${t.desc.length}, main text ${t.text.length}. Meta shows about the first 125 characters of the main text before &ldquo;See more&rdquo;, so the offer is in the first sentence.</p>${ft}</section>`;
}
(async () => {
  const out = __dirname + '/adverts'; fs.mkdirSync(out, { recursive: true }); const b = await chromium.launch(); const pages = [plan()];
  for (const t of T) {
    const p0 = await b.newPage(); const dim = await p0.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = src; }), uri(t)); await p0.close();
    const shots = {};
    for (const [kind, w, h, html] of [['square', 1080, 1080, square(t, dim)], ['story', 1080, 1920, story(t, dim)]]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(300);
      const fit = await p.evaluate(() => { const tx = document.querySelector('.tx').getBoundingClientRect(), u = document.querySelector('.bt'); return Math.round((u ? u.getBoundingClientRect().top : 1580) - tx.bottom); });
      const f = out + '/' + t.key + '-' + kind + '.jpg'; await p.screenshot({ path: f, type: 'jpeg', quality: 90 }); shots[kind] = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
      console.log(t.key + '-' + kind + '.jpg', 'room under text', fit, 'px'); await p.close();
    }
    console.log('  headline', t.head.length, 'description', t.desc.length, 'main text', t.text.length);
    pages.push(tradePage(t, shots.square, shots.story));
  }
  const p = await b.newPage(); await p.setContent(B.doc('The Motoring Central: advert pack', pages).replace('</style>', PCSS + '</style>'), { waitUntil: 'load' }); await p.waitForTimeout(500);
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map(pg => pg.scrollHeight - pg.clientHeight));
  await p.pdf({ path: out + '/The-Motoring-Central-Advert-Pack.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true }); console.log('pack overflow', over.join(' ')); await b.close();
})();
