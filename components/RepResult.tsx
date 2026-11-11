"use client";

import { Fragment, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { SwapFrom, SwapTo, TrendMark } from "@/components/ui/TrendMark";
import { AccuracyCard } from "@/components/AccuracyCard";
import { CountUp } from "@/components/CountUp";
import { DemosArt, preloadPose } from "@/components/DemosArt";
import { DimensionList } from "@/components/DimensionList";
import { InteractiveTranscript } from "@/components/InteractiveTranscript";
import { DURATION } from "@/lib/motion";
import { PauseBar } from "@/components/PauseBar";
import { MomentChip } from "@/components/rep/MomentChip";
import { Says, SAID_AFTER_MS } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Stars } from "@/components/Stars";
import type { TakeAudio } from "@/components/TakeAudio";
import { TRAIT, type TraitId } from "@/content/traits";
import type { AccuracyResult } from "@/lib/accuracy";
import type { CoachOutput } from "@/lib/coach";
import type { ColdTopic } from "@/lib/cold-topics";
import type { Tier1Scores, Tier2Anchors } from "@/lib/index-score";
import type { GlanceMoment, GlancePart, SheetSection } from "@/lib/glance";
import type { FillerHit, RepMetrics, Word } from "@/lib/metrics";
import { scoreLine } from "@/lib/coach-line";
import { repTraitGain } from "@/lib/traits";

