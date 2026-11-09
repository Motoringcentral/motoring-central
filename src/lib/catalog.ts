// Jobs customers can book with mechanics, garages and auto electricians, with
// parts matched to the vehicle. Part prices are sample figures in pence for
// [budget, standard, premium] until the parts supplier is connected.

import type { BasicVehicle, FullVehicle } from "@/lib/vehicles";

export const QUALITIES = ["BUDGET", "STANDARD", "PREMIUM"] as const;
export type Quality = (typeof QUALITIES)[number];

export type Part = {
  name: string;
  detail: string;
  prices: [number, number, number];
  qty: number;
};

export type Job = {
  id: string;
  name: string;
  desc: string;
  hours: number;
  // MOT is a fixed fee set by each garage, not labour plus parts.
  mot?: boolean;
  parts: Part[];
};

type JobMode = "mobile" | "garage" | "autoelec";

// Basic vehicle is enough to list jobs; the full check fills in part details.
type JobVehicle = BasicVehicle & Partial<Pick<FullVehicle, "oilSpec" | "oilLitres">>;

export function jobsFor(mode: JobMode, v: JobVehicle): Job[] {
  const ev = v.fuel === "Electric";
  const ref = v.engineCc || 1;
  const battery: Part = {
    name: ev ? "12V auxiliary battery" : `Battery 096 / ${v.fuel === "Diesel" ? "AGM start-stop" : "EFB"}`,
    detail: "Correct type for your car",
    prices: [7500, 10500, 16000],
    qty: 1,
  };

  if (mode === "autoelec") {
    const jobs: Job[] = [
      { id: "efault", name: "Electrical fault finding", desc: "Warning lights, battery drain, dead circuits", hours: 1, parts: [] },
    ];
    if (!ev) {
      jobs.push(
        {
          id: "alt",
          name: "Alternator replacement",
          desc: "Battery not charging",
          hours: 1.5,
          parts: [{ name: "Alternator", detail: "Matched to your engine, exchange unit", prices: [9500, 16000, 26000], qty: 1 }],
        },
        {
          id: "start",
          name: "Starter motor replacement",
          desc: "Car clicks but will not start",
          hours: 1.5,
          parts: [{ name: "Starter motor", detail: "Matched to your engine, exchange unit", prices: [8500, 14000, 23000], qty: 1 }],
        },
      );
    }
    jobs.push(
      {
        id: "bat",
        name: "Battery replacement",
        desc: ev ? "12V auxiliary battery" : "Supplied, fitted and coded where needed",
        hours: 0.75,
        parts: [battery],
      },
      {
        id: "lock",
        name: "Central locking or electric window repair",
        desc: "Motor, regulator or wiring",
        hours: 1,
        parts: [{ name: "Window regulator or lock actuator", detail: "For the affected door", prices: [2800, 4500, 8000], qty: 1 }],
      },
      {
        id: "dash",
        name: "Dash cam fitted (hardwired)",
        desc: "Front and rear, wired to the fuse box",
        hours: 1,
        parts: [{ name: "Dash cam kit", detail: "Front and rear with hardwire kit", prices: [4500, 9000, 18000], qty: 1 }],
      },
      {
        id: "psens",
        name: "Rear parking sensors fitted",
        desc: "Colour-matched sensors and buzzer",
        hours: 2,
        parts: [{ name: "Parking sensor kit", detail: "4 sensors and display", prices: [2500, 4500, 9000], qty: 1 }],
      },
    );
    return jobs;
  }

  const jobs: Job[] = [];
  if (!ev) {
    const litres = v.oilLitres ?? 4.5;
    jobs.push({
      id: "svc",
      name: "Full service",
      desc: "Oil, oil filter, air and cabin filters",
      hours: 2,
      parts: [
        { name: `Engine oil ${v.oilSpec ?? ""}`.trim(), detail: `x ${litres} L`, prices: [420, 610, 950], qty: litres },
        { name: "Oil filter", detail: `Part ref OF-${ref}`, prices: [550, 990, 1450], qty: 1 },
        { name: "Air filter", detail: `Part ref AF-${ref}`, prices: [700, 1250, 1800], qty: 1 },
        { name: "Cabin filter", detail: `Part ref CF-${ref}`, prices: [600, 1000, 1500], qty: 1 },
      ],
    });
  }
  jobs.push(
    {
      id: "brk",
      name: "Front brake pads and discs",
      desc: "Pads and discs, axle set",
      hours: 2,
      parts: [
        { name: "Brake discs (pair)", detail: "Vented, matched to your model", prices: [3400, 6200, 11500], qty: 1 },
        { name: "Brake pads (set)", detail: "Front axle", prices: [1600, 2900, 5200], qty: 1 },
      ],
    },
    { id: "bat", name: "Battery replacement", desc: ev ? "12V auxiliary battery" : "Supplied and fitted", hours: 0.75, parts: [battery] },
  );
  if (mode === "garage") {
    jobs.push({ id: "mot", name: "MOT test", desc: "Done at an approved test centre", hours: 0, mot: true, parts: [] });
  }
  jobs.push({ id: "diag", name: "Diagnostics", desc: "Warning light scan and report", hours: 1, parts: [] });
  return jobs;
}

export function partsTotal(job: Job, quality: Quality) {
  const q = QUALITIES.indexOf(quality);
  return job.parts.reduce((sum, p) => sum + Math.round(p.prices[q] * p.qty), 0);
}

export function labourTotal(job: Job, ratePence: number) {
  return Math.round(job.hours * ratePence);
}

// Lowest likely price, shown before the customer registers.
export function fromPrice(job: Job, lowestRatePence: number, lowestMotPence: number) {
  if (job.mot) return lowestMotPence;
  return partsTotal(job, "BUDGET") + labourTotal(job, lowestRatePence);
}

// "From" prices for services that don't use the job list.
export const SIDE_FROM: Record<string, string> = {
  recovery: "Recovery from £65 call-out plus mileage.",
  evcharge: "Mobile EV charging from £55 call-out, plus the charge.",
  tyres: "Mobile tyre fitting from £12 a tyre, plus the tyres.",
  valet: "Full valet from £79 for a small car.",
  body: "Alloy wheel refurbishment from £59 a wheel. Bodywork is priced from your photos, with smart repairs from £70.",
};
