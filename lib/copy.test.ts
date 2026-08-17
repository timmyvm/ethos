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

/**
 * COPY-RULES.md, asserted rather than remembered.
 *
 * The em dash is the house's favourite punctuation mark and that is
 * exactly the problem: at one per screen it's a hinge, at five it's a
 * tic, and a tic is what "written by a language model" reads like. Same
 * argument for the mantra — "never money" is a principle, and a
 * principle repeated three times a screen is a slogan.
 *
 * Counting is deliberately conservative: comments are stripped (the
 * reason for a rule has to be writable next to the code enforcing it),
 * and a dash only counts when prose surrounds it, so `{coins ?? "—"}`
 * — a number nobody could read — isn't a copy violation.
 */
const PROSE_EM_DASH = /[A-Za-z0-9,;:)"'’]\s+—\s+\S/g;

/**
 * Screens allowed more than one, each for a reason that isn't "we liked
 * it there". The budget is per SCREEN; these files hold several.
 */
const DASH_ALLOWANCE: Record<string, number> = {
  // Three carousel slides, one dash each (DECISIONS #133).
  "app/welcome/page.tsx": 3,
};

describe("copy budgets", () => {
  const files = ROOTS.flatMap(tsxFiles);

  for (const file of files) {
    it(`keeps ${file} inside its em-dash budget`, () => {
      const found = copyOnly(readFileSync(file, "utf8")).match(PROSE_EM_DASH);
      expect(found?.length ?? 0).toBeLessThanOrEqual(
        DASH_ALLOWANCE[file] ?? 1
      );
    });
  }

  it("never explains a design decision with “which is why”", () => {
    for (const file of files) {
      expect(copyOnly(readFileSync(file, "utf8"))).not.toMatch(
        /—\s*which is why/i
      );
    }
  });

  it("says the mantra once per screen or not at all", () => {
    for (const file of files) {
      const hits = copyOnly(readFileSync(file, "utf8")).match(/never money/gi);
      expect(hits?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });
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
