"use client";

import { useState } from "react";
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
export function FeltCheck({ onAnswer }: { onAnswer: (felt: Felt) => void }) {
  const [picked, setPicked] = useState<Felt | null>(null);
  return (
    <section aria-labelledby="felt-question" className="text-center">
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
