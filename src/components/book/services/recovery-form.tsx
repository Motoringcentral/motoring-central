"use client";

import { useState } from "react";
import { ROAD_FACTOR } from "@/lib/catalog";
import { type LatLng, milesBetween } from "@/lib/geo";
import { money, PriceTable, TermsAndBook } from "../quote-parts";
import { usePostcode } from "../use-postcode";
import { Choice, etaMinutes, Note, PostcodeRow, Select, ServiceCard, type ServiceFormProps } from "./shared";

const REASONS = ["Will not start", "Broke down on the road", "Accident", "Flat tyre", "Other"];

type Trip = { from: LatLng; to: LatLng; toName: string };

export function RecoveryForm({ partners, postcode, origin, bookingFeePence, usualBookingFeePence }: ServiceFormProps) {
  const pickup = usePostcode(null);
  const drop = usePostcode(postcode, origin);
  const [dest, setDest] = useState<"home" | "garage" | "other">("home");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const companies = partners.filter((p) => p.type === "RECOVERY" && p.location && p.callOutPence != null);
  const garages = partners.filter((p) => p.type === "GARAGE" && p.location);

  function findPrices() {
    setTrip(null);
    setPickedId(null);
    pickup.find((from) => {
      if (dest === "garage") {
        const nearest = [...garages].sort((a, b) => milesBetween(from, a.location!) - milesBetween(from, b.location!))[0];
        if (nearest) setTrip({ from, to: nearest.location!, toName: nearest.name });
        return;
      }
      drop.find((to) => setTrip({ from, to, toName: dest === "home" ? "your home" : drop.postcode.toUpperCase() }));
    });
  }

  const miles = trip ? Math.max(1, Math.round(milesBetween(trip.from, trip.to) * ROAD_FACTOR)) : 0;
  const options = trip
    ? companies
        .map((c) => {
          const away = milesBetween(c.location!, trip.from);
          return { c, away, eta: etaMinutes(away), price: c.callOutPence! + (c.perMilePence ?? 0) * miles };
        })
        .filter((o) => o.away <= (o.c.travelRadiusMiles ?? 30))
        .sort((a, b) => a.eta - b.eta)
    : [];
  const picked = options.find((o) => o.c.id === pickedId);
  const milesText = `${miles} mile${miles === 1 ? "" : "s"}`;

  return (
    <ServiceCard
      title="Vehicle recovery"
      intro="Tell us where the car is and where it needs to go. In immediate danger, call 999 first."
    >
      <PostcodeRow id="r-pick" label="Where is the car? (postcode)" value={pickup.postcode} onChange={pickup.setPostcode} error={pickup.error} />
      <Select id="r-dest" label="Where should it go?" value={dest} onChange={(e) => setDest(e.target.value as typeof dest)}>
        <option value="home">My home</option>
        <option value="garage">The nearest partner garage</option>
        <option value="other">Another address</option>
      </Select>
      {dest !== "garage" && (
        <PostcodeRow
          id="r-drop"
          label="Destination postcode"
          value={drop.postcode}
          onChange={drop.setPostcode}
          error={drop.error}
        />
      )}
      <Select id="r-why" label="What happened?">
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
      <button type="button" className="btn mt-3.5 block w-full" onClick={findPrices} disabled={pickup.pending || drop.pending}>
        {pickup.pending || drop.pending ? "Finding prices…" : "Get recovery prices"}
      </button>

      {trip && (
        <>
          <p className="mt-3 text-[.88rem]">
            About <b>{milesText}</b> to {trip.toName}.
          </p>
          {options.length === 0 && <p className="text-muted">No recovery partners cover this area yet.</p>}
          <div className="mt-2 grid gap-2">
            {options.map(({ c, eta, price }) => (
              <Choice key={c.id} selected={c.id === pickedId} onClick={() => setPickedId(c.id)} title={c.name} aside={money(price)}>
                Arrives in about {eta} minutes. {money(c.callOutPence!)} call-out + {money(c.perMilePence ?? 0)} per mile x {milesText}
              </Choice>
            ))}
          </div>
        </>
      )}

      {picked && (
        <div className="mt-3">
          <PriceTable
            rows={[{ label: "Recovery", detail: `${picked.c.name}, ${milesText}`, pence: picked.price }]}
            bookingFeePence={bookingFeePence}
            usualBookingFeePence={usualBookingFeePence}
          />
          <TermsAndBook
            who="recovery company"
            cta="Book recovery"
            responsibility="They are responsible for my vehicle while it is in their care."
          />
        </div>
      )}
      <Note>Sample companies shown. Arrival times are estimates from each company&rsquo;s base.</Note>
    </ServiceCard>
  );
}
