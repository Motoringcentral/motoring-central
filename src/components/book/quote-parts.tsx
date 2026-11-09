"use client";

import Link from "next/link";
import { useState } from "react";
import { type Job, QUALITIES, type Quality } from "@/lib/catalog";

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
// Quotes always show pence, e.g. £42.00.
const money = (pence: number) => GBP.format(pence / 100);

export function QualitySeg({ value, onChange }: { value: Quality; onChange: (q: Quality) => void }) {
  const labels: Record<Quality, string> = { BUDGET: "Budget", STANDARD: "Standard", PREMIUM: "Premium" };
  return (
    <div className="seg mb-2.5" role="group" aria-label="Part quality">
      {QUALITIES.map((q) => (
        <button key={q} type="button" aria-pressed={value === q} onClick={() => onChange(q)}>
          {labels[q]}
        </button>
      ))}
    </div>
  );
}

export type PriceRow = { label: string; detail?: string; pence: number };

export function partRows(job: Job, quality: Quality): PriceRow[] {
  const q = QUALITIES.indexOf(quality);
  return job.parts.map((p) => ({ label: p.name, detail: p.detail, pence: Math.round(p.prices[q] * p.qty) }));
}

export function PriceTable({
  rows,
  bookingFeePence,
  usualBookingFeePence,
}: {
  rows: PriceRow[];
  bookingFeePence: number;
  usualBookingFeePence: number;
}) {
  const total = rows.reduce((s, r) => s + r.pence, 0) + bookingFeePence;
  const launch = bookingFeePence < usualBookingFeePence;
  return (
    <table className="price-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>
              {r.label}
              {r.detail && <small>{r.detail}</small>}
            </td>
            <td>{money(r.pence)}</td>
          </tr>
        ))}
        <tr>
          <td>
            Booking fee
            {launch && <small>Launch offer: 50% off the usual {money(usualBookingFeePence)}</small>}
          </td>
          <td>{money(bookingFeePence)}</td>
        </tr>
        <tr className="total">
          <td>Total</td>
          <td>{money(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function TermsAndBook({ who, cta }: { who: string; cta: string }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function book() {
    if (!agreed) {
      setError("Tick the box to confirm you understand who carries out the work.");
      return;
    }
    setError(null);
    // TODO: create the booking and take card payment with Stripe.
    setNotice("Card payment is the next step to be built. Your choices are ready to book.");
  }

  return (
    <>
      <label className="mt-3.5 flex items-start gap-2 text-[.88rem]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-[18px] flex-none accent-brand"
        />
        <span>
          I understand my booking is with the {who} I have chosen. They carry out the work and are responsible for it,
          including the warranty on the work and parts.{" "}
          <Link href="/terms" className="underline">
            Read the terms
          </Link>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-[.85rem] font-semibold text-err">
          {error}
        </p>
      )}
      <button type="button" className="btn mt-3.5 block w-full" onClick={book}>
        {cta}
      </button>
      {notice && (
        <p role="status" className="mt-3.5 rounded-[10px] bg-soft p-3 font-bold text-brand">
          {notice}
        </p>
      )}
    </>
  );
}

export { money };
