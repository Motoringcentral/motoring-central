import type { BasicVehicle, FullVehicle } from "@/lib/vehicles";

export function VehicleCard({
  vehicle,
  fullCheck,
  displayReg,
  signedIn,
  checksLeft,
}: {
  vehicle: BasicVehicle | FullVehicle;
  fullCheck: boolean;
  displayReg: string;
  signedIn: boolean;
  checksLeft?: number;
}) {
  const full = fullCheck && "model" in vehicle ? vehicle : null;
  const engine = vehicle.engineCc ? `${vehicle.engineCc} cc` : "Electric motor";
  const rows: [string, string][] = [
    ["Year", String(vehicle.year)],
    ["Fuel", vehicle.fuel],
    ["Engine", engine],
    ...(full ? ([["Gearbox", full.transmission]] as [string, string][]) : []),
    ["Colour", vehicle.colour],
    ["MOT", vehicle.mot],
    ...(full ? ([["Tyre size", full.tyreSize]] as [string, string][]) : []),
  ];

  return (
    <section className="card" aria-label="Your vehicle">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
        <svg viewBox="0 0 92 52" aria-hidden="true" className="h-[52px] w-[92px]">
          <path d="M6 36l6-14c2-4 6-6 10-6h30c5 0 9 2 12 6l10 8c4 1 6 3 6 6v2H6z" fill="var(--brand)" />
          <circle cx="26" cy="38" r="7" fill="var(--ink)" />
          <circle cx="68" cy="38" r="7" fill="var(--ink)" />
        </svg>
        <div>
          <span className="inline-block rounded-md bg-soft px-[7px] py-0.5 text-[.75rem] font-bold text-brand">
            {full ? "Full vehicle check" : "Free DVLA check"}
          </span>
          <h1 className="m-0 text-[1.3rem] font-bold">
            {vehicle.make} {full?.model}
          </h1>
          <p className="m-0 text-[.85rem] font-bold tracking-[.08em] text-muted">{displayReg}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-[.88rem]">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[.76rem] text-muted">{label}</dt>
            <dd className="m-0">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[.8rem] text-muted">
        {full
          ? `Exact model, engine and parts confirmed. ${checksLeft} full check${checksLeft === 1 ? "" : "s"} left.`
          : `Model, gearbox, tyre size and parts are confirmed with a full check${signedIn ? "." : " when you register."}`}
      </p>
    </section>
  );
}
