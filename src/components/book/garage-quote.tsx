"use client";

import { useMemo, useState, useTransition } from "react";
import { locatePostcode } from "@/app/actions/booking";
import { INPUT } from "@/components/forms";
import { type Job, labourTotal, partsTotal, type Quality } from "@/lib/catalog";
import { type LatLng, milesBetween } from "@/lib/geo";
import { money, PriceTable, partRows, QualitySeg, TermsAndBook } from "./quote-parts";
import type { PartnerOption } from "./types";

const TIMES = ["8:00am", "10:00am", "12:00pm", "2:00pm", "4:00pm"];

export function GarageQuote({
  job,
  garages,
  initialPostcode,
  initialOrigin,
  bookingFeePence,
  usualBookingFeePence,
}: {
  job: Job;
  garages: PartnerOption[];
  initialPostcode: string | null;
  initialOrigin: LatLng | null;
  bookingFeePence: number;
  usualBookingFeePence: number;
}) {
  const [postcode, setPostcode] = useState(initialPostcode ?? "");
  const [origin, setOrigin] = useState(initialOrigin);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [garageId, setGarageId] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>("STANDARD");

  // Next 7 days, skipping Sundays.
  const days = useMemo(() => {
    const out: string[] = [];
    for (let n = 1; n <= 7; n++) {
      const d = new Date();
      d.setDate(d.getDate() + n);
      if (d.getDay() !== 0) out.push(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }));
    }
    return out;
  }, []);

  const price = (g: PartnerOption) =>
    job.mot ? (g.motFeePence ?? 0) : partsTotal(job, quality) + labourTotal(job, g.ratePence);

  const list = garages
    .filter((g) => !job.mot || g.motFeePence != null)
    .map((g) => ({ g, miles: origin && g.location ? milesBetween(origin, g.location) : null }))
    .sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
  const picked = list.find((x) => x.g.id === garageId)?.g ?? null;

  function find() {
    setError(null);
    start(async () => {
      const at = await locatePostcode(postcode);
      if (at) setOrigin(at);
      else setError("Enter a valid UK postcode to see garages near you.");
    });
  }

  return (
    <section className="card" aria-labelledby="garage-h">
      <h2 id="garage-h" className="mt-0 mb-2.5 text-[1.1rem] font-bold">
        {job.name} at a partner garage
      </h2>
      <label htmlFor="g-post" className="mb-1 block text-[.9rem] font-semibold">
        Your postcode
      </label>
      <div className="flex gap-2">
        <input
          id="g-post"
          className={`${INPUT} uppercase`}
          maxLength={9}
          placeholder="e.g. LS1 4AP"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && find()}
        />
        <button type="button" className="btn" onClick={find} disabled={pending}>
          {pending ? "Finding…" : "Find garages"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[.85rem] font-semibold text-err">
          {error}
        </p>
      )}

      {origin && (
        <>
          {!job.mot && job.parts.length > 0 && (
            <div className="mt-3.5">
              <QualitySeg value={quality} onChange={setQuality} />
            </div>
          )}
          <div className="mt-3 grid gap-2">
            {list.map(({ g, miles }) => (
              <button key={g.id} type="button" className="opt" aria-pressed={g.id === garageId} onClick={() => setGarageId(g.id)}>
                <b>{g.name}</b>
                <span className="row-span-2 self-center font-bold whitespace-nowrap text-brand">
                  {miles != null ? `${miles.toFixed(1)} miles` : ""}
                </span>
                <small>
                  {g.address && `${g.address}. `}
                  {!job.mot && `${money(g.ratePence)} per hour labour. `}Price {money(price(g))}
                </small>
              </button>
            ))}
          </div>
        </>
      )}

      {picked && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="g-day" className="mb-1 block text-[.9rem] font-semibold">
                Day
              </label>
              <select id="g-day" className={INPUT}>
                {days.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="g-time" className="mb-1 block text-[.9rem] font-semibold">
                Time
              </label>
              <select id="g-time" className={INPUT} defaultValue="10:00am">
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <PriceTable
              rows={
                job.mot
                  ? [{ label: "MOT test", detail: `${picked.name}, approved test centre`, pence: picked.motFeePence ?? 0 }]
                  : [
                      ...partRows(job, quality),
                      {
                        label: "Garage labour",
                        detail: `${picked.name}, ${money(picked.ratePence)} per hour x ${job.hours} hours`,
                        pence: labourTotal(job, picked.ratePence),
                      },
                    ]
              }
              bookingFeePence={bookingFeePence}
              usualBookingFeePence={usualBookingFeePence}
            />
          </div>
          <TermsAndBook who="garage" cta={`Book ${picked.name}`} />
        </div>
      )}
    </section>
  );
}
