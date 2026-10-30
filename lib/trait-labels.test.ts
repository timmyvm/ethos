import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRAITS } from "@/content/traits";
import type { RepRow } from "./client-data";
import { ALL_FILLERS_LABEL, movedRows, presenceRow } from "./log";

/*
 * One trait, one unit (E32). A row or a card label that reads as a
 * trait's display name ("Fillers / min") claims to be that trait, so it
 * prints that trait's unit from content/traits.ts. Today's Fillers tile
 * is um or uh per hundred words; the Log's and You's rate counts every
 * filler a minute, and under the trait's name it read as the same trait
 * in a second unit (0.7 on Today, 2.8 on the Log).
 */

/** "Fillers / min" is "Fillers" a minute; "Held pauses" has no rate. */
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

function rep(over: Partial<RepRow>): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: "2026-10-04T09:00:00Z",
    duration_s: 60,
    transcript: "",
    wpm: 140,
    filler_count: 4,
    fillers: [],
    pauses: [],
    stars: 1,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 512,
    audio_path: null,
    dimensions: null,
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "video",
    delivery_metrics: null,
    presence_score: 60,
    delivery_moments: null,
    ...over,
  } as RepRow;
}

/** Every string literal the results' Since day one card draws as a label. */
function comparisonCardLabels(): string[] {
  const src = readFileSync("components/ComparisonCard.tsx", "utf8");
  return [...src.matchAll(/(?:label|fillers|wpm|pause): "([^"]+)"/g)].map((m) => m[1]);
}

/** Every string literal the Day 1 vs now card draws as a row's label. */
function shareCardLabels(): string[] {
  const src = readFileSync("components/ShareCard.tsx", "utf8");
  return [...src.matchAll(/\[\s*"([^"]+)",/g)].map((m) => m[1]);
}

const reps = [rep({}), rep({ created_at: "2026-10-29T09:00:00Z", filler_count: 2 })];
const labels = [
  ...movedRows(reps).map((r) => r.label),
  presenceRow(reps)!.label,
  ALL_FILLERS_LABEL.row,
  ALL_FILLERS_LABEL.card,
  ...shareCardLabels(),
  ...comparisonCardLabels(),
];

describe("a label that names a trait prints that trait's unit", () => {
  it("finds the labels it holds to the rule", () => {
    // The Log's four rows, Presence, the label pair, and the card's rows.
    expect(labels.length).toBeGreaterThanOrEqual(8);
    expect(shareCardLabels()).toEqual(expect.arrayContaining(["Words / min", "Held pauses"]));
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

  it("calls the every-filler rate All fillers, on the Log and on You", () => {
    expect(ALL_FILLERS_LABEL).toEqual({ row: "All fillers / min", card: "All fillers a minute" });
    expect(movedRows(reps).find((r) => r.key === "fillers")!.label).toBe(ALL_FILLERS_LABEL.row);
    expect(readFileSync("components/ShareCard.tsx", "utf8")).not.toMatch(/"Fillers (\/ min|a minute)"/);
    // The results' Since day one card prints the same number, so it
    // borrows the same label.
    const comparison = readFileSync("components/ComparisonCard.tsx", "utf8");
    expect(comparison).not.toMatch(/"Fillers (\/ min|a minute)"/);
    expect(comparison.match(/ALL_FILLERS_LABEL\.row/g)?.length).toBe(2);
    // The Fillers trait itself is not a minute rate, so the old label
    // broke the rule this file holds.
    expect(traitNamed("Fillers / min")?.id).toBe("fillers");
    expect(TRAITS.find((t) => t.id === "fillers")!.unit.endsWith("a minute")).toBe(false);
  });
});
