"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { Says } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { prefersReducedMotion } from "@/lib/prefs";
import { animateSpring, SPRING, springEasing, springMs } from "@/lib/spring";

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
 *
 * HE CUTS IN (the games plan, item 1; F1). With `speaking` set he is the
 * one interrupting: he cross-fades in 120ms to his speaking pose (the
 * same 1024 canvas and floor line, mouth open, paw up), hops 8px up and
 * back on the thrown spring, and his line pops out of a bubble over his
 * head at 20px. When it clears, the bubble shrinks back into him on the
 * base spring and he fades back to listening. One Demos: he changes
 * pose, nobody new arrives. Reduced motion (and lite graphics): no hop,
 * the bubble fades in 200ms. The line is announced by the page, once,
 * so the bubble here is seen, not read.
 */
export function DemosHears({
  level,
  size = 116,
  fluid = false,
  speaking = null,
}: {
  /** 0 to 1, written by the recorder every audio frame. */
  level: MutableRefObject<number>;
  /** His width in px, or with `fluid`, the most he is drawn at. */
  size?: number;
  /** Take the parent's width (the live column's clamp, D51). */
  fluid?: boolean;
  /** The line he cuts in with; null while he listens. */
  speaking?: string | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  /* Read by the frame loop: while he talks he stops leaning in to you. */
  const talking = useRef(false);
  talking.current = speaking !== null;
  /* The line on screen, which outlives `speaking` by the bubble's exit. */
  const [said, setSaid] = useState<string | null>(speaking);
  const [leaving, setLeaving] = useState(false);

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
      const raw = talking.current ? 0 : Math.max(0, Math.min(1, level.current));
      // Fast up, slow down: catch the start of a word, let go of the end.
      eased += (raw - eased) * (raw > eased ? 0.35 : 0.08);
      quietFor = eased > 0.14 ? 0 : quietFor + dt;
      const listening = !talking.current && (eased > 0.14 || quietFor < 520);
      lean += ((listening ? 1 : 0) - lean) * 0.09;
      const breath = Math.sin(now / 1400) * 0.8;
      if (el.current) {
        el.current.style.transform = `translateY(${breath - lean * 3}px) rotate(${lean * -2.5}deg) scale(${1 + eased * 0.06})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  /* A new line: show it; a cleared one: let the bubble leave first. */
  useEffect(() => {
    if (speaking !== null) {
      setSaid(speaking);
      setLeaving(false);
    } else {
      setLeaving(true);
    }
  }, [speaking]);

  /* The hop: up on the snappy spring, caught near the top by the thrown
     one, which carries the rise's last speed over and lands him with
     its small overshoot (#388's hand-over). On a wrapper, because the
     frame loop above owns the inner element's transform. */
  useEffect(() => {
    const h = hop.current;
    if (!h || speaking === null || prefersReducedMotion()) return;
    let live = true;
    void animateSpring(h, { from: 0, to: -8, spring: SPRING.snappy });
    const t = setTimeout(() => {
      if (!live) return;
      const y = new DOMMatrixReadOnly(getComputedStyle(h).transform).m42;
      void animateSpring(h, { from: y, to: 0, spring: SPRING.thrown });
    }, 140);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [speaking]);

  /* The bubble pops out of him, and back in. */
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!b || said === null) return;
    const reduced = prefersReducedMotion();
    b.getAnimations().forEach((a) => a.cancel());
    if (!leaving) {
      if (reduced) {
        b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE_OUT });
        return;
      }
      b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.fast, easing: EASE_OUT });
      b.animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], {
        duration: springMs(SPRING.thrown),
        easing: springEasing(SPRING.thrown),
      });
      return;
    }
    const out = reduced
      ? b.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: DURATION.base,
          easing: EASE_OUT,
          fill: "forwards",
        })
      : b.animate(
          [
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(0.6)" },
          ],
          { duration: springMs(SPRING.base), easing: springEasing(SPRING.base), fill: "forwards" }
        );
    let live = true;
    void out.finished.then(
      () => {
        if (!live) return;
        setSaid(null);
        setLeaving(false);
      },
      () => {}
    );
    return () => {
      live = false;
    };
  }, [said, leaving]);

  const on = speaking !== null;
  return (
    <div ref={hop} className="relative" style={{ width: fluid ? "100%" : size }}>
      {said !== null && (
        /* Over his head, its tail on him, centred on the column. Wider
           than he is; it stands over the wave, never over Stop. */
        <div
          className="pointer-events-none absolute bottom-[calc(100%-2px)] left-1/2 z-10 -translate-x-1/2"
          aria-hidden
        >
          <div
            ref={bubble}
            className="w-max max-w-[min(280px,calc(100vw-40px))]"
            style={{ transformOrigin: "50% 100%" }}
          >
            <SpeechBubble tail="down" voice="lead" className="text-balance text-center">
              <Says text={said} ariaHidden />
            </SpeechBubble>
          </div>
        </div>
      )}
      <div
        ref={el}
        aria-hidden
        className="demos-hears relative"
        style={{ width: "100%", transformOrigin: "50% 100%" }}
      >
        <Image
          src="/demos-onboard-listening.webp"
          alt=""
          width={size * 2}
          height={size * 2}
          priority
          className={`demos block h-auto w-full transition-opacity dur-fast ease-out ${on ? "opacity-0" : "opacity-100"}`}
        />
        {/* The same canvas and floor line, so the swap is a pose change
            and never a jump. Loaded with the listening pose, so the
            first cut-in never waits on the network. */}
        <Image
          src="/demos-onboard-speaking.webp"
          alt=""
          width={size * 2}
          height={size * 2}
          priority
          className={`demos absolute inset-0 block h-auto w-full transition-opacity dur-fast ease-out ${on ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    </div>
  );
}
