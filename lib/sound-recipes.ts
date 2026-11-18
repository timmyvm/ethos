/**
 * The sound of winning (DECISIONS #505), as a score: every sound Ethos
 * makes, written down as notes, so it can be read, tested and rendered
 * the same way every time. Nothing here touches Web Audio; `lib/sound.ts`
 * plays these, and `scripts/sound-audition.mjs` renders them to files.
 *
 * Timothy, 18 Nov: "play these sounds, but give them the dopamine ...
 * you completed a lesson ... your sound effect, bang. Casino, bang.
 * Blackjack 21 hand ... oh wow, your big payout." The arousal of a real
 * win, scaled to how big the win is, from a warm single note for one
 * star to a coin cascade on a bright major chord for three. The line
 * #140 drew stays where it was: a sound means something was earned, so
 * a take with no star is silent and nothing ever plays on a loss (the
 * harm measured in slot machines is the jingle on a loss, not the
 * fanfare on a win).
 *
 * Built so it cannot sound wrong without being heard:
 *  - one key, D major, the key the streak chime was already in, so any
 *    two sounds that overlap are consonant;
 *  - instrument-like voices (DECISIONS #139: earcon research says
 *    instrument timbres beat raw tones): each note is a stack of sine or
 *    triangle partials, the higher ones dying faster, as a struck bar or
 *    a bell does;
 *  - every pitch rises or lands on the tonic: falling pitch reads as
 *    failure, and failure has no sound;
 *  - fundamentals from 290 Hz up, the band a phone speaker can say;
 *  - one deterministic random source (a fixed seed), so the coin
 *    cascade's scatter is the same on every phone and in every test.
 */

/** A note's tone colour: partials as ratios of the fundamental. */
export type Voice = "mallet" | "bell" | "glass" | "coin" | "brass" | "pad" | "tick" | "sweep";

export type Partial = {
  /** Frequency as a multiple of the note's. */
  ratio: number;
  /** Level against the fundamental. */
  gain: number;
  wave: "sine" | "triangle" | "sawtooth";
  /** This partial's decay as a share of the note's: higher partials die first. */
  decay: number;
  /** Cents off pitch: a dead-on oscillator reads synthetic (#139). */
  detune?: number;
};

export const VOICES: Record<Voice, readonly Partial[]> = {
  /** A struck wooden bar: warm, short. One star. */
  mallet: [
    { ratio: 1, gain: 1, wave: "triangle", decay: 1, detune: 3 },
    { ratio: 2, gain: 0.22, wave: "sine", decay: 0.55 },
    { ratio: 4, gain: 0.07, wave: "sine", decay: 0.2 },
  ],
  /** A small bell: clear, with a slightly stretched top. */
  bell: [
    { ratio: 1, gain: 1, wave: "sine", decay: 1 },
    { ratio: 2, gain: 0.42, wave: "sine", decay: 0.75 },
    { ratio: 3, gain: 0.16, wave: "sine", decay: 0.5, detune: 4 },
    { ratio: 4.2, gain: 0.08, wave: "sine", decay: 0.3 },
  ],
  /** A glass bell: the bell with more air on top. The third star, the landings. */
  glass: [
    { ratio: 1, gain: 1, wave: "sine", decay: 1 },
    { ratio: 2, gain: 0.5, wave: "sine", decay: 0.8 },
    { ratio: 3, gain: 0.24, wave: "sine", decay: 0.55, detune: 3 },
    { ratio: 4.2, gain: 0.13, wave: "sine", decay: 0.35 },
    { ratio: 5.4, gain: 0.06, wave: "sine", decay: 0.22 },
  ],
  /** A coin: a bright ping, every harmonic, gone in a breath. */
  coin: [
    { ratio: 1, gain: 1, wave: "sine", decay: 1 },
    { ratio: 2, gain: 0.5, wave: "sine", decay: 0.7 },
    { ratio: 3, gain: 0.3, wave: "sine", decay: 0.5 },
    { ratio: 4, gain: 0.16, wave: "sine", decay: 0.35 },
    { ratio: 5, gain: 0.08, wave: "sine", decay: 0.25 },
  ],
  /** Two saws a few cents apart under a closing filter: a brass section's stab. */
  brass: [
    { ratio: 1, gain: 1, wave: "sawtooth", decay: 1, detune: -6 },
    { ratio: 1, gain: 0.8, wave: "sawtooth", decay: 1, detune: 6 },
    { ratio: 2, gain: 0.18, wave: "triangle", decay: 0.8 },
  ],
  /** A soft chord bed: detuned triangles, slow in. */
  pad: [
    { ratio: 1, gain: 1, wave: "triangle", decay: 1, detune: -5 },
    { ratio: 1, gain: 0.7, wave: "triangle", decay: 1, detune: 5 },
    { ratio: 2, gain: 0.25, wave: "sine", decay: 0.8 },
  ],
  /** A counter's click: one bright blip. */
  tick: [
    { ratio: 1, gain: 1, wave: "triangle", decay: 1 },
    { ratio: 2, gain: 0.25, wave: "sine", decay: 0.6 },
  ],
  /** A rising sweep: a sine and its octave, gliding. */
  sweep: [
    { ratio: 1, gain: 1, wave: "sine", decay: 1 },
    { ratio: 2, gain: 0.3, wave: "sine", decay: 0.6 },
  ],
};

