"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import type { WeekDay } from "@/lib/home";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { CHIME, MILESTONE_CHIME, playCelebration } from "@/lib/sfx";
import { SPRING, springEasing, springMs } from "@/lib/spring";

/** Today's block fills this long after the flame lights (E03). */
const FILL_AFTER_MS = 240;

/**
 * The one celebration moment. Duolingo earns its streak screen by
 * making it brief and specific; ours stays inside brand rules — sage
 * only, one line of copy, no confetti storm, and it never blocks: it
 * fades and the results are underneath.
 *
 * Demos celebrates here and nowhere else in the loop (vision.md:
 * moments, never furniture).
 *
 * The number is the event (DECISIONS #226). It opens on yesterday's
 * count and rolls up to today's on the chime's landing note, with the
 * one haptic of the moment under it, so sound, motion and touch say
 * the same thing at the same instant: the streak just grew. Reduced
 * motion shows today's number and only fades.
 */
export function StreakCelebration({
  streak,
  week,
  onDone,
}: {
  streak: number;
  /** This week, Monday first (lib/home.ts `weekView`): the row under the count. */
  week?: WeekDay[] | null;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  // Read once: the reference must not change mid-celebration.
  const calm = useMemo(() => prefersReducedMotion(), []);

  const milestone = streak === 7 || streak === 14 || streak === 30;

  /*
   * The one sound in the product plays here, because this is the one
   * celebration (#34, #138). Mount-only: a re-render must not re-ring
   * it. Reduced motion quiets the animation, not the chime — the sound
   * has its own switch in settings.
   */
  useEffect(() => {
    playCelebration(milestone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hold = calm ? 1200 : 1800;
    const a = setTimeout(() => setLeaving(true), hold);
    const b = setTimeout(onDone, hold + (calm ? 100 : 500));
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone, calm]);

  return (
    <Overlay
      label={`${streak} day${streak === 1 ? "" : "s"} in a row`}
      onClose={onDone}
      variant="full"
      className={`flex h-full w-full flex-col items-center justify-center bg-ground ${
        calm ? "" : "transition-opacity"
      } ${leaving ? "opacity-0" : "opacity-100"}`}
      style={calm ? undefined : { transitionDuration: `${DURATION.celebrate}ms` }}
    >
      <Image
        src="/demos-celebrate.webp"
        alt=""
        width={200}
        height={200}
        priority
        className="demos w-[200px]"
      />
      <LitFlame calm={calm} />
      <StreakRoll streak={streak} milestone={milestone} calm={calm} />
      <div className="mt-1 text-body font-semibold">
        day{streak === 1 ? "" : "s"} in a row
      </div>
      {week && week.length === 7 && <WeekRow days={week} calm={calm} />}
      <p
        className={`max-w-[260px] text-center text-link font-normal text-stone-500 ${
          week && week.length === 7 ? "mt-4" : "mt-2"
        }`}
      >
        {streak === 1
          ? "Day one is the hard one. It's done."
          : milestone
            ? `${streak} straight. That's not motivation any more, that's a habit.`
            : "Same time tomorrow."}
      </p>
    </Overlay>
  );
}

/**
 * The 64px line the number lives on; the roll is exactly one of these.
 * The number itself is the num-hero step (56), so the line keeps 8px of
 * air and the roll stays one whole line.
 */
const LINE = 64;

/**
 * Yesterday's count, then today's, in a one-line window: the column
 * slides up one line at the moment the chime lands. `translateY` on
 * the column and nothing else moves (DESIGN-RULES, motion). The dialog
 * already names the final count for assistive tech, so the rolling
 * digits are decoration to a screen reader and hidden from one.
 */
function StreakRoll({
  streak,
  milestone,
  calm,
}: {
  streak: number;
  milestone: boolean;
  calm: boolean;
}) {
  const [rolled, setRolled] = useState(calm);

  useEffect(() => {
    if (calm) return;
    const notes = milestone ? MILESTONE_CHIME : CHIME;
    const landing = notes[notes.length - 1].at * 1000;
    const t = setTimeout(() => {
      setRolled(true);
      buzz(30);
    }, landing);
    return () => clearTimeout(t);
  }, [calm, milestone]);

  return (
    <div
      aria-hidden
      className="font-display mt-2 overflow-hidden text-num-hero leading-none text-sage-700 tabular-nums"
      style={{ height: LINE }}
    >
      <div
        className={`flex flex-col ${calm ? "" : "transition-transform dur-max ease-out"}`}
        style={{ transform: rolled ? `translateY(-${LINE}px)` : "none" }}
      >
        <span className="block" style={{ height: LINE }}>
          {rolled && calm ? streak : streak - 1}
        </span>
        <span className="block" style={{ height: LINE }}>
          {streak}
        </span>
      </div>
    </div>
  );
}

/**
 * The streak's own mark, lit (E03): the app's biggest earned moment drew
 * its streak without the flame every chip and badge wears. 64px of the
 * earned gold over the sage count, its 1px rim in light and none in dark
 * (`--earned-rim`, the star's), lighting on the snappy spring from 0.6
 * with a fade as the sheet arrives. Reduced motion: a 200ms fade.
 */
function LitFlame({ calm }: { calm: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      calm
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)" },
          ],
      calm
        ? { duration: DURATION.base, easing: EASE_OUT, fill: "backwards" }
        : { duration: springMs(SPRING.snappy), easing: springEasing(SPRING.snappy), fill: "backwards" }
    );
  }, [calm]);
  return (
    <svg
      ref={ref}
      aria-hidden
      width={64}
      height={64}
      viewBox="0 0 24 24"
      className="mt-2 origin-bottom"
      data-flame
    >
      {/* Streaks' flame (Icon.tsx), closed and filled: the outer flame in
          the gold with its rim, the core a lighter gold inside it. */}
      <path
        d="M12 3.5c.6 2.4 2 3.5 3.4 5 1.4 1.5 2.1 3 2.1 4.7a5.5 5.5 0 0 1-11 0c0-1.6.6-2.9 1.8-4 .3 1.4 1 2.2 1.9 2.6C9.6 9 10.6 6.4 12 3.5z"
        fill="var(--earned-gold)"
        stroke="var(--earned-rim)"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M12 18.6a2.4 2.4 0 0 1-2.4-2.4c0-1.3 1.1-2 2.4-3.9 1.3 1.9 2.4 2.6 2.4 3.9a2.4 2.4 0 0 1-2.4 2.4z"
        fill="#ffe08a"
      />
    </svg>
  );
}

