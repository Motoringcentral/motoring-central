# The Motoring Central: what is left to do

This is the running list of work still to do before launch. When the owner asks
"what is left to do?", answer from this file, and tick items off here as they are finished.

## COMPANY REGISTERED (27 Nov 2026)
THE MOTORING CENTRAL LTD, company number 17606100, private company limited by shares, incorporated 27 Nov 2026
(certificate emailed by Companies House to the vimen@ mailbox). Companies House email reminders are on, and the
registered email address is set. HMRC writes separately about Corporation Tax (the UTR comes by post). The
authentication code for WebFiling is posted to the registered office. Next for the site: the owner enters the name,
number and registered office in Staff page > Team and settings > Company details (the registered office is not in the
emails; it is on the Companies House record). Business bank account: not opened yet (27 Nov); Stripe follows it.

## BUSINESS ACCOUNTS (built 27 Nov 2026, tested on the database; card payments wait for Stripe)
Owner's decision: business accounts pay with a PREPAID BALANCE or a CARD ON FILE. No credit line for now (later, once
there is cash in reserve: approved firms only, credit check, limit, 14 days). Every business job is paid before the
partner is paid in the weekly payout.
- Page: business.html (linked from the site footer "Business accounts" and Staff > Money > Business accounts).
  Separate page on purpose: smaller, its own security headers (vercel.json) and no shared code with the big page.
- Services on the account: full valets, alloy wheel repairs, MOTs. (Recovery, EV charging, bodywork quotes, auto
  electrician and locksmith jobs are not on business accounts yet.)
- How the money works: top up by bank transfer with a unique reference (TMC-XXXXXXXX). An OWNER confirms the money
  arrived on the staff part of the page and it is added. A booking SETS ASIDE the price at once, it is TAKEN when the
  partner marks the job done and GIVEN BACK if cancelled (free cancellation up to the day before). Card on file: charged
  when the booking is made, refunded automatically if the booking cannot be made.
- Team: owner / admin / booker / viewer roles, a monthly limit per person, "bookers need approval over £X", a monthly
  cap for the whole account, fleet list (only listed vehicles can be booked, on by default), services allowed.
- Repeat valets: weekly, every 2 or 4 weeks, several vans in one visit, booked automatically at 06:15 for 7 days ahead
  from the balance (cron business-repeat-valets). If money is short or the valeter is closed, the admins are emailed.
- Security built in: every business table is locked (row level security on, no direct access: everything goes
  through checked functions); prices worked out on the server from the partner's own rates; one booking per tap
  (idempotency key) and the account row is locked while money moves; the money record (business_ledger) can only be
  added to, each line carries a hash of the one before, and "Check every money record" on the staff page proves
  nothing was changed; invitation links work once, only for the email they were sent to, and run out after 7 days
  (the token is stored hashed); admins cannot change owners or admins; the last owner cannot leave; nobody approves
  their own booking (except an owner); a pause button for admins (only an owner restarts); automatic pause and an email
  to the owners if one person makes 15 bookings in an hour or the account 60 in a day; owners and admins are emailed
  when someone joins, a role changes, the billing email or the card changes, a top up lands, bookings are paused or
  the balance is low; activity log of everything; only an owner on our side (with the second login step) can add
  money or adjust a balance, always with a reason; the page logs out after an hour without activity.
- Tested 27 Nov on the live database inside transactions that were rolled back (nothing left behind): roles,
  invitations (wrong person, used twice), outsiders, direct table access, the money (holds, double taps, not enough
  balance, approval, cancel, partner marks done, monthly and personal limits), MOT through the account (slot taken,
  class not tested), repeat valets (booked once, not twice), the automatic pause, the ledger lock and a forged line
  being caught. Every screen of business.html drawn on a computer and a phone with no errors.
- Migrations: 20261127d (tables and ledger), 20261127e (pricing and booking), 20261127f (functions), 20261127g
  (business emails), 20261127h (fixes). Server function: business-pay (Stripe, switched off until the keys are set).

STILL TO DO for business accounts:
- Bank details: once the business bank account is open, put them in Supabase > app_settings, key "business":
  "bank": {"name": "The Motoring Central Ltd", "sort_code": "..", "account_no": ".."}. Until then the page tells
  businesses NOT to pay yet.
- Stripe (with the rest of Stripe): set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Supabase > Edge Functions >
  Secrets, and add the webhook https://hctboldpuyztugpwexdy.supabase.co/functions/v1/business-pay?hook=1 for
  checkout.session.completed and payment_intent.succeeded. Then test a card top up, adding a card and a card booking
  with Stripe test cards before going live. Card refunds after a cancellation are still "Mark refunded" by hand.
- ASK THE SOLICITOR AND ACCOUNTANT before taking real top ups: (1) holding customers' money in a prepaid balance that
  is then paid on to partners may count as e-money or a payment service; check whether the "commercial agent" or
  "limited network" exclusions cover us, or whether the money must be kept in a separate client account; (2) the
  business account terms (top ups, what happens to an unused balance and how it is paid back, cancellations, closing an
  account); (3) VAT on top ups (normally VAT is due on each job, not on the top up) and the wording on statements.
- Supabase > Authentication > URL configuration: add https://preview.motoringcentral.co.uk/business.html and
  https://motoringcentral.co.uk/business.html to the redirect URLs, so the "confirm your email" link brings a new
  business user back to the business page.
- Decide: the booking fee for business jobs (now the same £9.99 as everyone; change "fee" in app_settings
  "business"), and whether to add a multi-van discount.
- Later: recovery and EV charging on the account, a VAT invoice per job once VAT registered, a business accounts
  section in the FAQ, and a short video for the business page.

## COMPANY REGISTRATION FILED (27 Nov 2026)
The owner filed the company with Companies House online on 27 Nov 2026 (private company limited by shares; SIC codes
63120 Web portals, 82990 Other business support service activities, and 73110 or 73120 for advertising). Waiting for
the certificate of incorporation (usually within 24 hours, by email). When it arrives, the owner sends Claude the exact
company name, company number and registered office address (all public on Companies House), and Claude puts them on
the site: footer, terms ([The Motoring Central Ltd] and other brackets), privacy policy, invoices and emails.
Then, in order: business bank account; Stripe in the company name; ICO registration; send the two briefs to the
solicitor and accountant; HMRC (Corporation Tax; VAT decision from the accountant); Vehicle Data Global contract;
Supabase Pro; point motoringcentral.co.uk at the site at launch.

## NAVIGATION REVIEW (27 Nov 2026)
Every page checked as a visitor on the live version (?live=1), on a phone and a computer: all 30 addresses open the
right page (jobs and breakdown cover go to the home page while hidden; My account and the dashboard ask to log in),
nothing is wider than a phone screen, no errors, and every link goes where it says. Fixed:
- The phone's Back button: after choosing a service (the booking form opens further down the home page) or opening a
  car or van advert, Back now stays on the site (back to where you were, or back to the results) instead of leaving
  it. window.MCback in index.html.
- "Choose how you join" on Join the network scrolled nowhere and went to the home page: it now scrolls to the trades.
- One footer: each page's short footer now keeps only its own note (for example "Earnings figures and timings are
  examples only"); the copyright, links and company line are once, in the site footer. Complaints added to it, and
  "Buy and cover" renamed "Cars, vans and more".
- Wording that promised services not open at launch: How it works (step 2 and 3), "Everything in one place" (home and
  About us) and the Join the network intro now name the launch services and say mechanics and tyres are coming soon.
