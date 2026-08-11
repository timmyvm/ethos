import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Copy rules, asserted rather than remembered (decisions 11 Aug, §8).
 *
 * "Confidence" is banned from all copy: every competitor uses it, it's
 * the vaguest possible promise, and it names the outcome rather than the
 * thing being trained. A ban that lives only in a document comes back
 * the first time someone writes a paywall headline in a hurry.
 */
const ROOTS = ["app", "components"];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * Reduce a file to roughly what a user reads. Comments come out (the
 * ban is on copy, and the reason for the ban has to be writable next to
 * the code enforcing it), and so do the places the stem is an
 * identifier: `coach.dimensions.confidence.score`, or `confidence:` as
 * an object or type key. The Index dimension keeps its key everywhere —
 * §8 governs the label, not the schema.
 */
function copyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\.\s*confiden\w*/gi, "")
    .replace(/\bconfiden\w*\s*:/gi, "");
}

describe("banned words", () => {
  const files = ROOTS.flatMap(tsxFiles);

  it("has files to check (so a bad glob can't pass silently)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    it(`keeps "confidence" out of ${file}`, () => {
      const found = copyOnly(readFileSync(file, "utf8")).match(/confiden\w*/i);
      expect(found?.[0] ?? null).toBeNull();
    });
  }
});

describe("the two headlines", () => {
  it("puts the clarity line on acquisition surfaces", () => {
    const line = "Practice being worth listening to";
    for (const file of ["app/layout.tsx", "app/manifest.ts"]) {
      expect(readFileSync(file, "utf8")).toContain(line);
    }
  });

  it("puts the brand line in onboarding", () => {
    expect(readFileSync("app/welcome/page.tsx", "utf8")).toContain(
      "Earn the room."
    );
  });

  /**
   * §7 — the differentiator is format, not features. Yoodli does body
   * language over webcam and is well funded enough that claiming
   * otherwise is both false and checkable.
   */
  it("never claims nobody does body language", () => {
    const marketing = readFileSync("app/(marketing)/about/page.tsx", "utf8");
    expect(marketing).toMatch(/Yoodli/);
    expect(marketing).toMatch(/daily, streak-driven, gamified reps with video/);
  });
});
