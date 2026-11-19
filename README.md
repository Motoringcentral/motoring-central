# The Motoring Central: preview site

This branch holds the preview of The Motoring Central as a plain static site.

- `index.html` is the whole site.
- `inspection.html` is the partners' pre-work vehicle inspection, opened from "Start vehicle inspection" on a job.
- `pdi.html` is the dealers' pre-delivery inspection, opened from the PDI buttons on stock and adverts.
- `service-sheet.html` is the Interim, Full or Major vehicle service sheet for mobile mechanics and garages, opened from "Start service sheet" on a service job or from Quick actions (update pack TMC-UPD-20261117-A).
- `reset.html` is the forgotten-password page (request a link, then choose a new password).
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
