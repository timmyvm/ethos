import { describe, expect, it } from "vitest";
import { TRAITS } from "@/content/traits";
import {
  BAND_WORD,
  band,
  bandOf,
  DIMENSION_NAME,
  dimensionRows,
  everyLine,
  fillerTrend,
  OKAY_AT,
  paceWords,
  rowsHeadline,
  STRONG_AT,
  STRONG_PHRASE,
  varietyWords,
  weightLine,
  type DimensionRow,
} from "./dimension-rows";
import { ethosIndex, INDEX_WEIGHTS } from "./index-score";
import { LEVEL_AT } from "./traits";
import { placeHold, placeLine, placeSource, placeWords } from "./trait-readings";

const tier1 = { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 };
const tier2 = {
  structure: { score: 64 },
  credibility: { score: 58 },
  engagement: { score: 61 },
  confidence: { score: 66 },
};

describe("a row says how it went in one word (#471)", () => {
  it("bands by the row's share of its max: Strong from 70, Okay from 50, under that Work on this", () => {
    expect(STRONG_AT).toBe(70);
    expect(OKAY_AT).toBe(50);
    expect(band(1)).toBe("strong");
    expect(band(0.7)).toBe("strong");
    expect(band(0.69)).toBe("okay");
    expect(band(0.5)).toBe("okay");
    expect(band(0.49)).toBe("work");
    expect(band(0)).toBe("work");
    expect(band(Number.NaN)).toBe("work");
    expect(BAND_WORD).toEqual({ strong: "Strong", okay: "Okay", work: "Work on this" });
  });

  it("is the same band on any max: 132/150 is 88/100", () => {
    expect(bandOf(132, 150)).toBe(bandOf(88));
    expect(bandOf(45, 50)).toBe("strong");
    expect(bandOf(24, 50)).toBe("work");
  });

  it("calls Strong exactly what can level a trait on You", () => {
    // One line for both: a row that reads Strong is a row that could level.
    expect(STRONG_AT).toBe(LEVEL_AT);
    expect(bandOf(LEVEL_AT)).toBe("strong");
    expect(bandOf(LEVEL_AT - 1)).not.toBe("strong");
  });
});

describe("one scale for the rows, the same Index (#471)", () => {
  const rows = dimensionRows(tier1, tier2);

  it("lists every row out of 100 in the Index's order, named for the skill", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Pausing",
      "Filler control",
      "Follow-through",
      "Pace",
      "Variety",
      "Structure",
      "Credibility",
      "Engagement",
      "Steadiness",
    ]);
    expect(rows.map((r) => r.score)).toEqual([72, 55, 66, 93, 66, 64, 58, 61, 66]);
    expect(rows.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
  });

  it("keeps the Index the same number: the rows' points still sum to it", () => {
    const index = ethosIndex(tier1, {
      structure: 64,
      credibility: 58,
      engagement: 61,
      confidence: 66,
    });
    expect(rows.reduce((s, r) => s + r.points, 0)).toBe(index);
    expect(rows.map((r) => r.weight)).toEqual(Object.values(INDEX_WEIGHTS));
  });

  it("draws no row a take never had: no judged four without the coach, no Follow-through before the split", () => {
    expect(dimensionRows(tier1, null)).toHaveLength(5);
    const { repairs: _, ...old } = tier1;
    expect(dimensionRows(old, null).map((r) => r.key)).toEqual(["pause", "fillers", "pace", "range"]);
  });

  it("clamps and rounds a score as the Index reads it", () => {
    const [p] = dimensionRows({ ...tier1, pause: 104.6 }, null);
    expect(p.score).toBe(100);
    expect(dimensionRows({ ...tier1, pause: 71.6 }, null)[0].score).toBe(72);
  });
});

describe("a fault is named for its skill where its number is a score (#471)", () => {
  it("never puts a fault's name over a score", () => {
    // "Fillers 88" read as 88 fillers; the count keeps the trait's name.
    for (const name of Object.values(DIMENSION_NAME)) {
      expect(name).not.toMatch(/^(Fillers|Restarts|Self-corrections)$/);
    }
  });

  it("keeps the trait's name where it is already a skill, and the root word where it is not", () => {
    for (const t of TRAITS) {
      expect(DIMENSION_NAME[t.id]).toBe(t.skill);
      if (t.id === "pause" || t.id === "pace" || t.id === "range") expect(t.skill).toBe(t.name);
    }
    expect(DIMENSION_NAME.fillers).toBe("Filler control");
    expect(DIMENSION_NAME.repairs).toBe("Follow-through");
    expect(DIMENSION_NAME.confidence).toBe("Steadiness");
  });
});

