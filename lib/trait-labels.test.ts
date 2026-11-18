import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRAITS } from "@/content/traits";
import {
  ALL_FILLERS,
  ALL_FILLERS_PER_MIN,
  PAUSES_PER_RECORDING,
  WORDS_A_MINUTE,
  pausesBetween,
} from "./metric-labels";

/*
 * One trait, one unit (E32). A row or a card label that reads as a
 * trait's display name ("Fillers / min") claims to be that trait, so it
 * prints that trait's unit from content/traits.ts. Today's Fillers tile
 * is um or uh per hundred words; the Log's and You's rate counts every
 * filler a minute, and under the trait's name it read as the same trait
 * in a second unit (0.7 on Today, 2.8 on the Log).
 */

/** "Fillers / min" is "Fillers" a minute; a count in a recording has no rate. */
const RATE = / \/ min$| a minute$/;

function subject(label: string): string {
  return label.replace(RATE, "").trim().toLowerCase();
}

function traitNamed(label: string) {
  return TRAITS.find((t) => t.name.toLowerCase() === subject(label));
}

/** The words a label prints for its rate, or null when it prints none. */
function rateOf(label: string): string | null {
  return RATE.test(label) ? "a minute" : null;
}

/** Every string literal the results' Since day one card draws as a label. */
function comparisonCardLabels(): string[] {
  const src = readFileSync("components/ComparisonCard.tsx", "utf8");
  return [...src.matchAll(/(?:label|fillers|wpm|pause): "([^"]+)"/g)].map((m) => m[1]);
}

/* The labels that say a measure in one line. The Log's What moved rows,
   which set each name over its unit (#495), went with #506. */
const labels = [
  ALL_FILLERS_PER_MIN,
  PAUSES_PER_RECORDING,
  WORDS_A_MINUTE,
  ...comparisonCardLabels(),
];

describe("a label that names a trait prints that trait's unit", () => {
  it("finds the labels it holds to the rule", () => {
    // The three one-line labels and the card's rows. (You's Day 1 vs now
    // card and its shared picture went on 12 Nov, #458; the Log's What
    // moved rows with #506.)
    expect(labels.length).toBeGreaterThanOrEqual(4);
  });

  for (const label of labels) {
    it(`"${label}"`, () => {
      const trait = traitNamed(label);
      if (!trait) return;
      // Under a trait's own name, the rate is the trait's own unit.
      expect(rateOf(label), `${label} is ${trait.name}, measured in ${trait.unit}`).not.toBeNull();
      expect(trait.unit.endsWith(rateOf(label)!)).toBe(true);
    });
  }

  it("pace is said in the Pace trait's own unit, in its words (#495)", () => {
    expect(WORDS_A_MINUTE.toLowerCase()).toBe(TRAITS.find((t) => t.id === "pace")!.unit);
  });

  it("calls the every-filler rate All fillers a minute, everywhere it is printed", () => {
    // Timothy, 31 October (E32): one label wherever the rate is printed;
    // its unit in words since #495.
    expect(ALL_FILLERS_PER_MIN).toBe("All fillers a minute");
    // The results' Since day one card prints the same number, so it
    // borrows the same label.
    const comparison = readFileSync("components/ComparisonCard.tsx", "utf8");
    expect(comparison).not.toMatch(/"Fillers (\/ min|a minute)"/);
    expect(comparison.match(/(label|fillers): ALL_FILLERS_PER_MIN,/g)?.length).toBe(2);
    // The Fillers trait itself is not a minute rate, so the old label
    // broke the rule this file holds.
    expect(traitNamed("Fillers / min")?.id).toBe("fillers");
    expect(TRAITS.find((t) => t.id === "fillers")!.unit.endsWith("a minute")).toBe(false);
  });
});

describe("the bare word Fillers means the trait (E32)", () => {
  it("never labels the every-filler rate or count", () => {
    // The Index's Fillers row runs on the every-filler rate, so its
    // detail names the rate by its label.
    const dims = readFileSync("components/DimensionList.tsx", "utf8");
    expect(dims).toMatch(/\$\{ALL_FILLERS_PER_MIN\}: \$\{metrics\.fillersPerMin\}/);
    // A Hostile take counts every filler, so its stat is All fillers.
    const hostile = readFileSync("app/hostile/page.tsx", "utf8");
    expect(hostile).not.toMatch(/label="Fillers"/);
    expect(hostile).toMatch(/label=\{ALL_FILLERS\}/);
    expect(ALL_FILLERS).toBe("All fillers");
  });
});

describe("one recording's pauses between sentences (#495)", () => {
  const pauses = [
    { t: 3, len: 1.2, kind: "pre" as const },
    { t: 9, len: 1.4, kind: "mid" as const },
    { t: 14, len: 0.5, kind: "beat" as const },
    { t: 20, len: 1.1, kind: "pre" as const },
    { t: 31, len: 2.0, kind: "mid" as const },
  ];

  it("counts the pauses between sentences only, never one mid-sentence", () => {
    expect(pausesBetween(pauses)).toBe(2);
    expect(pausesBetween(null)).toBe(0);
    // Three mid-sentence pauses more is a worse take, and the count does not rise.
    const worse = [...pauses, ...pauses.filter((p) => p.kind === "mid")];
    expect(pausesBetween(worse)).toBe(2);
  });

  it("reads Pauses between sentences in a recording wherever two recordings are compared", () => {
    expect(PAUSES_PER_RECORDING).toBe("Pauses between sentences in a recording");
    const src = readFileSync("components/ComparisonCard.tsx", "utf8");
    expect(src).not.toMatch(/"Held pauses"|kind !== "beat"/);
    expect(src).toMatch(/PAUSES_PER_RECORDING,/);
    expect(src).toMatch(/pausesBetween\(/);
  });
});

describe("a unit is said in words (#495)", () => {
  it("no compared label prints a slash unit or wpm", () => {
    const shown = labels;
    for (const l of shown) expect(l, l).not.toMatch(/\/ ?min\b|\/ ?100|\bwpm\b|\/ recording/i);
  });

  /* The review of #495: Presence's gesture rate read "per minute" beside
     its own moments' "4 gestures a minute". One rate, one spelling. */
  it("Presence's gesture rate says a minute, as its moments do", () => {
    const card = readFileSync("components/PresenceCard.tsx", "utf8");
    expect(card).toMatch(/label="Gestures"[\s\S]{0,80}note="a minute"/);
    expect(card).not.toMatch(/"per minute"/);
    expect(readFileSync("lib/presence.ts", "utf8")).toMatch(/gestures a minute/);
  });
});
