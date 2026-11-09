import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { locatePostcode } from "@/app/actions/booking";
import { BookingFlow } from "@/components/book/booking-flow";
import type { PartnerOption, Viewer } from "@/components/book/types";
import { db } from "@/lib/db";
import { current, PRICES } from "@/lib/pricing";
import { getSession } from "@/lib/session";
import { displayReg, fullVehicleCheck, isPlausibleReg, lookupVehicle, normaliseReg } from "@/lib/vehicles";

export const metadata: Metadata = { title: "Book a service" };

export default function BookPage(props: PageProps<"/book/[reg]">) {
  return (
    <main className="mx-auto max-w-page px-4 pt-5.5">
      <Suspense fallback={<p className="card text-muted">Checking your vehicle…</p>}>
        <Booking {...props} />
      </Suspense>
    </main>
  );
}

async function Booking({ params, searchParams }: PageProps<"/book/[reg]">) {
  const reg = normaliseReg((await params).reg);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  if (!isPlausibleReg(reg)) return <NotFound />;

  const session = await getSession();
  const user = session
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { fullChecksLeft: true, postcode: true, vehicleChecks: { select: { reg: true } } },
      })
    : null;
  const checkedRegs = user?.vehicleChecks.map((c) => c.reg) ?? [];
  const fullCheck = checkedRegs.includes(reg);

  const [vehicle, origin, partners] = await Promise.all([
    fullCheck ? fullVehicleCheck(reg) : lookupVehicle(reg),
    user?.postcode ? locatePostcode(user.postcode) : null,
    loadPartners(),
  ]);
  if (!vehicle) return <NotFound />;

  const viewer: Viewer = user
    ? { signedIn: true, checksLeft: user.fullChecksLeft, checkedRegs, postcode: user.postcode, origin }
    : { signedIn: false };

  return (
    <BookingFlow
      reg={reg}
      displayReg={displayReg(reg)}
      vehicle={vehicle}
      fullCheck={fullCheck}
      viewer={viewer}
      partners={partners}
      bookingFeePence={current(PRICES.bookingFee)}
      usualBookingFeePence={PRICES.bookingFee.usual}
      initialMode={one(sp.mode) ?? "mobile"}
      initialJob={one(sp.job) ?? null}
    />
  );
}

async function loadPartners(): Promise<PartnerOption[]> {
  const rows = await db.partner.findMany({
    where: { status: "APPROVED", type: { in: ["MOBILE_MECHANIC", "AUTO_ELECTRICIAN", "GARAGE"] } },
    orderBy: { businessName: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.businessName,
    type: p.type as PartnerOption["type"],
    ratePence: p.labourRatePence ?? 0,
    motFeePence: p.isMotStation ? p.motFeePence : null,
    rating: p.ratingAvg,
    jobs: p.jobsCompleted,
    address: p.addressLine1,
    workLocation: p.workLocation,
    location: p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null,
  }));
}

function NotFound() {
  return (
    <div className="card">
      <h1 className="m-0 text-[1.3rem] font-bold">We couldn&rsquo;t find that registration</h1>
      <p className="mt-2 text-muted">Check the reg and try again.</p>
      <Link href="/#reg" className="btn mt-3">
        Try another reg
      </Link>
    </div>
  );
}
