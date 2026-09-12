import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "./motion";

/**
 * The motion tokens live twice on purpose (DECISIONS #221): here, for
 * the animations JavaScript drives, and in app/globals.css, for the
 * ones CSS drives. Two copies drift unless something reads both, so
 * this does.
 */
const css = readFileSync("app/globals.css", "utf8");

function token(name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe("motion tokens", () => {
  it("mirrors every duration into CSS", () => {
    expect(token("duration-fast")).toBe(`${DURATION.fast}ms`);
    expect(token("duration-base")).toBe(`${DURATION.base}ms`);
    expect(token("duration-max")).toBe(`${DURATION.max}ms`);
    expect(token("duration-celebrate")).toBe(`${DURATION.celebrate}ms`);
  });

  it("mirrors the easings, and makes them Tailwind's defaults", () => {
    expect(token("ease-out")).toBe(EASE_OUT);
    expect(token("ease-in-out")).toBe(EASE_IN_OUT);
    expect(token("default-transition-timing-function")).toBe(EASE_OUT);
    expect(token("default-transition-duration")).toBe(`${DURATION.fast}ms`);
  });

  it("keeps every duration inside DESIGN-RULES", () => {
    expect(DURATION.fast).toBeLessThanOrEqual(DURATION.base);
    expect(DURATION.base).toBeLessThanOrEqual(DURATION.max);
    // Nothing past 300ms except a celebration, which may take 600.
    expect(DURATION.max).toBeLessThanOrEqual(300);
    expect(DURATION.celebrate).toBeLessThanOrEqual(600);
  });
});

/**
 * DESIGN-RULES: never invent an animation duration inline. A Tailwind
 * `duration-500` on a component is exactly that, so the sweep looks
 * for one; `.dur-fast/base/max` are the classes that read the tokens.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("no inline durations", () => {
  const files = ["app", "components"].flatMap(tsxFiles);

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    it(`reads durations from the tokens in ${file}`, () => {
      const source = readFileSync(file, "utf8");
      const inline = source.match(/\b(duration|delay)-\d+\b|\b(duration|delay)-\[/);
      expect(inline?.[0] ?? null).toBeNull();
    });
  }
});
