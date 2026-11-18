# The Motoring Central: what is left to do

This is the running list of work still to do before launch. When the owner asks
"what is left to do?", answer from this file, and tick items off here as they are finished.

Preview site: https://preview.motoringcentral.co.uk

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
- Forgotten password (reset by email) and changing account details
- Two-step sign-in for staff (authenticator app); adding and removing reviewers from the admin page
- Real partners in the remaining booking lists (garages and MOT, valeting centres, bodywork, alloys, EV charging)
- Chat between customer and partner, partner logo, and buyers' messages on adverts, in the database
- Payments checked on the server (Stripe) before an advert or booking is accepted; at the moment the preview trusts the page
- Service sheets, vehicle inspections and PDIs saved against the booking
- Customers list on the admin page from the database; chat messages, saved searches, failed-search list
- Remove the demo logins and sample partners (they still show next to real ones on the preview)
- Data protection: privacy notice says where data is kept (done); ICO fee; who can see what

### 2. Smaller ideas, not done yet
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

### 3. Go-live checklist (for later, when the site is ready)
Owner (business and legal):
- FCA: get full permission for credit broking BEFORE finance is shown on the live site. Until it is granted, finance must be
  switched off on the live site (in index.html, in the script that starts "Car finance", set on:false). Showing finance prices
  to the public without authorisation is against the law.
- Private adverts: solicitor to check the draft private-seller terms and both buyer notices (private sale and business sale); decide the refund rule (the draft
  says no refund if the car sells early); decide how reported adverts are handled and who checks them; consider checking the
  registration against DVLA records and limiting adverts per person, so traders cannot pose as private sellers.
- Finance wording: replace the sample 11.9% APR with the real representative APR, fill in the FCA firm reference number and the
  commission wording (in [square brackets] on the site), and have all finance wording approved. Solicitor to update the terms,
  which still say finance is agreed between the buyer and the dealer.
- Register The Motoring Central Ltd at Companies House (until then, do not say "Ltd" on the site)
- Pay the ICO data protection fee
- RAC conflict of interest form approved in writing, and an agreement with the RAC before selling their breakdown cover
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

Option to consider: a soft launch taking quote requests only, before full booking and payments.

## Done
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
