"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DemosClip, hasClip } from "@/components/DemosClip";

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

/**
 * The contact shadow's loop, one per pose loop, on the same clock
 * (globals.css, `.ground-*`): he rises, it shrinks; he sways, it slides.
 */
const GROUND: Record<string, string> = {
  "demos-idle": "ground-idle",
  "demos-sway": "ground-sway",
  "demos-bob": "ground-bob",
  "demos-tilt": "ground-tilt",
  "demos-breath": "ground-breath",
};

/**
 * The introduction's illustration tones (globals.css, `.tone-*`): the
 * colour of the stage he stands on and the disc behind him. They mean
 * nothing but "picture"; never a tap, never earned, never paid.
 *
 * Coral is for the small things (a glyph tile, a plan step), never for
 * ground he stands on: he is rust and terracotta, and a coral room is
 * his own fur colour, so his edge disappears into it. His rooms are the
 * tones that complement him: sun, sky, mint.
 */
export type Tone = "sun" | "sky" | "coral" | "mint";

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
  pop = false,
  grounded = false,
  halo,
  fit = false,
  idle = true,
}: {
  pose: Pose;
  /** His size in px, and with `fit`, the most he grows to. */
  size?: number;
  /**
   * Take the height the room has, up to `size` (the review of the
   * swipe-and-pop round): on a 667px phone a fixed 272px Demos pushed
   * the screen's one tap under the fold. Needs a size container around
   * him (globals.css, `.demos-fit`), which the stage provides.
   */
  fit?: boolean;
  /**
   * Arrive on a spring (the swipe-and-pop round): up out of the floor,
   * a little past, and settle. For a screen whose arrival IS him.
   */
  pop?: boolean;
  /** A soft contact shadow at his feet that breathes with his loop. */
  grounded?: boolean;
  /**
   * A disc behind him in a tone. "stage" is the lighter disc on a
   * coloured stage (his studio light); "coin" is the tone itself, for
   * the plain ground where there is no stage to be lighter than.
   */
  halo?: { tone: Tone; kind: "stage" | "coin" };
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
  /**
   * Play his idle clip over the still where one exists (#316). Off for
   * the small avatars, where a clip is bytes nobody can see move.
   */
  idle?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [clipLive, setClipLive] = useState(false);
  const clip = idle && size >= 120 && hasClip(pose) ? pose : null;
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

  const loop = LOOP[pose];
  return (
    <div
      className={`relative mx-auto shrink-0 ${halo ? `tone-${halo.tone}` : ""} ${className}`}
      style={
        fit
          ? { width: `min(${size}px, 100cqh, 100cqw)`, height: `min(${size}px, 100cqh, 100cqw)` }
          : { width: size, height: size }
      }
      aria-hidden
    >
      {halo && (
        <div
          className={`demos-halo ${pop ? "demos-pop-halo" : ""}`}
          data-solid={halo.kind === "coin" ? "" : undefined}
        />
      )}
      {grounded && (
        <div className={`demos-ground ${pop ? "demos-pop-ground" : ""}`}>
          <span className={GROUND[loop]} />
        </div>
      )}
      {/* Three layers, three clocks, one transform each: the arrival on
          the outside, the nod in the middle, the pose loop on the art. */}
      <div className={`relative z-[1] h-full w-full ${pop ? "demos-pop" : ""}`}>
        <div
          ref={frame}
          className="relative h-full w-full"
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
            className={`demos ${loop} ${clipLive ? "opacity-0" : ""} block h-full w-full`}
          />
          {/* The clip starts and ends on this still, so the swap is
              invisible; until it has drawn a frame the still is all
              there is, and if it never does, nothing changed. */}
          {clip && (
            <DemosClip
              key={clip}
              pose={clip}
              delayMs={(greetAfterMs ?? 0) + 500}
              onLive={setClipLive}
            />
          )}
          {pose === "speaking" && <SoundArcs />}
          {pose === "celebrate" && <Sparkles />}
        </div>
      </div>
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
      /* Measured on the 3D render: his cheek fur reaches 80% across at
         28 to 32% down, the raised paw starts 35% down between 83 and
         95%, and the ear ends at 78%. The clear air is right of the
         head and above the paw, so the arcs live at (82 to 94%, 14 to
         31%) and read as coming off his face, not out of his hand. */
      style={{ left: "82%", top: "14%", width: "12%", height: "17%" }}
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
  /* Clear of both raised arms on the 3D render: one above the left paw
     (the paw starts 27% down), two up and out right. */
  const at = [
    { x: 10, y: 16 },
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
