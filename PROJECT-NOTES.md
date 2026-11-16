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
- [x] Phase 1: Look and public pages
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

- **2026-11-08:** Phase 1 done. Built the homepage (`/`), Our services (`/services`), About us (`/about`) and Terms (`/terms`) in the brand colours, with the logo and a header and footer. Checked on desktop and phone, and a full production build passes.

- **2026-11-16:** Update **TMC-UPD-20261115-A** (vehicle inspection + PDI) applied as far as the site allows. The update pack is `E:\MOTORING CENTRAL\TMC-UPD-20261115-A.zip`. Built two working forms. Both forms are checked on desktop and phone, and the build passes:
  - `/inspection`: the partner's pre-work vehicle inspection. It has a booking picker that fills in and locks the details. Mileage is typed by hand. It also has the fuel slider, the tap-on car damage diagram, quick checks, camera photos, notes, both signatures (or "customer not present"), the agreement box and the warranty wording. "Finish & save PDF" makes the PDF and marks the job "Inspected at HH:MM". Open a job directly with `/inspection?job=TMC-10482`.
  - `/pdi`: the dealer's pre-delivery inspection. It has a stock picker that fills in and locks the advert details. It also has sale, buyer and vehicle details, the OK/Fixed/Advise/N/A checklist (plus van extras for vans), tyres, the damage diagram, photos, work and advisories, both signatures, buyer acceptance and the dealer-responsibility wording. The PDF marks the vehicle "PDI ✓ date". Open one directly with `/pdi?vehicle=demo:1`.
  - For now both forms use **sample** bookings and stock (`src/lib/inspections.ts`). Drafts and finished records are kept only in the browser on that device.

## Update TMC-UPD-20261115-A: still to do in later phases
- **Phase 2 (logins):** put `/inspection` behind partner logins and `/pdi` behind dealer logins. Fill in the partner, technician and dealer from the account, not the sample data.
- **Phase 3 (dashboards):** add a "Your booked jobs" card at the top of every partner dashboard (all partner types, not dealers), with that partner's own bookings in time order. Show time, customer, service, job number, address (mobile jobs), reg and car, and status. Each job gets a large "Start vehicle inspection" button linking to `/inspection?job=<job number>`, plus "Inspected at HH:MM" once it's done.
- **Phase 4/5 (reg lookup, bookings):** when a customer books, store their vehicle (registration and the looked-up make, model, colour, year, fuel and gearbox) on the booking. Replace `SAMPLE_BOOKINGS` with the partner's real bookings.
- **Phase 6 (cars and vans):** add a PDI button on every vehicle in the dealer's stock list, a "Pre-delivery inspection" button on the dealer's own adverts, and a Quick actions tile. Each links to `/pdi?vehicle=<id>` and shows "PDI ✓ date" when done. Replace `SAMPLE_STOCK` with the dealer's real stock.
- **Database (with Phase 5/6):** save every inspection and PDI in Supabase against its booking or vehicle: form data, photos, signatures and the PDF. Only the partner or dealer who owns the job or vehicle can create or view it, and admins can view all, for disputes. This replaces `saveRecord()` in `src/lib/inspections.ts`.

- **2026-11-16:** **The preview site (https://preview.motoringcentral.co.uk) is the full prototype, not this rebuild.** For a short while this rebuild replaced it, which hid most of the site, so the prototype was put straight back.
  - Update TMC-UPD-20261115-A is live on the preview, added to the full site with nothing removed. Partner dashboards have "Your booked jobs" with "Start vehicle inspection" (`inspection.html`), and dealers have PDI buttons on stock and adverts plus a Quick actions tile (`pdi.html`).
  - The preview site's files live in **`E:\MOTORING CENTRAL\preview-site`**, which is branch `main` of the same git repository. Every push to `main` goes live within about a minute. Future prototype updates go there.
  - This folder (the Next.js rebuild) is on branch **`nextjs-rebuild`**. It is pushed to GitHub but **not published**.
  - GitHub: `Motoringcentral/motoring-central` (**public**: make it private before any keys are added). The earlier Next.js build (bookings, accounts, Stripe) is on the `nextjs-app-archive` branch.
  - Vercel: team `motoringcentral`, project `motoring-central-gum8` (owns the preview address, set to plain files). The second project, `motoring-central`, is disconnected from GitHub.
  - In this rebuild, search engines are told not to index any address except the real `motoringcentral.co.uk` (see `headers()` in `next.config.ts`). The preview site has its own "do not index" settings.

## Where things live (for reference)
- Inspection and PDI forms: `src/app/inspection`, `src/app/pdi`, `src/components/inspections/` (forms, shared parts, PDF, styles), lists and wording in `src/lib/inspections.ts`
- Form styles use a `tmcf-` prefix (`src/components/inspections/forms.css`). CSS modules (`*.module.css`) don't work in this project because the Tailwind rule in `next.config.ts` loads every `.css` file as a plain stylesheet.
- Pages: `src/app/page.tsx` (home), `src/app/services`, `src/app/about`, `src/app/terms`
- Wording for services and "why choose us": `src/lib/content.ts`
- Terms wording: `src/lib/terms.ts`
- Colours and styles: `src/app/globals.css`
- Header, footer, logo, reg box, call-back form: `src/components/`

## Placeholders still to replace before launch
- Everything in [square brackets] on About us and Terms (company number, address, phone, email, ICO number)
- Terms must be checked by a solicitor
- The 3 reviews on the homepage are samples
- The reg box checks the format only. The real lookup comes in Phase 4.
- The call-back form doesn't send anything yet (needs emails, Phase 8)
- The header only links to pages that exist. Add Breakdown cover, Cars, Vans and For partners as they're built.

## Next step
Phase 2: logins with Supabase. This needs a free Supabase account first (supabase.com).
