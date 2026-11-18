import { describe, expect, it } from "vitest";
import type { Tier1Scores } from "./index-score";
import {
  LEVEL_STEP,
  levelCost,
  levelLine,
  levelUpLine,
  levelUps,
  rankedTraits,
  repTraitXp,
  standing,
  TRAITS,
  traitLevels,
  xpFor,
  xpLine,
  type TraitKey,
  type TraitLevel,
  type TraitRep,
} from "./traits";

/** A rep with real speech in it, so the substance gate passes. */
const SPEECH =
  "The clearest way to explain the product is to start from the person " +
  "using it, walk through one honest morning with the app, and then show " +
  "what the numbers said about that same morning afterwards.";

/** The #54 rep: fluent-sounding nothing. Must never pay anything. */
const EMPTY_SPEECH =
  "i don't know i don't know i don't know i don't know i don't know " +
  "i don't know i don't know i don't know";

const TIER2 = ["structure", "credibility", "engagement", "confidence"] as const;

/** A stored rep from flat scores: tier-1 keys as they are, judged keys into tier2. */
function rep(scores: Partial<Record<TraitKey, number>>, transcript = SPEECH): TraitRep {
  const tier1: Record<string, number> = {};
  const tier2: Record<string, { score: number }> = {};
  for (const [k, v] of Object.entries(scores)) {
    if ((TIER2 as readonly string[]).includes(k)) tier2[k] = { score: v as number };
    else tier1[k] = v as number;
  }
  return {
    transcript,
    dimensions: { tier1: tier1 as unknown as Tier1Scores, tier2: Object.keys(tier2).length ? tier2 : null },
  };
}

const of = (levels: TraitLevel[], key: TraitKey) => levels.find((t) => t.key === key)!;

describe("the cost of a level", () => {
  it("is LEVEL_STEP times the level: one Strong read for level 1, and a little more each level after", () => {
    expect(LEVEL_STEP).toBe(70);
    expect([1, 2, 3, 7, 10].map(levelCost)).toEqual([70, 140, 210, 490, 700]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(xpFor)).toEqual([0, 70, 210, 420, 700, 1050, 1470, 1960, 2520]);
  });

  it("stands a total of XP at its level, the XP into it and the next one's cost", () => {
    expect(standing(0)).toEqual({ level: 0, into: 0, cost: 70 });
    expect(standing(69)).toEqual({ level: 0, into: 69, cost: 70 });
    expect(standing(70)).toEqual({ level: 1, into: 0, cost: 140 });
    expect(standing(1590)).toEqual({ level: 6, into: 120, cost: 490 });
    for (const bad of [Number.NaN, -40, Number.NEGATIVE_INFINITY]) expect(standing(bad)).toEqual({ level: 0, into: 0, cost: 70 });
  });
});

describe("repTraitXp", () => {
  it("pays each trait the take read its score, rounded and held to 0 to 100", () => {
    expect(repTraitXp(rep({ pause: 44.6, fillers: 100, pace: 0, range: 120, structure: 61 }))).toEqual({
      pause: 45,
      fillers: 100,
      pace: 0,
      range: 100,
      structure: 61,
    });
  });

  it("pays nothing for a take not enough to score, or with no stored dimensions", () => {
    expect(repTraitXp(rep({ pace: 95, fillers: 100 }, EMPTY_SPEECH))).toEqual({});
    expect(repTraitXp({ transcript: SPEECH, dimensions: null })).toEqual({});
  });

  it("leaves out a trait the take did not read: absent, not 0", () => {
    const paid = repTraitXp(rep({ pause: 50, fillers: Number.NaN }));
    expect(paid).toEqual({ pause: 50 });
    expect("engagement" in paid).toBe(false);
  });
});

