"use client";

import { useMemo, useState } from "react";
import { VALET_SIZES } from "@/lib/catalog";
import { milesBetween } from "@/lib/geo";
import { money, PriceTable, TermsAndBook } from "../quote-parts";
import { nextDays, usePostcode } from "../use-postcode";
import { Choice, Note, PostcodeRow, Select, ServiceCard, type ServiceFormProps } from "./shared";

const SLOTS = ["8:00am", "10:00am", "12:00pm", "2:00pm"];
const SIZE_NAMES = ["Small", "Medium", "Large", "Extra large or van"];

export function ValetForm({ vehicle, partners, postcode, origin, bookingFeePence, usualBookingFeePence }: ServiceFormProps) {
  const pc = usePostcode(postcode, origin);
  const [size, setSize] = useState<number>(vehicle.valetSize);
  const [premises, setPremises] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const days = useMemo(() => nextDays(), []);

  const valeters = partners
    .filter((p) => p.type === "VALETER" && p.valetPricesPence.length === 4)
    .filter((p) => (premises ? p.workLocation !== "MOBILE" : p.workLocation !== "WORKSHOP"))
    .map((v) => ({ v, miles: pc.at && v.location ? milesBetween(pc.at, v.location) : null }))
    .filter(({ v, miles }) => premises || miles == null || miles <= (v.travelRadiusMiles ?? 15))
    .sort((a, b) =>
      premises ? (a.miles ?? 0) - (b.miles ?? 0) : a.v.valetPricesPence[size] - b.v.valetPricesPence[size],
    );
  const picked = valeters.find((x) => x.v.id === pickedId)?.v;

  return (
    <ServiceCard
      title="Full valet"
      intro="Exterior wash and wax, plus a full interior clean. One fixed price for your vehicle size."
    >
      <Select id="v-size" label="Vehicle size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
        {VALET_SIZES.map((s, i) => (
          <option key={s} value={i}>
            {s}
          </option>
        ))}
      </Select>
      <Select
        id="v-where"
        label="Where should it be done?"
        value={premises ? "premises" : "mobile"}
        onChange={(e) => {
          setPremises(e.target.value === "premises");
          setPickedId(null);
        }}
      >
        <option value="mobile">At my home or work (mobile)</option>
        <option value="premises">At the valeter&rsquo;s premises</option>
      </Select>
      <PostcodeRow
        id="v-post"
        label="Postcode"
        value={pc.postcode}
        onChange={pc.setPostcode}
        onFind={() => pc.find()}
        pending={pc.pending}
        button="Show valeters"
        error={pc.error}
      />
      {pc.at && (
        <>
          <p className="mt-3 mb-1 text-[.9rem] font-semibold">Choose your valeter</p>
          {valeters.length === 0 && <p className="text-muted">No valeters cover this postcode yet.</p>}
          <div className="grid gap-2">
            {valeters.map(({ v, miles }) => (
              <Choice
                key={v.id}
                selected={v.id === pickedId}
                onClick={() => setPickedId(v.id)}
                title={v.name}
                aside={money(v.valetPricesPence[size])}
              >
                {v.rating != null && `${v.rating.toFixed(1)} rating. `}
                {premises ? `${v.address ?? ""}${miles != null ? `, ${miles.toFixed(1)} miles` : ""}` : "Comes to you"}
              </Choice>
            ))}
          </div>
        </>
      )}
      {picked && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <Select id="v-day" label="Day">
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Select id="v-slot" label="Time" defaultValue="10:00am">
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <PriceTable
              rows={[
                {
                  label: "Full valet",
                  detail: `${picked.name}, ${SIZE_NAMES[size]} vehicle, ${premises ? "at their premises" : "at your door"}`,
                  pence: picked.valetPricesPence[size],
                },
              ]}
              bookingFeePence={bookingFeePence}
              usualBookingFeePence={usualBookingFeePence}
            />
          </div>
          <Note>
            Includes exterior hand wash and wax, wheels and tyres, windows, interior vacuum, dashboard and trims, seats
            and carpets. About 3 hours.
          </Note>
          <TermsAndBook
            who="valeter"
            cta="Book valet"
            responsibility="They are responsible for the valet and any damage they cause."
          />
        </div>
      )}
    </ServiceCard>
  );
}
