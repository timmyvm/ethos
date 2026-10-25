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
 * How fast `springOffset` is changing `t` seconds in, in starting
 * distances per second: negative while it closes in, `-velocity` at
 * the start. The derivative of the same two curves, so a spring can be
 * read mid-flight without sampling it.
 */
export function springVelocity(spring: Spring, t: number, velocity = 0): number {
  const w0 = (2 * Math.PI) / spring.response;
  const z = spring.damping;
  if (z >= 1) {
    return Math.exp(-w0 * t) * (-velocity - w0 * (w0 - velocity) * t);
  }
  const wd = w0 * Math.sqrt(1 - z * z);
  const b = (z * w0 - velocity) / wd;
  return (
    Math.exp(-z * w0 * t) *
    (-velocity * Math.cos(wd * t) - (z * w0 * b + wd) * Math.sin(wd * t))
  );
}

/** One spring run in pixels: where it set off, where it is going, how fast it left. */
export type SpringRun = {
  from: number;
  to: number;
  /** px/s at the start, signed along the axis. */
  velocity: number;
  spring: Spring;
};

/**
 * Where a run is and how fast it is moving, `t` seconds in, in px and
 * px/s. What an interruption needs: the next motion starts here, at
 * this speed, so neither the position nor the speed jumps. A timer
 * animation keeps the position and throws the speed away, which is the
 * stall a grabbed animation has in most apps and not on an iPhone.
 */
export function springStateAt(run: SpringRun, t: number): { value: number; velocity: number } {
  const distance = run.to - run.from;
  if (Math.abs(distance) < 1e-6) return { value: run.to, velocity: 0 };
  const relative = run.velocity / distance;
  return {
    value: run.to - distance * springOffset(run.spring, t, relative),
    velocity: -distance * springVelocity(run.spring, t, relative),
  };
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

/** The run each element is on, so the next one can read its speed. */
const runs = new WeakMap<HTMLElement, SpringRun & { axis: "x" | "y"; start: number; animation?: Animation }>();

/**
 * The speed a run is moving at when it is seen at `from`, px/s, or 0
 * when `from` is not on its path. The clock alone cannot say where a
 * run is: an animation starts on the frame after it is made, and a
 * caller may already have cancelled it to read where it stopped. So
 * this finds the instant in the last 60ms of the run's clock at which
 * the curve passes through `from`, and reads the speed there. A finger
 * that grabbed and moved the element since, or anything else that moved
 * it, is off the path and reads as 0.
 */
export function velocityAt(run: SpringRun, elapsed: number, from: number): number {
  const distance = Math.abs(run.to - run.from);
  const tolerance = Math.max(2, distance * 0.004);
  let best = Infinity;
  let speed = 0;
  for (let ms = 0; ms <= 60; ms++) {
    const t = elapsed - ms / 1000;
    if (t < 0) break;
    const state = springStateAt(run, t);
    const miss = Math.abs(state.value - from);
    if (miss < best) {
      best = miss;
      speed = state.velocity;
    }
  }
  return best <= tolerance ? speed : 0;
}

function inheritedVelocity(el: HTMLElement, axis: "x" | "y", from: number, now: number): number {
  const run = runs.get(el);
  if (!run || run.axis !== axis) return 0;
  return velocityAt(run, Math.max(0, (now - run.start) / 1000), from);
}

/**
 * Move `el` along one axis from `from` px to `to` px on a spring,
 * starting at `velocity` px/s. Reads nothing from CSS: the caller
 * passes the live on-screen value (§3), so an interrupted motion picks
 * up exactly where it was.
 *
 * With no `velocity`, a motion that interrupts another one this module
 * started carries that one's speed in (springStateAt), so a sheet told
 * to close while it is still rising turns round with its momentum
 * instead of stopping dead and starting again. A finger's velocity,
 * when there is one, always wins. The run it interrupts is cancelled
 * (as Overlay's takeHold and a grab in LessonScreen already do), so its
 * promise resolves without landing; a continuation that must not act
 * after an interruption checks for one, as theirs do.
 *
 * Resolves when it lands. Honours reduced motion by landing at once.
 */
export function animateSpring(
  el: HTMLElement,
  {
    axis = "y",
    from,
    to,
    velocity,
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
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const speed = velocity ?? inheritedVelocity(el, axis, from, now);
  runs.get(el)?.animation?.cancel();
  runs.delete(el);
  if (reduced || Math.abs(distance) < 0.5 || typeof el.animate !== "function") {
    el.style.transform = `${fn}(${to}px)`;
    return Promise.resolve();
  }
  const relative = speed / distance;
  const animation = el.animate(
    [{ transform: `${fn}(${from}px)` }, { transform: `${fn}(${to}px)` }],
    {
      duration: springMs(spring, relative),
      easing: springEasing(spring, relative),
      fill: "forwards",
    }
  );
  const run = { axis, from, to, velocity: speed, spring, start: now, animation };
  runs.set(el, run);
  return animation.finished.then(
    () => {
      if (runs.get(el) === run) runs.delete(el);
      el.style.transform = `${fn}(${to}px)`;
      animation.cancel();
    },
    () => {}
  );
}
