"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconBubble, IconGauge, IconPauseSm, IconPlay } from "@/components/Icon";
import { LANDED_MARK, SEARCHING_MARK, SPEECH_MARK } from "@/components/PauseBar";
import { RollNumber } from "@/components/premium/RollNumber";
import type { Pause, Word } from "@/lib/metrics";
import { DURATION } from "@/lib/motion";
import { prefersReducedMotion } from "@/lib/prefs";
import { INTERVIEW_WINDOW, type CutInFact, type GameRound } from "@/lib/round";
import type { RoundReveal } from "@/lib/round-copy";
import { SPRING, springEasing, springMs } from "@/lib/spring";

/**
 * "The round" (proposal-feel F3, the games plan item 4): the game's own
 * reveal on a game's score step, above the stars. One `.card`, compact,
 * no card inside it, no terracotta (the shelf keeps the one tap) and no
 * second Demos: Q&A's mark is the bubble, its tile's own glyph.
 *
 * - Q&A: the take as a strip in the pause map's marks, an ink rule where
 *   Demos cut in, and the silence after him drawn to scale, sage only
 *   when it was held; then the seconds and what they were.
 * - Speed rush: the dial in the rec ring's geometry, swept in ink to your
 *   last word, the spare arc sage when you landed it.
 * - Interview: 0 to 1:30 as a bar with the window as a sky band (a
 *   picture tone, never earned) and a marker at your last word.
 *
 * It plays once, in under 1.1s: the strip or the dial sweeps (600ms), the
 * bubble pops on the thrown spring as the sweep passes him, the silence
 * fills, the number rolls and turns sage on a win (the round's one sound
 * rides that moment, `onLanded`), and the note and the XP line fade in at
 * 900ms. Then the stars and the Index land as before. `hold` keeps it at
 * its first frame while the streak celebration is up; `played` and
 * reduced motion (lite graphics included) show the end state.
 */

/** When the sweep ends and the number rolls. */
const SWEEP_MS = DURATION.celebrate;
/** When the note, the line and the XP land. */
const NOTE_MS = 900;
/** The whole reveal: the stars wait this long (RepResult `leadMs`). */
export const ROUND_REVEAL_MS = 1100;

