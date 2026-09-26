"use client";

import { DemosFigure } from "@/components/DemosClip";
import { useEffect, useState } from "react";
import { ScoringWave } from "@/components/ScoringWave";

/**
 * The scoring wait (feedback round, 25 Sep: "scoring loading page is
 * boring").
 *
 * It was a grey bar wave, a scan line, "Scoring…" and two grey
 * sentences. Now it is three things that are all true:
 *
 *   Demos, working     the full-body 3D listening pose, standing on
 *                      the recording in a warm panel
 *   your recording     its own envelope, lit amber as the scan passes
 *   what is measured   the length, which the phone already knows, shown
 *                      at once (DESIGN.md: measured numbers render
 *                      instantly), then the checks the server runs
 *
 * The checks step on a clock and then HOLD on the last one. They are
 * the real stages of `/api/analyze` in its real order, but the client
 * cannot see which one the server is on, so nothing is ever ticked off
 * and nothing counts a percentage: the list says what is being done,
 * never how much of it is.
 *
 * A retry (attempt > 0, the outbox resending) swaps the checks for the
 * one sentence that matters then: the recording is safe.
 */
export function ScoringStage({
  levels,
  seconds,
  boss = false,
  attempt = 0,
}: {
  levels: number[];
  /** The recording's length, measured on this device. */
  seconds: number;
  boss?: boolean;
  attempt?: number;
}) {
  const stages = boss ? BOSS_STAGES : STAGES;
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (at >= stages.length - 1) return;
    const t = setTimeout(() => setAt((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [at, stages.length]);

  return (
    <div className="arrive flex w-full flex-col items-center" role="status">
      {/* One warm panel, the topic card's ground (review, 25 Sep: the
          card's colour stopped at this screen): the length on the left,
          Demos standing on the recording itself, which runs along the
          panel's floor. */}
      <section className="topic-card scoring-panel relative w-full overflow-hidden rounded-sheet px-5 pt-5">
        <div className="relative flex items-end justify-between">
          <div className="pb-5">
            <div className="label-data topic-eyebrow">Recorded</div>
            <div className="font-display mt-1.5 text-[44px] font-extrabold leading-none tabular-nums tracking-[-0.02em]">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </div>
          </div>
          <div className="relative -mr-1 w-[150px] shrink-0">
            <span aria-hidden className="scoring-spot" />
            <span aria-hidden className="rep-ground" />
            <DemosFigure
              pose="listening"
              src="/demos-onboard-listening.webp"
              width={300}
              height={300}
              delayMs={300}
              className="demos scoring-demos relative block h-auto w-full"
            />
          </div>
        </div>
        <div className="-mx-1 -mt-1 pb-4">
          <ScoringWave levels={levels} height={64} />
        </div>
      </section>

      {attempt > 0 ? (
        <p className="arrive mt-6 max-w-[260px] text-center text-body font-semibold">
          Still sending. The recording is safe on this device.
        </p>
      ) : (
        <ol className="mt-6 w-full max-w-[220px] space-y-1.5" aria-label="Scoring">
          {stages.map((s, i) => (
            <li
              key={s}
              data-state={i < at ? "past" : i === at ? "now" : "next"}
              className="scoring-step flex items-center gap-2.5 text-[15px]"
            >
              <span aria-hidden className="scoring-dot h-2 w-2 shrink-0 rounded-full" />
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const STEP_MS = 1500;

/* The engine's order (app/api/analyze): Whisper, then the counts off the
   word timestamps, then the coach's read, which is the slow one and the
   right one to hold on. */
const STAGES = [
  "Transcribing",
  "Finding fillers",
  "Timing pauses",
  "Measuring pace",
  "Demos reads it",
];

const BOSS_STAGES = [
  "Transcribing",
  "Finding fillers",
  "Timing pauses",
  "Checking your claims",
  "Demos reads it",
];