Left as it is (owner's choice): the quick tour video opens by itself once for a first-time visitor, about 2 seconds
after the cookie choice, on the customer pages.

## RAC BREAKDOWN COVER (affiliate, set up 27 Nov 2026)
- The owner has an Awin publisher account ("content creator"): main site motoringcentral.co.uk, sectors Automotive and
  Insurance, promotion types Content, Content Creators & Influencers (main) and Editorial Content. No email promotion
  (the RAC bans emailing its offers without written consent). Still for the owner: VAT status (not registered), the
  registered office as the address, and the company bank details once the account is open.
- RAC only: the owner works for the RAC and will not promote the AA. Conflict of interest approved by the manager.
- Rates (Awin, 27 Nov): UK cover £5 to £20 a new policy by price; European cover 10%; 30-day cookie; new customers
  only, nothing on renewals or 14-day cancellations; paid about 88 days after the sale. Rules: no bidding on RAC
  brand terms; do not change RAC-supplied content; no emailing links without consent.
- The breakdown cover page is rebuilt for this: plain links to the RAC (UK and European), "We don't give advice",
  the commission notice, no picker, no table, no prices in our words, none of our phone numbers, no recovery promo.
  FAQ, privacy policy and cookie notice explain the Awin links. Hidden on the live site until the tracking links are set.
- Join the RAC programmes on Awin once motoringcentral.co.uk shows the site and the bank details are in. When the RAC
  approves: the owner makes the tracking links in Awin (Link builder: https://www.rac.co.uk/breakdown-cover and
  https://www.rac.co.uk/breakdown-cover/european-breakdown-cover) and, if wanted, picks an RAC banner; Claude puts them
  in window.MC_RAC at the top of index.html, and the page appears on the live site by itself.

## LAUNCH DAY IS READY (27 Nov 2026)
1. Company details in one place. The owner fills them in once: Staff page > Team and settings > Company details
   (name, number, registered office, address for letters if different, ICO number, VAT number). They are saved in the
   database (app_settings "company", only an owner can change them, the format is checked) and then show by themselves
   in every footer, the terms, privacy policy, About us, Contact us, complaints, self-billing invoices and the foot of
   every email. Tested 27 Nov (pages, invoice wording, a test email; a reviewer is refused). Still to do by hand at
   launch: add the same company line to the four Supabase log-in email templates (Authentication > Emails).
2. The launch switch. The main address IS the switch: motoringcentral.co.uk (and www) shows the live site, every
   other address shows the preview. On the live site the preview banner, sample cars, vans, partners, reviews and
   vacancies, the made-up "partners near you" count, demo log-ins (refused), draft notes and the "4.8 out of 5"
   go; Google may list it (vercel.json sends the no-Google header and robots-preview.txt only on other addresses).
   Staff see the live version on the preview with ?live=1 (?live=0 to go back). Tested 27 Nov page by page and for
   MOT, valet, recovery, EV charging, bodywork and auto electrician (only real partners listed).
   Hidden on the live site until ready: the jobs board (it still saves to the old preview store, so adverts and
   applications go nowhere: needs building on the database, with Stripe for the £9.99 advert) and the RAC breakdown
   cover page (needs an agreement with the RAC). Card payments: the live site shows "Card payments are not switched
   on yet" instead of the practice card form until Stripe is connected (window.MC_PAY_ON). STRIPE IS NEEDED BEFORE
   LAUNCH. The owner's "Launch check" card (Team and settings) shows what is ready.
   On launch day also: Supabase Site URL and app_settings site_url to https://motoringcentral.co.uk; check
   https://motoringcentral.co.uk/robots.txt says "Allow" and the page has no X-Robots-Tag header.
3. Test data clean-up: private.test_cleanup (migration 20261127c), prepared and dry-run, NOT run. It counts first,
   removes only when told to, refuses to remove an owner, lists the stored files to delete in Supabase > Storage,
   and restarts reference numbers once tables are empty. The list of test accounts is kept privately by Claude (not
   in this public repository). Owner to confirm first: the Sky test customer, and "VIMS CARS" on hello@ (dealer)
   and social@ (recovery, nationwide) are test accounts.
Also fixed 27 Nov: the About us call-back form now really reaches staff (it went to the old preview store): it asks
for an email address and is saved and emailed like the contact form. The join forms no longer say uploads are
"for the preview only" (they are stored), and the dealer listing note no longer says listings vanish.

## Emails are ON (set up and tested 21 Nov 2026)

How it is set up (do not redo):
- Google Workspace Business Starter: mailbox vimen@motoringcentral.co.uk, with free aliases support, bookings, hello,
  privacy, info, partners, noreply and accounts. DNS at 123-reg: Google MX, SPF, DMARC (p=none, reports to vimen@)
  and DKIM (google._domainkey) are all in place.
- Resend: domain mail.motoringcentral.co.uk (Ireland), verified. The site's emails come from
  bookings@mail.motoringcentral.co.uk (Supabase secret NOTIFY_FROM) and login emails from
  noreply@mail.motoringcentral.co.uk (Supabase custom SMTP, smtp.resend.com). Replies go to support@motoringcentral.co.uk.
- Supabase: RESEND_API_KEY and NOTIFY_FROM secrets set, custom SMTP on, the four email templates pasted, Site URL
  https://preview.motoringcentral.co.uk, redirect URLs for preview, motoringcentral.co.uk and www, "Confirm email" on.
- Tested and passed: forgotten password, customer sign-up, partner application and approval, dealer adverts approved
  and declined, buyer message and viewing, quote.

Follow-ups from the testing:
- Google Admin > Apps > Gmail > Authenticate email: check it says "Authenticating email with DKIM". If not, press
  "Start authentication" again (the DNS record is correct).
- Decide: history checks free during a dealer's free months, or keep £3.50 + VAT each (as the terms say now).
- Phone 020 8191 4290 (virtual number, diverts to the owner's mobile) is on the site for calls. Opening hours agreed
  21 Nov: Mon to Fri 8am to 6pm, Sat 9am to 1pm.
- DONE 27 Nov: the company mobile 07364 144974 has WhatsApp Business. It is on the site (Contact us, About us,
  complaints, the "Who you will work with" note for partners) as the mobile and the WhatsApp number
  (wa.me/447364144974), on the four partner proposals, the eight leaflets, the Facebook set-up notes and the
  recruitment guide's email signature. The 020 number stays as the main number for calls.
- At launch: change the Supabase Site URL to https://motoringcentral.co.uk, and forward motoringcentral.com to it.
Test accounts (real accounts, kept for testing until launch, then remove with their bookings):
- Owner and staff log-in (Staff page, /#staff): the owner's Gmail address.
- Test dealer "VIMS CARS": hello@motoringcentral.co.uk (Partner log in). Test customer: the owner's Sky address.
- Made by Claude for the end-to-end tests on 21 Nov (all arrive in the vimen@ mailbox; the owner has the password):
  vimen+customer@ (customer "Test Customer"), vimen+dealer@ (dealer "TEST Dealer Dartford", in its free months),
  vimen+recovery@ ("TEST Recovery Dartford"), vimen+ev@ ("TEST EV
  Charging Dartford"), vimen+mot@ ("TEST MOT Station Dartford", using the real DVSA number 11423 of a Dartford
  station, so remove it before any real MOT station there joins).
- The demo log-ins on the site are pretend accounts kept in the browser. They cannot send real messages or emails
  and they do not see real applications or adverts.

TWO-STEP SIGN-UP (22 Nov 2026, RECOVERY ONLY so far; tested end to end on preview)
- Owner's idea: keep how the trade side works away from customers. The public join page is now a short pitch (six
  points, the fee, "Apply to join") with Step 1: email and password only. Step 2, signed in: the video (tap to play) and
  the application form. The dealer page still has its video in public.
- Database: partner status 'started' (registered, not applied). submit_application() moves it to 'pending'.
  Emails: welcome on registering (+ note to owners), "application received" (+ owners) when sent, ONE reminder after
  24 hours (cron started-reminders, 10:10 daily). Staff page tab "Started, not finished" lists the leads.
- Supabase "Confirm email" is ON, so after Step 1 they must tap the link in the email, then they land on their
  application. A 'started' account that opens the dashboard is sent back to the application.
- REFERENCE PAGE (owner, 22 Nov): the recovery join page is the model for the others. Three things only: the bullet
  points in the header, then the account box ("Apply to join") and the calculator ("Where the money goes") side by
  side (stacked on a phone). No stats row, no second fee box. Headings inside .rjcol need the dark colour rule.
- DONE 22 Nov for EVERY partner type: module "Join pages for every partner type" (config list C: bullet points, role,
  form ids, which heading is the calculator). It rebuilds each page when it loads; the old public sections are kept in
  the page inside a hidden .rj-old box. Recovery is still written out by hand. window.MCjoinHash(u) is the page a
  'started' account is sent to (mechanics remember which page they joined from in details.joinPage).
  Tested step 1 and step 2: valeting (full application sent), MOT station, dealer. Looked at: body, EV, auto electrician.
  NOT seen live: mobile mechanic, garage, tyres (closed for launch by RECRUIT; their pages redirect to Opening soon).
- Videos: no video on any public join page now. Dealer video and MOT video are in step 2, tap to play. The EV video is
  switched OFF everywhere (it still gives the old 5% / Pro fees): re-voice that line, then add video:'...' to its config.
- Test accounts made: vimen+twovalet@ (pending), vimen+twomot@ and vimen+twodealer@ (started). Delete before launch.
- Test account: vimen+rectwo1@ (TEST Two Step Recovery, pending). Delete before launch.
- BUG FIXED on the way: the join forms for ALL partner types had stopped splitting into 4 steps since the "Your plan"
  box was renamed "Our fee" that morning. Fixed and checked on all seven forms.

TRUCK PAYLOAD AND VEHICLE WEIGHT (22 Nov 2026, tested on preview)
- Every truck has "Max payload (kg)" (starting figures: beavertail 1300, spectacle 2000, 7.5t 3000, trailer 2000,
  heavy 18000, transporter 1700, bike 400; the partner can change them). Only trucks that can carry the vehicle's weight
  plus 10% are quoted. The customer sees the weight used; the job card shows it.
- Weight comes from the registration (Vehicle Data Global, kept in table vehicle_specs so each reg is paid for once) or,
  with no record, a typical weight for the type (car 1500, small van 1700, large van 2300, 4x4 2200, bike 250, big 5000).
- OWNER ACTION: real weights are NOT on yet. The look-up key is only in Vercel. Add it in Supabase > Edge Functions >
  Secrets as VDG_API_KEY (the same key). Until then every weight is the typical one. After adding it, test with a real
  registration and check the row in vehicle_specs ("found" shows which fields were read).
- Note: with the typical car weight (1500 kg + 10%), a beavertail left at 1300 kg is not offered for cars.

RECOVERY VIDEO (22 Nov 2026): video/recovery.mp4 (2 min 27, captions recovery.vtt) replaces the banner on the recovery
sign-up page; it opens on the banner. Same voice (Kokoro bf_emma). Plays when the page opens (muted with a "Tap for
sound" button if the browser blocks sound, like the dealer video). Sources in tools/video/recovery (README there).
- Owner heard stray sounds ("trucks-er", "what is it-e"): FIXED 22 Nov by voicing each line in one go and checking every
  line with speech recognition (tools/video/recovery/check-voice.py). Now 2 min 27. The other videos were made the old
  way (sentence by sentence) and have NOT been checked with the tool yet.
- Sound (dealer and recovery videos): browsers block sound until the visitor touches the page, and no site can
  override that. The video tries with sound; if refused it plays silently with a big "Tap anywhere for sound" button, and
  the FIRST tap, click or key press anywhere (the cookie banner counts) switches sound on and restarts it.
- OUT OF DATE: the EV charging video still says "less 5% plus VAT during our launch. Or go Pro" (now flat 10% + VAT,
  no Pro). That line needs re-voicing. The intro, dealer and MOT videos do not mention the old fees.

MAPS (22 Nov 2026, tested on preview)
- Recovery and EV forms: a map appears under "Where is the vehicle?" after a postcode is typed, after Use my location,
  and after prices are shown (A = vehicle, B = drop-off). The customer can DRAG pin A to the exact spot; that pin then
  replaces the postcode and is what the partner gets. Partner job cards show the same A / B map.
- Leaflet 1.9.4 is our own copy in vendor/leaflet. Map pictures come from OpenStreetMap's free tile server: fine for
  launch, NO guarantee of service and not meant for heavy use. If traffic grows, switch to a paid map provider
  (one line: the tileLayer URL in the "maps" module, window.MCmap). Privacy page section 4 mentions maps and postcodes.
- Not yet: live tracking of the truck, a map on the customer's booking in My account.

PARTNER DASHBOARD TABS (22 Nov 2026, ALL partner types; tested on preview)
- Every dashboard: header card, then tabs. Set-up is a menu of tiles; each opens its own page with "Back to set-up".
  Nothing but the header sits above the tabs. "Quick actions" is now "Tools and extras" on the Tools tab.
- Recovery / EV: Jobs, Money, Set-up (fleet or prices, opening hours, area, logo, self-billing, documents, details), Tools.
  ONE job list now (call-outs card, with Vehicle inspection and Message customer buttons); "Your booked jobs" is off
  for real recovery and EV accounts.
- Body, valet, tyres: Jobs (quote requests + booked jobs), Money, Set-up (prices, logo, self-billing, documents, details), Tools.
- Mechanics: Jobs, Diary, Money, Set-up (rates, services, logo, self-billing, documents, details), Tools.
  MOT test stations open on Diary first.
- Dealers: Stock, Adverts (stats, results, adverts), Messages, Sales (invoices), Set-up (plan and billing, logo,
  documents, details), Tools (showroom, spreadsheet upload, website embed, stock feed, PDI, trade, job adverts).
- Done / To do badges on fleet, hours and self-billing; the Set-up tab shows how many are still to do.
- Dealers: the Messages tab turns RED with the number of conversations waiting (window.MCmsgNew). The leads card is on
  the Messages tab too. A conversation only counts as read once it is open AND on screen (it used to be marked read as
  soon as it was drawn, even when hidden).
- How it works: module "partner dashboard tabs" (window.MCpt: cfg per role, tagOf gives each card a tab, big cards are
  split inside with data-pcs). Mechanics and dealers still draw from u.dtab; each tab asks for the dtab it needs.
  The old .dtabs bar and the tab / section quick tiles are gone.
- Tested with: recovery, EV, body, valet, auto electrician, MOT station, dealer. NOT tested (no test account): tyres,
  mobile mechanic, full garage, and the demo log-ins.

FEES CONFIRMED BY THE OWNER (22 Nov 2026, evening): every service is 10% + VAT. Two exceptions, both to stay as they are:
DEALERS (their own monthly plans) and MOT TESTS (official fee, we keep a flat 5 pounds, no booking fee on top). Claude
started moving MOT to 10% and was told NOT to: nothing was changed. Do not change MOT pricing without being asked.
Sweep done: no old fee wording left on the site. The recovery and EV proposal PDFs (pitch/roadside.js) no longer offer
"Pay as you go or Pro"; they show the one flat fee. VIDEOS are left for now: the owner will review them one by one at the
end (slides match the site, spelling, voice). The EV video still gives the old fees and is switched off.
TERMS BROUGHT UP TO DATE AND BRIEFS FOR THE ADVISERS (22 Nov 2026, late night):
- Terms: driving lessons moved out of the recovery section into their own section 8 (with who can book, blocks, moving
  and cancelling, lessons the instructor adds, reviews); the sections after it renumbered (buying 9, partner terms 10,
  dealer terms 11, trade 12, jobs 13, premium ads 14, complaints 15) and the cross-references fixed; who we list and
  what we check now includes MOT stations, EV charging and instructors; "Partners near you"; partner listing, area and
  availability; recovery payload and the kept call-out; dealer look-ups tidied (they are free); text messages put in
  [brackets] because they are not switched on. Privacy: learners aged 17, reviews shown with a first name, postcode
  look-ups for finding partners. Lesson bookings now have the same "who your booking is with" tick box as every other
  service. A scan of the whole page found no old fee wording.
- Three documents were made for the owner to send out (a brief for the solicitor with the full legal text as
  appendices, a brief for the accountant, and a declaration and proposal for the owner's employer). They are NOT in
  this repository, on purpose. To re-make them, ask Claude.
- BIGGEST OPEN QUESTION for both advisers: the terms say the customer's contract is with the partner and we only take
  payment for them, but the weekly "self-billing invoice" treats the partner as supplying their work to us. One of the
  two has to change once the accountant and solicitor have answered. Do not change either before then.
- Also waiting on advice: whether the 9.99 booking fee must be inside the headline price; the 14-day cancellation
  right against our cancellation rules and the no-refund rule for lesson blocks; learners under 18; whether holding
  partners' money needs a regulated provider; the breakdown cover page and the (switched-off) car finance example.

FULL TEST AND VIDEO REVIEW (owner asked, 22 Nov 2026, late night). What was run and what it found:
- Customer bookings run end to end and paid, with the money split checked in the database: recovery (job 96.00, partner
  84.48), EV charging (150.00, partner 132.00), MOT (54.85, station 49.85, no booking fee), valet (99.00, partner 87.12),
  alloy wheels (396.00 + 9.99), bodywork quote (180.00 quote, customer pays 189.99), driving lessons (earlier the same
  day). Every page loads with no errors. Partner price changes reach the customer at once.
- FIXED: alloy wheel bookings showed and charged the old 3.00 booking fee (the database already recorded 9.99).
- FIXED (the big one): approved MOT stations, valeters, body shops and auto electricians were offered to every customer
  in the country. Now matched by distance (database 20261122u, window.MCnear in the page): mobile work inside the
  partner's own travel distance, work at the partner's premises up to 25 miles, nearest first, with the miles shown.
  New Set-up page "Area you cover" / "Area and working days" for mechanic, valet, body and tyres partners (postcode,
  how far they travel, and for valet and body the days and hours they work, which now limit the days and times a
  customer can pick). A partner with no area is not offered and sees a "Customers cannot find you yet" banner. New
  applications are placed on the map automatically from their postcode. The four test partners have areas set.
- FIXED: some text boxes had no styling (landmark, destination and registration on the recovery and EV forms, the depot
  postcode). MOT-only stations no longer see a labour rate.
- NOT BUILT, for the owner to decide: (1) an approved partner cannot upload a renewed insurance certificate (the
  Documents page only lists them); (2) a valeter or body shop cannot change "mobile / premises / both" after signing
  up; (3) the sample (made-up) partners still show next to real ones until the pre-launch clean-up.
- Driving lessons banner: the owner's photo (img/driving-lessons.webp wide version for the home slideshow,
  img/driving-instructors-poster.webp the full picture). The photo said "TheMotoringCentral.co.uk" and had a QR code
  that did not scan: the copies used on the site and video say MotoringCentral.co.uk and carry a working QR code to
  the lessons page. The owner's original file is untouched (ask before using it anywhere as it is).
- VIDEOS: all six checked for screens, facts and voice. Sources and the method are in tools/video/README.md.
  * Intro tour: RE-MADE (showed the old site: car servicing, mechanics, tyres, the 3.00 fee; no driving lessons).
  * Dealer: RE-MADE (end slide said "3 months free"; promised MOT history and a mobile mechanic inspection).
  * MOT station: RE-MADE (a slide still said "You keep 82%, 44.98" while the voice said 49.85).
  * EV charging: RE-MADE and switched back on in step 2 of the EV join page (it had the old 5% / Pro fees).
  * Recovery: voice and facts fine; the fleet picture now shows the max payload box.
  * Instructors: opens on the owner's photo.
  Voice: every line checked with speech recognition; no stray sounds in any of the six.

ADMIN PAGE IN CATEGORIES (owner, 22 Nov 2026, night): "messy, each approval process in its own category, easy to train
someone new". Now: To do (front page with counts) / Partners (applications, approved, declined, started) / Adverts (to
approve, reported, Facebook feed) / Bookings (MOT, recovery and EV) / Payouts / Customers (messages and complaints,
customer list, review requests, hide a review) / Reports (views, partner reports, activity log) / Team and settings
(owners only: staff, sample cars switch). Every page has a "What to do here" line (HELP in GGadmin). The boxes other
code adds to the page are shown only on their own page by CSS (#admin-body[data-at]). Tested as the test reviewer;
the owner's view (Team and settings, approve buttons) was NOT seen: ask the owner to look.
ADDED the same night (database 20261122t; module STB in the page):
- Bookings > Driving lessons (coming up / done / cancelled / all; an owner can cancel a lesson for both sides: the learner
  gets the money or the hours back, the instructor is not paid, both are emailed) and Bookings > Valet, bodywork and
  others (read only: valets, alloys, bodywork quotes, auto electricians and locksmiths).
- Money > Refunds due: every booking of any kind with a refund owed, oldest first, with the customer's contact details
  and payment reference. An owner taps "Mark refunded" after refunding the card. Real refunds still need Stripe.
- Front page: "To do today" now has live numbers for messages and complaints waiting (and how many complaints are
  past their reply date) and refunds due; a second box "Look something up" for the booking pages and the customer list.
  The numbers come from staff_counts() once a minute.
- Tested as the test reviewer, and the owner-only buttons by switching the page to the owner's view in the test (the
  server allows any staff member). The real owner log-in was still not seen. Two test refunds (95.00) are left as due.
- Not there: cancelling a valet / bodywork / auto electrician booking from the admin page (only MOT, recovery, EV and
  lessons can be cancelled by staff).

DRIVING INSTRUCTORS AND DRIVING LESSONS (built 22 Nov 2026, evening; tested end to end on preview)
- Owner's brief: learners book single lessons, blocks or intensive courses; the instructor sets an hourly rate and block
  discounts; 10% + VAT from the instructor and NO booking fee for the learner; filters for manual / automatic and
  male / female / no preference; a live diary; availability and everything else set from the dashboard.
- Driving schools (added later the same evening): "Male / Female / Both: a driving school with male and female
  instructors" on the join form and in Set-up > About you. A "both" school shows in male and in female searches; the
  learner's choice is saved on the booking (details.want) and shown in the diary ("asked for a female instructor").
  Tested on preview.
- Checks (Claude's choice): ADI badge (green) or trainee licence (pink, shown as "Trainee instructor"), driving
  instructor insurance, photo ID. Staff should check the badge number on the DVSA register before approving.
- Instructor: join page #instructors (same two-step layout as the other trades), application, dashboard tabs Diary /
  Money / Set-up / Tools. Set-up: prices and packages (hourly rates, lesson lengths, block discounts, intensive courses),
  availability (weekly hours, gap between lessons, shortest notice), area, about you. Diary: next 4 weeks, lesson done,
  cancel, block out time, pause new bookings, learners with hours left.
- Learner: page #lessons (tile on the home page, link in the footer). Postcode, gearbox, instructor preference, what to
  book; each instructor's options with prices; pick a day and time from the live diary; pay. My account card "Your
  driving lessons": lessons coming up (cancel) and hours paid for (book next lesson).
- Money: a block or course is paid in full up front and held as hours (table lesson_packs). Each lesson is a bookings row
  worth its share of the block, so the instructor is paid per lesson booked (88%), in the normal weekly payouts.
- Cancelling: learner free up to 48 hours before (hours go back, or a single lesson's refund is "due" for staff to pay);
  later the instructor is still paid. Instructor cancels: learner loses nothing, instructor is not paid.
- Code: database 20261122o / 20261122p; page module "driving lessons" (DL = learner page, DLA = account card, INS =
  instructor card #mc-inst). Settings are in partners.details.inst and partners.rates {manual, auto}.
- Tested: sign-up, approval, all set-up pages, search (gender filter), single 57.00 (we keep 6.84), block of 10 hours
  361.00, intensive course listed, next lesson from the block, block-out, cancels from both sides, emails queued.
- SECOND PART (22 Nov 2026, late evening; owner's rules; database 20261122r and 20261122s; all tested on preview):
  * Moving: the instructor moves a lesson from the diary (day + time); the learner is emailed and can cancel free for
    48 hours after the change (single lesson refunded, block hours back to the block). The learner moves a lesson
    themselves from My account if it is more than 48 hours away; inside 48 hours it is a request and the instructor
    taps Accept or Decline in the diary.
  * Block and intensive hours are NEVER refunded as money (owner's decision): cancelled lessons go back to the hours.
    The terms keep the customer's legal rights and say we move the hours or refund if the instructor can no longer
    teach. WORTH A SOLICITOR'S LOOK before launch (14-day cooling-off for things bought online).
  * The instructor adds a lesson for one of their own learners: from paid hours (nothing to pay), or "learner pays":
    the learner is emailed, pays in My account within 24 hours (or 2 hours before the lesson), otherwise the time is
    released automatically (job "lesson-unpaid", every 20 minutes).
  * Reviews: after a lesson is marked done the learner rates the instructor in My account (one review per
    instructor). Stars, count and the latest comments show in the learner's search; the instructor sees them under
    the diary. Staff can hide a review with the existing reviews tool. "Lesson done" only shows from the lesson day.
  * "Driving lessons" in the home search box (and a quick button), plus "Teach driving? Join as an instructor".
  * Instructor video: video/instructors.mp4 (2 min 18), shown in step 2 of the instructor join page (tap to play).
    Sources in tools/video/instructors/.
  * Bug fixed: the dashboard's general settings sync could overwrite an instructor's prices/profile with an old copy.
- NOT done yet: buying an intensive course was not run in a test; a school still has one diary for all its
  instructors. Test accounts: vimen+twoinst@ (TEST Drive School Dartford) with test lessons, one block and one 5-star
  test review from the test customer. Delete before launch.

PARTNER FEES CHANGED (owner, 22 Nov 2026): the Pro membership and the 5% launch rate are GONE.
- Every partner job: flat 10% + VAT (we keep 12% of the partner's price). No monthly fee, no plans.
- Customer booking fee: 9.99 pounds including VAT (8.33 + 1.66 VAT) on every booking, replacing 3.00.
- Done everywhere: join pages (one "Simple pricing" card, calculators at 88% / 12%), sign-up forms, dashboards, terms,
  FAQ, banners, recovery and EV (roadside function v9), valet / alloys / quotes (migration 20261122l). Old bookings keep
  the fee they were made with.
- NOT changed: MOT tests (official fee, we keep 5 pounds, no booking fee on top) and dealer plans. Ask the owner if MOTs
  should change too.
- Recovery / EV opening hours: "Open 24 hours, 7 days a week" button and a 24h button per day; own hours still work.
- Tested on preview 22 Nov: recovery booking 137891C7, job 61.00 + fee 9.99 = 70.99; we keep 17.31, partner 53.68. Valet,
  alloys and quote bookings use the same new figures in the database but were NOT re-run in the browser.
- Fixed on the way: hours table and truck cards now fit on a phone. The truck cards had been sharing style names
  (.flt) with the car search filters; they are now .rkf. Always check for a name already in use.

RECOVERY FLEET AND EXTRAS (built 22 Nov 2026, tested end to end on preview)
- Partners pick their trucks from 7 pictures (spectacle lift, 3.5t beavertail, slide bed, 7.5t, heavy, 4x4 and trailer,
  bike trailer) with call-out, price per mile and free miles for each, plus an extras price list (dollies, skates, winch,
  accident, fluid spill, no keys, low car, waiting per 15 min, storage per day, out of hours 8pm to 7am).
- The customer form now asks the vehicle type, whether it rolls, where it is, whether anything is leaking, whether the car is low.
  The quote uses the cheapest suitable truck and includes the extras that are certain from the answers.
- Other extras are listed as "only if needed on the day, and only with your approval". On the day the partner adds the
  extra on the job card; the customer either signs on the partner's screen or approves online, then pays. One pending
  extra at a time. Test: booking 0CDFBCB9 went from 94 to 169 pounds with two extras; the payout went up to match.
- Terms updated (customer "Extras on the day", partner "Recovery prices and extras").
- Test partner TEST Recovery Dartford (vimen+recovery@). Delete before launch.

CHECKED ON 26 NOV 2026 (7am), before carrying on. The website has not changed since the 23 Nov save: the code here, the
code on GitHub and the live preview page are identical, and no other branch has newer work. No new partners, bookings,
demo requests, messages or accounts since then (only automatic reminder emails went out). ONE THING WAS DONE ELSEWHERE:
on 23 Nov (3.29pm) a "prospects" list was added to the database from another Claude conversation: 22,974 MOT stations
from the DVSA list, with a do-not-email list and a contact log (staff only; not readable without a staff log-in, checked).
It is now recorded in supabase/migrations/20261123e_partner_prospects.sql. Nothing on the website uses it yet: there is
no admin screen for it, no emails have been found or sent, and every row is still "new". ASK THE OWNER what he wants
done with it. The owner's own staff account now has two-step log-in set up.
WHERE WE STOPPED (23 Nov 2026, about 3.15am). Owner went to bed; pick up when he is up. Everything is on GitHub and live
on the preview site.
DONE ON 22 TO 23 NOV (details under "Done"): the partner recruitment pack; the demo for each trade, which is now sent on
request and locked (its content comes from the server, only to a valid link); the windscreen card fits A4; EV charging
has a price per kWh; recovery extras go to the customer in one request.
FOR THE OWNER TO DECIDE OR DO:
- Old demo copy on GitHub: either send the request to GitHub Support (he has it as a file, Request-to-GitHub-Support.txt)
  or leave it until the repository is made private at launch (needs Vercel's paid plan first: see "Before launch").
- Demo: "Request a demo" still shows in the partner menu, join pages and FAQ. Say if it should be reachable only from
  the links he emails. Each demo is sent by hand from the admin page; it could send itself the moment they ask.
- Two TEST demo requests (DEM-00001 valet, DEM-00003 dealer) are in the admin list. No delete button: they go with the
  other test data before launch.
- Still waiting from before: leaked password protection in Supabase (Authentication > Passwords); VDG_API_KEY; the DVLA key; the RAC decision; company registration; Stripe.
NEXT FOR CLAUDE: test the untested dealer features with a real dealer account (list under DEALER SALES INVOICING below:
spreadsheet upload, stock feed, showroom page and website embed, trade listings, PDI, changing plan). The solicitor and
accountant briefs were UPDATED on 27 Nov (sent to the owner as PDFs; private, not in the repo): each opens with "What
has changed since 22 November" (DVLA and DVSA data, MOT warnings, trade sales, dealer plan limits and stock feeds, EV
per kWh, reminders, demo requests) with new questions (solicitor B8, D6, D7, E7, E8, F6, F7; accountant 14 to 16).
The site's terms (sections 9 and 11) and privacy policy were updated to match first. Ask whether he wants a separate "Recently sold" page, and to check a printed invoice for the logo.
PRIVATE FILES ARE NOT ON GITHUB (the repository is public): the recruitment guide, links sheet, contact list, adviser
briefs, RAC paper and the working files they are made from. The owner was sent them on 23 Nov as one zip,
"The-Motoring-Central-Private-Working-Files-23-Nov-2026.zip", replaced on 27 Nov by
"The-Motoring-Central-Private-Working-Files-27-Nov-2026.zip" (adds the updated briefs, The Forecourt video and story,
the EV story and the video screen pictures). If this session's working space is empty, ask for the newest one.
The demo kit lives in the database (see tools/demo-kit.js); a copy is in that zip.
TESTS: scripts are in tools/e2e. Nothing secret is stored there: give the test password in MC_TEST_PW, the test staff
two-step secret in MC_STAFF_TOTP and a staff demo link in MC_DEMO_LINK. If those are lost, reset the test accounts'
passwords and the test staff two-step log-in in the database. Emails from the site are sending again (seen 23 Nov).
Test accounts (password as before, not stored here): vimen+dealer2@ (TEST Trial Motors Gravesend: has a logo, invoice
details, invoices INV-0001 to INV-0003, stock and 2 test adverts), vimen+dealer3@, vimen+body@, vimen+valet@,
vimen+autoelec@, vimen+staff@ (reviewer), vimen+visitor@ (contact form). VIMS CARS is founding dealer no. 1; 29 left.
Delete all TEST accounts, adverts and trial records before launch.

- Registration look-ups are FREE to dealers (owner, 22 Nov; 10p charge removed everywhere). Our cost until the free
  sources are connected: a few pence per Vehicle Data Global look-up (each reg cached so it is not paid for twice).
  DVLA VES API: KEY RECEIVED and added by the owner on 26 Nov 2026, in Vercel > Settings > Environment Variables as
  DVLA_API_KEY (all environments). The look-up (api/vrm.js) asks the DVLA and Vehicle Data Global at once and joins the
  answers. A new key, or a changed one, only works after the site is published again.
  TESTED ON THE LIVE PREVIEW, 26 Nov: it is a LIVE key (not a test key). FV16WDY came back from the DVLA as a 2016 black
  Ford diesel, MOT expired 14 Jun 2026, untaxed; BJ24JUC as a 2024 Ford van, first MOT due Mar 2027. Joined with Vehicle
  Data Global it gave Fiesta Zetec TDCi, manual, hatchback. The dealer "Add a vehicle" form filled in from it. Made-up
  plates are "not found". Answers in under a second.
  What the DVLA adds that we did not have: road tax status and due date, the official MOT status, gross weight, Euro
  status, the date of the latest logbook (V5C).
  26 Nov (owner: "do both"):
  - FREE LOOK-UPS (DVLA only, ?basic=1) for MOT bookings, the customer's "My garage" and the MOT reminder "Find it for
    me". They show the make, year, fuel, colour, engine size and MOT, but no model or gearbox ("Not known" on an MOT
    booking). Garage, mobile mechanic, auto electrician and locksmith bookings and dealers still use the paid source
    too, because the mechanic needs the model for parts. If the DVLA fails, the paid source answers instead.
  - PRIVATE SELLERS (26 Nov, owner asked): "Sell your car or van" Find now uses the free DVLA look-up too. It fills the
    make, year, fuel, colour and car or van; the seller types the model and version and chooses the gearbox and body
    type (from the V5C). Gearbox and body start unchosen and must be picked before publishing. Also fixed: coming back
    to a paid, checked advert later now fills the details in again (it used to leave them empty). Tested on the live
    preview with FV16WDY: only the free look-up was asked. Dealer listing forms still use the full look-up.
  - MY GARAGE: each saved vehicle shows its MOT (overdue, due soon, first MOT) and vehicle tax (taxed with due date, due
    soon, untaxed with a GOV.UK link, SORN), read again from the DVLA once a day. The home page line warns too.
  - The "remind me" box in My garage was only saved in the browser, so no reminders were ever sent from it. It now sets
    up real email reminders for each vehicle, for the MOT AND the vehicle tax (a month and a week before). Unticking it
    or removing a vehicle stops them. A reminder stopped from an email is never restarted by the page.
  - Tested: live look-ups for both vehicles, warnings, reminders made, unticked, re-ticked and removed, a stopped
    reminder kept stopped, a real tax reminder email queued once (to the test customer), MOT booking on the free look-up.
  - NOT DONE, on purpose: "Taxed until" on adverts. Vehicle tax does not pass to a buyer (since Oct 2014 the seller gets
    a refund and the buyer must tax it), so it would mislead. Adverts already carry the official MOT date from the look-up.
  - Code: api/vrm.js (basic), index.html (search "vehicle tax, from the DVLA" and "MCrem"),
    supabase/migrations/20261126a_tax_reminders.sql (tax_due, add_mot_reminder with p_tax_due and p_auto,
    private.queue_tax_due_reminders in the 'mot-reminders' job at 5pm).
  Was: after company registration, apply for the DVLA Vehicle Enquiry Service API (free; make, colour, fuel, year, engine,
  tax and MOT status, NO model/variant/gearbox/body) and the DVSA MOT History API (free; adds model for cars that have
  had an MOT). Plan: DVLA + DVSA first, Vehicle Data Global only when those come back incomplete (new cars, variant).
  Check whether a sole trader could apply sooner.
  DVLA VES default limit is 2 requests/second (~7,200/hour): enough to launch. When connecting it, build: a queue
  that paces spreadsheet uploads at 2/second; one shared server-side cache per registration (fetched once for
  everyone); on "too many requests", wait and retry or fall back to the paid look-up. Ask DVLA for more if needed.

DEALER SALES INVOICING (22 Nov 2026), BUILT AND TESTED ON THE LIVE PREVIEW:
- Stock vehicle > "Take a deposit or sell (invoice)". One record per sale: deposit receipt while money is owed, final
  sales invoice once paid in full (then locked; can only be cancelled with a reason). Numbers INV-0001... per dealer,
  never reused. Payments: cash, card, BACS, part exchange (allowance less finance settled), finance (lender,
  agreement). Extra lines (warranty, road tax, delivery, admin fee...). VAT per line: margin scheme / 20% included /
  none; not-VAT-registered dealers show no VAT. Dealer details (address, VAT no, company no, bank, FCA no, terms),
  logo and two colours (pick, or "match my logo") print on it. Tables: dealer_invoices, dealer_books.
- Deposit saved -> stock "Under deposit" + advert badge. Final -> stock Sold, advert shows SOLD, goes to the end of
  the list, off the banner, stays 30 days or until the dealer takes it down. Part exchange is added to stock as
  "In preparation" at its allowance. Cancel -> vehicle back For sale.
- Fixed on the way (all affected real dealers): stock book stopped saving above ~30 KB (now its own table, photos go
  to storage); vehicle numbers repeated after a reload; stock lost its link to its advert after a reload; logo was
  never saved; dealers saw OTHER dealers' adverts as their own in "Your adverts"; sample results/enquiries/Facebook
  boost cards and made-up view counts shown to real dealers; compare cars broken by the complaints tab (name clash);
  log-in error messages (e.g. "tap the link in the email") never shown.
- Tested: premium ads counter for a founding dealer (5 of 5 -> 4 of 5).
- TESTED WITH A REAL DEALER on the live preview, 26 Nov 2026 (TEST Trial Motors Gravesend):
  - Showroom page and website embed: work. Fixed: the embed showed the strapline over the search box, a postcode box and
    saved searches, and its "Seller" filter could be removed (now hidden on showroom pages and in the embed).
  - PDI: works (picks the car from stock, PDF, saved to the account, stock shows "PDI ✓"). Fixed: PDI and inspection PDFs
    were about 3 MB (pictures not compressed; now about 50 times smaller), and the message said "Saved to the booking".
  - Spreadsheet upload: works (real look-ups and history checks, adverts sent for approval, bad rows skipped clearly).
  - STOCK FEEDS UPDATE OVERNIGHT (27 Nov, migration 20261126l): the feed address is kept in dealer_feeds and checked
    every night at 2:40am (second pass 3:40am, job "stock-feeds-night"): price, mileage and description changes,
    vehicles no longer in the feed taken down, email to the dealer about new vehicles to list (listing still happens on
    the dashboard because it uses a paid history check). A feed that cannot be read, looks empty or would take down
    more than half the feed's vehicles changes nothing; the dealer is told. Dashboard shows "Checked overnight on ...".
    Tested on the live preview (price changed, van taken down, new vehicle emailed, web page refused safely).
  - Automatic stock feed: works (price updated, a vehicle left out of the file taken down, feed stopped). Fixed 26 Nov:
    a web page given instead of a CSV now says "That address returns a web page, not a CSV file" (was "over 1 MB").
  - Plans: WERE BROKEN, FIXED. Since the two-step sign-up (22 Nov) the plan picked on the join form was never saved, so
    every dealer was Starter, and there was no way to change plan. Now the application saves the plan, existing dealers
    are stored as Starter ('0'), and Set-up > Plan and billing has "Change plan": straight away for the number of
    adverts, new price from the next bill (or after the trial); a smaller plan needs the adverts to fit; yearly payers
    move down only at renewal. The dealer and the owners are emailed. The admin application card shows the plan.
    Database: supabase/migrations/20261126b_dealer_plans.sql and 20261126c_dealer_plan_name_fix.sql.
  - ADVERT LIMIT ENFORCED (26 Nov): a dealer can have only as many adverts (live or waiting for approval) as their plan
    allows. "List a car/van" says so and offers Change plan; the database refuses the extra advert too (trigger
    adverts_a_plan_limit, migration 20261126e). Sold cars still showing count until taken down. Tested.
  - TRADE LISTINGS BUILT (26 Nov), migration 20261126f_trade_listings.sql. Listings and offers are now saved in the
    database and every approved trade partner sees them (customers are refused). Fixed price ("buy now"), "or nearest
    offer" with a hidden minimum (the minimum never reaches the buyer's browser; offers below it are refused), offers
    accepted or declined by the seller, offers withdrawn by the buyer, listings withdrawn by the seller, moving a car
    from the stock book to trade (the stock car is marked sold when it sells), 5 free listings a month then the fee.
    On a sale both sides get each other's phone and email and are emailed. The page refreshes every 30 seconds.
    The demo still shows sample trade cards and never touches the database. Tested with two test dealers.
    Not yet: the 9.99 + VAT fee is not charged (comes with Stripe; the page's word is trusted until then); test
    listings on TEST Trial Motors / TEST Second Try Cars to delete before launch.
  - STAFF SCREEN FOR TRADE LISTINGS (26 Nov): Admin > Adverts > Trade listings. Every listing (live, sold, taken down),
    with the hidden minimum, the fee, every offer, and both businesses' details; this month's totals; search by
    registration, make, model or business. "Take it down" needs a reason: the seller is emailed it and sees it on their
    trade page, anyone with an offer waiting is told it closed, and who did it and when is kept. Migration 20261126g.
    Tested (a dealer cannot use the staff functions).
  - SECURITY FIX (26 Nov): picture addresses. Advert photos were not checked by the database, and trade photos only by
    how they started, while the page put them into the page as they were. Someone sending their own request could have
    saved an address that ran code in the browser of staff approving adverts or of other dealers. Fixed three ways: every
    text-escaping helper in the page now also escapes quote marks; picture and photo-link addresses from saved data go
    through one safe-address check (window.SRC); and the database keeps only our own storage addresses for advert and
    trade photos (migration 20261126h). Partner logos must now be a complete picture. Checked: main pages, dashboards,
    stock book, trade and the demo all show as before.
  - Still to check by eye: the logo on a printed invoice (the file loads; the print window now waits for it).
  - Also: dealers can now delete files in their own photo folder (needed to remove photos of removed adverts).
- To decide / later: a separate "Recently sold" page; the server does not limit premium ads to the allowance (the
  dashboard counts them; charging extras comes with Stripe); ask the accountant to check the invoice VAT wording.

COMPLAINTS PROCEDURE AND CONTACT FORM (22 Nov 2026), BUILT AND TESTED:
- The Contact page form never sent anything (old preview code). Fixed: every message is stored, you are emailed, and the
  sender gets an acknowledgement with a reference (MSG-00001). Topic "A problem or complaint" counts as a complaint.
- New Complaints page (#complaints, linked in every footer) with its own form, who to contact first, timescales
  (reference straight away, contact within [2 working days], full response within [14 days], final within [8 weeks]),
  review by the owner, outside help (Citizens Advice, chargeback / Section 75, Motor Ombudsman, small claims, ICO).
- Complaints get a CMP- reference and response dates; staff track them in Staff > Messages and complaints (statuses,
  notes, history with who did what). Weekday 8:40am email to owners when a complaint is due within 2 days or overdue.
- Terms: 13. Premium ads and the front-page banner (shared rotation, about 4 seconds each, order shuffled, no
  guaranteed position or views, we may change the layout, no refunds for rotation; refund or re-run only if it never
  appeared because of our fault). 14. Complaints procedure. Partners and dealers must reply to a passed-on complaint
  within [5 working days].
- To confirm with the solicitor: the timescales in [brackets], ADR scheme membership, record keeping period.

DEALER LAUNCH OFFER (owner's decision, 22 Nov 2026), BUILT AND TESTED:
- 30-day free trial from the day a dealer is approved, 3 vehicle history checks included; more checks £3.50 + VAT, or
  list without one during the trial ("Not history checked").
- One free trial per dealership: same email, phone number, or business name + town = no trial (pays from approval);
  staff see "noTrial" on the application. The details are kept even if the account is deleted.
- Cancel any time in the trial (nothing to pay). Cancelling in the trial is INSTANT (owner, 22 Nov): the account is
  suspended at once, adverts are taken down, the founding place is released and the trial counts as used; one
  "free trial cancelled" email (no "account paused" email). If an owner reinstates them, they start a paid plan.
  After the trial: monthly, ONE MONTH'S NOTICE. Yearly: no refund on a
  change of mind, refund of unused months if we stop the service.
- Yearly any time: pay for 9 months, get 12. Founding dealers = first 30 approved: pay for 8, get 12. The dealer page
  shows how many founding places are left. Test dealers' founding places were cleared (30 of 30 left).
- Emails: welcome with the trial end date and founding number; reminder 7 days before the trial ends (daily 9:20am);
  cancellation confirmation. Dashboard shows the countdown, founding number, Pay yearly, Cancel and Keep my membership.
- Site, terms (Fees, Yearly plans and founding dealers, Cancelling), FAQ, dealer video (slides, voice and captions)
  and dealer pitch PDF all updated.
- Founding dealers also get 5 free premium ads a month from approval until 2 months after the trial ends. Cancelling
  in the trial releases the founding place (lowest free number goes to the next dealer approved); Keep my membership
  in the trial takes a free place again if one is left. Built and tested 22 Nov.
- VIMS CARS is founding dealer no. 1 (owner's choice, 22 Nov, for testing); 29 founding places left. TEST Dealer
  Dartford has a fresh 30-day trial and no founding number. Before launch: delete the TEST dealer accounts (and their
  trial records) when the owner says go live.
- Not yet: nothing ends a membership automatically when ends_at passes, and nothing is charged; both come with Stripe.
  Delete the TEST dealer accounts before launch so their trial records cannot block real dealers.

END-TO-END TESTS OF THE PHONE-SESSION FEATURES (22 Nov, just after midnight): ALL PASS, after fixes.
Test accounts added (password as for the other test accounts, not stored here): vimen+body@ (TEST Body and Alloys
Dartford), vimen+valet@ (TEST Valeting Dartford), vimen+autoelec@ (TEST Auto Electrics and Keys Dartford), vimen+staff@
(Test Reviewer, staff, two-step set up; the authenticator key is only in the test scratchpad).
- Bodywork quote (2 photos) -> partner sees photos, sends £180 -> customer pays £183 -> we keep £13.80, partner £169.20. OK
- Locksmith quote "Lost keys" -> £165 -> customer pays £168 -> £12.90 / £155.10. OK
- Valet Medium £99 -> £102 (£8.94 / £93.06); alloys diamond cut x4 £396 -> £399 (£26.76 / £372.24). OK
- Inspection saved to the valet booking with its PDF; customer sees it in My account and the PDF opens. OK
- Weekly payouts: self-billing agreed, week built, marked paid, partner emailed, invoice prints. OK
- Saved car + saved search: price-drop and new-match email correct, sent once (no repeat next day). OK
- Staff two-step: setup with QR/key, wrong code refused, code needed at each log-in, password alone gets no staff data. OK
Fixed while testing: partner's quote note was silently lost (two boxes shared one id); accepting a quote now takes the
card payment first; quote, valet and alloy bookings saved as unpaid (now paid, like MOT/EV/recovery); valet and alloy
job day was not saved as a date; payouts now count paid jobs only; partner job cards showed the booking time, not the
job day; reviewers could build payouts and mark them paid through the database (now owner only); "Can start in 0 days"
now "today"; lockouts can be booked for today; PDF tool now served from our own site (inspections, PDIs); small date
and wording tidy-ups in emails and invoices.
OWNER ACTION: your owner staff account has NOT set up two-step log-in yet, so your password alone opens the staff
side. Use Staff log in once and scan the code with an authenticator app (Google or Microsoft Authenticator).
Before Stripe goes live: "paid" is set by the booking functions after the on-screen card step; with real Stripe it must
be set by Stripe's confirmation instead (MOT, EV, recovery, quotes, valet, alloys).

WHERE WE STOPPED (21 Nov, late morning). Open questions for the owner:
- Launch offer for dealers: DECIDED 22 Nov (see DEALER LAUNCH OFFER above). Partners: SUPERSEDED, now flat 10% + VAT and no Pro (see PARTNER FEES CHANGED). Was: 5% (not 10%) and Pro £74.50
  (not £149) unchanged.
- Phone (Voipfone, 020 8191 4290): line works and diverts to the owner's mobile. Left for later: how business calls
  show on the mobile (Line Presentation in Services > My Numbers > Phone, or the Voipfone Mobile app), calling credit
  for the divert, and out-of-hours voicemail. WhatsApp Business on the number not set up yet.
- Social media (21 Nov): login email social@motoringcentral.co.uk (alias). Instagram @themotoringcentral CLAIMED (business
  account, Automotive Service, two-step login on, backup codes saved, picture and bio added, connected to the Facebook
  Page on 21 Nov evening). Old Facebook Pages deleted: only the owner's personal profile and The Motoring Central remain.
  Facebook Page "The Motoring Central" CREATED (picture, cover, contact details, Send message button, notifications on);
  username facebook.com/themotoringcentral not available to set yet: try again in a few days. TikTok WAITING: TikTok
  insists on a mobile number and the owner's is on his personal TikTok, so he is getting a business mobile SIM.
  YouTube @themotoringcentral CLAIMED on vimen@ (banner, description, contact email, video watermark done; the four
  videos not uploaded yet). LinkedIn and X: left for later at the owner's request. LinkedIn made a personal account
  for vimen@ when he started; to create the company page it needs his real name, but he does not want his name linked
  to the company yet: do not list The Motoring Central as his job, and set public profile visibility Off. Owner wants
  his name kept away from the brand for now (local contacts trust a bigger-looking company more).
  Images and steps for each platform are in social/.
- (done) Menu name: "Motor trade jobs" in the menu, "Work in the motor trade" kept as the page heading.

Found in the end-to-end tests (21 Nov) and still to fix:
- Customer MOT list shows sample garages with made-up distances next to real ones (goes when the samples are
  switched off at launch).
(Fixed 21 Nov evening: email links to /#dashboard and /#account; sample "Live jobs" and "Earnings" cards on real
partner dashboards; car and van messages card for partners who do not sell cars; EV job card said "Collect"; sign-up
steps promised a video call; pretend booking alerts for real accounts.)

LAUNCH LINE-UP (owner, 21 Nov 2026): first launch is MOT, car and van sales (dealers, private, trade), mobile EV
charging, recovery, valeting, bodywork and alloys, and auto electricians and locksmiths (last two added the same
evening), together. Mobile mechanics, garage repairs and servicing, and tyres come after. Built: window.MCLAUNCH.LIVE in index.html (customers: tiles,
search, chips and footer show only live services; anything else shows "coming soon") and RECRUIT in "Join pages by
trade" (partners: only the five launch trades can join; the other join pages go to Join the network, "Opening soon").
To switch repairs on later: LIVE=null and RECRUIT=null.
Quotes on the website (owner, 21 Nov): bodywork/alloy damage and ALL auto electrician and locksmith jobs are quote
requests (tables quote_jobs, quote_offers). Customer picks up to 3 approved partners; partners send a fixed price on
their dashboard ("Quote requests"); customer compares and books in My account ("Your quotes"); accept_quote makes the
booking: price + £3 booking fee, partner payout = price less 5% + VAT (Pay as you go) or 0% (Pro). Contact details
only after booking. Alloy refurb stays fixed price per wheel from the partner's own rates. Repair pricing decision is no longer blocking launch.

SITE 100% READY PLAN (owner, 21 Nov evening: no advertising until the site is fully ready)
1. Build now: (a) test fixes DONE; (b) real partners in the remaining booking lists DONE (21 Nov night: garage repairs,
   valeting centres, bodywork with photos sent to the repairers, alloys); (c) customers and partners change their own name, phone and email DONE (owner emailed if an approved
   partner renames their business); (d) weekly payout
   statements and self-billing invoices DONE (partner dashboard card + Staff "Weekly payouts"; ASK THE
   ACCOUNTANT to check the self-billing agreement wording and the VAT lines before the first real payout); (e) inspections, PDIs and service sheets saved against the booking DONE (table job_records, PDFs in
   private storage "job-records"; customers see them under "Your vehicle records" in My account);
   (f) saved searches, price-drop alerts, saved cars in the account, staff tool to remove unfair reviews DONE
   (saved_items + daily 8am email "saved-alerts"; partner reviews now stored in partner_reviews; Staff "Reviews: hide
   unfair ones" for partner and dealer reviews, with a reason);
   (g) two-step login for staff, add or remove reviewers DONE (authenticator app code at every staff log-in;
   owner adds reviewers from existing accounts on Staff > Staff tab; once someone has set up the app, the database
   only gives staff access with the second step). ITEM 1 COMPLETE 21 Nov night.
2. Owner decides: launch offer; repairs pricing.
3. After company registration: Stripe and weekly payouts, bank, Vehicle Data Global, DVSA MOT history, ICO, solicitor,
   Supabase Pro, motoringcentral.co.uk pointed at the site, Twilio texts.
4. Launch day: remove demo log-ins, sample partners, sample reviews and the Preview banner; let Google list the site.

Texts (SMS) are built too but need a Twilio account (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM). Not chosen yet.
Until then the site no longer promises texts (27 Nov): "by email and text" shows as "by email". When texts are set up,
change window.MCSMS=false to true near the top of index.html and the wording comes back in all four places (texts
queued meanwhile stay queued; the terms still show "[and by text message]" for the solicitor).

DEALER PITCH REFRESHED (27 Nov): the join-page dealer video re-made (stock feed nightly, MOT history from the DVSA on
every advert, a trade section slide); the "dealer pitch" deck in the owner's Claude artifacts brought up to date (it
still said "first 3 months free", 10p look-ups, MOT data "before launch", and services not open at launch: now 30 days
free with 3 checks, founding dealers, free look-ups, MOT history live, trade with 5 free listings, launch services only);
"The Forecourt" 60-second story video made (sent to the owner; hold it back like the other adverts until the company is
registered). Sources: tools/video/dealer and tools/video/forecourt.

LAUNCH REHEARSAL (27 Nov 2026, live preview, test accounts): ALL PASSED.
- MOT: customer booked Class 4 at TEST MOT Station (£54.85, test card); the station's diary showed it.
- Recovery: quote (call-out, mileage, out of hours, extras list), paid £105.99; the driver saw it (paid £84.48), on my
  way, arrived, job done; the customer was emailed at each step and asked for a review.
- Mobile EV charging: £150 call-out + 10 kWh at 85p + £9.99 = £168.49; charger paid £139.48; on my way, arrived, done.
- Valeting: TEST Valeting, £99 + £9.99, Monday 10am; the valeter's jobs list showed it.
- Bodywork and alloys: quote request, £180 quote, accepted and paid £189.99. Auto electrician/locksmith: new key
  request, £165 quote, accepted and paid £174.99.
- Car sales: dealer listed a real car (FD16WDY); staff approval card showed "MOT check: 9 tests ... mileage looks
  consistent"; approved; buyer saw the real MOT history, sent a message (the dealer-sale box and phone number are
  required) and a viewing request with a part exchange; the dealer's Messages tab and leads showed both.
- Private seller: paid £29.99, Find filled "2016 Ford Fiesta" free, history check, details, sent for approval.
- 32 emails sent, none failed. Found and fixed: the "application needs attention" and "account paused" emails showed
  the reason as raw code (migration 20261127a); the site promised texts that are not switched on (above).
- Test bookings made (to delete before launch with the other test data): MOT D8DE1B1E, recovery D30499CE, EV
  B3B5FAA0, valet TMC-097030, bodywork and key bookings on the test customer. Rehearsal adverts taken down.
- The old test scripts' "available" and day choices needed updating (the recovery/EV dashboards now use tabs; the
  test MOT station is closed on Sundays): test-script changes only, not site faults.

### What the emails cover (built 19 Nov 2026)
- Partners and dealers: application received; approved (welcome and next steps); needs attention (with the reason);
  paused; active again. Owner gets "New application to review" and "Application sent back".
- Car and van adverts: "We are checking your advert", "Your advert is live", "Your advert needs a change" (with the
  reason). Owner gets "Adverts are waiting for approval" (at most one every 30 minutes).
- Buyers and sellers: new message, viewing request, viewing confirmed or not possible, seller replied. At most one
  email per conversation every 30 minutes, so a chat does not flood anyone's inbox.
- Bookings (not MOT): confirmation to the customer, "New job booked" to the partner, "on the way", "job completed"
  (asks for a review), cancelled. MOT: booked, moved, cancelled (customer and garage) and a reminder at 5pm the day before.
- Quotes: "New quote for your ..." to the customer.
- Login emails (Supabase): confirm email, reset password, change email, log-in link, in the same branding.
- New page: /reset.html (forgotten password), linked from the partner and customer log-in forms.
How it works: the database writes every email into the table "notifications"; a timed job runs the function "notify"
every 2 minutes while anything is waiting. Demo and test addresses (demo.com, example.com) are never sent. Anything that
waited more than 24 hours is dropped, so test messages from before Saturday are not sent by surprise. To see what was
sent: Supabase > Table editor > notifications (status sent, skipped, queued or failed, with the error).
Code: supabase/migrations/20261119e_email_notifications.sql and supabase/functions/notify.
Still to do later: email partners about new quote requests near them, saved-search and price-drop alerts, the weekly
garage payout statement, and an unsubscribe link for marketing emails (only service emails are sent for now).

## FIRST THING ON 19 NOV 2026 (owner, with Claude)

1. Supabase settings (5 minutes):
   - Authentication > Sign In / Providers > Email: "Confirm email" OFF (until the email service is set up).
   - Authentication > URL Configuration: Site URL = https://preview.motoringcentral.co.uk
   - Authentication > Passwords: turn on "Leaked password protection" (blocks passwords known to be stolen).
2. One full test run on the preview, with a second email address:
   - Sign up as a dealer, then approve it on the Staff page (/#staff) with the owner account (vimen.mudalli@gmail.com).
   - As that dealer: list a car (a reg containing WO shows a write-off label), try "Upload stock from a spreadsheet",
     open "Your showroom".
   - That car now waits for approval: on the admin page, "Adverts waiting for approval", approve it (and try
     declining one with a reason; the seller fixes it and sends it back).
   - As a customer: message the car and request a test drive. Back as the dealer: reply and confirm.
   - New on 18 Nov night, try these too: "+ Compare" on two cars; "Similar cars" and "Recently viewed" at the
     bottom of an advert; "Running costs" (road tax) on an advert; as the customer, "Review this dealer" in
     Messages after the dealer replies; as the dealer, "How your adverts are doing" on the dashboard, "Add a video
     tour" on your own advert (it goes back for approval), "Show your stock on your own website" (copy the code) and
     "Automatic stock feed" (needs a CSV file at a web address; the spreadsheet template works if it is online).
   - Tell Claude anything that looks wrong.
3. When real stock is listed: admin page > "Sample cars and vans" > Hide.
4. DVSA MOT history API: DONE. Applied for and CONNECTED on 26 Nov 2026 (the owner added the four secrets; checked by
   Claude: real MOT histories on live adverts, warnings, staff MOT line, private sellers' model). Kept here for reference:
   When the DVSA emails the credentials, add DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY and DVSA_TOKEN_URL in
   Supabase > Edge Functions > Secrets (never in chat), then open the admin page: "Connected services" on the To do page
   should say MOT history "Connected" (tap "Check again"; it re-checks at most every 10 minutes). Tell Claude to test it.
5. Email Vehicle Data Global: the package name for the VDI Check; whether VAT is added to £2.34 to £3.00; written OK
   to show a history check summary on an advert for its whole life.
6. Ask the accountant: VAT when we collect the partner's price on their behalf (we charge VAT only on our own fee),
   and VAT on refunds less the £9.99 admin fee.
7. Email service: DONE 19 Nov 2026 (Google Workspace for mailboxes, Resend for the site's emails; built and waiting for the Saturday steps at the top).
8. Decide the next car-sales features (Claude can build each one; the ones with a cost need your OK first):
   - Needs the email service (item 7): email alerts for saved searches ("3 new cars match"), price-drop alerts on
     saved cars, and emails to sellers when an advert is approved or declined, a buyer messages, or a viewing is
     booked. Saved cars ("favourites") to be kept in the account rather than on one device.
   - "Sell to local dealers" (like Motorway / Auto Trader Instant Offer): a private seller enters reg, mileage and
     photos and our dealers bid; we charge the dealer a fee per car bought. Big build, biggest pull for sellers and
     stock for dealers. Decide the fee, and solicitor to check the terms.
   - Needs paid data: "Great / good / fair price" labels and "Value my car" (ask Vehicle Data Global for a valuation
     price per look-up), and full equipment lists. Both can wait until there are enough adverts.
   - Needs FCA permission or taking payments: finance quotes on adverts, reserving a car online with a deposit.
   - Stock feeds that update overnight on their own (now they update when the dealer opens the dashboard).
   - A staff screen to remove an unfair dealer review (for now, delete it in Supabase > Table editor >
     dealer_reviews).
   - When the real registration look-up is on: check that CO2 and fuel economy come through (needed for road tax on
     cars registered before April 2017); Claude can check with VDG_DEBUG.
9. FCA: decided 19 Nov 2026 to wait until the business is making money. Finance stays switched off. Until then,
   build as much as possible for the pre-launch (below).
10. Dealer pitch: DONE 19 Nov 2026. Pitch deck "The Motoring Central: dealer pitch" (12 slides with speaker notes,
   in your Claude artifacts; download as PowerPoint or PDF from the deck) and a 2-minute video with the same female voice as the intro video on the Join as a dealer
   page (video/dealer.mp4, captions in dealer.vtt). Before pitching for real: the MOT history and history checks must be switched on (items 4
   and 5), because the deck and video promise them. To change the video, ask Claude (its source is kept outside the site).

Preview site: https://preview.motoringcentral.co.uk

### Pre-launch build plan (no FCA needed), in order
1. Email service set up (item 7), then: sign-up and booking emails, advert approved/declined emails, buyer message and
   viewing emails, saved-search alerts, price-drop alerts, saved cars kept in the account.
2. "Sell to local dealers" (private sellers get bids from our dealers; fee per car bought).
3. Stock feeds updating overnight on their own; staff screen to remove unfair dealer reviews.
4. Payments (Stripe, needs the company and business bank account): take real payments for private adverts, dealer
   plans, premium adverts and booking fees, in place of the preview payment screen.
5. Real registration look-up and history checks switched on (Vehicle Data Global), MOT history (DVSA).
6. Launch checks: privacy notice, cookie notice and terms checked by the solicitor; Supabase on the Pro plan;
   remove "noindex" so Google can list the site; real domain (motoringcentral.co.uk) pointed at the site.
Later, once the business is making money: FCA credit broking permission, then finance quotes and online reservations.

## To do

### 1. Shared database (started 18 Nov 2026: Supabase, London)
Chosen: Supabase (project "The Motoring Central", London region, free plan while building; Pro before launch).
The site talks to it from the script that starts "Shared database (Supabase" in index.html. Only the public
("publishable") key is in the page. Never put a secret key or the database password in the site or in chat.

Done so far:
- Real customer accounts (sign up, log in, stay logged in, log out); customers' bookings and their messages to
  dealers are saved to their account and are there on any device.
- Partner and dealer applications are saved in the database and reach the admin page from any device. Their
  insurance certificates and photo ID go into private storage that only the partner and staff can open.
- Real staff log-in on the Staff page. Approve, reject, suspend, reinstate, the checklist and reviewer
  recommendations are saved. Only an owner can change a partner's status. Staff are added by Claude in the
  database (the "Add a reviewer" box on the admin page is still sample only).
- Partners and dealers log in with their real account on any device and see their status.

- Bookings reach the chosen partner on their own device (name, phone, job, vehicle). The partner's updates
  (on the way, started, completed) reach the customer's account. Refreshes about every 25 seconds.
- Approved real partners appear in the customer booking lists for: mobile mechanics, auto electricians,
  mobile tyre fitters, mobile valeters and recovery. NOT YET for garages and MOT, valeting centres, bodywork,
  alloy wheels and EV charging (their lists are built differently). A booking is matched to a partner by
  business name, so two approved partners must not share a name.
- Partners' rates, services, diary and plan are saved. Real partners no longer see sample jobs.
- Quote requests are saved, shown to approved mechanics and garages, and their quotes come back to the customer.
- Car and van adverts (dealer and private) are saved with their photos and shown to everyone. Removing and
  premium upgrades are saved. Buyers' messages on private adverts are still kept in the browser only.

- Vehicle history check for cars and vans for sale (18 Nov 2026), kept separate from the free repair look-up.
  Runs on the server in London (Supabase function "vehicle-history", code in supabase/functions/vehicle-history).
  Private sellers pay the £29.99 first, then the check runs, then the advert is created. Dealers' checks come
  from their plan allowance; extra checks and checks in the free 3 months are £3.50 + VAT. The result is stored
  by the server and every new advert must carry its own check, so sellers cannot fake or remove it.
  Rules: stolen, scrapped and Category A/B are not listed; private sellers cannot list with outstanding finance;
  dealers can, shown as "Finance to clear". Write-offs (S, N, C, D) are shown in red on the card and at the top
  of the advert, whether declared by the seller or found by the check; a declared write-off cannot be removed.
  Buyers can hide write-offs with a filter. NOW RUNNING ON SAMPLE RESULTS (try regs with WO, CATN, FIN, STO).
- Dealer plans now include history checks: Starter £169 (5 checks), Standard £229 (10), Plus £299 (15),
  Pro £379 (25), Premier £449 (25, changed 18 Nov 2026 so it is cheaper per car than Pro from 60 cars), all + VAT. Change in index.html (DPLANS) AND in the vehicle-history
  function (ALLOW) together. Terms text updated.

To switch real history checks on (needs real card payments first, or private sellers cannot be charged):
- Ask Vehicle Data Global: the exact package name for the VDI Check, whether VAT is added to £2.34 to £3.00,
  and written confirmation that showing a summary on an advert for its whole life is allowed under their
  Provenance Data Reseller Terms (24-hour caching rule; keeping data as part of a memorialised record).
- Supabase > Edge Functions > Secrets: VDG_API_KEY, VDG_HISTORY_PACKAGE, then HISTORY_LIVE=1. Run a few real
  checks with VDG_DEBUG=1 first so Claude can tune how the answer is read before buyers see results.
- Connect Stripe payments in the vehicle-history function (verifyPayment) so a check is only run once paid.
- Delete checks that never became an advert after 30 days, and checks for removed adverts after 6 months.
- Admin page: list of checks that blocked a listing (stolen, finance, Cat A/B), and refunds.
- The repair look-up (/api/vrm on Vercel) may run outside the UK; set the Vercel function region to London.

- Car sales, 18 Nov 2026 (late):
  - Buyer messages and viewing or test drive requests are saved and reach the seller (dealer dashboard and My account,
    "Messages about cars and vans"); the seller replies and confirms viewings there. Updates every 20 seconds.
    No email or text alert yet (needs the email service).
  - Mark as sold / remove now also removes database adverts for everyone.
  - Owner switch on the admin page to hide the sample cars and vans once real stock is listed.
  - Dealers: upload stock from a CSV (reg, price, mileage, plus optional columns), each car looked up and history
    checked; add photos afterwards from the advert page ("Add photos").
  - Dealer showroom page: ?dealer=<id>#cars, with a Share button; link shown on the dealer dashboard.
  - MOT history on adverts (Supabase function "mot-history", London; kept for a day). Live adverts for anyone; adverts
    waiting for approval for staff and the seller only. Sample MOT history shows on sample cars. Waiting for the DVSA
    key: CONNECTED 26 Nov 2026 and tested with real data (FV16WDY Ford Fiesta, 6 tests, recall; PX15OLD is really a
    Piaggio Vespa, so the "different make" warning shows on that test advert). DVSA revokes a key unused for 90 days.
    Also 26 Nov: buyers and staff are warned when the registration belongs to a different make from the advert; a
    registration the DVSA has no record of says so; same-day retests are listed in the right order (time kept).
    Made ready on 26 Nov: recalls read correctly ("Yes"/"No"/"Unknown"; before, every vehicle would have shown a recall);
    first MOT due date for new vehicles; buyers warned when the mileage went down between tests, when the advert's
    mileage is below the last MOT reading, and about an outstanding safety recall; an "MOT check" line on each advert
    waiting for approval (staff); a "Connected services" panel on the admin To do page (DVLA, Vehicle Data Global,
    DVSA); private sellers' Find fills the MODEL from the MOT record (mode "vehicle", logged in, 20 a day each, counted
    in mot_lookups, migration 20261126i). Tested without the key: all show "waiting for the DVSA key" and nothing breaks.
    AUTOMATIC APPROVAL NOW WAITS FOR THE MOT CHECK (27 Nov, migrations 20261126j and k): with "Approve adverts
    automatically" on, a clean advert waits (mot_wait) while mot-history checks its MOT record (straight away, then
    every minute, job "mot-auto-approve"): clean -> live ("Approved automatically after the MOT check"); mileage
    drop, advert mileage below the last MOT, different make, or no DVSA record -> it stays for staff with the reason in
    its flags (recalls do not stop it). DVSA down for 30 minutes -> staff; no DVSA key -> approved as before. Waiting
    emails only when it waits for a person. Sellers can no longer change flags directly. Tested with test adverts
    (automatic approval switched on for the test and back OFF afterwards; it is OFF now).
  - MODEL FROM THE MOT RECORD (27 Nov): MOT bookings (the booking page's vehicle step) and My garage (new and already
    saved vehicles) now get the model from the DVSA record for a logged-in customer. Tested (YD19KXF -> Transit
    Custom; FV16WDY in My garage -> Ford Fiesta).

Owner to do in the Supabase dashboard:
- Authentication > URL Configuration: set "Site URL" to https://preview.motoringcentral.co.uk (the live address at launch).
  NOT DONE YET (checked 18 Nov 2026): it is still the default, localhost:3000, so the "confirm your email" link creates
  the account but then lands on a dead page. Owner chose to leave it while testing; it MUST be done before launch (see the go-live checklist).
- Authentication > Sign In / Providers > Email: turn "Confirm email" OFF while testing (there is no email service yet).
  Turn it back ON before launch, once the email service is set up.

Still to do, in this order:
- A proper email service (custom SMTP), then turn "Confirm email" back on. When it is on, a new partner must
  confirm their email before their documents can upload, so add "upload your documents" to the partner
  dashboard for that case
- Forgotten password: DONE 19 Nov 2026 (/reset.html; works once the Saturday email steps are done). Still to do: changing account details (name, phone, email)
- Two-step sign-in for staff (authenticator app); adding and removing reviewers from the admin page
- Real partners in the remaining booking lists (garages and MOT, valeting centres, bodywork, alloys, EV charging)
- Chat between customer and partner, partner logo, and buyers' messages on adverts, in the database
- Payments checked on the server (Stripe) before an advert or booking is accepted; at the moment the preview trusts the page
- Service sheets, vehicle inspections and PDIs saved against the booking
- Customers list on the admin page from the database; chat messages, saved searches, failed-search list
- Remove the demo logins and sample partners (they still show next to real ones on the preview)
- Data protection: privacy notice says where data is kept (done); ICO fee; who can see what

### 1b. Live MOT diary and MOT pricing (built 19 Nov 2026, live in the database the same day)
Built and live:
- Customers book an MOT from the test centre's live diary: only free times show, and the time is taken in the
  garage's diary the moment they pay (database lock, so two people can never book the same time). The garage's own
  walk-ins, phone bookings and blocked time close those times online. Garage diaries check for new online bookings
  every 26 seconds; the booking page re-reads the garage diary every time a garage is picked.
- Garages can move an online MOT in their diary when the customer asks (day, time, bay). The database checks the new
  time is free. They still cannot cancel one (contact us, so the customer is refunded).
- Price: customers pay the official maximum for the class (e.g. £54.85 car) and nothing more: the booking fee is part
  of it. The garage is paid the agreed fee; our share is the rest and includes VAT (accountant). Admin page:
  "Agreed MOT fee" box shows our share and its VAT.
- Confirmations: every booking and every move queues an email and a text to the customer AND the garage
  (table notifications), sent at once by the edge function 'notify'.
- Demo: book an MOT at "Kirkstall Road Garage" as customer@demo.com, then log in as garage@demo.com > Booking diary.

Still to do:
- SWITCH ON EMAILS AND TEXTS (emails: see the Saturday steps at the top; texts still need Twilio): create a Resend account (email) and a Twilio account (texts), then add the secrets in
  Supabase > Edge Functions > Secrets: RESEND_API_KEY, NOTIFY_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
  TWILIO_FROM. Verify motoringcentral.co.uk in Resend (DNS records at 123-reg). Until then messages wait in the queue
  and are sent when the next booking for them triggers the function (or staff run it with { all: true }).
- DONE 19 Nov 2026: timed job (pg_cron) sends waiting messages every 2 minutes, and an MOT reminder goes at 5pm the day before.
- DVSA: confirm that including our booking fee inside the maximum MOT fee is fine when we take the payment.
- Real payments (Stripe): hold the slot, take the payment, then confirm; refund automatically if the slot was taken.
  Pay garages their agreed fees (weekly payout statement in the garage dashboard).
- Staff screen to cancel an online MOT booking (frees the slot, refunds the customer, emails both).
- DONE 19 Nov 2026: garages set MOT times per MOT bay (up to 3 bays; more via contact us): days they test, first MOT,
  close time and time per MOT (30, 45 or 60 minutes). Diary > MOT times. The booking page and the database both use them.
- Real garages in the garage repair booking list too (same live diary, workshop bays).

### MOT go-live gaps closed (19 Nov 2026)
- DVSA test station number (VTS) asked on sign-up for MOT stations and garages that test MOTs; checked live against
  the DVSA list (gov.uk, 22,974 stations). Admin cards show the match. Refresh the list every quarter:
  open https://hctboldpuyztugpwexdy.supabase.co/functions/v1/vts-sync (reloads if older than 7 days).
- Admin > MOT bookings: list of online MOTs; the owner can cancel and refund (frees the diary slot, emails and texts
  both sides). Refund is marked "due" until it is refunded in Stripe, then "Mark refunded". Real refunds need Stripe.
- Still open from the go-live review: cancellation/no-show policy wording, weekly garage payouts and self-billing
  invoices, wrong-class handling, company registration, ICO registration, solicitor check of terms, DVSA written OK.

### MOT side (changed 21 Nov 2026 by the owner): flat £5 booking fee, no joining fee. Replaces the 18% model below.
- Customer pays the official maximum (e.g. £54.85 car). Test centre paid that less £5 (car £49.85, motorcycle £24.65,
  class 7 £53.60, class 5 £75.65). We keep £5 incl. VAT. No joining fee. Database: private.mot_payout (migration
  20261121g). Site, terms, sign-up, dashboards, admin, MOT video line and MOT pitch all updated the same day.
  Reason: the first MOT station visited (charges the full £54.85 himself) said no to giving away 18%.

### MOT side (OLD, replaced 21 Nov) (19 Nov 2026): 18% model. Do not change without the owner.
- Customer pays the official maximum (booking fee included). Test centre paid 82%, we keep 18% (incl. VAT).
- Site, terms (customer + partner), sign-up, dashboards, admin, video and database all match (checked 19 Nov 2026).
- Still to update outside the site: partner overview PDF and pitch PDFs, if they mention MOT fees.

### MOT station pricing (decided 19 Nov 2026)
- MOT test stations: no 5% fee, no Pro. No monthly fee, no commission. Income = maximum MOT fee minus agreed fee.
- Free to join for MOT stations that apply by 31 May 2027; from 1 June 2027 a one-off joining fee of £99.99 + VAT,
  charged once documents are approved (stored as joinFee on the application). Real charging needs Stripe.
- Garages that also test MOTs: MOTs carry no fee and are not part of Pro; repairs stay on 5% or Pro.
- Payout, no negotiation (19 Nov 2026): we pay 82% of the official maximum for every class and keep 18% (incl. VAT).
  Car (class 4) £44.98; motorcycle £24.31; class 7 £48.05; class 5 (17+ seats) £66.13. Database: private.mot_payout.

### Repairs pricing: OWNER THINKING IT OVER (discussed 19 Nov 2026, nothing built or decided yet)
- Problem: repair prices on the site are sample figures (made-up hours and parts, same for every car).
- Pricing by vehicle size rejected by the owner: labour time depends on exact model/engine (e.g. Ranger vs Navara).
- Proper price = labour time for that exact vehicle (licensed data by reg) x partner's own hourly rate + parts for that
  vehicle + fees. Data options to ask for API quotes: Autodata API, HaynesPro (Infopro), J.D. Power Repair Estimate
  (Glass's). Parts: supplier trade account (Euro Car Parts, GSF) or partner adds parts price.
- Idea until data is licensed: "Get a fixed quote" (partners see the exact vehicle and send a fixed price), with the
  instant-price engine built but switched off.
- Owner's view: with quotes, a % fee invites going direct, so repairs should move to a subscription.
- Ideas raised (not agreed): free until 31 May 2027, then e.g. £49 + VAT (mobile) / £99 + VAT (garage) a month;
  no customer booking fee on repairs; quotes within 2 hours; phone numbers hidden until a quote is accepted;
  pay after the job, guaranteed warranty; local and job pages for Google; licence the data soon after Saturday.
- Competitors: ClickMechanic (instant prices, pay online, 12-month warranty), BookMyGarage (free for customers,
  pay the garage), WhoCanFixMyCar (quotes).
- After this is settled: one video for mobile mechanics and one for garages, same audio.

### Intro video (customer) – next time it is updated
- Add the advantage of booking through us: customers can book any time, day or night, even when the garage is closed
  (asked 19 Nov 2026). Also update MOT pricing in it (official maximum, no extra booking fee) if it is mentioned.
- MOT station video (video/mot-station.mp4, 19 Nov 2026) shows on the join form only when "MOT test station" is chosen
  (not for "Garage"). Voice: Kokoro bf_emma (same British female voice as the intro and dealer videos).


### 2. Guided check: keeping the repair on the site (next steps)
The guided check is live in the search (see Done, 18 Nov 2026). Two parts are still to build, so a booking that starts
as "find the fault" still earns a fee on the repair:
- Paid diagnostic as the main fallback everywhere: where a customer still picks "let a garage or mechanic decide", offer
  the fixed-price diagnostic first.
- The repair stays on the site: after a diagnostic, the partner sends the repair price from the job screen, the customer
  approves and pays on the site, and the diagnostic fee comes off the repair if it is booked through the site. Partner
  terms to say work found through a Motoring Central booking is booked through it (solicitor to check the wording).
- More fixed prices: only 6 jobs have a fixed price today (full service, front brake pads, discs and pads, battery,
  engine light diagnosis, fault code scan). Every other result in the guided check asks partners for prices. Adding
  fixed prices for the most common results (alternator, starter motor, clutch, wheel bearings, air con regas) would let
  more customers book in one step.
- Have a working mechanic read through the questions and results (the script that starts "Guided check" in index.html)
  before launch, and adjust the wording from real customer feedback.

### 3. Smaller ideas, not done yet
- Which partners cover a postcode: waits for real partners. The sample partners have no real locations (their distances are
  made up), so showing "5 mechanics cover LS6" now would be invented. Build it with the shared database, storing each
  partner's postcode and how far they travel; the postcode look-up it needs is already in place.
- Search, next steps: keep a list of searches that found nothing (needs the shared database) so new words can be added.
- Cars and vans, later: email alerts for saved searches (needs the shared database and an email service), and showing saved
  searches in the customer's account; insurance group; ULEZ and tax band filters (these need extra vehicle data from the
  registration look-up).
- Car finance is SWITCHED OFF (18 Nov 2026, to save cash at launch; dealers handle their own finance). It is built and
  kept in the page. To switch it back on once FCA permission is granted: in index.html, in the script that starts
  "Car finance", set on:true, and put the finance FAQ back ("Car adverts show an example monthly price...").
- Car finance, background. Decided 18 Nov 2026: The Motoring Central will apply for FCA full permission for credit broking, and the site is
  being built on that basis. The preview now shows finance examples on car adverts (see Done). Still to do for finance:
  connect real lenders and their rates (a finance technology provider such as Codeweavers or iVendi does this); PCP as well as
  hire purchase (needs lenders' figures); an online application or eligibility check; van finance (business and VAT rules differ);
  and the forecourt picture on the cars page has "Finance Available" written in the image.

### 4. Go-live checklist (for later, when the site is ready)
Owner (business and legal):
- Try-it demo (23 Nov 2026): it can stay on at launch, because it uses no real data. Since 23 Nov it opens only from a
  personal link sent from the admin page (see "THE DEMO IS NOW ON REQUEST" under Done). The older "Demo logins" box on the
  partner log-in page is a different thing (preview only) and should still be removed.
- Partner recruiting at launch (22 Nov 2026): tell Claude the launch date so app_settings.founding_top_until can be set to
  three months after it (founding partners' first place ends then); point motoringcentral.co.uk at the live site so the
  leaflet QR codes work; only then print leaflets and start the paid advert test (pitch/adverts/). Check phone numbers
  against the TPS and Corporate TPS lists before calling, and do not email or text sole traders who have not asked.
- FCA: get full permission for credit broking BEFORE finance is shown on the live site. Until it is granted, finance must be
  switched off on the live site (in index.html, in the script that starts "Car finance", set on:false). Showing finance prices
  to the public without authorisation is against the law.
- Private adverts: solicitor to check the draft private-seller terms and both buyer notices (private sale and business sale); decide the refund rule (the draft
  says no refund if the car sells early); decide how reported adverts are handled and who checks them; consider checking the
  registration against DVLA records and limiting adverts per person, so traders cannot pose as private sellers.
- VAT (accountant, 18 Nov 2026): every fee we charge carries VAT; MOT test fees are outside VAT, but our booking fee
  on an MOT carries VAT. Customer prices are shown INCLUDING VAT (the law for consumer prices) with the VAT amount
  shown; partner and dealer prices are shown + VAT. Partner per-job fee is now 5% + VAT (6% in total during launch).
  Ask the accountant: the per-job fee and booking fee when we collect the job price on the partner's behalf (we only
  charge VAT on our own fee, not on the partner's price), and VAT on refunds less the £9.99 admin fee.
- Solicitor to check the refund and history check rules (agreed 18 Nov 2026; terms section "Selling your own car or van"):
  - Private sellers pay before entering the registration; one payment covers one vehicle and the registration cannot be changed.
  - Refund less a £9.99 admin fee (to cover the history check) if the check blocks the vehicle (stolen, scrapped, Category A
    or B), or if it shows finance and the seller wants a refund. No fee if the finance is paid off and the advert is published.
  - Paid but not finished: can finish within 6 days; refund within 14 days of paying, in full if the check has not run, or
    less £9.99 if it has. Fees not refunded if the car sells early or the advert is removed.
  - Advert approval (added 18 Nov 2026): every advert is checked before it goes live; the 30 days start when it goes
    live; a declined advert that cannot be fixed is refunded less £9.99 within 14 days; no refund if declined as a scam
    or deliberately misleading. Dealer terms: declined or waiting adverts count towards the plan limit.
  - Confirm the £9.99 is fair against the real cost of the check (Vehicle Data Global price) under the Consumer Rights Act 2015.
  - Check the wording about write-offs (sellers must answer honestly; write-offs shown on the advert) and that the history
    check result cannot be changed by the seller, and the disclaimer that third-party data is not guaranteed.
  - Dealer plan terms: history checks included per plan, extra checks and checks in the free months at £3.50 + VAT.
- Finance wording: replace the sample 11.9% APR with the real representative APR, fill in the FCA firm reference number and the
  commission wording (in [square brackets] on the site), and have all finance wording approved. Solicitor to update the terms,
  which still say finance is agreed between the buyer and the dealer.
- Register The Motoring Central Ltd at Companies House (until then, do not say "Ltd" on the site)
- Pay the ICO data protection fee
- DONE 27 Nov: RAC conflict of interest approved by the owner's manager (keep the written approval). The owner promotes
  the RAC only, never the AA. Next: the RAC's approval on Awin (see RAC BREAKDOWN COVER at the top)
- Sign up 3 to 5 real local partners for launch day
- Business email; business bank account and Stripe (needs the company); solicitor to check terms and privacy; business insurance

Building:
- Remove all sample partners, ratings, reviews, cars and demo logins, and the "Preview" banner (invented reviews must not be shown to real customers)
- Shared database and real, secure logins (the demo and admin logins are currently inside the page code)
- Secure upload and storage for partners' insurance and ID documents
- Real emails and texts for bookings, quotes and reminders
- Real card payments and paying partners (Stripe)
- Privacy notice and company details; let search engines index the live site
- Supabase dashboard, Authentication > URL Configuration: set "Site URL" to the live address (https://motoringcentral.co.uk)
  and add https://motoringcentral.co.uk/** under "Redirect URLs". Until this is done, every customer who taps the
  "confirm your email" link is sent to localhost:3000 (a dead page). Then test a fresh sign-up from start to finish.
- Point motoringcentral.co.uk (123-reg) at the site, then test everything on a phone
- Make the GitHub repository private (it is public now). This hides the site's code and all of its history. It needs
  Vercel's paid plan first: on Vercel's free plan a private repository only publishes changes made by the account
  owner, so Claude's updates would stop reaching the site; and the free plan is for non-commercial sites, so a business
  site needs the paid plan anyway. Order: move Vercel to the paid plan, then GitHub > the repository > Settings >
  General > Danger Zone > Change visibility > Private, then ask Claude to publish a small change to check it still works.

Option to consider: a soft launch taking quote requests only, before full booking and payments.

## Done
- 23 Nov 2026: THE DEMO CANNOT BE OPENED WITHOUT A VALID LINK ANY MORE. Before, the demo's sample businesses and guide were
  a public file on the site (js/demo.js) and the "has a link" check was made in the visitor's browser, so a technical
  person could get in. Now:
  - The demo's content (the "demo kit") is kept in the database, not on the site and not in this repository. The server
    hands it over only to a personal link that is right and has not ended, and only the part for that link's trade (a
    valeter's link carries the valeter demo and nothing else; a staff link carries all eight).
  - The server is asked again every time the page loads, so "Stop their link" on the admin page takes effect at once.
  - Tested: the old file is gone (404); changing the browser's saved flags does nothing; asking the server with a made-up
    link, or for the kit without a key, is refused; the tables cannot be read. With a valid link all eight demos open and
    every guide step still finds its place.
  - TO CHANGE THE DEMO (sample jobs, guide steps): it is no longer a file to edit. See the top of tools/demo-kit.js: a
    one-time key is switched on in the database for 15 minutes, the tool fetches the kit, you edit it, the tool puts it
    back. NEVER commit the kit to the repository (.gitignore blocks js/demo.js). Database: private.demo_kit,
    public.demo_kit(code, resume), demo_kit_get / demo_kit_put (refused without a key);
    supabase/migrations/20261123d_demo_kit_from_server.sql.
  - The old demo file was also taken out of this repository's public history (23 Nov, the owner's choice): the last 10
    commits were rewritten without js/demo.js and nothing else in them changed. Limit, checked the same day: GitHub still serves
    the old file to anyone who asks for it by an old commit's exact ID, and the repository's public activity feed lists
    some of those IDs, so an expert could still fetch it. Only GitHub Support can clear that (the owner has a draft
    request), or making the repository private (see "Before launch").
  - Also true of every website: the page's own code can be read by anyone, and a business that was sent a link can keep
    what it was shown.
- 23 Nov 2026: THE DEMO IS NOW ON REQUEST. The try-it demo is no longer open to everyone.
  - A business asks on the "Request a demo" page (#demo, or #demo-<trade> with the trade already chosen): type of
    business, business name, their name, email, and optionally phone, town and a note. "Try the demo" in the partner
    menu, the join pages, the FAQ and the search now say "Request a demo" and lead to this form.
  - We are emailed about each request, and it shows on the admin page: Partners > Demo requests (also on the To do list,
    with a count). "Send the demo" emails the business a personal link for its trade (#mydemo-<code>). The link works for
    30 days. The page shows whether it has been opened and how many times. Also: send again, copy the link, make the link
    without emailing, stop the link, close and reopen.
  - A personal link opens that one trade only. The server checks the link before the demo opens; a wrong or ended link
    shows a message and the request form.
  - The same admin page lists the eight request links to email to businesses (each with a Copy button), and gives each
    member of staff a link of their own that opens all eight demos, for showing someone in person (works for a year, can
    be replaced).
  - Tested with the real database: request, the three emails (to us, the acknowledgement, the demo link), sending from
    the admin page, opening the link, reloading, leaving and coming back, a wrong link, and the staff link.
  - (The limit noted here at first, that someone technical could still get in, was closed the same day: see the entry
    above.)
  - Code: supabase/migrations/20261123b_demo_requests.sql and 20261123c_demo_own_link.sql (table demo_requests;
    request_demo, demo_open, staff_demo_requests, staff_demo_send, staff_demo_set, staff_demo_own). index.html: search
    for "Request a demo" (the page and form) and "staff: demo requests" (the admin page). The email button wording is in
    supabase/functions/notify (v5). The links sheet is made by pitch/leaflets.js (page 2).
  - For the solicitor: the privacy policy now says we keep a business's name, email and phone when it asks for a demo,
    and whether the demo was opened. Demo requests marked TEST must be deleted before launch with the other test data.
- 23 Nov 2026: RECOVERY EXTRAS GO TO THE CUSTOMER IN ONE REQUEST. On a job, the driver taps "Add extras", ticks everything
  that is needed from the price list the customer saw when booking (with a number for waiting time and storage, and up to
  two "something else" lines with their own price), gives one reason, and sends them together. The customer gets one email
  and one card in My account showing each extra, the total and the reason. They can untick anything they do not agree
  to, then approve and pay once; or say no to all of it. With the customer beside them, the driver can have them sign once
  on the driver's phone for the whole list, and the customer then pays once. Only one request can be waiting on a job at a
  time: to change it, withdraw it and send a new one. Extras the customer unticked show as "Declined by the customer" on
  the driver's job.
  - Tested with the real database on a test job: 4 extras sent (123.00), customer unticked one and paid 93.00; then 2 more
    signed on a phone-sized screen and paid (65.00). Booking went from 105.99 to 263.99 and the company's pay from 84.48 to
    223.52 (88% of each extra), all correct.
  - Code: supabase/migrations/20261123a_extras_in_one_request.sql (request_extras, sign_extras, withdraw_extras,
    decide_extras; each request shares a "batch"). index.html: jobXHtml, xPicked, cxHtml. The recovery demo has a new guide
    step for it (in the demo kit). The older one-at-a-time functions are still in the database but the site no longer uses them.
  - The terms did not need changing: they already say an extra is only added once the customer approves and pays.
- 23 Nov 2026: EV CHARGING HAS A PRICE PER kWh. A charging company now sets three prices: its call-out, its price per kWh of
  charge, and its price per mile outside its area (join form, and Set-up > Your prices). The customer chooses how many kWh
  they want when they book (5 to 60; 10 is suggested for a rescue, 20 to get home, 30 for a booked top-up) and sees each
  part of the price. Price = call-out + kWh x price per kWh + extra miles x price per mile, plus our 9.99 booking fee.
  The server works it out (roadside function v11). A company that has not set a price per kWh charges its call-out only,
  as before. The company's job card shows "Charge paid for: N kWh". Tested on the live preview: 150 call-out + 20 kWh at
  0.85 = 167, customer paid 176.99, company paid 146.96.
  - Terms: the customer section now says how the EV price is made up. One sentence is in [square brackets] for the owner
    and solicitor to confirm: a refund for charge paid for but not delivered.
  - Updated to match: EV join page, EV video (two lines re-voiced, three slides, video/ev-charging.mp4), EV proposal, EV
    leaflet, EV advert picture and short advert video, the EV demo, tools/video/README.md.
  - Not built: adding more charge on the day (it is a new booking), and measuring what was really delivered.
  - Found on the way: the worked examples on the mechanic, recovery, tyre, valet and EV join forms still said partners
    keep 94%. They now say 88%, the same as everywhere else.
- 23 Nov 2026: WINDSCREEN CARD FITS ONE A4 PAGE. The card's contents were about 22mm taller than the page, so the QR code and
  phone number at the bottom were cut off. The card is now never taller than the printed page (also with wider printer
  margins); the photo takes the height left over, and a description that does not fit ends on a whole line.
- 23 Nov 2026: TRY-IT DEMO FOR EACH TRADE. A business owner can open the dashboard they would get, with a sample business
  and sample jobs, without an account. Eight trades: MOT stations, valeters, driving instructors, body shops and alloy
  wheels, auto electricians and locksmiths, car and van dealers, recovery, mobile EV charging.
  - Where: "Try the demo" in the partner menu (page #demo), a "Try the demo first" button on each join page, the footer,
    the FAQ and the site search. Direct links: #demo-mot, #demo-valet, #demo-instructor, #demo-body, #demo-autoelec,
    #demo-dealer, #demo-recovery, #demo-evcharge (add ?src=... before the # to keep the "Came from" tag).
  - What it is: the REAL dashboard code. While a demo is open, every call the dashboard makes to the database is answered
    from sample data kept in the visitor's own browser, so nothing is read from or written to the real database, no
    emails go out and no files are uploaded. Checked: no calls to the database during any demo. A real log-in is not
    affected, and logging in or signing up for real always leaves the demo first.
  - The guide: a panel (a column on the left on a computer, a button at the bottom on a phone) with six tasks for the
    trade. "Show me where" opens the right page and highlights the thing to press; each task ticks itself off when it is
    done. It ends with "Join the network", which goes to that trade's join page. "Start again" resets it.
  - Touches worth knowing: in the body shop and electrician demos the sample customer accepts the first price sent, about
    9 seconds later, and the paid job appears; in the MOT demo today's first MOT is always at a time that has passed, so
    "Tested" can be pressed at any hour; "Your results" is hidden in a demo because it counts real visitors.
  - Files: the engine is in index.html (search for "Try-it demo"); the sample businesses, jobs and guide steps are in
    the demo kit, which since 23 Nov is kept in the database (see tools/demo-kit.js), not in js/demo.js. IF A DASHBOARD FEATURE CHANGES, CHECK THE DEMO STILL MATCHES (ask Claude: it re-runs every step for all
    eight trades). Fees shown must stay: 10% + VAT (partner keeps 88%), 9.99 booking fee except MOTs and lessons, MOT
    stations 49.85 per car.
  - The links sheet for conversations now has a second page of demo codes, and the recruitment guide says when to show
    the demo (both sent to the owner, not kept here). "node leaflets.js links DIR" in pitch/ rebuilds the sheet.
  - Not in the demo: garages, mobile mechanics and tyre fitters (not opening at launch); what the customer sees when they
    book; real emails and payments. A message typed into "Chat to The Motoring Central" inside a demo is not sent, and
    the demo says so.
- 22 Nov 2026 (late): PARTNER RECRUITMENT PACK, READY BUT NOT TO BE ADVERTISED UNTIL THE COMPANY IS REGISTERED.
  The owner decided: launch area is Dartford and about 15 miles; no paid adverts, posts or bulk leaflets until the
  company is registered; until then the owner talks to local businesses himself for feedback and signs up the keen ones
  on the preview site; a paid test of £300 to £500 on Facebook and Instagram once registered.
  - Founding partners (migration 20261122w): the first 10 businesses APPROVED in each trade (not dealers, who keep their
    own first-30 offer) get founder_no, a "Founding partner" badge on their listing and dashboard, and first place in
    customers' results in their area. Join pages show "N of 10 places left". First place runs until the date in
    app_settings key founding_top_until; while that is empty it stays on. The 10% + VAT fee is the same for everyone.
  - Where an application came from: any link with ?src=something (or utm_source) is remembered for 60 days and saved
    on the partner (partners.source). Staff see "Came from: ..." on each application. Leaflet codes use leaflet-<trade>,
    the sign-up links for conversations use talk-<trade>, adverts use fb-<trade>.
  - Security fix found on the way (migration 20261122v): anyone could have changed or deleted approved partners through
    the public partner list. It is now read-only. Checked blocked.
  - pitch/leaflets/: one-page A4 leaflet for each of eight trades and one PDF with all of them. "node leaflets.js" in
    pitch/ rebuilds them. Their QR codes go to motoringcentral.co.uk, so they work only once the main address is live.
    The MOT, recovery and EV proposals now mention the founding offer, and the dealer proposal no longer promises full
    MOT history or mobile mechanics.
  - pitch/adverts/: a square (1080 x 1080) and an upright (1080 x 1920) picture for each trade, and
    The-Motoring-Central-Advert-Pack.pdf with the wording, links and test plan. "node adverts.js" rebuilds them.
    The photos are cropped so the banner artwork's own claims (nationwide network and so on) do not appear.
    Also a short upright video for each trade (<trade>-short.mp4, 22 to 26 seconds, same voice as the site videos):
    three screens under a slowly zooming photo. Made by pitch/shorts.js (draws the screens) and pitch/shorts.py
    (voice and video; needs the voice tools described in tools/video/README.md). Voice checked by speech recognition.
  - Sent to the owner and kept OUT of this public folder: the sign-up links sheet (QR codes to the preview site), the
    recruitment guide (what to say, likely questions, emails to send, rules on calls and emails, the caution about the owner's employer), and
    the contact list spreadsheet (all 854 MOT stations within 15 miles of Dartford from the DVSA list, 671 of them
    independents, plus starter names for the other trades found by web search and not checked).
  - New staff-only database function staff_mot_stations(list of postcode districts) (migration 20261122x), used to draw
    up the MOT list. Staff could be given a "stations near a postcode" page later if wanted.
  - Suggested question for the solicitor: may photo ID and insurance documents be collected from partners before the
    company is registered and its data protection registration is in place? Until answered, early sign-ups create the
    account and add documents later.
  - Not done: contact lists for trades other than MOT are starters only.
- 21 Nov 2026: MOT stations now pay a flat £5 booking fee per online MOT (was 18%), and the £99.99 joining fee is gone.
- 21 Nov 2026 (morning): owner's decisions done. (1) Launch offer on the site stays as it is; the pitches stay at full
  price and the owner explains the offer in person. (2) History checks in a dealer's free months are a choice: pay
  £3.50 + VAT, or list free without one. Without a check the dealer must declare the write-off status, the advert is
  marked "Not history checked" for its whole life, it is flagged for our team ("No history check (dealer's free
  months)") and buyers get a link to the free GOV.UK MOT history checker (our own MOT history card appears by itself
  once the DVSA API is connected). The database allows it only for approved dealers in their first 92 days
  (migration 20261121f). Works from the List form, the stock book and the spreadsheet upload. Dealer page, dealer
  terms, buyer FAQ, the dealer video line and the dealer pitch no longer say every car is checked. Tested on the live
  site with a new test dealer (vimen+dealer@, "TEST Dealer Dartford"): without a check from the List form and from the
  stock book, and with a paid check. (3) "Ltd" removed everywhere until the company is registered; the legal company
  details keep "[The Motoring Central Ltd]" in brackets with the other details to fill in.
- Fixed on the way: a new real dealer's stock list showed nothing until they tapped "All" (no filter was set).
- 21 Nov 2026 (early morning): SALES PITCHES. Four printable A4 proposals, 7 pages each, and one combined 28-page PDF,
  in the folder pitch/ (The-Motoring-Central-Partner-Proposals.pdf is the combined one; MOT stations, car and van
  dealers, recovery, EV charging). Full prices only, no launch offers. Each has: cover and vision, what they get and
  the money, how it works, a screenshot of their own tool, the protection page (vehicle inspection report, or PDI for
  dealers), the whole platform (trade cars and vans, Work in the motor trade, weekly payouts) and prices with a QR
  code to the join page on the preview site. To change wording or prices ask Claude: the text is in pitch/*.js and
  "node build.js" in that folder rebuilds the PDFs (screenshots are retaken with pitch/tools). The folders pitch/ and
  tools/, this file and the database files are no longer published on the website (.vercelignore).
- 21 Nov 2026: "Jobs" renamed "Work in the motor trade" across the site. Weekly hours rows on the recovery and EV
  dashboards and the "Date sold" box on the PDI form tidied.
- 21 Nov 2026: partner documents fixed. With "Confirm email" on there is no log-in at sign-up, so documents were
  never stored. They are now kept in the browser (IndexedDB, 7 days) and sent at the first log-in on that device;
  otherwise the dashboard shows "One more step: upload your documents". Staff see "No documents uploaded yet" on an
  application without them, and owners get a "Documents received" email (migration 20261121d).
- 21 Nov 2026: end-to-end tests on the live preview with real test accounts, done through the site in a browser
  (sign-up, documents, approval, booking with the preview payment, partner dashboard, emails). All three passed:
  RECOVERY (price £65 + £2.40 x 3 miles = £72.20 + £3 fee; partner paid £67.87; on my way, arrived, done; real messages
  both ways), EV CHARGING (£150 + £3; partner paid £141.00; all stages), MOT (station found by DVSA number, booked
  Mon 23 Nov 10:00 from the live diary, £54.85, station paid £44.98, we keep £9.87; in the station's diary).
  Fixed on the way: real MOT stations never appeared in the customer's garage list (the MOT bays column was not
  loaded); the #mot-station link opened step 2 in garage mode; real partners were shown invented ratings and sample
  reviews (now "New partner"); "Approved (demo)" on real partners; recovery emails said "Booking confirmed: Will not
  start" (migration 20261121e).
- 21 Nov 2026: chat with The Motoring Central team is real too (table support_messages, migration
  20261121c_support_messages.sql). Every logged-in customer and partner has a "The Motoring Central team" row in
  Messages. Staff see every conversation in their own Messages panel, grouped by person with name, phone, email and role,
  and reply as the team. A new message emails the owners; a team reply emails the person (one each way every 30 minutes).
  Tested: panel in a browser with pretend data (both sides); database rules with a dry run (people only see their own
  conversation, only staff can answer as the team). Not yet tried with a real staff log-in on the Staff page.
- 21 Nov 2026: one message system for the whole site (owner's decision). Customers and the partner doing their booking
  (garage, MOT station, mobile mechanic, recovery, tyres, valeting, EV charging) can now message each other for real:
  table booking_messages (migration 20261121b_booking_messages.sql), shown in the same Messages panel as car and van
  messages, grouped by customer for partners, with the booking it is about. The other person gets an email (at most one
  per booking and direction every 30 minutes). Any booking from the last 60 days appears in Messages so either side can
  start the conversation. Tested: panel in a browser with pretend data; database rules with a dry run (only the customer
  and the partner of a booking can read or send; emails queue). The old browser-only booking chats are hidden for real
  accounts.
- 21 Nov 2026: messages about cars and vans are now in the Messages button that is on every page (bottom right) and
  in a "Messages" link in the header. Both turn red and show the number of new messages. The list shows a dealer's
  conversations grouped by customer (name, phone) with the car or van each one is about (title, registration, price,
  mileage); opening one shows the conversation with a reply box and the viewing buttons. Tested in a browser with
  pretend data. This replaces the "You have a new message" button added earlier the same day.
- 21 Nov 2026 (after the email tests): new messages about cars and vans now show a "You have a new message" button on
  every page until read, and unread conversations open by themselves in My account and the dealer dashboard. Quote
  email reworded ("You have a new quote: £x from <partner>"; migration 20261121_quote_email_wording.sql). Real dealers
  now start with an empty stock book (the 5 sample vehicles are only for the demo log-in). Decided by the owner: stock
  needs no approval, advertising does (a stock vehicle may go to trade instead). The 21 Nov test accounts were removed.
- 21 Nov 2026: emails switched on and tested end to end (Google Workspace mailboxes, Resend, Supabase). Fixed on the
  way: dealer sign-up no longer says "You can now list cars and vans" before approval; the stock book's "Advertise on
  Motoring Central" button now runs the vehicle history check (before, the database refused the advert and nothing
  reached staff); adding to stock says the vehicle is not on the website yet.
- 20 Nov 2026: MOT fixed in the intro, dealer and MOT station videos. It was spoken as three separate letters
  ("M. O. T.") and is now said smoothly as one word, "em-oh-tee", the way people say it. Only the lines with MOT
  were re-voiced (same voice, same speed); everything else is unchanged. Rule for future videos: write "MOT" as
  it is in the script, never "M O T" (the voice already says MOT correctly). The EV charging video has no MOT.
- 20 Nov 2026: all four videos (intro, dealer, MOT station, EV charging) re-voiced: the web address is now said
  "motoring central dot co dot uk", MOT, RAC, EV and DVSA are spelled out letter by letter, prices and percentages
  are read in full, and the delivery is a little slower with natural pauses between sentences. Same pictures, same
  British female voice (Kokoro bf_emma), captions retimed. Rule for future videos: always write the spoken script
  out in words ("dot co dot uk") before making the voice.
- 20 Nov 2026: EV charging "why join" video (video/ev-charging.mp4, 1 min 48, same British female voice, Kokoro
  bf_emma, with captions). It replaces the banner on the #evcharging join page and starts by itself when the page
  opens (muted with "Tap for sound" if the browser blocks sound). It does not promise work: it says drivers find
  them here, rescues and booked top-ups, their own prices, automatic bookings, paid upfront.
- 20 Nov 2026: automatic bookings for EV charging and recovery partners. On the dashboard "Call-outs" card they set
  weekly opening hours (UK time, overnight allowed), how many vans or trucks take jobs at once and how long a job
  takes, and tick "Take bookings automatically in my hours". In their hours they are available for jobs needed now
  without pressing Available; booked times are only offered when they are open; never more jobs at once than vans.
  When nobody is free, the customer is offered the next free times and can tap one to see prices for it.
  Code: supabase/migrations/20261120b_roadside_auto.sql (set_roadside_auto) and the roadside function (version 4).
  Tested on the server with a temporary partner (removed). Still to do: text alerts to partners for new jobs.
- 20 Nov 2026: recovery and mobile EV charging brought up to the MOT and car sales standard.
  - Customers: new forms (postcode or "Use my location", exact spot, where to take it, what happened, vehicle type,
    winching, keys, passengers, now or a booked time; for EV: need, plug, battery). Prices and the list of companies
    come from the server function "roadside" (real postcode distances from postcodes.io, each partner's own rates,
    their area and whether they are taking call-outs now). No account needed to see prices; sign in to book.
    Pay (preview payment screen) then book: the server writes the booking with its own price and our share.
  - Price: recovery = call-out + price per mile x miles carried + winching extra. EV = call-out (includes the charge)
    + price per mile beyond their area (up to 40 miles beyond). Booking fee £3 on top. Our fee 6% (5% + VAT) on Pay as you
    go, 0% on active Pro.
  - My account: "Recovery and EV charging" card with live status, the driver's phone, and Cancel (full refund before
    they set off; once on the way their call-out fee is kept and paid to them).
  - Partners (dashboard "Call-outs" card): go available for 4, 12 or 24 hours, depot postcode and how far they travel,
    vehicles or connectors, winching extra, jobs with Map and Directions links, call the customer, On my way / Arrived /
    Job done, "I can't do this job" (customer fully refunded), monthly statement (printable).
  - Staff: admin card "Recovery and EV charging bookings" with cancel and refund, and Mark refunded.
  - Partners can no longer cancel a booking by changing its status directly (database guard); cancelling goes through
    cancel_roadside, decline_roadside or staff_cancel_roadside. Emails to customer and partner as for other bookings.
  - Join pages now save depot postcode, area, fleet, availability, vehicles or connectors and jobs.
  - Terms section 7: how the price is worked out, cancelling and emergencies.
  - When no real partner covers a place, sample companies are shown (clearly labelled, booking is preview only).
    To hide them at launch: Supabase > Edge Functions > Secrets: ROADSIDE_SAMPLES=0.
  Code: supabase/migrations/20261120_roadside.sql, supabase/functions/roadside, and the block
  "20 Nov 2026: recovery and mobile EV charging" in index.html. Tested on the server with a temporary test partner
  and customer (removed afterwards); the full pay-and-book needs a real customer log-in to try on the preview.
  Still to do: "Need it delivered?" on car adverts still uses its own simple pricing (move it onto the roadside
  function); text alerts to partners for jobs needed now (needs the SMS service); payment checked by Stripe.
- 19 Nov 2026 (night): dealer, car sales and MOT tools (no email, Stripe or paid data needed).
  - Windscreen cards (A4, colour): the dealer's logo, name, town, website, rating and phone, in our website's blue theme
    (sky blue header, navy price and footer), with the car photo, price (and saving if reduced), details and a QR code
    that opens the advert). "Print windscreen cards for all" on the dealer dashboard. QR library: js/qrcode.min.js (MIT).
  - Advert links: ?ad=<advert id>#cars or #vans opens one advert ("Copy the advert link" on the seller's own advert).
  - Stock age and price tips on "How your adverts are doing": days listed (recorded by our server, data.since),
    comparison with similar cars on the site, and a nudge after 21 days with no enquiries.
  - ULEZ and Clean Air Zones: badge on cards and adverts, plus a filter. Worked out from fuel and age (petrol Euro 4:
    cars 2006+, vans 2007+; diesel Euro 6: cars Sept 2015+, vans Sept 2016+), with a link to the TfL/GOV.UK checkers.
  - Price history on adverts ("reduced twice, now £800 less"), recorded by our server on every price change (data.ph).
  - Free MOT reminders for anyone (home page "Set one up", the MOT booking page and My account): reg, email and MOT
    due date ("Find it for me" uses the reg look-up). Emails 30 and 7 days before, with a stop link (?motstop=).
    Table mot_reminders; queued daily at 17:00 by the 'mot-reminders' job; they go out once emails are switched on.
  - MOT station tools (Diary tab): today's tests, Tested / No-show buttons for online bookings, a printable test sheet
    and a monthly statement of payouts (printable). Admin MOT list shows no-shows.
  - DECISION FOR THE OWNER: a no-show is currently paid to the test centre as normal (customer did not cancel) and not
    refunded. Change in public.mot_outcome and the wording on the MOT tools card if you want a different rule.
  Code: supabase/migrations/20261119h_dealer_mot_tools.sql and the block "19 Nov 2026 (later): windscreen cards..."
  in index.html.
- 19 Nov 2026 (evening): car sales tools that need no email, business details or Stripe.
  - Leads inbox ("Your leads") for dealers on the dashboard and for private sellers in My account: every buyer who
    messaged or asked for a viewing, with status (New, Contacted, Viewing booked, Sold, Lost), notes, a follow-up date
    (due ones are highlighted), Call button, this month's totals, and "Open the conversation". Table: advert_leads.
  - Part exchange: on dealer adverts, buyers can add their car's reg and mileage to a message or viewing request; the
    dealer sees it in the lead and the chat, with "Show the car" (uses the registration look-up, only when tapped).
  - Price reduced: sellers can change the price on their own advert page ("Change the price"). Lowering it shows a green
    "Reduced £X" label on the card and advert for 30 days. Worked out by the database, so it cannot be faked.
  - Private adverts: Renew now really extends the advert for buyers (before, it only changed on the seller's device).
    My adverts shows "ends in N days" reminders with a Renew button, and views, saves and enquiries for each advert.
    Only staff or a renewal can change when an advert ends.
  - Report this advert (all adverts, logged-in buyers): reason and note go to the new "Reported adverts" card on the
    admin page (take it down or dismiss), and an email to owners (sent once emails are on). Table: advert_reports.
  - "Buying safely" tips under the message box on every advert.
  Code: supabase/migrations/20261119g_car_sales_tools.sql, and the block "19 Nov 2026: leads inbox..." in index.html.
  When Stripe is set up: renew_advert() and new private adverts must check the payment on the server (now the site's
  payment screen is trusted, as everywhere else in the preview).
- 19 Nov 2026: separate join pages. #mot-station (MOT only: 82% paid, no monthly fee, free to join until 31 May 2027,
  pricing table, MOT earnings slider, MOT video, form fixed to MOT station with no labour rate or repair jobs), #garage
  (repairs on 5% or Pro, plus "How MOT pricing works" and the "We also do MOT tests" tick box), #mobile-mechanic and
  #auto-electrician (no MOT content). #mechanics is still the general page with a choice of all four. Join the network now
  has a card for each. Launch banner text matches the trade.
  Recruiting phase: to show only some trades on Join the network (e.g. MOT stations and dealers first), set
  RECRUIT=['mot','dealer'] in the script that starts "Join pages by trade" in index.html (Claude can do it).
- 19 Nov 2026: usability pass (phone and desktop). Phone menu now has "Sell a car or van" and "Help and contact", and the
  log-in links are proper buttons. The customer log-in box has a clear yellow Log in button and, if a partner is signed in,
  a "Log out of the partner account" button. The launch banner can be closed (stays closed for the visit). Cars and vans on
  a phone show results straight away, with filters behind a "Filter and sort" button that counts what is set. An open advert
  hides the big banner, and on a phone a bar at the bottom offers "Message dealer/seller" and "Book a viewing". Join the
  network has "I am a:" buttons at the top. Partner dashboard: today's booked jobs come first, quick actions start with
  everyday work (diary, rates, documents, inspection, service sheet, help) and trade and job adverts follow; on a phone
  they show as a compact 2-column grid. The long MOT class list folds away, showing how many classes are ticked.
  Code: the block that starts "Usability pass (19 Nov 2026)" at the end of index.html.
  Still worth doing later: a sticky section bar on the dashboard, and the dashboard checked with real partners.
- 18 Nov 2026: guided check in the search ("Help me work out what's wrong"). Picking a problem such as "Brakes squeal",
  "A warning light is on" or "My car won't start" now asks 1 to 3 plain questions, then shows the most likely job, why,
  other things it could be, and a fixed-price diagnostic if the customer is still unsure. 28 questions lead to 95 results
  across warning lights, not starting, flat battery, brakes, noises, leaks, smoke, overheating, loss of power, clutch and
  gears, steering, air con and heater. Dangerous answers (soft brake pedal, red oil or temperature light, fuel leak, fumes)
  show "Do not drive the car" and a recovery button. The customer's answers are sent to the partner with the request.
  Every result says it is a guide, not a diagnosis. "Let a garage or mechanic decide" is still there, as the second option.
  Also fixed: choosing a repair from the search on a fresh visit now opens that job's request form every time.
- 18 Nov 2026: every listing form now asks "Is VAT added to this price?" (dealer cars, dealer vans, and the private-seller
  form). "+ VAT" adverts show the price + VAT with the price including VAT underneath, on cars as well as vans. On the private
  form, "+ VAT" is for a VAT-registered business selling its own vehicle: that advert is marked "Business sale" (not "Private
  sale"), shows "Business seller (not a dealer)" and has its own buyer notice. Car price filters and sorting use the price
  including VAT; van filters stay before VAT. No finance examples on + VAT cars.
- 18 Nov 2026: the first menu item is now "Home" (was "Book a service"). The home page has a yellow "Sell a car or van"
  button under the search. Private selling now covers vans and pickups as well as cars: the form asks which, vans get their
  own types and an optional payload, private vans show no VAT, and the vans page has its own "Sell your van" button, Private
  sale label, buyer notice and Seller filter. "My adverts" in the account lists both.
- 18 Nov 2026: private sellers can advertise their own car. £29.99 including VAT for a 30-day advert, no commission; £14.99 more
  makes it a premium advert (front-page banner and Featured label for 2 weeks or until sold). Needs a free customer account.
  Every private advert carries a yellow "Private sale" label, shows "Private seller" and the town only, and has a notice for
  buyers explaining their rights and what to check. Buyers message through the site unless the seller chooses to show a phone
  number. No finance examples on private adverts. Sellers manage adverts under My account (messages from buyers, make premium,
  add 30 days, mark as sold, remove). Prices are set on one line: FEE and PREM in the script that starts "Private sellers". There is a "Seller" filter (dealers or private), a "Report this advert" link, a limit of
  3 live private adverts per account, FAQs, and draft private-seller terms.
- 18 Nov 2026: saved searches for cars and vans. "Save this search" appears once a filter is set; saved searches are listed
  under the filters with how many match now and a "new" badge when more have been listed since. Kept on the visitor's own
  device for now.
- 18 Nov 2026: read the logged-in screens (customer account and booking steps, mechanic and dealer dashboards) for plain English.
  They read clearly; small fixes only: the dashboard now says "Mobile mechanic" or "Garage" instead of the long role name,
  "our fee (5% launch rate)", and "Pads and discs for both front wheels" instead of "axle set".
- 18 Nov 2026: car finance examples (preview illustration, sample rate of 11.9% APR). Each car advert shows "or about £X a month";
  a representative example sits above the results; each advert has a calculator (deposit slider, 2 to 5 years) with the full
  breakdown, a plain-English "How does this work?", and "Ask about finance on this car", which fills in the message to the dealer.
  A "Monthly budget" filter and searches like "cars under £200 a month" work too. Cars only, not vans. Everything is tagged
  "Preview example" and the credit broker wording has placeholders for the FCA number.
- 18 Nov 2026: partner and dealer sign-up is now four numbered steps (About you, Your work, Your documents, Your plan) with
  Back and Next buttons and a progress line. Step 1 is checked before moving on; on Submit, if anything is missing the form
  opens the right step and highlights the box.
- 18 Nov 2026: exact postcode look-up for car and van distance, using Postcodes.io (free, no account). A full postcode or the
  first half ("LS6") both work; the postcode carries across the cars and vans pages. Dealers can add the postcode where a vehicle
  can be viewed (only the distance is shown to buyers). If the look-up cannot be reached, it falls back to the rough postcode area.
  The privacy policy draft now has lines for the postcode look-up and for voice search. For the live site, store every dealer's postcode.
- 18 Nov 2026: intro video remade as a full tour for customers (1 min 46 s, female voiceover, captions): search and microphone,
  "Let a garage or mechanic decide", the four booking steps, all services, cars and vans search, breakdown cover, My account and help.
  The files to remake it are not in the repo; if the site changes a lot, ask for the video to be remade.
- 18 Nov 2026: full search filters for cars and vans, in the style of the big car sites. Postcode and distance, make and model,
  price from and to, year from and to, mileage, gearbox, fuel, body type, colour, doors, seats, engine size (vans: type and payload),
  keyword, and sort (including nearest first). Every choice shows how many vehicles match, choices with none are greyed out,
  filters in use show as removable chips, and filters are kept while you look at an advert and come back.
  "Not sure what these mean?" explains gearbox, fuel, body types and payload in plain English. The front-page search now opens
  these filters already set (for example "automatic under £20,000"). Ten more sample cars were added so every filter has stock.
  Dealers adding a car can give doors and seats. The code is the script that starts "Cars and vans for sale: the search filters".
- 18 Nov 2026: plain-English review of the other services. Bodywork: no more "smart repair", "paintless dent removal", "panels"
  or "refurb" without an explanation; diamond-cut wheels and insurance excess explained. Tyres: budget, mid-range and premium explained.
  EV charging: plug types explained, with "Not sure" first. MOT: plainer wording. "Get your exact price" now says why the
  registration is needed for each service. Notes meant for the owner ("your own partners load here") no longer show to customers.
- 18 Nov 2026: partner sign-up check. Every sign-up form now starts with what to have ready (two insurance certificates and photo ID,
  about 5 minutes), and if something is missing the page jumps to that box, highlights it and says what is wrong, instead of
  showing a message at the bottom of a long form.
- 18 Nov 2026: microphone button in the search (front page and the Search button's pop-up). Tap it and say what you need;
  the words appear in the box and the results follow. It only shows on phones and browsers that can listen (Chrome, Safari, Edge),
  and asks the visitor's permission the first time. The speech is turned into text by the visitor's own browser (Google or Apple),
  so add a line about this to the privacy policy before launch.
- 18 Nov 2026: the search now reaches the whole website. One box understands everyday words and finds problems (34 of them,
  from "brakes squeaking" to "put the wrong fuel in"), services, every repair job, cars and vans for sale ("Ford Fiesta",
  "automatic under £20,000", "electric car"), questions and answers ("can I cancel?"), motor trade vacancies, the customer's
  bookings and log in, contact and call back, and the partner pages ("I am a mechanic and want more customers").
  Results are grouped under plain headings, forgive small spelling slips, and a typed registration is recognised.
  A Search button sits at the top of every page (or press / on a keyboard). A link can carry a search: add ?q=brakes to the address.
  The search code is the script that starts "Site-wide search" near the end of index.html.
- 18 Nov 2026: small fixes. "Request a call back" links go straight to the form; "Get an RAC quote" opens the RAC website
  in a new tab; the cookie choice now comes before the intro video, and the video closes if the visitor moves to another page;
  the logo shows as the browser tab and home-screen icon (favicon.svg, apple-touch-icon.png).
- 18 Nov 2026: numbered booking steps (1 the job, 2 your car, 3 choose a partner, 4 book and pay) at the top of every
  booking, for all nine services. They follow the customer as they scroll, and each can be tapped to jump to it.
- 18 Nov 2026: shorter front page (about 7,100 down to 5,600 pixels tall on a phone): removed the duplicate "Why book" section
  (its two unique points moved into "Car care you can actually trust"), hid "Popular repairs" (the search chips cover it),
  and slimmed the top banner so the search is the first thing people see.
- 17 Nov 2026: 1-minute intro video for customers (female voiceover, captions) in video/. It plays once, muted with
  captions, for new visitors on the front page ("Tap for sound"), and any time from "Watch how it works (1 min)".
  If the site changes a lot, the video needs remaking so it still matches the screens.
- 17 Nov 2026: front page now has one "Type what you need" search instead of the service tiles. It matches everyday
  problems, services and jobs as people type, with quick chips (Car service, MOT, Warning light and more), and always
  offers "Let a garage or mechanic decide", which sends the customer's own words to local garages and mobile mechanics.
  The tiles are still there behind "Browse all services". Bookings also say the partner checks first and asks before extra work.
- 17 Nov 2026: ease-of-use review. Added "Not sure what you need?" (15 everyday problems that open the right service),
  plain-English subtitles on every front-page tile with services first, plain-English explanations on 64 technical jobs,
  cars first on the MOT list ("Most cars are Class 4"), an explanation of Budget, Standard and Premium parts,
  and a shorter job list when booking.
- 17 Nov 2026: live registration look-up switched on (Vehicle Data Global key added in Vercel) and tested by the owner.
- 17 Nov 2026: real bookings now carry the job booked (for example Full service), the fuel, the
  gearbox and the engine size from the registration look-up, so the service sheet and inspection
  fill in properly.
- 17 Nov 2026: quote requests from "Need something else?" now show on the dashboards of partners
  who offer that job. Partners send a price, and the customer sees the quotes in My account and can book one.
- 17 Nov 2026: customers can search and browse every repair when booking.
- 17 Nov 2026: mobile mechanics and garages tick the services they offer (about 130 jobs).
- 17 Nov 2026: vehicle service sheet (update pack TMC-UPD-20261117-A).
- MOT station video link to send to test stations: motoringcentral.co.uk/#mot-station (opens the join form with MOT test station chosen and plays the video).
