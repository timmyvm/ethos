import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The toast's rim (#499). The capsule is ink where the page is ground, a
 * piece of the other theme, so it wears the other theme's card hairline:
 * light on the dark capsule, dark on the pale one, firmer under Increase
 * Contrast. With the page's own card-edge it had none on the room's sky.
 */
const css = readFileSync("app/globals.css", "utf8");

/** The `rgba(...)` a token is set to inside `block`. */
const value = (block: string, token: string): string => {
  const m = block.match(new RegExp(`${token}:\\s*(rgba\\([^)]*\\))`));
  if (!m) throw new Error(`${token} is not set here`);
  return m[1].replace(/\s+/g, "");
};

const light = css.slice(css.indexOf("@theme {"), css.indexOf(":root {"));
const darkAt = css.indexOf(':root[data-theme="dark"] {\n  color-scheme: dark;');
const dark = css.slice(darkAt, css.indexOf("\n}\n", darkAt));
const moreAt = css.indexOf("@media (prefers-contrast: more) {");
const more = css.slice(moreAt, css.indexOf("\n}\n", moreAt));
const moreLight = more.slice(more.indexOf(":root {"), more.indexOf(':root[data-theme="dark"] {'));
const moreDark = more.slice(more.indexOf(':root[data-theme="dark"] {'));

describe("the toast's rim is the other theme's card hairline (#499)", () => {
  it("light, dark and Increase Contrast each set it", () => {
    for (const block of [light, dark, moreLight, moreDark]) expect(block).toContain("--color-ink-edge");
  });

  it("is the other theme's card-edge, at the same strength", () => {
    expect(value(light, "--color-ink-edge")).toBe(value(dark, "--color-card-edge"));
    expect(value(dark, "--color-ink-edge")).toBe(value(light, "--color-card-edge"));
    expect(value(moreLight, "--color-ink-edge")).toBe(value(moreDark, "--color-card-edge"));
    expect(value(moreDark, "--color-ink-edge")).toBe(value(moreLight, "--color-card-edge"));
  });

  it("the capsule draws it inside its edge, under its float", () => {
    const toast = css.slice(css.indexOf("\n.toast {"), css.indexOf("}", css.indexOf("\n.toast {")));
    expect(toast).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--color-ink-edge\),\s*var\(--shadow-3\)/);
  });
});
