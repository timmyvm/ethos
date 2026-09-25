"use client";

import { useId, useState } from "react";
import { tipFace, type TipGlyph } from "@/lib/tip-labels";

/**
 * The tactics, glanceable (feedback round, 25 Sep).
 *
 * A first-time user in the audience looked at three numbered sentences
 * under "How to do this" and said she would not read them. So the
 * screen shows what can be taken in by looking: a glyph and at most five
 * words per tactic, side by side, and the sentence behind each one opens
 * on a tap, in place, under the row. Nothing is cut: every tactic's
 * full text is one tap away, which is what lets feedback keep pointing
 * at it.
 *
 * One open at a time, closed on mount, and not remembered, the rule
 * `WhyThisWorks` already follows: an explanation restored from storage
 * puts the paragraph back on the screen that was cleared of it.
 */
export function TipStrip({
  tips,
  label = "How",
  className = "",
  ladder = false,
}: {
  tips: string[];
  /** The eyebrow over the row. `null` for none. */
  label?: string | null;
  className?: string;
  /** Tiles land one at a time, after the block they sit in (#249). */
  ladder?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();
  if (tips.length === 0) return null;
  const shown = tips.slice(0, 3);
  const cols = shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className={className}>
      {label && <div className="label-data">{label}</div>}
      <div
        className={`grid ${cols} gap-2 ${label ? "mt-3" : ""} ${ladder ? "stagger" : ""}`}
        style={ladder ? ({ "--stagger-lead": "260ms" } as React.CSSProperties) : undefined}
      >
        {shown.map((tip, i) => {
          const face = tipFace(tip);
          const on = open === i;
          return (
            <button
              key={tip}
              type="button"
              aria-label={`${face.label}. ${on ? "Hide" : "Show"} the full tip.`}
              aria-expanded={on}
              aria-controls={`${id}-tip`}
              onClick={() => setOpen(on ? null : i)}
              className="tip-tile press flex min-h-[104px] flex-col items-start rounded-card border p-3 text-left"
              data-on={on || undefined}
            >
              <span className="flex w-full items-start justify-between">
                <span aria-hidden className="tip-glyph grid h-9 w-9 place-items-center rounded-full">
                  <Glyph kind={face.glyph} />
                </span>
                <span aria-hidden data-open={on} className="disclosure-mark -mr-1 text-stone-300">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7.5l5 5 5-5" />
                  </svg>
                </span>
              </span>
              <span className="font-display mt-2.5 text-[13.5px] font-bold leading-[1.2]">
                {face.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* The sentence behind the tile, where the tap was. Keyed so a
          different tile's sentence arrives rather than swapping. */}
      <div id={`${id}-tip`} aria-live="polite">
        {open !== null && shown[open] && (
          <p
            key={open}
            className="reveal tip-detail mt-2 rounded-card px-4 py-3 text-[14px] leading-snug"
          >
            {shown[open]}
          </p>
        )}
      </div>
    </div>
  );
}

/** Seven marks on a 20px grid, 2px stroke, the Icon set's weight. */
function Glyph({ kind }: { kind: TipGlyph }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "pause":
      return (
        <svg {...common}>
          <path d="M7 5v10M13 5v10" />
        </svg>
      );
    case "start":
      return (
        <svg {...common}>
          <path d="M7 4.5l8 5.5-8 5.5z" fill="currentColor" />
        </svg>
      );
    case "end":
      return (
        <svg {...common}>
          <path d="M5.5 17V3.5M5.5 4h9l-2 3.5 2 3.5h-9" />
        </svg>
      );
    case "slow":
      return (
        <svg {...common}>
          <path d="M3.5 14a6.5 6.5 0 0113 0" />
          <path d="M10 14l-3-3.5" />
        </svg>
      );
    case "word":
      return (
        <svg {...common}>
          <path d="M4 5h12v8H9l-3.5 3v-3H4z" />
        </svg>
      );
    case "cut":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" />
          <path d="M5.5 14.5l9-9" />
        </svg>
      );
    case "one":
    default:
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2" fill="currentColor" />
        </svg>
      );
  }
}

/**
 * One tactic as a row: the glyph, the five words, and the sentence on a
 * tap. For a card that carries a single tactic (Today's first card),
 * where a tile grid of one would be a button pretending to be a list.
 */
export function TipLine({ tip, className = "" }: { tip: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const face = tipFace(tip);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-tip`}
        aria-label={`${face.label}. ${open ? "Hide" : "Show"} the full tip.`}
        onClick={() => setOpen(!open)}
        className="press -mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-3 rounded-control px-1 text-left"
      >
        <span aria-hidden className="tip-glyph grid h-9 w-9 shrink-0 place-items-center rounded-full">
          <Glyph kind={face.glyph} />
        </span>
        <span className="font-display min-w-0 flex-1 text-[15px] font-bold leading-tight">
          {face.label}
        </span>
        <span aria-hidden data-open={open} className="disclosure-mark text-stone-400">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7.5l5 5 5-5" />
          </svg>
        </span>
      </button>
      <div id={`${id}-tip`} aria-live="polite">
        {open && (
          <p className="reveal mt-1.5 pl-12 text-[14px] leading-snug text-stone-600">{tip}</p>
        )}
      </div>
    </div>
  );
}
