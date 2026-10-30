import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backFrom, fromParam, withFrom } from "./back-from";
import { introHref } from "./path";
import { waitingRows } from "./log-waiting";

/**
 * D18: a back control names its parent. The two screens more than one
 * tab opens read `?from=`; with none, their owning tab.
 */
describe("a back names the screen it returns to", () => {
  it("reads the opener from ?from=", () => {
    expect(backFrom("today", "lessons")).toEqual({ href: "/", label: "Today" });
    expect(backFrom("log", "today")).toEqual({ href: "/history", label: "Log" });
    expect(backFrom("you", "today")).toEqual({ href: "/you", label: "You" });
    expect(backFrom("lessons", "today")).toEqual({ href: "/lessons", label: "Lessons" });
  });

  it("falls back to the owning tab for a missing or unknown value", () => {
    expect(backFrom(null, "today").label).toBe("Today");
    expect(backFrom(undefined, "lessons").label).toBe("Lessons");
    expect(backFrom("settings", "lessons").label).toBe("Lessons");
    expect(backFrom("toString", "today").label).toBe("Today");
    expect(fromParam("constructor")).toBeUndefined();
  });

  it("adds from= after any query the door already carries", () => {
    expect(withFrom("/practice/pace", "today")).toBe("/practice/pace?from=today");
    expect(withFrom("/practice/pace?done=1", "you")).toBe("/practice/pace?done=1&from=you");
    expect(withFrom("/a?b=1#c", "log")).toBe("/a?b=1&from=log#c");
    expect(withFrom("/practice/pace", undefined)).toBe("/practice/pace");
  });

  it("the doors into the teaching screen say who opened it", () => {
    expect(introHref("filler", [], "f2", "log")).toBe("/lesson/filler?lesson=f2&from=log");
    for (const row of waitingRows(3, { intros: true })) {
      expect(row.href).toMatch(/from=log$/);
    }
    expect(readFileSync("app/page.tsx", "utf8")).toMatch(/introHref\([^)]*"today"\)/);
    expect(readFileSync("app/welcome/page.tsx", "utf8")).toMatch(/introHref\([^)]*"today"\)/);
  });

  it("an inner step's back names a title the walk really shows", () => {
    const src = readFileSync("app/practice/[trait]/page.tsx", "utf8");
    const block = src.slice(src.indexOf("const STEP_TITLE"), src.indexOf("export default"));
    for (const [, title] of block.matchAll(/=> "([^"]+)"/g)) {
      expect(src, title).toContain(`title="${title}"`);
    }
  });

  it("no back in the trait page or the teaching screen says Back", () => {
    for (const f of ["app/practice/[trait]/page.tsx", "app/lesson/[unit]/page.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/\bbackLabel\b/);
      expect(src, f).not.toMatch(/backLabel="Back"/);
    }
  });
});
