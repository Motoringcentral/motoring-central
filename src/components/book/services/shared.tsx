"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { INPUT } from "@/components/forms";
import type { LatLng } from "@/lib/geo";
import type { FullVehicle } from "@/lib/vehicles";
import type { PartnerOption } from "../types";

export type ServiceFormProps = {
  vehicle: FullVehicle;
  partners: PartnerOption[];
  postcode: string | null;
  origin: LatLng | null;
  bookingFeePence: number;
  usualBookingFeePence: number;
};

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mt-3 mb-1 block text-[.9rem] font-semibold">
      {children}
    </label>
  );
}

export function Select({
  id,
  label,
  children,
  ...props
}: { id: string; label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={INPUT} {...props}>
        {children}
      </select>
    </div>
  );
}

export function PostcodeRow({
  id,
  label,
  value,
  onChange,
  onFind,
  pending,
  button,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFind?: () => void;
  pending?: boolean;
  button?: string;
  error?: string | null;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          className={`${INPUT} uppercase`}
          maxLength={9}
          placeholder="e.g. LS1 4AP"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onFind?.()}
        />
        {onFind && (
          <button type="button" className="btn whitespace-nowrap" onClick={onFind} disabled={pending}>
            {pending ? "Finding…" : (button ?? "Find")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[.85rem] font-semibold text-err">
          {error}
        </p>
      )}
    </div>
  );
}

export function Choice({
  selected,
  onClick,
  title,
  aside,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <button type="button" className="opt" aria-pressed={selected} onClick={onClick}>
      <b>{title}</b>
      {aside != null && <span className="row-span-2 self-center font-bold whitespace-nowrap text-brand">{aside}</span>}
      {children && <small>{children}</small>}
    </button>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[.78rem] text-muted">{children}</p>;
}

export function ServiceCard({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mt-0 mb-1 text-[1.1rem] font-bold">{title}</h2>
      <p className="text-muted">{intro}</p>
      {children}
    </section>
  );
}

/** Rough arrival time: dispatch plus driving at around 24mph in town. */
export function etaMinutes(miles: number) {
  return Math.round(15 + miles * 2.5);
}
