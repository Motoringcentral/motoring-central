import Link from "next/link";
import type { ReactNode } from "react";

function LineIcon({ children, className = "size-[34px] stroke-brand" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`flex-none fill-none stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round] ${className}`}
    >
      {children}
    </svg>
  );
}

const Tick = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="size-[18px] flex-none fill-none stroke-ok stroke-3 [stroke-linecap:round] [stroke-linejoin:round]"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function TrustStrip() {
  return (
    <div className="mt-3.5 mb-1 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[.86rem] font-bold">
      <span className="inline-flex items-center gap-1.5">
        <Tick />
        Every partner ID and insurance checked
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Tick />
        Fixed price before you book
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Tick />
        Real UK team.{" "}
        <Link href="/about" className="underline">
          Talk to a person
        </Link>
      </span>
    </div>
  );
}

const WHY = [
  {
    title: "Checked local experts",
    body: "Every partner’s photo ID and insurance is checked before they can take a booking.",
    icon: (
      <>
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    title: "Fixed price before you book",
    body: "See parts, labour and the total up front. No surprises at the door.",
    icon: (
      <>
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
      </>
    ),
  },
  {
    title: "Real people, not robots",
    body: "A real UK team answers your calls and messages, and steps in if something goes wrong.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M16 14.2c2.6.2 4.6 2.2 5.2 5" />
      </>
    ),
  },
  {
    title: "You choose who",
    body: "Compare partners by price, rating and distance, then pick the one you want.",
    icon: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  },
  {
    title: "Pay securely",
    body: "Pay by card when you book. We pay your partner on your behalf.",
    icon: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h4" />
      </>
    ),
  },
  {
    title: "Everything in one place",
    body: "Servicing, repairs, MOT, auto electrics, tyres, bodywork, alloy wheels, valeting, recovery, EV charging and buying a car or van.",
    icon: (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </>
    ),
  },
];

export function WhyChooseUs() {
  return (
    <section
      aria-labelledby="why-h"
      className="relative mt-5.5 mb-2.5 overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_100%_0%,rgba(56,189,248,.35),transparent_55%),linear-gradient(140deg,#0B1C35_0%,#13294D_60%,#0B1C35_100%)] px-4 pt-5.5 pb-5 text-white shadow-[0_14px_34px_rgba(11,28,53,.28)] after:absolute after:-right-15 after:-bottom-15 after:size-55 after:rounded-full after:border-[28px] after:border-sky/12 sm:px-5.5 sm:pt-7 sm:pb-6"
    >
      <span className="inline-block rounded-md bg-sun px-2.5 py-1 text-[.75rem] font-extrabold tracking-[.08em] text-navy uppercase">
        Why choose us
      </span>
      <h2 id="why-h" className="mt-3.5 mb-2.5 text-[clamp(1.7rem,5vw,2.4rem)] leading-[1.12] font-extrabold">
        Car care you can <span className="text-sky">actually trust.</span>
      </h2>
      <p className="mb-4.5 max-w-[40em] text-mist">
        One place for everything your car or van needs, done by checked local experts at a price you see before you
        book.
      </p>
      <div className="relative z-[1] grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {WHY.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-[14px] border border-white/12 bg-white/6 p-3.5"
          >
            <span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-sky">
              <LineIcon className="size-6 stroke-navy stroke-2">{item.icon}</LineIcon>
            </span>
            <div>
              <b className="block">{item.title}</b>
              <p className="mt-1 text-[.88rem] text-mist">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="relative z-[1] mt-4.5 flex flex-wrap items-center gap-x-4.5 gap-y-3 text-[.92rem] text-mist">
        <Link href="/about" className="inline-block rounded-xl bg-sun px-4.5 py-3 font-extrabold text-navy">
          Meet the team behind it
        </Link>
        <span>
          Questions?{" "}
          <Link href="/about#callback" className="font-bold text-white underline">
            Request a call back
          </Link>
        </span>
      </div>
    </section>
  );
}

