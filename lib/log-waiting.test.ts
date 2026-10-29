import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { waitingRows } from "./log-waiting";
import { UNITS } from "./path";

/*
 * The Log's empty table (notes1, Timothy: "in log remove start. and js
 * add a go button to each waiting to be logged, make it match tho").
 * Each of the three rows waiting to be logged opens its own lesson's
 * recording, by the route the debrief and the achievements already use
 * for a lesson on the road.
 */
describe("waitingRows", () => {
  const rows = waitingRows();

  it("is the first three lessons on the road, in order", () => {
    expect(rows.map((r) => r.id)).toEqual(UNITS[0].lessons.slice(0, 3).map((l) => l.id));
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(rows[0].title).toBe("The baseline");
  });

  it("sends each Go to that lesson's recording", () => {
    expect(rows.map((r) => r.href)).toEqual(rows.map((r) => `/rep?lesson=${r.id}`));
    expect(rows[0].href).toBe("/rep?lesson=f1");
  });

  it("names each Go by its lesson for a screen reader, the visible word first", () => {
    expect(rows[0].label).toBe("Go: The baseline");
    for (const r of rows) expect(r.label.startsWith("Go")).toBe(true);
  });
});

describe("the Log's empty state", () => {
  const src = readFileSync("app/history/page.tsx", "utf8");

  it("has no Start: the Go on each row is the way in", () => {
    expect(src).not.toMatch(/>\s*Start\s*</);
    expect(src).not.toMatch(/href="\/rep"/);
  });

  it("draws its rows from waitingRows, each with a labelled Go", () => {
    expect(src).toMatch(/waitingRows\(\)/);
    expect(src).toMatch(/aria-label=\{row\.label\}/);
  });

  it("puts no terracotta fill on the rows: three identical taps would be three primaries", () => {
    const empty = src.slice(src.indexOf("waitingRows()"), src.indexOf("newestFirst.map"));
    expect(empty).not.toMatch(/bg-terracotta|ACTION_CLASS/);
  });
});
