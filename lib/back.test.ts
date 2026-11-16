import { describe, expect, it } from "vitest";
import { backRetraces, pathUnder } from "./back";

const nav = (urls: string[], at: number) => ({
  currentEntry: { url: urls[at], index: at },
  entries: () => urls.map((url, index) => ({ url, index })),
});

/* Back retraces a step (#442): only when the screen under this one is the screen back names. */
describe("the entry under this screen", () => {
  it("is the one before it in history", () => {
    expect(pathUnder(nav(["https://e.app/lessons", "https://e.app/lessons/the-cold-open"], 1))).toBe("/lessons");
    expect(pathUnder(nav(["https://e.app/", "https://e.app/you", "https://e.app/settings"], 2))).toBe("/you");
  });

  it("is read without its query or a trailing slash", () => {
    expect(pathUnder(nav(["https://e.app/games?paywall=1", "https://e.app/boss"], 1))).toBe("/games");
    expect(pathUnder(nav(["https://e.app/history/", "https://e.app/rep/abc"], 1))).toBe("/history");
    expect(pathUnder(nav(["https://e.app/?splash", "https://e.app/lessons"], 1))).toBe("/");
  });

  it("is nothing on the first entry, or where the browser cannot say", () => {
    expect(pathUnder(nav(["https://e.app/lessons/the-cold-open"], 0))).toBeNull();
    expect(pathUnder(null)).toBeNull();
    expect(pathUnder({})).toBeNull();
    expect(pathUnder({ currentEntry: { index: 1 }, entries: () => { throw new Error("no"); } })).toBeNull();
  });
});

describe("whether back retraces", () => {
  it("does when the screen under this one is where back goes", () => {
    expect(backRetraces("/lessons", "/lessons")).toBe(true);
    expect(backRetraces("/", "/")).toBe(true);
    expect(backRetraces("/you?from=settings", "/you")).toBe(true);
  });

  it("does not when another screen is under it: back still goes where it says", () => {
    // Opened a lesson from Today's card: its back says Lessons, and Today is under it.
    expect(backRetraces("/lessons", "/")).toBe(false);
    expect(backRetraces("/history", "/rep")).toBe(false);
  });

  it("does not on a cold open, with nothing under it", () => {
    expect(backRetraces("/lessons", null)).toBe(false);
  });
});
