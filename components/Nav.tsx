"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/path", label: "Path" },
  { href: "/history", label: "Log" },
  { href: "/you", label: "You" },
];

/**
 * Bottom nav. Deliberately label-only, no icons: brand.md keeps orange
 * for the single tap that matters, and an icon row competes with the
 * rep card for attention. The active tab is terracotta text only.
 */
/** Screens that own the whole viewport: the floor, onboarding, marketing. */
const BARE = ["/rep", "/welcome", "/about", "/boss"];

export function Nav() {
  const path = usePathname();
  if (BARE.some((b) => path === b || path.startsWith(`${b}/`))) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-sand bg-white">
      <div className="flex">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 py-3.5 pb-[18px] text-center text-[13px] font-semibold ${
                active ? "text-terracotta-600" : "text-stone-500"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
