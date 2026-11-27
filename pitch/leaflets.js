/* One-page A4 leaflets for recruiting partners, one for each trade open at launch (22 Nov 2026).
   node leaflets.js            makes The-Motoring-Central-Leaflet-<Trade>.pdf and one file with all of them, in leaflets/
   node leaflets.js links DIR  also makes a "sign-up and demo links" sheet in DIR (two pages), whose QR codes open the
                               preview site: the join page and the Request a demo page for each trade (for emails and
                               conversations before the main address is live). The demo itself opens only from a
                               personal link that staff send from the admin page.
   Wording and figures must match the join pages and the terms: 10% + VAT per job, weekly payouts, MOT stations paid the
   official fee less 5 pounds, dealers from 169 + VAT with 30 days free, and the founding partner offer. */
const fs = require('fs'); const { chromium } = require('playwright'); const B = require('./build.js');
const SITE = 'https://motoringcentral.co.uk/', PREVIEW = 'https://preview.motoringcentral.co.uk/';
const UP = '<b>Every job is paid up front.</b> The customer pays when they book. No chasing, no bad debts.',
  FEE = '<b>One flat fee: 10% + VAT.</b> No monthly fee, no membership, no joining fee.',
  WK = '<b>Paid every week,</b> straight to your bank.',
  LEADS = '<b>No paying for leads.</b> You only pay our fee on work you actually do.',
  AREA = '<b>Local customers only.</b> You set the area you cover, and we only show you to customers you can reach.';
