import type { LatLng } from "@/lib/geo";
import type { BasicVehicle, FullVehicle } from "@/lib/vehicles";

export type PartnerOption = {
  id: string;
  name: string;
  type: "MOBILE_MECHANIC" | "AUTO_ELECTRICIAN" | "GARAGE";
  ratePence: number;
  motFeePence: number | null;
  rating: number | null;
  jobs: number;
  address: string | null;
  workLocation: "MOBILE" | "WORKSHOP" | "BOTH";
  location: LatLng | null;
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
