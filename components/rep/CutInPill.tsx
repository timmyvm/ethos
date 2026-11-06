"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { Says } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { prefersReducedMotion } from "@/lib/prefs";
import { SPRING, springEasing, springMs } from "@/lib/spring";

/**
 * Demos's cut-in where he is not drawn (the games plan, item 1; F1):
 * on a phone under 600pt tall, where the listener steps out so Stop
 * stays on the first screen, and in Voice + Video, where the self-view
 * stands in his place. His 36px speaking head and the line in the same
 * tailed SpeechBubble the column's Demos speaks from, at the same lead
 * size (DESIGN 9: one voice for one moment), popping in on the thrown
 * spring. It never stands over Stop: the page puts it in the live-tip
 * row or inside the self-view's top edge. Seen, not read (the page
 * announces the line once).
 */
export function CutInPill({ line, className = "" }: { line: string; className?: string }) {
  const el = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const p = el.current;
    if (!p) return;
    if (prefersReducedMotion()) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE_OUT });
      return;
    }
    p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.fast, easing: EASE_OUT });
    p.animate([{ transform: "scale(0.8)" }, { transform: "scale(1)" }], {
      duration: springMs(SPRING.thrown),
      easing: springEasing(SPRING.thrown),
    });
  }, [line]);

  return (
    <div
      ref={el}
      aria-hidden
      className={`flex w-max max-w-full items-start gap-3 ${className}`}
      style={{ transformOrigin: "0 50%" }}
    >
      {/* His head level with the tail, so the line is his. */}
      <Image
        src="/demos-speaking.webp"
        alt=""
        width={72}
        height={72}
        className="demos mt-2.5 w-9 shrink-0"
      />
      <SpeechBubble tail="left" voice="lead" className="min-w-0 text-balance">
        <Says text={line} ariaHidden />
      </SpeechBubble>
    </div>
  );
}
