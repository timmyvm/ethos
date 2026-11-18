"use client";

import Link from "next/link";
import { StatIcon } from "@/components/StatIcon";
import { Disclosure } from "@/components/ui/Disclosure";
import type { ModeTile } from "@/lib/home-modes";

/*
 * Hostile Q&A and the weekly boss on Today (#478, docs/plan-next.md
 * section 10: "the bike in the room"), as two rows on the page's ground
 * since #500. Timothy, 18 Nov: "I don't fuck with all the cards on the
 * homepage", and of the two tiles, "it doesn't look that good... it's
 * kind of shit". So no tile, no fill, no edge, no shadow: the card above
 * stays the one box and the one lifted thing, and each row is led by its
 * mode's 3D mark (#503, the stat icons' family), standing on a soft pool
 * of its own tone. Then its name in that tone, what it is about now in
 * ink, one line, and the house Disclosure: a row-shaped door (DESIGN.md
 * rule 5). Spacing, not rules, keeps the two apart (rule 7, #454).
 *
 * Each row is one link whose name starts with its own (lib/home-modes.ts
 * builds the sentence), and a press lights the row with its tone's wash
 * rather than scaling it. Until the clock is read the subject and the
 * line are no-break spaces, and every row holds the height the longest
 * claim and topic take, so nothing under the rows moves when they land
 * (#478 review, check-today 2b). The words hang from the row's top, so
 * the name sits on its subject and the line under it whatever the
 * subject's length (#500 review).
 */
export function ModeRows({ tiles }: { tiles: readonly ModeTile[] }) {
  return (
    <div className="home-modes">
      {tiles.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-label={t.label}
          data-mode={t.id}
          className={`home-mode ${t.id === "hostile" ? "tone-coral" : "tone-sky"}`}
        >
          <span aria-hidden className="home-mode-art">
            <StatIcon kind={t.id} size={72} />
          </span>
          <span aria-hidden className="home-mode-words">
            <span className="home-mode-name font-display">{t.name}</span>
            <span className="home-mode-subject font-display">
              <span className={t.subject ? "arrive" : "invisible"}>{t.subject ?? " "}</span>
            </span>
            <span data-done={t.done || undefined} className="home-mode-line font-display">
              {t.pips && <Pips left={t.pips.left} of={t.pips.of} />}
              {t.line}
            </span>
          </span>
          <Disclosure />
        </Link>
      ))}
    </div>
  );
}

/**
 * The free plan's rounds as pips (#500, from the games-forward design):
 * one lit for each round left in the last 24 hours, all out at the cap.
 * The words beside them say the count; the pips make it a glance.
 */
function Pips({ left, of }: { left: number; of: number }) {
  return (
    <span className="home-pips">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="home-pip" data-on={i < left || undefined} />
      ))}
    </span>
  );
}
