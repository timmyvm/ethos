"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { prefersReducedMotion } from "@/lib/prefs";

/**
 * Demos, listening (DECISIONS #243). The most important animation in
 * the app.
 *
 * This is a speaking app, and the single thing it has to convey while
 * someone is talking is that something is HEARING them. A static mascot
 * beside a live meter says the opposite: the numbers are alive and the
 * character is a sticker. So he reacts, off the same signal the meter
 * reads:
 *
 *   ears     lift and spread with volume
 *   eyes     track the waveform, sweeping with the sound
 *   lean     a small push in when speech starts, held while it lasts
 *   settle   back to rest about half a second after it stops
 *   blink    on his own clock, because a thing that never blinks is dead
 *
 * Drawn rather than photographed. The shipped art is a WebP with a
 * single flat alpha, and no amount of CSS lifts an ear in a raster —
 * so this is the same panda in vector, at the same palette sampled out
 * of `assets/demos-onboard-listening.png` (#d05c37 body, #58271a ears
 * and limbs, the cream markings), cropped to head and shoulders because
 * that is the part of him that listens.
 *
 * Never re-renders. `level` is the ref the recorder writes every audio
 * frame (the same one `LevelMeter` reads) and everything here is a
 * transform written straight to the DOM on an animation frame, because
 * pushing sixty state updates a second through the rep screen is what
 * made the meter stutter on the phones this is for.
 */

/** Sampled from the shipped art, so the two cannot drift apart. */
const FUR = "#d05c37";
const DARK = "#58271a";
const CREAM = "#f7e6cf";
const INK = "#3c241c";

