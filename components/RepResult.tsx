"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
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
import { scoreLine } from "@/lib/coach-line";
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
  spread = false,
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
  /**
   * The score step fills a flex column (the recording page's walk): the
   * score at the top, then Demos on a coach stage in the take's colour
   * that takes all the free height (E55), then his line. The parent is
   * a `flex flex-col` the height of the room, and sets `data-trait` to
   * the practice's family (the sky's wash where it has none).
   */
  spread?: boolean;
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
   * What Demos says, one line, about THIS take (E54, E34): tomorrow is
   * said once, on the last step. The coach's own line when it ran, its
   * closing "Tomorrow…" sentence trimmed; a stored row keeps no line
   * (app/rep/[id] passes ""), so it says the stored focus on its own
   * (log-9). The line computed from the metrics is only for a recording
   * the coach never read: it counts the fillers and names the one said
   * most, and never calls a take with fillers clean (lib/coach-line.ts).
   */
  const line = scoreLine(coach, {
    ...m,
    topFiller: m.topFiller ?? mostSaid(m.fillers),
  });

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

  /* Balanced, not pretty: his line is one or two short sentences, and
     balance breaks "4 fillers in 62s. / Tomorrow: kill ‘um’." where
     pretty left the last two words alone on the second line. */
  const said = timed ? (
    <Says text={line} lead={bubbleAt + 160} className="text-balance" />
  ) : (
    <p className="text-balance">{line}</p>
  );

  const spreads = spread && debrief;
  /* On a phone 700pt or taller the stage has room for his line too:
     it hangs over his head with its tail down at his face, so the step
     reads as the score, then Demos saying it on his own ground (R2F-02:
     at 390x844 the stage was 359pt holding only him, about 139pt of
     bare wash over his ears, his line in a second card under it). On a
     shorter phone the stage is about his height and the line hangs
     under it, tail up. */
  const tallRoom = useTallRoom();
  const lineInStage = spreads && tallRoom;
  const bubble = (tail: "up" | "down", className: string) => (
    <div
      className={`${className} ${timed ? "arrive" : ""}`}
      style={timed ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined}
    >
      <SpeechBubble tail={tail} className="text-center">
        {said}
      </SpeechBubble>
    </div>
  );
  /* With his line in the stage, what the stage cannot use over his
     head (about 120pt at 390x844) is shared out: up to 32pt over the
     stars and 32pt over the stage, and the stage keeps the rest, so
     the score breathes and the wash over his line stays under 80. */
  const air = lineInStage ? <div aria-hidden className="max-h-8 flex-1" /> : null;
  return (
    <>
      {show("score") && air}
      {show("score") &&
        (debrief ? (
          /* The debrief's score step (recording-6, M07, D52, E55): one
             centred column, stars first, then the number, one delta,
             one caption, on the ground 24px under the step bar; then
             Demos on his stage and his line. Nothing floats off to one
             side. */
          <div className={`flex flex-col items-center text-center ${spreads ? "mt-6 [@media(max-height:600px)]:mt-4" : ""}`}>
            {ethosIndex !== null ? (
              <>
                <span className="[&>span]:gap-3!">
                  <Stars
                    n={m.stars}
                    size={40}
                    arch
                    land={live}
                    landAfterMs={COUNT_MS}
                  />
                </span>
                <div className="mt-6 flex items-baseline justify-center gap-1">
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
                  <Stars n={m.stars} size={40} arch land={live} />
                </span>
                <div className="mt-6 flex items-baseline justify-center gap-1.5">
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

      {show("score") && debrief && air}
      {show("score") && debrief && (
        /*
         * E55, E58: the score step's free height is Demos's stage, not
         * ground. Under the score (which stays the loudest thing, 665 at
         * 72), a stage in the take's own colour (`--tone-wash` from the
         * column's data-trait: #e6edff, #142333 dark, on a Pausing day;
         * the sky's wash for the boss and the games) takes every spare
         * pixel at radius 28, so the step reads as the score and a coach
         * who stands somewhere. He stands centred on the introduction's
         * soft contact shadow 20px over its foot, scaled to the stage
         * (88 to 200: 100cqh less 20 over and 20 under), and his line
         * hangs under it with its tail up at him. The celebrate pose,
         * with its sparkles and burst, is only for a new best Index or
         * three stars (lib/rewards `celebrates`). It used to be three
         * even bands of bare ground with a 228px Demos as the step's
         * biggest object (D52).
         */
        <div className="flex w-full flex-1 flex-col items-center">
          {/* The stage's room is an absolute inset-0 size container (as
              `.demos-fit-room`): a flex-grown box's own height is not one
              its container units can read. On a phone under 600px tall
              (320x568) there is no spare height to give: the score and
              the stage close up 8px each, the stage takes what is left
              over his line, so the line stays over the shelf, and he
              stands 8px over its foot from 64px up. */}
          <div
            data-coach-stage
            data-line-in-stage={lineInStage || undefined}
            className={`relative mt-5 w-full rounded-[28px] bg-[var(--tone-wash,var(--pop-sky-wash))] [@media(max-height:600px)]:mt-3 ${
              lineInStage
                ? "min-h-[300px] flex-1"
                : spreads
                  ? "min-h-[140px] flex-1 [@media(max-height:600px)]:min-h-0"
                  : "h-[240px]"
            }`}
          >
            <div className="absolute inset-0 [container-type:size]">
            {/* With his line in the stage, he gives it two lines of room
                (78), 12px to his head and 20 to the stage's top: 88 to
                200 from 100cqh less 130. */}
            <div
              className={`absolute bottom-5 left-1/2 -translate-x-1/2 [container-type:size] ${
                lineInStage
                  ? "size-[clamp(88px,calc(100cqh_-_130px),200px)]"
                  : "size-[clamp(88px,calc(100cqh_-_40px),200px)] [@media(max-height:600px)]:bottom-2 [@media(max-height:600px)]:size-[clamp(64px,calc(100cqh_-_12px),200px)]"
              }`}
            >
              {celebrating ? (
                /* The still, not the clip: the celebrate clip's alpha
                   leaves a white matte over his head on a coloured
                   stage (it only ever stood on the plain ground). */
                <DemosArt
                  key="celebrate"
                  pose="celebrate"
                  size={200}
                  fit
                  grounded
                  idle={false}
                  greetAfterMs={0}
                  className="fade-in"
                />
              ) : (
                <DemosArt
                  key="speaking"
                  pose="speaking"
                  size={200}
                  fit
                  grounded
                  greetAfterMs={timed && !celebrate ? bubbleAt + SAID_AFTER_MS : undefined}
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
            {lineInStage &&
              bubble(
                "down",
                "absolute inset-x-5 bottom-[calc(20px_+_clamp(88px,calc(100cqh_-_130px),200px)_+_12px)] text-left"
              )}
            </div>
          </div>
          {!lineInStage && bubble("up", "mt-3 w-full text-left")}
          {coach && (
            <p
              className={`mt-2 text-center text-caption text-stone-400 ${timed ? "arrive" : ""}`}
              style={timed ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined}
            >
              AI-generated feedback
            </p>
          )}
        </div>
      )}

      {show("score") && !debrief && (
        /*
         * Demos speaks from his bubble (M08, log-8): the full-body
         * speaking pose at 112, the bubble's tail at his face, and no
         * wash, because terracotta is the tap and nothing here is one.
         * One line in it. The caption that says a model wrote it sits
         * under the bubble, outside it, and only when a coach ran: the
         * fallback line is computed from the metrics.
         */
        <div className="mt-7 flex w-full items-start gap-3 text-left">
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

          {/* Three stats in one card (log-7, recording-9; Imprint's Me):
              columns split by hairlines, not three boxes. The concrete
              three lead the step, under the pause map they read off,
              over the nine score rows (E34). */}
          <div className="card mt-5 grid grid-cols-3 divide-x divide-hairline">
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
          <Stars n={1} size={40} arch />
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

/** A phone at least 700pt tall: the score step's stage holds his line. */
const TALL_ROOM = "(min-height: 700px)";

function useTallRoom(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(TALL_ROOM);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(TALL_ROOM).matches,
    () => false
  );
}
