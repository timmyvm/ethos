import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIP_MAX_BYTES, CLIP_POSES, clipSrc, hasClip } from "./idle-clips";

const pub = (p: string) => join(__dirname, "..", "public", p);

describe("Demos's idle clips (#316)", () => {
  for (const pose of CLIP_POSES) {
    for (const ext of ["webm", "mp4"] as const) {
      it(`${pose}.${ext} ships, under the budget`, () => {
        const file = pub(clipSrc(pose, ext));
        expect(existsSync(file)).toBe(true);
        expect(statSync(file).size).toBeLessThanOrEqual(CLIP_MAX_BYTES);
      });
    }
    it(`${pose} has the still its clip starts and ends on`, () => {
      expect(existsSync(pub(`demos-onboard-${pose}.webp`))).toBe(true);
    });
  }

  it("the small question poses have no clip", () => {
    for (const pose of ["fingers", "telescope", "mic", "headphones"]) {
      expect(hasClip(pose)).toBe(false);
    }
  });
});
