"use client";

import { useState, useTransition } from "react";
import { locatePostcode } from "@/app/actions/booking";
import type { LatLng } from "@/lib/geo";

/** A postcode field that resolves to coordinates on demand. */
export function usePostcode(initial: string | null, initialAt: LatLng | null = null) {
  const [postcode, setPostcode] = useState(initial ?? "");
  const [at, setAt] = useState<LatLng | null>(initial ? initialAt : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function find(onFound?: (at: LatLng) => void) {
    setError(null);
    start(async () => {
      const found = await locatePostcode(postcode);
      if (found) {
        setAt(found);
        onFound?.(found);
      } else {
        setError("We couldn't find that postcode. Check it and try again.");
      }
    });
  }

  return { postcode, setPostcode, at, setAt, error, setError, pending, find };
}

/** The next `count` days, skipping Sundays, as display labels. */
export function nextDays(count = 7) {
  const out: string[] = [];
  for (let n = 1; out.length < count && n < count + 3; n++) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    if (d.getDay() !== 0) out.push(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }));
  }
  return out;
}
