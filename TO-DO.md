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

### 2. Live registration look-up
The code is ready. It switches on once `VDG_API_KEY` (the Vehicle Data Global API key) is added in
Vercel under motoring-central-gum8 → Settings → Environment Variables, and the site is redeployed.
Check: https://preview.motoringcentral.co.uk/api/vrm?probe=1 shows `"live":true`.

## Done
- 17 Nov 2026: real bookings now carry the job booked (for example Full service), the fuel, the
  gearbox and the engine size from the registration look-up, so the service sheet and inspection
  fill in properly.
- 17 Nov 2026: quote requests from "Need something else?" now show on the dashboards of partners
  who offer that job. Partners send a price, and the customer sees the quotes in My account and can book one.
- 17 Nov 2026: customers can search and browse every repair when booking.
- 17 Nov 2026: mobile mechanics and garages tick the services they offer (about 130 jobs).
- 17 Nov 2026: vehicle service sheet (update pack TMC-UPD-20261117-A).
