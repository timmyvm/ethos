import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./prefs";
import {
  PAYOUT_LEAD_MS,
  PITCH,
  RECIPES,
  STAR_HIT_MS,
  VOICES,
  coins,
  countTicks,
  glanceCues,
  hostileWon,
  proofLeads,
  recipe,
  recipeLength,
  seeded,
  tickRecipe,
  topMoment,
  xpTicksOwed,
  type GlanceClock,
  type Recipe,
  type SoundId,
} from "./sound-recipes";

/**
 * The sound of winning (#505), read as a score: nobody building Ethos can
 * hear a phone from here, so what makes the kit musical has to be true
 * on paper. One key, instrument voices, rising figures, the phone's band,
 * bigger wins louder and longer, and nothing for a take that won nothing.
 */

const ALL = Object.keys(RECIPES) as Exclude<SoundId, "tick">[];

/** Where a pitch sits in the octave, 0 to 11 from C, by the nearest semitone. */
const pitchClass = (f: number) => (((Math.round(12 * Math.log2(f / 440)) + 9) % 12) + 12) % 12;
/** D major: D E F# G A B C#. */
const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);

/** A note's energy: its partials' levels squared, held over its decay. */
function energy(r: Recipe): number {
  return r.notes.reduce((sum, n) => {
    const partials = VOICES[n.voice].reduce((a, p) => a + p.gain * p.gain * p.decay, 0);
    return sum + n.peak * n.peak * n.decay * partials;
  }, 0) * r.gain * r.gain;
}

const loudest = (r: Recipe) => r.notes.reduce((a, n) => (n.peak > a.peak ? n : a));

