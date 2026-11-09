import Link from "next/link";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

const PUBLIC_NAV = [
  { href: "/", label: "Book a service" },
  { href: "/cars", label: "Cars for sale" },
  { href: "/vans", label: "Vans for sale" },
  { href: "/about", label: "About us" },
  { href: "/network", label: "For partners" },
  { href: "/breakdown", label: "Breakdown cover" },
];

export function Header() {
  return (
    <header className="border-b-[3px] border-navy bg-sky px-4 py-3 text-navy">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2.5">
        <Logo />
        <NavLinks items={PUBLIC_NAV} />
        <div className="flex w-full flex-wrap items-center justify-end gap-3.5 text-[.8rem] font-semibold">
          <Link href="/login" className="underline">
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LaunchBanner() {
  return (
    <div className="relative z-[1] bg-accent px-3.5 py-2 text-center text-[.88rem] font-bold text-accent-ink">
      <span aria-hidden="true">🎉 </span>
      Launch offer: 50% off our booking fee. Just £2.50 per booking, usually £4.99.
    </div>
  );
}