export function RoundCard({
  round,
  reveal,
  xp,
  words,
  pauses,
  audioUrl,
  hold = false,
  played = false,
  onLanded,
}: {
  round: GameRound;
  reveal: RoundReveal;
  xp: { amount: string; note: string | null };
  /** Whisper's words, for where the strip draws speech. */
  words?: Word[] | null;
  /** The take's judged pauses, the strip's fallback when there are no words. */
  pauses: Pause[];
  /** Your own recording on this phone: "Hear it" plays the cut-in from it. */
  audioUrl?: string | null;
  /** Wait at the first frame (the streak celebration is up). */
  hold?: boolean;
  /** Revealed once already: draw the end state. */
  played?: boolean;
  /** The number landed (on a win: the round's one sound). Once, never on `played`. */
  onLanded?: () => void;
}) {
  /* Read once: a reveal that has started runs to its end whatever the
     props do next (its own landing marks it played). */
  const [playedBefore] = useState(played);
  const [still] = useState(() => playedBefore || prefersReducedMotion());
  /** Where the reveal is: 0 waiting, 1 sweeping, 2 the number rolled, 3 the note is in. */
  const [stage, setStage] = useState(still ? 3 : 0);
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;
  const firedRef = useRef(false);
  /* Started once the hold lifts, and never held again. */
  const [go, setGo] = useState(!hold);
  useEffect(() => {
    if (!hold) setGo(true);
  }, [hold]);

  useEffect(() => {
    if (!go || playedBefore) return;
    const land = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      landedRef.current?.();
    };
    if (still) {
      land();
      return;
    }
    setStage(1);
    const roll = setTimeout(() => setStage(2), SWEEP_MS);
    // The roll is the snappy spring; the number lands with it.
    const landed = setTimeout(land, SWEEP_MS + springMs(SPRING.snappy));
    const note = setTimeout(() => setStage(3), NOTE_MS);
    return () => {
      clearTimeout(roll);
      clearTimeout(landed);
      clearTimeout(note);
    };
  }, [go, playedBefore, still]);

  const rolled = stage >= 2;
  const sage = reveal.win && rolled;
  const late = stage >= 3 ? "" : "opacity-0";
  const fade = still ? "" : "transition-opacity duration-(--duration-base) ease-(--ease-out)";

  const number = reveal.number && (
    <span
      className={`font-display text-num-l leading-none tabular-nums transition-colors duration-(--duration-base) ${
        sage ? "text-sage-700" : "text-ink"
      }`}
    >
      <RollNumber
        text={rolled ? reveal.number : zeroLike(reveal.number)}
        value={rolled ? reveal.value : 0}
        instant={still}
      />
    </span>
  );
  const note = reveal.note && (
    <span className={`text-body text-stone-500 ${fade} ${late}`}>{reveal.note}</span>
  );
  const line = reveal.line && (
    <p
      className={`${reveal.number ? "text-caption" : "text-body"} text-pretty text-stone-500 ${fade} ${
        reveal.number ? late : ""
      }`}
    >
      {reveal.line}
    </p>
  );
  /* The XP line closes the card (F3): what was paid, sage because it was
     earned, beside the number, and what multiplied it in stone, beside
     the line under it. Two rows that size themselves, so a long note
     never squeezes the number off its line; with no multiplier the line
     takes the full width. "cut-in" never breaks at its hyphen. */
  const xpAmount = (
    <p className={`shrink-0 text-right font-display text-row font-bold text-sage-700 ${fade} ${late}`}>
      {xp.amount}
    </p>
  );
  const xpNote = xp.note ? (
    <p className={`max-w-[170px] shrink-0 text-right text-caption text-balance text-stone-500 ${fade} ${late}`}>
      {xp.note.replace(/-/g, "\u2011")}
    </p>
  ) : null;
  const readout = (
    <>
      <div className="flex items-end justify-between gap-3">
        {reveal.number ? (
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            {number}
            {note}
          </div>
        ) : (
          <div className="min-w-0">{line}</div>
        )}
        {xpAmount}
      </div>
      {((reveal.number && line) || xpNote) && (
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">{reveal.number ? line : null}</div>
          {xpNote}
        </div>
      )}
    </>
  );

  const qaCut = round.game === "qa" ? firstHeard(round.cutIns) : null;
  const hear =
    audioUrl && qaCut && qaCut.at !== null ? (
      <HearIt
        src={audioUrl}
        from={Math.max(0, qaCut.at - 1)}
        to={qaCut.at + (qaCut.gap ?? 0) + 2}
      />
    ) : null;

  return (
    <section aria-label="The round" className="card w-full p-4 text-left">
      {round.game === "rush" ? (
        <div className="flex items-center gap-4">
          <Dial
            cap={round.cap}
            last={round.stoppedBy === "clock" || round.lastWord === null ? round.cap : round.lastWord}
            win={reveal.win}
            stage={stage}
            still={still}
          />
          {/* Beside the dial the column is narrow: the XP closes it as
              one line under the rest instead of a column of its own. */}
          <div className="min-w-0 flex-1">
            <div className="eyebrow">{reveal.eyebrow}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              {number}
              {note}
            </div>
            {line && <div className="mt-1">{line}</div>}
            <p className={`mt-1.5 text-caption ${fade} ${late}`}>
              <span className="font-display text-row font-bold text-sage-700">{xp.amount}</span>
              {xp.note && <span className="ml-2 text-stone-500">{xp.note}</span>}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-5 items-center justify-between gap-3">
            <div className="eyebrow">{reveal.eyebrow}</div>
            {hear}
          </div>
          {round.game === "qa" ? (
            <Strip
              durationS={round.durationS}
              facts={round.cutIns}
              words={words}
              pauses={pauses}
              stage={stage}
              still={still}
            />
          ) : (
            <Window
              cap={round.cap}
              last={round.lastWord}
              win={reveal.win}
              cutIns={round.cutIns}
              stage={stage}
              still={still}
            />
          )}
          <div className="mt-2">{readout}</div>
        </>
      )}
    </section>
  );
}

/** The first glyph-for-glyph zero of a number, so the roll turns every digit. */
function zeroLike(text: string): string {
  return text.replace(/\d/g, "0").replace(/^</, "");
}

function firstHeard(facts: CutInFact[]): CutInFact | null {
  return facts.find((f) => f.at !== null) ?? null;
}

/**
 * The sweep, by transforms only: a window that slides in from the left
 * over content that slides the same distance the other way, so the take
 * stays still and its edge walks left to right on the clock of the take.
 */
