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

### 2. Ease-of-use ideas from the 17 Nov review (smaller, not done yet)
- The postcode box at the top of the front page only scrolls to the services. It could show partners near that postcode.
- The front page is very long on a phone. Some "why choose us" sections repeat and could be merged.
- Show the customer's progress through booking (choose job, see prices, choose partner, pay) as numbered steps.

### 3. Go-live checklist (for later, when the site is ready)
Owner (business and legal):
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
