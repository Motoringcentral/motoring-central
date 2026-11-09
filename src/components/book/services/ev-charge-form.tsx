"use client";

import { useState } from "react";
import { EV_CHARGE } from "@/lib/catalog";
import { milesBetween } from "@/lib/geo";
import { money, PriceTable, TermsAndBook } from "../quote-parts";
import { usePostcode } from "../use-postcode";
import { Choice, etaMinutes, Note, PostcodeRow, Select, ServiceCard, type ServiceFormProps } from "./shared";

type Need = keyof typeof EV_CHARGE;
const CONNECTORS = ["Type 2", "CCS", "CHAdeMO", "Not sure"];
const WHEN = { now: "Now", today: "Later today", tomorrow: "Tomorrow" } as const;

export function EvChargeForm({ vehicle, partners, bookingFeePence, usualBookingFeePence }: ServiceFormProps) {
  const where = usePostcode(null);
  const [need, setNeed] = useState<Need>("rescue");
  const [plug, setPlug] = useState("Type 2");
  const [when, setWhen] = useState<keyof typeof WHEN>("now");
  const [searched, setSearched] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const electric = /electric|plug/i.test(vehicle.fuel);

  const options =
    searched && where.at
      ? partners
          .filter((p) => p.type === "MOBILE_EV_CHARGING" && p.location && p.callOutPence != null)
          .filter((p) => plug === "Not sure" || p.connectors.includes(plug))
          .map((c) => {
            const away = milesBetween(c.location!, where.at!);
            const outside = Math.max(0, Math.ceil(away - (c.travelRadiusMiles ?? 0)));
            const price = c.callOutPence! + (c.perMileOutsidePence ?? 0) * outside + EV_CHARGE[need].pence;
            return { c, outside, eta: etaMinutes(away), price };
          })
          .sort((a, b) => a.price - b.price)
      : [];
  const picked = options.find((o) => o.c.id === pickedId);

  return (
    <ServiceCard
      title="Mobile EV charging"
      intro="A charging van comes to you with enough charge to get you moving. On a motorway, get to a safe place first. In immediate danger, call 999."
    >
      {!electric && (
        <p className="mt-2 font-semibold text-err">
          This vehicle is not shown as electric. For a flat 12V battery, choose Mobile mechanic or Recovery instead.
        </p>
      )}
      <PostcodeRow id="e-post" label="Where is the car? (postcode)" value={where.postcode} onChange={where.setPostcode} error={where.error} />
      <Select id="e-need" label="What do you need?" value={need} onChange={(e) => setNeed(e.target.value as Need)}>
        {Object.entries(EV_CHARGE).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </Select>
      <Select id="e-plug" label="Charging connector" value={plug} onChange={(e) => setPlug(e.target.value)}>
        {CONNECTORS.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Select id="e-when" label="When?" value={when} onChange={(e) => setWhen(e.target.value as keyof typeof WHEN)}>
        {Object.entries(WHEN).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      <button
        type="button"
        className="btn mt-3.5 block w-full"
        disabled={where.pending}
        onClick={() => {
          setPickedId(null);
          where.find(() => setSearched(true));
        }}
      >
        {where.pending ? "Finding prices…" : "Get charging prices"}
      </button>

      {searched && where.at && options.length === 0 && (
        <p className="mt-3 text-muted">No charging partners with a {plug} connector cover this area yet.</p>
      )}
      <div className="mt-3 grid gap-2">
        {options.map(({ c, outside, eta, price }) => (
          <Choice key={c.id} selected={c.id === pickedId} onClick={() => setPickedId(c.id)} title={c.name} aside={money(price)}>
            {when === "now" ? `Arrives in about ${eta} minutes.` : `They confirm your time ${when === "today" ? "for later today" : "for tomorrow"}.`}{" "}
            {c.equipment}. {money(c.callOutPence!)} call-out
            {outside > 0 && ` + ${money(c.perMileOutsidePence ?? 0)} a mile x ${outside} miles outside their area`} +{" "}
            {money(EV_CHARGE[need].pence)} charge
          </Choice>
        ))}
      </div>

      {picked && (
        <div className="mt-3">
          <PriceTable
            rows={[
              { label: "Call-out", detail: picked.c.name, pence: picked.price - EV_CHARGE[need].pence },
              { label: "Charge", detail: EV_CHARGE[need].label, pence: EV_CHARGE[need].pence },
            ]}
            bookingFeePence={bookingFeePence}
            usualBookingFeePence={usualBookingFeePence}
          />
          <TermsAndBook
            who="charging company"
            cta="Book EV charging"
            responsibility="They are responsible for charging my vehicle safely."
          />
        </div>
      )}
      <Note>Sample companies shown.</Note>
    </ServiceCard>
  );
}
