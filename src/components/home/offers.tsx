"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PICK_SERVICE_EVENT, type PickServiceDetail, type ServiceKey } from "@/lib/services";

type Offer = {
  title: string;
  body: string;
  cta: string;
  icon: ReactNode;
  // Bookable tiles choose a service; the rest link to another page.
  target: { service: ServiceKey; label: string } | { href: string };
};

const OFFERS: Offer[] = [
  {
    title: "Mobile mechanic",
    body: "A mechanic comes to your home or work and fixes the car there. Servicing, brakes, battery and diagnostics.",
    cta: "Book a mechanic",
    target: { service: "MOBILE_MECHANIC", label: "a mobile mechanic" },
    icon: <path d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  },
  {
    title: "Cars and vans for sale",
    body: "Browse cars and light commercials from checked dealers.",
    cta: "Browse vehicles",
    target: { href: "/cars" },
    icon: <path d="M3 15v-3l2-5h14l2 5v3M5 15h14M7 18v-3M17 18v-3" />,
  },
  {
    title: "Garage",
    body: "Drive to a partner garage near you. Compare price and distance, then pick a time.",
    cta: "Find a garage",
    target: { service: "GARAGE", label: "a garage" },
    icon: <path d="M3 21V9l9-6 9 6v12M7 21v-7h10v7M7 17h10" />,
  },
  {
    title: "MOT",
    body: "Done at a partner garage that is an approved test station. Choose Garage, then MOT test.",
    cta: "Book an MOT",
    target: { service: "GARAGE", label: "an MOT" },
    icon: (
      <>
        <rect x="6" y="4" width="12" height="17" rx="2" />
        <path d="M9 4h6v3H9zM9 14l2 2 4-4" />
      </>
    ),
  },
  {
    title: "Auto electrician",
    body: "Electrical faults, batteries, starters, alternators, central locking and dash cams, at your home or work.",
    cta: "Book an electrician",
    target: { service: "AUTO_ELECTRICIAN", label: "an auto electrician" },
    icon: <path d="M13 2L5 14h6l-1 8 8-12h-6z" />,
  },
  {
    title: "Mobile tyres",
    body: "A fitter brings new tyres to you, or repairs a puncture on the spot. We know your tyre size from your reg.",
    cta: "Book tyre fitting",
    target: { service: "MOBILE_TYRES", label: "tyre fitting" },
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      </>
    ),
  },
  {
    title: "Alloy wheel refurbishment",
    body: "Kerb damage, painted refurbs, diamond cut and colour changes. Fixed price per wheel, mobile or at a wheel centre.",
    cta: "Book an alloy refurb",
    target: { service: "ALLOY_WHEELS", label: "an alloy wheel refurb" },
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3.5v6M12 14.5v6M4.5 9.5l5.2 1.7M14.3 12.8l5.2 1.7M6.6 18.8l3.6-4.4M13.8 9.6l3.6-4.4" />
      </>
    ),
  },
  {
    title: "Bodywork",
    body: "Dents, scratches, bumper scuffs, resprays and accident repairs. Mobile smart repair or a body shop, with insurance-approved repairers for claims. Send photos, get fixed quotes.",
    cta: "Get quotes",
    target: { service: "BODYWORK", label: "bodywork" },
    icon: (
      <>
        <path d="M3 15l2-6h14l2 6v3H3z" />
        <circle cx="7.5" cy="18" r="2" />
        <circle cx="16.5" cy="18" r="2" />
        <path d="M14 3l3 3M17 2v2M20 5h-2" />
      </>
    ),
  },
  {
    title: "Valeting",
    body: "A full valet at your home, at work or at the valeter’s premises. Priced by vehicle size.",
    cta: "Book a valet",
    target: { service: "VALET", label: "a valet" },
    icon: <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />,
  },
  {
    title: "Recovery",
    body: "Broken down? A recovery truck takes your car home or to a garage. See the price and arrival time first.",
    cta: "Book recovery",
    target: { service: "RECOVERY", label: "recovery" },
    icon: (
      <>
        <path d="M2 16V8h11v8M13 11h5l3 3v2H2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
  },
  {
    title: "Mobile EV charging",
    body: "Out of charge, or need a top-up at home or work? A charging van comes to you with enough charge to get you moving.",
    cta: "Book EV charging",
    target: { service: "EV_CHARGING", label: "EV charging" },
    icon: <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" />,
  },
  {
    title: "Breakdown cover",
    body: "Find the right RAC cover level, then buy direct from the RAC.",
    cta: "Compare cover",
    target: { href: "/breakdown" },
    icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  },
];

const TILE =
  "flex min-h-[200px] min-w-0 cursor-pointer flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-3.5 text-left text-ink transition hover:border-sky focus-visible:outline-sun active:scale-[.98] motion-reduce:active:scale-100 sm:gap-3 sm:p-4.5";

function TileBody({ offer }: { offer: Offer }) {
  return (
    <>
      <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-sky">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-[22px] fill-none stroke-navy stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        >
          {offer.icon}
        </svg>
      </span>
      <span className="flex-1">
        <b className="block leading-tight [overflow-wrap:break-word]">{offer.title}</b>
        <small className="mt-1.5 block text-[.84rem] leading-[1.45] text-muted">{offer.body}</small>
      </span>
      <span className="text-[.86rem] font-bold underline decoration-sky decoration-2 underline-offset-4">
        {offer.cta}
      </span>
    </>
  );
}

function pickService(detail: PickServiceDetail) {
  window.dispatchEvent(new CustomEvent<PickServiceDetail>(PICK_SERVICE_EVENT, { detail }));
}

export function EverythingWeOffer() {
  return (
    <>
      <h2 className="mt-7.5 mb-3 text-[1.25rem] font-bold">Everything we offer</h2>
      <div className="grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-3">
        {OFFERS.map((offer) =>
          "href" in offer.target ? (
            <Link key={offer.title} href={offer.target.href} className={TILE}>
              <TileBody offer={offer} />
            </Link>
          ) : (
            <button
              key={offer.title}
              type="button"
              className={TILE}
              onClick={() => "service" in offer.target && pickService(offer.target)}
            >
              <TileBody offer={offer} />
            </button>
          ),
        )}
      </div>
      <p className="mt-2.5 text-[.78rem] text-muted">
        Every option shows a fixed price before you book. A booking fee applies.
      </p>
      <a href="#reg" className="btn mt-3.5 block w-full">
        Enter my reg
      </a>
    </>
  );
}
