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
 * The voice is from the sound-design research pass (#138–#139,
 * docs/sound-research.md): earcon guidelines say instrument-like
 * timbres beat raw tones, so each note is a triangle fundamental
 * (+3 cents, the detune fakes a struck mallet's complexity) with a
 * quiet sine an octave up, through a 180–2200 Hz band. D major, low
 * register — warm on a phone speaker, and deliberately not Duolingo's
 * F# grammar. Rising contour and major mode are the replicated
 * positive-valence findings; the fail sound doesn't exist because
 * failure states don't either.
 *
 * The daily chime is the rising triad, left OPEN on the fifth — the
 * copy under it says "Same time tomorrow". Milestones (7/14/30) land
 * the octave: resolved, longer, and capped at the same peak — a
 * milestone says more, never shouts more (the slot-machine literature
 * is what louder-on-bigger trains people into).
 */

import { readPrefs } from "./prefs";

export interface ChimeNote {
  /** Fundamental, Hz. Kept inside 250–1200 — the phone-speaker band. */
  freq: number;
  /** Seconds after the chime starts. */
  at: number;
  /** Peak gain for this note, pre-master. */
  peak: number;
  /** Exponential decay to silence, seconds. */
  decay: number;
}

/** One knob scales everything — ≈ −12 dB, under speech, over silence. */
export const MASTER_GAIN = 0.25;

/** D4 → F#4 → A4. The daily chime: rising, open, done in half a second. */
export const CHIME: ChimeNote[] = [
  { freq: 293.66, at: 0, peak: 0.4, decay: 0.25 },
  { freq: 369.99, at: 0.09, peak: 0.45, decay: 0.25 },
  { freq: 440.0, at: 0.18, peak: 0.5, decay: 0.35 },
];

/** Milestones land D5 — resolved and longer, never louder. */
export const MILESTONE_CHIME: ChimeNote[] = [
  { freq: 293.66, at: 0, peak: 0.4, decay: 0.25 },
  { freq: 369.99, at: 0.09, peak: 0.45, decay: 0.25 },
  { freq: 440.0, at: 0.18, peak: 0.5, decay: 0.25 },
  { freq: 587.33, at: 0.32, peak: 0.5, decay: 0.6 },
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
  master.gain.value = MASTER_GAIN;
  // The band a phone speaker can actually say: lows it can't move
  // stripped at 180, the shrill region shelved at 2200.
  const low = c.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 180;
  const high = c.createBiquadFilter();
  high.type = "lowpass";
  high.frequency.value = 2200;
  high.Q.value = 0.7;
  master.connect(low).connect(high).connect(c.destination);

  for (const n of notes) {
    const at = t0 + n.at;
    const g = c.createGain();
    // Struck, not switched: 8ms to peak, then the long fall.
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(n.peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + n.decay);
    g.connect(master);

    // Fundamental, nudged +3 cents — dead-on pitch reads synthetic.
    const fundamental = c.createOscillator();
    fundamental.type = "triangle";
    fundamental.frequency.value = n.freq * Math.pow(2, 3 / 1200);
    fundamental.connect(g);
    fundamental.start(at);
    fundamental.stop(at + n.decay + 0.05);

    // A quiet octave partial — the difference between a tone and a bell.
    const partial = c.createOscillator();
    partial.type = "sine";
    partial.frequency.value = n.freq * 2;
    const pg = c.createGain();
    pg.gain.value = 0.25;
    partial.connect(pg).connect(g);
    partial.start(at);
    partial.stop(at + n.decay + 0.05);
  }

  const total = chimeDuration(notes);
  setTimeout(() => {
    try {
      master.disconnect();
    } catch {}
  }, (total + 0.3) * 1000);
}
