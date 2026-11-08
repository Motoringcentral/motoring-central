# The Motoring Central: Project Notes

This file tracks what we've built and what comes next.
To pick up again on another day, tell Claude Code: "Read PROJECT-NOTES.md and remind me where we got to."

## What this is
A real website for **The Motoring Central** (motoringcentral.co.uk). It is being rebuilt from the working prototype in `prototype.html`.

- **Tech:** Next.js (the website) + Supabase (database, logins, file uploads)
- **Later:** Stripe (payments, TEST MODE until launch), Resend (emails), Vercel (hosting), DVLA API (reg lookup)
- **Brand:** sky blue, navy, yellow highlight; wordmark "THE MOTORING CENTRAL"
- **Build guide:** `Downloads\Motoring-Central-Build-Guide.pdf`

## What's in the prototype
- **Customer:** homepage and booking, breakdown, tyres, valeting, recovery, EV charging, cars, vans, account
- **Partners:** join as a mechanic, network, dealers, trade
- **Behind the scenes:** login, dashboard, staff, admin
- **Info:** about, terms

## Progress (the 10 phases)
- [x] Setup: Next.js project created
- [ ] Phase 1: Look and public pages
- [ ] Phase 2: Logins (Supabase)
- [ ] Phase 3: Join the network and admin review
- [ ] Phase 4: Reg lookup
- [ ] Phase 5: Bookings and garage diary
- [ ] Phase 6: Cars and vans for sale
- [ ] Phase 7: Payments (TEST MODE)
- [ ] Phase 8: Emails and Facebook
- [ ] Phase 9: Go live
- [ ] Phase 10: Other languages

## Log
- **2026-11-08:** Copied the prototype from Claude into this folder as `prototype.html`. Created this notes file. Saved the first version with git.

- **2026-11-08:** Created the Next.js project (Next.js 16, React 19, Tailwind, TypeScript) and installed its packages. The test site runs at http://localhost:3000 (start it with `npm run dev`). npm reported 8 "moderate" warnings in the starter packages; we'll review them before launch.

## Next step
Phase 1: build the public pages (homepage, services, About us, terms) from prototype.html.
