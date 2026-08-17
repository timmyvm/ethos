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
 * **No em dash reaches the user.** It was the house's favourite mark and
 * that was the problem: thirteen of them on the rep screen alone, which
 * is a tic, and a tic is what "written by a language model" reads like.
 * Zero is a rule anyone can check; "one per screen" was a rule that
 * needed a spreadsheet. Full stops, commas and colons do the work, and
 * they're shorter (DECISIONS #154).
 *
 * The same ban is written into the coach's system prompt, since half the
 * copy in a finished rep is generated.
 *
 * Counting is conservative. Comments come out, including trailing ones,
 * because the reason for a rule has to be writable next to the code
 * enforcing it. And a dash only counts as prose when whitespace and a
 * word surround it, so `{coins ?? "—"}` stays legal: a number nobody
 * could read is a dash in every style guide there is.
 */
const PROSE_EM_DASH = /[A-Za-z0-9,;:)"'’]\s+—\s+\S/g;

/** Copy lives in lib too: drills, coaching, the pause notes. */
const COPY_ROOTS = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) return [];
    return full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
  });
}

/** `copyOnly`, plus trailing `// …` comments on a line of code. */
function proseOnly(source: string): string {
  return copyOnly(source).replace(/\s+\/\/(?![^\n]*["'`]).*$/gm, "");
}

describe("copy rules", () => {
  const files = COPY_ROOTS.flatMap(sourceFiles);

  it("has files to check (so a bad glob can't pass silently)", () => {
    expect(files.length).toBeGreaterThan(60);
  });

  for (const file of files) {
    it(`keeps em dashes out of ${file}`, () => {
      const found = proseOnly(readFileSync(file, "utf8")).match(PROSE_EM_DASH);
      expect(found ?? []).toEqual([]);
    });
  }

  it("says the mantra once per screen or not at all", () => {
    for (const file of files) {
      const hits = copyOnly(readFileSync(file, "utf8")).match(/never money/gi);
      expect(hits?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("tells the coach the same thing", () => {
    const prompt = readFileSync("lib/coach.ts", "utf8");
    expect(prompt).toMatch(/NEVER use an em dash/);
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
