"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DemosFigure } from "@/components/DemosClip";
import { IconBubble, IconCheck } from "@/components/Icon";
import { ScoringWave } from "@/components/ScoringWave";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EarlyRead } from "@/lib/analyze-stream";
import { transcriptPieces } from "@/lib/transcript-words";
import { WAIT_START, waitRows, type WaitRow, type WaitState } from "@/lib/wait";

/**
 * The scoring wait (feedback round, 25 Sep: "scoring loading page is
 * boring"; #472, the cohort's median of 76 seconds from Stop, and the
 * people who left in the first 30).
 *
 * Three things, every one of them true when it is drawn:
 *
 *   your recording   the warm panel: the length the phone measured, at
 *                    once, and the take's own envelope with the scan
 *                    passing over it; Demos standing on it, listening
 *   your words       the opening of what you said, the moment Whisper
 *                    has it, each filler under the transcript's own bar
 *   the stages       a row for each thing the route does, in its order,
 *                    ticked only when the route says it is done
 *                    (lib/wait.ts), and the numbers the words give as
 *                    soon as they exist: how many, the fillers and the
 *                    first one's time, the pace
 *
 * It used to step five labels on a 1.5 second clock and hold on the
 * last; now nothing moves that the route did not move, nothing counts a
 * percentage, and the score itself only ever arrives with the results.
 *
 * A retry (attempt > 0, the outbox resending) swaps the stages for the
 * one sentence that matters then: the recording is safe. And since it
 * is, the wait gets its way off (#440). The take keeps sending after the
 * screen is left and lands in the Log. The words, once in, stay: a
 * resend is the same audio.
 *
 * A game round (proposal-feel F7) adds the one fact the phone already
 * knows at Stop under the length: when Demos cut in, or who stopped the
 * clock, and the cut-in stands on the wave as a 2px ink tick at its
 * second.
 */
export function ScoringStage({
  levels,
  seconds,
  boss = false,
  wait = WAIT_START,
  attempt = 0,
  fact = null,
  cutIns = [],
  leave = null,
}: {
  levels: number[];
  /** The recording's length, measured on this device. */
  seconds: number;
  boss?: boolean;
  /** Where the route is with the take, and its words once in (lib/wait.ts). */
  wait?: WaitState;
  attempt?: number;
  /** A game round's one line ("Demos cut in at 0:17."); null for anything else. */
  fact?: string | null;
  /** Seconds into the take Demos cut in, each a tick on the wave. */
  cutIns?: readonly number[];
  /** Where a stalled send can be left for, named for where it goes. */
  leave?: { href: string; label: string } | null;
}) {
  const rows = waitRows(wait, { boss });

  return (
    /* The column's whole height: the panel at the top, the stages at the
       foot, and the words taking what is left between them, so the room
       goes to what was said rather than to ground (#368). Only the stages
       are a live region: the words are read where they stand, never
       announced whole when they land (#472 review). */
    <div data-scoring-wait className="arrive flex w-full flex-1 flex-col items-center">
      {/* One warm panel, the topic card's ground (review, 25 Sep: the
          card's colour stopped at this screen): the length on the left,
          Demos standing on the recording itself, which runs along the
          panel's floor. */}
      <section className="topic-card scoring-panel relative w-full shrink-0 overflow-hidden rounded-sheet px-5 pt-5">
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

      <Words early={wait.early} />

      <div role="status" className="mt-5 flex w-full shrink-0 flex-col items-center">
        {attempt > 0 ? (
          <div className="arrive flex max-w-[260px] flex-col items-center text-center">
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
          <ol className="w-full" aria-label="Scoring">
            {rows.map((r) => (
              <Row key={r.key} row={r} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/**
 * What was said, in the transcript's own face, each filler under the
 * transcript's bar in the Fillers tone. It takes the height between the
 * panel and the stages from Stop, so nothing moves when the words land,
 * and fades out at its foot where a long take runs past it; until the
 * words are in it is bones (after the skeleton's 300ms, #434).
 */
function Words({ early }: { early: EarlyRead | null }) {
  const pieces = useMemo(
    () => (early ? transcriptPieces(early.transcript.trim(), early.words, early.fillers) : []),
    [early]
  );
  return (
    /* The room is the column's leftover height (its words are laid over
       it, so a long take never pushes the stages off the screen). Outside
       the stages' live region: read where it stands, never announced
       whole; the stages' rows are the wait's live news. */
    <div className="wait-words relative mt-5 w-full flex-1">
      <div className="wait-words-in absolute inset-0">
      {pieces.length > 0 ? (
        <p className="wait-words-text arrive">
          <span className="sr-only">You said: </span>
          {pieces.map((p, i) =>
            p.kind === "word" && p.mark === "filler" ? (
              <span key={i} className="wait-filler" data-trait="fillers">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </p>
      ) : early ? (
        /* Whisper heard no words: nothing to show, and the rows say so. */
        null
      ) : (
        /* Bones down the whole room, a line's height and gap apiece,
           fading with it at the foot: the words will stand here, and
           the room is never an empty band while they come. */
        <div aria-hidden className="flex flex-col gap-[0.75em] pt-[0.375em]">
          {BONES.map((w, i) => (
            <Skeleton key={i} className={`h-[0.75em] shrink-0 ${w}`} rounded="rounded-[4px]" />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/** The bones' widths, a ragged right edge as a paragraph has; the room clips what it cannot hold. */
const BONES = [
  "w-full", "w-[93%]", "w-[97%]", "w-[86%]", "w-full", "w-[90%]", "w-[95%]", "w-[78%]",
  "w-[99%]", "w-[88%]", "w-[94%]", "w-[70%]", "w-full", "w-[91%]", "w-[83%]", "w-[60%]",
];

function Row({ row }: { row: WaitRow }) {
  return (
    <li data-state={row.state} className="scoring-step flex min-h-[30px] items-center gap-3 text-body">
      <span aria-hidden className="wait-mark flex h-4 w-4 shrink-0 items-center justify-center">
        {row.state === "past" ? (
          <IconCheck size={16} />
        ) : row.state === "skip" ? (
          <span className="h-[2px] w-2 rounded-full bg-current" />
        ) : (
          <span className="scoring-dot h-2 w-2 rounded-full" />
        )}
      </span>
      <span className="min-w-0 flex-1">{row.label}</span>
      {row.value !== null && (
        <span className="wait-value arrive font-display font-semibold tabular-nums">{row.value}</span>
      )}
    </li>
  );
}

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
