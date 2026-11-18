/**
 * The introduction's small sounds (#501, Timothy, 18 Nov: "it needs more
 * pop in the text sound"). Synthesised like the room's pops
 * (lib/room-sound.ts) and the celebration chime (lib/sfx.ts): no audio
 * file, nothing to download, nothing fetched.
 *
 * Two sounds, both quiet:
 *
 *   talk   a blip under each word Demos says as it pops in: a sine a
 *          few milliseconds up and about thirty-five down, its pitch
 *          falling a little and moved a few percent each time, so a line
 *          of them is a voice and not a machine. Under reduced motion a
 *          line lands whole, and so does its sound: one blip a line.
 *   pick   two soft rising notes when an answer is chosen.
 *
 * Where they may sound:
 *
 *  - only with the app's Sound on (Settings, Accessibility, Sound:
 *    `prefs.sound`, the same switch the room's pops and the chime obey);
 *  - only once a tap has unlocked them: a phone plays nothing from an
 *    audio context no gesture started, so `unlockIntroSound` runs inside
 *    the first tap on /welcome (any tap: Not now, the hold, a Next) and
 *    every blip before it is silently dropped, never queued;
 *  - never past an iPhone's ring/silent switch. Web Audio on an iPhone
 *    follows the switch by default, and the walk also asks for the
 *    "ambient" audio session (lib/audio-session.ts, iOS 16.4 and on) on
 *    every question screen, which mixes with whatever else is playing
 *    and stays silent with the switch on. A muted iPhone hears nothing;
 *    the words still pop.
 *  - never while a mic is open. No question screen opens one; the room,
 *    which does, plays its own pops through this same context and keeps
 *    them off its turns (components/room/Room.tsx).
 *
 * One context for the whole walk: the room borrows it for its pops and
 * its mic's level (`createPopper(introContext())`) and leaves it open, so
 * the name question after the room can talk without another tap.
 */

import { readPrefs } from "./prefs";

export type Rng = () => number;

export type Blip = {
  type: "sine" | "triangle";
  /** Hz at the start, falling to `endFreq` by the end of the decay. */
  freq: number;
  endFreq: number;
  /** Gain at the top: quiet, under speech and over silence. */
  peak: number;
  attackS: number;
  decayS: number;
  /** Seconds after now: the pick's second note waits for its first. */
  at: number;
};

/** Demos's voice: a little brighter than the room's pop for him, and quieter. */
export const TALK = { type: "sine", freq: 600, endFreq: 470, peak: 0.032, attackS: 0.004, decayS: 0.036, spread: 0.07 } as const;

/** An answer chosen: two notes a fifth apart, rising. */
export const PICK = [
  { type: "triangle", freq: 587, endFreq: 587, peak: 0.03, attackS: 0.004, decayS: 0.07, at: 0 },
  { type: "triangle", freq: 880, endFreq: 880, peak: 0.028, attackS: 0.004, decayS: 0.1, at: 0.055 },
] as const satisfies readonly Blip[];

/** The rounding filter over every blip: a phone speaker is shrill up there. */
export const LOWPASS_HZ = 2600;

/** One talk blip: the voice's tone with its pitch moved a little. */
export function talkBlip(rng: Rng = Math.random): Blip {
  const k = 1 + (rng() * 2 - 1) * TALK.spread;
  return {
    type: TALK.type,
    freq: TALK.freq * k,
    endFreq: TALK.endFreq * k,
    peak: TALK.peak,
    attackS: TALK.attackS,
    decayS: TALK.decayS,
    at: 0,
  };
}

type AudioContextCtor = new () => AudioContext;

let ctx: AudioContext | null = null;

function ctor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** The walk's context, if a tap has made one. */
export function introContext(): AudioContext | null {
  return ctx && ctx.state !== "closed" ? ctx : null;
}

/**
 * Inside a tap: make the context if there is none, wake it if the phone
 * paused it, and on first making it play one silent sample, which an
 * older iPhone needs before it lets a context sound later. Returns the
 * context, or null where there is no Web Audio (the walk plays on, mute).
 * Cheap to call on every tap: an awake context is left alone.
 */
export function unlockIntroSound(): AudioContext | null {
  if (!introContext()) {
    const C = ctor();
    try {
      ctx = C ? new C() : null;
    } catch {
      ctx = null;
    }
    if (ctx) {
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {}
    }
  }
  const c = introContext();
  if (c && c.state !== "running") void c.resume().catch(() => {});
  return c;
}

/** Whether a blip may sound now: Sound on, and a running context. */
function live(): AudioContext | null {
  const c = introContext();
  if (!c || c.state !== "running") return null;
  if (!readPrefs().sound) return null;
  return c;
}

function play(c: AudioContext, b: Blip): void {
  const at = c.currentTime + 0.005 + b.at;
  const end = at + b.attackS + b.decayS;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(b.peak, at + b.attackS);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = LOWPASS_HZ;
  const o = c.createOscillator();
  o.type = b.type;
  o.frequency.setValueAtTime(b.freq, at);
  if (b.endFreq !== b.freq) o.frequency.exponentialRampToValueAtTime(b.endFreq, end);
  o.connect(g).connect(lp).connect(c.destination);
  o.start(at);
  o.stop(end + 0.03);
  o.onended = () => {
    try {
      lp.disconnect();
    } catch {}
  };
}

/** A word landing in Demos's bubble. */
export function playTalk(): void {
  const c = live();
  if (!c) return;
  try {
    play(c, talkBlip());
  } catch {}
}

/** An answer chosen. */
export function playPick(): void {
  const c = live();
  if (!c) return;
  try {
    for (const b of PICK) play(c, b);
  } catch {}
}
