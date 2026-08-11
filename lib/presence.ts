/**
 * Presence — the delivery score (decisions 11 Aug, §1).
 *
 * Two scores, not one score with an asterisk. The Ethos Index stays
 * audio-only and /1000 so the trendline and the XP leagues stay
 * comparable whichever mode a user picked that day; Presence is a
 * SECOND /1000 rendered beside it, with its own history.
 *
 * Everything here is arithmetic over pose landmarks, in the same tier as
 * fillers and WPM — no LLM, no judgement, nothing that can't be traced to
 * a frame and a timestamp (the no-horoscope rule applies to the body
 * exactly as it does to the voice).
 *
 * The landmarks are produced client-side and never uploaded. This module
 * takes frames in and hands four numbers plus timestamped moments back
 * out; those numbers are the entire footprint a Voice + Video rep leaves.
 *
 * **Every constant below is a v1 guess** and belongs on the calibration
 * list with the star thresholds and HALF_LIFE_DAYS. They are stated
 * rather than tuned, because tuning them needs real recordings.
 */

export interface Point {
  x: number;
  y: number;
  /** MediaPipe's per-landmark confidence, when present. */
  visibility?: number;
}

/**
 * One sampled frame. Coordinates are normalised to the video frame
 * (0–1, y increasing downward), which is what MediaPipe emits — every
 * measurement below divides by shoulder width so distance from the
 * camera doesn't change the score.
 */
export interface PoseFrame {
  /** Seconds since the rep started. */
  t: number;
  nose: Point | null;
  leftEye: Point | null;
  rightEye: Point | null;
  leftEar: Point | null;
  rightEar: Point | null;
  leftShoulder: Point | null;
  rightShoulder: Point | null;
  leftWrist: Point | null;
  rightWrist: Point | null;
}

/** The five numbers that persist. Nothing else about the video does. */
export interface DeliveryMetrics {
  /** Distinct hand gestures per minute. */
  gestureRate: number;
  /** Mean wander of the torso from its own centre, in shoulder-widths. */
  postureDrift: number;
  /** Mean wander of the head relative to the torso. Lower is steadier. */
  headStability: number;
  /** Share of frames with the eye-line up and facing the camera, 0–100. */
  eyeLinePct: number;
  /** The composite, /1000. */
  presenceScore: number;
}

export interface PresenceDimension {
  key: "gesture" | "posture" | "head" | "eyes";
  label: string;
  /** 0–100 before weighting. */
  score: number;
  /** The measured number this came from, formatted for display. */
  value: string;
  /** Why it scored what it scored, in one line. */
  note: string;
}

export type MomentKind = "eyes-down" | "slouch" | "hands-gone" | "stillness";

export interface DeliveryMoment {
  /** Seconds into the rep. */
  t: number;
  seconds: number;
  kind: MomentKind;
  note: string;
}

export interface PresenceResult {
  metrics: DeliveryMetrics;
  dimensions: PresenceDimension[];
  moments: DeliveryMoment[];
  /** Frames that actually had a body in them. Below the floor: no score. */
  usableFrames: number;
  /** False when there wasn't enough of a body on camera to measure. */
  scorable: boolean;
}

// --- calibration constants (all v1 guesses) --------------------------

/** Under this many usable frames there is no Presence score, not a low one. */
export const MIN_USABLE_FRAMES = 45;

/** Gestures per minute that read as engaged rather than static or fidgety. */
export const GESTURE_ZONE: [number, number] = [8, 26];

/** Wrist travel per second (shoulder-widths) that counts as a gesture. */
const GESTURE_SPEED = 0.55;
/** A gesture has to last this long to be one, not a twitch. */
const GESTURE_MIN_FRAMES = 2;

const POSTURE_GOOD = 0.02;
const POSTURE_BAD = 0.12;
const HEAD_GOOD = 0.015;
const HEAD_BAD = 0.08;
const EYE_GOOD = 85;
const EYE_BAD = 30;