describe("the kit is musical by construction", () => {
  it("plays every note in D major, the streak chime's key, so any two sounds that overlap agree", () => {
    for (const id of ALL) {
      for (const n of RECIPES[id].notes) {
        /* A coin's second ping is a fourth above its first: still in the key. */
        expect(D_MAJOR.has(pitchClass(n.freq)), `${id} ${n.freq}Hz`).toBe(true);
      }
    }
    expect(D_MAJOR.has(pitchClass(tickRecipe(0).notes[0].freq))).toBe(true);
  });

  it("keeps every fundamental in the band a phone speaker can say (290 to 3,000 Hz)", () => {
    for (const id of ALL) {
      for (const n of RECIPES[id].notes) {
        expect(n.freq, id).toBeGreaterThanOrEqual(290);
        expect(n.freq, id).toBeLessThanOrEqual(3000);
      }
    }
  });

  it("never falls: no glide goes down, and every sound's loudest note is at or above where it started", () => {
    for (const id of ALL) {
      const r = RECIPES[id];
      for (const n of r.notes) expect(n.glide ?? 1, id).toBeGreaterThanOrEqual(1);
      const first = [...r.notes].sort((a, b) => a.at - b.at)[0];
      expect(loudest(r).freq, id).toBeGreaterThanOrEqual(first.freq);
    }
  });

  it("strikes rather than switches: every note has an attack and a decay, and every sound is over inside 2.6 seconds", () => {
    for (const id of ALL) {
      const r = RECIPES[id];
      for (const n of r.notes) {
        expect(n.attack, id).toBeGreaterThan(0);
        expect(n.attack, id).toBeLessThanOrEqual(0.04);
        expect(n.decay, id).toBeGreaterThan(0);
      }
      expect(recipeLength(r), id).toBeLessThanOrEqual(2.6);
    }
  });

  it("builds every voice from partials whose higher members die first, as a struck bar or a bell does", () => {
    for (const [name, partials] of Object.entries(VOICES)) {
      expect(partials[0].ratio, name).toBe(1);
      for (const p of partials.slice(1)) {
        if (p.ratio > 1) expect(p.decay, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it("scatters the coins the same way every time (a fixed seed)", () => {
    expect(coins(16, 0, 0.05, 0.2, 21)).toEqual(coins(16, 0, 0.05, 0.2, 21));
    const a = seeded(9);
    const b = seeded(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("scaled to how big the win is", () => {
  it("climbs the D major triad a star at a time: D, F#, A", () => {
    expect(loudest(RECIPES["star-1"]).freq).toBe(PITCH.D5);
    expect(loudest(RECIPES["star-2"]).freq).toBe(PITCH["F#5"]);
    expect(loudest(RECIPES["star-3"]).freq).toBe(PITCH.A5);
  });

  it("makes each star bigger than the last, and the payout bigger than any star", () => {
    const e = (id: SoundId) => energy(recipe(id));
    expect(e("star-1")).toBeLessThan(e("star-2"));
    expect(e("star-2")).toBeLessThan(e("star-3"));
    expect(e("star-3")).toBeLessThan(e("payout"));
    expect(recipeLength(RECIPES["star-1"])).toBeLessThan(recipeLength(RECIPES["star-3"]));
  });

  it("gives one star a warm, small sound: a mallet and a bell, no coins, no brass, no noise, the smallest in the kit", () => {
    const r = RECIPES["star-1"];
    expect(new Set(r.notes.map((n) => n.voice))).toEqual(new Set(["mallet", "bell"]));
    expect(r.hiss).toEqual([]);
    expect(recipeLength(r)).toBeLessThan(1);
    for (const id of ALL) if (id !== "star-1") expect(energy(r), id).toBeLessThan(energy(RECIPES[id]));
  });

  it("pays out three stars as the blackjack hand: a bright D major chord, a cascade of coins, a last ka-ching", () => {
    const r = RECIPES.payout;
    const chord = r.notes.filter((n) => n.voice === "brass" && n.at === 0).map((n) => pitchClass(n.freq));
    expect(new Set(chord)).toEqual(new Set([2, 6, 9]));
    const pings = r.notes.filter((n) => n.voice === "coin");
    expect(pings.length).toBeGreaterThanOrEqual(24);
    const last = [...r.notes].sort((a, b) => a.at - b.at).at(-1)!;
    expect(last.voice).toBe("glass");
    expect(last.at).toBeGreaterThanOrEqual(1);
  });

  it("finishes a lesson with a fanfare: two pickups on the fifth below, then the chord", () => {
    const r = RECIPES.lesson;
    const brass = r.notes.filter((n) => n.voice === "brass");
    expect(brass[0].freq).toBe(PITCH.A4);
    expect(brass[1].freq).toBe(PITCH.A4);
    const landing = brass.filter((n) => n.at === brass[2].at).map((n) => pitchClass(n.freq));
    expect(new Set(landing)).toEqual(new Set([2, 6, 9]));
  });

  it("lands the week's boss on a plagal cadence, and holds it longer than a lesson", () => {
    const brass = RECIPES.boss.notes.filter((n) => n.voice === "brass");
    const first = new Set(brass.filter((n) => n.at === 0).map((n) => pitchClass(n.freq)));
    expect(first).toEqual(new Set([7, 11, 2])); // G major
    const home = new Set(brass.filter((n) => n.at > 0).map((n) => pitchClass(n.freq)));
    expect(home).toEqual(new Set([2, 6, 9])); // D major
    expect(recipeLength(RECIPES.boss)).toBeGreaterThan(recipeLength(RECIPES.lesson));
  });

  it("lights the streak's flame with noise before the chime, and clicks the odometer as it lands", () => {
    for (const id of ["streak", "streak-milestone"] as const) {
      const r = RECIPES[id];
      expect(r.hiss[0].at).toBe(0);
      expect(r.hiss[0].to).toBeGreaterThan(r.hiss[0].from);
      expect(r.notes.filter((n) => n.voice === "tick")).toHaveLength(2);
    }
    expect(energy(RECIPES["streak-milestone"])).toBeGreaterThan(energy(RECIPES.streak));
  });

  it("ticks light: XP's tick is the quietest, shortest sound, a little higher each step", () => {
    const t = tickRecipe(0);
    expect(recipeLength(t)).toBeLessThan(0.05);
    for (const id of ALL) expect(energy(t), id).toBeLessThan(energy(RECIPES[id]));
    expect(tickRecipe(3).notes[0].freq).toBeGreaterThan(tickRecipe(0).notes[0].freq);
    expect(tickRecipe(40).notes[0].freq).toBe(tickRecipe(5).notes[0].freq);
  });
});

const CLOCK: GlanceClock = { landAfter: 600, starStep: 120, starMs: 300, reduced: false };

describe("which moment plays which sound (the glance)", () => {
  it("plays nothing for a take with no star, whatever else it was: no sound says it won", () => {
    expect(glanceCues({ stars: 0 }, CLOCK)).toEqual([]);
    expect(glanceCues({ stars: 0, boss: true, best: true }, CLOCK)).toEqual([]);
    expect(topMoment({ stars: 0, lessonDone: true })).toBeNull();
  });

  it("dings as each star lands on its slot, 120ms apart", () => {
    expect(glanceCues({ stars: 1 }, CLOCK)).toEqual([{ sound: "star-1", atMs: 600 + STAR_HIT_MS, slot: "star-1" }]);
    expect(glanceCues({ stars: 2 }, CLOCK).map((c) => [c.sound, c.atMs])).toEqual([
      ["star-1", 660],
      ["star-2", 780],
    ]);
  });

  it("pays out once the third star has landed", () => {
    const cues = glanceCues({ stars: 3 }, CLOCK);
    expect(cues.map((c) => c.sound)).toEqual(["star-1", "star-2", "star-3", "payout"]);
    expect(cues[3].atMs).toBe(600 + 2 * 120 + 300);
  });

  it("follows the stars with the take's biggest moment, after the payout's chord when there is one", () => {
    expect(glanceCues({ stars: 2, lessonDone: true }, CLOCK).at(-1)).toEqual({ sound: "lesson", atMs: 600 + 120 + 300, slot: "top" });
    const three = glanceCues({ stars: 3, lessonDone: true }, CLOCK);
    expect(three.map((c) => c.sound)).toEqual(["star-1", "star-2", "star-3", "payout", "lesson"]);
    expect(three[4].atMs - three[3].atMs).toBe(PAYOUT_LEAD_MS);
  });

  it("names one moment, the rarest: the boss, a level, a lesson, a best, a round", () => {
    const all = { stars: 2, boss: true, level: true, lessonDone: true, best: true, roundWon: true };
    expect(topMoment(all)).toBe("boss");
    expect(topMoment({ ...all, boss: false })).toBe("level");
    expect(topMoment({ ...all, boss: false, level: false })).toBe("lesson");
    expect(topMoment({ stars: 1, best: true, roundWon: true })).toBe("best");
    expect(topMoment({ stars: 2, roundWon: true })).toBe("round");
    expect(topMoment({ stars: 3 })).toBeNull();
    expect(glanceCues(all, CLOCK).filter((c) => c.slot === "top")).toHaveLength(1);
  });

  it("keeps every sound under reduced motion, from the first frame: the switch silences, motion does not", () => {
    const cues = glanceCues({ stars: 3, best: true }, { ...CLOCK, reduced: true });
    expect(cues.map((c) => c.sound)).toEqual(["star-1", "star-2", "star-3", "payout", "best"]);
    expect(cues[0].atMs).toBe(STAR_HIT_MS);
  });
});

describe("XP counting up", () => {
  it("ticks each step the shown number passes, on the count's ease-out, the last as it lands", () => {
    const ticks = countTicks(25.4, 31, 300);
    expect(ticks).toHaveLength(6);
    expect(ticks.map((t) => t.step)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ticks.at(-1)!.atMs).toBe(300);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].atMs).toBeGreaterThan(ticks[i - 1].atMs);
    /* Ease-out: the gaps widen as the count settles. */
    expect(ticks[5].atMs - ticks[4].atMs).toBeGreaterThan(ticks[1].atMs - ticks[0].atMs);
  });

  it("caps a long count at twelve ticks, and never ticks a count that does not climb", () => {
    expect(countTicks(0, 1000, 600)).toHaveLength(12);
    expect(countTicks(10, 10, 300)).toEqual([]);
    expect(countTicks(10, 8, 300)).toEqual([]);
  });

  it("ticks only XP this phone has not heard yet today: opening You is not a win", () => {
    expect(xpTicksOwed(30, "2026-11-18", null)).toBe(true);
    expect(xpTicksOwed(30, "2026-11-18", { day: "2026-11-18", xp: 30 })).toBe(false);
    expect(xpTicksOwed(40, "2026-11-18", { day: "2026-11-18", xp: 30 })).toBe(true);
    expect(xpTicksOwed(10, "2026-11-19", { day: "2026-11-18", xp: 30 })).toBe(true);
    expect(xpTicksOwed(0, "2026-11-18", null)).toBe(false);
  });
});

describe("Hostile Q&A and the setting", () => {
  it("wins a Hostile round when the claim held at the Strong band (70)", () => {
    expect(hostileWon(70)).toBe(true);
    expect(hostileWon(69)).toBe(false);
    expect(hostileWon(null)).toBe(false);
  });

  it("ships with Sound on", () => {
    expect(DEFAULT_PREFS.sound).toBe(true);
  });
});

/* Say it better's proof token (#509): the hand won, under every bigger moment. */
describe("a swap proved (#509)", () => {
  it("plays the round's hand won, and a level-up, a lesson, a best or the boss outranks it", () => {
    expect(topMoment({ stars: 2, proof: true })).toBe("round");
    expect(topMoment({ stars: 2, proof: true, level: true })).toBe("level");
    expect(topMoment({ stars: 2, proof: true, lessonDone: true })).toBe("lesson");
    expect(topMoment({ stars: 2, proof: true, best: true })).toBe("best");
    expect(topMoment({ stars: 2, proof: true, boss: true })).toBe("boss");
    // A take with no star plays nothing, the proof included.
    expect(topMoment({ stars: 0, proof: true })).toBeNull();
  });
  it("is one sound: on three stars the hand won comes in over the payout's coins, once", () => {
    const cues = glanceCues({ stars: 3, proof: true }, { landAfter: 640, starStep: 120, starMs: 380, reduced: false });
    expect(cues.filter((c) => c.slot === "top")).toEqual([{ sound: "round", atMs: 640 + 240 + 380 + PAYOUT_LEAD_MS, slot: "top" }]);
  });
  it("leads (Demos cheers it) only where its sound is the top one", () => {
    expect(proofLeads({ stars: 2, proof: true })).toBe(true);
    expect(proofLeads({ stars: 2, proof: true, roundWon: true })).toBe(true);
    for (const bigger of [{ level: true }, { lessonDone: true }, { best: true }, { boss: true }]) {
      expect(proofLeads({ stars: 2, proof: true, ...bigger })).toBe(false);
    }
    expect(proofLeads({ stars: 0, proof: true })).toBe(false);
    expect(proofLeads({ stars: 2 })).toBe(false);
    for (const win of [{ stars: 1, proof: true }, { stars: 3, proof: true, best: true }, { stars: 2, proof: true, level: true }]) {
      if (proofLeads(win)) expect(topMoment(win)).toBe("round");
    }
  });
});