describe("traitLevels", () => {
  it("is all nine at level 0 with nothing read", () => {
    const levels = traitLevels([]);
    expect(levels.map((t) => t.key)).toEqual(TRAITS.map((t) => t.key));
    for (const t of levels) expect(t).toMatchObject({ level: 0, xp: 0, into: 0, cost: 70, percent: 0, last: null });
  });

  it("adds every scored recording's score to the trait, and says how far into the level", () => {
    const levels = traitLevels([rep({ fillers: 92, pace: 60 }), rep({ fillers: 85, pace: 80 }), rep({ fillers: 93, pace: 40 })]);
    // Filler control: 92 + 85 + 93 = 270, past 210 for level 2, 60 of level 3's 210.
    expect(of(levels, "fillers")).toMatchObject({ level: 2, xp: 270, into: 60, cost: 210, percent: 28, last: 93 });
    // Pace: 180, level 1 (70), 110 of level 2's 140.
    expect(of(levels, "pace")).toMatchObject({ level: 1, xp: 180, into: 110, cost: 140, percent: 78, last: 40 });
    expect(of(levels, "range")).toMatchObject({ level: 0, xp: 0, last: null });
  });

  it("rounds the bar down and never draws it full", () => {
    expect(of(traitLevels([rep({ pace: 69 })]), "pace").percent).toBe(98);
    expect(of(traitLevels([rep({ pace: 1 })]), "pace").percent).toBe(1);
    expect(of(traitLevels([rep({ pace: 70 })]), "pace")).toMatchObject({ level: 1, percent: 0 });
  });

  it("reads recordings oldest first: `last` is the newest that read the trait, and the levels are the same in any order", () => {
    const takes = [rep({ pause: 30, pace: 90 }), rep({ pause: 80 }), rep({ pause: 55, range: 10 })];
    const forward = traitLevels(takes);
    const back = traitLevels([...takes].reverse());
    expect(of(forward, "pause").last).toBe(55);
    expect(of(back, "pause").last).toBe(30);
    // Pace was read once, by the oldest: still its last.
    expect(of(forward, "pace").last).toBe(90);
    expect(forward.map((t) => [t.level, t.xp])).toEqual(back.map((t) => [t.level, t.xp]));
  });
});

/* ---- the properties --------------------------------------------------------- */

/** A seeded generator, so every run draws the same accounts (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A recording of random scores, some traits unread, some takes too short to score. */
function randomTake(r: () => number): TraitRep {
  const s: Partial<Record<TraitKey, number>> = {};
  for (const t of TRAITS) if (r() > 0.15) s[t.key] = Math.round(r() * 100);
  return rep(s, r() < 0.1 ? EMPTY_SPEECH : SPEECH);
}

describe("the rule's properties, over 200 random histories", () => {
  const r = seeded(4981);
  const histories = Array.from({ length: 200 }, () => Array.from({ length: 1 + Math.floor(r() * 30) }, () => randomTake(r)));

  it("never lowers a level, or any XP, when a recording is added", () => {
    for (const h of histories) {
      let before = traitLevels([]);
      for (let k = 1; k <= h.length; k++) {
        const after = traitLevels(h.slice(0, k));
        for (const t of after) {
          const b = of(before, t.key);
          expect(t.level).toBeGreaterThanOrEqual(b.level);
          expect(t.xp).toBeGreaterThanOrEqual(b.xp);
        }
        before = after;
      }
    }
  });

  it("changes nothing for a take too short to score, whatever its rows read", () => {
    for (const h of histories.slice(0, 50)) {
      const unscorable = rep(Object.fromEntries(TRAITS.map((t) => [t.key, 100])), EMPTY_SPEECH);
      expect(traitLevels([...h, unscorable])).toEqual(traitLevels(h));
      expect(levelUps(traitLevels(h), traitLevels([...h, unscorable]))).toEqual([]);
    }
  });

  it("pays a trait read at 0 nothing: its XP and level stay, and only `last` says the 0", () => {
    for (const h of histories.slice(0, 50)) {
      const before = traitLevels(h);
      const after = traitLevels([...h, rep({ fillers: 0, pace: 0 })]);
      for (const key of ["fillers", "pace"] as const) {
        expect(of(after, key)).toEqual({ ...of(before, key), last: 0 });
      }
    }
  });

  it("only ever names a level that went up, and every one that did", () => {
    for (const h of histories) {
      const before = traitLevels(h.slice(0, -1));
      const after = traitLevels(h);
      const ups = levelUps(before, after);
      for (const u of ups) expect(u.to).toBeGreaterThan(u.from);
      const rose = after.filter((t) => t.level > of(before, t.key).level).map((t) => t.key);
      expect(ups.map((u) => u.key).sort()).toEqual([...rose].sort());
    }
  });
});

/* ---- the curve, over synthetic accounts drawn from production ---------------- */

/*
 * Production, 42 accounts (18 Nov): recordings per account p25 1, median
 * 4.5, p75 7.75, p90 14, max 29. Tier-1 scores per recording, p25 / p50 /
 * p75 / p90; the judged four assumed at roughly 40 / 60 / 75 / 85.
 */
