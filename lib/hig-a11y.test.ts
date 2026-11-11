import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Three promises from the Apple HIG pass that live in files, not in
 * behaviour (#448), read from the files themselves.
 */
const css = readFileSync("app/globals.css", "utf8");
const sw = readFileSync("public/sw.js", "utf8");

/** The alpha of an `rgba(r, g, b, a)` token inside `block`. */
const alpha = (block: string, token: string): number => {
  const m = block.match(new RegExp(`${token}:\\s*rgba\\([^)]*,\\s*([0-9.]+)\\)`));
  if (!m) throw new Error(`${token} is not restated`);
  return Number(m[1]);
};

describe("Increase Contrast restates the neutrals (#448)", () => {
  const at = css.indexOf("@media (prefers-contrast: more) {");
  const block = css.slice(at, css.indexOf("\n}\n", at));
  const light = block.slice(block.indexOf(":root {"), block.indexOf(':root[data-theme="dark"] {'));
  const dark = block.slice(block.indexOf(':root[data-theme="dark"] {'), block.indexOf(".screen-bar[data-edge]"));

  it("answers in both themes", () => {
    expect(at).toBeGreaterThan(-1);
    expect(light).toContain("--color-hairline");
    expect(dark).toContain("--color-hairline");
  });

  it("every line and edge is firmer than it stands, in the theme's own ink", () => {
    for (const [name, part, ink, base] of [
      ["light", light, "32, 30, 29", { hairline: 0.08, "card-edge": 0.09, edge: 0.14 }],
      ["dark", dark, "242, 242, 242", { hairline: 0.08, "card-edge": 0.12, edge: 0.16 }],
    ] as const) {
      for (const [token, was] of Object.entries(base)) {
        expect(alpha(part, `--color-${token}`), `${name} ${token}`).toBeGreaterThanOrEqual(was * 2);
        expect(part, `${name} ${token} keeps its ink`).toMatch(new RegExp(`--color-${token}:\\s*rgba\\(${ink},`));
      }
    }
  });

  it("second-rank text is stronger, and still ranked", () => {
    for (const part of [light, dark]) {
      const muted = alpha(part, "--color-stone-400");
      const secondary = alpha(part, "--color-stone-500");
      const strong = alpha(part, "--color-stone-600");
      expect(muted).toBeGreaterThanOrEqual(0.78);
      expect(secondary).toBeGreaterThan(muted);
      expect(strong).toBeGreaterThan(secondary);
      expect(strong).toBeLessThan(0.92); // stone-800 stays above it
    }
  });

  it("changes strengths only: no hue is restated", () => {
    expect(block.slice(0, block.indexOf(".screen-bar[data-edge]"))).not.toMatch(/terracotta|sage|plum|rust|--tone|--pop-/);
  });
});

describe("a lesson's own screen draws the 560 cut, and it is shell (#448)", () => {
  const small = [...sw.matchAll(/"\/lessons\/([a-z0-9-]+)\.webp"/g)].map((m) => m[1]);
  const large = [...sw.matchAll(/"\/lessons\/large\/([a-z0-9-]+)\.webp"/g)].map((m) => m[1]);

  it("the lesson stage asks for the large cut", () => {
    const page = readFileSync("app/lessons/[id]/page.tsx", "utf8");
    expect(page).toContain("src={objectSrc(lesson.id, true)}");
    expect(page).not.toContain("src={lesson.art}");
  });

  it("every lesson in the shell has its large cut there too, and on disk", () => {
    expect(small.length).toBeGreaterThanOrEqual(15);
    expect([...large].sort()).toEqual([...small].sort());
    for (const name of large) expect(existsSync(`public/lessons/large/${name}.webp`), name).toBe(true);
  });
});

describe("terracotta is the tap's (#448)", () => {
  it("the recorder's last ten seconds warn in rust", () => {
    const rep = readFileSync("app/rep/page.tsx", "utf8");
    expect(rep).toMatch(/config\.maxSeconds - seconds <= 10 \? "text-rust" : ""/);
  });

  it("Hostile's live dot and its word are rust", () => {
    const hostile = readFileSync("app/hostile/page.tsx", "utf8");
    expect(hostile).toContain('className="h-2.5 w-2.5 rounded-full bg-rust"');
    expect(hostile).toContain('className="label-micro !text-rust"');
    expect(hostile).not.toMatch(/bg-terracotta-700|!text-terracotta-700/);
  });
});
