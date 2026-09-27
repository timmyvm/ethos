/**
 * Springs, in Apple's two numbers (the apple-design skill, §4).
 *
 * Mass, stiffness and damping are physics; nobody designing a screen
 * thinks in them. Apple's API takes two numbers instead, and so does
 * this one:
 *
 *  - `damping`, the damping ratio. 1 is critically damped: it arrives
 *    and stops, no overshoot. Below 1 it passes the target and swings
 *    back. Most UI is 1. Bounce is for things a finger threw.
 *  - `response`, in seconds: roughly how long the value takes to get
 *    most of the way there. It is NOT a duration. A spring has no
 *    duration; when it settles falls out of the two numbers.
 *
 * The app has no animation library and does not want one, so a spring
 * reaches the page two ways:
 *
 *  - CSS: `springEasing()` samples the curve into a `linear()` timing
 *    function and `springDuration()` says how long to run it. The
 *    tokens in app/globals.css (`--spring*`) are these strings, and
 *    lib/spring.test.ts keeps the two copies equal.
 *  - JS: `animateSpring()` drives an element with the Web Animations
 *    API from wherever it is ON SCREEN, carrying the finger's velocity
 *    in, so a drag hands over to its animation with no seam (§3, §5).
 */

export type Spring = {
  /** Damping ratio. 1 = no overshoot; ~0.8 = a little, for a throw. */
  damping: number;
  /** Seconds. Lower is snappier. */
  response: number;
};

/**
 * The house springs. Critically damped unless the gesture carried
 * momentum (§4: "overshoot on a menu that just faded in feels wrong;
 * overshoot on a card you flicked feels right").
 */
export const SPRING = {
  /** Default UI movement: a well sliding, a push, an arrival. */
  base: { damping: 1, response: 0.35 },
  /** A press coming back up, a toggle's knob. */
  snappy: { damping: 1, response: 0.24 },
  /** A sheet or a page: bigger things read as heavier. */
  sheet: { damping: 1, response: 0.42 },
  /** Released after a flick: a small overshoot, earned by the throw. */
  thrown: { damping: 0.82, response: 0.36 },
} as const satisfies Record<string, Spring>;

/**
 * How far from the target the value still is, as a fraction of the
 * starting distance, `t` seconds in. 1 at the start, 0 at rest.
 *
 * `velocity` is the value's starting speed TOWARD the target, in
 * starting-distances per second (§5's relative velocity: px/s divided
 * by the px still to go).
 */
export function springOffset(spring: Spring, t: number, velocity = 0): number {
  const w0 = (2 * Math.PI) / spring.response;
  const z = spring.damping;
  if (z >= 1) {
    // Critically damped (treating anything over 1 as 1: an overdamped
    // spring only ever looks slow, never different).
    return (1 + (w0 - velocity) * t) * Math.exp(-w0 * t);
  }
  const wd = w0 * Math.sqrt(1 - z * z);
  return (
    Math.exp(-z * w0 * t) *
    (Math.cos(wd * t) + ((z * w0 - velocity) / wd) * Math.sin(wd * t))
  );
}

/** Progress from 0 to 1 (and past it, for a bouncy spring). */
export function springProgress(spring: Spring, t: number, velocity = 0): number {
  return 1 - springOffset(spring, t, velocity);
}

/**
 * Seconds until the spring is at rest: within a thousandth of the
 * distance and staying there. That is where a CSS animation has to end,
 * or the last frame jumps.
 */
export function springDuration(spring: Spring, velocity = 0): number {
  const step = 1 / 240;
  let rest = 0;
  for (let t = 0; t < 4; t += step) {
    if (Math.abs(springOffset(spring, t, velocity)) > 0.001) rest = t + step;
  }
  return Math.min(4, rest);
}

/**
 * The curve as a CSS `linear()` timing function, for `duration`
 * `springDuration(spring)`. Sampled every sixtieth of a second, which
 * is every frame a 60Hz screen can show, so nothing is lost between
 * stops; the output is rounded to three places, a thousandth of the
 * travel, a fraction of a pixel on any element this app moves.
 */
export function springEasing(spring: Spring, velocity = 0): string {
  const total = springDuration(spring, velocity);
  const frames = Math.max(2, Math.round(total * 60));
  const stops: string[] = [];
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * total;
    const v = i === frames ? 1 : springProgress(spring, t, velocity);
    stops.push(String(Math.round(v * 1000) / 1000));
  }
  return `linear(${stops.join(", ")})`;
}

/** Milliseconds, rounded, for a `transition-duration` or a timer. */
export function springMs(spring: Spring, velocity = 0): number {
  return Math.round(springDuration(spring, velocity) * 1000);
}

/**
 * Apple's momentum projection (§6): where a flick at `velocity` px/s
 * would come to rest under scroll-like deceleration. Choose the snap
 * point nearest THIS, not nearest where the finger let go.
 */
export function project(velocity: number, deceleration = 0.998): number {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/**
 * Resistance past an edge (§9). The further past the boundary, the
 * less the element follows: `overshoot` px of finger become a
 * shrinking share of that in movement, approaching `dimension` and
 * never reaching it. Near the edge it follows at about `c`.
 */
export function rubberband(overshoot: number, dimension: number, c = 0.55): number {
  const sign = Math.sign(overshoot);
  const x = Math.abs(overshoot);
  return (sign * (x * dimension * c)) / (dimension + c * x);
}

/**
 * Velocity from the last ~100ms of pointer samples, in px/s. The whole
 * drag's average is the wrong number: a slow haul that ends in a flick
 * is a flick, and a fast start that stopped dead is not one.
 */
export function releaseVelocity(samples: { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[samples.length - 2];
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > 100) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? ((last.y - first.y) / dt) * 1000 : 0;
}

/**
 * Move `el` along one axis from `from` px to `to` px on a spring,
 * starting at `velocity` px/s. Reads nothing from CSS: the caller
 * passes the live on-screen value (§3), so an interrupted motion picks
 * up exactly where it was.
 *
 * Resolves when it lands. Honours reduced motion by landing at once.
 */
export function animateSpring(
  el: HTMLElement,
  {
    axis = "y",
    from,
    to,
    velocity = 0,
    spring = SPRING.sheet,
    reduced = false,
  }: {
    axis?: "x" | "y";
    from: number;
    to: number;
    velocity?: number;
    spring?: Spring;
    reduced?: boolean;
  }
): Promise<void> {
  const fn = axis === "y" ? "translateY" : "translateX";
  const distance = to - from;
  if (reduced || Math.abs(distance) < 0.5 || typeof el.animate !== "function") {
    el.style.transform = `${fn}(${to}px)`;
    return Promise.resolve();
  }
  const relative = velocity / distance;
  const animation = el.animate(
    [{ transform: `${fn}(${from}px)` }, { transform: `${fn}(${to}px)` }],
    {
      duration: springMs(spring, relative),
      easing: springEasing(spring, relative),
      fill: "forwards",
    }
  );
  return animation.finished.then(
    () => {
      el.style.transform = `${fn}(${to}px)`;
      animation.cancel();
    },
    () => {}
  );
}
