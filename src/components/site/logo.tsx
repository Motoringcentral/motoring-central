import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="The Motoring Central, home" className="inline-flex items-center gap-2.5 text-navy">
      <svg width="42" height="42" viewBox="0 0 120 120" aria-hidden="true" className="flex-none">
        <rect width="120" height="120" rx="30" fill="#0B1C35" />
        <path d="M30.3 89.7 A42 42 0 1 1 89.7 89.7" fill="none" stroke="#38BDF8" strokeWidth="7" strokeLinecap="round" />
        <polyline
          points="38,82 38,46 60,68 82,46 82,82"
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="60" cy="68" r="8" fill="#FFD43B" />
      </svg>
      <span aria-hidden="true" className="flex flex-col gap-[3px] font-display leading-none">
        <span className="text-[.55rem] font-bold tracking-[.5em]">THE</span>
        <span className="whitespace-nowrap text-[1.2rem] font-extrabold tracking-[-.02em]">MOTORING</span>
        <span className="self-start whitespace-nowrap rounded-[5px] bg-navy py-[3px] pr-[3px] pl-[7px] text-[.6rem] font-bold tracking-[.38em] text-white">
          CENTRAL
        </span>
        <small className="text-[.64rem] font-medium tracking-[.04em] opacity-90">Buy. Fix. Clean. Rescue.</small>
      </span>
    </Link>
  );
}
