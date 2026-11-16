/**
 * Alright or horrible, from the microphone's level and nothing else
 * (#475, Timothy, 12 Nov: "Long silences or barely speaking is
 * horrible, steady speech is alright"). Nothing is recorded, nothing is
 * sent and no number is shown: the room keeps a trace of how loud each
 * frame was, in the phone's memory, for the length of the scene.
 *
 * Two parts, both pure:
 *  - `createVoiceGate`, live during a turn: is there voice now, has
 *    speech started, and has the turn ended (quiet once speech started,
 *    the cap, or no voice at all).
 *  - `roomVerdict`, once both turns are over: the share of each turn
 *    with voice above an adaptive noise floor and the seconds voiced.
 *
 * The floor adapts because the room a phone is in does: a fan, a café
 * or a quiet bedroom each set where silence sits, and voice is measured
 * against that, not against zero.
 */

import { TURN, type RoomVerdict, type TurnRule } from "./room-script";

/** One frame's level: RMS of the time-domain signal, 0 to 1. */
export type LevelSample = { at: number; level: number };

/** One turn's frames, `at` in ms from the turn's start. */
export type TurnTrace = { samples: LevelSample[] };

export const VOICE = {
  /** The floor is the quietest tenth of the frames heard. */
  floorPercentile: 0.1,
  floorMin: 0.0005,
  floorMax: 0.03,
  /** Voice is this many times the floor (about 9.5 dB) ... */
  ratio: 3,
  /** ... and at least this far over it ... */
  margin: 0.004,
  /** ... and never under this, whatever the floor. */
  minLevel: 0.006,
  /** A voiced frame carries this long, across the dips inside a word. */
  hangoverMs: 120,
  /** A gap between frames longer than this (a hidden tab) counts as this. */
  maxDtMs: 100,
  /** Voice for this long, in all, before speech has started. */
  startMs: 200,
} as const;

