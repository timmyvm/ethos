"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { SPRING, springMs } from "@/lib/spring";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { FIRST_PRICE_CENTS } from "@/lib/pricing";
import { Paw } from "./Paw";
import { RUNGS } from "./data";

/**
 * The staircase (direction B): the price ladder as seven steps you
 * could stand on. See ladder-b.css for the object itself.
 *
 * Three jobs, one component:
 *  - a picture (You's plan card, the manage sheet): `role="img"`,
 *    named in a sentence;
 *  - a slider (the paywall): scrub it with a finger or the arrow keys,
 *    the selection jumping step to step, a 6ms tick per step crossed
 *    and each step pressing in under the finger like a key;
 *  - a stage (the monthly drop): the token hops one step down on an
 *    arc, the step takes its weight, a sheen crosses it, and the
 *    parent's digits roll on the same frame (`onLand`).
 */
export type StairSize = "lg" | "md" | "sm";

const MAX: Record<StairSize, number> = { lg: 120, md: 88, sm: 40 };

export function heightFor(size: StairSize, cents: number): number {
  return Math.round((MAX[size] * cents) / FIRST_PRICE_CENTS);
}

type Faces = "full" | "price" | "none";

export function Stair({
  tone,
  size,
  at,
  ghostAfter = false,
  faces = size === "sm" ? "none" : "full",
  bleed = 0,
  rise = false,
  drop = false,
  hop,
  hopDelay = 0,
  onLand,
  selected,
  onSelect,
  label,
  valueText,
  className = "",
}: {
  tone: "plum" | "neutral";
  size: StairSize;
  /** The rung the token stands on, 1 to 7; null draws no token. */
  at: number | null;
  /** The rungs after `at` as outlines: the plan is ending. */
  ghostAfter?: boolean;
  faces?: Faces;
  /** How far the floor runs past the right edge (the parent's padding). */
  bleed?: number;
  /** The entrance: steps rise, the token drops onto `at`. */
  rise?: boolean;
  /** The token alone drops onto `at` (the checkout return). */
  drop?: boolean;
  /** Hop the token from one rung to the next; a new `key` replays it. */
  hop?: { from: number; to: number; key: number };
  /** Hold the token on its old step this long first (a sheet still rising). */
  hopDelay?: number;
  onLand?: () => void;
  /** With `onSelect`, the stair is a slider. */
  selected?: number;
  onSelect?: (rung: number, how: "drag" | "tap" | "key") => void;
  /** The slider's name, or the picture's whole description. */
  label: string;
  valueText?: (rung: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const dragging = useRef(false);

  // The hop's own state: where the token is, which step is lit, and
  // which step just took a landing (dip and sheen).
  const [flight, setFlight] = useState<{ tokenAt: number | null; lit: number | null; landed: number | null; flying: boolean; key: number }>(
    // Key 0 is the landed picture; any other key on mount plays the hop.
    () => {
      const flying = !!hop && hop.key > 0;
      return { tokenAt: hop ? hop.to : at, lit: flying ? null : hop ? hop.to : at, landed: null, flying, key: hop?.key ?? 0 };
    }
  );
  if (hop && hop.key !== flight.key) {
    setFlight({ tokenAt: hop.to, lit: null, landed: null, flying: true, key: hop.key });
  }
  if (!hop && (flight.tokenAt !== at || flight.lit !== at) && !flight.flying) {
    setFlight({ ...flight, tokenAt: at, lit: at });
  }

  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;

  useLayoutEffect(() => {
    if (!flight.flying || !hop) return;
    const el = token.current;
    const root = ref.current;
    if (!el || !root) return;
    const cols = root.querySelectorAll<HTMLElement>(".lb-col");
    const a = cols[hop.from - 1];
    const b = cols[hop.to - 1];
    const pitch = b.offsetLeft - a.offsetLeft;
    const dh = heightFor(size, RUNGS[hop.from - 1].cents) - heightFor(size, RUNGS[hop.to - 1].cents);
    const land = () => {
      setFlight((f) => ({ ...f, lit: hop.to, landed: hop.to, flying: false }));
      // Harmony: the haptic and the parent's roll on the landing frame.
      buzz([12, 40, 18]);
      onLandRef.current?.();
    };
    if (prefersReducedMotion() || typeof el.animate !== "function") {
      const fade = el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, delay: hopDelay, easing: EASE_OUT, fill: "backwards" });
      if (fade) fade.finished.then(land, land);
      else land();
      return;
    }
    // An arc: up and over on an ease-out, down onto the step on an
    // ease-in, so it leaves like a hop and lands with weight.
    const ms = springMs(SPRING.base);
    const anim = el.animate(
      [
        { transform: `translate(${-pitch}px, ${-dh}px)`, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
        { transform: `translate(${-pitch * 0.45}px, ${-dh - 22}px)`, offset: 0.42, easing: "cubic-bezier(0.55, 0, 0.9, 0.5)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: ms, delay: hopDelay, fill: "backwards" }
    );
    anim.finished.then(land, () => {});
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.flying, flight.key]);

  // The landing's dip and sheen come off once played, so a replay can
  // set them again.
  useEffect(() => {
    if (flight.landed === null) return;
    const t = setTimeout(() => setFlight((f) => ({ ...f, landed: null })), DURATION.celebrate + 40);
    return () => clearTimeout(t);
  }, [flight.landed, flight.key]);

  const interactive = !!onSelect;
  const tokenAt = flight.tokenAt;
  const lit = flight.lit;

  function rungAt(clientX: number): number {
    const cols = ref.current?.querySelectorAll<HTMLElement>(".lb-col");
    if (!cols) return 1;
    for (let i = 0; i < cols.length - 1; i++) {
      const r = cols[i].getBoundingClientRect();
      if (clientX < r.right + 3) return i + 1;
    }
    return cols.length;
  }

  function choose(r: number, how: "drag" | "tap" | "key") {
    if (r === selected) return;
    buzz(6);
    onSelect?.(r, how);
  }

  const stateOf = (rung: number): "lit" | "paid" | "future" | "ghost" => {
    if (lit !== null && rung === lit) return "lit";
    if (tokenAt !== null && rung < tokenAt) return "paid";
    if (flight.flying && hop && rung === hop.from) return "paid";
    if (ghostAfter && tokenAt !== null && rung > tokenAt) return "ghost";
    return "future";
  };

  const sliderProps = interactive
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": label,
        "aria-valuemin": 1,
        "aria-valuemax": RUNGS.length,
        "aria-valuenow": selected,
        "aria-valuetext": selected ? valueText?.(selected) : undefined,
        onKeyDown: (e: React.KeyboardEvent) => {
          const s = selected ?? 1;
          const next =
            e.key === "ArrowRight" || e.key === "ArrowUp"
              ? Math.min(RUNGS.length, s + 1)
              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                ? Math.max(1, s - 1)
                : e.key === "Home"
                  ? 1
                  : e.key === "End"
                    ? RUNGS.length
                    : null;
          if (next === null) return;
          e.preventDefault();
          choose(next, "key");
        },
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          // The stair's, not the sheet's: a scrub is not a drag down.
          e.stopPropagation();
          if (e.button !== 0) return;
          dragging.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          const r = rungAt(e.clientX);
          setPressed(r);
          choose(r, "tap");
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          if (!dragging.current) return;
          const r = rungAt(e.clientX);
          if (r !== pressed) {
            setPressed(r);
            choose(r, "drag");
          }
        },
        onPointerUp: () => {
          dragging.current = false;
          setPressed(null);
        },
        onPointerCancel: () => {
          dragging.current = false;
          setPressed(null);
        },
      }
    : { role: "img", "aria-label": label };

  return (
    <div className={`lb-stair-wrap ${className}`} style={{ ["--lb-bleed" as string]: `${bleed}px` }}>
      <div
        ref={ref}
        data-tone={tone}
        data-size={size}
        data-rise={rise || undefined}
        data-drop={drop || undefined}
        data-token-pressed={pressed !== null && pressed === tokenAt ? true : undefined}
        className="lb-stair"
        {...sliderProps}
      >
        {RUNGS.map((r, i) => {
          const floor = i === RUNGS.length - 1;
          const whole = Math.floor(r.cents / 100);
          const cents = String(r.cents % 100).padStart(2, "0");
          return (
            <div
              key={r.month}
              aria-hidden
              className="lb-col"
              data-floor={floor || undefined}
              data-state={stateOf(r.month)}
              data-selected={interactive && selected === r.month && lit !== r.month ? true : undefined}
              data-pressed={pressed === r.month ? true : undefined}
              data-dip={flight.landed === r.month ? true : undefined}
              data-sheen={flight.landed === r.month ? true : undefined}
              style={{ ["--h" as string]: `${heightFor(size, r.cents)}px`, ["--i" as string]: i }}
            >
              <div className="lb-block">
                {faces !== "none" && (
                  <span className="lb-price">
                    {whole}
                    <span className="lb-cents">.{cents}</span>
                  </span>
                )}
                {faces === "full" && <span className="lb-month">{r.label}</span>}
              </div>
            </div>
          );
        })}
        {tokenAt !== null && (
          <div
            ref={token}
            aria-hidden
            className="lb-token"
            style={{
              ["--ti" as string]: tokenAt - 1,
              ["--th" as string]: `${heightFor(size, RUNGS[tokenAt - 1].cents)}px`,
            }}
          >
            <span className="lb-token-body">
              <Paw />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
