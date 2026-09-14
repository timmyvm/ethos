"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buzz, prefersReducedMotion } from "@/lib/prefs";

/**
 * The ring (DECISIONS #252). One closed loop, used everywhere a number
 * has a ceiling: a percentile against the population, the session you
 * are part way through, the streak inside its tier, a challenge that
 * resets tonight.
 *
 * Why a ring rather than a bar, honestly: `docs/closure.md` found no
 * comparative study showing a circle outperforms a line at the same
 * percentage, so the ring is NOT claimed to be more motivating on its
 * own. What it carries is a bounded GAP — the arc that is not drawn is
 * a visible, finite remainder, and the closure literature is about
 * remainders rather than shapes. A bar's remainder runs off the end of
 * its track; a ring's sits in the same glance as the number. That, and
 * it puts a to-go quantity in a square tile beside a value, which a bar
 * cannot do at this size.
 *
 * The rules it holds itself to:
 *
 *  - It animates FROM WHERE IT WAS. The dash is a CSS transition, so a
 *    re-render with a new value travels; it never cuts.
 *  - Closure is a moment: the loop buzzes on the EDGE of completing,
 *    once, and never on arrival at a ring that was already full.
 *  - Reduced motion puts the value there with no travel (globals.css).
 *  - It is `aria-hidden` and always sits with its number in text,
 *    because a ring is a picture of a value and never the value.
 *
 * `pathLength={1}` is what makes it simple: the browser rescales the
 * dash units to the path, so the arc length IS the fraction and no
 * circumference arithmetic appears anywhere.
 */

/**
 * What the ring is drawing. The colour is grammar, not decoration:
 *
 *   measured  sage, the colour this app already uses for what you
 *             earned (stars, the score card, silence that landed). A
 *             percentile is a measurement, so it wears that colour.
 *   open      terracotta, the one accent, for a loop still closable
 *             TODAY: the session, the daily challenge. Terracotta is
 *             the action colour and an open ring is an action.
 *   quiet     stone, for a ring that is context rather than a target.
 */
export type RingTone = "measured" | "open" | "quiet" | "lit";

const STROKE: Record<RingTone, string> = {
  measured: "var(--color-sage-600)",
  open: "var(--color-terracotta-500)",
  quiet: "var(--color-stone-400)",
  /* On the deep sage card, where sage-600 disappears into the ground
     and `sage-lit` is the token that exists for exactly this. */
  lit: "var(--color-sage-lit)",
};

export function Ring({
  value,
  size = 72,
  thickness,
  tone = "measured",
  children,
  state = "idle",
  provisional = false,
  className = "",
  delay = 0,
  track,
}: {
  /** 0 to 1. Clamped, because a percentile of 1.02 is a bug, not a flourish. */
  value: number;
  size?: number;
  /** Defaults to a twelfth of the diameter, which holds from 32 to 200px. */
  thickness?: number;
  tone?: RingTone;
  /** The number itself, in the middle. Text, always. */
  children?: ReactNode;
  /**
   * `thinking` breathes while a value is being computed, so a screen
   * that is working never looks like a screen that is broken.
   * `closing` is the one-shot lift when a loop completes.
   */
  state?: "idle" | "thinking" | "closing";
  /**
   * The SCALE is provisional, not the measurement: where
   * docs/percentiles.md could not find population data good enough to
   * place somebody honestly, the TROUGH goes dashed. The arc stays
   * solid, because what they did is known even when where it sits is
   * a guess, and a dashed ring says "we are estimating" in the picture
   * rather than in a footnote nobody reads.
   */
  provisional?: boolean;
  className?: string;
  /** Hold the fill back, so a row of rings lands one at a time. */
  delay?: number;
  /**
   * The trough, when the ring is not standing on paper. `sand` is the
   * app's unfilled-trough colour and it is invisible on the deep card,
   * so that one surface passes its own.
   */
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  /*
   * The provisional trough's dash, as a fraction of the path. Fixed in
   * path units rather than pixels so a 44px ring and a 132px one carry
   * the same number of dashes and read as the same material.
   */
  const DASH = 0.022;
  const stroke = thickness ?? Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;

  /*
   * Start empty and travel on the next frame. Rendering the final
   * length immediately paints a finished ring with nothing left to
   * animate, and the arrival IS the information.
   */
  const [drawn, setDrawn] = useState(0);
  /* null until the first value is seen, and that is the whole fix.
     See the buzz effect below. */
  const closed = useRef<boolean | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDrawn(clamped);
      return;
    }
    const t = setTimeout(() => setDrawn(clamped), Math.max(16, delay));
    return () => clearTimeout(t);
  }, [clamped, delay]);

  /*
   * The buzz fires on the EDGE, once. A ring that is already full when
   * the screen opens has not just closed, and a phone that buzzes on
   * arrival is a phone that buzzes for nothing.
   *
   * That is what this said and not what it did (#281). The ref started
   * at `false`, which is a claim about a ring nobody had seen yet, so a
   * ring mounting at 1 read as a transition from open to closed and
   * buzzed. It has never fired in practice only because the one caller
   * passes a fraction that reaches 1 on a perfect recording alone. The
   * daily challenge ring mounts already full on most evenings, so every
   * visit to Today after closing it would have buzzed again.
   *
   * The first value is a reading, not an edge: it seeds and returns.
   */
  useEffect(() => {
    const isClosed = clamped >= 0.999;
    if (closed.current === null) {
      closed.current = isClosed;
      return;
    }
    if (isClosed && !closed.current) buzz([12, 40, 18]);
    closed.current = isClosed;
  }, [clamped]);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
        /*
         * `ring-loop`, not `ring`: Tailwind ships a `ring` utility that
         * paints a square box-shadow, so the class name alone drew a
         * cream rectangle around every ring in the app. Nothing in the
         * computed border or outline explained it, which is exactly how
         * long that takes to find.
         */
        className={`ring-loop ${state === "thinking" ? "ring-thinking" : ""} ${
          state === "closing" ? "ring-closing" : ""
        }`}
      >
        {/* The trough: the part that is NOT done, drawn, because the
            remainder is what the closure research is actually about. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={
            track ?? `var(--color-sand${provisional ? "-dashed" : ""})`
          }
          strokeWidth={stroke}
          pathLength={1}
          strokeDasharray={provisional ? `${DASH} ${DASH}` : undefined}
          strokeLinecap={provisional ? "round" : "butt"}
        />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${drawn} 1`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && (
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          {children}
        </span>
      )}
    </span>
  );
}
