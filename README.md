# The Motoring Central: preview site

This branch holds the preview of The Motoring Central as a plain static site.

- `index.html` is the whole site.
- `inspection.html` is the partners' pre-work vehicle inspection, opened from "Start vehicle inspection" on a job.
- `pdi.html` is the dealers' pre-delivery inspection, opened from the PDI buttons on stock and adverts.
- `img/` holds the photos.
- `robots.txt` and `vercel.json` tell search engines not to list the preview.

There is nothing to build. Any static host can serve these files as they are.

## Important

This is a preview with sample data. It makes no real bookings, payments, emails or texts,
and its partners, reviews and figures are placeholders. Do not present it as the live service.

## The earlier Next.js app

The Next.js, Prisma and Stripe project that used to be on this branch is kept, unchanged,
on the `nextjs-app-archive` branch, together with the older prototypes in its `reference` folder.

## Publishing

Every push to `main` goes live on https://preview.motoringcentral.co.uk (Vercel project `motoring-central-gum8`).

## The Next.js rebuild

The Next.js rebuild that is being made on the laptop (`E:\Motoring Central laptop`) is on the `nextjs-rebuild` branch.
It is not published.

## Live registration look-up (Vehicle Data Global)

`api/vrm.js` is a small Vercel function that looks registrations up with Vehicle Data Global.
The API key is never in these files (this repository is public). It is set in Vercel:

Vercel → project `motoring-central-gum8` → Settings → Environment Variables

- `VDG_API_KEY`: the Vehicle Data Global API key (tick Production and Preview)
- `VDG_PACKAGE`: optional, the data package name on the account (default `VehicleData`)

Then redeploy. Until the key is set, the site uses its sample vehicles, exactly as before.
Each look-up costs a credit, so the function only answers this site's own pages, limits each visitor to
20 look-ups per 10 minutes, and caches each registration for a day.
