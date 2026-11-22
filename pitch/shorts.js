/* Short upright advert videos (about 20 seconds, 1080 x 1920) for recruiting partners. NOT to be used until the company is
   registered. Two steps:
     node shorts.js DIR          draws, for each trade, DIR/<trade>/o0.png o1.png o2.png (the three screens, see-through where
                                 the photo goes), photo.png and script.json (the three lines the voice says)
     python shorts.py DIR OUT    voices each line and makes OUT/<trade>-short.mp4 (run with the voice tools, see tools/video)
   The trade wording comes from adverts.js so the pictures and the videos always say the same thing. */
const fs = require('fs'); const { chromium } = require('playwright'); const A = require('./adverts.js'); const B = require('./build.js');
const JOIN = ' Join in five minutes, at motoring central dot co dot uk.';
const first = who => 'The first ten ' + who + ' we approve get first place in local results for three months.' + JOIN;
const SAY = {
  mot: ["MOT test stations. Fill your MOT bays. It's free to join.", "Drivers book and pay online, even when you're closed. You get forty-nine pounds eighty-five for every car MOT, with no commission, and no monthly fee.", first('stations')],
  valet: ['Valeters. A full diary of valets, paid up front.', 'Customers book and pay online. You set your prices, your days, and your area. One flat fee of ten percent plus VAT, and nothing monthly.', first('valeters')],
  instructor: ['Driving instructors. Every lesson, paid up front.', 'Learners pick a free time in your diary, and pay online. You set your hourly rate, and late cancellations and no-shows are still paid.', first('instructors')],
  body: ['Body shops and wheel refurbishers. More repairs, and no chasing.', "Quote from the customer's photos, and get paid when they accept. One flat fee of ten percent plus VAT, and nothing monthly.", first('repairers')],
  autoelec: ['Auto electricians and locksmiths. More jobs, paid up front.', 'The customer describes the job, you quote, and they pay. No paying for leads. One flat fee of ten percent plus VAT.', first('businesses')],
  dealer: ['Car and van dealers. Sell more stock, with thirty days free.', 'Your cars in front of local buyers, with the tools to run your forecourt. No commission on the cars you sell. From one hundred and sixty-nine pounds plus VAT a month, after your trial.', 'The first thirty dealers on a yearly plan pay for eight months, and get twelve.' + JOIN],
  recovery: ['Recovery companies. More jobs, paid before you set off.', 'Breakdown and transport jobs, sent straight to your drivers. Your trucks, your prices. One flat fee of ten percent plus VAT.', first('recovery companies')],
  evcharge: ['Mobile EV charging companies. Get paid to rescue stranded electric cars.', 'Out-of-charge rescues and booked top-ups, sent straight to your vans. Your call-out, and your price per mile. One flat fee of ten percent plus VAT.', first('charging companies')] };
const CSS = A.BASE + A.ST + `html,body,.ad{background:transparent}
.top{position:absolute;left:0;top:0;width:1080px;height:392px;background:#0B1C35}.bot{position:absolute;left:0;top:931px;width:1080px;bottom:0;background:#0B1C35}
.ph{background:none}.sw{margin-top:30px}.line{font-size:42px;margin-top:0}ul{margin-top:0}li{font-size:39px;padding-left:60px;margin-bottom:20px}li:before{top:11px;width:28px;height:14px}
.pill{font-size:31px;padding:19px 32px;margin-top:0}.join{font-size:40px;color:#D5DEEA;margin-top:34px}.url{font-size:50px;margin-top:10px;font-weight:800}.url span{color:#38BDF8}`;
const brand = `<div class="br"><div class="lg">${B.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div>`;
function screen(t, n) {
  const sw = n === 0 ? `<div class="line">${t.line}</div>` : n === 1 ? `<ul>${t.ticks.map(x => '<li>' + x + '</li>').join('')}</ul>`
    : `<div class="pill">${t.pill}</div><div class="join">Join in about five minutes</div><div class="url">motoringcentral<span>.co.uk</span></div>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="ad"><div class="top"></div><div class="bot"></div><div class="ph"></div>${brand}
 <div class="tx"><div class="kick">${t.who}</div><h1${t.sm ? ' class="sm"' : ''}>${t.h}</h1><div class="sw">${sw}</div></div></div></body></html>`;
}
(async () => {
  const dir = process.argv[2]; if (!dir) throw new Error('give a folder'); const b = await chromium.launch();
  for (const t of A.T) {
    const d = dir + '/' + t.key; fs.mkdirSync(d, { recursive: true });
    for (let n = 0; n < 3; n++) {
      const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 }); await p.setContent(screen(t, n), { waitUntil: 'load' }); await p.waitForTimeout(250);
      const end = await p.evaluate(() => Math.round(document.querySelector('.tx').getBoundingClientRect().bottom)); if (end > 1580) console.log('TOO LOW', t.key, n, end);
      await p.screenshot({ path: d + '/o' + n + '.png', omitBackground: true }); await p.close();
    }
    // the photo, cut to the advert's crop at twice the size so the slow zoom stays sharp
    const [x0, y0, x1, y1] = t.box; const p = await b.newPage({ viewport: { width: 2160, height: 1080 }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;overflow:hidden"><img id="i" src="${A.uri(t)}" style="position:absolute;transform-origin:0 0"></body>`, { waitUntil: 'load' });
    await p.evaluate(([x0, y0, x1]) => { const i = document.getElementById('i'), s = 2160 / (x1 - x0); i.style.transform = `translate(${-x0 * s}px,${-y0 * s}px) scale(${s})`; }, [x0, y0, x1]);
    await p.waitForTimeout(200); await p.screenshot({ path: d + '/photo.png' }); await p.close();
    fs.writeFileSync(d + '/script.json', JSON.stringify(SAY[t.key].map(s => ({ say: s, cap: s })), null, 1)); console.log(t.key, 'drawn');
  }
  await b.close();
})();
