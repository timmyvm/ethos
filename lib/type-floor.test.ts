import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The 11px floor (#450): the smallest type an iPhone sets is Caption 2,
 * 11pt, and nothing a person reads in Ethos is set smaller. Read from
 * the stylesheet; scripts/check-type.mjs measures the screens.
 */
const css = readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every size the stylesheet sets, in px, with the text it was written as. */
const sizes = [...css.matchAll(/(--[a-z0-9-]+|font-size)\s*:\s*(-?[0-9.]+)(rem|px)\s*;/g)]
  .filter((m) => m[1] === "font-size" || /^--(text-(?!.*--)|unit-size|stair-cents)/.test(m[1]))
  .map((m) => ({ name: m[1], px: m[3] === "rem" ? Number(m[2]) * 16 : Number(m[2]), at: m.index ?? 0 }));

describe("the 11px floor (#450)", () => {
  it("the two capitals registers are one size, 11px", () => {
    for (const role of [".label-data", ".label-micro"]) {
      const at = css.indexOf(`\n${role} {`);
      expect(at, role).toBeGreaterThan(-1);
      expect(css.slice(at, css.indexOf("}", at)), role).toMatch(/font-size: 0\.6875rem;/);
    }
  });

  it("the suffix step is 11px", () => {
    expect(css).toMatch(/--text-suffix: 0\.6875rem;/);
  });

  it("a narrow tile's unit is not stepped down: the number gives the room", () => {
    const under = css.slice(css.indexOf("@container (max-width: 120px)"));
    expect(under.slice(0, under.indexOf("\n}\n"))).not.toMatch(/--unit-size/);
  });

  it("nothing in the stylesheet is set under 11px but the stair's cents", () => {
    expect(sizes.length).toBeGreaterThan(40);
    const under = sizes.filter((s) => s.px > 0 && s.px < 11);
    // The cents on the paywall's stair, and their size on a 320 phone: a price's superscript,
    // cut to the step's width (docs/ladder-spec.md). The whole price stands at reading size over it.
    const allowed = under.filter((s) => {
      if (s.name === "--stair-cents-xs") return true;
      const rule = css.slice(css.lastIndexOf("}", s.at) + 1, s.at);
      return /\.stair-cents\s*\{/.test(rule);
    });
    expect(under.map((s) => `${s.name}: ${s.px}px`)).toEqual(allowed.map((s) => `${s.name}: ${s.px}px`));
    expect(allowed.length).toBe(2);
  });
});
