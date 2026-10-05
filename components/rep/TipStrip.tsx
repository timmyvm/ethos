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
        className={`grid ${cols} gap-3 ${label ? "mt-3" : ""} ${ladder ? "stagger" : ""}`}
        style={ladder ? ({ "--stagger-lead": "260ms" } as React.CSSProperties) : undefined}
      >
        {shown.map((tip, i) => {
          const face = tipFace(tip);
          const on = open === i;
          return (
            /*
             * today-12, practice-detail-19, system-14, recording-15 (M14):
             * no box inside the box. The glyph stands bare at 24px, the
             * label is reading type (Figtree 15/600 on 21, ink) 12px
             * under it, and the tile is as tall as its words. The
             * chevron stays as the tile's one expand cue
             * (practice-detail-12): stone-400 at 16px, centred on the
             * glyph row, so it reads at 3:1 and sits beside the mark it
             * belongs to.
             */
            <button
              key={tip}
              type="button"
              aria-label={`${face.label}. ${on ? "Hide" : "Show"} the full tip.`}
              aria-expanded={on}
              aria-controls={`${id}-tip`}
              onClick={() => setOpen(on ? null : i)}
              className="tip-tile press flex flex-col items-start rounded-card border p-4 text-left"
              data-on={on || undefined}
            >
              <span className="flex w-full items-center justify-between">
                <span aria-hidden className="tip-glyph">
                  <Glyph kind={face.glyph} size={24} />
                </span>
                <span aria-hidden data-open={on} className="disclosure-mark -mr-1 text-stone-400">
                  <Chevron />
                </span>
              </span>
              <span className="mt-3 text-body font-semibold leading-[21px] text-ink text-balance">
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
            className="reveal tip-detail mt-3 rounded-card px-4 py-3 text-row font-normal leading-snug"
          >
            {shown[open]}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Eight marks on a 20px grid, drawn bare (no disc behind them, M14,
 * today-12): 24px in a tile, 20px in a TipLine, the stroke held at 2px
 * whatever the size. Their colour comes from `.tip-glyph` (globals.css):
 * `--rec-amber-ink` on a tile and on Today's amber card, stone-500 on
 * the plain ground.
 */
function Glyph({ kind, size }: { kind: TipGlyph; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 40 / size,
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
    case "hold":
      /* recording-15: a stopwatch, for the tactics that are a length of
         silence ("Hold one to two seconds", "Count one second"), so two
         Pausing tiles side by side no longer wear the same two bars.
         Never Pace's gauge (`slow`), which would put Pace on a Pausing
         tactic. */
      return (
        <svg {...common}>
          <circle cx="10" cy="11.5" r="6" />
          <path d="M8 2.5h4M10 2.5v3M10 11.5l2.5-2.5M15.3 5.7l1.2-1.2" />
        </svg>
      );
    case "start":
      /* practice-detail-11: a start bar with an arrow leaving it, in
         stroke. The filled triangle it replaces read as a play button
         on a tile that plays nothing. */
      return (
        <svg {...common}>
          <path d="M4.5 4v12M8.5 10h7M12.5 7l3 3-3 3" />
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

/** The expand cue, one drawing for the tile and the line: 16px. */
function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

/**
 * One tactic as a row: the glyph, the five words, and the sentence on a
 * tap. For a card that carries a single tactic (Today's first card),
 * where a tile grid of one would be a button pretending to be a list.
 * The glyph stands bare at 20px with the label 12px to its right (M04);
 * the sentence opens under the label's edge, 32px in.
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
        <span aria-hidden className="tip-glyph">
          <Glyph kind={face.glyph} size={20} />
        </span>
        <span className="font-display min-w-0 flex-1 text-body font-bold leading-tight">
          {face.label}
        </span>
        <span aria-hidden data-open={open} className="disclosure-mark text-stone-400">
          <Chevron />
        </span>
      </button>
      <div id={`${id}-tip`} aria-live="polite">
        {open && (
          <p className="reveal mt-1.5 pl-8 text-row font-normal leading-snug text-stone-600">{tip}</p>
        )}
      </div>
    </div>
  );
}
