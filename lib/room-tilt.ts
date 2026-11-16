/**
 * The room as a window (#475, Timothy, 16 Nov: "when you move your
 * phone around, it tracks where your phone is ... it moves around with
 * your phone, so it looks really immersive").
 *
 * The phone's tilt, read from DeviceOrientation, is measured from how
 * the phone was held when the scene began, so whoever holds it flat on
 * a desk and whoever holds it up to their face both start at the
 * centre. About 20 degrees each way is the whole range (-1 to 1). If the
 * person settles into a new way of holding it, the centre follows them
 * there, slowly, once the hand is still. Where there is no motion (a
 * laptop, a phone that said no), a mouse stands in for it.
 *
 * The value the art draws is smoothed every frame by a critically damped
 * spring: it follows the hand closely and never overshoots, and a
 * jittery sensor reads as a steady room. Pure: time is passed in.
 */

export type Tilt = { x: number; y: number };

/** DeviceOrientationEvent's two angles that matter here, in degrees. */
export type Angles = { beta: number; gamma: number };

export const TILT = {
  /** Degrees from the centre to the edge of the range. */
  fullDeg: 20,
  /** The spring's response, in seconds: how closely the room follows. */
  responseS: 0.14,
  /** The hand counts as still under this many degrees a second ... */
  stillDegPerS: 8,
  /** ... held this long, and then the centre starts to follow it. */
  stillAfterMs: 1200,
  /** How slowly the centre follows a still hand. */
  recentreTauMs: 2500,
} as const;

export const ZERO: Tilt = { x: 0, y: 0 };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** An angle's difference, the short way round (-180 to 180). */
export function wrapDeg(d: number): number {
  const r = ((((d + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/**
 * The angles in the screen's frame: in portrait `gamma` is left and
 * right and `beta` is towards and away; a phone on its side swaps them.
 * `angle` is the screen's rotation (screen.orientation.angle).
 */
export function inScreen(o: Angles, angle = 0): Angles {
  const a = ((Math.round(angle / 90) % 4) + 4) % 4;
  if (a === 1) return { beta: -o.gamma, gamma: o.beta };
  if (a === 2) return { beta: -o.beta, gamma: -o.gamma };
  if (a === 3) return { beta: o.gamma, gamma: -o.beta };
  return o;
}

/**
 * Where the phone points, against where it began. x is positive with
 * the right edge dipped (gamma up), y with the top edge raised towards
 * you (beta up), each -1 to 1 over `fullDeg`.
 */
export function tiltFrom(o: Angles, base: Angles, fullDeg: number = TILT.fullDeg): Tilt {
  return {
    x: clamp1(wrapDeg(o.gamma - base.gamma) / fullDeg),
    y: clamp1(wrapDeg(o.beta - base.beta) / fullDeg),
  };
}

/**
 * Follows the phone: the first reading is the centre; afterwards the
 * centre stays put while the hand moves and drifts towards the hand
 * once it has been still for a while.
 */
export class TiltTracker {
  base: Angles | null = null;
  private last: { o: Angles; at: number } | null = null;
  private stillSince: number | null = null;

  update(o: Angles, now: number): Tilt {
    if (!this.base) {
      this.base = { ...o };
      this.last = { o, at: now };
      this.stillSince = now;
      return ZERO;
    }
    const last = this.last;
    const dt = last ? Math.max(0, now - last.at) : 0;
    if (last && dt > 0) {
      const speed =
        (Math.hypot(wrapDeg(o.beta - last.o.beta), wrapDeg(o.gamma - last.o.gamma)) / dt) * 1000;
      if (speed > TILT.stillDegPerS) this.stillSince = null;
      else if (this.stillSince === null) this.stillSince = now;
    }
    this.last = { o, at: now };
    if (this.stillSince !== null && now - this.stillSince >= TILT.stillAfterMs && dt > 0) {
      const k = 1 - Math.exp(-dt / TILT.recentreTauMs);
      this.base = {
        beta: this.base.beta + wrapDeg(o.beta - this.base.beta) * k,
        gamma: this.base.gamma + wrapDeg(o.gamma - this.base.gamma) * k,
      };
    }
    return tiltFrom(o, this.base);
  }

  reset(): void {
    this.base = null;
    this.last = null;
    this.stillSince = null;
  }
}

/** One axis of the spring: where it is and how fast it is going. */
export type Axis = { p: number; v: number };

/**
 * One step of a critically damped spring towards `target`, solved
 * exactly, so the room moves the same at 30, 60 or 120 frames a second
 * and never overshoots from rest.
 */
export function springStep(s: Axis, target: number, dtS: number, responseS: number = TILT.responseS): Axis {
  if (dtS <= 0) return s;
  const w = (2 * Math.PI) / responseS;
  const c1 = s.p - target;
  const c2 = s.v + w * c1;
  const e = Math.exp(-w * dtS);
  return { p: target + (c1 + c2 * dtS) * e, v: (c2 - w * (c1 + c2 * dtS)) * e };
}

/** A mouse's place on the screen, as a tilt: the centre is still. */
export function pointerTilt(x: number, y: number, w: number, h: number): Tilt {
  if (w <= 0 || h <= 0) return ZERO;
  return { x: clamp1((x / w) * 2 - 1), y: clamp1((y / h) * 2 - 1) };
}
