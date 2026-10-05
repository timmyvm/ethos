"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AccuracyCard } from "@/components/AccuracyCard";
import { CountUp } from "@/components/CountUp";
import { DemosArt, preloadPose } from "@/components/DemosArt";
import { DimensionList } from "@/components/DimensionList";
import { DURATION } from "@/lib/motion";
import { PauseBar } from "@/components/PauseBar";
import { Says, SAID_AFTER_MS } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Stars } from "@/components/Stars";
import { TRAIT, type TraitId } from "@/content/traits";
import type { AccuracyResult } from "@/lib/accuracy";
import type { CoachOutput } from "@/lib/coach";
import type { ColdTopic } from "@/lib/cold-topics";
import type { Tier1Scores, Tier2Anchors } from "@/lib/index-score";
import type { FillerHit, RepMetrics } from "@/lib/metrics";
import { repTraitGain } from "@/lib/traits";

export interface ResultView {
  transcript: string;
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  previousIndex: number | null;
  accuracy?: AccuracyResult | null;
  scorable?: boolean;
  /** The pause report's one line — what the silences actually did. */
  pauseHeadline?: string | null;
}

/**
 * Which slice of the feedback to render.
 *
 * A finished rep walks these in order across separate screens rather
 * than dumping all of it at once — the old single page put the score,
 * eight dimensions, every filler timestamp and the transcript in one
 * scroll, which meant most of it was never read. The log renders "all"
 * because a stored rep is reference, not a debrief.
 */
export type ResultSection = "score" | "numbers" | "words" | "all";

/** The count the Index runs before the stars may land (#225). */
const COUNT_MS = DURATION.celebrate;
/** One star's landing (globals.css `.star-land`, --duration-max). */
const STAR_MS = DURATION.max;
/** The gap between two stars landing (globals.css `.star-land`). */
const STAR_STEP_MS = 120;

/**
 * The results view, shared by a just-finished rep and any row in the
 * log. Leads with the Index delta and the ONE focus (mechanics.md
 * display rules) — never a wall of eight numbers.
 */
