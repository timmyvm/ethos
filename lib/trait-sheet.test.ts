import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { isTaught, practiseHref, sheetReading } from "./trait-sheet";

/** A stored recording with just what the readings read. */
function rep(over: Partial<RepRow> = {}): RepRow {
  return {
    duration_s: 60,
    transcript: "so I think the point is that we should start with what we know and build from there ".repeat(4),
    wpm: 155,
    filler_count: 3,
    fillers: [],
    pauses: [{ kind: "held" }, { kind: "held" }],
    dimensions: null,
    ...over,
  } as unknown as RepRow;
}

describe("the trait sheet shows how you speak it (D37)", () => {
  it("reads a taught trait in its own unit, with where it places you", () => {
    const r = sheetReading("pace", [rep()]);
    expect(r).not.toBeNull();
    expect(r!.value).toBe("155");
    expect(r!.unit).toMatch(/wpm|words/);
    // Where it places you in words, never the ordinal (#471), and what
    // that is measured against under it, honest that it is an estimate.
    expect(r!.placement).toMatch(/^Nearer the middle of 130 to 160 than \d+ in 100 speakers$/);
    expect(r!.placement).not.toMatch(/percentile|\d+(st|nd|rd|th)\b/);
    expect(r!.source).toBe(
      "Against published speech research, not other Ethos users. An estimate for now."
    );
  });

  it("says a fewer-is-better trait's place the right way up (#471)", () => {
    // 3 fillers in about 70 words: the words say fewer, so a high place
    // can never read as more fillers than most.
    const r = sheetReading("fillers", [rep()]);
    expect(r!.placement).toMatch(/^Fewer ums and uhs than \d+ in 100 speakers$/);
  });

  it("reads the newest recording", () => {
    expect(sheetReading("pace", [rep({ wpm: 120 }), rep({ wpm: 148 })])!.value).toBe("148");
  });

  it("draws nothing it has not read: a dash, never a zero", () => {
    expect(sheetReading("pace", [])).toBeNull();
    expect(sheetReading("structure", [rep()])).toBeNull();
  });

  it("reads an Index trait as its last judged score out of 100 and its band, with no percentile", () => {
    const judged = rep({
      dimensions: { tier1: {}, anchors: {}, tier2: { structure: { score: 71.6 } } } as unknown as RepRow["dimensions"],
    });
    expect(sheetReading("structure", [judged, rep()])).toEqual({ value: "72", unit: "/ 100", placement: "Strong", source: null });
  });

  it("lets you practise only the five the lessons teach, from You", () => {
    for (const key of ["pause", "fillers", "repairs", "pace", "range"]) {
      expect(isTaught(key)).toBe(true);
      expect(practiseHref(key)).toMatch(new RegExp(`^/lessons/[a-z-]+\\?from=you$`));
    }
    for (const key of ["structure", "credibility", "engagement", "confidence"]) {
      expect(practiseHref(key)).toBeNull();
    }
  });

  it("Practise opens the trait's next lesson, not its walk (D37)", () => {
    // Nothing recorded: the trait's first lesson.
    expect(practiseHref("pace")).toBe("/lessons/room-to-land?from=you");
    expect(practiseHref("pause")).toBe("/lessons/the-landing?from=you");
    // A started lesson is carried on with; a finished one is passed.
    expect(practiseHref("pace", { "room-to-land": 3, "one-gear-down": 1 })).toBe("/lessons/one-gear-down?from=you");
    expect(practiseHref("pace", { "room-to-land": 3 })).toBe("/lessons/one-gear-down?from=you");
    // All three finished: back to its first.
    expect(practiseHref("pace", { "room-to-land": 3, "one-gear-down": 3, "change-gear": 3 })).toBe("/lessons/room-to-land?from=you");
    // Another trait's progress never moves it.
    expect(practiseHref("pace", { "the-landing": 1 })).toBe("/lessons/room-to-land?from=you");
  });

  it("every information sheet closes with Done at the top right", () => {
    for (const f of ["app/you/page.tsx", "components/premium/ManageSheet.tsx", "components/premium/Moments.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/<SheetHead\b/);
    }
    const drop = readFileSync("components/premium/Moments.tsx", "utf8");
    const body = drop.slice(drop.indexOf("function DropBody")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body, "the price drop carries no terracotta").not.toMatch(/ACTION_CLASS|terracotta/);
    expect(body).toMatch(/pose="hello"/);
  });

  it("Cancel plan reads as red, with no chevron", () => {
    const sheet = readFileSync("components/premium/ManageSheet.tsx", "utf8");
    const group = sheet.slice(sheet.indexOf("const cancelGroup"), sheet.indexOf("return (", sheet.indexOf("const cancelGroup")));
    expect(group).toMatch(/text-destructive/);
    expect(group).not.toMatch(/Disclosure|<Row\b/);
  });
});
