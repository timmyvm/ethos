"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { SPRING, springMs } from "@/lib/spring";
import { FIRST_PRICE_CENTS, LADDER_CENTS } from "@/lib/pricing";
import { Paw } from "./Paw";

/**
 * The price ladder as seven steps you could stand on (docs/ladder-spec.md,
 * "The Stair"). Each step is the answer rows' object: a fill, a 2px edge
 * and a 4px lip, measured from zero, so A$6.99 stands 54% as tall as
 * A$12.99 and a 46% drop looks like one. The floor runs on through the
 * parent's padding to the sheet's edge and fades: "from month 7, forever"
 * without a word. Demos's Paw stands on the month you are in; months
 * already paid are pressed flat. The object lives in app/globals.css
 * under "the price ladder".
 *
 * One component, three jobs:
 *  - **picture** (You's plan card, the manage sheet): `role="img"`,
 *    named by one sentence (`label`, lib/plan-view.ts `pictureLabel`).
 *  - **slider** (the paywall, with `onSelect`): one `role="slider"` a
 *    finger scrubs or the arrow keys step. The Paw hops to the selection,
 *    the step under the finger presses in like a key, the steps behind
 *    it press flat, and a 6ms tick fires per step crossed.
 *  - **stage** (the monthly drop, with `hop`): the Paw hops one step down
 *    on an arc, the step takes its weight and a sheen crosses it, and
 *    `onLand` fires on that frame so the parent's digits roll with it.
 *
 * Every first render rises in: the steps lift 12px and fade, 30ms apart,
 * on the base spring, and the Paw drops onto its step. Reduced motion is
 * a 200ms fade and nothing travels.
 */
export type StairSize = "lg" | "md" | "sm";
export type StairTone = "plum" | "neutral";
export type StairHow = "drag" | "tap" | "key";

/** The first step's height per size; every other step is measured from zero against it. */
export const STAIR_MAX: Record<StairSize, number> = { lg: 120, md: 88, sm: 40 };

/** A step's height in px: `max * cents / 1299`. */
export function stepHeight(size: StairSize, cents: number): number {
  return Math.round((STAIR_MAX[size] * cents) / FIRST_PRICE_CENTS);
}

const STEPS = LADDER_CENTS.length;
/** The rise's stagger, left to right. */
const RISE_STAGGER_MS = 30;
/** When the Paw lands on its step in the rise, after that step starts rising (globals.css keeps the same number). */
const PAW_LANDS_MS = 300;
/** The stage's wait before the hop, so the sheet has landed first. */
export const HOP_DELAY_MS = 450;
/** How far a finger goes sideways before a touch on the stair is a scrub rather than the sheet's scroll. */
const SCRUB_SLOP_PX = 8;
/** A finger resting on a step presses it after this long, if it has not become a scroll or a scrub. */
const TOUCH_PRESS_DELAY_MS = 90;

type StepState = "lit" | "paid" | "future" | "ghost";
type Phase = "rest" | "waiting" | "flying" | "landed";

const clampStep = (n: number) => Math.min(STEPS, Math.max(1, Math.round(n)));

