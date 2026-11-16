import type { Metadata } from "next";
import { PdiForm } from "@/components/inspections/PdiForm";

export const metadata: Metadata = {
  title: "Pre-delivery inspection",
  description: "Record a vehicle's condition when a dealer hands it over to the buyer.",
  robots: { index: false, follow: false },
};

// Dealer tool. Phase 2 will put this behind the dealer login.
export default function PdiPage() {
  return <PdiForm />;
}
