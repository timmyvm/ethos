"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { DURATION } from "@/lib/motion";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { CHIME, MILESTONE_CHIME, playCelebration } from "@/lib/sfx";

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
  onDone,
}: {
  streak: number;
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
      <StreakRoll streak={streak} milestone={milestone} calm={calm} />
      <div className="mt-1 text-[15px] font-semibold">
        day{streak === 1 ? "" : "s"} in a row
      </div>
      <p className="mt-2 max-w-[260px] text-center text-[13px] text-stone-500">
        {streak === 1
          ? "Day one is the hard one. It's done."
          : milestone
            ? `${streak} straight. That's not motivation any more, that's a habit.`
            : "Same time tomorrow."}
      </p>
    </Overlay>
  );
}

/** The 64px line the number lives on; the roll is exactly one of these. */
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
      className="font-display mt-4 overflow-hidden text-[64px] leading-none text-sage-500 tabular-nums"
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
