/**
 * The pop under each chunk of a streamed line (#475, Timothy: "every
 * stream is like pop, like that stream text sound"). Synthesised, as
 * the celebration chime is (lib/sfx.ts): no audio file, nothing fetched.
 *
 * A pop is a sine a few milliseconds up and about forty down, its pitch
 * falling a little as it goes, which is what makes it round rather than
 * a beep, and its starting pitch moved a few percent each time so a
 * line of them never sounds like a machine. The interviewer's is
 * brighter; Demos's is lower and softer.
 *
 * Where it may sound:
 *  - only with the app's Sound on (Settings, `prefs.sound`);
 *  - never past the phone's silent switch: the page asks for the
 *    "ambient" audio session where the browser has one
 *    (lib/audio-session.ts), and Web Audio on an iPhone without it
 *    follows the switch anyway;
 *  - never while the mic is open: the flow closes the mic before a line
 *    streams (components/room/Room.tsx).
 *
 * The context is made, and resumed, inside the hold that opens the
 * room: an iPhone plays nothing from a context no gesture started.
 */

import { setAudioSession } from "./audio-session";
import { readPrefs } from "./prefs";
import type { Rng } from "./text-stream";

export type PopVoice = "him" | "demos";

export type PopTone = {
  type: "sine" | "triangle";
  /** Hz at the start, then falling to `endFreq` over the decay. */
  freq: number;
  endFreq: number;
  /** Gain at the top: quiet, under speech and over silence. */
  peak: number;
  attackS: number;
  decayS: number;
  /** Rounds off whatever a phone speaker would make shrill. */
  lowpass: number;
};

export const POP: Record<PopVoice, PopTone & { spread: number }> = {
  him: { type: "sine", freq: 760, endFreq: 560, peak: 0.07, attackS: 0.004, decayS: 0.042, lowpass: 3200, spread: 0.06 },
  demos: { type: "sine", freq: 520, endFreq: 420, peak: 0.05, attackS: 0.006, decayS: 0.055, lowpass: 2200, spread: 0.05 },
};

/** This pop: the voice's tone with its pitch moved a little. */
export function popTone(voice: PopVoice, rng: Rng = Math.random): PopTone {
  const { spread, ...base } = POP[voice];
  const k = 1 + (rng() * 2 - 1) * spread;
  return { ...base, freq: base.freq * k, endFreq: base.endFreq * k };
}

export type Popper = {
  /** A pop now, if sound may play. */
  pop: (voice: PopVoice) => void;
  /** The context the mic's level is read through (lib/room-media.ts). */
  context: AudioContext | null;
  /** Wakes a context the phone paused (after the mic, say). */
  wake: () => void;
  close: () => void;
};

type AudioContextCtor = new () => AudioContext;

/**
 * Called inside the gesture. Makes the context, resumes it and plays one
 * silent sample, which is what an older iPhone needs to let it sound
 * later. Without Web Audio (a native shell, an old browser) every pop is
 * a quiet no-op and the scene plays on.
 */
export function createPopper(): Popper {
  const Ctor: AudioContextCtor | undefined =
    typeof window === "undefined"
      ? undefined
      : ((window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  let ctx: AudioContext | null = null;
  try {
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
  setAudioSession("ambient");
  const wake = () => {
    if (ctx && ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
  };
  if (ctx) {
    wake();
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {}
  }
  return {
    context: ctx,
    wake,
    pop(voice) {
      if (!ctx || !readPrefs().sound) return;
      if (ctx.state !== "running") {
        wake();
        return;
      }
      try {
        const t = popTone(voice);
        const at = ctx.currentTime + 0.005;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(t.peak, at + t.attackS);
        g.gain.exponentialRampToValueAtTime(0.0001, at + t.attackS + t.decayS);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = t.lowpass;
        const o = ctx.createOscillator();
        o.type = t.type;
        o.frequency.setValueAtTime(t.freq, at);
        o.frequency.exponentialRampToValueAtTime(t.endFreq, at + t.attackS + t.decayS);
        o.connect(g).connect(lp).connect(ctx.destination);
        o.start(at);
        o.stop(at + t.attackS + t.decayS + 0.03);
        o.onended = () => {
          try {
            lp.disconnect();
          } catch {}
        };
      } catch {}
    },
    close() {
      setAudioSession("auto");
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      ctx = null;
    },
  };
}
