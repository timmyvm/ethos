"use client";

import Link from "next/link";
import { DemosFigure } from "@/components/DemosClip";
import { IconBubble } from "@/components/Icon";
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
 * one sentence that matters then: the recording is safe. And since it
 * is, the wait gets its way off (#440): the screen held people on a
 * send that might take a minute to give up, with no control on it at
 * all. The take keeps sending after the screen is left and lands in the
 * Log.
 *
 * A game round (proposal-feel F7) adds the one fact the phone already
 * knows at Stop under the length: when Demos cut in, or who stopped the
 * clock. The reveal answers the question it opens ("did I hold?"), and
 * the cut-in stands on the wave as a 2px ink tick at its second.
 */
export function ScoringStage({
  levels,
  seconds,
  boss = false,
  attempt = 0,
  fact = null,
  cutIns = [],
  leave = null,
}: {
  levels: number[];
  /** The recording's length, measured on this device. */
  seconds: number;
  boss?: boolean;
  attempt?: number;
  /** A game round's one line ("Demos cut in at 0:17."); null for anything else. */
  fact?: string | null;
  /** Seconds into the take Demos cut in, each a tick on the wave. */
  cutIns?: readonly number[];
  /** Where a stalled send can be left for, named for where it goes. */
  leave?: { href: string; label: string } | null;
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
            <div className="font-display mt-1.5 text-num-hero tabular-nums">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </div>
            {fact && <Fact text={fact} />}
          </div>
          <div className="relative -mr-1 w-[150px] shrink-0">
            <span aria-hidden className="scoring-spot" />
            <span aria-hidden className="rep-ground" />
            <DemosFigure
              still
              pose="listening"
              src="/demos-onboard-listening.webp"
              width={300}
              height={300}
              delayMs={300}
              className="demos scoring-demos relative block h-auto w-full"
            />
          </div>
        </div>
        {/* The cut-ins on the take (F7): a 2px ink tick over the wave at
            each second he cut in, its bubble glyph under the wave in the
            panel's foot, clear of Demos standing on it. */}
        {(() => {
          const ticks = seconds > 0 ? cutIns.filter((t) => t > 0 && t < seconds) : [];
          return (
            <div className={`-mx-1 -mt-1 ${ticks.length ? "pb-6" : "pb-4"}`}>
              <div className="relative mx-auto w-full max-w-[300px]">
                <ScoringWave levels={levels} height={64} />
                {ticks.map((t, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-ink"
                    style={{ left: `${(t / seconds) * 100}%` }}
                  >
                    <span className="absolute top-full left-1/2 mt-1 inline-flex -translate-x-1/2 text-ink">
                      <IconBubble size={14} />
                    </span>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {attempt > 0 ? (
        <div className="arrive mt-6 flex max-w-[260px] flex-col items-center text-center">
          <p className="text-body font-semibold">
            Still sending. The recording is safe on this device.
          </p>
          {leave && (
            <Link href={leave.href} className="text-link mt-3 text-terracotta-700">
              Back to {leave.label}
            </Link>
          )}
        </div>
      ) : (
        <ol className="mt-6 w-full max-w-[220px] space-y-1.5" aria-label="Scoring">
          {stages.map((s, i) => (
            <li
              key={s}
              data-state={i < at ? "past" : i === at ? "now" : "next"}
              className="scoring-step flex items-center gap-2.5 text-body"
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

/**
 * The wait's one fact, beside Demos in a column about 160 wide: when it
 * wraps, it breaks before its time ("The clock stopped it / at 0:20"),
 * never inside the time. Filled line by line (`text-wrap`, over the
 * base layer's `pretty` for every p): balancing or "pretty" moved the
 * "it" down ("The clock stopped / it at 0:20").
 */
function Fact({ text }: { text: string }) {
  const m = /^(.*) (at \d+:\d{2}\.?)$/.exec(text);
  return (
    <p className={`mt-1 text-body font-semibold ${m ? "text-wrap" : "text-balance"}`}>
      {m ? (
        <>
          {m[1]} <span className="whitespace-nowrap">{m[2]}</span>
        </>
      ) : (
        text
      )}
    </p>
  );
}
