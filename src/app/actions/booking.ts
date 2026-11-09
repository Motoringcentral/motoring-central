"use server";

import type { LatLng } from "@/lib/geo";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isPlausibleReg, normaliseReg } from "@/lib/vehicles";

export type FullCheckResult = { ok: true } | { ok: false; error: string };

/** Uses one of the customer's full vehicle checks on this reg (free if already checked). */
export async function runFullCheck(rawReg: string): Promise<FullCheckResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Log in to run a full check." };
  const reg = normaliseReg(rawReg);
  if (!isPlausibleReg(reg)) return { ok: false, error: "That registration doesn't look right." };

  const userId = session.user.id;
  const existing = await db.vehicleCheck.findUnique({ where: { userId_reg: { userId, reg } } });
  if (existing) return { ok: true };

  // Decrement only if a check is left, so two quick clicks can't overspend.
  const spent = await db.user.updateMany({
    where: { id: userId, fullChecksLeft: { gt: 0 } },
    data: { fullChecksLeft: { decrement: 1 } },
  });
  if (spent.count === 0) {
    return { ok: false, error: "You have used your full vehicle checks. Book a job to get 2 more." };
  }
  await db.vehicleCheck.create({ data: { userId, reg } });
  return { ok: true };
}

/** Postcode to coordinates, via the free postcodes.io service. */
export async function locatePostcode(postcode: string): Promise<LatLng | null> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
    if (!res.ok) return null;
    const { result } = await res.json();
    return result?.latitude != null ? { lat: result.latitude, lng: result.longitude } : null;
  } catch {
    return null;
  }
}
