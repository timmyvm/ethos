import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The cohesion pass (26 Oct; docs/refs/feedback/2026-10-25-dark-tabs.md).
 * A first-time tester said of the five tabs "none of the pages match
 * really": each had its own colour world. Practice's sky stage became
 * the house grammar, and this holds it:
 *
 *  1. Every tab opens on the one stage material, `HeroStage`, which is
 *     the sky at the sheet radius and the screen's one `elev-2`.
 *  2. Under the hero nothing has a coloured fill or wash: a trait's
 *     colour is a small accent (its 8px mark, a ring's arc, a short bar)
 *     and its name is in ink, so the files that draw the tabs reach for
 *     no `tone-wash` and no `tone-ink`.
 *  3. The old colour worlds are gone from the heroes: no deep sage score
 *     card, no amber floor card.
 */
const root = path.resolve(__dirname, "..");
/* Source without its comments, so a comment naming the old material
   does not count as using it. */
const src = (file: string) =>
  readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("every tab opens on the one stage", () => {
  const heroes: [string, string][] = [
    ["Today", "components/home/FloorCard.tsx"],
    ["Lessons", "components/lessons/LessonCard.tsx"],
    ["Practice", "app/games/page.tsx"],
    ["Log", "components/ScoreCard.tsx"],
    ["You", "app/you/page.tsx"],
  ];
  for (const [tab, file] of heroes) {
    it(`${tab} draws its hero with HeroStage`, () => {
      expect(src(file).match(/<HeroStage\b/g)?.length).toBe(1);
    });
  }

  it("the stage is Practice's sky, at the sheet radius, the screen's one lift", () => {
    const stage = src("components/ui/HeroStage.tsx");
    expect(stage).toMatch(/intro-stage tone-sky practice-stage hero-stage elev-2/);
    expect(stage).toContain("min-h-[160px]");
    expect(stage).toContain("p-5");
    expect(stage).toContain("max-w-[60%]");
  });

  it("no hero keeps its old colour world", () => {
    expect(src("components/ScoreCard.tsx")).not.toMatch(/card-score|sage-mist|sage-lit|text-cream/);
    expect(src("components/home/FloorCard.tsx")).not.toMatch(/topic-card|rec-amber/);
    expect(src("app/you/page.tsx")).not.toMatch(/kind: "coin"/);
  });

  it("a trait's own tone never paints the stage (data-trait goes on the chip)", () => {
    for (const file of ["components/lessons/LessonCard.tsx", "components/home/FloorCard.tsx"]) {
      expect(src(file)).not.toMatch(/<HeroStage[^>]*data-trait/);
    }
  });
});

describe("under the hero, colour is an accent", () => {
  const tabs = [
    "app/page.tsx",
    "components/home/ChallengeCard.tsx",
    "components/home/CleanRunCard.tsx",
    "components/home/TraitStrip.tsx",
    "app/lessons/page.tsx",
    "components/lessons/LessonCard.tsx",
    "app/history/page.tsx",
    "app/you/page.tsx",
  ];
  for (const file of tabs) {
    it(`${file} wears no trait wash and sets no name in a trait's ink`, () => {
      expect(src(file)).not.toMatch(/\btone-wash\b|\btone-ink\b|\btone-fill\b/);
    });
  }

  it("a trait's mark is 8px at most", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    const dot = css.match(/\.trait-dot \{([^}]*)\}/)?.[1] ?? "";
    expect(dot).toMatch(/width:\s*8px/);
    expect(dot).toMatch(/height:\s*8px/);
  });

  it("Lessons' rows are quiet: small, desaturated renders and neutral bars", () => {
    const card = src("components/lessons/LessonCard.tsx");
    expect(card).toContain("size={44} eager={eager} quiet");
    expect(card).toContain('tone="neutral"');
  });
});
