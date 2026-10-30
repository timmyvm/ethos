import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIP_MAX_BYTES,
  CLIP_POSES,
  REST_LONG_MS,
  REST_SHORT_MS,
  clipSrc,
  hasClip,
  restMs,
} from "./idle-clips";

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

describe("how long Demos rests between plays (E59)", () => {
  it("rests a few seconds after each of the first two plays, so three play close together", () => {
    for (const played of [1, 2]) {
      expect(restMs(played, 0)).toBe(2600);
      expect(restMs(played, 0.5)).toBe(3900);
      expect(restMs(played, 0.999)).toBeLessThan(5200);
    }
  });

  it("settles after the third: every later rest is 15 to 30 seconds", () => {
    for (const played of [3, 4, 10, 100]) {
      expect(restMs(played, 0)).toBe(15000);
      expect(restMs(played, 0.5)).toBe(22500);
      expect(restMs(played, 0.999)).toBeLessThan(30000);
    }
  });

  it("before any play has finished, a rest is a short one", () => {
    expect(restMs(0, 0)).toBe(REST_SHORT_MS[0]);
  });

  it("keeps a stray draw inside the window", () => {
    expect(restMs(1, -1)).toBe(REST_SHORT_MS[0]);
    expect(restMs(5, 2)).toBe(REST_LONG_MS[1]);
  });

  it("draws afresh by default, always inside the window", () => {
    for (let i = 0; i < 200; i++) {
      const short = restMs(1);
      const long = restMs(3);
      expect(short).toBeGreaterThanOrEqual(2600);
      expect(short).toBeLessThanOrEqual(5200);
      expect(long).toBeGreaterThanOrEqual(15000);
      expect(long).toBeLessThanOrEqual(30000);
    }
  });
});