export function Stats() {
  const items = [
    ["Fixed", "price before you book"],
    ["Checked", "ID and insurance"],
    ["UK team", "real people to help"],
    ["£0", "call-out fee"],
  ];
  return (
    <div className="mt-6.5 grid grid-cols-2 gap-2 text-center text-[.76rem] text-muted sm:grid-cols-4">
      {items.map(([big, small]) => (
        <div key={big}>
          <b className="block text-[1.15rem] text-ink">{big}</b>
          {small}
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-7.5 mb-3 text-[1.25rem] font-bold">{children}</h2>;
}

export function HowItWorks() {
  const steps = [
    ["Enter your reg", "We find your exact car and the right parts."],
    ["Get a fixed price", "Parts and labour in one total, no surprises."],
    ["Book and relax", "A mechanic, garage, tow truck or tyre fitter, whichever you chose."],
  ];
  return (
    <>
      <SectionHeading>How it works</SectionHeading>
      <ol className="grid gap-2.5 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="card">
            <div className="mb-2 grid size-[30px] place-items-center rounded-full bg-brand font-extrabold text-brand-ink">
              {i + 1}
            </div>
            <b>{title}</b>
            <br />
            <small className="text-muted">{body}</small>
          </li>
        ))}
      </ol>
    </>
  );
}

const REPAIRS: [string, ReactNode][] = [
  ["Oil service", <path key="p" d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />],
  [
    "Brakes",
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ],
  [
    "Battery",
    <>
      <rect x="2" y="7" width="18" height="11" rx="2" />
      <path d="M22 11v3M7 12h4M9 10v4" />
    </>,
  ],
  [
    "Diagnostics",
    <>
      <path d="M3 17a9 9 0 1 1 18 0" />
      <path d="M12 17l4-5" />
    </>,
  ],
  [
    "Tyres",
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
    </>,
  ],
  ["Clutch", <path key="p" d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />],
  [
    "MOT",
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 14l2 2 4-4" />
    </>,
  ],
  ["Suspension", <path key="p" d="M8 3h8M8 21h8M12 3v2l-4 2 8 3-8 3 8 3-4 2v3" />],
  [
    "Timing belt",
    <>
      <circle cx="7" cy="12" r="4" />
      <circle cx="17" cy="12" r="4" />
      <path d="M7 8h10M7 16h10" />
    </>,
  ],
];

export function PopularRepairs() {
  return (
    <>
      <SectionHeading>Popular repairs</SectionHeading>
      <div className="grid grid-cols-3 gap-2.5">
        {REPAIRS.map(([label, icon]) => (
          <div key={label} className="card px-2 py-3.5 text-center text-[.88rem] font-semibold">
            <LineIcon className="mx-auto mb-1.5 block size-[34px] stroke-brand">{icon}</LineIcon>
            {label}
          </div>
        ))}
      </div>
    </>
  );
}

export function VettedPromo() {
  return (
    <div className="card mt-4.5 grid items-center gap-3 sm:grid-cols-2">
      <svg viewBox="0 0 200 110" role="img" aria-label="A car raised on a workshop lift" className="h-auto w-full">
        <rect x="0" y="96" width="200" height="14" fill="var(--line)" />
        <rect x="34" y="30" width="8" height="66" fill="var(--muted)" />
        <rect x="158" y="30" width="8" height="66" fill="var(--muted)" />
        <rect x="28" y="34" width="144" height="6" rx="3" fill="var(--ink)" />
        <path
          d="M46 32c0-7 3-11 9-12l14-14c3-3 6-4 10-4h26c5 0 8 2 11 5l9 11c8 1 12 4 12 10v4z"
          fill="var(--brand)"
        />
        <path d="M74 20l10-11c2-2 3-2 6-2h18c2 0 4 1 5 3l7 10z" fill="var(--bg)" />
        <circle cx="68" cy="34" r="8" fill="var(--ink)" />
        <circle cx="134" cy="34" r="8" fill="var(--ink)" />
        <rect x="92" y="64" width="22" height="32" rx="4" fill="#ff7a1a" />
        <circle cx="103" cy="56" r="8" fill="#f1c27d" />
        <path d="M95 54c0-7 4-9 8-9s8 2 8 9z" fill="#ffcf3f" />
      </svg>
      <div>
        <h2 className="m-0 text-[1.1rem] font-bold">Vetted, insured mechanics</h2>
        <ul className="mt-2 list-disc pl-4.5 text-[.9rem] text-muted">
          <li>ID and qualification checks</li>
          <li>Public liability insurance</li>
          <li>12-month parts and labour warranty, given by the mechanic</li>
        </ul>
      </div>
    </div>
  );
}

type Review = { stars: number; text: string; author: string };

// Placeholder reviews from the prototype. UK law bans publishing fake
// reviews, so these only render outside production. Swap in real reviews
// once bookings are live.
const SAMPLE_REVIEWS: Review[] = [
  {
    stars: 5,
    text: "Brake pads done on my driveway while I worked from home. Price matched the quote exactly.",
    author: "Sarah, Leeds (sample review)",
  },
  {
    stars: 5,
    text: "Typed my reg, saw the exact parts, booked in two minutes. Dan was brilliant.",
    author: "James, Bristol (sample review)",
  },
  { stars: 4, text: "Battery swapped at my office in under an hour. Would use again.", author: "Priya, Manchester (sample review)" },
];

export function Reviews({ reviews = process.env.NODE_ENV === "production" ? [] : SAMPLE_REVIEWS }: { reviews?: Review[] }) {
  if (reviews.length === 0) return null;
  return (
    <>
      <SectionHeading>What drivers say</SectionHeading>
      <div className="grid gap-2.5">
        {reviews.map((r) => (
          <div key={r.author} className="card">
            <span className="tracking-[2px] text-[#e8a800]" aria-label={`${r.stars} out of 5 stars`}>
              {"★".repeat(r.stars) + "☆".repeat(5 - r.stars)}
            </span>
            <p className="my-1.5">{r.text}</p>
            <small className="text-muted">{r.author}</small>
          </div>
        ))}
      </div>
    </>
  );
}

export function BreakdownPromo() {
  return (
    <div className="card mt-4.5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-sun">
      <div>
        <b>Need breakdown cover?</b>
        <p className="mt-1 text-[.9rem] text-muted">Find the right RAC cover level for you.</p>
      </div>
      <Link href="/breakdown" className="btn">
        Compare cover
      </Link>
    </div>
  );
}
