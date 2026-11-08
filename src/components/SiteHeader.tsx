"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

// Only pages that exist so far. More links get added as each phase is built.
const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Our services" },
  { href: "/about", label: "About us" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="in">
        <Link href="/" className="logo-link" aria-label="The Motoring Central, home">
          <Logo />
        </Link>
        <nav className="main-nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
