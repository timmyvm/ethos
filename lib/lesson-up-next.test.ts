import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/lessons";
import { traitForSaid, upNextLesson } from "@/lib/lesson-up-next";

const byId = (id: string) => LESSONS.find((l) => l.id === id)!;

describe("the lesson that gets the Lessons page's one tap", () => {
  it("is the very first lesson for somebody who has done nothing and named nothing", () => {
    expect(upNextLesson({}, null)?.id).toBe(LESSONS[0].id);
  });

  it("is the first lesson of the trait they named in the introduction", () => {
    const next = upNextLesson({}, "fillers");
    expect(next?.trait).toBe("fillers");
    expect(next?.id).toBe(LESSONS.find((l) => l.trait === "fillers")!.id);
  });

  it("is a lesson already started, over a fresh one in their own trait", () => {
    expect(upNextLesson({ "room-to-land": 1 }, "fillers")?.id).toBe("room-to-land");
  });

  it("prefers a started lesson in their own trait over one started elsewhere", () => {
    expect(
      upNextLesson({ "room-to-land": 1, "closed-mouth": 2 }, "fillers")?.id
    ).toBe("closed-mouth");
  });

  it("skips a finished lesson", () => {
    const first = LESSONS[0];
    const next = upNextLesson({ [first.id]: first.practices.length }, null);
    expect(next?.id).toBe(LESSONS[1].id);
  });

  it("is nothing once all fifteen are done, so the page shows no tap", () => {
    const all = Object.fromEntries(LESSONS.map((l) => [l.id, l.practices.length]));
    expect(upNextLesson(all, "pace")).toBeNull();
  });

  it("reads a trait from the pain's metric, and leaves the structure pains unmarked", () => {
    expect(traitForSaid("fillers")).toBe("fillers");
    expect(traitForSaid("rushing")).toBe("pace");
    expect(traitForSaid("freezing")).toBe("pause");
    expect(traitForSaid("sounding flat")).toBe("range");
    expect(traitForSaid("rambling")).toBeNull();
    expect(traitForSaid(null)).toBeNull();
    expect(byId("the-cold-open").trait).toBe("fillers");
  });
});

/*
 * Every lesson is free (#269), and a first-time user still read the old
 * gallery as a paid course store. Nothing on the two lesson screens may
 * wear the paid colour or the Premium mark, and each screen keeps one
 * terracotta tap.
 */
describe("the lesson screens never look paid", () => {
  const root = path.resolve(__dirname, "..");
  const files = [
    "app/lessons/page.tsx",
    "app/lessons/[id]/page.tsx",
    "components/lessons/LessonCard.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(path.join(root, f), "utf8");
    it(`${f} wears no plum and no Premium mark`, () => {
      expect(src).not.toMatch(/\bplum-/);
      expect(src).not.toMatch(/PremiumMark|IconPremium/);
    });
  }

  it("the list and the lesson each render the one tap exactly once", () => {
    const card = readFileSync(path.join(root, "components/lessons/LessonCard.tsx"), "utf8");
    const list = readFileSync(path.join(root, "app/lessons/page.tsx"), "utf8");
    const lesson = readFileSync(path.join(root, "app/lessons/[id]/page.tsx"), "utf8");
    /* The list's tap lives in UpNextCard, rendered once; rows never carry one. */
    expect(card.match(/ACTION_CLASS\}/g)?.length ?? 0).toBe(1);
    expect(list.match(/<UpNextCard/g)?.length).toBe(1);
    expect(list).not.toMatch(/ACTION_CLASS|bg-terracotta-500/);
    expect(lesson.match(/className=\{ACTION_CLASS\}/g)?.length).toBe(1);
  });
});

/*
 * The Lessons page's subtitle, "Fifteen lessons, all free. Three
 * practices each.", spells both counts out in words (app/lessons/page.tsx).
 * Nothing builds it from the content, so this is what notices the day a
 * lesson is added or a fourth practice lands: change the words with it.
 */
describe("the lessons the page used to count", () => {
  it("are fifteen, three practices each", () => {
    expect(LESSONS).toHaveLength(15);
    for (const l of LESSONS) expect(l.practices, l.id).toHaveLength(3);
  });
});

/*
 * The trait tones (globals.css, "lessons (trait tones)"), read out of the
 * stylesheet and held to AA. The numbered square the button starts is
 * 13px bold on the solid tone, which is body text to WCAG, so 4.5:1:
 * white on it in light (the ochre takes the dark ink), the dark ink on it
 * in dark. The first cut had white on three of the light inks at 4.1 to
 * 4.4.
 */
describe("the lesson tones clear AA", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const block = css.slice(
    css.indexOf("lessons (trait tones) ====="),
    css.indexOf("end of lessons (trait tones)")
  );
  const tones = (dark: boolean) => {
    const out: Record<string, Record<string, string>> = {};
    const re = dark
      ? /:root\[data-theme="dark"\] \[data-trait="(\w+)"\] \{([^}]*)\}/g
      : /(?:^|\n)\[data-trait="(\w+)"\] \{([^}]*)\}/g;
    for (const [, trait, body] of block.matchAll(re)) {
      out[trait] = Object.fromEntries(
        [...body.matchAll(/--(tone(?:-wash|-ink)?):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
      );
    }
    return out;
  };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const light = tones(false);
  const dark = tones(true);

  it("has all five traits in both themes", () => {
    const traits = ["pause", "fillers", "repairs", "pace", "range"];
    expect(Object.keys(light).sort()).toEqual([...traits].sort());
    expect(Object.keys(dark).sort()).toEqual([...traits].sort());
  });

  for (const [trait, t] of Object.entries(light)) {
    const on = trait === "repairs" ? "#16140f" : "#ffffff";
    it(`${trait}, light: the numeral on the solid, and the ink on the wash`, () => {
      expect(ratio(on, t.tone)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["tone-ink"], t["tone-wash"])).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const [trait, t] of Object.entries(dark)) {
    it(`${trait}, dark: the numeral on the solid, and the ink on the wash`, () => {
      expect(ratio("#16140f", t.tone)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["tone-ink"], t["tone-wash"])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
