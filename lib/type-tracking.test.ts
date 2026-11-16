import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Heavy type is tracked in as far as its letters allow and no further
 * (#454). Outfit at 700 and over is drawn close: `scripts/look-kerning.mjs`
 * draws every letter pair of the app's own headings in the real face and
 * counts the ones whose ink joins. At -0.028em, the large title's old
 * value, nineteen did ("st" nine times over, "ct", "ru", "with"); at
 * -0.015em nine do, two more than the face draws joined with no
 * tracking at all (its fi and tt ligatures, r into y). So -0.015em is
 * the ceiling for a line of letters at 700 or over, and -0.012em under
 * 34px.
 *
 * Numbers are not letters: digits stand apart at any of these values
 * (the script's second table) and keep their own tighter tracking.
 */
const css = readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const CEILING = -0.015;
const UNDER_34 = -0.012;

/** Every rule that sets a negative tracking: its selector, the tracking in em, and the weight and size it names. */
function tracked() {
  const out: { selector: string; em: number; weight: number | null; rem: number | null }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*letter-spacing:\s*(-[0-9.]+)em[^{}]*)\}/g)) {
    const body = m[2];
    const weight = /font-weight:\s*(\d+)/.exec(body);
    const size = /font-size:\s*([0-9.]+)rem/.exec(body);
    out.push({
      selector: m[1].trim().split("\n").pop()!.trim(),
      em: Number(m[3]),
      weight: weight ? Number(weight[1]) : null,
      rem: size ? Number(size[1]) : null,
    });
  }
  return out;
}

/** The size tokens that set their own tracking and weight (`--text-x--letter-spacing`). */
function tokens() {
  const out: { name: string; em: number; weight: number | null; rem: number | null }[] = [];
  for (const m of css.matchAll(/--text-([a-z-]+)--letter-spacing:\s*(-?[0-9.]+)em/g)) {
    const name = m[1];
    const weight = new RegExp(`--text-${name}--font-weight:\\s*(\\d+)`).exec(css);
    const size = new RegExp(`--text-${name}:\\s*([0-9.]+)rem`).exec(css);
    out.push({ name, em: Number(m[2]), weight: weight ? Number(weight[1]) : null, rem: size ? Number(size[1]) : null });
  }
  return out;
}

/** Digits, and the one line cut to a window: named, so a new one is a decision. */
const NUMBERS = /^\.(home-num|home-num-line|stair-price)\b|\.home-num$/;
const EXCEPTIONS = [".home-display.home-reel"];

describe("heavy type is tracked in no further than its letters allow (#454)", () => {
  it("no rule of letters at 700 or over is past -0.015em", () => {
    const past = tracked().filter(
      (r) => r.em < CEILING - 1e-9 && (r.weight === null || r.weight >= 700) && !NUMBERS.test(r.selector) && !EXCEPTIONS.includes(r.selector)
    );
    expect(past.map((r) => `${r.selector} ${r.em}em`)).toEqual([]);
  });

  it("the large title, the word at the head of its sheet and the home card sit on the ceiling", () => {
    const of = (selector: string) => tracked().find((r) => r.selector === selector)?.em;
    expect(of(".large-title")).toBe(CEILING);
    expect(of(".word-sheet-word")).toBe(CEILING);
    expect(of(".home-display")).toBe(CEILING);
    // A long topic drops a size and keeps the card's tracking: it restates none.
    expect(tracked().some((r) => r.selector === ".home-display[data-long]")).toBe(false);
  });

  it("under 34px a heavy line is at -0.012em or looser", () => {
    const of = (selector: string) => tracked().find((r) => r.selector === selector);
    for (const selector of [".section-head", ".stage-prompt"]) {
      const rule = of(selector);
      expect(rule, selector).toBeDefined();
      expect(rule!.weight).toBe(800);
      expect(rule!.em, selector).toBeGreaterThanOrEqual(UNDER_34);
    }
    const title = tokens().find((t) => t.name === "title");
    expect(title?.rem).toBe(1.625);
    expect(title?.em).toBeGreaterThanOrEqual(UNDER_34);
  });

  it("the copy sizes under the title are barely tracked at all", () => {
    for (const t of tokens()) {
      if (t.name.startsWith("num-") || t.name === "title") continue;
      expect(t.em, t.name).toBeGreaterThanOrEqual(UNDER_34);
    }
  });

  it("numbers keep their own tracking, and it is named here", () => {
    const nums = tokens().filter((t) => t.name.startsWith("num-"));
    expect(nums.map((t) => t.name).sort()).toEqual(["num-hero", "num-l", "num-m", "num-s", "num-xl"]);
    for (const t of nums) {
      expect(t.weight).toBe(800);
      expect(t.em).toBeGreaterThanOrEqual(-0.03);
    }
  });

  it("the roulette's reel is the one line left past the ceiling, and says why", () => {
    const raw = readFileSync("app/globals.css", "utf8");
    const at = raw.indexOf(".home-display.home-reel {");
    const block = raw.slice(at, raw.indexOf("}", at));
    expect(block).toMatch(/letter-spacing: -0\.03em;/);
    expect(block).toMatch(/a\s+fifth would be clipped/);
  });
});