/** Brass closes its filter as a player's lip does: wide at the attack, settling. */
export const BRASS_FILTER = { from: 2.2, peak: 5, settle: 2.6 } as const;

export type Note = {
  /** Seconds from the sound's start. */
  at: number;
  /** Hz. */
  freq: number;
  /** Gain at the top, before the sound's own gain. */
  peak: number;
  /** Seconds from the top to silence (-80 dB). */
  decay: number;
  /** Seconds to the top. Struck notes are 6ms; a pad is slower. */
  attack: number;
  voice: Voice;
  /** The pitch's end as a multiple of its start, over the note. */
  glide?: number;
  /** -1 left to 1 right. */
  pan?: number;
};

/** Filtered noise: the flame catching, the shimmer over a payout. */
export type Hiss = {
  at: number;
  /** Seconds, attack included. */
  dur: number;
  peak: number;
  /** The band's centre, Hz, swept from `from` to `to` over the hiss. */
  from: number;
  to: number;
  q: number;
  attack: number;
};

export type Recipe = {
  /** The whole sound's level. */
  gain: number;
  /** How much goes to the room (a generated reverb). */
  wet: number;
  notes: readonly Note[];
  hiss: readonly Hiss[];
};

/** Every sound in the kit, by the moment it belongs to. */
export type SoundId =
  | "star-1"
  | "star-2"
  | "star-3"
  | "payout"
  | "lesson"
  | "level"
  | "best"
  | "round"
  | "boss"
  | "streak"
  | "streak-milestone"
  | "tick";

/** Equal temperament, A4 = 440. The notes the kit uses, all in D major. */
export const PITCH = {
  D4: 293.66,
  "F#4": 369.99,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  D5: 587.33,
  E5: 659.26,
  "F#5": 739.99,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  D6: 1174.66,
  E6: 1318.51,
  "F#6": 1479.98,
  A6: 1760.0,
  B6: 1975.53,
  D7: 2349.32,
  E7: 2637.02,
} as const;

/** A fixed-seed source (mulberry32): the same scatter on every phone. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const note = (voice: Voice, freq: number, at: number, peak: number, decay: number, more: Partial2 = {}): Note => ({
  voice,
  freq,
  at,
  peak,
  decay,
  attack: more.attack ?? (voice === "pad" ? 0.035 : voice === "brass" ? 0.014 : 0.006),
  ...(more.glide ? { glide: more.glide } : {}),
  ...(more.pan !== undefined ? { pan: more.pan } : {}),
});
type Partial2 = { attack?: number; glide?: number; pan?: number };

/**
 * Coins falling: each a quick two-step ping (the note, then a fourth
 * above it 40ms on, the arcade coin's grammar), climbing D major's five
 * notes over the octave above the chord, scattered a little in time and across the
 * stereo field by the fixed seed, each a touch quieter than the last.
 */
