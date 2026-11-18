# The Motoring Central: what is left to do

This is the running list of work still to do before launch. When the owner asks
"what is left to do?", answer from this file, and tick items off here as they are finished.

Preview site: https://preview.motoringcentral.co.uk

## To do

### 1. Shared database for live bookings (needed before launch)
At the moment the preview saves everything in each person's own browser, so a customer
who books on their phone is not seen by a partner on another phone. A shared database
is needed so that, across all devices:
- customer bookings reach the right partner straight away
- quote requests reach every partner who offers that job, and their quotes reach the customer
- completed service sheets, vehicle inspections and PDIs are saved against the booking, so
  the customer sees their service history and admins can view them in a dispute
- partners' chosen services, rates, diary and documents are kept

Decisions needed first: which database (for example Supabase, or Vercel's own storage), the
monthly cost, and data protection (privacy notice, ICO registration, who can see what),
because it will hold real customers' names, phone numbers, addresses and registrations.
This belongs in the real site rebuild (branch `nextjs-rebuild`).

### 2. Smaller ideas, not done yet
- Which partners cover a postcode: waits for real partners. The sample partners have no real locations (their distances are
  made up), so showing "5 mechanics cover LS6" now would be invented. Build it with the shared database, storing each
  partner's postcode and how far they travel; the postcode look-up it needs is already in place.
- Search, next steps: keep a list of searches that found nothing (needs the shared database) so new words can be added.
- Cars and vans, later: email alerts for saved searches (needs the shared database and an email service), and showing saved
  searches in the customer's account; insurance group; ULEZ and tax band filters (these need extra vehicle data from the
  registration look-up).
- Car finance. Decided 18 Nov 2026: The Motoring Central will apply for FCA full permission for credit broking, and the site is
  being built on that basis. The preview now shows finance examples on car adverts (see Done). Still to do for finance:
  connect real lenders and their rates (a finance technology provider such as Codeweavers or iVendi does this); PCP as well as
  hire purchase (needs lenders' figures); an online application or eligibility check; van finance (business and VAT rules differ);
  and the forecourt picture on the cars page has "Finance Available" written in the image.

### 3. Go-live checklist (for later, when the site is ready)
Owner (business and legal):
- FCA: get full permission for credit broking BEFORE finance is shown on the live site. Until it is granted, finance must be
  switched off on the live site (in index.html, in the script that starts "Car finance", set on:false). Showing finance prices
  to the public without authorisation is against the law.
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
- Point motoringcentral.co.uk (123-reg) at the site, then test everything on a phone

Option to consider: a soft launch taking quote requests only, before full booking and payments.

## Done
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
