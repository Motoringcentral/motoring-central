"use client";

import { useEffect, useMemo, useState } from "react";
import { INPUT } from "@/components/forms";
import { ALLOY_FINISHES } from "@/lib/catalog";
import { milesBetween } from "@/lib/geo";
import { money, PriceTable, TermsAndBook } from "../quote-parts";
import { nextDays, usePostcode } from "../use-postcode";
import { Choice, Label, Note, PostcodeRow, Select, ServiceCard, type ServiceFormProps } from "./shared";

const DAMAGE = [
  "Scratches or scuffs (smart repair)",
  "Small dent, paint not damaged (paintless dent removal)",
  "Dent with paint damage",
  "Bumper scuff, crack or split",
  "Stone chips",
  "Panel respray",
  "Rust or corrosion repair",
  "Accident damage (more than one panel)",
];
// From "Panel respray" onwards the work needs a body shop.
const FIRST_BODY_SHOP_JOB = 5;
const PDR_JOB = 1;
const MAX_REPAIRERS = 3;

export function BodyForm(props: ServiceFormProps) {
  const [job, setJob] = useState<"body" | "alloy">("body");
  return (
    <ServiceCard
      title="Bodywork and alloy wheels"
      intro="Mobile repairers come to you. Body shops and wheel centres do the work at their premises. Every repairer is checked, and you can choose insurance-approved repairers."
    >
      <div className="seg mt-3" role="group" aria-label="Type of job">
        <button type="button" aria-pressed={job === "body"} onClick={() => setJob("body")}>
          Bodywork repair
        </button>
        <button type="button" aria-pressed={job === "alloy"} onClick={() => setJob("alloy")}>
          Alloy wheel refurb
        </button>
      </div>
      {job === "body" ? <BodyworkQuote {...props} /> : <AlloyBooking {...props} />}
    </ServiceCard>
  );
}

