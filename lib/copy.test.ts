import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRILLS } from "./drills";
import { WELCOME_STEPS } from "./onboarding";
import { UNITS } from "./path";

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

  /**
   * #86 gave onboarding "Earn the room."; #209 took it back out.
   * Timothy's own voice guide is the reason: the line names no action
   * and no number, so it can't be cashed out ("what does earn the room
   * even mean?"), and the screen it sat on now opens on an
   * acknowledgement instead. The clarity line above is unaffected and
   * still holds the acquisition surfaces.
   *
   * What replaces the assertion is the thing worth protecting: the
   * approved opening, verbatim from docs/voice.md.
   */
  it("opens onboarding on the approved line", () => {
    expect(WELCOME_STEPS[0].title).toBe("Hey. I know why you're here.");
    const welcome = readFileSync("app/welcome/page.tsx", "utf8");
    expect(welcome).not.toContain("Earn the room.");
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

/**
 * The screen template (DECISIONS #209, docs/voice.md Part 2).
 *
 * Two rules, both of them structural, because the failure mode they
 * guard against is not malice: it is the next session deciding a screen
 * "needs a bit more context" and adding one helpful sentence. One
 * sentence is how the last version of these screens got to three
 * paragraphs, and by then nobody was reading any of them.
 */
describe("the screen template", () => {
  const WORDS = 15;
  const count = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  /**
   * The prose block budget. Scoped to the copy this pass approved —
   * onboarding, the unit intros and the baseline — because those are
   * the strings voice.md governs. The rest of the drill library has
   * three strings at 16 words, listed in the handoff report rather
   * than rewritten here: rewriting copy is exactly what this pass was
   * told not to do.
   */
  it("keeps every approved string inside the word budget", () => {
    const over: string[] = [];

    for (const step of WELCOME_STEPS) {
      for (const s of [step.title, step.line]) {
        if (count(s) > WORDS) over.push(s);
      }
    }

    for (const unit of UNITS) {
      if (!unit.intro) continue;
      for (const s of [unit.intro.title, unit.intro.line, ...unit.intro.howTo]) {
        if (count(s) > WORDS) over.push(s);
      }
    }

    const baseline = DRILLS.find((d) => d.id === "f1")!;
    for (const s of [baseline.prompt, ...baseline.tips]) {
      if (count(s) > WORDS) over.push(s);
    }

    expect(over).toEqual([]);
  });

  /**
   * 2 to 3 tactics. A fourth bullet is a paragraph with dots on it, and
   * fewer than two is not a list. Since #212 the tactics are the hero of
   * a lesson screen, so a lesson that quietly drops to one line loses
   * the block the screen is built around.
   */
  it("keeps the how-to lists to three tactics", () => {
    for (const unit of UNITS) {
      if (!unit.intro) continue;
      expect(unit.intro.howTo.length).toBeLessThanOrEqual(3);
      expect(unit.intro.howTo.length).toBeGreaterThanOrEqual(2);
    }
    for (const drill of DRILLS) {
      expect(drill.tips.length).toBeLessThanOrEqual(3);
      expect(drill.tips.length).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * The hero is decided by `lead`, and the two lesson screens have to
   * pass it: without it the lesson NAME wins the screen on size while
   * the only actionable text sits under it in grey, which is the exact
   * thing #212 fixed.
   */
  it("gives the lesson screens their tactics as the hero", () => {
    for (const file of ["app/rep/page.tsx", "app/lesson/[unit]/page.tsx"]) {
      expect(readFileSync(file, "utf8")).toMatch(/lead="howTo"/);
    }
  });

  /**
   * #213 — the log's day-zero screen never shows the sleeping mascot.
   * A sad Demos on the one screen that says "you have not started" is
   * the shame state brand.md bans, and it was the art on it.
   */
  it("keeps the sad mascot off the empty log", () => {
    expect(readFileSync("app/history/page.tsx", "utf8")).not.toContain(
      "demos-asleep"
    );
  });

  /**
   * The component must stay incapable of rendering a paragraph. A
   * `children` or `description` prop is the whole distance between this
   * template and the screens it replaced, so the ban is asserted rather
   * than remembered. Prose has one home, the `why` disclosure, and it
   * opens closed.
   */
  it("gives LessonScreen no way to render prose", () => {
    const source = readFileSync("components/LessonScreen.tsx", "utf8");
    // The public surface only. `WhyThisWorks` below it takes children
    // on purpose: it IS the one place prose is allowed to live, and it
    // is not exported.
    const api = source
      .slice(0, source.indexOf("function WhyThisWorks"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(api).not.toMatch(/\bchildren\b/);
    expect(api).not.toMatch(/\bdescription\b/);
    // The disclosure starts closed on every mount, and is never read
    // back from storage.
    expect(source).toMatch(/useState\(false\)/);
    expect(source).not.toMatch(/localStorage/);
  });
});
