"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { prefersReducedMotion } from "@/lib/prefs";
import { playCelebration } from "@/lib/sfx";

/**
 * The one celebration moment. Duolingo earns its streak screen by
 * making it brief and specific; ours stays inside brand rules — amber
 * only, one line of copy, no confetti storm, and it never blocks: it
 * fades and the results are underneath.
 *
 * Demos celebrates here and nowhere else in the loop (vision.md:
 * moments, never furniture).
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
    <div
      onClick={onDone}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ground ${
        calm ? "" : "transition-opacity duration-500"
      } ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <Image
        src="/demos-celebrate.webp"
        alt=""
        width={200}
        height={200}
        priority
        className="demos w-[200px]"
      />
      <div className="font-display mt-4 text-[64px] font-bold leading-none text-amber-500">
        {streak}
      </div>
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
    </div>
  );
}
