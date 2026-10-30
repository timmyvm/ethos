"use client";

import { useState, type ReactNode } from "react";

/**
 * A count that stands beside a large title: a glyph and a number, with
 * the words for screen readers only (duolingo-path s6).
 *
 *  - `chip`: the earned register, `.today-earned` (36px sage-100 pill,
 *    the glyph 18px in earned gold, Outfit 15/700 tabular). Today's
 *    stars and streak (Timothy #176, #312, #317). Never a tap.
 *  - `bare`: the glyph at 18px and the number in Outfit 17/800 tabular
 *    ink, no fill. Shop's coin balance only.
 *
 * The glyph is an SVG from Icon.tsx (IconStar, IconFlame, a coin); both
 * variants size it to 18px. A lit glyph is gold (D03): `.earned-lit`,
 * --color-amber with a 1px darker rim in light.
 *
 * `unlit` greys the glyph (an open day's flame), through the chip's
 * `data-open` hook in globals.css; the words still say why.
 *
 * `empty` is a zero nobody has earned yet (D25, Timothy #317's "an
 * unlit 0 on day zero"): the whole chip goes unlit, the glyph stone-400,
 * the number stone-600 and the pill the surface step in place of the
 * sage wash, at the same footprint. When the first recording lights it,
 * the chip lands with `.arrive`; a chip that was never empty on this
 * screen does not re-arrive.
 *
 *   <HeaderCount variant="chip" glyph={<IconFlame />} value={6} label="Streak 6" />
 */
export function HeaderCount({
  glyph,
  value,
  label,
  variant,
  unlit = false,
  empty = false,
  className = "",
}: {
  glyph: ReactNode;
  value: ReactNode;
  /** What a screen reader says in place of the glyph and the number. */
  label: string;
  variant: "chip" | "bare";
  unlit?: boolean;
  /** A zero: the chip unlit as a whole (chip variant only). */
  empty?: boolean;
  className?: string;
}) {
  /* Derived state, set during render: this chip has been seen empty, so
     the render that lights it is an arrival. */
  const [wasEmpty, setWasEmpty] = useState(empty);
  if (empty && !wasEmpty) setWasEmpty(true);

  if (variant === "chip") {
    const off = unlit || empty;
    const lands = wasEmpty && !empty;
    return (
      <span
        key={empty ? "empty" : "lit"}
        className={`today-earned ${lands ? "arrive" : ""} ${className}`}
        data-open={off ? "true" : undefined}
        data-empty={empty ? "true" : undefined}
      >
        <span className="sr-only">{label}</span>
        <span aria-hidden className={`today-earned-mark ${off ? "" : "earned-lit"}`}>
          {glyph}
        </span>
        <span aria-hidden>{value}</span>
      </span>
    );
  }
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 text-num-s tabular-nums text-ink ${className}`}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={`inline-flex leading-none [&>svg]:h-[18px] [&>svg]:w-[18px] ${
          unlit ? "text-stone-400" : ""
        }`}
      >
        {glyph}
      </span>
      <span aria-hidden>{value}</span>
    </span>
  );
}
