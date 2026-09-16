"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Demos on the introduction's screens (DECISIONS #233): one full-body
 * pose per screen from the set that shares a baseline, and one loop
 * per pose, transform and opacity only, stilled by `data-motion`.
 *
 * The accents (sound arcs, sparkles) are not in the art. The speaking
 * and celebrating poses were rendered plain, and the arcs and sparkles
 * are drawn here in the brand's own tokens, so they can move on their
 * own clock and follow the theme. Every overlay is `aria-hidden`; the
 * art is decoration and the screen's words carry the meaning.
 */
export type Pose =
  | "wave"
  | "speaking"
  | "celebrate"
  | "fingers"
  | "telescope"
  | "listening"
  | "mic"
  | "headphones"
  | "clock"
  | "hello"
  | "clipboard";

/** The loop each pose runs (globals.css, `.demos-*`). */
const LOOP: Record<Pose, string> = {
  wave: "demos-sway",
  speaking: "demos-breath",
  celebrate: "demos-bob",
  fingers: "demos-idle",
  telescope: "demos-idle",
  listening: "demos-tilt",
  mic: "demos-idle",
  headphones: "demos-idle",
  clock: "demos-idle",
  hello: "demos-sway",
  clipboard: "demos-breath",
};

export const poseSrc = (pose: Pose) => `/demos-onboard-${pose}.webp`;

/**
 * Warm the next screen's pose while this one is being read (#288), so
 * the mascot is there before his bubble fills rather than arriving
 * after it. A no-op on the server and harmless if the file is cached.
 */
export function preloadPose(pose: Pose): void {
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = poseSrc(pose);
}

export function DemosArt({
  pose,
  size = 180,
  nodKey,
  greetAfterMs,
  className = "",
}: {
  pose: Pose;
  size?: number;
  /**
   * Nod once on arrival, this long after mount (#288): the reference's
   * mascot moves AFTER the bubble's words have landed, never during,
   * so the delay is the words' own length. Undefined means the old
   * rule, no nod on arrival at all.
   */
  greetAfterMs?: number;
  /** Margins belong to the parent (#234); this is where they go. */
  className?: string;
  /**
   * Change this and he nods (#249). It is the answer they just gave, so
   * picking the same row twice does nothing and picking a different one
   * always lands.
   *
   * The nod goes on the WRAPPER, never on the art: the art is running
   * its pose loop, and two animations on one `transform` fight. And it
   * is restarted by removing the class, forcing a reflow and putting it
   * back, rather than by remounting — a remounted `next/image` is a
   * flash for the sake of a 460ms dip.
   */
  nodKey?: string | number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // Not on mount: the screen already has an entrance, and a nod on
    // arrival is a reaction to nothing.
    if (first.current) {
      first.current = false;
      return;
    }
    const el = frame.current;
    if (!el || nodKey === undefined || nodKey === "") return;
    el.classList.remove("demos-nod");
    void el.offsetWidth;
    el.classList.add("demos-nod");
  }, [nodKey]);

  useEffect(() => {
    if (greetAfterMs === undefined) return;
    const el = frame.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.classList.remove("demos-nod");
      void el.offsetWidth;
      el.classList.add("demos-nod");
    }, greetAfterMs);
    return () => clearTimeout(t);
  }, [greetAfterMs]);

  return (
    <div
      ref={frame}
      className={`relative mx-auto shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
      /* The class comes off when the nod ends, so the greeting and an
         answer's nod never fight over it and a still Demos carries no
         stale animation. */
      onAnimationEnd={(e) => {
        if (e.animationName === "demos-nod") e.currentTarget.classList.remove("demos-nod");
      }}
    >
      {/* Served as the file it is, not through the optimiser (#288, the
          same reason as the lesson art in #274): the set is already cut
          to one scale, and a plain URL is one `preloadPose` can warm
          before the screen that needs it arrives. The strip showed him
          landing 300ms after his own words. */}
      <Image
        src={poseSrc(pose)}
        alt=""
        width={size}
        height={size}
        priority
        unoptimized
        className={`demos ${LOOP[pose]} block h-full w-full`}
      />
      {pose === "speaking" && <SoundArcs />}
      {pose === "celebrate" && <Sparkles />}
    </div>
  );
}

/**
 * Three arcs beside the mouth, fading in one after another. Amber is
 * the mascot's own accent (brand.md); the stroke is `currentColor` so
 * the colour is one token.
 */
function SoundArcs() {
  return (
    <svg
      viewBox="0 0 40 60"
      className="absolute text-amber"
      /* Right of the head at mouth height, above the raised paw: the
         cheek's edge sits near 66% at that height, the paw from 75% at
         41% down, so the arcs live in the gap at (74 to 89%, 26 to 43%). */
      style={{ left: "74%", top: "26%", width: "15%", height: "17%" }}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
    >
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="arc"
          style={{ "--i": i } as React.CSSProperties}
          d={`M ${6 + i * 10} ${30 - 12 - i * 6} q ${8 + i * 3} ${12 + i * 6} 0 ${24 + i * 12}`}
        />
      ))}
    </svg>
  );
}

/** Three four-point sparkles around the head, twinkling out of step. */
function Sparkles() {
  /* Clear of both raised arms: one out left, two up and out right. */
  const at = [
    { x: 9, y: 34 },
    { x: 84, y: 9 },
    { x: 93, y: 38 },
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 h-full w-full text-amber"
      fill="currentColor"
    >
      {at.map((p, i) => (
        <path
          key={i}
          className="spark"
          style={{ "--i": i, transformOrigin: `${p.x}px ${p.y}px` } as React.CSSProperties}
          d={`M ${p.x} ${p.y - 7} Q ${p.x} ${p.y} ${p.x + 7} ${p.y} Q ${p.x} ${p.y} ${p.x} ${p.y + 7} Q ${p.x} ${p.y} ${p.x - 7} ${p.y} Q ${p.x} ${p.y} ${p.x} ${p.y - 7} Z`}
        />
      ))}
    </svg>
  );
}
