import type { Metadata } from "next";
import { InspectionForm } from "@/components/inspections/InspectionForm";

export const metadata: Metadata = {
  title: "Pre-work vehicle inspection",
  description: "Record a vehicle's condition before a partner starts work.",
  robots: { index: false, follow: false },
};

// Partner tool. Phase 2 will put this behind the partner login.
export default function InspectionPage() {
  return <InspectionForm />;
}
