"use client";

import Image from "next/image";
import { useEffect, useRef, type MutableRefObject } from "react";
import { prefersReducedMotion } from "@/lib/prefs";

/**
 * Demos, hearing you, in the 3D art (review of the feedback round,
 * 25 Sep).
 *
 * The recording phase used to draw him in vector (`DemosListening`,
 * #243), which was the old flat Demos: between an idle screen and a
 * scoring wait that both show the plush render, the one screen under
 * the Stop tap showed clip art, the exact break "animal needs to look
 * better" named. This is the render itself, alive off the same level
 * the meter reads: he leans in and swells a touch while there is
 * something to hear, and settles half a second after it stops.
 *
 * A raster cannot lift an ear, so the life is the whole figure's, and
 * it is transform-only, written to the DOM on an animation frame
 * (#219's pattern: the rep screen never re-renders for audio). Reduced
 * motion keeps him still; the meter beside him is the information.
 */
export function DemosHears({
  level,
  size = 116,
}: {
  /** 0 to 1, written by the recorder every audio frame. */
  level: MutableRefObject<number>;
  size?: number;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    let eased = 0;
    let lean = 0;
    let quietFor = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;
      const raw = Math.max(0, Math.min(1, level.current));
      // Fast up, slow down: catch the start of a word, let go of the end.
      eased += (raw - eased) * (raw > eased ? 0.35 : 0.08);
      quietFor = eased > 0.14 ? 0 : quietFor + dt;
      lean += ((eased > 0.14 || quietFor < 520 ? 1 : 0) - lean) * 0.09;
      const breath = Math.sin(now / 1400) * 0.8;
      if (el.current) {
        el.current.style.transform = `translateY(${breath - lean * 3}px) rotate(${lean * -2.5}deg) scale(${1 + eased * 0.06})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  return (
    <div
      ref={el}
      aria-hidden
      className="demos-hears"
      style={{ width: size, transformOrigin: "50% 100%" }}
    >
      <Image
        src="/demos-onboard-listening.webp"
        alt=""
        width={size * 2}
        height={size * 2}
        priority
        className="demos block h-auto w-full"
      />
    </div>
  );
}
