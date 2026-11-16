import { describe, expect, it } from "vitest";
import {
  closestLine,
  DOUBLE_AT,
  LEVEL_AT,
  levelLine,
  levelPercent,
  needToLevel,
  rankedTraits,
  repTraitGain,
  TRAITS,
  traitGain,
  traitLevels,
  type TraitKey,
  type TraitRep,
} from "./traits";

/** A rep with real speech in it, so the substance gate passes. */
const SPEECH =
  "The clearest way to explain the product is to start from the person " +
  "using it, walk through one honest morning with the app, and then show " +
  "what the numbers said about that same morning afterwards.";

/** The #54 rep: fluent-sounding nothing. Must never level anything. */
const EMPTY_SPEECH =
  "i don't know i don't know i don't know i don't know i don't know " +
  "i don't know i don't know i don't know";

function rep(
  tier1: Partial<Record<string, number>>,
  tier2: Partial<Record<string, { score: number }>> | null = null,
  transcript = SPEECH
): TraitRep {
  return {
    transcript,
    dimensions: {
      tier1: { pause: 0, fillers: 0, pace: 0, range: 0, ...tier1 },
      tier2,
    },
  } as TraitRep;
}

describe("traitGain", () => {
  it("levels the rep's best dimension once it clears the bar", () => {
    const gain = traitGain({ pause: 40, fillers: 82, pace: 71 });
    expect(gain).toEqual({
      key: "fillers",
      name: "Fillers",
      score: 82,
      levels: 1,
    });
  });

  it("doubles the level for a truly good score", () => {
    expect(traitGain({ pause: DOUBLE_AT })?.levels).toBe(2);
    expect(traitGain({ pause: DOUBLE_AT - 1 })?.levels).toBe(1);
  });

  it("levels nothing when nothing clears the bar", () => {
    expect(traitGain({ pause: LEVEL_AT - 1, fillers: 50 })).toBeNull();
    expect(traitGain({})).toBeNull();
  });

  it("levels exactly at the bar, not just above it", () => {
    expect(traitGain({ range: LEVEL_AT })?.key).toBe("range");
  });

  it("breaks ties toward the canonical order, so reruns agree", () => {
    expect(traitGain({ structure: 85, pause: 85 })?.key).toBe("pause");
    expect(traitGain({ confidence: 80, engagement: 80 })?.key).toBe(
      "engagement"
    );
  });

  it("ignores absent dimensions rather than treating them as zero", () => {
    const gain = traitGain({ fillers: 75 });
    expect(gain?.key).toBe("fillers");
  });
});

describe("repTraitGain", () => {
  it("reads judged scores alongside the measured tier", () => {
    const gain = repTraitGain(
      rep({ pause: 60 }, { structure: { score: 88 } })
    );
    expect(gain?.key).toBe("structure");
    expect(gain?.score).toBe(88);
  });

  /*
   * The integrity gate. A near-empty rep stores tier1 numbers that are
   * true in isolation (clean pace, zero fillers) and meaningless as an
   * achievement — the same lie #54 caught in stars. The derivation
   * re-runs the engine's own substance gate on the stored transcript.
   */
  it("never levels a trait on a rep that wasn't enough to score", () => {
    expect(
      repTraitGain(rep({ pace: 95, fillers: 100 }, null, EMPTY_SPEECH))
    ).toBeNull();
  });

  it("returns nothing for a rep with no stored dimensions", () => {
    expect(
      repTraitGain({ transcript: SPEECH, dimensions: null })
    ).toBeNull();
  });
});

describe("traitLevels", () => {
  it("derives every trait, level zero included, in canonical order", () => {
    const levels = traitLevels([]);
    expect(levels).toHaveLength(TRAITS.length);
    expect(levels.map((t) => t.key)).toEqual(TRAITS.map((t) => t.key));
    expect(levels.every((t) => t.level === 0)).toBe(true);
  });

  it("sums gains across reps, doubles included", () => {
    const levels = traitLevels([
      rep({ fillers: 80 }),
      rep({ fillers: 92 }),
      rep({ pause: 75 }),
      rep({ pause: 40, fillers: 30 }),
    ]);
    const byKey = Object.fromEntries(levels.map((t) => [t.key, t.level]));
    expect(byKey.fillers).toBe(3);
    expect(byKey.pause).toBe(1);
    expect(byKey.pace).toBe(0);
  });

  it("ranks best first and keeps canonical order through ties", () => {
    const ranked = rankedTraits(
      traitLevels([rep({ pause: 75 }), rep({ range: 91 }), rep({ pace: 75 })])
    );
    expect(ranked[0].key).toBe("range");
    expect(ranked[1].key).toBe("pause");
    expect(ranked[2].key).toBe("pace");
  });
});

/*
 * #482: a level's bar. A level is one recording (#159), so the app keeps
 * nothing between two levels; the bar is the closest try since the
 * level, as a share of what that try needed to level the trait.
 */
