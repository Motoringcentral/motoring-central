"use client";

import { useMemo, useState } from "react";
import { TYRE_TIER_PENCE, VALVE_AND_DISPOSAL_PENCE } from "@/lib/catalog";
import { money, type PriceRow, PriceTable, TermsAndBook } from "../quote-parts";
import { nextDays } from "../use-postcode";
import { Choice, Note, PostcodeRow, Select, ServiceCard, type ServiceFormProps } from "./shared";

const TIERS = ["Budget", "Mid-range", "Premium"];
const WINDOWS = ["8am to 11am", "11am to 2pm", "2pm to 5pm", "5pm to 8pm"];

export function TyresForm({ vehicle, partners, postcode, bookingFeePence, usualBookingFeePence }: ServiceFormProps) {
  const fitters = partners.filter((p) => p.type === "TYRE_FITTER" && p.fitPerTyrePence != null);
  const [fitterId, setFitterId] = useState(fitters[0]?.id);
  const [kind, setKind] = useState<"new" | "puncture">("new");
  const [qty, setQty] = useState(4);
  const [tier, setTier] = useState(1);
  const [where, setWhere] = useState(postcode ?? "");
  const days = useMemo(() => nextDays(), []);
  const fitter = fitters.find((f) => f.id === fitterId) ?? fitters[0];

  if (!fitter) {
    return (
      <ServiceCard title="Mobile tyre fitting" intro="No tyre fitters cover your area yet.">
        {null}
      </ServiceCard>
    );
  }

  const each = Math.round(TYRE_TIER_PENCE[tier] * vehicle.sizeFactor);
  const rows: PriceRow[] =
    kind === "puncture"
      ? [{ label: "Puncture repair", detail: `${fitter.name} repairs it at your door`, pence: fitter.puncturePence ?? 0 }]
      : [
          { label: `${qty} x tyre (${vehicle.tyreSize})`, detail: `${TIERS[tier]} range, ${money(each)} each`, pence: each * qty },
          {
            label: "Mobile fitting and balancing",
            detail: `${fitter.name}, ${money(fitter.fitPerTyrePence!)} per tyre`,
            pence: fitter.fitPerTyrePence! * qty,
          },
          {
            label: "Valves and old tyre disposal",
            detail: `${money(VALVE_AND_DISPOSAL_PENCE)} per tyre`,
            pence: VALVE_AND_DISPOSAL_PENCE * qty,
          },
        ];

  return (
    <ServiceCard title="Mobile tyre fitting" intro="A fitter comes to you with the tyres on the van.">
      <p className="mt-3 font-bold">Your tyre size: {vehicle.tyreSize} (from your full vehicle check)</p>
      <p className="mt-3 mb-1 text-[.9rem] font-semibold">Choose your fitter</p>
      <div className="grid gap-2">
        {fitters.map((f) => (
          <Choice key={f.id} selected={f.id === fitter.id} onClick={() => setFitterId(f.id)} title={f.name}>
            {f.rating != null && `${f.rating.toFixed(1)} rating. `}
            {money(f.fitPerTyrePence!)} per tyre fitted, puncture {money(f.puncturePence ?? 0)}
          </Choice>
        ))}
      </div>
      <Select id="t-kind" label="What do you need?" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="new">New tyres</option>
        <option value="puncture">Puncture repair</option>
      </Select>
      {kind === "new" && (
        <div className="grid grid-cols-2 gap-2">
          <Select id="t-qty" label="How many" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {[1, 2, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
          <Select id="t-tier" label="Quality" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {TIERS.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="mt-3">
        <PriceTable rows={rows} bookingFeePence={bookingFeePence} usualBookingFeePence={usualBookingFeePence} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select id="t-day" label="Day">
          {days.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select id="t-slot" label="Time window" defaultValue={WINDOWS[1]}>
          {WINDOWS.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </Select>
      </div>
      <PostcodeRow id="t-post" label="Postcode where the car is" value={where} onChange={setWhere} />
      <TermsAndBook
        who="tyre fitter"
        cta="Book tyre fitter"
        responsibility="They are responsible for the tyres and fitting, including the warranty."
        validate={() => (where.replace(/\s/g, "").length < 5 ? "Enter the postcode where the car is." : null)}
      />
      <Note>Sample prices. Real tyre prices and stock come from the tyre supplier.</Note>
    </ServiceCard>
  );
}