describe("how the 1000 is made, said where the rows no longer add up to it (#471)", () => {
  it("names every weight from the Index's own, heaviest first, the commonest as the rest", () => {
    expect(weightLine(dimensionRows(tier1, tier2))).toBe(
      "Rows are out of 100. In the Index, Pausing, Structure and Credibility count up to 150 each, Follow-through 50, the other five 100."
    );
  });

  it("says the measured five alone the same way", () => {
    expect(weightLine(dimensionRows(tier1, null))).toBe(
      "Rows are out of 100. In the Index, Pausing counts up to 150, Follow-through 50, the other three 100."
    );
  });

  it("adds up: the weights it names are the weights the Index uses", () => {
    const rows = dimensionRows(tier1, tier2);
    expect(rows.reduce((s, r) => s + r.weight, 0)).toBe(1000);
    const line = weightLine(rows);
    for (const w of new Set(rows.map((r) => r.weight))) expect(line).toMatch(new RegExp(`\\b${w}\\b`));
  });
});

describe("one headline in words, the numbers under it (#471, plan §7)", () => {
  const row = (key: DimensionRow["key"], score: number): DimensionRow => {
    const all = dimensionRows({ pause: 0, fillers: 0, repairs: 0, pace: 0, range: 0 }, {
      structure: { score: 0 },
      credibility: { score: 0 },
      engagement: { score: 0 },
      confidence: { score: 0 },
    });
    const r = all.find((x) => x.key === key)!;
    return { ...r, score, band: bandOf(score) };
  };

  it("leads with the two strongest as what you did, then the one to work on", () => {
    const rows = [row("pause", 20), row("fillers", 60), row("structure", 86), row("confidence", 81), row("pace", 74)];
    expect(rowsHeadline(rows)).toBe("You got to the point and sounded steady. Pausing is the one to work on.");
  });

  it("names the lowest as the most room when nothing is under half", () => {
    expect(rowsHeadline([row("pace", 93), row("range", 66), row("fillers", 72)])).toBe(
      "You spoke at a good pace and kept fillers down. Variety has the most room to grow."
    );
  });

  it("never says fillers were kept out of a take that had some (#471 review)", () => {
    // Strong is up to 2.4 fillers a minute, so a Strong row can sit over
    // "2 in 60 seconds": the words may say down, never out or none.
    expect(STRONG_PHRASE.fillers).not.toMatch(/\b(out|no|none|zero|free)\b/);
  });

  it("says only the one to work on when nothing is Strong", () => {
    expect(rowsHeadline([row("pause", 20), row("fillers", 55)])).toBe("Pausing is the one to work on.");
  });

  it("says when every row is Strong", () => {
    expect(rowsHeadline([row("pace", 93), row("repairs", 90), row("fillers", 80)])).toBe(
      "You spoke at a good pace and finished your sentences. Strong on all 3."
    );
  });

  it("names only rows that are on the card under it", () => {
    const rows = dimensionRows(tier1, tier2);
    expect(rowsHeadline(rows)).toBe("You spoke at a good pace and let your points land. Filler control has the most room to grow.");
    expect(rowsHeadline([])).toBe("");
  });

  it("follows the copy rules: no dash, no full stop missing", () => {
    for (const line of [rowsHeadline(dimensionRows(tier1, tier2)), weightLine(dimensionRows(tier1, tier2))]) {
      expect(line).not.toMatch(/—|–/);
      expect(line.endsWith(".")).toBe(true);
    }
  });
});

describe("a count as people feel it (#471, plan §7)", () => {
  it("says how often, not the rate", () => {
    expect(everyLine(4, 62)).toBe("about one every 15 seconds");
    expect(everyLine(3, 65)).toBe("about one every 20 seconds");
    expect(everyLine(9, 60)).toBe("about one every 7 seconds");
    expect(everyLine(2, 140)).toBe("about one a minute");
    expect(everyLine(2, 300)).toBe("about one every 3 minutes");
  });

  it("says nothing for one or none, where it would only repeat the length", () => {
    expect(everyLine(1, 62)).toBeNull();
    expect(everyLine(0, 62)).toBeNull();
    expect(everyLine(3, 0)).toBeNull();
  });

  it("puts pace against the zone in words", () => {
    expect(paceWords(145)).toBe("145 words a minute, inside the 130 to 160 zone.");
    expect(paceWords(172)).toBe("172 words a minute, 12 over the 130 to 160 zone.");
    expect(paceWords(118.4)).toBe("118 words a minute, 12 under the 130 to 160 zone.");
  });

  it("puts variety as words in every hundred, or nothing without a reading", () => {
    expect(varietyWords(0.618)).toBe("62 different words in every 100 you said.");
    expect(varietyWords(0)).toBeNull();
    expect(varietyWords(undefined)).toBeNull();
  });
});