export function coins(count: number, start: number, step: number, peak: number, seed: number): Note[] {
  const rng = seeded(seed);
  const ladder = [PITCH.D6, PITCH.E6, PITCH["F#6"], PITCH.A6, PITCH.B6];
  const out: Note[] = [];
  for (let i = 0; i < count; i++) {
    const at = start + i * step + (rng() * 2 - 1) * step * 0.22;
    /* Up the ladder and back down a little, so a long cascade keeps
       falling rather than climbing out of the speaker. */
    const rung = ladder[Math.min(ladder.length - 1, Math.floor(rng() * 2) + (i % 4))];
    const level = peak * (1 - (0.5 * i) / Math.max(1, count - 1));
    const pan = Math.round((rng() * 2 - 1) * 0.6 * 100) / 100;
    out.push(note("coin", rung, at, level * 0.7, 0.06, { pan }));
    out.push(note("coin", rung * (4 / 3), at + 0.042, level, 0.22 + rng() * 0.08, { pan }));
  }
  return out;
}

const chord = (voice: Voice, freqs: number[], at: number, peak: number, decay: number): Note[] =>
  freqs.map((f) => note(voice, f, at, peak, decay));

/** The streak's figures: the chime #139 calibrated, its landing note the count's roll (#226). */
const STREAK_FIGURE = [
  { freq: PITCH.D5, at: 0, peak: 0.28, decay: 0.25 },
  { freq: PITCH["F#5"], at: 0.09, peak: 0.3, decay: 0.25 },
  { freq: PITCH.A5, at: 0.18, peak: 0.33, decay: 0.25 },
  { freq: PITCH.D6, at: 0.32, peak: 0.46, decay: 0.6 },
];
const MILESTONE_FIGURE = [
  { freq: PITCH.D5, at: 0, peak: 0.2, decay: 0.2 },
  { freq: PITCH["F#5"], at: 0.065, peak: 0.22, decay: 0.2 },
  { freq: PITCH.A5, at: 0.13, peak: 0.24, decay: 0.2 },
  { freq: PITCH.D6, at: 0.195, peak: 0.26, decay: 0.22 },
  { freq: PITCH["F#6"], at: 0.26, peak: 0.27, decay: 0.22 },
  { freq: PITCH.A6, at: 0.325, peak: 0.28, decay: 0.25 },
  { freq: PITCH.D7, at: 0.39, peak: 0.34, decay: 0.75 },
];

/** The flame catches first; the chime comes in over it. */
const STREAK_LEAD_S = 0.06;

/**
 * Where each streak sound lands, in seconds from its start: the count
 * rolls on it (lib/streak-moment.ts `momentTimeline`), as it did on the
 * chime's landing note (#226).
 */
export const STREAK_LAND_S = {
  daily: STREAK_LEAD_S + STREAK_FIGURE[STREAK_FIGURE.length - 1].at,
  milestone: STREAK_LEAD_S + MILESTONE_FIGURE[MILESTONE_FIGURE.length - 1].at,
} as const;

/**
 * A counter's click, a step up D major's scale each time so a run of
 * them climbs, from A6 to F#7 and holding there.
 */
export const TICK_SCALE = [1760.0, 1975.53, 2217.46, 2349.32, 2637.02, 2959.96] as const;
export function tickRecipe(step = 0): Recipe {
  const freq = TICK_SCALE[Math.max(0, Math.min(TICK_SCALE.length - 1, Math.floor(step)))];
  return { gain: 0.9, wet: 0.04, notes: [note("tick", freq, 0, 0.2, 0.035, { attack: 0.001 })], hiss: [] };
}

/** The flame catching: a breath of noise swept up, three sparks in it. */
const IGNITE: Hiss[] = [
  { at: 0, dur: 0.42, peak: 0.16, from: 380, to: 2600, q: 0.8, attack: 0.07 },
  { at: 0.05, dur: 0.03, peak: 0.06, from: 3600, to: 3600, q: 5, attack: 0.002 },
  { at: 0.11, dur: 0.03, peak: 0.05, from: 4200, to: 4200, q: 5, attack: 0.002 },
  { at: 0.17, dur: 0.03, peak: 0.045, from: 3900, to: 3900, q: 5, attack: 0.002 },
];

