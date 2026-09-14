import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One tier, one colour, one mark (DECISIONS #280).
 *
 * Premium was marked nine ways: a lowercase grey word, a "Pro" pill, an
 * ellipsis, a terracotta wash with a terracotta button, three plain
 * terracotta text links, a stone text button, a SAGE quota counter, an
 * unmarked prose card, and nothing at all on the Hostile cap.
 *
 * Two of those borrowed a colour that already meant something.
 * Terracotta means tap. Sage means earned. A free allowance is
 * allotted, not earned, and a thing you pay for is the opposite of a
 * thing you earned. That is the distinction the whole product rests on
 * (#14: money buys cosmetics, never progress), so it gets a colour of
 * its own and these tests keep the other two out of it.
 */
const ROOTS = ["app", "components"];
const OWNER = "components/PremiumMark.tsx";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}
const FILES = ROOTS.flatMap(tsxFiles);
const noComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("premium wears plum", () => {
  it("has files to check (so a bad glob can't pass silently)", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  /**
   * The one that matters, scoped to a line rather than a window: an
   * element that wears plum may not also wear one of the two taken
   * accents. That is the regression the old code had three of, and it
   * leaves the paywall sheet's terracotta CTA and a chosen mod's sage
   * fill alone, because neither is a premium mark.
   */
  for (const file of FILES) {
    it(`never mixes plum with an accent that means something else in ${file}`, () => {
      const offences = noComments(readFileSync(file, "utf8"))
        .split("\n")
        .filter((line) => /\bplum-/.test(line) && /terracotta-|sage-/.test(line))
        /* One carve-out, and it is the rule rather than an exception to
           it: a control that is a TAP for a premium account and a DOOR
           for a free one is terracotta XOR plum, never both at once. A
           ternary between the two arms is that, spelled out. */
        .filter((line) => !/\?[^:]*:[^:]*$/.test(line.trim()))
        .map((l) => l.trim().slice(0, 120));
      expect(offences, offences.join("\n")).toEqual([]);
    });
  }

  /**
   * And the word itself never renders in one of them. A tier marked in
   * the tap colour is a tier that reads as a button.
   */
  it("never renders the tier's name in terracotta or sage", () => {
    const offences: string[] = [];
    for (const file of FILES) {
      if (file === OWNER) continue;
      for (const line of noComments(readFileSync(file, "utf8")).split("\n")) {
        if (!/>\s*Premium|Premium\s*</.test(line)) continue;
        if (/text-terracotta|!text-sage|text-sage/.test(line)) {
          offences.push(`${file}: ${line.trim().slice(0, 100)}`);
        }
      }
    }
    expect(offences, offences.join("\n")).toEqual([]);
  });

  it("has one name for the tier", () => {
    for (const file of FILES) {
      const source = noComments(readFileSync(file, "utf8"));
      expect(source, `${file} still says "Ethos Premium"`).not.toContain(
        "Ethos Premium"
      );
      expect(
        />\s*Pro\s*</.test(source),
        `${file} still renders "Pro" as the tier`
      ).toBe(false);
    }
  });

  /**
   * Plum labels. It never fills a control, because that is what
   * terracotta is for, and a plum button would be a second tap colour.
   */
  it("never uses plum as a fill", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf8");
      for (const step of ["400", "500", "600", "700", "800"]) {
        expect(
          source.includes(`bg-plum-${step}`),
          `${file} fills with plum-${step}`
        ).toBe(false);
      }
    }
  });

  it("keeps the mark itself colour-pure", () => {
    /* Comments out: the file has to be able to explain, next to the
       code, which colours it is keeping away from. */
    const source = noComments(readFileSync(OWNER, "utf8"));
    expect(source).not.toMatch(/terracotta|sage|#[0-9a-fA-F]{6}/);
  });

  /**
   * #265: Tailwind v4 drops any @theme variable no utility references,
   * which shipped a stroke of `none` to production once already. Every
   * plum step a component asks for has to be declared.
   */
  it("declares every plum step something uses", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const used = new Set<string>();
    for (const file of FILES) {
      for (const m of readFileSync(file, "utf8").matchAll(
        /(?:text|bg|border)-plum-(\d{2,3})/g
      )) {
        used.add(m[1]);
      }
    }
    expect(used.size).toBeGreaterThan(2);
    for (const step of used) {
      expect(css, `--color-plum-${step} is missing`).toContain(
        `--color-plum-${step}:`
      );
    }
  });

  it("gives every plum step a dark value", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    const light = css.slice(0, css.indexOf(':root[data-theme="dark"]'));
    const steps = [...light.matchAll(/--color-plum-(\d{2,3}):/g)].map((m) => m[1]);
    expect(steps.length).toBeGreaterThan(5);
    for (const step of steps) {
      expect(dark, `plum-${step} has no dark value`).toContain(
        `--color-plum-${step}:`
      );
    }
  });

  /** The glyph is a door, and it stays two strokes so it cannot grow
      into the padlock #200 forbids. */
  it("draws the premium glyph as two paths inside Glyph", () => {
    const icon = readFileSync("components/Icon.tsx", "utf8");
    const body = icon.slice(
      icon.indexOf("export function IconPremium"),
      icon.indexOf("export function IconPremium") + 700
    );
    const fn = body.slice(0, body.indexOf("\n}\n"));
    expect(fn).toContain("<Glyph");
    expect(fn).not.toMatch(/fill=|#[0-9a-fA-F]{3,6}/);
    expect([...fn.matchAll(/<path /g)].length).toBe(2);
  });
});