function useSweep(stage: number, still: boolean) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i || still) return;
    if (stage === 0) {
      o.style.transform = "translateX(-100%)";
      i.style.transform = "translateX(100%)";
      return;
    }
    if (stage !== 1) return;
    const opts = { duration: SWEEP_MS, easing: "linear", fill: "forwards" as const };
    const a = o.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], opts);
    const b = i.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], opts);
    a.onfinish = () => {
      o.style.transform = "";
      i.style.transform = "";
      a.cancel();
      b.cancel();
    };
  }, [stage, still]);
  return { outer, inner };
}

/** A mark that pops on the thrown spring when the sweep reaches it. */
function Pop({ at, stage, still, children }: { at: number; stage: number; still: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || still || stage !== 1) return;
    el.style.transform = "scale(0)";
    const t = setTimeout(() => {
      el.style.transform = "";
      el.animate([{ transform: "scale(0.3)" }, { transform: "scale(1)" }], {
        duration: springMs(SPRING.thrown),
        easing: springEasing(SPRING.thrown),
      });
    }, at * SWEEP_MS);
    return () => clearTimeout(t);
  }, [at, stage, still]);
  return (
    <span ref={ref} className="inline-flex origin-bottom">
      {children}
    </span>
  );
}

/** How many speech ticks the strip draws across the take. */
const TICKS = 46;

/**
 * Q&A's strip: the take in the pause map's marks, on the take's own time
 * axis. Speech ticks where a word was being said, the cut-in as a 2px ink
 * rule under the bubble, and the silence after it to scale.
 */