export interface ResultView {
  transcript: string;
  /**
   * Whisper's words with their times (#411), so the transcript knows
   * when each word was said. A stored row without its word list, or a
   * reply from before #411, has none; the transcript then reads the
   * text alone.
   */
  words?: Word[] | null;
  /** The stored recording, filed with a swap saved from its words. */
  repId?: string | null;
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
 *
 * Since #427 the live results are one screen and one door: "glance" is
 * the screen (the score, Demos's one measured line, its moment and cue)
 * and "detail" is the door's sheet, "The whole recording". The walk's
 * "score", "numbers" and "words" are no longer used live; "all" (the
 * Log, an upload) renders exactly as it did.
 */
export type ResultSection = "score" | "numbers" | "words" | "all" | "glance" | "detail";

/**
 * What the glance says (DECISIONS #427, lib/glance.ts): Demos's one
 * measured line with its moment, the cue for next time, and the earned
 * line under the delta, already fitted to the glance's budget.
 */
export interface GlanceView {
  parts: GlancePart[];
  moment: GlanceMoment | null;
  cue: string | null;
  earned: { text: string; tone: "earned" | "plain"; delta?: number | null } | null;
}

/** The sheet's body (section "detail"): its sections in order, and those Results draws. */
export interface SheetView {
  sections: SheetSection[];
  /** The practice's trait, whose dimension row starts open. */
  open?: TraitId;
  slots?: Partial<Record<SheetSection, ReactNode>>;
}

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
  onPlay,
  take = null,
  celebrate = false,
  spread = false,
  round = null,
  leadMs = 0,
  hold = false,
  lengthNote = "target 60 to 90s",
  pauseMarks,
  starSize = 40,
  glance = null,
  cappedNote = null,
  ask = null,
  under = null,
  sheet = null,
  moment = false,
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
   * Plays the recording from a second (the player's own seek, #411):
   * the word sheet's "Said at 0:14". Absent where nothing can play it.
   */
  onPlay?: (t: number) => void;
  /**
   * The take's audio (components/TakeAudio.tsx, #424), for the Pause
   * row's moments: each filled pause's timestamp plays that stretch of
   * the recording. Absent where nothing can play it, and the moments
   * read as plain text.
   */
  take?: TakeAudio | null;
  /**
   * A star landed or the streak held (M08). With `live`, on the score
   * section: once the stars have landed, Demos swaps to the celebrate
   * pose with a burst in earned colours, and his line comes after it.
   * Under reduced motion it is the swap and a 200ms fade.
   */
  celebrate?: boolean;
  /**
   * The score step fills a flex column (the recording page's walk): the
   * score at the top, then Demos on the plain ground, sized to all the
   * free height (E55), then his line. The parent is a `flex flex-col`
   * the height of the room.
   */
  spread?: boolean;
  /**
   * A game's round card (components/rep/RoundCard.tsx, the games plan
   * item 4): on the score step, above the stars. The stars, the Index and
   * Demos's line then land `leadMs` later, once the round has had its
   * reveal (F3).
   */
  round?: ReactNode;
  leadMs?: number;
  /**
   * Live, hold the score step's reveal at its first frame (the streak
   * celebration is up over it, so it would play unseen); it starts when
   * this goes false.
   */
  hold?: boolean;
  /** The Length tile's note: the game's own clock (M5), else the daily target. */
  lengthNote?: string;
  /** Moments the pause map marks, as Demos's cut-in (the games plan, item 4). */
  pauseMarks?: { t: number; label: string }[];
  /** The score step's stars, 40, or 32 where a round card needs the height for Demos. */
  starSize?: number;
  /** The glance's words (section "glance", #427). */
  glance?: GlanceView | null;
  /** On the glance of a capped take, under its hero: "Measured, not judged." or the plum line. */
  cappedNote?: ReactNode;
  /**
   * On the glance, in the slot of Demos's cue for next time: the reminder
   * ask (#430, components/rep/ReminderAsk.tsx), when there is one.
   */
  ask?: ReactNode;
  /**
   * On the glance, under Demos's line: a tester's match question. Demos
   * then stands beside his line at 112, as on the Log, to make the room.
   */
  under?: ReactNode;
  /** The sheet's body (section "detail", #427). */
  sheet?: SheetView | null;
  /**
   * On the glance: a moment (a best, the first recording, a lesson's
   * ending, a ladder rung), where Demos takes his share of the height
   * first. On an ordinary practice the bands take theirs (#427 review).
   */
  moment?: boolean;
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
    scorable: result.scorable,
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
  const glancing = section === "glance";
  const timed = live && (debrief || glancing);
  /* A round card plays first (F3): everything after it moves back by its
     length. Reduced motion has no sequence to wait on. */
  const lead = timed && !reduced ? leadMs : 0;
  const landAfter = (counts ? COUNT_MS : 0) + lead;
  const starsDone =
    landAfter + Math.max(0, m.stars - 1) * STAR_STEP_MS + STAR_MS;
  /* Held (the streak celebration is over it): nothing lands until it
     has gone, and then the whole step runs from its first frame. Once
     started it never holds again. */
  const [go, setGo] = useState(!hold);
  useEffect(() => {
    if (!hold) setGo(true);
  }, [hold]);
  const waiting = timed && !go;
  /* The count starts when the round's reveal is done. */
  const [counting, setCounting] = useState(lead === 0 && !waiting);
  useEffect(() => {
    if (waiting || counting) return;
    const t = setTimeout(() => setCounting(true), lead);
    return () => clearTimeout(t);
  }, [waiting, counting, lead]);
  const bubbleAt = timed && !reduced ? starsDone + (celebrate ? 240 : 0) : 0;
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!celebrate || !timed || waiting) return;
    preloadPose("celebrate");
    const t = setTimeout(() => setCelebrating(true), starsDone);
    return () => clearTimeout(t);
  }, [celebrate, timed, waiting, starsDone]);

  /* Balanced, not pretty: his line is one or two short sentences, and
     balance breaks "4 fillers in 62s. / Tomorrow: kill ‘um’." where
     pretty left the last two words alone on the second line. */
  const said = waiting ? (
    <p className="invisible text-balance">{line}</p>
  ) : timed ? (
    <Says text={line} lead={bubbleAt + 160} className="text-balance" />
  ) : (
    <p className="text-balance">{line}</p>
  );

  const spreads = spread && debrief;
  /* On a phone 700pt or taller his room has space for his line too:
     it hangs over his head with its tail down at his face, so the step
     reads as the score, then Demos saying it (R2F-02: at 390x844 the
     room was 359pt holding only him, about 139pt of bare ground over
     his ears, his line in a second card under it). On a shorter phone
     the room is about his height and the line hangs under it, tail up. */
  const tallRoom = useTallRoom();
  /* A round card above the score takes the height his line would hang
     in: his line goes under him, as on a short phone. */
  const lineInRoom = spreads && tallRoom && !round;
  const bubble = (tail: "up" | "down", className: string) => (
    <div
      className={`${className} ${waiting ? "invisible" : timed ? "arrive" : ""}`}
      style={timed && !waiting ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined}
    >
      <SpeechBubble tail={tail} className="text-center">
        {said}
      </SpeechBubble>
    </div>
  );
  /* With his line in his room, up to 32pt of the spare height goes
     over the stars so the score breathes; Demos takes the rest. */
  const air = lineInRoom ? <div aria-hidden className="max-h-8 flex-1" /> : null;

  /* Under 600pt of height (320x568) the glance has no room for Demos:
     his line stays, as plain text where the bubble was. */
  const shortRoom = useShortRoom();

  if (glancing) {
    return (
      <Glance
        view={glance ?? { parts: [{ kind: "text", text: line }], moment: null, cue: null, earned: null }}
        metrics={m}
        ethosIndex={ethosIndex}
        scorable={result.scorable !== false}
        delta={delta}
        baseline={baseline}
        boss={topic !== null}
        live={live}
        waiting={waiting}
        timed={timed}
        counting={counting}
        landAfter={landAfter}
        lead={lead}
        bubbleAt={bubbleAt}
        celebrate={celebrate}
        celebrating={celebrating}
        starSize={starSize}
        take={take}
        cappedNote={cappedNote}
        ask={ask}
        under={under}
        short={shortRoom}
        tall={tallRoom}
        moment={moment}
      />
    );
  }

  if (section === "detail") {
    const view = sheet ?? { sections: [] };
    const draw = (k: SheetSection): ReactNode => {
      if (view.slots?.[k] !== undefined) return view.slots[k];
      switch (k) {
        case "accuracy":
          return result.accuracy ? <AccuracyCard accuracy={result.accuracy} topic={topic} /> : null;
        case "hear":
          return player ?? null;
        case "fillers":
          return m.fillers.length > 0 ? (
            <section>
              <h2 className="section-head">
                Every filler
                <span className="section-head-count">{m.fillers.length}</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.fillers.map((f, i) => (
                  <span key={i} className="rounded-full bg-stone-100 px-2.5 py-1 text-caption text-ink">
                    {f.word} <span className="tabular-nums text-stone-500">{clock(f.t)}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null;
        case "coach":
          /* The coach's two under one head, the caption under the head so
             it covers both (M-2, the #427 review: "Kept:" was a headless
             line and the caption trailed under Say this instead alone):
             the only text on the screen a model wrote. */
          return coach && (coach.strength || coach.supply) ? (
            <section>
              <h2 className="section-head">Demos&apos;s read</h2>
              <p className="mt-1 text-caption text-stone-400">AI-generated feedback</p>
              {coach.strength && (
                <div className="mt-3">
                  <h3 className="detail-head">Kept</h3>
                  <p className="mt-1 text-body text-stone-600 text-pretty">{coach.strength}</p>
                </div>
              )}
              {coach.supply && (
                <div className={coach.strength ? "mt-4" : "mt-3"}>
                  <h3 className="detail-head">Say this instead</h3>
                  {/* The arrow travels with what it points at (#429): a
                      longer phrase of the speaker's wraps the pair, and the
                      second line reads "→ an impossible week", never an
                      arrow left at the end of the first. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
                    <span className="text-stone-500 line-through">
                      <SwapFrom />
                      {coach.supply.original}
                    </span>
                    <span className="flex min-w-0 items-center gap-x-3">
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
                      <span className="font-semibold">
                        <SwapTo />
                        {coach.supply.upgrade}
                      </span>
                    </span>
                  </div>
                  {coach.supply.note && <p className="mt-1.5 text-caption text-stone-500">{coach.supply.note}</p>}
                </div>
              )}
            </section>
          ) : null;
        case "capped":
          /* A measured fact, both halves (the review: the streak line was
             gone everywhere on a capped take). */
          return (
            <p className="text-body text-stone-500">
              Demos&apos;s full read is back tomorrow. It still counted toward your streak.
            </p>
          );
        case "dimensions":
          return (
            <section>
              <h2 className="section-head">{coach ? "Every dimension" : "The measured dimensions"}</h2>
              {/* The take's length against its target (the review: the
                  three tiles went and took the length with them). #160's
                  line is in its own row now, not here. */}
              <p data-take-length className="mt-1 text-caption text-stone-500">
                Length {Math.round(m.durationS)}s{lengthNote.startsWith("of ") ? " " : ", "}
                {lengthNote}
              </p>
              <div className="mt-3">
                <DimensionList
                  tier1={tier1}
                  anchors={anchors}
                  metrics={m}
                  coach={coach}
                  pauseDetail={result.pauseHeadline ?? undefined}
                  take={take}
                  fill={live}
                  open={view.open}
                  brief
                  gain={gain ? { key: gain.key, name: gain.name, text: `Leveled ${gain.levels === 2 ? "twice" : "up"}` } : null}
                />
              </div>
            </section>
          );
        case "words":
          return (
            <section>
              <h2 className="section-head">
                What you said
                {typeof m.substance?.wordCount === "number" && (
                  <span className="section-head-count">
                    {m.substance.wordCount} word{m.substance.wordCount === 1 ? "" : "s"}
                  </span>
                )}
              </h2>
              <InteractiveTranscript
                transcript={result.transcript}
                words={result.words}
                fillers={m.fillers}
                onPlay={hasPlayer ? onPlay : undefined}
                repId={result.repId ?? null}
                doorToWords={!live}
              />
            </section>
          );
        default:
          return null;
      }
    };
    const drawn = view.sections.map((k) => [k, draw(k)] as const).filter(([, n]) => n !== null && n !== false);
    return (
      <>
        {drawn.map(([k, node], i) => (
          <div key={k} data-sheet-section={k} className={i === 0 ? "" : "mt-7"}>
            {node}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {show("score") && air}
      {show("score") &&
        (debrief ? (
          /* The debrief's score step (recording-6, M07, D52, E55): one
             centred column, stars first, then the number, one delta,
             one caption, on the ground 24px under the step bar; then
             Demos and his line. Nothing floats off to one side. */
          <div
            className={`flex flex-col items-center text-center ${
              spreads ? (round ? "mt-4 [@media(max-height:600px)]:mt-3" : "mt-6 [@media(max-height:600px)]:mt-4") : ""
            }`}
          >
            {round && <div className="mb-4 w-full [@media(max-height:600px)]:mb-3">{round}</div>}
            {ethosIndex !== null ? (
              <>
                <span className={`[&>span]:gap-3! ${waiting ? "invisible" : ""}`}>
                  <Stars
                    key={waiting ? "wait" : "land"}
                    n={m.stars}
                    size={starSize}
                    arch
                    land={live && !waiting}
                    landAfterMs={landAfter}
                  />
                </span>
                <div
                  className={`${round ? "mt-3" : "mt-6"} flex items-baseline justify-center gap-1 ${
                    counting ? "" : "invisible"
                  }`}
                >
                  <span className="sr-only">Ethos</span>
                  <span data-score className="font-display text-num-xl tabular-nums">
                    {counting ? <CountUp value={ethosIndex} /> : ethosIndex}
                  </span>
                  <span className="text-body font-normal text-stone-500">/1000</span>
                </div>
                <Delta
                  delta={delta}
                  baseline={baseline}
                  boss={topic !== null}
                  className={`mt-2 ${counting ? "" : "invisible"}`}
                />
              </>
            ) : result.scorable === false ? (
              <NotScored metrics={m} centred />
            ) : (
              <>
                <span className={`[&>span]:gap-3! ${waiting ? "invisible" : ""}`}>
                  <Stars
                    key={waiting ? "wait" : "land"}
                    n={m.stars}
                    size={starSize}
                    arch
                    land={live && !waiting}
                    landAfterMs={lead}
                  />
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
            {/* A game round's own number takes this line's place (M5). */}
            {gainName && gain && !round && (
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
              <Delta delta={delta} baseline={baseline} boss={topic !== null} small />
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

      {show("score") && debrief && (
        /*
         * E55, E58: the score step's free height is Demos's, not bare
         * ground. Under the score (which stays the loudest thing, 665 at
         * 72), he stands centred on the introduction's soft contact
         * shadow, scaled to every spare pixel, with his line over his
         * head on a tall phone and under him on a short one. No card
         * behind him: Timothy took the stage in the take's colour out
         * (T03 reverted, #400), so he stands on the screen's own ground
         * the way he does in the introduction, and the height the stage
         * filled is his: up to 270 on a tall phone, where 200 left 130pt
         * of bare ground over his line at 390x844. The celebrate
         * pose, with its sparkles and burst, is only for a new best
         * Index or three stars (lib/rewards `celebrates`).
         */
        <div className="flex w-full flex-1 flex-col items-center">
          {/* His room is an absolute inset-0 size container (as
              `.demos-fit-room`): a flex-grown box's own height is not one
              its container units can read. On a phone under 600px tall
              (320x568) there is no spare height to give: the score and
              the room close up 8px each, the room takes what is left
              over his line, so the line stays over the shelf, and he
              stands 8px over its foot from 64px up. A game's round card
              has already spent that height, so there the room keeps
              84px of its own and the step scrolls: with none, he stood
              on the Index and its delta. */}
          <div
            data-coach-room
            data-line-in-room={lineInRoom || undefined}
            className={`relative ${round ? "mt-3" : "mt-5"} w-full [@media(max-height:600px)]:mt-3 ${
              lineInRoom
                ? "min-h-[300px] flex-1"
                : spreads
                  ? `min-h-[140px] flex-1 ${round ? "[@media(max-height:600px)]:min-h-[84px]" : "[@media(max-height:600px)]:min-h-0"}`
                  : "h-[240px]"
            }`}
          >
            <div className="absolute inset-0 [container-type:size]">
            {/* With his line in his room, he gives it two lines of space
                (78) and 12px to his head: 88 to 270 from 100cqh less
                110. */}
            <div
              className={`absolute bottom-5 left-1/2 -translate-x-1/2 [container-type:size] ${
                lineInRoom
                  ? "size-[clamp(88px,calc(100cqh_-_110px),270px)]"
                  : "size-[clamp(88px,calc(100cqh_-_40px),200px)] [@media(max-height:600px)]:bottom-2 [@media(max-height:600px)]:size-[clamp(64px,calc(100cqh_-_12px),200px)]"
              }`}
            >
              {celebrating ? (
                /* The still, not the clip: the celebrate clip's alpha
                   leaves a white matte over his head on anything but
                   the plain light ground. */
                <DemosArt
                  key="celebrate"
                  pose="celebrate"
                  size={lineInRoom ? 270 : 200}
                  fit
                  grounded
                  idle={false}
                  greetAfterMs={0}
                  className="fade-in"
                />
              ) : (
                <DemosArt
                  key={waiting ? "speaking-wait" : "speaking"}
                  pose="speaking"
                  size={lineInRoom ? 270 : 200}
                  fit
                  grounded
                  greetAfterMs={timed && !celebrate && !waiting ? bubbleAt + SAID_AFTER_MS : undefined}
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
            {lineInRoom &&
              bubble(
                "down",
                "absolute inset-x-5 bottom-[calc(20px_+_clamp(88px,calc(100cqh_-_110px),270px)_+_12px)] text-left"
              )}
            </div>
          </div>
          {!lineInRoom && bubble("up", "mt-3 w-full text-left")}
          {coach && (
            <p
              className={`mt-2 text-center text-caption text-stone-400 ${waiting ? "invisible" : timed ? "arrive" : ""}`}
              style={timed && !waiting ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined}
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
            <PauseBar pauses={m.pauses} durationS={m.durationS} marks={pauseMarks} />
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
              /* One line where it fits. Under 360px a tile holds 69px
                 and "target 60 to 90s" is 95: it ran out of the card's
                 right edge, so there it takes two (#450). */
              note={<span className="whitespace-nowrap max-[359px]:whitespace-normal">{lengthNote}</span>}
            />
          </div>
          {/* A game round's score step gives this line to the round (M5):
              the trait it moved is said here, under the numbers it read. */}
          {round && gainName && gain && (
            <p className="mt-2.5 text-caption font-semibold text-stone-500">
              {gainName} leveled {gain.levels === 2 ? "twice" : "up"}
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
              take={take}
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
              <SwapFrom />
              {coach.supply.original}
            </span>
            {/* The arrow travels with what it points at (#429). */}
            <span className="flex min-w-0 items-center gap-x-3">
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
              <span className="font-semibold">
                <SwapTo />
                {coach.supply.upgrade}
              </span>
            </span>
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
          screen is a claim about these words, so you should be able to
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
          {/* Every word a tap (#411): the sheet says when it was said and
              what to say instead. */}
          <InteractiveTranscript
            transcript={result.transcript}
            words={result.words}
            fillers={m.fillers}
            onPlay={hasPlayer ? onPlay : undefined}
            repId={result.repId ?? null}
            doorToWords={!live}
          />
        </section>
      )}
    </>
  );
}

/**
 * "▲ 3 since last time", or the first recording's floor line. A boss
 * compares with last week's boss (the games plan, item 16): the server
 * sends that Index as `previousIndex`, and none on a first boss.
 */
function Delta({
  delta,
  baseline,
  boss = false,
  small = false,
  className = "",
}: {
  delta: number | null;
  baseline: boolean;
  boss?: boolean;
  small?: boolean;
  className?: string;
}) {
  const size = small ? "text-caption font-semibold" : "font-display text-body font-bold";
  if (delta !== null && delta !== 0) {
    return (
      <p className={`${size} ${delta > 0 ? "text-sage-700" : "text-rust"} ${className}`}>
        <TrendMark up={delta > 0} /> {Math.abs(delta)} {boss ? "on last week's boss" : "since last time"}
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
      {/* One line, except under 360px: "HELD PAUSES" at the 11px floor
          (#450) is 82px and a tile there holds 68, so it takes two lines,
          and all three labels keep two lines' room so the numbers under
          them stay on one line across the card. */}
      <div className="label-micro whitespace-nowrap max-[359px]:min-h-[2lh] max-[359px]:whitespace-normal">{label}</div>
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

/** A phone under 600pt tall: the glance's Demos steps off (#427). */
const SHORT_ROOM = "(max-height: 599px)";

function useShortRoom(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(SHORT_ROOM);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(SHORT_ROOM).matches,
    () => false
  );
}

/**
 * The glance (DECISIONS #427, its review): the results' one screen. The
 * score as one centred column (the stars, the 72px Index, its delta with
 * its words, the earned line when something was earned), then Demos with
 * his one measured line over his head at his introduction's 20px: the
 * moment that plays and the cue for next time, arriving whole once the
 * stars have landed. The spare height is two bands of at most 64 (score
 * to his line, his feet to the door) and Demos takes the rest, up to 220;
 * at a moment (a best, the first recording, a lesson's ending, a ladder
 * rung) he takes his share first. Nothing on it is the coach's text, so
 * nothing on it needs the caption.
 */
function Glance({
  view,
  metrics: m,
  ethosIndex,
  scorable,
  delta,
  baseline,
  boss,
  live,
  waiting,
  timed,
  counting,
  landAfter,
  lead,
  bubbleAt,
  celebrate,
  celebrating,
  starSize,
  take,
  cappedNote,
  ask,
  under,
  short,
  tall,
  moment,
}: {
  view: GlanceView;
  metrics: RepMetrics;
  ethosIndex: number | null;
  scorable: boolean;
  delta: number | null;
  baseline: boolean;
  boss: boolean;
  live: boolean;
  waiting: boolean;
  timed: boolean;
  counting: boolean;
  landAfter: number;
  lead: number;
  bubbleAt: number;
  celebrate: boolean;
  celebrating: boolean;
  starSize: number;
  take: TakeAudio | null;
  cappedNote: ReactNode;
  /** The reminder ask (#430), in the cue's slot. */
  ask: ReactNode;
  under: ReactNode;
  short: boolean;
  /** A phone 700pt or taller: a tester's question fits under Demos in his room. */
  tall: boolean;
  /** A moment (a best, the first recording, a lesson's ending, a rung): Demos takes his share first. */
  moment: boolean;
}) {
  const chip = view.moment ? (
    take?.playable ? (
      <MomentChip moment={view.moment} take={take} marker="glance" />
    ) : (
      /* Nothing can play it (a lost clip): the time as text, never a dead button (#424). */
      <span data-glance-chip className="font-semibold tabular-nums">
        {view.moment.clock}
      </span>
    )
  ) : null;
  /* The clause before the chip is bound to it ("first ▶0:02", "1
     searching at ▶0:20"), so the time never wraps away from what it
     times (the review: "4 fillers, first / at ▶0:02 ."): from the last
     comma when that is four words or fewer, else the last word. */
  const parts: ReactNode[] = [];
  view.parts.forEach((p, i) => {
    if (p.kind === "moment") return;
    const next = view.parts[i + 1];
    if (next?.kind !== "moment") {
      parts.push(<Fragment key={i}>{p.text}</Fragment>);
      return;
    }
    const text = p.text.trimEnd();
    const comma = text.lastIndexOf(", ");
    const clause = comma >= 0 ? text.slice(comma + 2) : null;
    const cut = clause !== null && clause.split(" ").length <= 4 ? comma + 2 : text.lastIndexOf(" ") + 1;
    const head = text.slice(0, cut);
    const tail = text.slice(cut).replace(/ /g, "\u00a0");
    parts.push(
      <Fragment key={i}>
        {head}
        <span className="whitespace-nowrap">
          {tail}
          {tail ? "\u00a0" : ""}
          {chip}
        </span>
      </Fragment>
    );
  });
  if (view.parts[0]?.kind === "moment") parts.unshift(<Fragment key="m">{chip}</Fragment>);
  const spoken = (
    <>
      <p data-glance-line className="text-balance">
        {parts}
      </p>
      {ask ??
        (view.cue && (
          <p data-glance-cue className="mt-0.5 text-balance text-detail leading-[24px] font-normal text-stone-500">
            {view.cue}
          </p>
        ))}
    </>
  );
  const arrival = waiting ? "invisible" : timed ? "arrive" : "";
  const arrivalStyle = timed && !waiting ? ({ animationDelay: `${bubbleAt}ms` } as CSSProperties) : undefined;
  const burst = celebrating ? (
    <span aria-hidden className="earned-burst">
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  ) : null;
  const greet = timed && !celebrate && !waiting ? bubbleAt + SAID_AFTER_MS : undefined;
  const demos = (size: number, fit: boolean) =>
    celebrating ? (
      /* The still, not the clip: the celebrate clip's alpha leaves a
         white matte over his head on anything but the plain ground. */
      <DemosArt key="celebrate" pose="celebrate" size={size} fit={fit} grounded={fit} idle={false} greetAfterMs={0} className="fade-in" />
    ) : (
      <DemosArt
        key={waiting ? "speaking-wait" : "speaking"}
        pose="speaking"
        size={size}
        fit={fit}
        grounded={fit}
        idle={fit ? undefined : false}
        greetAfterMs={greet}
      />
    );
  const stars = (n: number, after: number) => (
    <span className={`[&>span]:gap-3! ${waiting ? "invisible" : ""}`}>
      <Stars key={waiting ? "wait" : "land"} n={n as 1 | 2 | 3} size={starSize} arch land={live && !waiting} landAfterMs={after} />
    </span>
  );

  /* Demos in his room, his line over his head: everywhere but a phone
     under 600pt, and a tester's glance on one under 700pt, where he
     stands beside his line at 112 so the question fits. */
  const beside = !short && !!under && !tall;
  const plain = short;
  return (
    <div data-glance className="flex w-full flex-1 flex-col">
      {/* Up to 24pt over the stars, so the header's back to the stars
          stays near 48 under a lesson's bar and under 64 without one (the
          review: the old 32pt spacer left a 70pt band under the header). */}
      {!plain && !beside && <div aria-hidden className="max-h-6 flex-1 basis-0" />}
      <div className="mt-5 flex flex-col items-center text-center [@media(max-height:700px)]:mt-3">
        {ethosIndex !== null ? (
          <>
            {stars(m.stars, landAfter)}
            <div
              className={`mt-4 flex items-baseline justify-center gap-1 [@media(max-height:700px)]:mt-2 ${
                counting ? "" : "invisible"
              }`}
            >
              <span className="sr-only">Ethos</span>
              <span data-score className="font-display text-num-xl tabular-nums">
                {counting ? <CountUp value={ethosIndex} /> : ethosIndex}
              </span>
              <span className="text-body font-normal text-stone-500">/1000</span>
            </div>
            {/* "▲ 3 since last time", the words on the screen (the review:
                a bare "▲ 3" said nothing about what it was against). */}
            <Delta delta={delta} baseline={baseline} boss={boss} className={`mt-1 ${counting ? "" : "invisible"}`} />
          </>
        ) : !scorable ? (
          <>
            {/* The one star a take too short to score still earns, named
                where it stands (the review: a gold star over "Not enough
                to score." was an earned glyph with no label). */}
            <span className="[&>span]:gap-3!">
              <Stars n={1} size={starSize} arch />
            </span>
            <p data-unscored-star className="mt-1 text-caption text-stone-500">
              1 star for showing up
            </p>
            <h2 className="font-display mt-3 text-title">Not scored.</h2>
          </>
        ) : (
          <>
            {stars(m.stars, lead)}
            <div className="mt-4 flex items-baseline justify-center gap-1.5 [@media(max-height:700px)]:mt-2">
              <span className="font-display text-num-xl tabular-nums">{m.fillerCount}</span>
              <span className="text-body font-normal text-stone-500">filler{m.fillerCount === 1 ? "" : "s"}</span>
            </div>
            {cappedNote && <div className="mt-1">{cappedNote}</div>}
          </>
        )}
        {view.earned && (
          <p
            data-earned
            className={`mt-1 text-body font-semibold ${view.earned.tone === "earned" ? "text-sage-700" : "text-ink"} ${
              counting || ethosIndex === null ? "" : "invisible"
            }`}
          >
            {view.earned.text}
            {view.earned.delta ? (
              <span className={view.earned.delta > 0 ? "text-sage-700" : "text-rust"}>
                {" "}
                <TrendMark up={view.earned.delta > 0} /> {Math.abs(view.earned.delta)}
              </span>
            ) : null}
          </p>
        )}
      </div>

      {plain ? (
        /* Under 600pt: no room for him; his line stays, plain, the chip in it. */
        <div
          className={`mt-3 flex flex-1 flex-col justify-center text-left font-body text-detail leading-[24px] font-normal text-ink ${arrival}`}
          style={arrivalStyle}
        >
          <div className="text-center">{spoken}</div>
          {under}
        </div>
      ) : beside ? (
        /* A tester's glance on a phone under 700pt: Demos beside his line
           at 112 (the Log's layout), so the match question fits under it. */
        <div className="mt-5 flex w-full flex-col [@media(max-height:700px)]:mt-3">
          <div className="flex w-full items-start gap-3 text-left">
            <div className="relative shrink-0">
              {demos(112, false)}
              {burst}
            </div>
            <div className={`min-w-0 flex-1 ${arrival}`} style={arrivalStyle}>
              <SpeechBubble tail="left">{spoken}</SpeechBubble>
            </div>
          </div>
          {under}
        </div>
      ) : (
        <>
          {/* The band from the score to his line: 12 to 56, so with the
              delta's line box it stays under rule 7's 64. */}
          <div aria-hidden data-glance-band className="min-h-4 max-h-14 flex-1 basis-0 [@media(max-height:700px)]:min-h-3" />
          {/* His line over his head, its tail at his face, at his
              introduction's 20px (the review: at 17 regular it was the
              faintest thing on the screen and the only one that traces to
              a moment). */}
          <div data-coach-room className={`shrink-0 ${arrival}`} style={arrivalStyle}>
            <SpeechBubble tail="down" voice="lead" className="text-center">
              {spoken}
            </SpeechBubble>
          </div>
          {/* Demos takes what the bands leave, from 88: at a moment his
              share comes first, on an ordinary practice the bands' (about
              200 at 390x844). Up to 240 beside the number; up to 270
              (#400's ceiling) on a take too short to score, where there is
              no number for him to outweigh and he is the message. */}
          <div
            className={`relative mt-3 min-h-[88px] basis-0 ${scorable ? "max-h-[240px]" : "max-h-[270px]"} ${
              moment ? "grow-[4]" : "grow"
            }`}
          >
            <div className="absolute inset-0 [container-type:size]">
              <div
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 [container-type:size] ${
                  scorable ? "size-[min(100cqh,240px)]" : "size-[min(100cqh,270px)]"
                }`}
              >
                {demos(scorable ? 240 : 270, true)}
                {burst}
              </div>
            </div>
          </div>
          {under}
          {/* His feet to the door: up to 48, the door's own 12 on top of it. */}
          <div aria-hidden data-glance-band className="max-h-12 flex-1 basis-0" />
        </>
      )}
    </div>
  );
}