/**
 * Nose-below-eyes distance, in shoulder-widths, under which the head has
 * tipped far enough forward to read as looking down. Absolute rather
 * than relative to the user's own baseline on purpose: calibrating
 * against the rep's median would score someone who stared at their desk
 * for ninety seconds as 100% eye contact.
 */
const PITCH_FLOOR = 0.06;
/** How far the head can turn off-axis before it stops being eye-line. */
const YAW_TOLERANCE = 0.34;

/** A look-away has to last this long before it's worth a timestamp. */
const EYES_DOWN_MIN_S = 3;
const HANDS_GONE_MIN_S = 20;
const STILLNESS_MIN_S = 25;
/** Downward torso travel that reads as a collapse rather than a shift. */
const SLOUCH_DRIFT = 0.09;

// --- helpers ---------------------------------------------------------

function visible(p: Point | null, min = 0.5): p is Point {
  return !!p && (p.visibility === undefined || p.visibility >= min);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function meanAbsDeviation(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = median(xs);
  return xs.reduce((a, x) => a + Math.abs(x - m), 0) / xs.length;
}

/** 100 at `good`, 0 at `bad`, linear between. Works in either direction. */
function band(value: number, good: number, bad: number): number {
  if (good === bad) return 100;
  const t = (value - bad) / (good - bad);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

/** 100 inside the zone, falling off outside it. */
function zoneScore(value: number, [lo, hi]: [number, number]): number {
  if (value >= lo && value <= hi) return 100;
  const distance = value < lo ? lo - value : value - hi;
  const width = (hi - lo) / 2;
  return Math.round(Math.max(0, 1 - distance / Math.max(width, 1)) * 100);
}

function clock(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

// --- per-frame geometry ----------------------------------------------

interface Hand {
  x: number;
  y: number;
}

interface FrameGeometry {
  t: number;
  /** Shoulder midpoint, in frame units. */
  torsoX: number;
  torsoY: number;
  shoulderWidth: number;
  /** Nose offset from the shoulder midpoint, in shoulder-widths. */
  headX: number;
  headY: number;
  /**
   * Wrists tracked SEPARATELY, in shoulder-widths from the torso centre.
   * A mean of the two would cancel: hands moving apart and back — the
   * single most common speaking gesture there is — nets to zero movement
   * and scores as parked hands.
   */
  leftHand: Hand | null;
  rightHand: Hand | null;
  eyeLine: boolean;
}

/** Was either wrist in frame? */
function handsPresent(g: FrameGeometry): boolean {
  return g.leftHand !== null || g.rightHand !== null;
}

/**
 * Mean per-wrist travel between two frames, in shoulder-widths per
 * second. Null when no wrist was trackable across both frames.
 */
function handSpeed(
  a: FrameGeometry,
  b: FrameGeometry,
  dt: number
): number | null {
  if (dt <= 0) return null;
  const travel: number[] = [];
  if (a.leftHand && b.leftHand) {
    travel.push(Math.hypot(b.leftHand.x - a.leftHand.x, b.leftHand.y - a.leftHand.y));
  }
  if (a.rightHand && b.rightHand) {
    travel.push(
      Math.hypot(b.rightHand.x - a.rightHand.x, b.rightHand.y - a.rightHand.y)
    );
  }
  if (travel.length === 0) return null;
  return travel.reduce((x, y) => x + y, 0) / travel.length / dt;
}

/**
 * Reduce a frame to the handful of scale-free numbers the score needs.
 * Returns null when there isn't a torso to measure against — a frame
 * without shoulders isn't a bad frame, it's not a frame.
 */
export function geometry(f: PoseFrame): FrameGeometry | null {
  const ls = f.leftShoulder;
  const rs = f.rightShoulder;
  if (!visible(ls) || !visible(rs)) return null;

  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (shoulderWidth < 0.03) return null; // too far away to measure

  const torsoX = (ls.x + rs.x) / 2;
  const torsoY = (ls.y + rs.y) / 2;

  const nose = visible(f.nose) ? f.nose : null;
  const headX = nose ? (nose.x - torsoX) / shoulderWidth : 0;
  const headY = nose ? (nose.y - torsoY) / shoulderWidth : 0;

  const wrist = (w: Point | null): Hand | null =>
    visible(w, 0.6)
      ? { x: (w.x - torsoX) / shoulderWidth, y: (w.y - torsoY) / shoulderWidth }
      : null;

  return {
    t: f.t,
    torsoX,
    torsoY,
    shoulderWidth,
    headX,
    headY,
    leftHand: wrist(f.leftWrist),
    rightHand: wrist(f.rightWrist),
    eyeLine: eyeLineUp(f, shoulderWidth),
  };
}

/**
 * Is the eye-line up and facing the camera in this frame?
 *
 * Pitch proxy: how far the nose sits below the eye line, in
 * shoulder-widths. Tip the head forward and that gap foreshortens toward
 * zero. Yaw proxy: the nose sitting off-centre between the two ears.
 * Neither is a gaze tracker and we don't claim one — this measures where
 * the head is pointed, which is what the camera can honestly see.
 */
export function eyeLineUp(f: PoseFrame, shoulderWidth: number): boolean {
  const le = f.leftEye;
  const re = f.rightEye;
  const nose = f.nose;
  if (!visible(nose) || !visible(le) || !visible(re)) return false;

  const eyeMidY = (le.y + re.y) / 2;
  const pitch = (nose.y - eyeMidY) / shoulderWidth;
  if (pitch < PITCH_FLOOR) return false;

  const lear = f.leftEar;
  const rear = f.rightEar;
  if (visible(lear, 0.4) && visible(rear, 0.4)) {
    const yaw =
      (Math.abs(nose.x - lear.x) - Math.abs(nose.x - rear.x)) / shoulderWidth;
    if (Math.abs(yaw) > YAW_TOLERANCE) return false;
  }
  return true;
}

// --- the score -------------------------------------------------------

export function scorePresence(frames: PoseFrame[]): PresenceResult {
  const geo = frames
    .map(geometry)
    .filter((g): g is FrameGeometry => g !== null);

  const empty: PresenceResult = {
    metrics: {
      gestureRate: 0,
      postureDrift: 0,
      headStability: 0,
      eyeLinePct: 0,
      presenceScore: 0,
    },
    dimensions: [],
    moments: [],
    usableFrames: geo.length,
    scorable: false,
  };
  if (geo.length < MIN_USABLE_FRAMES) return empty;

  const durationS = Math.max(1, geo[geo.length - 1].t - geo[0].t);

  // --- gestures: count movement bursts, not displacement -------------
  let gestures = 0;
  let burst = 0;
  for (let i = 1; i < geo.length; i++) {
    const speed = handSpeed(geo[i - 1], geo[i], geo[i].t - geo[i - 1].t);
    if (speed === null) {
      burst = 0;
      continue;
    }
    if (speed >= GESTURE_SPEED) {
      burst++;
      if (burst === GESTURE_MIN_FRAMES) gestures++;
    } else {
      burst = 0;
    }
  }
  const gestureRate = round1((gestures / durationS) * 60);

  // --- posture and head: wander from their own centre ----------------
  const scale = median(geo.map((g) => g.shoulderWidth)) || 1;
  const postureDrift = round3(
    meanAbsDeviation(geo.map((g) => g.torsoY / scale)) +
      meanAbsDeviation(geo.map((g) => g.torsoX / scale))
  );
  const headStability = round3(
    meanAbsDeviation(geo.map((g) => g.headX)) +
      meanAbsDeviation(geo.map((g) => g.headY))
  );

  // --- eye line ------------------------------------------------------
  const eyeLinePct = Math.round(
    (geo.filter((g) => g.eyeLine).length / geo.length) * 100
  );

  const dimensions: PresenceDimension[] = [
    {
      key: "eyes",
      label: "Eye line",
      score: band(eyeLinePct, EYE_GOOD, EYE_BAD),
      value: `${eyeLinePct}%`,
      note: `Head up and facing the camera in ${eyeLinePct}% of frames.`,
    },
    {
      key: "posture",
      label: "Posture",
      score: band(postureDrift, POSTURE_GOOD, POSTURE_BAD),
      value: postureDrift.toFixed(2),
      note: `Torso wandered ${postureDrift.toFixed(2)} shoulder-widths from centre on average.`,
    },
    {
      key: "gesture",
      label: "Gesture",
      score: zoneScore(gestureRate, GESTURE_ZONE),
      value: `${gestureRate}/min`,
      note:
        gestureRate < GESTURE_ZONE[0]
          ? `${gestureRate} gestures a minute — hands were mostly parked.`
          : gestureRate > GESTURE_ZONE[1]
            ? `${gestureRate} gestures a minute — busier than the words needed.`
            : `${gestureRate} gestures a minute, inside the ${GESTURE_ZONE[0]}–${GESTURE_ZONE[1]} zone.`,
    },
    {
      key: "head",
      label: "Head",
      score: band(headStability, HEAD_GOOD, HEAD_BAD),
      value: headStability.toFixed(2),
      note: `Head moved ${headStability.toFixed(2)} shoulder-widths relative to your shoulders.`,
    },
  ];

  // Four dimensions, 250 each — the same shape as the Index, so the two
  // numbers beside each other mean the same kind of thing.
  const presenceScore = dimensions.reduce(
    (sum, d) => sum + Math.round(d.score * 2.5),
    0
  );

  return {
    metrics: {
      gestureRate,
      postureDrift,
      headStability,
      eyeLinePct,
      presenceScore,
    },
    dimensions,
    moments: findMoments(geo),
    usableFrames: geo.length,
    scorable: true,
  };
}

/**
 * The timestamped moments — "0:47 — you looked down for 6s". Pro surface,
 * but the same rule as every other claim in the app: it names a second
 * and a duration, or it doesn't ship.
 */
function findMoments(geo: FrameGeometry[]): DeliveryMoment[] {
  const moments: DeliveryMoment[] = [];

  runs(geo, (g) => !g.eyeLine).forEach(([from, to]) => {
    const seconds = to - from;
    if (seconds >= EYES_DOWN_MIN_S) {
      moments.push({
        t: from,
        seconds: Math.round(seconds),
        kind: "eyes-down",
        note: `${clock(from)} — eyes left the camera for ${Math.round(seconds)}s.`,
      });
    }
  });

  runs(geo, (g) => !handsPresent(g)).forEach(([from, to]) => {
    const seconds = to - from;
    if (seconds >= HANDS_GONE_MIN_S) {
      moments.push({
        t: from,
        seconds: Math.round(seconds),
        kind: "hands-gone",
        note: `${clock(from)} — hands out of frame for ${Math.round(seconds)}s.`,
      });
    }
  });

  // Slouch is measured against where you started, not against an ideal
  // posture — we have no idea what your spine should look like, only
  // whether it left where it was.
  const baseline = median(geo.slice(0, 20).map((g) => g.torsoY));
  const scale = median(geo.map((g) => g.shoulderWidth)) || 1;
  runs(geo, (g) => (g.torsoY - baseline) / scale > SLOUCH_DRIFT).forEach(
    ([from, to]) => {
      const seconds = to - from;
      if (seconds >= EYES_DOWN_MIN_S) {
        moments.push({
          t: from,
          seconds: Math.round(seconds),
          kind: "slouch",
          note: `${clock(from)} — you sank below where you started and stayed there ${Math.round(seconds)}s.`,
        });
      }
    }
  );

  // Stillness is a stretch with no gesture in it, not a low average.
  // Averaging would fire on almost everyone: a speaker who gestures
  // fifteen times a minute has still hands most of the time by
  // definition, and calling that "parked" would be a false claim.
  const moving = movingFrames(geo);
  runs(geo, (g, i) => handsPresent(g) && !moving[i]).forEach(([from, to]) => {
    if (to - from < STILLNESS_MIN_S) return;
    moments.push({
      t: from,
      seconds: Math.round(to - from),
      kind: "stillness",
      note: `${clock(from)} — hands didn't move for ${Math.round(to - from)}s.`,
    });
  });

  return moments.sort((a, b) => a.t - b.t);
}

/** Per-frame: were the hands travelling fast enough to be gesturing? */
function movingFrames(geo: FrameGeometry[]): boolean[] {
  const moving = new Array<boolean>(geo.length).fill(false);
  for (let i = 1; i < geo.length; i++) {
    const speed = handSpeed(geo[i - 1], geo[i], geo[i].t - geo[i - 1].t);
    if (speed !== null && speed >= GESTURE_SPEED) {
      moving[i] = true;
      moving[i - 1] = true;
    }
  }
  return moving;
}

/** Contiguous [startT, endT] spans where the predicate holds. */
function runs(
  geo: FrameGeometry[],
  predicate: (g: FrameGeometry, i: number) => boolean
): [number, number][] {
  const spans: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < geo.length; i++) {
    const on = predicate(geo[i], i);
    if (on && start === null) start = geo[i].t;
    if (!on && start !== null) {
      spans.push([start, geo[i].t]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, geo[geo.length - 1].t]);
  return spans;
}

// --- live feedback (free tier) ---------------------------------------

export type RingState = "ok" | "eyes" | "slouch" | "hands";

/**
 * The live in-rep ring — free for everyone (§2). Pose detection is local
 * and costs nothing to serve, and this is the part that feels like magic
 * in the first thirty seconds. What's behind the paywall is the readout
 * afterwards, not the sensation of being seen.
 *
 * Reads a trailing window so a single dropped frame or one glance at the
 * ceiling doesn't flash the ring.
 */
export function ringState(
  frames: PoseFrame[],
  windowS = 1.2
): RingState {
  if (frames.length === 0) return "ok";
  const now = frames[frames.length - 1].t;
  const window = frames
    .filter((f) => f.t >= now - windowS)
    .map(geometry)
    .filter((g): g is FrameGeometry => g !== null);
  if (window.length < 3) return "ok";

  const down = window.filter((g) => !g.eyeLine).length / window.length;
  if (down > 0.6) return "eyes";

  const all = frames.map(geometry).filter((g): g is FrameGeometry => g !== null);
  const baseline = median(all.slice(0, 20).map((g) => g.torsoY));
  const scale = median(all.map((g) => g.shoulderWidth)) || 1;
  const sunk =
    window.filter((g) => (g.torsoY - baseline) / scale > SLOUCH_DRIFT).length /
    window.length;
  if (sunk > 0.7) return "slouch";

  if (window.every((g) => !handsPresent(g))) return "hands";
  return "ok";
}

/** Copy for the ring. Never scolding — it names what changed. */
export function ringNote(state: RingState): string {
  switch (state) {
    case "eyes":
      return "Eyes down";
    case "slouch":
      return "Sinking";
    case "hands":
      return "Hands out of frame";
    default:
      return "";
  }
}

// --- persistence shape -----------------------------------------------

/** Row shape for `reps.delivery_metrics`. Snake case, five numbers, done. */
export function toRow(m: DeliveryMetrics) {
  return {
    gesture_rate: m.gestureRate,
    posture_drift: m.postureDrift,
    head_stability: m.headStability,
    eye_line_pct: m.eyeLinePct,
    presence_score: m.presenceScore,
  };
}

export function fromRow(
  row: Record<string, number> | null | undefined
): DeliveryMetrics | null {
  if (!row) return null;
  return {
    gestureRate: row.gesture_rate ?? 0,
    postureDrift: row.posture_drift ?? 0,
    headStability: row.head_stability ?? 0,
    eyeLinePct: row.eye_line_pct ?? 0,
    presenceScore: row.presence_score ?? 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