const SHIMMER = (at: number, dur: number, peak: number): Hiss => ({ at, dur, peak, from: 6500, to: 8500, q: 1.1, attack: 0.08 });

function streak(milestone: boolean): Recipe {
  const figure = milestone ? MILESTONE_FIGURE : STREAK_FIGURE;
  const land = milestone ? STREAK_LAND_S.milestone : STREAK_LAND_S.daily;
  return {
    gain: 0.9,
    wet: 0.2,
    notes: [
      ...figure.map((n) => note("mallet", n.freq, STREAK_LEAD_S + n.at, n.peak, n.decay)),
      /* The odometer's two clicks: the place turning, and settling. */
      note("tick", TICK_SCALE[3], land, 0.12, 0.035, { attack: 0.001 }),
      note("tick", TICK_SCALE[4], land + 0.2, 0.1, 0.035, { attack: 0.001 }),
      ...(milestone
        ? [...chord("pad", [PITCH.D5, PITCH["F#5"], PITCH.A5], land, 0.07, 1.2), ...coins(6, land + 0.04, 0.055, 0.12, 7)]
        : []),
    ],
    hiss: [...IGNITE, ...(milestone ? [SHIMMER(land, 1, 0.03)] : [])],
  };
}

/**
 * The sounds. The stars climb the D major triad, one note a star, each
 * bigger than the last; three of them pay out.
 */