function BodyworkQuote({ partners, postcode, origin }: ServiceFormProps) {
  const pc = usePostcode(postcode, origin);
  const [damage, setDamage] = useState(0);
  const [insurance, setInsurance] = useState(false);
  const [insurer, setInsurer] = useState("");
  const [where, setWhere] = useState<"any" | "mobile" | "shop">("any");
  const [photos, setPhotos] = useState<File[]>([]);
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const bodyShopOnly = damage >= FIRST_BODY_SHOP_JOB || insurance;
  const repairers = partners
    .filter((p) => p.type === "BODYWORK" && p.bodywork)
    .filter((p) => {
      const mobile = p.workLocation === "MOBILE";
      if (insurance && !p.insuranceApproved) return false;
      if (bodyShopOnly && mobile) return false;
      if (where === "mobile" && !mobile) return false;
      if (where === "shop" && mobile) return false;
      if (damage === PDR_JOB && mobile && !p.skills.includes("pdr")) return false;
      return true;
    })
    .map((p) => ({ p, miles: pc.at && p.location ? milesBetween(pc.at, p.location) : null }));
  const chosen = picked.filter((id) => repairers.some((r) => r.p.id === id));

  function toggle(id: string) {
    setLimitMsg(null);
    if (chosen.includes(id)) setPicked(chosen.filter((x) => x !== id));
    else if (chosen.length >= MAX_REPAIRERS) setLimitMsg(`You can send your request to up to ${MAX_REPAIRERS} repairers.`);
    else setPicked([...chosen, id]);
  }

  const note =
    damage >= FIRST_BODY_SHOP_JOB && where !== "shop"
      ? "Resprays, rust and accident repairs are done at a body shop, so only body shops are shown."
      : insurance
        ? "Insurance claims are repaired by insurance-approved body shops."
        : null;

  return (
    <>
      <Select id="b-what" label="What needs repairing?" value={damage} onChange={(e) => setDamage(Number(e.target.value))}>
        {DAMAGE.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </Select>
      <Select id="b-panels" label="Panels affected">
        {["1 panel", "2 panels", "3 or more panels", "Not sure"].map((p) => (
          <option key={p}>{p}</option>
        ))}
      </Select>
      <Label>How are you paying?</Label>
      <div className="grid gap-2">
        <Choice selected={!insurance} onClick={() => setInsurance(false)} title="Paying myself">
          See approved and independent repairers
        </Choice>
        <Choice selected={insurance} onClick={() => setInsurance(true)} title="Insurance claim">
          Only insurance-approved repairers are shown
        </Choice>
      </div>
      {insurance && (
        <>
          <Label htmlFor="b-ins">Your insurer</Label>
          <input id="b-ins" className={INPUT} placeholder="e.g. Admiral" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
          <Label htmlFor="b-claim">Claim reference (if you have one)</Label>
          <input id="b-claim" className={INPUT} />
          <Note>
            Check with your insurer before the repair. Most insurers have their own approved repairers, and you usually
            pay your excess to the repairer when you collect the car.
          </Note>
        </>
      )}
      <Select id="b-where" label="Where should it be done?" value={where} onChange={(e) => setWhere(e.target.value as typeof where)}>
        <option value="any">Show me both</option>
        <option value="mobile">At my home or work (mobile smart repair)</option>
        <option value="shop">At a body shop</option>
      </Select>
      {note && <Note>{note}</Note>}
      <PostcodeRow
        id="b-post"
        label="Postcode"
        value={pc.postcode}
        onChange={pc.setPostcode}
        onFind={() => pc.find()}
        pending={pc.pending}
        button="Show distances"
        error={pc.error}
      />

      <Label htmlFor="b-photos">Photos of the damage (2 to 6)</Label>
      <input
        id="b-photos"
        type="file"
        accept="image/*"
        multiple
        className="block w-full text-[.88rem]"
        onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 6))}
      />
      {previews.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element -- local previews, not optimisable
            <img key={src} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
      <Note>One close-up and one from a few steps back, in daylight if you can.</Note>

      <Label htmlFor="b-desc">Tell the repairer about it</Label>
      <textarea
        id="b-desc"
        className={`${INPUT} min-h-24`}
        placeholder="e.g. Reversed into a post. Rear bumper scuffed and the parking sensor is loose."
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />

      <Label>Send your request to up to {MAX_REPAIRERS} repairers</Label>
      {repairers.length === 0 && <p className="text-muted">No repairers match. Try &ldquo;Show me both&rdquo;.</p>}
      <div className="grid gap-2">
        {repairers.map(({ p, miles }) => (
          <Choice
            key={p.id}
            selected={chosen.includes(p.id)}
            onClick={() => toggle(p.id)}
            title={
              <>
                {p.name}
                {p.insuranceApproved && (
                  <span className="ml-1.5 rounded-md bg-soft px-1.5 py-0.5 text-[.72rem] font-bold text-brand">
                    Insurance approved
                  </span>
                )}
              </>
            }
            aside={p.bodyworkFromPence != null ? `from ${money(p.bodyworkFromPence)}` : undefined}
          >
            {p.rating != null && `${p.rating.toFixed(1)} rating. `}
            {p.workLocation === "MOBILE" ? "Comes to you" : `Body shop${miles != null ? `, ${miles.toFixed(1)} miles` : ""}`}.{" "}
            {p.accreditation}
          </Choice>
        ))}
      </div>
      {limitMsg && (
        <p role="alert" className="mt-1.5 text-[.85rem] font-semibold text-err">
          {limitMsg}
        </p>
      )}
      <Note>
        Guide prices only. Each repairer sends you a fixed price from your photos, usually within 24 hours. You pay
        nothing until you accept a quote.
      </Note>
      <TermsAndBook
        who="repairer"
        cta="Request quotes"
        responsibility="They carry out the work and give the warranty on the repair and paintwork."
        validate={() => {
          if (insurance && !insurer.trim()) return "Enter the name of your insurer.";
          if (pc.postcode.replace(/\s/g, "").length < 5) return "Enter the postcode where the car is.";
          if (photos.length < 2) return "Add at least 2 photos of the damage.";
          if (chosen.length === 0) return "Choose at least one repairer to send your request to.";
          return null;
        }}
        notice="Sending quote requests is the next step to be built (it needs photo storage). Your request is ready."
      />
    </>
  );
}