export function DemosListening({
  level,
  size = 96,
  className = "",
}: {
  /** 0 to 1, written by the recorder every audio frame. */
  level: MutableRefObject<number>;
  size?: number;
  className?: string;
}) {
  const figure = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const earL = useRef<SVGGElement>(null);
  const earR = useRef<SVGGElement>(null);
  const pupils = useRef<SVGGElement>(null);
  const lids = useRef<SVGGElement>(null);

  useEffect(() => {
    const calm = prefersReducedMotion();
    let raf = 0;
    /** Smoothed level: the raw signal is too jittery to drive a face. */
    let eased = 0;
    /** How long speech has been going, and how long silence has. */
    let quietFor = 0;
    let leaning = 0;
    /** Where the eyes are looking, and the sweep that moves them. */
    let gaze = 0;
    let phase = 0;
    let last = performance.now();
    let blinkAt = last + 2600;
    let blinking = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;

      const raw = Math.max(0, Math.min(1, level.current));
      // Fast up, slow down: a face should catch the start of a word and
      // let go of the end of it.
      eased += (raw - eased) * (raw > eased ? 0.35 : 0.08);

      const speaking = eased > 0.14;
      quietFor = speaking ? 0 : quietFor + dt;
      // The lean holds through the gaps between words and only lets go
      // after half a second of real silence.
      const wantLean = speaking || quietFor < 520 ? 1 : 0;
      leaning += (wantLean - leaning) * 0.09;

      // The eyes sweep with the sound rather than jitter with it: the
      // sweep runs faster the louder it gets, and its width is the
      // volume, so quiet speech is a flicker and a raised voice is a
      // full look across.
      phase += (dt / 1000) * (1.1 + eased * 2.6);
      gaze += (Math.sin(phase) * eased - gaze) * 0.12;

      if (now > blinkAt) {
        blinking = 1;
        // Between two and six seconds, never on a metronome.
        blinkAt = now + 2000 + Math.abs(Math.sin(phase * 7.3)) * 4000;
      }
      if (blinking > 0) blinking = Math.max(0, blinking - dt / 90);

      if (calm) {
        // Reduced motion keeps the one thing that is information — he is
        // hearing you — and drops every loop, sweep and blink.
        if (figure.current) figure.current.style.transform = "none";
        if (head.current) head.current.style.transform = "none";
        const spread = 3 + eased * 5;
        if (earL.current) earL.current.style.transform = `rotate(${-spread}deg)`;
        if (earR.current) earR.current.style.transform = `rotate(${spread}deg)`;
        if (pupils.current) pupils.current.style.transform = "none";
        if (lids.current) lids.current.style.transform = "none";
        return;
      }

      // Ears: the loudest channel, because they are the biggest shapes
      // and the first thing the eye reads at 84px.
      const spread = 3 + eased * 11;
      const lift = eased * 2.2;
      if (earL.current) {
        earL.current.style.transform = `rotate(${-spread}deg) translateY(${-lift}px)`;
      }
      if (earR.current) {
        earR.current.style.transform = `rotate(${spread}deg) translateY(${-lift}px)`;
      }

      // Head: a small tilt toward the sound, and a breath under it.
      const breath = Math.sin(now / 1400) * 0.6;
      if (head.current) {
        head.current.style.transform = `translateY(${breath - eased * 1.6}px) rotate(${gaze * 2.4}deg)`;
      }

      // The whole figure leans in while there is something to hear.
      if (figure.current) {
        figure.current.style.transform = `translateY(${-leaning * 3}px) scale(${1 + leaning * 0.02})`;
      }

      if (pupils.current) {
        pupils.current.style.transform = `translate(${gaze * 2.4}px, ${-eased * 0.8}px)`;
      }
      if (lids.current) {
        lids.current.style.transform = `scaleY(${1 - blinking * 0.92})`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      focusable="false"
      className={`demos ${className}`}
    >
      <g ref={figure} style={{ transformOrigin: "60px 112px" }}>
        {/* The bust, drawn first so the head sits ON it rather than
            above it: the top of the chest reaches y=74 and the head
            spans 21 to 77, so there is no neck to get wrong. */}
        <path d="M18 120c0-27 19-52 42-52s42 25 42 52z" fill={DARK} />
        <path d="M31 120c0-19 13-38 29-38s29 19 29 38z" fill={FUR} />

        <g ref={head} style={{ transformOrigin: "60px 74px" }}>
          {/* Ears. Broad and dark with a thin cream lining, the way the
              shipped art draws them, each turning on its own base where
              it meets the skull. */}
          <g ref={earL} style={{ transformOrigin: "38px 36px" }}>
            <path
              d="M43 30c-7-8-16-13-21-10s-4 13 1 21c4 7 10 12 15 14z"
              fill={DARK}
            />
            <path
              d="M41 32c-5-5-10-8-13-6s-2 8 1 13c2 4 6 7 9 9z"
              fill={CREAM}
            />
          </g>
          <g ref={earR} style={{ transformOrigin: "82px 36px" }}>
            <path
              d="M77 30c7-8 16-13 21-10s4 13-1 21c-4 7-10 12-15 14z"
              fill={DARK}
            />
            <path
              d="M79 32c5-5 10-8 13-6s2 8-1 13c-2 4-6 7-9 9z"
              fill={CREAM}
            />
          </g>

          {/* Head. */}
          <ellipse cx="60" cy="49" rx="31" ry="28" fill={FUR} />

          {/* The cheek fur: cream, low and outboard, pointing down —
              the marking that makes him a red panda rather than a fox. */}
          <path d="M31 50c-1 10 3 19 10 24 2-9 2-19 0-27z" fill={CREAM} />
          <path d="M89 50c1 10-3 19-10 24-2-9-2-19 0-27z" fill={CREAM} />

          {/* Muzzle, up between the eyes the way the art has it. */}
          <path
            d="M60 37c5 0 8 5 9 11 2 4 8 6 8 13 0 9-8 15-17 15s-17-6-17-15c0-7 6-9 8-13 1-6 4-11 9-11z"
            fill={CREAM}
          />

          {/* Brow spots. His expression lives here. */}
          <ellipse cx="46" cy="35" rx="5" ry="3.2" fill={CREAM} />
          <ellipse cx="74" cy="35" rx="5" ry="3.2" fill={CREAM} />

          {/*
           * Eyes. A blink squashes them to the lash line rather than
           * dropping a coloured lid over them: a lid painted in fur is
           * a mask, and he ends up looking like he is wearing one.
           */}
          <g ref={lids} style={{ transformOrigin: "60px 48px" }}>
            <ellipse cx="49" cy="47" rx="6.6" ry="7.2" fill="#fff" />
            <ellipse cx="71" cy="47" rx="6.6" ry="7.2" fill="#fff" />
            <g ref={pupils}>
              <ellipse cx="49" cy="47.5" rx="4" ry="4.6" fill={INK} />
              <ellipse cx="71" cy="47.5" rx="4" ry="4.6" fill={INK} />
              <circle cx="50.6" cy="45.6" r="1.4" fill="#fff" />
              <circle cx="72.6" cy="45.6" r="1.4" fill="#fff" />
            </g>
          </g>

          {/* Nose and mouth. */}
          <path d="M60 56c3.2 0 5.2 1.6 5.2 3.3S62.5 62.8 60 62.8s-5.2-1.1-5.2-3.5S56.8 56 60 56z" fill={INK} />
          <path
            d="M60 63.2v2M60 65.2c0 1.9 1.8 3 3.6 3M60 65.2c0 1.9-1.8 3-3.6 3"
            stroke={INK}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
