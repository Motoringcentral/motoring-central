"use server";

import { type BasicVehicle, isPlausibleReg, lookupVehicle, normaliseReg } from "@/lib/vehicles";

export type RegCheckState =
  | { status: "idle" }
  | { status: "error"; message: string; reg: string }
  | { status: "found"; vehicle: BasicVehicle; reg: string };

export async function checkReg(_prev: RegCheckState, formData: FormData): Promise<RegCheckState> {
  const raw = String(formData.get("reg") ?? "");
  const reg = normaliseReg(raw);

  if (!isPlausibleReg(reg)) {
    return { status: "error", message: "Enter a valid UK registration, for example AB12 CDE.", reg: raw };
  }

  try {
    const vehicle = await lookupVehicle(reg);
    if (!vehicle) {
      return { status: "error", message: "We couldn't find that registration. Check it and try again.", reg: raw };
    }
    return { status: "found", vehicle, reg: raw.toUpperCase() };
  } catch {
    return { status: "error", message: "Our vehicle check is busy. Please try again in a moment.", reg: raw };
  }
}