export function Stair({
  tone,
  size,
  at,
  labels,
  ghostAfter = false,
  bleed = 0,
  rise = true,
  riseDelay = 0,
  hop,
  onLand,
  selected,
  onSelect,
  label,
  valueText,
  summary,
  className = "",
}: {
  tone: StairTone;
  size: StairSize;
  /** The step the Paw stands on and the lit one, 1 to 7; null draws neither. In slider mode `selected` leads. */
  at: number | null;
  /** The seven month labels under the steps (lib/plan-view.ts `stepLabels`). The sm size draws none. */
  labels?: string[];
  /** The steps after `at` as dashed outlines: an ending plan. */
  ghostAfter?: boolean;
  /** How far the floor step runs past the column's right edge, through the parent's padding. */
  bleed?: number;
  /** The rise-in on first render. */
  rise?: boolean;
  /** When the rise starts, in ms (the paywall waits for its sheet). */
  riseDelay?: number;
  /** Stage mode: the Paw hops `from` → `to` after `delay` (450ms). A new `key` replays it; key 0 draws it landed. */
  hop?: { from: number; to: number; key?: number; delay?: number };
  /** Fires on the landing frame of a hop. */
  onLand?: () => void;
  /** Slider mode, with `onSelect`: the chosen step, 1 to 7. */
  selected?: number;
  onSelect?: (step: number, how: StairHow) => void;
  /** The slider's name, or the picture's whole sentence. */
  label: string;
  /** The slider's aria-valuetext for a step. */
  valueText?: (step: number) => string;
  /** Slider mode: the whole ladder in one sentence, read once before the slider. */
  summary?: string;
  className?: string;
}) {
  const steps = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLDivElement>(null);
  const tokenBody = useRef<HTMLSpanElement>(null);
  const slider = !!onSelect;
  const stage = !slider && !!hop;
  const faces = size !== "sm";

  // -- The rise: once, on the first render, then the attribute comes off
  //    so nothing that changes later can replay it.
  const [rising, setRising] = useState(rise);
  useEffect(() => {
    if (!rising) return;
    const t = setTimeout(
      () => setRising(false),
      riseDelay + (STEPS - 1) * RISE_STAGGER_MS + springMs(SPRING.base) + 120
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- The stage's hop, in phases: waiting on `from`, flying, landed on `to`.
  const hopKey = hop ? (hop.key ?? 1) : 0;
  const [flight, setFlight] = useState<{ phase: Phase; key: number }>(() => ({
    phase: stage && hopKey !== 0 ? "waiting" : "rest",
    key: hopKey,
  }));
  if (stage && hopKey !== flight.key) {
    setFlight({ phase: hopKey === 0 ? "rest" : "waiting", key: hopKey });
  }
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const [dip, setDip] = useState<number | null>(null);

  const phase = stage ? flight.phase : "rest";
  const from = hop ? clampStep(hop.from) : null;
  const to = hop ? clampStep(hop.to) : null;

  // Where the Paw stands and which step is lit.
  const tokenAt: number | null = slider
    ? clampStep(selected ?? at ?? 1)
    : stage
      ? phase === "waiting"
        ? from
        : to
      : at === null
        ? null
        : clampStep(at);
  const lit: number | null = stage && phase === "flying" ? null : tokenAt;

  // Waiting, then the takeoff.
  useEffect(() => {
    if (!stage || flight.phase !== "waiting") return;
    const t = setTimeout(() => setFlight((f) => (f.key === flight.key ? { ...f, phase: "flying" } : f)), hop?.delay ?? HOP_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, flight.phase, flight.key]);

  // The flight itself, on an arc: up and over on an ease-out, down onto
  // the step on an ease-in, so it leaves like a hop and lands with
  // weight. Set before paint, so no frame shows the Paw already there.
  useLayoutEffect(() => {
    if (!stage || flight.phase !== "flying" || from === null || to === null) return;
    const key = flight.key;
    const land = () => {
      setFlight((f) => (f.key === key ? { ...f, phase: "landed" } : f));
      setDip(to);
      buzz([8, 40, 8]);
      onLandRef.current?.();
    };
    const el = token.current;
    const cols = steps.current?.querySelectorAll<HTMLElement>(".stair-col");
    if (!el || !cols || prefersReducedMotion() || typeof el.animate !== "function") {
      // Reduced motion: the end state, faded in.
      el?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE_OUT });
      land();
      return;
    }
    const pitch = cols[to - 1].offsetLeft - cols[from - 1].offsetLeft;
    const dh = stepHeight(size, LADDER_CENTS[from - 1]) - stepHeight(size, LADDER_CENTS[to - 1]);
    const arc = size === "sm" ? 12 : 22;
    const anim = el.animate(
      [
        { transform: `translate(${-pitch}px, ${-dh}px)`, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
        { transform: `translate(${-pitch * 0.45}px, ${-dh - arc}px)`, offset: 0.42, easing: "cubic-bezier(0.55, 0, 0.9, 0.5)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: springMs(SPRING.base) }
    );
    anim.finished.then(land, () => {});
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, flight.phase, flight.key]);

  // The landing's dip and sheen come off once played, so a replay can set them again.
  useEffect(() => {
    if (dip === null) return;
    const t = setTimeout(() => {
      setDip(null);
      setFlight((f) => (f.phase === "landed" ? { ...f, phase: "rest" } : f));
    }, 640);
    return () => clearTimeout(t);
  }, [dip]);

  // The entrance's landing: the Paw drops onto its step as the steps finish rising.
  useEffect(() => {
    if (!rise || tokenAt === null || stage || prefersReducedMotion()) return;
    const t = setTimeout(() => setDip(tokenAt), riseDelay + (tokenAt - 1) * RISE_STAGGER_MS + PAW_LANDS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- The slider: the Paw hops to each new selection.
  const previous = useRef(tokenAt);
  /** The finger on the slider: where it started, and the step it is on now
      (a ref, because pointer events land faster than React renders). A
      touch is not yet ours until it moves sideways (`moved`) or lifts: it
      may be the sheet's scroll, and a scroll that began on the stair must
      never flip the readout and buzz before the browser takes it. */
  const dragging = useRef<{
    id: number;
    touch: boolean;
    x0: number;
    moved: boolean;
    before: number;
    at: number;
  } | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  /** A finger that rests on a step presses it after a beat, as a scroll view delays its touches. */
  const pressSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPressSoon = () => {
    if (pressSoon.current !== null) clearTimeout(pressSoon.current);
    pressSoon.current = null;
  };
  useEffect(() => stopPressSoon, []);
  useLayoutEffect(() => {
    const was = previous.current;
    previous.current = tokenAt;
    if (!slider || was === null || tokenAt === null || was === tokenAt) return;
    const body = tokenBody.current;
    if (!body || typeof body.animate !== "function") return;
    if (prefersReducedMotion()) {
      // No hop: the Paw fades in where it now stands.
      body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE_OUT });
      return;
    }
    const y = new DOMMatrixReadOnly(getComputedStyle(body).transform).m42 || 0;
    body.getAnimations().forEach((a) => {
      if (!(typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation)) a.cancel();
    });
    const lift = Math.min(16, 6 + 3 * Math.abs(tokenAt - was)) * (size === "sm" ? 0.5 : 1);
    body.animate(
      [
        { transform: `translateY(${y}px)`, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
        { transform: `translateY(${-lift}px)`, offset: 0.45, easing: "cubic-bezier(0.55, 0, 0.9, 0.5)" },
        { transform: "translateY(0)" },
      ],
      { duration: springMs(SPRING.snappy) }
    );
  }, [slider, tokenAt, size]);

  function stepAt(clientX: number): number {
    const box = steps.current;
    const cols = box?.querySelectorAll<HTMLElement>(".stair-col");
    if (!box || !cols || cols.length < 2) return 1;
    const pitch = cols[1].offsetLeft - cols[0].offsetLeft;
    const x = clientX - box.getBoundingClientRect().left;
    return clampStep(Math.floor(x / pitch) + 1);
  }

  function choose(next: number, how: StairHow, now = tokenAt ?? 1) {
    if (next === now) return;
    // One tick per step crossed, never on release.
    const crossed = Math.min(6, Math.abs(next - now));
    buzz(crossed === 1 ? 6 : Array.from({ length: crossed * 2 - 1 }, (_, i) => (i % 2 ? 24 : 6)));
    onSelect?.(next, how);
  }

  const stateOf = (n: number): StepState => {
    if (lit !== null && n === lit) return "lit";
    if (stage && phase === "flying" && n === from) return "paid";
    if (tokenAt !== null && n < tokenAt) return "paid";
    if (ghostAfter && tokenAt !== null && n > tokenAt) return "ghost";
    return "future";
  };

  const sliderProps = slider
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": label,
        "aria-valuemin": 1,
        "aria-valuemax": STEPS,
        "aria-valuenow": tokenAt ?? 1,
        "aria-valuetext": valueText?.(tokenAt ?? 1),
        "aria-orientation": "horizontal" as const,
        onKeyDown: (e: React.KeyboardEvent) => {
          const now = tokenAt ?? 1;
          const next =
            e.key === "ArrowRight" || e.key === "ArrowUp"
              ? now + 1
              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                ? now - 1
                : e.key === "Home"
                  ? 1
                  : e.key === "End"
                    ? STEPS
                    : null;
          if (next === null) return;
          e.preventDefault();
          choose(clampStep(next), "key");
        },
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          // The stair's own: a scrub is not the sheet's drag down.
          e.stopPropagation();
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const n = stepAt(e.clientX);
          const before = tokenAt ?? 1;
          const touch = e.pointerType === "touch";
          dragging.current = { id: e.pointerId, touch, x0: e.clientX, moved: false, before, at: n };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // A pointer the browser no longer tracks; the tap still selects.
          }
          // A mouse or a pen selects on press. A finger waits to be a tap
          // (lifted where it landed) or a scrub (8px sideways); resting
          // on a step, it presses it after a beat.
          if (touch) {
            stopPressSoon();
            const id = e.pointerId;
            pressSoon.current = setTimeout(() => {
              const d = dragging.current;
              if (d && d.id === id && !d.moved) setPressed(d.at);
            }, TOUCH_PRESS_DELAY_MS);
            return;
          }
          setPressed(n);
          choose(n, "tap", before);
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          const d = dragging.current;
          if (!d || d.id !== e.pointerId) return;
          if (d.touch && !d.moved && Math.abs(e.clientX - d.x0) < SCRUB_SLOP_PX) return;
          const n = stepAt(e.clientX);
          if (d.touch && !d.moved) {
            stopPressSoon();
            // Sideways: the gesture is the stair's now, from the step it started on.
            d.moved = true;
            d.at = n;
            setPressed(n);
            choose(n, "drag", d.before);
            return;
          }
          if (n !== d.at) {
            const was = d.at;
            d.at = n;
            d.moved = true;
            setPressed(n);
            choose(n, "drag", was);
          }
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
          const d = dragging.current;
          if (!d || d.id !== e.pointerId) return;
          // Letting go keeps the selection; a finger that never moved was a tap.
          stopPressSoon();
          dragging.current = null;
          setPressed(null);
          if (d.touch && !d.moved) choose(d.at, "tap", d.before);
        },
        onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
          const d = dragging.current;
          if (!d || d.id !== e.pointerId) return;
          stopPressSoon();
          dragging.current = null;
          setPressed(null);
          // The browser took the touch for a scroll: it was never a scrub,
          // and a finger selects nothing before it is one. A mouse or pen
          // press (selected on contact) goes back.
          if (!d.touch && !d.moved && d.at !== d.before) onSelect?.(d.before, "tap");
        },
        onLostPointerCapture: () => {
          stopPressSoon();
          if (!dragging.current) return;
          dragging.current = null;
          setPressed(null);
        },
      }
    : { role: "img", "aria-label": label };

  const tokenStep = tokenAt ?? 1;
  return (
    <div className={`stair-wrap ${className}`} style={{ ["--stair-bleed" as string]: `${Math.max(0, bleed)}px` }}>
      {slider && summary && <p className="sr-only">{summary}</p>}
      <div
        data-tone={tone}
        data-size={size}
        data-mode={slider ? "slider" : stage ? "stage" : "picture"}
        data-rise={rising || undefined}
        data-bleed={bleed > 0 || undefined}
        className="stair"
        style={{ ["--stair-rise-delay" as string]: `${riseDelay}ms` }}
        {...sliderProps}
      >
        <div ref={steps} className="stair-steps">
          {LADDER_CENTS.map((cents, i) => {
            const n = i + 1;
            const state = stateOf(n);
            return (
              <div
                key={n}
                aria-hidden
                className="stair-col"
                data-floor={n === STEPS || undefined}
                data-state={state}
                data-pressed={pressed === n || undefined}
                data-dip={dip === n || undefined}
                data-wide={cents >= 1000 || undefined}
                style={{ ["--h" as string]: `${stepHeight(size, cents)}px`, ["--i" as string]: i }}
              >
                <div className="stair-block">
                  {faces && (
                    <span className="stair-price">
                      {Math.floor(cents / 100)}
                      <span className="stair-cents">.{String(cents % 100).padStart(2, "0")}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {tokenAt !== null && (
            <div
              ref={token}
              aria-hidden
              className="stair-token"
              data-pressed={pressed !== null && pressed === tokenAt ? true : undefined}
              data-dip={dip !== null && dip === tokenAt ? true : undefined}
              style={{
                ["--ti" as string]: tokenStep - 1,
                ["--th" as string]: `${stepHeight(size, LADDER_CENTS[tokenStep - 1])}px`,
              }}
            >
              <span ref={tokenBody} className="stair-token-body">
                <Paw />
              </span>
            </div>
          )}
        </div>
        {faces && labels && labels.length === STEPS && (
          <div aria-hidden className="stair-labels">
            {labels.map((text, i) => (
              <span
                key={i}
                className="label-micro stair-label"
                data-lit={lit === i + 1 || undefined}
                style={{ ["--i" as string]: i }}
              >
                {text}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
