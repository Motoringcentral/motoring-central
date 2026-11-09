import type { PartnerType } from "@/generated/prisma/enums";
import type { LatLng } from "@/lib/geo";
import type { BasicVehicle, FullVehicle } from "@/lib/vehicles";

export type PartnerOption = {
  id: string;
  name: string;
  type: PartnerType;
  ratePence: number;
  motFeePence: number | null;
  rating: number | null;
  jobs: number;
  address: string | null;
  workLocation: "MOBILE" | "WORKSHOP" | "BOTH";
  location: LatLng | null;
  travelRadiusMiles: number | null;
  // Recovery and EV charging
  callOutPence: number | null;
  perMilePence: number | null;
  perMileOutsidePence: number | null;
  equipment: string | null;
  connectors: string[];
  // Tyres
  fitPerTyrePence: number | null;
  puncturePence: number | null;
  // Valeting, by vehicle size
  valetPricesPence: number[];
  // Bodywork and alloys
  bodywork: boolean;
  alloy: boolean;
  // Per wheel: standard refurb, diamond cut, colour change, kerb repair
  alloyPricesPence: (number | null)[];
  bodyworkFromPence: number | null;
  insuranceApproved: boolean;
  accreditation: string | null;
  skills: string[];
};

export type Viewer =
  | { signedIn: false }
  | { signedIn: true; checksLeft: number; checkedRegs: string[]; postcode: string | null; origin: LatLng | null };

export type BookingProps = {
  reg: string;
  displayReg: string;
  vehicle: BasicVehicle | FullVehicle;
  fullCheck: boolean;
  viewer: Viewer;
  partners: PartnerOption[];
  bookingFeePence: number;
  usualBookingFeePence: number;
  initialMode: string;
  initialJob: string | null;
};