const PERCENTILES: Record<TraitKey, [number, number, number, number]> = {
  fillers: [7, 61, 100, 100],
  pace: [42, 75, 90, 100],
  pause: [11, 20, 45, 85],
  range: [74, 90, 100, 100],
  repairs: [0, 0, 52, 100],
  structure: [40, 60, 75, 85],
  credibility: [40, 60, 75, 85],
  engagement: [40, 60, 75, 85],
  confidence: [40, 60, 75, 85],
};
/** The five the lessons teach: a free account's You shows these. */
const FIVE: TraitKey[] = ["pause", "fillers", "repairs", "pace", "range"];

/** The score at quantile q, straight lines between the percentiles, 0 at the bottom and 100 at the top. */
function scoreAt(p: [number, number, number, number], q: number): number {
  const xs = [0, 0.25, 0.5, 0.75, 0.9, 1];
  const ys = [0, ...p, 100];
  for (let i = 1; i < xs.length; i++) {
    if (q <= xs[i]) return ys[i - 1] + ((q - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  }
  return 100;
}

/** A standard normal (Box-Muller) and its CDF (Abramowitz and Stegun 7.1.26). */
function normal(r: () => number): number {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

/*
 * One synthetic account: thirty recordings, each trait's score drawn at a
 * quantile that leans on the account's own skill (correlation 0.5), so
 * every trait's scores across all accounts keep production's percentiles
 * while a strong speaker stays strong from one take to the next.
 */
const RHO = 0.5;
function account(r: () => number): TraitRep[] {
  const skill = normal(r);
  return Array.from({ length: 30 }, () =>
    rep(
      Object.fromEntries(
        TRAITS.map((t) => [t.key, Math.round(scoreAt(PERCENTILES[t.key], phi(RHO * skill + Math.sqrt(1 - RHO * RHO) * normal(r))))])
      )
    )
  );
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const at = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))];

describe("the curve (#498): what accounts like production's reach", () => {
  const r = seeded(498);
  const accounts = Array.from({ length: 400 }, () => account(r));
  /* The production counts: p25, median, p75, p90, max, and thirty. */
  const COUNTS = [1, 2, 5, 8, 14, 29, 30];
  const rows = COUNTS.map((n) => {
    const best5: number[] = [];
    const best9: number[] = [];
    const up5: number[] = [];
    for (const a of accounts) {
      const levels = traitLevels(a.slice(0, n));
      best5.push(Math.max(...FIVE.map((k) => of(levels, k).level)));
      best9.push(Math.max(...levels.map((t) => t.level)));
      up5.push(FIVE.filter((k) => of(levels, k).level > 0).length);
    }
    return { n, best5, best9, up5 };
  });
  const row = (n: number) => rows.find((x) => x.n === n)!;
  const table = [
    "recordings | best of the five p25/p50/p75 | best of nine p50 | of the five at level 1+, p50",
    ...rows.map(
      (x) =>
        `${String(x.n).padStart(10)} | ${`${at(x.best5, 0.25)} / ${median(x.best5)} / ${at(x.best5, 0.75)}`.padEnd(27)} | ${String(median(x.best9)).padEnd(16)} | ${median(x.up5)}`
    ),
  ].join("\n");

  it("prints the table", () => {
    expect(table).toBe(
      [
        "recordings | best of the five p25/p50/p75 | best of nine p50 | of the five at level 1+, p50",
        "         1 | 1 / 1 / 1                   | 1                | 2",
        "         2 | 1 / 1 / 1                   | 1                | 3",
        "         5 | 2 / 2 / 3                   | 2                | 5",
        "         8 | 3 / 3 / 4                   | 3                | 5",
        "        14 | 4 / 5 / 5                   | 5                | 5",
        "        29 | 7 / 7 / 8                   | 7                | 5",
        "        30 | 7 / 7 / 8                   | 7                | 5",
      ].join("\n")
    );
  });

  it("takes one or two traits to level 1 on a first decent recording, and nearly nine first recordings in ten level one", () => {
    expect(median(row(1).up5)).toBeGreaterThanOrEqual(1);
    expect(median(row(1).up5)).toBeLessThanOrEqual(2);
    expect(row(1).up5.filter((x) => x > 0).length / accounts.length).toBeGreaterThan(0.85);
  });

  it("puts a five-recording account at level 2 to 3 in its best trait", () => {
    expect(median(row(5).best5)).toBeGreaterThanOrEqual(2);
    expect(median(row(5).best5)).toBeLessThanOrEqual(3);
  });

  it("puts a thirty-recording account at level 6 to 8 in its best trait", () => {
    expect(median(row(30).best5)).toBeGreaterThanOrEqual(6);
    expect(median(row(30).best5)).toBeLessThanOrEqual(8);
  });

  it("takes several strong recordings for each level past the first, more each level", () => {
    /* A strong recording pays about 85 (Variety's median 90, Pace's p75 90). */
    expect(levelCost(2) / 85).toBeGreaterThan(1.5);
    expect(levelCost(7) / 85).toBeGreaterThan(5);
    for (let l = 2; l < 20; l++) expect(levelCost(l + 1) - levelCost(l)).toBe(LEVEL_STEP);
  });
});

/* ---- the level-up moment ------------------------------------------------------ */

/* look-fixtures' live recording, which scripts/look-trait-xp.mjs stores after each history. */
const LIVE = rep({ pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66, structure: 64, credibility: 58, engagement: 61, confidence: 66 });
const flat = (n: number, s: Partial<Record<TraitKey, number>>) => Array.from({ length: n }, () => rep(s));
const NAME: Record<TraitKey, string> = {
  pause: "Pausing",
  fillers: "Filler control",
  repairs: "Restart control",
  pace: "Pace",
  range: "Variety",
  structure: "Structure",
  credibility: "Credibility",
  engagement: "Engagement",
  confidence: "Steadiness",
};
const nameOf = (k: TraitKey) => NAME[k];
const five = (k: TraitKey) => FIVE.includes(k);
/** Before and after one recording, under the same rule. */
const moment = (history: TraitRep[], take = LIVE, shown = five) => levelUps(traitLevels(history), traitLevels([...history, take]), shown);

describe("levelUps: what one recording crossed", () => {
  it("names the first recording's levels: Pace and Pausing to 1, biggest payment first", () => {
    const ups = moment([]);
    expect(ups).toEqual([
      { key: "pace", from: 0, to: 1, paid: 93 },
      { key: "pause", from: 0, to: 1, paid: 72 },
    ]);
    expect(levelUpLine(ups, nameOf)).toEqual({ text: "Pace reached level 1, Pausing level 1", short: "Pace reached level 1" });
  });

  it("names one level crossed alone", () => {
    const ups = moment(flat(4, { pace: 95, pause: 55, fillers: 75, repairs: 25, range: 58 }));
    expect(ups).toEqual([{ key: "pace", from: 2, to: 3, paid: 93 }]);
    expect(levelUpLine(ups, nameOf)).toEqual({ text: "Pace reached level 3", short: null });
  });

  it("names two, the higher level first", () => {
    const ups = moment(flat(4, { pace: 95, pause: 40, fillers: 75, repairs: 25, range: 58 }));
    expect(ups.map((u) => [u.key, u.to])).toEqual([
      ["pace", 3],
      ["pause", 2],
    ]);
    expect(levelUpLine(ups, nameOf)?.text).toBe("Pace reached level 3, Pausing level 2");
  });

  it("names two of five and counts the rest", () => {
    const ups = moment(flat(4, { pace: 95, pause: 40, fillers: 40, repairs: 5, range: 90 }));
    expect(ups.map((u) => [u.key, u.to])).toEqual([
      ["pace", 3],
      ["range", 3],
      ["pause", 2],
      ["fillers", 2],
      ["repairs", 1],
    ]);
    expect(levelUpLine(ups, nameOf)).toEqual({ text: "Pace reached level 3, Variety level 3 and 3 more", short: "Pace reached level 3" });
  });

  it("crosses at most one level a trait: a recording pays at most 100, and every level past the first costs 140 or more", () => {
    const r = seeded(49);
    for (let i = 0; i < 300; i++) {
      const h = Array.from({ length: 1 + Math.floor(r() * 25) }, () => randomTake(r));
      for (const u of levelUps(traitLevels(h.slice(0, -1)), traitLevels(h))) expect(u.to - u.from).toBe(1);
    }
  });

  it("orders by levels crossed, then the level reached, then the XP paid, then canonical order", () => {
    const at = (key: TraitKey, level: number, xp: number): TraitLevel => ({ key, name: key, level, xp, into: 0, cost: 70, percent: 0, last: null });
    const before = [at("pause", 0, 0), at("fillers", 0, 0), at("pace", 1, 100), at("range", 1, 100), at("structure", 2, 300)];
    const after = [at("pause", 2, 300), at("fillers", 1, 80), at("pace", 2, 200), at("range", 2, 180), at("structure", 2, 390)];
    expect(levelUps(before, after).map((u) => u.key)).toEqual(["pause", "pace", "range", "fillers"]);
  });

  it("lights nothing for a recording that crossed nothing", () => {
    const ups = moment(flat(4, { pace: 55, pause: 55, fillers: 75, repairs: 25, range: 58 }));
    expect(ups).toEqual([]);
    expect(levelUpLine(ups, nameOf)).toBeNull();
  });

  it("keeps to the traits the screen shows: a free account's moment never names a folded trait", () => {
    const history = flat(1, { structure: 60, credibility: 60 });
    expect(moment(history, LIVE, five).map((u) => u.key)).toEqual(["pace", "pause"]);
    // Structure 60 + 64 and Credibility 60 + 58 cross 70 too; Engagement's 61 and Steadiness's 66 alone do not.
    expect(moment(history, LIVE, () => true).map((u) => u.key)).toEqual(["pace", "pause", "structure", "credibility"]);
  });
});

describe("levelLine and xpLine: what You's rows and sheet say", () => {
  it("says the level, and the bar's share of the way to the next", () => {
    expect(levelLine({ level: 6, percent: 24 })).toEqual({ value: "Level 6", percent: 24, said: "Level 6, 24% of the way to level 7" });
    expect(levelLine({ level: 1, percent: 0 })).toEqual({ value: "Level 1", percent: 0, said: "Level 1, 0% of the way to level 2" });
    expect(levelLine({ level: 0, percent: 62 })).toMatchObject({ value: "Level 0", said: "Level 0, 62% of the way to level 1" });
  });

  it("says Not yet at level 0 with nothing toward 1", () => {
    expect(levelLine({ level: 0, percent: 0 })).toEqual({ value: "Not yet", percent: null, said: "Not yet at level 1" });
  });

  it("traces the bar to numbers: the XP to go, and what the last recording paid", () => {
    const t = of(traitLevels([...flat(16, { fillers: 99 }), rep({ fillers: 45 })]), "fillers");
    // 16 × 99 + 45 = 1629: level 6 (1470), 159 of level 7's 490.
    expect(t).toMatchObject({ level: 6, into: 159, cost: 490, last: 45 });
    expect(xpLine(t)).toBe("331 XP to level 7. Last recording +45.");
    expect(xpLine(of(traitLevels([rep({ repairs: 0 })]), "repairs"))).toBe("70 XP to level 1. Last recording +0.");
    expect(xpLine(of(traitLevels([]), "engagement"))).toBe("70 XP to level 1.");
  });

  it("ranks by XP: the higher level first, and at one level the further into it", () => {
    const levels = traitLevels([rep({ fillers: 100, pace: 90, pause: 100, range: 30 }), rep({ fillers: 100, pace: 90, pause: 15 })]);
    expect(rankedTraits(levels).map((t) => t.key).slice(0, 4)).toEqual(["fillers", "pace", "pause", "range"]);
  });
});

describe("look-fixtures' LEVEL_MIX, the cameras' fourteen recordings", () => {
  /* scripts/look-fixtures.mjs LEVEL_TAKES, oldest first. */
  const MIX = Array.from({ length: 14 }, (_, i) =>
    rep({
      pause: 15,
      fillers: i === 13 ? 74 : 88,
      repairs: i === 6 ? 40 : 0,
      pace: 48,
      range: i === 13 ? 69 : 62,
      structure: 60,
      credibility: 55,
      confidence: 58,
    })
  );
  const levels = traitLevels(MIX);

  it("puts every state a level can be in on You", () => {
    expect(of(levels, "fillers")).toMatchObject({ level: 5, xp: 1218, into: 168, cost: 420, percent: 40, last: 74 });
    expect(of(levels, "range")).toMatchObject({ level: 4, into: 175, cost: 350, percent: 50 });
    expect(of(levels, "pace")).toMatchObject({ level: 3, into: 252, cost: 280, percent: 90 });
    expect(of(levels, "pause")).toMatchObject({ level: 2, into: 0, percent: 0, last: 15 });
    expect(of(levels, "repairs")).toMatchObject({ level: 0, into: 40, percent: 57, last: 0 });
    expect([of(levels, "structure").percent, of(levels, "credibility").percent, of(levels, "confidence").percent]).toEqual([40, 20, 32]);
    expect(levelLine(of(levels, "engagement")).value).toBe("Not yet");
    expect(xpLine(of(levels, "fillers"))).toBe("252 XP to level 6. Last recording +74.");
    expect(rankedTraits(levels).filter((t) => FIVE.includes(t.key)).map((t) => t.key)).toEqual(["fillers", "range", "pace", "pause", "repairs"]);
  });
});
