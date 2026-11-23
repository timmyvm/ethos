import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSONS, lessonById } from "@/content/lessons";
import { PATH } from "@/content/path";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import type { Challenge } from "./challenge";
import type { RepRow } from "./client-data";
import {
  HOUSE_OBJECT,
  LINE_NAME,
  LINE_WORDS,
  RUN_NAME,
  TACTIC_OBJECT,
  artBox,
  TRAIT_OBJECT,
  TRAIT_OBJECTS,
  dayTurned,
  greetingName,
  heroObject,
  initialOf,
  fmtLine,
  lineFigure,
  objectSrc,
  runFigure,
} from "./home";
import { ART_BOUNDS } from "./lesson-art-bounds";

/*
 * Today, "the object" (#393). The card stands the glass object of the
 * tactic it leads with, every trait and every lesson has one, and every
 * number the foot prints (#500) is one of the person's own or a dash,
 * never a zero for something unknown.
 */
const root = path.resolve(__dirname, "..");

describe("every practice has its object", () => {
  it("each trait's three tactics map to a lesson of its own trait, by what the lesson teaches", () => {
    for (const t of TRAITS) {
      const ids = TACTIC_OBJECT[t.id];
      expect(ids).toHaveLength(t.howTo.length);
      for (const id of ids) expect(lessonById(id)?.trait, id).toBe(t.id);
    }
    // Where a tactic names its lesson, the lesson's object stands beside it.
    expect(TACTIC_OBJECT.pause).toEqual(["inside-or-after", "the-long-one", "the-landing"]);
    expect(TACTIC_OBJECT.repairs).toEqual(["finish-it", "or-rather", "know-the-landing"]);
    expect(TACTIC_OBJECT.range[0]).toBe("name-it-once");
    expect(TACTIC_OBJECT.range[2]).toBe("short-and-concrete");
    // "Stay quiet instead of saying um" (once "Let the gap sit", #483) is
    // a shut mouth holding a silence: the zip, not the overused-word
    // magnifier it once took by its place in the list.
    expect(TRAIT.fillers.howTo[2]).toMatch(/Stay quiet instead of saying "um"/);
    expect(TACTIC_OBJECT.fillers[2]).toBe("closed-mouth");
    expect(TACTIC_OBJECT.fillers).not.toContain("the-crutch");
  });

  it("each trait's own object is one of its lessons, and Pausing's is the hourglass", () => {
    for (const t of TRAITS) {
      expect(lessonById(TRAIT_OBJECT[t.id])?.trait).toBe(t.id);
      // The tile's order is the trait's three lessons, every one of them.
      expect([...TRAIT_OBJECTS[t.id]].sort()).toEqual(
        LESSONS.filter((l) => l.trait === t.id).map((l) => l.id).sort()
      );
    }
    expect(TRAIT_OBJECT.pause).toBe("the-long-one");
    expect(HOUSE_OBJECT).toBe("the-long-one");
  });

  it("every practice on the path resolves to an object of its own trait, its file on disk", () => {
    for (const p of PATH) {
      const id = heroObject(p.trait, p.tips[0]);
      expect(lessonById(id)?.trait, p.id).toBe(p.trait);
      expect(existsSync(path.join(root, "public", objectSrc(id))), id).toBe(true);
    }
  });

  it("the tactic picks the object; an unknown tip falls back to the trait's; no trait is the house's", () => {
    expect(heroObject("pause", TRAIT.pause.howTo[1])).toBe("the-long-one");
    expect(heroObject("pause", TRAIT.pause.howTo[0])).toBe("inside-or-after");
    expect(heroObject("fillers", TRAIT.fillers.howTo[0])).toBe("closed-mouth");
    expect(heroObject("pace", "Say which side you're on in your first sentence.")).toBe(TRAIT_OBJECT.pace);
    expect(heroObject(null)).toBe(HOUSE_OBJECT);
  });

  /* #478, #500: under the card only the games' two marks stand, and
     they are the stat icons' drawings (components/StatIcon.tsx), never a
     lesson's object. The card keeps its own. */
  it("only the card stands a lesson's object: the games' rows wear their stat marks, the foot none", () => {
    const rows = readFileSync(path.join(root, "components", "home", "ModeRows.tsx"), "utf8");
    expect(rows).not.toMatch(/objectSrc|artBox|\/lessons\//);
    expect(rows).toContain("<StatIcon kind={t.id} size={72} />");
    const foot = readFileSync(path.join(root, "components", "home", "TodayFoot.tsx"), "utf8");
    expect(foot).not.toMatch(/<img|StatIcon|objectSrc/);
    for (const gone of ["HomeTiles", "WeekTiles", "ModeTiles"]) {
      expect(existsSync(path.join(root, "components", "home", `${gone}.tsx`)), gone).toBe(false);
    }
    expect(existsSync(path.join(root, "components", "TraitGlyph.tsx"))).toBe(false);
  });

  it("each object is a vector on its own square: the file is an SVG with the 96u viewBox", () => {
    for (const l of LESSONS) {
      const svg = readFileSync(path.join(root, "public", objectSrc(l.id)), "utf8");
      expect(svg, l.id).toMatch(/^<svg [^>]*viewBox="0 0 96 96"/);
    }
  });
});

/*
 * The object's placement: every object stands inside its disc in the
 * card's object zone (`.home-hero` and `.home-hero-art` in
 * app/globals.css, #516), sized by its reach (lib/lesson-art-bounds.ts).
 * The zone's edges are read from the CSS and evaluated at each width,
 * on a day not yet spoken (`[data-spin="link"]`) and a day spoken: the
 * disc is the card's hero (168 at 390, where the flat object at 140 read
 * small beside the 3D one's 180), stands 16px inside the card's right
 * edge, ends above the topic, and its round edge keeps 6px clear of
 * every word beside it: the greeting's line over the card, the lead and
 * what the take costs, and on a day spoken the trait's chip and the
 * tactic. Each is a box and the disc a circle, so the disc may pass a
 * box's corner closer than its own square would.
 */
describe("every object stands inside its disc in the card's zone", () => {
  const css = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const home = css.slice(css.indexOf("/* the home (#393) */"), css.indexOf("end of the home (#393)"));
  const heroSrc = readFileSync(path.join(root, "components", "home", "HomeHero.tsx"), "utf8");
  /** The rule that starts at `head`, from `from` on. */
  const ruleAt = (head: string, from = 0) => {
    const at = home.indexOf(head, from);
    if (at < 0) throw new Error(`no ${head.trim()}`);
    return home.slice(at, home.indexOf("}", at));
  };
  /** Every custom property a rule sets. */
  const props = (rule: string) =>
    Object.fromEntries([...rule.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])) as Record<string, string>;
  const hero = props(ruleAt("\n.home-hero {"));
  /* A day not yet spoken, from 360 up: its zone's foot 40px higher. */
  const openWide = props(ruleAt('.home-hero[data-spin="link"] {', home.indexOf('@media (min-width: 360px) {\n  .home-hero[data-spin="link"] {')));
  /* Under 360 (D22) the words take 56% and the zone its own top and foot. */
  const narrowAt = home.indexOf("@media (max-width: 359px) {\n  .home-hero {");
  const narrow = home.slice(narrowAt, home.indexOf("\n}\n", narrowAt));
  const narrowHero = props(ruleAt(".home-hero {", narrowAt));
  const narrowOpen = props(ruleAt('.home-hero[data-spin="link"] {', narrowAt));
  /* A short phone (320x568, the final pass of 19 Nov): the object 100px tall, the topic a step down. */
  const shortAt = home.indexOf("@media (max-width: 359px) and (max-height: 640px) {");
  const short = home.slice(shortAt, home.indexOf("\n}\n", shortAt));
  const shortHero = props(ruleAt(".home-hero {", shortAt));
  const clamp = (lo: number, v: number, hi: number) => Math.min(Math.max(lo, v), hi);
  /* calc(), clamp(), min(), max(), px, cqw and % (of `pct`), each var() read from the same scope. */
  const evaluate = (expr: string, scope: Record<string, string>, content: number, pct = 0, seen: string[] = []): number => {
    const js = expr
      .replace(/var\(--([\w-]+)\)/g, (_, n: string) => {
        if (seen.includes(n) || scope[n] === undefined) throw new Error(`--${n} unset or circular in ${expr}`);
        return `(${evaluate(scope[n], scope, content, pct, [...seen, n])})`;
      })
      .replace(/calc\(/g, "(")
      .replace(/([\d.]+)cqw/g, (_, n) => `(${n}*${content}/100)`)
      .replace(/([\d.]+)%/g, (_, n) => `(${n}*${pct}/100)`)
      .replace(/([\d.]+)px/g, "$1");
    return Function("clamp", "max", "min", `return ${js};`)(clamp, Math.max, Math.min) as number;
  };
  /* The disc the object stands inside (`.home-hero-art`, #516): the zone's width, or its height where that is less, its right edge on the zone's right and its top on the zone's top. */
  const discRule = ruleAt("\n.home-hero-art {\n  --disc:");
  const DISC_IS_ZONE =
    discRule.includes("--disc: min(calc(var(--zone-r) - var(--zone-l)), calc(var(--zone-b) - var(--zone-t)));") &&
    discRule.includes("top: var(--zone-t);") &&
    discRule.includes("left: calc(var(--zone-r) - var(--disc));");
  /* The object inside it: its square sized so its reach is FILL of the disc's width (0.44, so 0.88 of its radius). */
  const sharedAt = home.indexOf("\n.home-hero-art,\n.object-disc {");
  const shared = home.slice(sharedAt, home.indexOf("\n}", sharedAt));
  const FILL = Number(shared.match(/calc\(var\(--disc\) \* ([\d.]+) \/ var\(--art-reach, 0\.55\)\)/)?.[1]);
  /* ...and its visible box's centre moved onto the disc's, where a drawing sits off its square's centre. */
  const CENTRED =
    shared.includes("calc(50% + (0.5 - var(--art-l, 0.5) - var(--art-w, 0) / 2) * var(--disc-obj))") &&
    shared.includes("calc(50% + (0.5 - var(--art-t, 0.5) - var(--art-h, 0) / 2) * var(--disc-obj))");
  const wordsMin = home.match(/\.home-hero-words \{[^}]*min-height: calc\(var\(--zone-b\) - (\d+)px\)/);
  const wordsWide = Number(home.match(/\n\.home-hero-words \{\s*max-width: (\d+)%;/)?.[1]) / 100;
  const wordsNarrow = Number(narrow.match(/\.home-hero-words \{\s*max-width: (\d+)%;/)?.[1]) / 100;
  /* The greeting over the card: from 360 up it stops where the disc's arc crosses its line (`.home .large-title`), under 360 it has the row. */
  const greetWide = css.match(/@media \(min-width: 360px\) \{\s*\.home \.large-title \{\s*max-width: ([^;]+);/)?.[1] ?? null;
  const greetGuard = css.slice(css.indexOf("\n.home .large-title {"), css.indexOf("}", css.indexOf("\n.home .large-title {")));
  /* Its line: 40px (`.large-title`, 2.5rem) standing 24px over the card (HomeHero's section, mt-6). */
  const TITLE_LINE = /\n\.large-title \{[^}]*line-height: 2\.5rem;/.test(css) ? 40 : NaN;
  const TITLE_GAP = /<section aria-labelledby=\{[^}]+\} className="mt-6">/.test(heroSrc) ? 24 : NaN;
  /*
   * The words beside the disc, in the card's box, measured in the face at
   * 390 (lib/home.test.ts has no fonts; scripts/look-icons-flat-a.mjs
   * shoots them): the lead (18) and what the take costs under it (18,
   * 2px further down), or day one's "Your first recording", 113px at
   * most; on a day spoken the trait's chip 8 under the lead, 22 tall,
   * "Sentence restarts" the longest at 138, and the tactic's two lines
   * 8 under that, as wide as the words' column.
   */
  const PAD = 20;
  const LEAD = { l: PAD, r: PAD + 114, t: PAD, b: PAD + 18 + 2 + 18 };
  const CHIP = { l: PAD, r: PAD + 138, t: PAD + 18 + 8, b: PAD + 18 + 8 + 22 };
  const TACTIC_TOP = CHIP.b + 8;
  /** How far a circle stands from a box: negative where they overlap. */
  const air = (cx: number, cy: number, radius: number, box: { l: number; r: number; t: number; b: number }) =>
    Math.hypot(Math.max(box.l - cx, 0, cx - box.r), Math.max(box.t - cy, 0, cy - box.b)) - radius;

  it("reads a box for every lesson, and the card's zone from the CSS", () => {
    expect(Object.keys(ART_BOUNDS).sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const b of Object.values(ART_BOUNDS)) {
      expect(b.r).toBeGreaterThan(b.l);
      expect(b.b).toBeGreaterThan(b.t);
    }
    expect(wordsMin).not.toBeNull();
    expect(DISC_IS_ZONE).toBe(true);
    expect(sharedAt).toBeGreaterThan(0);
    expect(FILL).toBeCloseTo(0.44, 6);
    expect(CENTRED).toBe(true);
    for (const n of ["art-d", "zone-l", "zone-r", "zone-t", "zone-b"]) expect(hero[n], n).toBeDefined();
    expect(openWide["zone-b"]).toBe("clamp(100px, calc(31.4px + 28.57cqw), 120px)");
    expect(narrowAt).toBeGreaterThan(0);
    expect(narrowHero["zone-t"]).toBe("-22px");
    expect(narrowHero["zone-b"]).toBe("calc(var(--zone-t) + 120px)");
    expect(narrowOpen["art-d"]).toBe("120px");
    expect(wordsWide).toBe(0.48);
    expect(wordsNarrow).toBe(0.56);
    expect(greetWide).toBe("max(180px, calc(50% + 5px))");
    // A name too long even at the fit's floor ends in an ellipsis, never under the disc.
    expect(greetGuard).toMatch(/overflow: hidden;/);
    expect(greetGuard).toMatch(/white-space: nowrap;/);
    expect(greetGuard).toMatch(/text-overflow: ellipsis;/);
    expect(TITLE_LINE).toBe(40);
    expect(TITLE_GAP).toBe(24);
    expect(artBox("the-long-one")).toEqual({
      "--art-l": ART_BOUNDS["the-long-one"].l,
      "--art-t": ART_BOUNDS["the-long-one"].t,
      "--art-w": Math.round((ART_BOUNDS["the-long-one"].r - ART_BOUNDS["the-long-one"].l) * 10000) / 10000,
      "--art-h": Math.round((ART_BOUNDS["the-long-one"].b - ART_BOUNDS["the-long-one"].t) * 10000) / 10000,
      "--art-reach": ART_BOUNDS["the-long-one"].reach,
    });
  });

  it("the disc is painted behind the object, never cut round it, so no object loses a corner", () => {
    // A round <img> trims its picture to the circle inside its content box,
    // the object's square, and most objects reach past half of it (the
    // hourglass's caps lost their ends, the door its leaf).
    expect(Object.values(ART_BOUNDS).filter((b) => b.reach > 0.5).length).toBeGreaterThan(5);
    expect(shared).not.toMatch(/border-radius/);
    expect(shared).toMatch(/background: radial-gradient\(closest-side, var\(--home-disc\) calc\(100% - 0\.5px\), transparent 100%\);/);
    // Nor rounded where it is placed: Today's card, the recorder's topic card, Up next, the welcome's day one.
    for (const file of ["components/home/HomeHero.tsx", "components/rep/TopicCard.tsx", "components/lessons/LessonCard.tsx", "app/welcome/page.tsx"]) {
      const src = readFileSync(path.join(root, file), "utf8");
      const classes = [...src.matchAll(/className="([^"]*(?:object-disc|home-hero-art)[^"]*)"/g)].map((m) => m[1]);
      expect(classes.length, file).toBeGreaterThan(0);
      for (const c of classes) expect(c, file).not.toMatch(/\brounded/);
    }
  });

  it("on a short phone the object stands 100px tall and the topic takes the size a step down", () => {
    expect(shortAt).toBeGreaterThan(narrowAt);
    expect(shortHero["zone-b"]).toBe("calc(var(--zone-t) + 100px)");
    expect(short).toMatch(/\.home-display \{\s*font-size: 8\.8vw;/);
    expect(short).toMatch(/\.home-display\[data-long\] \{\s*font-size: 7\.4vw;/);
    // The roulette's reel in the same card, a step down too.
    expect(short).toMatch(/\.home-display\.home-reel \{\s*--reel-fs: min\(1\.75rem, 9\.4cqw\);/);
    // A day already spoken: under the trait and the tactic, the topic takes 16, not 24.
    expect(short).toMatch(/\.home-hero\[data-spin="glyph"\] \.home-hero-words:has\(\.tip-glyph\) ~ \.home-display \{\s*padding-top: 16px;/);
    // The sizes are the scale's own steps (34's and 28's at 320), never a new one.
    expect(home).toMatch(/\.home-display\[data-long\] \{\s*font-size: min\(2\.125rem, 8\.8vw\);/);
    expect(home).toMatch(/\.home-display\[data-longer\] \{\s*font-size: min\(1\.75rem, 7\.4vw\);/);
  });

  /* [width, short phone, a day spoken, the disc, how far it rises out of the card] */
  for (const [width, shortPhone, spoken, size, rise] of [
    [320, false, true, 98, 22],
    [320, false, false, 120, 22],
    [320, true, true, 98, 22],
    [320, true, false, 100, 22],
    [360, false, true, 138, 40],
    [360, false, false, 138, 40],
    [375, false, false, 153, 41.3],
    [390, false, true, 167.4, 51.4],
    [390, false, false, 167.4, 51.4],
    [393, false, false, 168.4, 52.4],
    [430, false, true, 181, 65],
    [440, false, false, 184, 68],
  ] as const) {
    it(`at ${width}${shortPhone ? " on a short phone" : ""}, a day ${spoken ? "spoken" : "not yet spoken"}: a ${size}px disc rising ${rise}px, 16px inside the card, clear of the greeting${spoken ? ", the chip, the tactic" : ""} and the lead, above the topic, all fifteen inside it`, () => {
      const content = width - 40 - 40; // the column's gutters, then the card's padding
      const card = content + 40;
      const small = width < 360;
      const scope = {
        ...hero,
        ...(small ? narrowHero : {}),
        ...(small && !spoken ? narrowOpen : {}),
        ...(!small && !spoken ? openWide : {}),
        ...(shortPhone ? shortHero : {}),
      };
      const [l, r, t, b] = ["zone-l", "zone-r", "zone-t", "zone-b"].map((n) => evaluate(scope[n], scope, content));
      /* The disc: the zone's width (its height where less), its right edge on the zone's right, its top on the zone's top. */
      const disc = Math.min(r - l, b - t);
      const radius = disc / 2;
      const cx = r - radius;
      const cy = t + radius;
      expect(disc, "the disc").toBeCloseTo(size, 1);
      expect(-t, "its rise out of the card").toBeCloseTo(rise, 1);
      /* 16px clear of the card's right edge, the topic card's inset, so the
         card's rounded corner stands clear beside the disc rather than
         showing past it as a sliver where the two curves nearly meet
         (#516 review: at 10 it did, in every family, both themes). */
      expect(card - (cx + radius), "the disc 16px inside the card's right edge").toBeCloseTo(16, 6);
      /* The greeting's line over the card. From 360 up its words stop at
         the title's width, so the disc rises beside them and its arc
         passes their line 6px off; under 360 the greeting has the row
         and the disc stands under its line. A name longer than the width
         steps down (app/page.tsx) and past 22px ends in an ellipsis. */
      const room = small ? card : evaluate(greetWide!, {}, content, card);
      const greeting = { l: 0, r: room, t: -TITLE_GAP - TITLE_LINE, b: -TITLE_GAP };
      if (small) expect(t, "the disc under the greeting's line").toBeGreaterThanOrEqual(greeting.b);
      else expect(air(cx, cy, radius, greeting), "the disc clear of the greeting").toBeGreaterThanOrEqual(6 - 1e-6);
      // "Hi, Timothy" is 177px at 34: it keeps its size beside the disc from 360 up.
      if (!small) expect(room, "the greeting's width").toBeGreaterThanOrEqual(178);
      expect(air(cx, cy, radius, LEAD), "the disc clear of the lead").toBeGreaterThanOrEqual(6 - 1e-6);
      if (spoken) {
        expect(air(cx, cy, radius, CHIP), "the disc clear of the trait's chip").toBeGreaterThanOrEqual(6 - 1e-6);
        const tactic = { l: PAD, r: PAD + (small ? wordsNarrow : wordsWide) * content, t: TACTIC_TOP, b: Infinity };
        expect(air(cx, cy, radius, tactic), "the disc clear of the tactic").toBeGreaterThanOrEqual(6 - 1e-6);
      }
      // The topic starts 24px under the words, which hold the zone's height.
      const topic = PAD + (b - Number(wordsMin![1])) + 24;
      expect(t + disc - 1e-6, "the disc above the topic").toBeLessThanOrEqual(topic - 6);
      /* A day already spoken on a short phone: the words hold at least the
         lead (18), the trait's chip (22) and one line of the tactic (18),
         8 apart, and the topic stands 16 under them. */
      if (shortPhone && spoken) expect(t + disc - 1e-6, "the disc above One more's topic").toBeLessThanOrEqual(PAD + (18 + 8 + 22 + 8 + 18) + 16 - 6);
      for (const id of LESSONS.map((x) => x.id)) {
        const box = artBox(id);
        /* Inside it, the object's square, sized by its reach, its visible
           box centred on the disc (CENTRED): every visible pixel within
           0.88 of the disc's radius, so each of the fifteen has the same
           air to the disc's edge, and the shift that centres it never
           cuts the drawing (it moves less than the square's margin). */
        const s = Math.min(disc, (disc * FILL) / box["--art-reach"]);
        expect(s * box["--art-reach"], `${id} inside its disc`).toBeLessThanOrEqual(radius * 0.88 + 1e-6);
        expect(s * box["--art-reach"], `${id} fills its disc`).toBeGreaterThanOrEqual(radius * 0.8);
        const dx = 0.5 - box["--art-l"] - box["--art-w"] / 2;
        const dy = 0.5 - box["--art-t"] - box["--art-h"] / 2;
        expect(box["--art-l"] + dx, `${id} left`).toBeGreaterThan(0);
        expect(1 - box["--art-l"] - box["--art-w"] - dx, `${id} right`).toBeGreaterThan(0);
        expect(box["--art-t"] + dy, `${id} top`).toBeGreaterThan(0);
        expect(1 - box["--art-t"] - box["--art-h"] - dy, `${id} bottom`).toBeGreaterThan(0);
      }
    });
  }
});

/*
 * Under the card (#500 review). The games' words hang from the row's
 * top: a one-line topic centred in the two lines a row holds stood the
 * name as far from its own topic as from the row above, and the boss's
 * topic is one line nearly every week. And the two expressions that
 * place things against the tab bar count the status bar's inset, since
 * the header starts under it: a bare 734 put the foot half under the
 * glass at 430x932 with a 59 inset, and a bare 160 put Another topic on
 * the bar's edge on an installed SE.
 */
describe("under the card: the rows hang from their top, and the bar's sums count the status bar", () => {
  const css = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const rule = (sel: string, from = 0) => {
    const at = css.indexOf(`${sel} {`, from);
    expect(at, sel).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("\n}", at));
  };
  it("each row's words, mark and chevron stand from its top, and the subject holds no lines of its own", () => {
    expect(rule("\n.home-mode")).toMatch(/align-items: flex-start;/);
    expect(rule("\n.home-mode")).toMatch(/min-height: 81px;/);
    const subject = rule("\n.home-mode-subject");
    expect(subject).not.toMatch(/min-height|align-items|display: flex/);
    expect(rule(".home-mode > svg:last-child")).toContain("margin-top: calc((var(--mark) - 14px) / 2);");
  });
  it("the foot's --rows-end and the card's short-screen height both take the top inset", () => {
    const ends = [...css.matchAll(/--rows-end: ([^;]+);/g)].map((m) => m[1]);
    expect(ends).toEqual(["calc(734px + env(safe-area-inset-top))", "calc(730px + env(safe-area-inset-top))"]);
    const hero = rule("\n.home-hero");
    const min = hero.slice(hero.indexOf("min-height: min("), hero.indexOf(");\n", hero.indexOf("min-height: min(")));
    expect(min).toContain("376px");
    expect(min).toMatch(/100svh - 160px - env\(safe-area-inset-top\) - var\(--nav-h\)/);
  });
});

/*
 * The foot (#500): the two numbers only Today holds, each a figure over
 * one plain line (#483's two seconds). Timothy could not read "Restarts";
 * "Clean run 46s" and a bare "Today's line 1.0" were the same kind of
 * label.
 */
describe("the foot's words are the traits' own units, split where the number stands", () => {
  it("noun and rate join to the unit Lessons and the results print", () => {
    for (const t of TRAITS) {
      const w = LINE_WORDS[t.id];
      expect(`${w.noun} ${w.rate}`, t.id).toBe(t.unit);
      expect(`${w.noun} ${w.rate}`).not.toMatch(/\/|wpm|per hundred|per minute/);
    }
  });
});

describe("today's line at the foot", () => {
  const line = (over: Partial<Challenge>): Challenge => ({
    trait: "pause",
    line: 1.8,
    direction: "higher",
    value: 0,
    closed: false,
    today: null,
    cleared: { n: 4, of: 5 },
    week: "2026-10-26",
    q: 0.3,
    ...over,
  });

  it("an open line is the number to beat over what to do, in words", () => {
    expect(lineFigure(line({}))).toEqual({
      state: "open",
      figure: "1.8",
      rate: "a minute",
      label: "Today's line: more pauses between sentences",
      said: "Today's line: over 1.8 pauses between sentences a minute.",
    });
    expect(lineFigure(line({ trait: "fillers", direction: "lower", line: 0.9 }))).toMatchObject({
      figure: "0.9",
      rate: "in 100 words",
      label: "Today's line: fewer um or uh",
    });
    expect(lineFigure(line({ trait: "repairs", direction: "lower", line: 1.2 })).label).toBe("Today's line: fewer sentence restarts");
    expect(lineFigure(line({ trait: "range", direction: "higher", line: 62 })).label).toBe(
      "Today's line: more different words"
    );
  });

  it("a day short of it reads the same; a cleared one shows the number that cleared it, and says so", () => {
    expect(lineFigure(line({ today: 0.9 }))).toMatchObject({ state: "open", figure: "1.8" });
    expect(lineFigure(line({ today: 2.6, closed: true, value: 1 }))).toEqual({
      state: "closed",
      figure: "2.6",
      rate: "a minute",
      label: "Today's line, cleared",
      said: "Today's line, cleared with 2.6 pauses between sentences a minute.",
    });
  });

  it("a line of 1.0 prints 1.0, at the line's precision, never 1", () => {
    expect(fmtLine(1)).toBe("1.0");
    expect(fmtLine(0.96)).toBe("1.0");
    expect(fmtLine(1.84)).toBe("1.8");
    expect(fmtLine(9.96)).toBe("10.0");
    expect(fmtLine(145.4)).toBe("145");
    expect(fmtLine(62)).toBe("62");
    expect(lineFigure(line({ line: 1 })).figure).toBe("1.0");
    expect(lineFigure(line({ line: 1, today: 1, closed: true })).figure).toBe("1.0");
  });

  /* Pace's line is a distance from its zone (progress-2, lib/challenge.ts):
     never "Over 104". The figure is the zone; the words name the line. */
  it("a pace line prints the zone and names the line, never over or under one number", () => {
    const pace = (over: Partial<Challenge>) =>
      line({ trait: "pace", direction: "band", line: 100, cleared: { n: 3, of: 4 }, ...over });
    expect(lineFigure(pace({}))).toMatchObject({
      figure: "130 to 160",
      rate: "words a minute",
      label: "Today's line: closer than 100",
    });
    expect(lineFigure(pace({ line: 145 })).label).toBe("Today's line: stay inside it");
    expect(lineFigure(pace({ today: 178, closed: true }))).toMatchObject({ state: "closed", figure: "178" });
    for (const today of [null, 178, 145, 190]) {
      const f = lineFigure(pace({ today, closed: today !== null }));
      expect(`${f.label} ${f.said}`).not.toMatch(/\b(over|under) \d/i);
      expect(`${f.label} ${f.said}`).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("under three readings it is a dash and what sets it, never a zero", () => {
    expect(lineFigure(null)).toEqual({
      state: "none",
      figure: null,
      rate: "",
      label: "Today's line: three recordings set it",
      said: "Today's line: three recordings set it.",
    });
  });

  it("every label is one line of words, no full stop, no em dash, and starts with the line's name", () => {
    const all = [
      lineFigure(null),
      lineFigure(line({})),
      lineFigure(line({ today: 2, closed: true })),
      lineFigure(line({ trait: "pace", direction: "band", line: 100 })),
    ];
    for (const f of all) {
      expect(f.label.startsWith(LINE_NAME)).toBe(true);
      expect(f.label).not.toMatch(/\.$|\u2014/);
      expect(f.said).toMatch(/\.$/);
    }
  });
});

describe("the longest stretch with no filler at the foot", () => {
  /** Enough words to score (`measured`). */
  const SAID =
    "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
  const rep = (fillers: number[], duration = 60, transcript = SAID): RepRow =>
    ({ fillers: fillers.map((t) => ({ word: "um", t })), duration_s: duration, transcript }) as RepRow;

  it("reads the newest scored recording's longest stretch in whole seconds, and says what it is", () => {
    expect(runFigure([rep([30])])).toEqual({
      state: "open",
      figure: "30",
      rate: "s",
      label: "Longest with no filler, in your last recording",
      said: "Longest with no filler, in your last recording: 30 seconds.",
    });
    expect(runFigure([rep([50]), rep([20], 65)])).toMatchObject({ figure: "45", label: "Longest with no filler, in your last recording" });
    expect(runFigure([rep([20]), rep([])])).toMatchObject({ figure: "60", label: "Longest with no filler, a new best" });
  });

  it("is named for what it is, apart from You's Clean run badge", () => {
    expect(RUN_NAME).toBe("Longest with no filler");
    expect(RUN_NAME).not.toMatch(/run/i);
  });

  /* A one-word 8s take read "Clean run 8s, of 8s". */
  it("skips a take too short to score, and is a dash until one scores", () => {
    const word = rep([], 8.3, "Hello.");
    expect(runFigure([rep([30]), word])).toMatchObject({ figure: "30" });
    expect(runFigure([word])).toMatchObject({ state: "none", figure: null, label: "Longest with no filler: your first recording sets it" });
    expect(runFigure([])).toMatchObject({ state: "none", figure: null });
  });
});

/*
 * Today left open across midnight kept yesterday's date, a lit streak
 * and "One more" (progress-5): a return on a new local day reads again.
 */
describe("the day turning over", () => {
  it("turns at local midnight, and never before the first read", () => {
    const night = new Date(2026, 10, 5, 23, 50);
    expect(dayTurned(night, new Date(2026, 10, 5, 23, 59))).toBe(false);
    expect(dayTurned(night, new Date(2026, 10, 6, 0, 10))).toBe(true);
    expect(dayTurned(new Date(2026, 10, 6, 0, 1), new Date(2026, 10, 6, 8, 20))).toBe(false);
    expect(dayTurned(null, new Date(2026, 10, 6, 0, 10))).toBe(false);
  });
});

describe("the greeting", () => {
  it("greets the first word of the name, and nobody without one", () => {
    expect(greetingName("Timothy")).toBe("Timothy");
    expect(greetingName("  Timothy Mota ")).toBe("Timothy");
    expect(greetingName("")).toBeNull();
    expect(greetingName("   ")).toBeNull();
    expect(greetingName(null)).toBeNull();
  });

  it("the coin takes the initial, or nothing for the neutral glyph", () => {
    expect(initialOf("timothy")).toBe("T");
    expect(initialOf("Émile")).toBe("É");
    expect(initialOf(null)).toBeNull();
  });
});
