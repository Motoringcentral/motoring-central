"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Browse" className="flex max-w-full flex-wrap gap-1 rounded-[10px] bg-black/20 p-[3px]">
      {items.map((item) => {
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className="rounded-lg px-[9px] py-[7px] text-[.8rem] font-bold text-navy no-underline aria-[current=page]:bg-navy aria-[current=page]:text-white"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
