import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The cohesion pass (26 Oct; docs/refs/feedback/2026-10-25-dark-tabs.md).
 * A first-time tester said of the five tabs "none of the pages match
 * really": each had its own colour world. Practice's sky stage became
 * the house grammar, and this holds it:
 *
 *  1. Every tab but Today opens on the one stage material, `HeroStage`,
 *     which is the sky at the sheet radius and the screen's one
 *     `elev-2`. Today left it in the home round (#393, Timothy's pick of
 *     direction B, "the object"): its card is the practice in its
 *     trait's colour family with the lesson's glass object, held below.
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
    expect(stage).toContain("hero-words");
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    // The words keep to the left 60%, and clear of a figure's square.
    expect(css).toMatch(/\.hero-words \{\s*max-width: 60%;/);
    expect(css).toMatch(/\.hero-stage\[data-figure\] \.hero-words \{\s*max-width: min\(60%, calc\(100% \+ 10px - var\(--art\) \* var\(--art-k\)\)\);/);
  });

  it("no hero keeps its old colour world", () => {
    expect(src("components/ScoreCard.tsx")).not.toMatch(/card-score|sage-mist|sage-lit|text-cream/);
    expect(src("components/home/HomeHero.tsx")).not.toMatch(/topic-card|rec-amber|<HeroStage\b|practice-stage/);
    expect(src("app/you/page.tsx")).not.toMatch(/kind: "coin"/);
  });

  it("a trait's own tone never paints the stage (data-trait goes on the chip)", () => {
    expect(src("components/lessons/LessonCard.tsx")).not.toMatch(/<HeroStage[^>]*data-trait/);
  });
});

/*
 * Today's card (#393). The one place a trait's colour is a ground, and
 * only in its own family (`.home-hero[data-family]`), never the lessons
 * tones' washes: the card is today's practice, so it is the practice's
 * trait, and nothing under it wears a fill.
 */
describe("Today opens on the object", () => {
  const hero = src("components/home/HomeHero.tsx");
  const page = src("app/page.tsx");
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const home = css.slice(css.indexOf("/* the home (#393) */"), css.indexOf("end of the home (#393)"));

  it("the page draws the card once, with no Demos anywhere on it", () => {
    expect(page.match(/<HomeHero\b/g)?.length).toBe(1);
    for (const file of [page, hero, src("components/home/HomeTiles.tsx"), src("components/home/WeekTiles.tsx")]) {
      expect(file).not.toMatch(/DemosArt|DemosClip|demos-/);
    }
  });

  it("the card stands the lesson's object at the large cut, and holds the one Start", () => {
    expect(hero).toContain("<HeroObject key={object} id={object} />");
    expect(hero).toMatch(/src=\{objectSrc\(id, true\)\}/);
    expect(hero.match(/className="home-start press"/g)?.length).toBe(1);
    expect(hero).toMatch(/>\s*Start\s*</);
    expect(hero).toContain('aria-label="Spin a new topic"');
  });

  it("the card's colour is its family, set by data-family and never by a tone wash", () => {
    expect(hero).toMatch(/data-family=\{loading \? "none" : family\}/);
    expect(hero).not.toMatch(/\btone-wash\b|\btone-fill\b|data-trait=\{family/);
    for (const f of ["pause", "fillers", "repairs", "pace", "range"]) {
      expect(home).toContain(`.home-hero[data-family="${f}"] {`);
      expect(home).toContain(`:root[data-theme="dark"] .home-hero[data-family="${f}"] {`);
    }
  });

  it("the card is the one lifted thing: no elev-2 under it", () => {
    for (const file of ["app/page.tsx", "components/home/HomeTiles.tsx", "components/home/WeekTiles.tsx"]) {
      expect(src(file)).not.toMatch(/\belev-2\b/);
    }
    const tile = home.match(/\n\.home-tile \{([^}]*)\}/)?.[1] ?? "";
    expect(tile).toContain("background: var(--color-surface);");
    expect(tile).not.toContain("box-shadow");
    // In dark the tile takes a hairline inside its edge, never a lift.
    const dark = home.match(/:root\[data-theme="dark"\] \.home-tile \{([^}]*)\}/)?.[1] ?? "";
    expect(dark).toMatch(/box-shadow: inset 0 0 0 1px/);
  });
});

describe("under the hero, colour is an accent", () => {
  const tabs = [
    "app/page.tsx",
    "components/home/HomeHero.tsx",
    "components/home/HomeTiles.tsx",
    "components/home/WeekTiles.tsx",
    "components/home/AvatarCoin.tsx",
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

  /*
   * The fix round: the renders are keyed off their gradients
   * (scripts/key-lesson-art.py), so a row shows the glass object on the
   * one neutral tile every lesson shares and no square of tone; the
   * stage's picture is the object standing in the studio light; and
   * progress has one rule, sage on sand for what you earned.
   */
  it("Lessons' rows are quiet: the object on one neutral tile, earned bars in sage", () => {
    const card = src("components/lessons/LessonCard.tsx");
    expect(card).toContain("<LessonArt lesson={lesson} size={44} eager={eager} />");
    expect(card).toContain("lesson-tile");
    expect(card).not.toMatch(/tone="neutral"|lesson-art-quiet|stage-art/);
    expect(card).toContain("<LessonArt lesson={lesson} size={132} eager stage />");
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    expect(css).toMatch(/\.lesson-tile \{\s*background: var\(--color-surface\);/);
  });

  it("the lesson pictures are cut out: every one carries transparency", () => {
    for (const name of readdirSync(path.join(root, "public/lessons"))) {
      if (!name.endsWith(".webp")) continue;
      const head = readFileSync(path.join(root, "public/lessons", name)).subarray(0, 64);
      // RIFF....WEBPVP8X with the alpha flag (bit 4 of the flags byte).
      expect(head.toString("ascii", 12, 16), name).toBe("VP8X");
      expect(head[20] & 0x10, name).toBe(0x10);
    }
  });
});
