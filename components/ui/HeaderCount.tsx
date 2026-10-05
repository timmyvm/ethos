import type { ReactNode } from "react";

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
 * variants size it to 18px.
 *
 * `unlit` greys the glyph (an open day's flame), through the chip's
 * `data-open` hook in globals.css; the words still say why.
 *
 *   <HeaderCount variant="chip" glyph={<IconFlame />} value={6} label="Streak 6" />
 */
export function HeaderCount({
  glyph,
  value,
  label,
  variant,
  unlit = false,
  className = "",
}: {
  glyph: ReactNode;
  value: ReactNode;
  /** What a screen reader says in place of the glyph and the number. */
  label: string;
  variant: "chip" | "bare";
  unlit?: boolean;
  className?: string;
}) {
  if (variant === "chip") {
    return (
      <span className={`today-earned ${className}`} data-open={unlit ? "true" : undefined}>
        <span className="sr-only">{label}</span>
        <span aria-hidden className="today-earned-mark">
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
