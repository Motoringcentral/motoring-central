// Ways a driver can get a job done. `slug` is used in URLs (/book/AB12CDE?mode=garage).
export const MODES = [
  { slug: "mobile", name: "Mobile mechanic", desc: "Comes to your home or work", partner: "MOBILE_MECHANIC" },
  { slug: "garage", name: "Garage", desc: "Drive to a partner garage near you. MOT available.", partner: "GARAGE" },
  {
    slug: "autoelec",
    name: "Auto electrician",
    desc: "Electrical faults, starting and charging, dash cams. Mobile or workshop.",
    partner: "AUTO_ELECTRICIAN",
  },
  { slug: "recovery", name: "Recovery", desc: "Tow or transport your car, any time", partner: "RECOVERY" },
  {
    slug: "evcharge",
    name: "Mobile EV charging",
    desc: "Out of charge or need a top-up? A charging van comes to you",
    partner: "MOBILE_EV_CHARGING",
  },
  { slug: "tyres", name: "Mobile tyres", desc: "A fitter brings new tyres to you", partner: "TYRE_FITTER" },
  { slug: "valet", name: "Full valet", desc: "Inside and out, at your door or at a garage", partner: "VALETER" },
  {
    slug: "body",
    name: "Bodywork and alloy wheels",
    desc: "Dents, scratches, accident repairs and alloy refurbs. Mobile or body shop, insurance approved options",
    partner: "BODYWORK",
  },
] as const;

export type Mode = (typeof MODES)[number];
export type ModeSlug = Mode["slug"];

export function modeBySlug(slug: string | undefined): Mode {
  return MODES.find((m) => m.slug === slug) ?? MODES[0];
}

// Fired by a service tile to send the driver to the reg box with that service chosen.
export const PICK_SERVICE_EVENT = "mc:pick-service";

export type PickServiceDetail = { mode: ModeSlug; label: string };