describe("a percentile says what it is against and which way is up (#471)", () => {
  it("says where you sit in words, the right way up for every trait", () => {
    expect(placeWords({ id: "fillers", percentile: 93 })).toBe("Fewer ums and uhs than 93 in 100 speakers");
    expect(placeWords({ id: "repairs", percentile: 40 })).toBe("Fewer restarts than 40 in 100 speakers");
    expect(placeWords({ id: "pause", percentile: 18 })).toBe("More landed pauses than 18 in 100 speakers");
    expect(placeWords({ id: "range", percentile: 68 })).toBe("More varied words than 68 in 100 speakers");
    expect(placeWords({ id: "pace", percentile: 72 })).toBe("Nearer the middle of 130 to 160 than 72 in 100 speakers");
  });

  it("never claims everyone or no one", () => {
    expect(placeWords({ id: "fillers", percentile: 100 })).toContain("than 99 in 100");
    expect(placeWords({ id: "fillers", percentile: 0 })).toContain("than 1 in 100");
  });

  it("names the research, not other users, and stays honest that it is an estimate", () => {
    expect(placeSource("provisional")).toBe(
      "Against published speech research, not other Ethos users. An estimate for now."
    );
    expect(placeSource("good")).not.toMatch(/estimate/);
    expect(placeSource("good")).not.toMatch(/leaderboard|rank/i);
  });

  it("puts the place and its source in one line on the trait page (#471 review)", () => {
    expect(placeLine({ id: "fillers", percentile: 93, quality: "provisional" })).toBe(
      "Fewer ums and uhs than 93 in 100 speakers, against published speech research, not other Ethos users. An estimate for now."
    );
    expect(placeLine({ id: "pause", percentile: 18, quality: "provisional" }, true)).toMatch(/^Your lowest trait\. More landed pauses/);
  });

  it("holds the line's own shape while the read is in flight, so nothing moves when it lands", () => {
    // The hold is drawn invisible at the landed line's height: for every
    // trait and every place it can print, the landed line is the hold to
    // within the one digit "than 9" saves over "than 50".
    for (const t of TRAITS) {
      const hold = placeHold(t.id);
      expect(hold).toBe(placeLine({ id: t.id, percentile: 50, quality: "provisional" }));
      for (let p = 0; p <= 100; p++) {
        const landed = placeLine({ id: t.id, percentile: p, quality: "provisional" });
        expect(hold.length - landed.length, `${t.id} at ${p}`).toBeGreaterThanOrEqual(0);
        expect(hold.length - landed.length, `${t.id} at ${p}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the trend in words, with its numbers (#471, plan §7)", () => {
  const SAID =
    "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much at all.";
  const day = (n: number) => new Date(Date.UTC(2026, 10, 2 + n, 9)).toISOString();
  /** A first week of three takes at 8, 6 and 7 fillers a minute (a minute each). */
  const week = [
    { created_at: day(0), filler_count: 8, duration_s: 60, transcript: SAID },
    { created_at: day(2), filler_count: 6, duration_s: 60, transcript: SAID },
    { created_at: day(5), filler_count: 7, duration_s: 60, transcript: SAID },
  ];
  const at = new Date(Date.UTC(2026, 10, 15, 9));

  it("says this take against the first week's median, in words then numbers", () => {
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 4, durationS: 62 }, at })).toBe(
      "About half your first week's fillers a minute: 3.9, from 7."
    );
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 1, durationS: 60 }, at })).toBe(
      "Under a third of your first week's fillers a minute: 1, from 7."
    );
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 5, durationS: 60 }, at })).toBe(
      "Fewer than your first week's fillers a minute: 5, from 7."
    );
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 7, durationS: 60 }, at })).toBe(
      "About your first week's fillers a minute: 7, from 7."
    );
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 10, durationS: 60 }, at })).toBe(
      "More than your first week's fillers a minute: 10, from 7."
    );
  });

  it("compares a minute with a minute, whatever each take's length", () => {
    // 4 fillers in 30 seconds is 8 a minute, not "fewer" than 7.
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 4, durationS: 30 }, at })).toMatch(/^About your first week's/);
  });

  it("says nothing where it would not be honest", () => {
    // The history read does not reach the first recording.
    expect(fillerTrend({ reps: week, complete: false, now: { fillerCount: 4, durationS: 62 }, at })).toBeNull();
    // Still inside the first week.
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 4, durationS: 62 }, at: new Date(day(6)) })).toBeNull();
    // A first week with no fillers to be a fraction of.
    const clean = week.map((r) => ({ ...r, filler_count: 0 }));
    expect(fillerTrend({ reps: clean, complete: true, now: { fillerCount: 2, durationS: 60 }, at })).toBeNull();
    // Takes too short to score are no reading.
    const short = week.map((r) => ({ ...r, transcript: "Hi there." }));
    expect(fillerTrend({ reps: short, complete: true, now: { fillerCount: 2, durationS: 60 }, at })).toBeNull();
    expect(fillerTrend({ reps: [], complete: true, now: { fillerCount: 2, durationS: 60 }, at })).toBeNull();
  });

  it("says nothing of a take too short to score, which measured nothing (#471 review)", () => {
    // 0 fillers in 9 seconds is no reading, so never "Under a third".
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 0, durationS: 9, scorable: false }, at })).toBeNull();
    expect(fillerTrend({ reps: week, complete: true, now: { fillerCount: 4, durationS: 62, scorable: true }, at })).toMatch(
      /^About half/
    );
  });
});