export const RECIPES: Record<Exclude<SoundId, "tick">, Recipe> = {
  /** One star: warm and small. A real answer, said. Never a fanfare, never a buzzer. */
  "star-1": {
    gain: 0.9,
    wet: 0.14,
    notes: [note("mallet", PITCH.D5, 0, 0.5, 0.55), note("bell", PITCH.A5, 0.004, 0.09, 0.35)],
    hiss: [],
  },
  /** Two stars: the third of the chord, a bell now. */
  "star-2": {
    gain: 0.9,
    wet: 0.18,
    notes: [note("bell", PITCH["F#5"], 0, 0.48, 0.8), note("mallet", PITCH.D5, 0, 0.14, 0.4)],
    hiss: [],
  },
  /** Three stars: the fifth on glass, its octave, and the first coins. */
  "star-3": {
    gain: 0.95,
    wet: 0.26,
    notes: [
      note("glass", PITCH.A5, 0, 0.44, 1.2),
      note("bell", PITCH.D6, 0.012, 0.18, 0.9),
      note("coin", PITCH["F#6"], 0.05, 0.08, 0.18),
      note("coin", PITCH.A6, 0.085, 0.07, 0.18),
      note("coin", PITCH.D7, 0.12, 0.06, 0.2),
    ],
    hiss: [],
  },
  /**
   * Three stars, paid out: the blackjack hand. A bright D major chord
   * (brass over a pad, glass on top) with sixteen coins pouring over it,
   * a shimmer of air, and two last bells a second in: ka-ching.
   */
  payout: {
    gain: 0.95,
    wet: 0.3,
    notes: [
      ...chord("pad", [PITCH.D4, PITCH["F#4"], PITCH.A4], 0, 0.1, 1.6),
      ...chord("brass", [PITCH.D5, PITCH["F#5"], PITCH.A5], 0, 0.13, 1.2),
      note("glass", PITCH.D6, 0, 0.28, 1.5),
      ...coins(16, 0.06, 0.052, 0.22, 21),
      note("glass", PITCH.A6, 1.0, 0.18, 1.0),
      note("glass", PITCH.D7, 1.04, 0.11, 0.9),
    ],
    hiss: [SHIMMER(0.05, 1.2, 0.045)],
  },
  /** A lesson done: ta-ta-daaa. Two pickups on the fifth below, then the chord. */
  lesson: {
    gain: 0.85,
    wet: 0.25,
    notes: [
      note("brass", PITCH.A4, 0, 0.2, 0.12),
      note("brass", PITCH.A4, 0.11, 0.2, 0.12),
      ...chord("brass", [PITCH.D5, PITCH["F#5"], PITCH.A5], 0.22, 0.14, 1.1),
      note("pad", PITCH.D4, 0.22, 0.1, 1.2),
      note("glass", PITCH.D6, 0.22, 0.24, 1.1),
      ...coins(5, 0.28, 0.05, 0.12, 5),
    ],
    hiss: [],
  },
  /** A level reached: the triad run up on bells, landing on glass with air over it. */
  level: {
    gain: 0.85,
    wet: 0.24,
    notes: [
      note("bell", PITCH.D6, 0, 0.28, 0.35),
      note("bell", PITCH["F#6"], 0.07, 0.28, 0.35),
      note("bell", PITCH.A6, 0.14, 0.3, 0.35),
      note("glass", PITCH.D7, 0.21, 0.3, 1.1),
      ...chord("pad", [PITCH.D5, PITCH.A5], 0.21, 0.1, 1.0),
    ],
    hiss: [SHIMMER(0.2, 0.8, 0.03)],
  },
  /** A personal best: a sweep up an octave, then the record's bells. */
  best: {
    gain: 0.85,
    wet: 0.3,
    notes: [
      note("sweep", PITCH.D5, 0, 0.18, 0.3, { attack: 0.02, glide: 2 }),
      note("glass", PITCH.D6, 0.26, 0.34, 1.2),
      note("glass", PITCH.A6, 0.29, 0.18, 1.0),
      note("bell", PITCH["F#6"], 0.32, 0.14, 0.8),
    ],
    hiss: [SHIMMER(0.25, 0.9, 0.03)],
  },
  /** A round won (a game's, or Hostile's claim held): ding, DING, five coins. */
  round: {
    gain: 0.9,
    wet: 0.22,
    notes: [note("bell", PITCH.A5, 0, 0.3, 0.35), note("glass", PITCH.D6, 0.1, 0.34, 0.9), ...coins(5, 0.14, 0.05, 0.1, 11)],
    hiss: [],
  },
  /**
   * The week's boss done: the plagal cadence (G major, then home to D),
   * the oldest "it is finished" in music, with a cascade over the landing.
   */
  boss: {
    gain: 0.85,
    wet: 0.3,
    notes: [
      note("mallet", PITCH.D4, 0, 0.3, 0.4),
      ...chord("brass", [PITCH.G4, PITCH.B4, PITCH.D5], 0, 0.11, 0.26),
      ...chord("brass", [PITCH.D5, PITCH["F#5"], PITCH.A5], 0.24, 0.1, 1.4),
      ...chord("pad", [PITCH.D4, PITCH["F#4"], PITCH.A4], 0.24, 0.07, 1.6),
      note("glass", PITCH.D6, 0.24, 0.22, 1.5),
      ...coins(10, 0.3, 0.055, 0.13, 33),
    ],
    hiss: [SHIMMER(0.28, 1.1, 0.03)],
  },
  /** The flame catching, the chime climbing to the count's roll, the odometer's clicks. */
  streak: streak(false),
  /** 7, 14 and 30 days: the fanfare figure (#140), a chord and coins on the roll. */
  "streak-milestone": streak(true),
};

/** A sound's notes: a recipe, or a tick at its step. */
export function recipe(id: SoundId, step = 0): Recipe {
  return id === "tick" ? tickRecipe(step) : RECIPES[id];
}

/** Seconds from a sound's start to its last silence. */
export function recipeLength(r: Recipe): number {
  const notes = r.notes.map((n) => n.at + n.attack + n.decay);
  const hiss = r.hiss.map((h) => h.at + h.dur);
  return Math.max(0, ...notes, ...hiss);
}

/* ------------------------------------------------------------------ */
/* Which moment plays which sound                                      */
/* ------------------------------------------------------------------ */

/** A sound at a time, in ms from the moment's first frame. */
export type Cue = {
  sound: SoundId;
  atMs: number;
  /** The cue's place, so a later read replaces it rather than adding one (see `CueRunner`). */
  slot: string;
  /** A tick's step. */
  step?: number;
};