describe("needToLevel", () => {
  it("is the bar when every other row is under it", () => {
    expect(needToLevel("pace", { pace: 60, fillers: 50, pause: 69 })).toBe(LEVEL_AT);
  });

  it("is the best other row when that is higher, since the level goes to the best row", () => {
    expect(needToLevel("pace", { pace: 76, fillers: 80, pause: 50 })).toBe(80);
  });

  it("is met or passed on every take that levels the trait, and passed on none that does not", () => {
    // Met but not passed is a tie lost to an earlier trait (traitGain):
    // the bar stops at 99 and the sheet names the tie (closestLine).
    const takes: Partial<Record<TraitKey, number>>[] = [
      { pause: 80, fillers: 80 },
      { pause: 79, fillers: 80 },
      { fillers: 100, repairs: 100, pace: 95 },
      { fillers: 70, range: 70, structure: 69 },
      { pace: 69, range: 50 },
      { structure: 91, confidence: 91, engagement: 90 },
    ];
    for (const scores of takes) {
      const gain = traitGain(scores);
      for (const [key, score] of Object.entries(scores) as [TraitKey, number][]) {
        const need = needToLevel(key, scores);
        const said = `${key} on ${JSON.stringify(scores)}`;
        if (gain?.key === key) expect(score >= need, said).toBe(true);
        else expect(score > need, said).toBe(false);
      }
    }
  });

  it("never counts the trait's own score, and skips rows the take does not have", () => {
    expect(needToLevel("fillers", { fillers: 95 })).toBe(LEVEL_AT);
    expect(needToLevel("range", { range: 30, structure: Number.NaN })).toBe(LEVEL_AT);
  });
});

describe("levelPercent", () => {
  it("is the try's share of what it needed, in whole percent", () => {
    expect(levelPercent({ score: 28, need: 70 })).toBe(40);
    expect(levelPercent({ score: 76, need: 80 })).toBe(95);
  });

  it("rounds down, so it never says more than the try did", () => {
    expect(levelPercent({ score: 50, need: 80 })).toBe(62);
    expect(levelPercent({ score: 69, need: 70 })).toBe(98);
    expect(levelPercent({ score: 29, need: 100 })).toBe(29);
  });

  it("stops at 99: a try that reached what it needed leveled the trait", () => {
    expect(levelPercent({ score: 80, need: 80 })).toBe(99);
  });

  it("is 0 with no try, or a try that scored nothing", () => {
    expect(levelPercent(null)).toBe(0);
    expect(levelPercent({ score: 0, need: 70 })).toBe(0);
  });
});

describe("traitLevels: how far into the level", () => {
  /* scripts/look-levels.mjs's eight, oldest first. */
  const T2 = { structure: { score: 60 }, credibility: { score: 55 }, confidence: { score: 58 } };
  const MIX = [
    rep({ pause: 50, fillers: 92, repairs: 30, pace: 60, range: 40 }, T2),
    rep({ pause: 50, fillers: 60, repairs: 30, pace: 80, range: 40 }, T2),
    rep({ pause: 50, fillers: 85, repairs: 30, pace: 60, range: 40 }, T2),
    rep({ pause: 50, fillers: 93, repairs: 30, pace: 60, range: 40 }, T2),
    rep({ pause: 50, fillers: 60, repairs: 30, pace: 82, range: 40 }, T2),
    rep({ pause: 50, fillers: 80, repairs: 50, pace: 76, range: 40 }, T2),
    rep({ pause: 55, fillers: 28, repairs: 30, pace: 60, range: 35 }, T2),
    rep({ pause: 74, fillers: 20, repairs: 30, pace: 60, range: 35 }, T2),
  ];
  const levels = traitLevels(MIX);
  const byKey = Object.fromEntries(levels.map((t) => [t.key, t]));
  const one = (reps: TraitRep[], key: string) => traitLevels(reps).find((t) => t.key === key)!;

  it("keeps every level exactly as the rule counts it", () => {
    expect(byKey.fillers.level).toBe(6);
    expect(byKey.pace.level).toBe(2);
    expect(byKey.pause.level).toBe(1);
    expect(byKey.repairs.level).toBe(0);
  });

  it("is the closest try since the level, against what that try needed", () => {
    expect(byKey.fillers.closest).toEqual({ score: 28, need: 70, leveled: null });
    expect(byKey.fillers.percent).toBe(40);
    // 76 on the take Filler control's 80 leveled: Pace had to beat 80.
    expect(byKey.pace.closest).toEqual({ score: 76, need: 80, leveled: "fillers" });
    expect(byKey.pace.percent).toBe(95);
    expect(byKey.repairs.percent).toBe(62);
    expect(byKey.range.percent).toBe(50);
    expect(byKey.structure.percent).toBe(85);
  });

  it("is empty the moment a level lands, with no try since", () => {
    expect(byKey.pause.closest).toBeNull();
    expect(byKey.pause.percent).toBe(0);
  });

  it("is nothing for a trait no recording has read", () => {
    expect(byKey.engagement.level).toBe(0);
    expect(byKey.engagement.closest).toBeNull();
    expect(byKey.engagement.percent).toBe(0);
  });

  it("holds the closest try: a weaker one after it does not lower the bar", () => {
    const t = one([rep({ pause: 66 }), rep({ pause: 40 })], "pause");
    expect(t.closest).toEqual({ score: 66, need: 70, leveled: null });
    expect(t.percent).toBe(94);
  });

  it("starts again after each level, so a try before it no longer counts", () => {
    const t = one([rep({ pace: 69 }), rep({ pace: 72 }), rep({ pace: 35 })], "pace");
    expect(t.level).toBe(1);
    expect(t.closest).toEqual({ score: 35, need: 70, leveled: null });
    expect(t.percent).toBe(50);
  });

  it("never fills on a tie the earlier trait took, and names the tie", () => {
    const pace = one([rep({ fillers: 80, pace: 80 })], "pace");
    expect(pace.level).toBe(0);
    expect(pace.closest).toEqual({ score: 80, need: 80, leveled: "fillers" });
    expect(pace.percent).toBe(99);
    expect(closestLine(pace)).toBe("Closest yet: 80, tied with Fillers, which leveled instead.");
  });

  it("fills to 99 and no further, then empties on the take that levels it", () => {
    const near = [rep({ pace: 99, fillers: 100 })];
    expect(one(near, "pace")).toMatchObject({ level: 0, percent: 99 });
    expect(closestLine(one(near, "pace"))).toBe("Closest yet: 99 of the 100 it needed.");
    const leveled = one([...near, rep({ pace: 72 })], "pace");
    expect(leveled).toMatchObject({ level: 1, percent: 0, closest: null });
    expect(levelLine(leveled).said).toBe("Level 1, 0% of the way to level 2");
    expect(closestLine(leveled)).toBe("Closest since level 1: none yet.");
  });

  it("counts no try from a recording that was not enough to score", () => {
    const t = one([rep({ pause: 68 }, null, EMPTY_SPEECH)], "pause");
    expect(t.closest).toBeNull();
    expect(t.percent).toBe(0);
  });

  it("ranks one level by how far into it", () => {
    const ranked = rankedTraits(levels);
    expect(ranked.map((t) => t.key).slice(0, 5)).toEqual(["fillers", "pace", "pause", "structure", "confidence"]);
    const zero = ranked.filter((t) => t.level === 0).map((t) => t.percent);
    expect(zero).toEqual([...zero].sort((a, b) => b - a));
  });
});

