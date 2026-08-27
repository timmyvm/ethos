"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGames,
  IconLog,
  IconToday,
  IconYou,
} from "@/components/Icon";

/**
 * Bottom nav.
 *
 * It was label-only, on the argument that an icon row competes with the
 * rep card for attention. It doesn't — the icons are stone line marks at
 * 22px, the same weight as the words under them, while the floor card
 * carries a 32px headline and the only filled colour on the screen. What
 * the icons buy is the thing labels alone can't: a shape to aim at.
 * Four words in identical grey are four identical targets, and the tab
 * bar is the one control people hit without reading (DECISIONS #152).
 *
 * The active tab is still terracotta, and still text-and-mark only — no
 * pill, no filled icon, no indicator bar. brand.md's one-tap rule is
 * about filled colour, and this is a colour swap on a 13px label.
 */
/*
 * Path lost its tab when the merge finished (DECISIONS #155): home has
 * carried the whole road since #141, so the tab was a second door to
 * the same room. Duolingo's precedent, from the other direction: their
 * 2022 redesign folded the tree INTO home and cut a tab doing it. The
 * freed slot is Games (#157), in Elevate's word for the same surface.
 */
/*
 * "Games" became "Tools" on 27 Aug (#184): with upload-and-analyze in
 * the menu the tab stopped being only games, and Tools is the honest
 * name for a room of drills, bosses and analyzers. The /games route and
 * the icon identifiers keep their names: nobody reads code aloud and
 * bookmarks live (#164's rule).
 */
const TABS = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/games", label: "Tools", Icon: IconGames },
  { href: "/history", label: "Log", Icon: IconLog },
  { href: "/you", label: "You", Icon: IconYou },
];

/**
 * Screens that own the whole viewport: the floor, onboarding, marketing,
 * and the account screens — a tab bar under a sign-up form invites people
 * to wander off mid-form.
 */
const BARE = [
  "/rep",
  "/hostile",
  "/calibrate",
  "/welcome",
  "/about",
  "/privacy",
  "/terms",
  "/boss",
  "/signup",
  "/signin",
  "/auth",
];

export function Nav() {
  const path = usePathname();
  if (BARE.some((b) => path === b || path.startsWith(`${b}/`))) return null;

  return (
    <nav
      aria-label="Sections"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t-[1.5px] border-hairline bg-surface"
    >
      <div className="flex px-2 pb-4 pt-2.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-1 text-[12px] ${
                active
                  ? "font-bold text-terracotta-700"
                  : "font-semibold text-stone-500"
              }`}
            >
              <t.Icon size={21} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
