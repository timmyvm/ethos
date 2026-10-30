import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { waitingRows } from "./log-waiting";
import { introHref, UNITS } from "./path";

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

  /*
   * Go starts a lesson the way Today's Start does (notes1, round 2): a
   * new account with intros on meets the unit's teaching screen first
   * (#210), and that screen's Start then opens the lesson the row named,
   * not just the unit's first. Intros off, Go goes straight to the
   * recording.
   */
  it("sends each Go through the unit's teaching screen first while intros are on, as Today does", () => {
    const unit = UNITS[0].id;
    expect(rows.map((r) => r.href)).toEqual(rows.map((r) => `/lesson/${unit}?lesson=${r.id}&from=log`));
    expect(waitingRows(3, { intros: true })[1].href).toBe(`/lesson/${unit}?lesson=f2&from=log`);
  });

  it("sends each Go straight to that lesson's recording when intros are off", () => {
    const off = waitingRows(3, { intros: false });
    expect(off.map((r) => r.href)).toEqual(off.map((r) => `/rep?lesson=${r.id}`));
    expect(off[0].href).toBe("/rep?lesson=f1");
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
    expect(src).toMatch(/waitingRows\(/);
    expect(src).toMatch(/aria-label=\{row\.label\}/);
  });

  it("puts no terracotta fill on the rows: three identical taps would be three primaries", () => {
    const empty = src.slice(src.indexOf("waitingRows(3"), src.indexOf("newestFirst.map"));
    expect(empty).not.toMatch(/bg-terracotta|ACTION_CLASS/);
  });
});

describe("introHref names the lesson the teaching screen leads to", () => {
  it("is the bare unit route without one, as Today and the introduction use it", () => {
    expect(introHref("filler")).toBe("/lesson/filler");
    expect(introHref("filler", ["no-notes"])).toBe("/lesson/filler?mods=no-notes");
  });
  it("carries the lesson when a row named one", () => {
    expect(introHref("filler", [], "f2")).toBe("/lesson/filler?lesson=f2");
    expect(introHref("filler", ["no-notes"], "f3")).toBe("/lesson/filler?mods=no-notes&lesson=f3");
  });
});

describe("the teaching screen and the Log agree on the way in", () => {
  it("the unit intro starts the lesson it was sent for, when that lesson is in the unit", () => {
    const src = readFileSync("app/lesson/[unit]/page.tsx", "utf8");
    expect(src).toMatch(/searchParams\.get\("lesson"\)/);
  });
  it("the Log reads the intros setting before it builds its Go links", () => {
    const src = readFileSync("app/history/page.tsx", "utf8");
    expect(src).toMatch(/readPrefs\(\)\.skipIntros/);
    expect(src).toMatch(/waitingRows\(3, \{ intros: !skipIntros \}\)/);
  });
});