/** What a take won, as the glance knows it. */
export type GlanceWin = {
  /** 0 to 3 (#504). 0 is a take with no real answer: silent. */
  stars: number;
  /** A lesson's last practice, its three practices done (`lessonDone`). */
  lessonDone?: boolean;
  /** A level reached: a trait's (#498) or a game's ladder rung (#419). */
  level?: boolean;
  /** A personal best (`personalBests`). */
  best?: boolean;
  /** A game round won (`roundReveal(...).win`). */
  roundWon?: boolean;
  /** The week's boss, scored. */
  boss?: boolean;
};

/** The glance's clock, from RepResult. */
export type GlanceClock = {
  /** When the first star starts to land. */
  landAfter: number;
  /** Between two stars (globals.css `.star-land`). */
  starStep: number;
  /** One star's landing (`--duration-max`). */
  starMs: number;
  /** Reduced motion: the stars stand still, so their sounds run from the first frame. */
  reduced: boolean;
};

/** A star lands on its slot about a fifth of the way through its scale-in (ease-out). */
export const STAR_HIT_MS = 60;
/** After the payout's chord, the moment's own sound comes in over its coins. */
export const PAYOUT_LEAD_MS = 700;

/**
 * The one sound that answers what the take won beyond its stars, the
 * rarest first: the week's boss, a level, a lesson, a best, a round.
 * One, so two fanfares never talk over each other.
 */
export function topMoment(win: GlanceWin): SoundId | null {
  if (win.stars <= 0) return null;
  if (win.boss) return "boss";
  if (win.level) return "level";
  if (win.lessonDone) return "lesson";
  if (win.best) return "best";
  if (win.roundWon) return "round";
  return null;
}

/**
 * The glance's sounds, on its clock: a ding as each star lands (rising,
 * the third the biggest), the payout once all three have, then the
 * take's biggest moment. Nothing for a take with no star: it won
 * nothing, and a sound would say it had.
 */
export function glanceCues(win: GlanceWin, clock: GlanceClock): Cue[] {
  const stars = Math.max(0, Math.min(3, Math.round(win.stars)));
  if (stars === 0) return [];
  const land = clock.reduced ? 0 : clock.landAfter;
  const out: Cue[] = [];
  for (let k = 0; k < stars; k++) {
    out.push({ sound: `star-${k + 1}` as SoundId, atMs: land + k * clock.starStep + STAR_HIT_MS, slot: `star-${k + 1}` });
  }
  const done = land + (stars - 1) * clock.starStep + clock.starMs;
  if (stars === 3) out.push({ sound: "payout", atMs: done, slot: "payout" });
  const top = topMoment(win);
  if (top) out.push({ sound: top, atMs: done + (stars === 3 ? PAYOUT_LEAD_MS : 0), slot: "top" });
  return out;
}

/**
 * A count's ticks: one each time the shown number passes a step, on
 * CountUp's ease-out (1 - (1 - t)^3), at most `max` of them, the last as
 * it lands. None for a count that does not climb.
 */
export function countTicks(from: number, to: number, durationMs: number, max = 12): Cue[] {
  const span = Math.floor(to) - Math.ceil(from);
  if (!(to > from) || span < 0) return [];
  const n = Math.max(1, Math.min(max, span + 1));
  const out: Cue[] = [];
  for (let k = 1; k <= n; k++) {
    const shown = k / n;
    const t = 1 - Math.cbrt(1 - shown);
    out.push({ sound: "tick", atMs: Math.round(t * durationMs), slot: `tick-${k}`, step: k - 1 });
  }
  return out;
}

/**
 * Whether XP today's count is owed its ticks: only a number that went
 * up since this phone last heard it today. Opening You is not a win;
 * coming back to it with ten more XP is.
 */
export function xpTicksOwed(today: number, day: string, heard: { day: string; xp: number } | null): boolean {
  if (!(today > 0)) return false;
  if (!heard || heard.day !== day) return true;
  return today > heard.xp;
}

/** A Hostile round is won when the claim held: "Held the claim" at the Strong band (70, `LEVEL_AT`). */
export const HOSTILE_WIN_AT = 70;
export function hostileWon(held: number | null | undefined): boolean {
  return typeof held === "number" && held >= HOSTILE_WIN_AT;
}
