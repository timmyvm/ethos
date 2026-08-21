import { describe, expect, it } from "vitest";
import {
  DOUBLE_AT,
  LEVEL_AT,
  rankedTraits,
  repTraitGain,
  TRAITS,
  traitGain,
  traitLevels,
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
