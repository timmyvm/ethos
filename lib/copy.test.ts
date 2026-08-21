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

/**
 * DECISIONS #164 — "rep" left the interface. Timothy's call: the word
 * was gym-brand shorthand the user had to be taught, and the teaching
 * text went with it (#163). Lessons, recordings and plain time do the
 * naming now; the identifiers (repHref, RepRow) keep the word because
 * nobody reads them aloud.
 *
 * Scans prose only: string literals and JSX text that contain a space,
 * skipping path-like strings ("/rep?lesson=f1" is a URL, not copy).
 */
describe("retired vocabulary", () => {
  const files = COPY_ROOTS.flatMap(sourceFiles);

  function proseStrings(source: string): string[] {
    const src = copyOnly(source);
    const out: string[] = [];
    const literal = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    // JSX text runs are bounded by tags OR interpolation braces, so
    // "{reps.length} reps." can't hide its tail behind the expression.
    const jsxText = /[>}]\s*([^<>{}]+?)\s*[<{]/g;
    for (const re of [literal, jsxText]) {
      let m;
      while ((m = re.exec(src))) {
        // Interpolations read as one word of prose ("${n} reps" is
        // prose); code fragments the JSX regex catches are rejected by
        // their punctuation. A copy string carrying `=` or parens slips
        // this net, which is the accepted cost of no false alarms.
        const s = (m[2] ?? m[1]).trim().replace(/\$\{[^}]*\}/g, "N");
        if (!s.includes(" ") || /[(){};=[\]<]|&&|\?\./.test(s)) continue;
        if (!s.includes("/")) out.push(s);
      }
    }
    return out;
  }

  for (const file of files) {
    it(`keeps "rep" out of ${file}`, () => {
      const hits = proseStrings(readFileSync(file, "utf8")).filter((s) =>
        /\breps?\b/i.test(s)
      );
      expect(hits).toEqual([]);
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
    // #164 reworded #85's claim; the honesty it guards is unchanged.
    expect(marketing).toMatch(
      /daily, streak-driven, gamified practice with video/
    );
  });
});