const fnd = who => `The first 10 ${who} we approve get a <b>&ldquo;Founding partner&rdquo; badge</b> on their listing, and <b>first place in customers&rsquo; results</b> in their area for three months after launch.`;
const cost = eg => ({ big: '10% + VAT', txt: `per completed job. ${eg} The customer pays our &pound;9.99 booking fee, never you.` });
const T = [
  { key: 'mot', hash: 'mot-station', file: 'MOT-Stations', img: 'mot-network.webp', who: 'For MOT test stations', h1: 'Fill your MOT bays. <em>Free to join.</em>', sub: 'Drivers book and pay online, any time, straight into your free live diary.',
    pts: ['<b>&pound;49.85 paid to you for every car MOT.</b> The official fee, less a flat &pound;5.', '<b>No monthly fee, no commission, no contract.</b>', '<b>Booked and paid online, 24/7,</b> even when you are closed.', '<b>A free live diary.</b> Online MOTs drop straight into your bays, and your walk-ins go in the same diary.', '<b>Your hours, your classes.</b> You choose the days, times and MOT classes you test.', WK],
    cost: { big: '&pound;49.85', txt: 'paid to you for every car MOT. The customer pays the official fee of &pound;54.85 and we keep a flat &pound;5. Every station charges the same, so nobody can undercut you.' }, fnd: fnd('MOT test stations') },
  { key: 'valet', hash: 'valets', file: 'Valeters', img: 'valet.webp', who: 'For valeters', h1: 'A full diary of valets, <em>paid up front.</em>', sub: 'Customers book your full valet online. Mobile, at your premises, or both.',
    pts: ['<b>You set your own prices</b> for each size of car. Customers see them before they book.', UP, FEE, WK, '<b>Work when you want.</b> You choose your days and hours, and customers can only book inside them.', AREA],
    cost: cost('On a &pound;99 valet you keep &pound;87.12.'), fnd: fnd('valeters') },
  { key: 'recovery', hash: 'recovery', file: 'Recovery-Companies', img: 'vehicle-transport.webp', who: 'For recovery companies', h1: 'More jobs, <em>paid before you set off.</em>', sub: 'Breakdown, accident and transport jobs sent straight to your drivers. Your trucks, your prices.',
    pts: ['<b>You set the prices.</b> Your call-out and price per mile for each truck. Customers see your price, not ours.', UP, FEE, WK, '<b>Work when you want.</b> One tap to go available, or set your hours, even 24/7.', '<b>Cancelled after you set off?</b> You keep your call-out.'],
    cost: cost('On a &pound;150 job you keep &pound;132.'), fnd: fnd('recovery companies') },
  { key: 'evcharge', hash: 'evcharging', file: 'EV-Charging-Companies', img: 'ev-charging.webp', who: 'For mobile EV charging companies', h1: 'Get paid to rescue <em>stranded EVs.</em>', sub: 'Out-of-charge rescues and booked top-ups, sent straight to your vans.',
    pts: ['<b>You set the prices.</b> Your call-out charge, your price per kWh and your price per mile. Customers see your price, not ours.', UP, FEE, WK, '<b>Work when you want.</b> One tap to go available, or set your hours, even 24/7.', '<b>Cancelled after you set off?</b> You keep your call-out.'],
    cost: cost('On a &pound;150 call-out you keep &pound;132.'), fnd: fnd('mobile EV charging companies') },
  { key: 'body', hash: 'bodyshop', file: 'Body-Shops-and-Alloy-Wheels', img: 'bodyshop.webp', who: 'For body shops and alloy wheel specialists', h1: 'More repairs, <em>no chasing.</em>', sub: 'Bodywork quoted from the customer&rsquo;s photos, and alloy refurbs booked at your prices.',
    pts: ['<b>You name the price.</b> Quote bodywork from the customer&rsquo;s photos. Alloy refurbs are booked at your own fixed prices.', '<b>Paid up front.</b> The customer pays when they accept your quote or book.', FEE, WK, '<b>Mobile, workshop or both.</b> Insurance-approved repairers welcome.', AREA],
    cost: cost('On a &pound;400 repair you keep &pound;352.'), fnd: fnd('body shops and wheel specialists') },
  { key: 'autoelec', hash: 'auto-electrician', file: 'Auto-Electricians-and-Locksmiths', img: 'auto-electrician-locksmith.webp', who: 'For auto electricians and vehicle locksmiths', h1: 'More jobs, <em>paid up front.</em>', sub: 'Electrical faults, starting and charging, keys and fobs. Mobile or at your workshop.',
    pts: ['<b>You set the price.</b> Quote each job from the customer&rsquo;s description. They see your price, not ours.', UP, FEE, WK, '<b>Work when you want.</b> Mobile, workshop or both.', LEADS],
    cost: cost('On a &pound;165 job you keep &pound;145.20.'), fnd: fnd('auto electricians and locksmiths') },
  { key: 'instructor', hash: 'instructors', file: 'Driving-Instructors', img: 'instructor-strip.jpg', who: 'For driving instructors and driving schools', h1: 'A full diary, <em>paid up front.</em>', sub: 'Learners near you choose you, pick a free time from your live diary, and pay online.',
    pts: ['<b>You set your hourly rate,</b> and any discount you give for block bookings and intensive courses.', '<b>Every lesson is paid up front.</b> No chasing learners for money, no cash in the car.', FEE, WK, '<b>A free live diary.</b> Set your hours once. Learners can only book when you are free.', '<b>The learner pays no booking fee,</b> so your price is the price they see.'],
    cost: { big: '10% + VAT', txt: 'per lesson given. On a &pound;40 lesson you keep &pound;35.20. Late cancellations and no-shows are still paid.' }, fnd: fnd('driving instructors and schools') },
  { key: 'dealer', hash: 'dealers', file: 'Car-and-Van-Dealers', img: 'car-sales.webp', who: 'For car and van dealers', h1: 'Sell more stock. <em>Try it free for 30 days.</em>', sub: 'Your cars and vans in front of local buyers, with the tools to run your forecourt.',
    pts: ['<b>30 days free on every plan,</b> with 3 vehicle history checks included.', '<b>No commission</b> on the cars you sell.', '<b>Buyers message you directly.</b> Every enquiry is saved for you as a lead.', '<b>Forecourt tools included:</b> stock book, sales invoices, windscreen cards and your own showroom page.', '<b>List a car in minutes:</b> type the registration and the details fill in. Or upload your whole stock.', '<b>Cancel any time in your trial</b> and pay nothing.'],
    cost: { big: 'From &pound;169', txt: 'plus VAT a month, by the number of cars you list, after your 30 days free. Pay yearly and you pay for 9 months and get 12.' }, fnd: 'The first 30 dealers we approve are <b>founding dealers</b>: on a yearly plan they pay for 8 months and get 12, with <b>5 free premium adverts a month</b> to start.', fndh: 'Founding dealer offer', join: 'Join the dealer network' }];
