import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The introduction keeps Demos's entrance and nothing after it (notes1,
 * Timothy: "the image like animates by moving the png around and then a
 * video animation plays after that image chop animation. Looks weird.
 * Lets js have the chopping image animation"). His idle clip (#316) is
 * off on every screen of /welcome, and on everywhere else.
 */
const welcome = readFileSync("app/welcome/page.tsx", "utf8");
const art = readFileSync("components/DemosArt.tsx", "utf8");

describe("the introduction's Demos", () => {
  it("is drawn through one wrapper that turns the idle clip off", () => {
    expect(welcome).toMatch(/function IntroDemos\([\s\S]{0,200}<DemosArt \{\.\.\.props\} idle=\{false\} \/>/);
  });

  it("has no Demos that skips the wrapper", () => {
    const raw = welcome.match(/<DemosArt\b/g) ?? [];
    expect(raw.length).toBe(1); // the wrapper's own
    expect((welcome.match(/<IntroDemos\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("never mounts the clip itself", () => {
    expect(welcome).not.toMatch(/DemosClip|DemosFigure/);
  });
});

describe("the clip everywhere else", () => {
  it("still plays by default at 120px and up", () => {
    expect(art).toMatch(/idle = true/);
    expect(art).toMatch(/const clip = idle && size >= 120 && hasClip\(pose\)/);
  });
});