/** Alright needs every one of these. */
export const VERDICT = {
  /** Seconds voiced over both turns. */
  minTotalVoicedMs: 5000,
  /** Seconds voiced in each turn: one barely answered is horrible. */
  minTurnVoicedMs: 1500,
  /** The silence before a turn's first word. */
  maxStartMs: 4000,
  /** Voice over the time from the turn's start to its last word. */
  minShare: 0.4,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where silence sits in these frames: their quietest tenth. */
export function noiseFloor(levels: readonly number[]): number {
  if (levels.length === 0) return VOICE.floorMin;
  const sorted = [...levels].sort((a, b) => a - b);
  const k = Math.min(sorted.length - 1, Math.floor(sorted.length * VOICE.floorPercentile));
  return clamp(sorted[k], VOICE.floorMin, VOICE.floorMax);
}

/** The level a frame needs to count as voice over this floor. */
export function voiceThreshold(floor: number): number {
  return Math.max(floor * VOICE.ratio, floor + VOICE.margin, VOICE.minLevel);
}

export type TurnReading = {
  /** Time with voice, hangover included. */
  voicedMs: number;
  /** From the turn's start to the end of its last voice; 0 if none. */
  spanMs: number;
  /** voicedMs over spanMs, 0 with no voice. */
  share: number;
  /** When the first voice came, or null. */
  startMs: number | null;
};

/** One turn, read against a threshold. */
export function readTurn(trace: TurnTrace, threshold: number): TurnReading {
  let voicedMs = 0;
  let startMs: number | null = null;
  let lastVoiceEnd = 0;
  let carryUntil = -Infinity;
  let prevAt = trace.samples[0]?.at ?? 0;
  for (const s of trace.samples) {
    const dt = clamp(s.at - prevAt, 0, VOICE.maxDtMs);
    prevAt = s.at;
    const loud = s.level >= threshold;
    if (loud) {
      if (startMs === null) startMs = Math.max(0, s.at - dt);
      carryUntil = s.at + VOICE.hangoverMs;
    }
    if (loud || s.at <= carryUntil) {
      voicedMs += dt;
      lastVoiceEnd = s.at;
    }
  }
  const spanMs = startMs === null ? 0 : lastVoiceEnd;
  return { voicedMs, spanMs, share: spanMs > 0 ? Math.min(1, voicedMs / spanMs) : 0, startMs };
}

/** Both turns read, against one floor heard over the whole scene. */
export function readTurns(turns: readonly TurnTrace[]): { floor: number; threshold: number; turns: TurnReading[] } {
  const floor = noiseFloor(turns.flatMap((t) => t.samples.map((s) => s.level)));
  const threshold = voiceThreshold(floor);
  return { floor, threshold, turns: turns.map((t) => readTurn(t, threshold)) };
}

/**
 * The verdict. Horrible for barely speaking (too little voice in all,
 * or in either turn), for a long silence before answering, or for
 * speech broken by long silences (a low share); alright for steady
 * speech. With no turns at all there was nothing to hear: horrible.
 */
export function roomVerdict(turns: readonly TurnTrace[]): RoomVerdict {
  if (turns.length === 0) return "horrible";
  const { turns: read } = readTurns(turns);
  const total = read.reduce((s, r) => s + r.voicedMs, 0);
  const span = read.reduce((s, r) => s + r.spanMs, 0);
  if (total < VERDICT.minTotalVoicedMs) return "horrible";
  if (read.some((r) => r.voicedMs < VERDICT.minTurnVoicedMs)) return "horrible";
  if (read.some((r) => r.startMs === null || r.startMs > VERDICT.maxStartMs)) return "horrible";
  if (span <= 0 || total / span < VERDICT.minShare) return "horrible";
  return "alright";
}

export type GateEnd = "silence" | "cap" | "wait";

export type GateState = {
  /** Voice in this frame (hangover included). */
  voiced: boolean;
  /** Enough voice has come for speech to have started. */
  started: boolean;
  /** Quiet since the last voice, once started. */
  silentMs: number;
  /** 0 to 1 for the level meter: how far over the floor, in decibels. */
  meter: number;
  /** Why the turn is over, or null while it runs. */
  ended: GateEnd | null;
};

/**
 * The live half: fed every frame of a turn, it says whether the turn is
 * over. Its floor falls at once to a quieter frame and climbs slowly
 * (half again a second), so the gaps between words keep finding the
 * room's silence even while someone speaks.
 */
export function createVoiceGate(rule: TurnRule = TURN) {
  let floor: number | null = null;
  let prevAt: number | null = null;
  let carryUntil = -Infinity;
  let voicedTotal = 0;
  let started = false;
  let lastVoiceAt = 0;
  let ended: GateEnd | null = null;
  return {
    push(level: number, at: number): GateState {
      const dt = prevAt === null ? 0 : clamp(at - prevAt, 0, VOICE.maxDtMs);
      prevAt = at;
      if (floor === null) floor = clamp(level, VOICE.floorMin, VOICE.floorMax);
      else if (level < floor) floor = clamp(floor + (level - floor) * 0.5, VOICE.floorMin, VOICE.floorMax);
      else floor = clamp(Math.min(level, floor * Math.pow(1.5, dt / 1000)), VOICE.floorMin, VOICE.floorMax);
      const threshold = voiceThreshold(floor);
      const loud = level >= threshold;
      if (loud) carryUntil = at + VOICE.hangoverMs;
      const voiced = loud || at <= carryUntil;
      if (voiced) {
        voicedTotal += dt;
        lastVoiceAt = at;
      }
      if (!started && voicedTotal >= VOICE.startMs) started = true;
      const silentMs = started ? at - lastVoiceAt : 0;
      if (ended === null) {
        if (started && silentMs >= rule.silenceMs) ended = "silence";
        else if (at >= rule.capMs) ended = "cap";
        else if (!started && at >= rule.waitMs) ended = "wait";
      }
      const db = level > 0 ? 20 * Math.log10(level / floor) : 0;
      const meter = clamp((db - 6) / 30, 0, 1);
      return { voiced, started, silentMs, meter, ended };
    },
  };
}