/**
 * This week under the count (E03), in the Days spoken tile's grammar
 * (components/home/WeekTiles.tsx): the same 24px blocks at radius 6 on
 * the sand trough (`.home-day`), sage-600 for a day spoken, the 10/700
 * day letters, today's in ink. Today's block fills 240ms after the
 * flame lights; under reduced motion it is filled from the start.
 */
function WeekRow({ days, calm }: { days: WeekDay[]; calm: boolean }) {
  const today = useRef<HTMLSpanElement>(null);
  /* On a seekable clock (an animation, not a timer), so a frame strip
     shows the fill where it is: sand, then sage, from 240ms. */
  useEffect(() => {
    const el = today.current;
    if (calm || !el || !el.hasAttribute("data-on")) return;
    const sand = getComputedStyle(document.documentElement).getPropertyValue("--color-sand").trim();
    const sage = getComputedStyle(el).backgroundColor;
    if (!sand || !sage) return;
    el.animate([{ backgroundColor: sand }, { backgroundColor: sage }], {
      duration: DURATION.max,
      delay: FILL_AFTER_MS,
      easing: EASE_OUT,
      fill: "backwards",
    });
  }, [calm]);
  return (
    <div aria-hidden className="mt-5 grid w-[224px] grid-cols-7 gap-1">
      {days.map((d, i) => (
        <span key={i} className="flex flex-col items-center gap-1">
          {/* Today is always spoken here: this moment is the take that
              just landed, whether or not the read back has it yet. */}
          <span
            ref={d.today ? today : undefined}
            className="home-day w-full"
            data-on={d.on || d.today || undefined}
          />
          <span
            className={`font-display text-suffix ${d.today ? "font-extrabold text-ink" : "text-stone-400"}`}
          >
            {d.label}
          </span>
        </span>
      ))}
    </div>
  );
}
