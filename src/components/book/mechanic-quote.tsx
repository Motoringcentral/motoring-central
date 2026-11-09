"use client";

import { useState } from "react";
import { type Job, labourTotal, type Quality } from "@/lib/catalog";
import { type LatLng, milesBetween } from "@/lib/geo";
import { money, PriceTable, partRows, QualitySeg, TermsAndBook } from "./quote-parts";
import type { PartnerOption } from "./types";

export function MechanicQuote({
  job,
  partners,
  autoElec,
  origin,
  bookingFeePence,
  usualBookingFeePence,
}: {
  job: Job;
  partners: PartnerOption[];
  autoElec: boolean;
  origin: LatLng | null;
  bookingFeePence: number;
  usualBookingFeePence: number;
}) {
  const sorted = [...partners].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const [partnerId, setPartnerId] = useState(sorted[0]?.id);
  const [quality, setQuality] = useState<Quality>("STANDARD");
  const partner = sorted.find((p) => p.id === partnerId) ?? sorted[0];
  const who = autoElec ? "auto electrician" : "mechanic";

  if (!partner) {
    return (
      <section className="card">
        <h2 className="mt-0 text-[1.1rem] font-bold">Your fixed price</h2>
        <p className="text-muted">No {who}s are available near you yet. Try a garage instead.</p>
      </section>
    );
  }

  const labour = labourTotal(job, partner.ratePence);
  const rows = [
    ...partRows(job, quality),
    {
      label: autoElec ? "Auto electrician labour" : "Mechanic labour",
      detail: `${partner.name}, ${money(partner.ratePence)} per hour x ${job.hours} hours. Call-out included`,
      pence: labour,
    },
  ];

  return (
    <section className="card" aria-labelledby="quote-h">
      <h2 id="quote-h" className="mt-0 mb-2.5 text-[1.1rem] font-bold">
        Your fixed price
      </h2>
      <p className="mb-2 text-[.78rem] text-muted">Choose your {who}. Each sets their own hourly rate.</p>
      <div className="mb-3 grid gap-2">
        {sorted.map((p) => {
          const miles = origin && p.location ? milesBetween(origin, p.location) : null;
          return (
            <button key={p.id} type="button" className="opt" aria-pressed={p.id === partner.id} onClick={() => setPartnerId(p.id)}>
              <b>{p.name}</b>
              <span className="row-span-2 self-center font-bold whitespace-nowrap text-brand">{money(p.ratePence)}/hr</span>
              <small>
                {p.rating != null && `${p.rating.toFixed(1)} rating from ${p.jobs} jobs. `}Labour for this job{" "}
                {money(labourTotal(job, p.ratePence))}
                {miles != null && `. ${miles.toFixed(1)} miles away`}
              </small>
            </button>
          );
        })}
      </div>
      {job.parts.length > 0 && <QualitySeg value={quality} onChange={setQuality} />}
      <PriceTable rows={rows} bookingFeePence={bookingFeePence} usualBookingFeePence={usualBookingFeePence} />
      <p className="mt-2 text-[.78rem] text-muted">
        Parts matched to your car and listed from the parts supplier. Sample prices shown.
      </p>
      <TermsAndBook who={`${who}`} cta={`Book ${partner.name}`} />
    </section>
  );
}
