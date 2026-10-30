"use client";

import { useState } from "react";
import { ScoringWave } from "@/components/ScoringWave";
import { FELT_COPY } from "@/content/tester";
import type { Felt } from "@/lib/tester";

/**
 * The one tap before the score shows (migration 0022, docs/testers.md):
 * "How did that feel?", Rough, Okay or Strong, for a tester only, asked
 * before any number is on screen so none can lean on the answer.
 *
 * A plain grey control, never terracotta: three of the introduction's
 * answer objects (surface, a 2px edge, a 4px lip), each with a small
 * scale mark so the three read as one scale. One tap answers and goes
 * on to the score; the screen's Skip (in the shelf) goes on without
 * one. The picked one holds ink while the step fades.
 */
export function FeltCheck({ onAnswer, className = "" }: { onAnswer: (felt: Felt) => void; className?: string }) {
  const [picked, setPicked] = useState<Felt | null>(null);
  return (
    <section aria-labelledby="felt-question" className={`text-center ${className}`}>
      <h2 id="felt-question" tabIndex={-1} className="font-display text-title text-balance text-ink">
        {FELT_COPY.question}
      </h2>
      <p className="mt-2 text-body text-stone-500">{FELT_COPY.line}</p>
      <div role="group" aria-labelledby="felt-question" className="mx-auto mt-7 grid max-w-[360px] grid-cols-3 gap-3">
        {FELT_COPY.options.map((o, i) => {
          const lit = picked === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={picked !== null}
              aria-pressed={lit}
              onClick={() => {
                setPicked(o.value);
                onAnswer(o.value);
              }}
              className={`press font-display flex min-h-[124px] flex-col items-center justify-center gap-3.5 rounded-control border-2 border-b-4 bg-surface px-2 text-detail text-ink transition-colors disabled:cursor-default ${
                lit ? "border-ink" : "border-edge"
              }`}
            >
              <ScaleMark level={i + 1} />
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** One, two or three of three bars in ink on the sand trough: the scale, drawn. */
function ScaleMark({ level }: { level: number }) {
  return (
    <svg aria-hidden width="33" height="24" viewBox="0 0 22 16" className="block">
      {[0, 1, 2].map((b) => (
        <rect
          key={b}
          x={b * 8}
          y={10 - b * 5}
          width="6"
          height={6 + b * 5}
          rx="1"
          className={b < level ? "fill-ink" : "fill-sand"}
        />
      ))}
    </svg>
  );
}

/**
 * The felt step's stage (review D4: the question floated mid-screen over
 * 215px and 260px of empty ground at 390x844, against DESIGN rule 7).
 * The take just made, with no score: the scoring panel it was read on
 * (its length and its own wave, now at rest), so the question is about
 * that recording and the free height belongs to it. It grows into the
 * room the screen has, up to 40% of it; the question and the three
 * answers rest under it, in the thumb's reach. A phone under 640px tall
 * has no room to give, and the results leave it out.
 */
export function FeltStage({
  levels,
  seconds,
  className = "",
}: {
  levels: number[];
  seconds: number;
  className?: string;
}) {
  const s = Math.max(0, Math.round(seconds));
  return (
    <section
      aria-label={`${FELT_COPY.stage}, ${Math.floor(s / 60)} minutes ${s % 60} seconds`}
      className={`topic-card scoring-panel flex min-h-[148px] flex-col justify-between overflow-hidden rounded-sheet px-5 pt-5 pb-4 ${className}`}
    >
      <div>
        <div className="label-data topic-eyebrow">{FELT_COPY.stage}</div>
        <div className="font-display mt-1.5 text-num-l tabular-nums text-ink">
          {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
        </div>
      </div>
      {/* The wave takes the panel's free height (absolute, so its 100%
          is the measured box, not an indefinite flex chain). */}
      <div className="relative -mx-1 mt-3 max-h-[120px] min-h-10 flex-1">
        <div className="absolute inset-0 flex items-center">
          <ScoringWave levels={levels} height="100%" still />
        </div>
      </div>
    </section>
  );
}
