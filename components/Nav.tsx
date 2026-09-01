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
 * 21px, the same weight as the words under them, while the floor card
 * carries a 26px headline and the only filled colour on the screen. What
 * the icons buy is the thing labels alone can't: a shape to aim at.
 * Four words in identical grey are four identical targets, and the tab
 * bar is the one control people hit without reading (DECISIONS #152).
 *
 * Instrument grammar (#201): the bar sits on the raised paper behind a
 * hairline; the active tab is ink at 800, inactive tabs faint — no
 * accent colour, no pill, no indicator bar. The one terracotta on a
 * screen is its tap, and a tab you are already on is not one.
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
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-hairline bg-raised"
    >
      <div className="flex px-2 pb-4 pt-2.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`font-display flex flex-1 flex-col items-center gap-1 py-1 text-[11px] uppercase tracking-[0.06em] ${
                active
                  ? "font-extrabold text-ink"
                  : "font-semibold text-stone-300"
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
