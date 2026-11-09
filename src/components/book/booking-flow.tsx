"use client";

import { useState } from "react";
import { fromPrice, jobsFor, SIDE_FROM } from "@/lib/catalog";
import { formatPence } from "@/lib/pricing";
import { MODES, modeBySlug, type ModeSlug } from "@/lib/services";
import { GarageQuote } from "./garage-quote";
import { MechanicQuote } from "./mechanic-quote";
import { BodyForm } from "./services/body-form";
import { EvChargeForm } from "./services/ev-charge-form";
import { RecoveryForm } from "./services/recovery-form";
import type { ServiceFormProps } from "./services/shared";
import { TyresForm } from "./services/tyres-form";
import { ValetForm } from "./services/valet-form";
import type { BookingProps } from "./types";
import { UnlockCard } from "./unlock-card";
import { VehicleCard } from "./vehicle-card";

const JOB_MODES = ["mobile", "garage", "autoelec"] as const;
type JobMode = (typeof JOB_MODES)[number];
const isJobMode = (m: ModeSlug): m is JobMode => (JOB_MODES as readonly string[]).includes(m);

export function BookingFlow(props: BookingProps) {
  const { reg, displayReg, vehicle, fullCheck, viewer, partners } = props;
  const [mode, setMode] = useState<ModeSlug>(modeBySlug(props.initialMode).slug);
  const [jobId, setJobId] = useState<string | null>(props.initialJob);

  const origin = viewer.signedIn ? viewer.origin : null;
  const jobs = isJobMode(mode) ? jobsFor(mode, vehicle) : [];
  const job = jobs.find((j) => j.id === jobId) ?? null;

  const partnerType = mode === "autoelec" ? "AUTO_ELECTRICIAN" : mode === "garage" ? "GARAGE" : "MOBILE_MECHANIC";
  const modePartners = partners.filter((p) => p.type === partnerType);
  const lowestRate = Math.min(...modePartners.map((p) => p.ratePence), 3800);
  const lowestMot = Math.min(
    ...partners.filter((p) => p.motFeePence != null).map((p) => p.motFeePence as number),
    3500,
  );

  const urlFor = (m: ModeSlug, j: string | null) => `/book/${reg}?mode=${m}${j ? `&job=${j}` : ""}`;

  function choose(m: ModeSlug, j: string | null) {
    setMode(m);
    setJobId(j);
    // Keep the URL in step so a refresh, or returning from sign-up, restores the choice.
    window.history.replaceState(null, "", urlFor(m, j));
  }

  const unlockLine = job
    ? `${job.name} from ${formatPence(fromPrice(job, lowestRate, lowestMot))}. The exact price depends on your engine and the parts it needs.`
    : (SIDE_FROM[mode] ?? "");

  return (
    <>
      <VehicleCard
        vehicle={vehicle}
        fullCheck={fullCheck}
        displayReg={displayReg}
        signedIn={viewer.signedIn}
        checksLeft={viewer.signedIn ? viewer.checksLeft : undefined}
      />

      <section className="card" aria-labelledby="how-h">
        <h2 id="how-h" className="mt-0 mb-2.5 text-[1.1rem] font-bold">
          How do you want it done?
        </h2>
        <div className="grid gap-2">
          {MODES.map((m) => (
            <button key={m.slug} type="button" className="opt" aria-pressed={m.slug === mode} onClick={() => choose(m.slug, null)}>
              <span>
                {m.name}
                <small className="block">{m.desc}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {isJobMode(mode) && (
        <section className="card" aria-labelledby="what-h">
          <h2 id="what-h" className="mt-0 mb-2.5 text-[1.1rem] font-bold">
            What does it need?
          </h2>
          <div className="grid gap-2">
            {jobs.map((j) => (
              <button key={j.id} type="button" className="opt" aria-pressed={j.id === jobId} onClick={() => choose(mode, j.id)}>
                <span>
                  {j.name}
                  <small className="block">
                    {j.desc}
                    {!fullCheck && (
                      <>
                        . <b className="text-ink">From {formatPence(fromPrice(j, lowestRate, lowestMot))}</b>
                      </>
                    )}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!fullCheck && (job || !isJobMode(mode)) && (
        <UnlockCard
          reg={reg}
          displayReg={displayReg}
          viewer={viewer}
          priceLine={unlockLine}
          returnTo={urlFor(mode, jobId)}
        />
      )}

      {fullCheck && job && mode !== "garage" && (
        <MechanicQuote
          key={`${mode}-${job.id}`}
          job={job}
          partners={modePartners}
          autoElec={mode === "autoelec"}
          origin={origin}
          bookingFeePence={props.bookingFeePence}
          usualBookingFeePence={props.usualBookingFeePence}
        />
      )}

      {fullCheck && job && mode === "garage" && (
        <GarageQuote
          key={job.id}
          job={job}
          garages={modePartners}
          initialPostcode={viewer.signedIn ? viewer.postcode : null}
          initialOrigin={origin}
          bookingFeePence={props.bookingFeePence}
          usualBookingFeePence={props.usualBookingFeePence}
        />
      )}

      {fullCheck && "model" in vehicle && !isJobMode(mode) && (
        <SideServiceForm
          key={mode}
          mode={mode}
          vehicle={vehicle}
          partners={partners}
          postcode={viewer.signedIn ? viewer.postcode : null}
          origin={origin}
          bookingFeePence={props.bookingFeePence}
          usualBookingFeePence={props.usualBookingFeePence}
        />
      )}
    </>
  );
}

function SideServiceForm({ mode, ...props }: ServiceFormProps & { mode: ModeSlug }) {
  switch (mode) {
    case "recovery":
      return <RecoveryForm {...props} />;
    case "evcharge":
      return <EvChargeForm {...props} />;
    case "tyres":
      return <TyresForm {...props} />;
    case "valet":
      return <ValetForm {...props} />;
    case "body":
      return <BodyForm {...props} />;
    default:
      return null;
  }
}