function Strip({
  durationS,
  facts,
  words,
  pauses,
  stage,
  still,
}: {
  durationS: number;
  facts: CutInFact[];
  words?: Word[] | null;
  pauses: Pause[];
  stage: number;
  still: boolean;
}) {
  const { outer, inner } = useSweep(stage, still);
  const d = Math.max(1, durationS);
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / d) * 100))}%`;
  const fired = facts.filter((f) => f.at !== null);
  const silences = fired.filter((f) => f.gapFrom !== null && f.gapTo !== null && (f.gap ?? 0) > 0);
  const speaking = (t: number, half: number) => {
    if (silences.some((f) => t >= (f.gapFrom as number) && t <= (f.gapTo as number))) return false;
    if (words && words.length) return words.some((w) => w.end >= t - half && w.start <= t + half);
    return !pauses.some((p) => p.kind !== "beat" && t >= p.t && t <= p.t + p.len);
  };
  const half = d / TICKS / 2;
  const ticks = Array.from({ length: TICKS }, (_, i) => (i + 0.5) * (d / TICKS)).map((t, i) => ({
    t,
    on: speaking(t, half),
    h: 7 + Math.round(Math.abs(Math.sin(i * 2.7)) * 10),
  }));
  const label = fired
    .map((f) => `Demos cut in at ${Math.floor(f.at as number)} seconds, then ${f.gap ?? 0} seconds of silence`)
    .join(". ");

  return (
    <div ref={outer} role="img" aria-label={label || "The take"} className="relative mt-2 h-9 overflow-hidden">
      <div ref={inner} className="absolute inset-0">
        {ticks.map(
          (k, i) =>
            k.on && (
              <span
                key={i}
                aria-hidden
                className={`absolute w-[2px] ${SPEECH_MARK}`}
                style={{ left: pct(k.t), height: k.h, top: 25 - k.h / 2 }}
              />
            )
        )}
        {silences.map((f, i) => (
          <span
            key={`s${i}`}
            aria-hidden
            className={`absolute h-3 min-w-[8px] ${f.verdict === "held" ? LANDED_MARK : SEARCHING_MARK} ${
              still || stage === 0 ? "" : "fill"
            }`}
            style={{
              left: pct(f.gapFrom as number),
              width: `calc(${pct(f.gap as number)} + 1px)`,
              top: 19,
              animationDelay: still ? undefined : `${Math.round(((f.gapFrom as number) / d) * SWEEP_MS)}ms`,
            }}
          />
        ))}
        {fired.map((f, i) => (
          <span
            key={`c${i}`}
            aria-hidden
            className="absolute inset-y-0 flex -translate-x-1/2 flex-col items-center text-ink"
            style={{ left: pct(f.at as number) }}
          >
            <Pop at={(f.at as number) / d} stage={stage} still={still}>
              <IconBubble size={14} />
            </Pop>
            <span className="mt-0.5 w-[2px] flex-1 bg-ink" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The dial: 88px in the rec ring's geometry, 4px on sand. */
function Dial({
  cap,
  last,
  win,
  stage,
  still,
}: {
  cap: number;
  last: number;
  win: boolean;
  stage: number;
  still: boolean;
}) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const used = Math.min(1, Math.max(0, last / Math.max(1, cap)));
  const ink = useRef<SVGCircleElement | null>(null);
  const spare = useRef<SVGCircleElement | null>(null);
  useLayoutEffect(() => {
    const a = ink.current;
    const b = spare.current;
    if (!a || still) return;
    if (stage === 0) {
      a.style.strokeDashoffset = String(C);
      if (b) b.style.opacity = "0";
      return;
    }
    if (stage !== 1) return;
    a.style.strokeDashoffset = "";
    a.animate([{ strokeDashoffset: C }, { strokeDashoffset: C * (1 - used) }], {
      duration: SWEEP_MS,
      easing: "linear",
    });
    if (!b) return;
    b.style.opacity = "";
    // The spare arc fills once the sweep has stopped short of it.
    b.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: SWEEP_MS / (SWEEP_MS + DURATION.base), easing: "ease-out" },
        { opacity: 1, offset: 1 },
      ],
      { duration: SWEEP_MS + DURATION.base, easing: "linear" }
    );
  }, [stage, still, C, used]);
  /* The game's own glyph (its Practice tile's gauge) in the middle, so
     the ring reads as the round's clock at a glance. */
  return (
    <div aria-hidden className="relative size-[88px] shrink-0">
      <svg
        width={88}
        height={88}
        viewBox="0 0 88 88"
        className="-rotate-90"
      >
        <circle cx={44} cy={44} r={R} fill="none" strokeWidth={4} className="stroke-sand" />
        {/* The spare arc is sage only when it was landed; otherwise the
            time left stays the trough. */}
        {used < 1 && win && (
          <circle
            ref={spare}
            cx={44}
            cy={44}
            r={R}
            fill="none"
            strokeWidth={4}
            strokeDasharray={`${C * (1 - used)} ${C}`}
            strokeDashoffset={-C * used}
            className="stroke-sage-600"
          />
        )}
        <circle
          ref={ink}
          cx={44}
          cy={44}
          r={R}
          fill="none"
          strokeWidth={4}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - used)}
          className="stroke-ink"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-ink">
        <IconGauge size={26} />
      </span>
    </div>
  );
}

/** Interview's window: 0 to the clock, the window a sky band, your last word a marker. */
function Window({
  cap,
  last,
  win,
  cutIns,
  stage,
  still,
}: {
  cap: number;
  last: number | null;
  win: boolean;
  cutIns: CutInFact[];
  stage: number;
  still: boolean;
}) {
  const { outer, inner } = useSweep(stage, still);
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / Math.max(1, cap)) * 100))}%`;
  const [lo] = INTERVIEW_WINDOW;
  const followUp = cutIns.find((f) => f.at !== null);
  return (
    <div className="mt-2.5">
      <div ref={outer} className="relative h-6 overflow-hidden">
        <div ref={inner} className="absolute inset-0">
          <span aria-hidden className="absolute inset-x-0 top-2 h-2 bg-sand" />
          <span
            aria-hidden
            className="absolute top-2 right-0 h-2 bg-[var(--pop-sky)]"
            style={{ left: pct(lo) }}
          />
          {last !== null && (
            <span
              aria-hidden
              className={`absolute inset-y-0 w-[3px] -translate-x-1/2 ${win ? "bg-sage-600" : "bg-ink"}`}
              style={{ left: pct(last) }}
            />
          )}
          {followUp && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-stone-400"
              style={{ left: pct(followUp.at as number) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Hear it" (F3): your own recording from a second before he cut in to
 * two seconds after you came back. A quiet text button, never a fill.
 */
function HearIt({ src, from, to }: { src: string; from: number; to: number }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => {
      if (a.currentTime >= to) {
        a.pause();
        setPlaying(false);
      }
    };
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onEnd);
      a.pause();
    };
  }, [to]);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    a.currentTime = Math.max(0.001, from);
    setPlaying(true);
    a.play().catch(() => setPlaying(false));
  };
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        className="press -my-2.5 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-tap px-2 text-link text-stone-600"
      >
        {playing ? <IconPauseSm size={14} /> : <IconPlay size={14} />}
        Hear it
      </button>
    </>
  );
}
