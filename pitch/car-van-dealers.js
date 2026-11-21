module.exports=function(K){const T=7,F='A proposal for car and van dealers · The Motoring Central',tag='For car and van dealers';
const URL='https://preview.motoringcentral.co.uk/#dealers';
const p1=`<section class="page"><div class="cover">
 <div class="brand"><div class="lg">${K.LOGO}</div><div><b>The Motoring Central</b><small>Buy. Fix. Clean. Rescue.</small></div></div>
 <p class="kick">A proposal for car and van dealers</p>
 <h1>Sell more cars and vans.<br><em>Keep every penny of the sale.</em></h1>
 <p class="lead">Advertise your stock to buyers who can trust what they see: every vehicle history checked, every advert checked by our team. One monthly fee by stock size. No commission, ever.</p></div>
 <div class="stats"><div class="stat"><b>0%</b><span>commission on your sales. The price you agree is the price you keep</span></div><div class="stat"><b>£169</b><span>+ VAT a month to start, by how many cars and vans you list</span></div><div class="stat"><b>100%</b><span>of vehicles history checked for finance, write-off and theft</span></div></div>
 <div class="two"><div><p class="kick">Who we are</p><h2>One place for everything a car needs</h2>
 <p>The Motoring Central is a new UK website where drivers buy, fix, clean and rescue their vehicles in one place: cars and vans for sale, MOTs, servicing and repairs, tyres, valeting, bodywork, recovery and electric car charging.</p>
 <p>That matters to a dealer. The driver who books an MOT or a service with us today is the buyer looking for their next car tomorrow, and they are already on our site.</p></div>
 <div><p class="kick">Our vision</p><h2>Fair for buyers. Fair for the trade.</h2>
 <p>Buying a used car should not be guesswork, and good independent dealers deserve a fair way to reach buyers without paying a slice of every sale.</p>
 <p>So we built a marketplace where buyers see checked, honest adverts, and where dealers pay one clear monthly fee and keep the whole sale. We want to be the UK's network of trusted, independent motor traders.</p></div></div>
 <div class="card sky" style="margin-top:5mm"><h3>Why we are talking to you</h3><p>We are signing up our founding dealers now, area by area. We would like your stock to be among the first that local buyers see, with your own showroom page, your name and your phone number on every advert.</p></div>
 ${K.foot(F,1,T)}</section>`;
const li=a=>'<ul class="tick" style="margin:1.5mm 0 0;font-size:9.5pt">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
const p2=`<section class="page t2">${K.head(tag)}
 <p class="kick">What we offer</p><h2>Everything you get as a dealer</h2>
 <div class="two" style="margin-bottom:4mm">
 <div class="card"><h3>Listing a car takes minutes</h3>${li(['Type the registration and the vehicle details fill in for you','Our free writer drafts the description for you to edit','Up to 30 photos and a video tour on every advert','Upload your whole stock from a spreadsheet or a stock feed','Keep stock in your stock book and advertise it when it is ready'])}</div>
 <div class="card"><h3>Adverts buyers can trust</h3>${li(['Every vehicle is history checked when you publish it: outstanding finance, insurance write-off and stolen records','Any write-off category is shown clearly on the advert','Our team checks every advert before it goes live','Full MOT history and road tax shown to buyers','Buyers can book one of our mobile mechanics to inspect the car'])}</div>
 <div class="card"><h3>Enquiries come straight to you</h3>${li(['Buyers phone you or message you through the site','Viewing and test drive requests, confirmed in one tap','Part exchange details sent with the enquiry','All your conversations in one Messages panel, grouped by buyer, with the car each one is about','An email each time a buyer gets in touch'])}</div>
 <div class="card"><h3>Your own showroom and marketing</h3>${li(['Your own showroom page with all your stock, to share on Facebook and WhatsApp','One line of code puts your stock on your own website','Premium ads put your best cars on our front-page banner','Printable windscreen cards with your logo, the price and a QR code that opens the advert','Reviews from real buyers on your profile'])}</div>
 <div class="card"><h3>See what is working</h3>${li(['Views, saves and enquiries for every car','How many days each car has been listed','Price tips against similar cars on the site','"Price reduced" shown to buyers when you drop a price'])}</div>
 <div class="card"><h3>Tools for running your stock</h3>${li(['Stock book: purchase cost, preparation costs, location and profit on each vehicle','Mark as sold and see your profit for the month','Pre-delivery inspection (PDI) forms on your phone','Trade to trade: offer stock to other dealers on the network','Motor trade jobs board for your vacancies'])}</div></div>
 <div class="card navy"><h3>And we never take commission</h3><p>Any sale is between you and the buyer. You agree the price, you take the payment, you keep all of it. Your monthly plan is the only thing you pay us for advertising your stock.</p></div>
 ${K.foot(F,2,T)}</section>`;
const p3=`<section class="page">${K.head(tag)}
 <p class="kick">Plans and prices</p><h2>One monthly fee, by the size of your stock</h2>
 <p>Choose the plan that fits the number of cars and vans you advertise. Every plan includes the full set of dealer tools, your showroom page, photos on every advert and enquiries sent straight to you. All prices are plus VAT.</p>
 <table><tr><th>Plan</th><th>Cars and vans advertised</th><th class="n">History checks included a month</th><th class="n">Premium ads included a month</th><th class="n">Price a month</th></tr>
 <tr><td><b>Starter</b></td><td>Up to 10</td><td class="n">5</td><td class="n">0</td><td class="n"><b>£169</b> + VAT</td></tr>
 <tr><td><b>Standard</b></td><td>Up to 20</td><td class="n">10</td><td class="n">1</td><td class="n"><b>£229</b> + VAT</td></tr>
 <tr class="hl"><td><b>Plus</b></td><td>Up to 30</td><td class="n">15</td><td class="n">3</td><td class="n"><b>£299</b> + VAT</td></tr>
 <tr><td><b>Pro</b></td><td>Up to 50</td><td class="n">25</td><td class="n">4</td><td class="n"><b>£379</b> + VAT</td></tr>
 <tr><td><b>Premier</b></td><td>No limit</td><td class="n">25</td><td class="n">5</td><td class="n"><b>£449</b> + VAT</td></tr></table>
 <p class="note" style="margin-bottom:5mm">Plans are billed monthly. There is no long contract: you can cancel at the end of any month. Plus is our most popular plan.</p>
 <div class="two" style="margin-bottom:5mm"><div><h3>Extras, only if you use them</h3>
 <table><tr><th>Extra</th><th class="n">Price</th></tr>
 <tr><td>Extra premium ad on the front-page banner, for 2 weeks or until the car sells</td><td class="n">£9.99 + VAT</td></tr>
 <tr><td>Extra vehicle history check, beyond those in your plan</td><td class="n">£3.50 + VAT</td></tr>
 <tr><td>Registration look-up to fill in an advert (or type the details in for free)</td><td class="n">10p + VAT</td></tr>
 <tr><td>Trade to trade listing</td><td class="n">£9.99 + VAT</td></tr>
 <tr><td>Commission on a sale</td><td class="n">£0</td></tr></table></div>
 <div><h3>What is a premium ad?</h3><p>Your car or van appears in the revolving banner on the front page of the site, the first thing every visitor sees. Each premium ad runs for 2 weeks or until the vehicle sells, whichever comes first. The premium ads included in your plan are renewed every month.</p>
 <h3 style="margin-top:3mm">What is the history check?</h3><p>When you publish a vehicle we check it for outstanding finance, insurance write-off and stolen records. A clean result is a selling point on your advert. Stolen, scrapped and Category A or B vehicles cannot be listed.</p></div></div>
 <div class="card yel"><h3>What it means per car</h3><p>On the Plus plan, 30 vehicles advertised for £299 + VAT works out at under £10 + VAT a vehicle a month, with 15 history checks and three front-page premium ads included each month, and nothing more to pay when a car sells.</p></div>
 ${K.foot(F,3,T)}</section>`;
const pS=`<section class="page see">${K.head(tag)}
 <p class="kick">See it</p><h2>Your stock book: every vehicle, its cost and its profit</h2>
 <p>Stock management is included in every plan. Keep every vehicle you own in one place, whether it is being prepared, on the forecourt, reserved, on trade or sold, and advertise it when you are ready.</p>
 ${K.shot('stock-c','The stock book on our preview site, with a sample dealer\'s vehicles and figures.')}
 <div class="two"><div class="card"><h3>What you are looking at</h3>${K.tick(['Vehicles in stock, stock value at cost and forecast profit','Average days in stock, with a warning on aged vehicles','Sold this month, sales and gross profit','Each vehicle with its price, profit, days in stock and where it is','Filters for in preparation, for sale, reserved, on trade and sold'])}</div>
 <div class="card"><h3>What you can do from it</h3>${K.tick(['Add a vehicle with its purchase cost and preparation costs','Advertise it on the site in one tap, when it is ready','Move a vehicle to trade and back to retail','Start a pre-delivery inspection (PDI) on your phone','Mark it sold and record the sale price and date'])}</div></div>
 ${K.foot(F,4,T)}</section>`;
const pG=K.protect(tag,F,5,T,K.PDI);
const pP=K.platform(tag,F,6,T,{loop:'The driver who books an MOT or a service with us today is looking for their next car tomorrow. The garages, valeters and recovery firms on the network are your suppliers, and your buyers are their next customers. The more of the trade that joins, the more work there is for each member.',trade:'Dealers get 5 free trade listings a month, then £9.99 + VAT each.',pay:'Once they are set up, we pay out every week to every partner we take payment for. Your car sales never pass through us: the buyer pays you directly.'});
const p4=`<section class="page t3">${K.head(tag)}
 <p class="kick">How it works</p><h2>From joining to the sale, step by step</h2>
 <div class="steps" style="margin-bottom:5mm">
 <div class="step"><p><b>Join online in about 5 minutes.</b> Enter your dealership details, choose your plan, and upload your trade insurance, public liability insurance and a photo ID.</p></div>
 <div class="step"><p><b>We check your documents,</b> usually within 2 working days, and email you as soon as you are approved.</p></div>
 <div class="step"><p><b>List your stock.</b> Type a registration and the details fill in, or upload a spreadsheet of your whole stock. Add photos, a video and your price.</p></div>
 <div class="step"><p><b>Each vehicle is history checked and each advert is checked by our team.</b> It usually goes live within a few hours, and we email you when it does.</p></div>
 <div class="step"><p><b>Buyers find your cars.</b> They search in their own words ("automatic under £20,000"), filter by make, price and mileage, and see your advert with its history check, MOT history and your reviews.</p></div>
 <div class="step"><p><b>They get in touch with you directly</b> by phone or message, and ask for a viewing or a test drive. You confirm it in one tap.</p></div>
 <div class="step"><p><b>You sell the car.</b> The sale is between you and the buyer. Mark it as sold and the advert comes down. We take no commission.</p></div>
 <div class="step"><p><b>You see what is working.</b> Your dashboard shows views, saves and enquiries for every car, so you know where to adjust a price or add photos.</p></div></div>
 <div class="two"><div><p class="kick">What you need to join</p><ul class="tick"><li>Your dealership name, address and phone number</li><li>Your trade insurance certificate</li><li>Your public liability insurance certificate</li><li>A photo ID: passport, UK driving licence or national ID card</li><li>About 5 minutes</li></ul></div>
 <div class="qa"><p class="kick">Common questions</p>
 <b>Do you take a cut when I sell?</b><p>No. Never. You pay your monthly plan and nothing on the sale.</p>
 <b>Can I advertise vans as well as cars?</b><p>Yes. Cars and vans both count towards the same plan.</p>
 <b>Am I tied in?</b><p>No. Plans run month to month and you can cancel at the end of any month.</p>
 <b>Can I move plan as my stock changes?</b><p>Yes. Move up or down to match the stock you hold.</p></div></div>
 <div class="contact"><div><h2>Join the dealer network</h2><p>Scan the code or go to <b>preview.motoringcentral.co.uk</b> and choose For partners, then Car or van dealer.</p>
 <p>Call <b>020 8191 4290</b> &nbsp;·&nbsp; Monday to Friday 8am to 6pm, Saturday 9am to 1pm</p><p>Email <b>partners@motoringcentral.co.uk</b></p></div><div class="qr">${K.qr(URL)}</div></div>
 <div class="sign"><div>Your contact at The Motoring Central</div><div>Date</div></div>
 ${K.foot('Prices and terms are correct at 21 November 2026 and may change. All dealer prices are plus VAT.',7,T)}</section>`;
return K.doc('The Motoring Central: for car and van dealers',[p1,p2,p3,pS,pG,pP,p4])};
