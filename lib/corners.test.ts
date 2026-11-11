import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Continuous corners (#437): where the browser draws them, each surface
 * radius is drawn a third larger under a superellipse. The enlarged
 * radii restate the theme's own, so the two are held in step here; and
 * the block must stay inside its @supports, or a browser that cannot
 * draw the corner would get the larger radius with a round one.
 */
const css = readFileSync("app/globals.css", "utf8");
const start = css.indexOf("@supports (corner-shape: superellipse(1.5)) {");
const end = css.indexOf("end of continuous corners (#437)");
const block = css.slice(start, end);
// Comments out: a selector is read as the text before a brace.
const outside = (css.slice(0, start) + css.slice(end)).replace(/\/\*[\s\S]*?\*\//g, "");

const base = (name: string): string | null => outside.match(new RegExp(`--radius-${name}:\\s*([^;]+);`))?.[1].trim() ?? null;
const drawn = (name: string): string | null => block.match(new RegExp(`--radius-${name}:\\s*([^;]+);`))?.[1].trim() ?? null;

describe("continuous corners", () => {
  it("live in one block, inside @supports", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(outside).not.toMatch(/corner-shape\s*:/);
  });

  it("draw every surface radius from the theme's own value, a third larger", () => {
    expect(block).toMatch(/--corner-k:\s*1\.35;/);
    for (const name of ["control", "card", "sheet", "hero", "tile"]) {
      const theme = base(name);
      expect(theme, name).toMatch(/^\d+px$/);
      expect(drawn(name), name).toBe(`calc(${theme} * var(--corner-k))`);
    }
  });

  it("give every reader of those radii the corner", () => {
    // Each rule that sets a surface radius from a token, by its selector.
    const readers = [...outside.matchAll(/([^{}]+)\{[^{}]*border-radius:\s*var\(--radius-(?:control|card|sheet|hero|tile)\)/g)]
      .map((m) => m[1].trim().split("\n").pop()!.trim())
      .filter((s) => s.startsWith("."));
    expect(readers.length).toBeGreaterThanOrEqual(7);
    for (const selector of readers) {
      const name = selector.split(/[\s:[,]/)[0];
      expect(block, `${name} sets a surface radius and is not in the corners block`).toContain(`${name},`);
    }
    for (const utility of [".rounded-control", ".rounded-card", ".rounded-sheet", ".rounded-t-sheet"]) {
      expect(block).toContain(utility);
    }
  });

  it("leave pills, circles and square edges round", () => {
    const round = block.slice(block.lastIndexOf(".home-seg,"));
    expect(round).toMatch(/\.home-seg \.segmented-thumb,\s*\.rounded-tap,\s*\.rounded-full,\s*\.rounded-none \{\s*corner-shape: round;/);
  });

  it("hand the corner to layers that borrow their surface's radius", () => {
    const borrowers = [...outside.matchAll(/([^{}]+)\{[^{}]*border-radius:\s*inherit/g)].flatMap((m) =>
      m[1].split(",").map((s) => s.trim().split("\n").pop()!.trim())
    );
    expect(borrowers.length).toBeGreaterThan(0);
    const inherit = block.slice(block.indexOf(".family-fill::before"), block.indexOf("corner-shape: inherit"));
    for (const selector of borrowers) expect(inherit, selector).toContain(selector);
  });
});
