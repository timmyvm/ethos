"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatIcon } from "@/components/StatIcon";
import type { ModeTile } from "@/lib/home-modes";

/*
 * Hostile Q&A and this week's boss on Today (#478, docs/plan-next.md
 * section 10: "the bike in the room"): two equal tiles side by side under
 * the practice card, each one tap away. Flat: no glow, no shadow
 * (section 1, only the thing to do today glows); their colour is a pale
 * ground of their picture tone, and each says one thing worth coming
 * back for (lib/home-modes.ts). Since #503 each name wears its mode's 3D
 * mark from the stat icons' family (Timothy, 18 Nov: Hostile and the
 * cold topic "doesn't look that good"), a mark at the name's side as the
 * streak chip's flame is, never an object standing on the tile. The
 * words are what lib/home-modes.ts returns; until the clock is read the
 * subject holds its lines unseen and the line a no-break space, so
 * nothing under the tiles moves when they land.
 */

/** The mark's side, px: a touch over the name's 17px line, as the chip's flame stands to its count. */
const MARK = 24;

const LOOK: Record<ModeTile["id"], { tone: string; glyph: ReactNode }> = {
  /* A coral bubble struck by a bolt: a claim argued under fire. */
  hostile: { tone: "tone-coral", glyph: <StatIcon kind="hostile" size={MARK} /> },
  /* A sky mountain with its pennant: the week's big climb. */
  boss: { tone: "tone-sky", glyph: <StatIcon kind="boss" size={MARK} /> },
};

export function ModeTiles({ tiles }: { tiles: readonly ModeTile[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-label={t.label}
          data-mode={t.id}
          className={`home-mode ${LOOK[t.id].tone} press`}
        >
          <span aria-hidden className="font-display flex min-h-6 items-center gap-2 text-row">
            <span className="home-mode-glyph">{LOOK[t.id].glyph}</span>
            {t.name}
          </span>
          <span
            aria-hidden
            className={`home-mode-subject font-display mt-2 text-body font-bold ${t.subject ? "arrive" : "invisible"}`}
          >
            {t.subject ?? " \n "}
          </span>
          <span className="mt-auto" />
          <span
            aria-hidden
            data-done={t.done || undefined}
            className="home-mode-line font-display mt-2 block min-h-[18px] text-caption font-semibold tabular-nums"
          >
            {t.line}
          </span>
        </Link>
      ))}
    </div>
  );
}