export function RepResult({
  result,
  topic = null,
  section = "all",
  baseline = false,
  live = false,
  player,
  hasPlayer = player != null,
  celebrate = false,
}: {
  result: ResultView;
  topic?: ColdTopic | null;
  section?: ResultSection;
  /**
   * A recording that just finished, as opposed to one opened from the
   * log (DECISIONS #225). Live, the values LAND: the Index counts up,
   * then the stars come in one at a time, then Demos says his line,
   * and on the numbers step the dimension bars fill. Reference renders
   * them already there.
   */
  live?: boolean;
  /**
   * Rep 1 only (DECISIONS #135): frame the first score as the floor
   * the graph grows from, in the slot the delta occupies from rep 2
   * on. Novices tune out on verdict-framed feedback; the number stays
   * exactly as measured, what changes is what it claims to be. The log
   * never sets this — a stored rep is reference, not a first meeting.
   */
  baseline?: boolean;
  /**
   * The playback card (an AudioScrubber), placed on the words section
   * after "Say this instead" and before the transcript (recording-18),
   * so the evidence you can play sits above the words, which stay open
   * (#56). Rendered only where the words section shows.
   */
  player?: ReactNode;
  /**
   * A player exists for this recording somewhere on the screen
   * (recording-13): the static filler chips on the numbers section
   * would be a second, dead copy of the pills that play, so they go.
   * Defaults to whether `player` was passed.
   */
  hasPlayer?: boolean;
  /**
   * A star landed or the streak held (M08). With `live`, on the score
   * section: once the stars have landed, Demos swaps to the celebrate
   * pose with a burst in earned colours, and his line comes after it.
   * Under reduced motion it is the swap and a 200ms fade.
   */
  celebrate?: boolean;
}) {
  const show = (s: ResultSection) => section === "all" || section === s;
  const debrief = section === "score";
  const { metrics: m, coach, tier1, anchors, ethosIndex, previousIndex } =
    result;
  const zone =
    m.wpm >= 130 && m.wpm <= 160
      ? "in the zone"
      : m.wpm > 160
        ? "sprinting"
        : "strolling";
  const delta =
    ethosIndex !== null && previousIndex !== null
      ? ethosIndex - previousIndex
      : null;

  /*
   * What Demos says, one line. The coach's own line when it ran; a
   * stored row keeps no line (app/rep/[id] passes ""), so it says
   * tomorrow's focus instead (log-9). The line computed from the
   * metrics is only for a recording the coach never read: it names the
   * filler it can count, and never calls a take with fillers clean.
   */
  const topFiller = m.topFiller ?? mostSaid(m.fillers);
  const computedLine = `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"} in ${Math.round(
    m.durationS
  )}s.${topFiller ? ` Tomorrow: kill “${topFiller}”.` : m.fillerCount === 0 ? " Clean take." : ""}`;
  const line = coach?.coachLine?.trim()
    ? coach.coachLine
    : coach?.focus
      ? `Tomorrow: ${coach.focus}`
      : computedLine;

  /*
   * The trait this rep leveled (DECISIONS #160) — this rep's best
   * dimension, when it cleared the bar. One quiet line, never a second
   * celebration (#34). Derived, so the log's copy of this rep says the
   * same thing forever. A measured trait goes by its content/traits.ts
   * name, the one Today, Lessons and the Log use.
   */
  const gain = repTraitGain({
    transcript: result.transcript,
    dimensions: { tier1, tier2: coach?.dimensions ?? null },
  });
  const gainName = gain
    ? gain.key in TRAIT
      ? TRAIT[gain.key as TraitId].name
      : gain.name
    : null;

  /*
   * The score step's clock (M07): the count, then the stars 120ms
   * apart, then his line arrives and lands word by word, then he nods.
   * With `celebrate`, the swap to the celebrate pose takes the nod's
   * place and comes before the line. Reduced motion keeps the order
   * but drops the waits: every entrance is one fade at once.
   */
  const [reduced] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.motion === "reduce"
  );
  const counts = ethosIndex !== null;
  const landAfter = counts ? COUNT_MS : 0;
  const starsDone =
    landAfter + Math.max(0, m.stars - 1) * STAR_STEP_MS + STAR_MS;
  const timed = live && debrief;
  const bubbleAt = timed && !reduced ? starsDone + (celebrate ? 240 : 0) : 0;
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!celebrate || !timed) return;
    preloadPose("celebrate");
    const t = setTimeout(() => setCelebrating(true), starsDone);
    return () => clearTimeout(t);
  }, [celebrate, timed, starsDone]);

  const said = timed ? (
    <Says text={line} lead={bubbleAt + 160} className="text-pretty" />
  ) : (
    <p className="text-pretty">{line}</p>
  );

  return (
    <>
      {show("score") &&
        (debrief ? (
          /* The debrief's score step (recording-6, M07): one centred
             column, stars first, then the number, one delta, one
             caption. Nothing floats off to one side. */
          <div className="mt-5 flex flex-col items-center text-center">
            {ethosIndex !== null ? (
              <>
                <span className="[&>span]:gap-3!">
                  <Stars
                    n={m.stars}
                    size={40}
                    arch
                    tone="sage-700"
                    land={live}
                    landAfterMs={COUNT_MS}
                  />
                </span>
                <div className="mt-5 flex items-baseline justify-center gap-1">
                  <span className="sr-only">Ethos</span>
                  <span data-score className="font-display text-num-xl tabular-nums">
                    <CountUp value={ethosIndex} />
                  </span>
                  <span className="text-body font-normal text-stone-500">/1000</span>
                </div>
                <Delta delta={delta} baseline={baseline} className="mt-2" />
              </>
            ) : result.scorable === false ? (
              <NotScored metrics={m} centred />
            ) : (
              <>
                <span className="[&>span]:gap-3!">
                  <Stars n={m.stars} size={40} arch tone="sage-700" land={live} />
                </span>
                <div className="mt-5 flex items-baseline justify-center gap-1.5">
                  <span className="font-display text-num-xl tabular-nums">
                    {m.fillerCount}
                  </span>
                  <span className="text-body font-normal text-stone-500">
                    filler{m.fillerCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-2 font-display text-body font-bold text-stone-500">
                  {m.fillersPerMin} a minute
                </p>
              </>
            )}
            {gainName && gain && (
              <p className="mt-1.5 text-caption text-stone-500">
                {gainName} leveled {gain.levels === 2 ? "twice" : "up"}
              </p>
            )}
          </div>
        ) : ethosIndex !== null ? (
          /* A stored recording (the Log) and an upload: the number at
             the hero size, its label beside it, the stars at the end. */
          <div className="mt-5 flex items-baseline gap-3.5">
            <span data-score className="font-display text-num-hero tabular-nums">
              <CountUp value={ethosIndex} />
            </span>
            <div className="min-w-0">
              <div className="text-body font-semibold">
                your Ethos <span className="font-normal text-stone-500">/1000</span>
              </div>
              <Delta delta={delta} baseline={baseline} small />
            </div>
            <span className="ml-auto self-center">
              <Stars n={m.stars} size={22} land={live} landAfterMs={COUNT_MS} />
            </span>
          </div>
        ) : result.scorable === false ? (
          <NotScored metrics={m} />
        ) : (
          <div className="mt-5 flex items-baseline gap-3.5">
            <span className="font-display text-num-hero tabular-nums">
              {m.fillerCount}
            </span>
            <div>
              <div className="text-body font-semibold">
                filler{m.fillerCount === 1 ? "" : "s"}
              </div>
              <div className="text-caption text-stone-500">
                {m.fillersPerMin} a minute
              </div>
            </div>
            <span className="ml-auto self-center">
              <Stars n={m.stars} size={22} land={live} />
            </span>
          </div>
        ))}

      {show("score") && !debrief && gainName && gain && (
        <p className="mt-2 text-caption font-semibold text-stone-500">
          {gainName} leveled {gain.levels === 2 ? "twice" : "up"}
        </p>
      )}

      {show("score") && (
        /*
         * Demos speaks from his bubble (M08, log-8): the full-body
         * speaking pose at 112, the bubble's tail at his face, and no
         * wash, because terracotta is the tap and nothing here is one.
         * One line in it. The caption that says a model wrote it sits
         * under the bubble, outside it, and only when a coach ran: the
         * fallback line is computed from the metrics.
         */
        <div className={`${debrief ? "mt-8" : "mt-7"} flex w-full items-start gap-3 text-left`}>
          <div className="relative shrink-0">
            {celebrating ? (
              <DemosArt
                key="celebrate"
                pose="celebrate"
                size={112}
                greetAfterMs={0}
                idle={false}
                className="fade-in"
              />
            ) : (
              <DemosArt
                key="speaking"
                pose="speaking"
                size={112}
                greetAfterMs={timed && !celebrate ? bubbleAt + SAID_AFTER_MS : undefined}
                idle={false}
              />
            )}
            {celebrating && (
              <span aria-hidden className="earned-burst">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            )}
          </div>
          <div
            className={`min-w-0 flex-1 ${timed ? "arrive" : ""}`}
            style={timed ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined}
          >
            <SpeechBubble tail="left">{said}</SpeechBubble>
            {coach && (
              <p className="mt-2 pl-1 text-caption text-stone-400">
                AI-generated feedback
              </p>
            )}
          </div>
        </div>
      )}

      {show("score") && result.accuracy && (
        <div className="mt-7 w-full text-left">
          <AccuracyCard accuracy={result.accuracy} topic={topic} />
        </div>
      )}

      {show("numbers") && (
        <>
          <div className="mt-7">
            <PauseBar pauses={m.pauses} durationS={m.durationS} />
          </div>

          {/* What the silences actually DID. The bar shows where they
              fell; this says whether they were earned. */}
          {result.pauseHeadline && (
            <p className="mt-2.5 text-body text-stone-600">
              {result.pauseHeadline}
            </p>
          )}
        </>
      )}

      {show("numbers") && (
        <section className="mt-7">
          {/* Counted, not asserted. The head read "The eight" on every
              rep, including ones where the coach layer never ran and
              only the measured half existed. The rows say they open
              with their own chevrons, so the head says nothing about
              tapping. */}
          <h2 className="section-head">
            {coach ? "Every dimension" : "The measured dimensions"}
          </h2>
          <div className="mt-3">
            <DimensionList
              tier1={tier1}
              anchors={anchors}
              metrics={m}
              coach={coach}
              pauseDetail={result.pauseHeadline ?? undefined}
              fill={live}
            />
          </div>

          {/* Three stats in one card (log-7, recording-9; Imprint's Me):
              columns split by hairlines, not three boxes. */}
          <div className="card mt-3 grid grid-cols-3 divide-x divide-hairline">
            <Metric label="WPM" value={String(m.wpm)} note={zone} />
            <Metric
              label="Held pauses"
              value={String(m.heldPauses)}
              note="≥0.8s each"
            />
            <Metric
              label="Length"
              value={String(Math.round(m.durationS))}
              unit="s"
              note={<span className="whitespace-nowrap">target 60 to 90s</span>}
            />
          </div>
        </section>
      )}

      {/* Every filler as a static chip, only where nothing on the screen
          can play them (recording-13): a lost local clip, an upload. */}
      {show("numbers") && !hasPlayer && m.fillers.length > 0 && (
        <section className="mt-7">
          <h2 className="section-head">
            Every filler
            <span className="section-head-count">{m.fillers.length}</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.fillers.map((f, i) => (
              <span
                key={i}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-caption text-ink"
              >
                {f.word}{" "}
                <span className="tabular-nums text-stone-500">{clock(f.t)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* What held, from the coach (M08): the words step opens on it,
          since it is a claim about the words below. */}
      {show("words") && coach?.strength && (
        <p className="mt-7 text-body text-stone-600 text-pretty">
          <span className="font-semibold text-ink">Kept:</span> {coach.strength}
        </p>
      )}

      {show("words") && coach?.supply && (
        <section className="mt-7">
          <h2 className="section-head">Say this instead</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
            <span className="text-stone-500 line-through">
              {coach.supply.original}
            </span>
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="shrink-0 text-stone-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" />
            </svg>
            <span className="font-semibold">{coach.supply.upgrade}</span>
          </div>
          {coach.supply.note && (
            <p className="mt-1.5 text-caption text-stone-500">
              {coach.supply.note}
            </p>
          )}
        </section>
      )}

      {show("words") && player && <div className="mt-7">{player}</div>}

      {/* Open, not hidden behind a disclosure (#56). Every score on this
          screen is a claim about these words — you should be able to
          read them without going looking. */}
      {show("words") && (
        <section className="mt-7">
          <h2 className="section-head">
            What you said
            {typeof m.substance?.wordCount === "number" && (
              <span className="section-head-count">
                {m.substance.wordCount} word{m.substance.wordCount === 1 ? "" : "s"}
              </span>
            )}
          </h2>
          <p className="mt-3 text-read text-stone-800">
            {result.transcript || "Nothing was picked up."}
          </p>
        </section>
      )}
    </>
  );
}

/** "▲ 3 since last time", or the first recording's floor line. */
function Delta({
  delta,
  baseline,
  small = false,
  className = "",
}: {
  delta: number | null;
  baseline: boolean;
  small?: boolean;
  className?: string;
}) {
  const size = small ? "text-caption font-semibold" : "font-display text-body font-bold";
  if (delta !== null && delta !== 0) {
    return (
      <p className={`${size} ${delta > 0 ? "text-sage-700" : "text-rust"} ${className}`}>
        {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since last time
      </p>
    );
  }
  if (delta === null && baseline) {
    return (
      <p className={`${size} text-stone-500 ${className}`}>
        Day 0. Everything after this has a number to beat.
      </p>
    );
  }
  return null;
}

/**
 * Not a score of zero — no score. Saying "I don't know" over and over
 * has no fillers and a fine pace; reporting those numbers as an
 * achievement would be the app lying to you.
 */
function NotScored({ metrics: m, centred = false }: { metrics: RepMetrics; centred?: boolean }) {
  return (
    <div className={centred ? "flex flex-col items-center" : "mt-5"}>
      {centred && (
        <span className="[&>span]:gap-3!">
          <Stars n={1} size={40} arch tone="sage-700" />
        </span>
      )}
      <h2 className={`font-display text-title ${centred ? "mt-5" : ""}`}>
        Not enough to score.
      </h2>
      <p className="mt-2 text-body text-stone-500 text-pretty">
        {m.substance.wordCount < 20
          ? `${m.substance.wordCount} word${m.substance.wordCount === 1 ? "" : "s"} isn't enough yet. Give it 60 to 90 seconds and a real answer.`
          : "Almost all of that was the same few words repeated. Say something you'd have to think about."}
      </p>
      {centred ? (
        <p className="mt-1.5 text-caption text-stone-500">1 star, nothing measured</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Stars n={1} size={18} />
          <span className="text-caption text-stone-500">1 star, nothing measured</span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note: ReactNode;
}) {
  return (
    <div className="min-w-0 px-3 py-4">
      <div className="label-micro whitespace-nowrap">{label}</div>
      <div className="font-display mt-1.5 text-num-m tabular-nums">
        {value}
        {unit && <span className="text-body font-bold text-stone-500">{unit}</span>}
      </div>
      <div className="mt-1 text-caption text-balance text-stone-500">{note}</div>
    </div>
  );
}

/** m:ss for a filler's timestamp. */
function clock(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

/**
 * The filler said most, for a row whose metrics were rebuilt from
 * storage and so carry no `topFiller`. Ties go to the earlier one.
 */
function mostSaid(fillers: FillerHit[]): string | null {
  const counts = new Map<string, number>();
  for (const f of fillers) counts.set(f.word, (counts.get(f.word) ?? 0) + 1);
  let best: string | null = null;
  let most = 0;
  for (const [word, n] of counts) {
    if (n > most) {
      best = word;
      most = n;
    }
  }
  return best;
}
