"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGames,
  IconLessons,
  IconLog,
  IconToday,
  IconYou,
} from "@/components/Icon";
import { TAB_HREFS } from "@/lib/tabs";

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
 * name for a room of lessons, bosses and analyzers. The /games route and
 * the icon identifiers keep their names: nobody reads code aloud and
 * bookmarks live (#164's rule).
 */
/*
 * Lessons took the second slot on 14 Sep (#275). It had been Today's
 * room since the shift: `/lessons` was reachable only through one text
 * link at the foot of the trait strip, and the tab bar highlighted
 * Today while you stood in it. Fifteen lessons behind a footer link is
 * a wardrobe, not a section.
 *
 * Five tabs at 390px is 74.8px each, comfortably over the 44px target
 * floor. The register has no truncate, so every label here stays one
 * short word: a second word wraps and the whole bar grows a line.
 *
 * The labels wear `.label-data`, 11px, since #287. They were the 10px
 * `.label-micro`, which is iOS's floor for a tab label and reads as
 * one on a phone; these five words are the most-read small type in
 * the app, and one point is the difference between a label you read
 * and one you recognise. Column heads and chips keep the 10.
 *
 * The hrefs come from lib/tabs.ts, which PageTransition reads as well.
 */
const TABS = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/games", label: "Tools", Icon: IconGames },
  { href: "/history", label: "Log", Icon: IconLog },
  { href: "/you", label: "You", Icon: IconYou },
] satisfies readonly {
  href: (typeof TAB_HREFS)[number];
  label: string;
  Icon: (p: { size?: number; active?: boolean }) => React.ReactElement;
}[];

/**
 * Screens that own the whole viewport: the floor, onboarding, marketing,
 * and the account screens — a tab bar under a sign-up form invites people
 * to wander off mid-form. The unit intro (#210) joins them for the same
 * reason the recording screen is here: it is one instruction and one
 * button, and a tab row under the button is three ways to not press it.
 */
const BARE = [
  "/rep",
  "/lesson",
  /* A trait lesson is the same shape as a unit intro and belongs here
     for the same reason: one instruction, one button (#258). */
  "/practice",
  /* The design workbench is not an app screen at all (#255). */
  "/workbench",
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
      <div className="pb-safe flex px-2 pt-2.5">
        {TABS.map((t) => {
          /*
           * Today owns only itself now that Lessons has its own tab.
           * The exact match on "/" matters: every path starts with it.
           */
          const active =
            t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`label-data flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors ${
                active ? "!text-ink" : ""
              }`}
            >
              {/* Filled on the tab you are on (#290). */}
              <t.Icon size={22} active={active} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