describe("levelLine", () => {
  it("says the level, and the bar's share of the way to the next", () => {
    expect(levelLine({ level: 6, percent: 40 })).toEqual({
      value: "Level 6",
      percent: 40,
      said: "Level 6, 40% of the way to level 7",
    });
  });

  it("draws an empty bar after a level, a level being a real place to be", () => {
    expect(levelLine({ level: 1, percent: 0 })).toEqual({
      value: "Level 1",
      percent: 0,
      said: "Level 1, 0% of the way to level 2",
    });
  });

  it("says level 0 where a try has come part of the way", () => {
    expect(levelLine({ level: 0, percent: 62 }).value).toBe("Level 0");
    expect(levelLine({ level: 0, percent: 62 }).said).toBe("Level 0, 62% of the way to level 1");
  });

  it("says Not yet, with no bar, at level 0 with nothing toward 1", () => {
    expect(levelLine({ level: 0, percent: 0 })).toEqual({
      value: "Not yet",
      percent: null,
      said: "Not yet at level 1",
    });
  });
});

describe("closestLine", () => {
  it("names the closest try and what it needed", () => {
    expect(closestLine({ level: 6, closest: { score: 28, need: 70, leveled: null } })).toBe(
      "Closest since level 6: 28 of the 70 it needed."
    );
    expect(closestLine({ level: 2, closest: { score: 76, need: 80, leveled: "fillers" } })).toBe(
      "Closest since level 2: 76 of the 80 it needed."
    );
    expect(closestLine({ level: 0, closest: { score: 50, need: 80, leveled: "fillers" } })).toBe("Closest yet: 50 of the 80 it needed.");
  });

  it("names a tie lost in the screen's own name, never '100 of the 100 it needed'", () => {
    const tie = { level: 3, closest: { score: 100, need: 100, leveled: "fillers" as const } };
    expect(closestLine(tie, (k) => (k === "fillers" ? "Filler control" : k))).toBe(
      "Closest since level 3: 100, tied with Filler control, which leveled instead."
    );
    // No ums and no restarts on one take: Filler control 100 levels, Follow-through ties it.
    const repairs = traitLevels([rep({ fillers: 100, repairs: 100, pace: 80 })]).find((t) => t.key === "repairs")!;
    expect(repairs).toMatchObject({ level: 0, percent: 99 });
    expect(closestLine(repairs)).toBe("Closest yet: 100, tied with Fillers, which leveled instead.");
  });

  it("says why a bar is empty after a level, and nothing where Not yet has said it", () => {
    expect(closestLine({ level: 1, closest: null })).toBe("Closest since level 1: none yet.");
    expect(closestLine({ level: 0, closest: null })).toBeNull();
  });
});
