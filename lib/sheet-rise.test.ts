import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * A sheet rises once (notes1, round 2). `.sheet-panel` rises on the CSS
 * `sheet-in` keyframes, and a drag turns them off while the finger is
 * down (`data-dragging`). Released short, the attribute came off, the
 * keyframes came back as a NEW animation from translateY(100%), and the
 * sheet blinked off screen for a frame before the spring home covered
 * it. So the first time a finger takes hold, the panel is marked held
 * for good, and a held panel never plays its rise again.
 */
describe("a sheet's rise never replays after a finger has held it", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const overlay = readFileSync("components/ui/Overlay.tsx", "utf8");

  it("turns the rise off on a held panel, in CSS", () => {
    expect(css).toMatch(/\.sheet-panel\[data-held\][^{]*\{[^}]*animation:\s*none/);
  });

  it("marks the panel held when a drag takes hold, and never unmarks it", () => {
    expect(overlay).toMatch(/data-held=\{held \|\| undefined\}/);
    expect(overlay).toMatch(/setHeld\(true\)/);
    expect(overlay).not.toMatch(/setHeld\(false\)/);
  });
});
