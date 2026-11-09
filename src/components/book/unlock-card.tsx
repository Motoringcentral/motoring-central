"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runFullCheck } from "@/app/actions/booking";
import type { Viewer } from "./types";

export function UnlockCard({
  reg,
  displayReg,
  viewer,
  priceLine,
  returnTo,
}: {
  reg: string;
  displayReg: string;
  viewer: Viewer;
  priceLine: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = encodeURIComponent(returnTo);

  function unlock() {
    setError(null);
    start(async () => {
      const res = await runFullCheck(reg);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="card border-l-4 border-l-sun" aria-live="polite">
      <h2 className="mt-0 mb-2.5 text-[1.1rem] font-bold">Get your exact price</h2>
      <p className="mb-3 font-bold text-brand">{priceLine}</p>

      {!viewer.signedIn ? (
        <>
          <p className="mb-3">
            Register free and we run a full check on <b>{displayReg}</b> to confirm the exact model, engine and parts.
            You then see fixed prices from local partners.
          </p>
          <Link href={`/register?next=${next}`} className="btn block w-full">
            Register free for exact prices
          </Link>
          <p className="mt-2.5 text-[.8rem] text-muted">
            Already registered?{" "}
            <Link href={`/login?next=${next}`} className="font-semibold text-ink underline">
              Log in
            </Link>
          </p>
        </>
      ) : viewer.checksLeft > 0 ? (
        <>
          <p className="mb-3">
            A full vehicle check confirms the exact model, engine and parts for <b>{displayReg}</b>.
          </p>
          <button type="button" className="btn block w-full" onClick={unlock} disabled={pending}>
            {pending ? "Running full check…" : "Get exact prices"}
          </button>
          <p className="mt-2.5 text-[.8rem] text-muted">
            Uses 1 of your {viewer.checksLeft} full check{viewer.checksLeft === 1 ? "" : "s"}. Each booking gives you 2
            more.
          </p>
        </>
      ) : (
        <>
          <p className="mb-2">
            <b>You have used your 2 full vehicle checks.</b> Book a job on a car you have already checked to get 2
            more.
          </p>
          {viewer.checkedRegs.length > 0 && (
            <p className="text-[.8rem] text-muted">
              Already checked: {viewer.checkedRegs.join(", ")}. Enter one of these to see its prices again.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[.88rem] font-semibold text-err">
          {error}
        </p>
      )}
    </section>
  );
}
