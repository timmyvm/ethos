/**
 * The celebration chime, synthesised — same doctrine as crowd-noise.ts:
 * no audio asset to ship, no CDN request, works offline.
 *
 * Sound follows amber's rule (DECISIONS #65): it means "you earned
 * this", so it fires at the streak celebration and nowhere else — one
 * sound per rep, mirroring the one celebration per rep (#34). Nothing
 * here may ever run while the mic is hot: the envelope samples every
 * gap during a rep (lib/envelope.ts), and a chime through the speakers
 * would be scored as a sound you made. The only call site is the
 * celebration overlay, which exists only in the results phase.
 *
 * Warmth comes from fundamentals, not brightness: sine waves, a rising
 * major triad in the C5 octave (rising pitch reads as success; the
 * major triad is the most consonant "done" there is), fast attack and
 * a long exponential decay like a struck instrument rather than a
 * beep. Every constant is a v1 guess in the same bucket as the star
 * thresholds — calibrate by ear on a real phone speaker.
 */

import { readPrefs } from "./prefs";

export interface ChimeNote {
  /** Hz. Kept inside ~500–1100 — warm on a phone speaker, never shrill. */
  freq: number;
  /** Seconds after the chime starts. */
  at: number;
  /** Peak gain for this note; the sum stays well under clipping. */
  peak: number;
  /** Exponential decay time to silence, seconds. */
  decay: number;
}

/** C5 → E5 → G5. A struck triad, done inside half a second. */
export const CHIME: ChimeNote[] = [
  { freq: 523.25, at: 0, peak: 0.14, decay: 0.4 },
  { freq: 659.25, at: 0.09, peak: 0.14, decay: 0.4 },
  { freq: 783.99, at: 0.18, peak: 0.16, decay: 0.5 },
];

/** Milestones (7/14/30) land the octave on top. Longer, never louder. */
export const MILESTONE_CHIME: ChimeNote[] = [
  ...CHIME,
  { freq: 1046.5, at: 0.3, peak: 0.16, decay: 0.6 },
];

/** Total length of a chime, for anyone timing UI against it. */
export function chimeDuration(notes: ChimeNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.at + n.decay), 0);
}

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Called from the Rec tap. Browsers only allow audio that traces back
 * to a user gesture; creating (or resuming) the context inside the tap
 * is what makes the celebration audible minutes later without a second
 * ask. Silent no-op everywhere it can't work.
 */
export function unlockSfx(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
}

/** The one sound in the product. Opt-out lives in settings. */
export function playCelebration(milestone: boolean): void {
  if (!readPrefs().sound) return;
  const c = context();
  if (!c) return;
  if (c.state === "suspended") {
    // No gesture ever unlocked audio here — give up silently rather
    // than queue a chime to fire at some unrelated later tap.
    void c.resume().catch(() => {});
    if (c.state === "suspended") return;
  }

  const notes = milestone ? MILESTONE_CHIME : CHIME;
  const t0 = c.currentTime + 0.02;

  const master = c.createGain();
  master.gain.value = 0.5;
  // A touch of lowpass keeps the triad woody rather than glassy.
  const warmth = c.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 2600;
  master.connect(warmth).connect(c.destination);

  for (const n of notes) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = n.freq;
    const g = c.createGain();
    const at = t0 + n.at;
    // Struck, not switched: 8ms to peak, then the long fall.
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(n.peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + n.decay);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + n.decay + 0.05);
  }

  const total = chimeDuration(notes);
  setTimeout(() => {
    try {
      master.disconnect();
    } catch {}
  }, (total + 0.3) * 1000);
}