function AlloyBooking({ vehicle, partners, postcode, origin, bookingFeePence, usualBookingFeePence }: ServiceFormProps) {
  const pc = usePostcode(postcode, origin);
  const [wheels, setWheels] = useState(4);
  const [finish, setFinish] = useState(0);
  const [atCentre, setAtCentre] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const days = useMemo(() => nextDays(9), []);

  // Diamond cutting needs a lathe, so only wheel centres can do it.
  const centre = atCentre || finish === 1;
  const inches = Number(vehicle.tyreSize.match(/R\s?(\d{2})/)?.[1]) || null;

  const specialists = partners
    .filter((p) => p.type === "BODYWORK" && p.alloy && p.alloyPricesPence[finish] != null)
    .filter((p) => (centre ? p.workLocation !== "MOBILE" : p.workLocation === "MOBILE"))
    .map((p) => ({ p, miles: pc.at && p.location ? milesBetween(pc.at, p.location) : null }))
    .sort((a, b) => (centre ? (a.miles ?? 0) - (b.miles ?? 0) : a.p.alloyPricesPence[finish]! - b.p.alloyPricesPence[finish]!));
  const picked = specialists.find((s) => s.p.id === pickedId)?.p;
  const each = picked?.alloyPricesPence[finish] ?? 0;

  return (
    <>
      <Select id="a-n" label="Wheels to refurbish" value={wheels} onChange={(e) => setWheels(Number(e.target.value))}>
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n} wheel{n > 1 ? "s" : ""}
          </option>
        ))}
      </Select>
      <Select
        id="a-fin"
        label="Finish"
        value={finish}
        onChange={(e) => {
          setFinish(Number(e.target.value));
          setPickedId(null);
        }}
      >
        {ALLOY_FINISHES.map((f, i) => (
          <option key={f.name} value={i}>
            {f.label}
          </option>
        ))}
      </Select>
      {inches && (
        <Note>
          Your wheels are {inches} inch, from your full vehicle check.
          {inches >= 19 && " Wheels of 19 inch and over may cost more."}
        </Note>
      )}
      <Select
        id="a-where"
        label="Where should it be done?"
        value={centre ? "centre" : "mobile"}
        onChange={(e) => {
          setAtCentre(e.target.value === "centre");
          setPickedId(null);
        }}
      >
        <option value="mobile" disabled={finish === 1}>
          At my home or work (mobile)
        </option>
        <option value="centre">At a wheel centre</option>
      </Select>
      <Note>
        {finish === 1
          ? "Diamond cutting needs a lathe, so it is done at a wheel centre."
          : centre
            ? "Centres remove the tyre, refurbish the wheel and refit and balance it. Usually same day."
            : "Done on your drive in about 2 to 3 hours a wheel. Tyres stay on the wheel."}
      </Note>
      <PostcodeRow
        id="a-post"
        label="Postcode"
        value={pc.postcode}
        onChange={pc.setPostcode}
        onFind={() => pc.find()}
        pending={pc.pending}
        button="Show distances"
        error={pc.error}
      />
      <Label>Choose your wheel specialist</Label>
      <div className="grid gap-2">
        {specialists.map(({ p, miles }) => (
          <Choice
            key={p.id}
            selected={p.id === pickedId}
            onClick={() => setPickedId(p.id)}
            title={p.name}
            aside={`${money(p.alloyPricesPence[finish]!)} a wheel`}
          >
            {p.rating != null && `${p.rating.toFixed(1)} rating. `}
            {p.workLocation === "MOBILE" ? "Comes to you" : `${p.address ?? "Wheel centre"}${miles != null ? `, ${miles.toFixed(1)} miles` : ""}`}
          </Choice>
        ))}
      </div>
      {picked && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <Select id="a-day" label="Day">
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Select id="a-slot" label="Time" defaultValue="9:00am">
              {["8:00am", "9:00am", "11:00am", "1:00pm"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <PriceTable
              rows={[
                {
                  label: ALLOY_FINISHES[finish].name,
                  detail: `${picked.name}, ${wheels} wheel${wheels > 1 ? "s" : ""} at ${money(each)} each, ${centre ? "at their wheel centre" : "at your door"}`,
                  pence: each * wheels,
                },
              ]}
              bookingFeePence={bookingFeePence}
              usualBookingFeePence={usualBookingFeePence}
            />
          </div>
          <Note>
            {finish === 3
              ? "Repairs kerb scuffs on the wheel rim and repaints the repaired area. Deep cracks or buckled wheels need a wheel centre."
              : "Includes removing kerb damage, filling, priming, painting and lacquer. Cracked or buckled wheels are checked first and may need straightening at extra cost."}
          </Note>
          <TermsAndBook
            who="wheel specialist"
            cta="Book alloy refurb"
            responsibility="They are responsible for the work, the finish and its warranty."
            validate={() => (pc.postcode.replace(/\s/g, "").length < 5 ? "Enter the postcode where the car is." : null)}
          />
        </div>
      )}
    </>
  );
}
