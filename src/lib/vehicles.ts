import "server-only";

// Free basic check: what the DVLA Vehicle Enquiry Service returns.
export type BasicVehicle = {
  reg: string;
  make: string;
  year: number;
  fuel: string;
  engineCc: number;
  colour: string;
  mot: string;
};

/** Normalise a UK registration: uppercase, no spaces. */
export function normaliseReg(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Display form, e.g. LM19XYZ -> LM19 XYZ for current-style plates. */
export function displayReg(reg: string) {
  return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg) ? `${reg.slice(0, 4)} ${reg.slice(4)}` : reg;
}

export function isPlausibleReg(reg: string) {
  return /^[A-Z0-9]{2,7}$/.test(reg) && /\d/.test(reg);
}

// Sample vehicles from the prototype, used until a DVLA key is configured.
const SAMPLES: Record<string, Omit<BasicVehicle, "reg">> = {
  LM19XYZ: { make: "Ford", year: 2019, fuel: "Petrol", engineCc: 999, colour: "Blue", mot: "Valid to 14 Mar 2027" },
  BD66TTR: { make: "Volkswagen", year: 2016, fuel: "Diesel", engineCc: 1968, colour: "Silver", mot: "Valid to 02 Jun 2027" },
  KS21EVO: { make: "Tesla", year: 2021, fuel: "Electric", engineCc: 0, colour: "White", mot: "First MOT due Sep 2027" },
};

const DVLA_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

export async function lookupVehicle(reg: string): Promise<BasicVehicle | null> {
  const key = process.env.DVLA_VES_API_KEY;
  if (!key) {
    const sample = SAMPLES[reg];
    return sample ? { reg, ...sample } : null;
  }

  const res = await fetch(DVLA_URL, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: reg }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`DVLA lookup failed: ${res.status}`);

  const v = await res.json();
  return {
    reg,
    make: titleCase(v.make ?? ""),
    year: v.yearOfManufacture,
    fuel: titleCase(v.fuelType ?? ""),
    engineCc: v.engineCapacity ?? 0,
    colour: titleCase(v.colour ?? ""),
    mot: v.motExpiryDate
      ? `Valid to ${new Date(v.motExpiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
      : v.motStatus ?? "Unknown",
  };
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