const CSS = `
.lf{padding-top:0}
.lfban{margin:0 -16mm 6.5mm;height:76mm;background-size:cover;background-position:center 38%;position:relative}
.lfban:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,28,53,.0) 45%,rgba(11,28,53,.82) 100%)}
.lfban .brand{position:absolute;left:16mm;bottom:5mm;z-index:1}.lfban .brand b{color:#fff;font-size:14pt}.lfban .brand small{color:#D5DEEA;font-size:8.4pt}.lfban .brand .lg{width:12.5mm;height:12.5mm}
.lf h1{font-size:27pt;margin-bottom:2mm}.lf h1 em{font-style:normal;color:#0B6FA4}
.lf .lead{font-size:12pt;margin-bottom:4.5mm}
.lf ul.tick{font-size:11.3pt;line-height:1.42;margin-bottom:6mm}.lf ul.tick li{margin-bottom:2.5mm;padding-left:6.4mm}.lf ul.tick li:before{top:1.4mm;width:3.6mm;height:1.8mm}
.lf .card h3{font-size:9pt;letter-spacing:.12em;text-transform:uppercase;margin-bottom:1.6mm}.lf .card.navy h3{color:#38BDF8}.lf .card.yel h3{color:#7A5B00}
.lf .card{padding:4.4mm 4.6mm}.lf .card p{font-size:10.2pt;line-height:1.44}.lf .card p.big{font-size:27pt;font-weight:800;line-height:1.05;color:#FFD43B;margin:0 0 1.6mm;letter-spacing:-.02em}
.lf .contact{margin-top:5mm;grid-template-columns:1fr 34mm}.lf .contact .qr{width:34mm;height:34mm}.lf .contact ol{margin:1.5mm 0 0;padding-left:4.6mm;color:#D5DEEA;font-size:9.8pt}.lf .contact li{margin-bottom:.9mm}
.lf .scan{font-size:7.6pt;color:#D5DEEA;text-align:center;margin-top:1.2mm}
.links h1{font-size:22pt}.links .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5mm;margin-top:5mm}.links .q{border:.8pt solid #C9D3E0;border-radius:2.6mm;padding:3mm;text-align:center}.links .q svg{width:100%;height:auto;display:block}.links .q b{display:block;font-size:9.6pt;margin-top:2mm}.links .q small{display:block;font-size:6.6pt;color:#5A6B82;word-break:break-all;margin-top:1mm}`;
const uri = f => 'data:image/' + (f.endsWith('.jpg') ? 'jpeg' : 'webp') + ';base64,' + fs.readFileSync(f.includes('/') ? f : __dirname + '/../img/' + f).toString('base64');
function leaflet(t) {
  const url = SITE + '?src=leaflet-' + t.key + '#' + t.hash;
  return `<section class="page lf"><div class="lfban" style="background-image:url(${uri(t.img === 'instructor-strip.jpg' ? __dirname + '/img/instructor-strip.jpg' : t.img)})"><div class="brand"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div></div>
 <p class="kick">${t.who}</p><h1>${t.h1}</h1><p class="lead">${t.sub}</p>
 <ul class="tick">${t.pts.map(x => '<li>' + x + '</li>').join('')}</ul>
 <div class="two"><div class="card navy"><h3>What it costs</h3><p class="big">${t.cost.big}</p><p>${t.cost.txt}</p></div>
 <div class="card yel"><h3>${t.fndh || 'Founding partner offer'}</h3><p>${t.fnd}</p></div></div>
 <div class="contact"><div><h2>${t.join || 'Join the network'} in about five minutes</h2><ol><li>Scan the code, or go to <b>motoringcentral.co.uk</b> and choose <b>Join the network</b>.</li><li>Create your account with an email address and a password.</li><li>Tell us about your business and upload your insurance and photo ID.</li><li>We check your documents, and you are ready to go.</li></ol></div>
 <div><div class="qr">${B.qr(url)}</div><div class="scan">Scan to join</div></div></div>
 <div class="ft"><span>motoringcentral.co.uk &nbsp;&middot;&nbsp; hello@motoringcentral.co.uk &nbsp;&middot;&nbsp; <span style="white-space:nowrap">020 8191 4290</span> &nbsp;&middot;&nbsp; <span style="white-space:nowrap">WhatsApp 07364 144974</span></span><span>You stay an independent business.</span></div></section>`;
}
function links() {
  return `<section class="page links">${`<div class="hd"><div class="brand"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div><div class="tag">Sign-up links for conversations</div></div>`}
 <p class="kick">Before the main address is live</p><h1>Sign-up links for each trade</h1>
 <p class="lead">Show the code on your phone, or send the link. These open the working site today. Anyone who registers through them is marked as coming from a conversation, so you can see it on the admin page.</p>
 <div class="grid">${T.map(t => { const u = PREVIEW + '?src=talk-' + t.key + '#' + t.hash; return `<div class="q">${B.qr(u)}<b>${t.who.replace(/^For /, '').replace(/^./, c => c.toUpperCase())}</b><small>${u}</small></div>`; }).join('')}</div>
 <p class="note" style="margin-top:6mm">The leaflets carry the main address, motoringcentral.co.uk, which will work once the site is launched. Until then, use these.</p>
 <div class="ft"><span>The Motoring Central &nbsp;&middot;&nbsp; internal use</span><span>22 November 2026</span></div></section>`;
}
function demos() {
  return `<section class="page links">${`<div class="hd"><div class="brand"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div><div class="tag">Request-a-demo links</div></div>`}
 <p class="kick">Let them ask to try it</p><h1>Request a demo: a link for each trade</h1>
 <p class="lead">Email the link, or show the code. It opens the Request a demo page with their trade already chosen. They fill in their details, the request appears on your admin page (Partners, then Demo requests), and you send them their own demo link from there.</p>
 <div class="grid">${T.map(t => { const u = PREVIEW + '?src=email-' + t.key + '#demo-' + t.key; return `<div class="q">${B.qr(u)}<b>${t.who.replace(/^For /, '').replace(/^./, c => c.toUpperCase())}</b><small>${u}</small></div>`; }).join('')}</div>
 <p class="note" style="margin-top:6mm">The demo itself is not open to the public. Each business gets a personal link that works for 30 days, and the admin page shows whether they have opened it. To show the demo in person, use your own link: admin page, Partners, Demo requests, &ldquo;Show a demo in person&rdquo;.</p>
 <div class="ft"><span>The Motoring Central &nbsp;&middot;&nbsp; internal use</span><span>23 November 2026</span></div></section>`;
}
(async () => {
  const b = await chromium.launch(); const out = __dirname + '/leaflets'; fs.mkdirSync(out, { recursive: true }); const pages = [];
  const doc = (title, body) => B.doc(title, [body]).replace('</style>', CSS + '</style>');
  async function make(html, path, shot) {
    const p = await b.newPage(); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(500);
    const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => { const ft = pg.querySelector('.ft'); const last = [...pg.children].filter(c => c !== ft).pop(); return Math.round(ft.getBoundingClientRect().top - last.getBoundingClientRect().bottom) + '/' + (pg.scrollHeight - pg.clientHeight); }));
    console.log(path.split('/').pop(), '(gap/overflow)', over.join(' ')); await p.pdf({ path, format: 'A4', printBackground: true, preferCSSPageSize: true });
    if (shot) await p.locator('.page').first().screenshot({ path: shot }); await p.close();
  }
  for (const t of T) { const pg = leaflet(t); pages.push(pg); await make(doc('The Motoring Central: ' + t.who.toLowerCase(), pg), out + '/The-Motoring-Central-Leaflet-' + t.file + '.pdf', process.argv[3] ? process.argv[3] + '/leaflet-' + t.key + '.png' : null); }
  await make(doc('The Motoring Central: leaflets', pages.join('')), out + '/The-Motoring-Central-Leaflets-All-Trades.pdf', null);
  if (process.argv[2] === 'links' && process.argv[3]) await make(doc('Sign-up and demo links', links() + demos()), process.argv[3] + '/Sign-up-and-demo-links-for-conversations.pdf', process.argv[3] + '/links.png');
  await b.close();
})();
