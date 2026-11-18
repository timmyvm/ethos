import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MID_POSE_MAX, SMALL_POSE_MAX, poseSrc } from "@/components/DemosArt";
import { LESSONS } from "@/content/lessons";
import { objectSrc, objectSrcSet } from "./home";

/*
 * Images at what a 3x phone draws (#508, the speed audit's fix 21).
 */
const root = path.resolve(__dirname, "..");
const onDisk = (url: string) => existsSync(path.join(root, "public", url));

describe("Demos's poses", () => {
  it("are sent at the cut that covers 3x where he stands, and no bigger", () => {
    expect(poseSrc("clock", 120)).toBe("/demos-512/demos-onboard-clock.webp");
    expect(poseSrc("clock", SMALL_POSE_MAX)).toBe("/demos-512/demos-onboard-clock.webp");
    expect(poseSrc("clock", 235)).toBe("/demos-768/demos-onboard-clock.webp"); // the boss's stage
    expect(poseSrc("clock")).toBe("/demos-768/demos-onboard-clock.webp"); // DemosArt's 180 default
    expect(poseSrc("clock", MID_POSE_MAX)).toBe("/demos-768/demos-onboard-clock.webp");
    expect(poseSrc("clock", 280)).toBe("/demos-onboard-clock.webp");
    expect(MID_POSE_MAX * 3).toBeLessThanOrEqual(768);
  });

  it("every pose has its 768 cut", () => {
    for (const pose of ["celebrate", "clipboard", "clock", "fingers", "headphones", "hello", "listening", "mic", "speaking", "telescope", "wave"] as const) {
      expect(onDisk(poseSrc(pose, 200)), pose).toBe(true);
    }
  });
});

describe("Today's object", () => {
  it("asks for the 720 cut at 3x and the 560 below it, each on disk", () => {
    for (const l of LESSONS) {
      const set = objectSrcSet(l.id);
      expect(set).toBe(`${objectSrc(l.id, true)} 2x, /lessons/hero/${l.id}.webp 3x`);
      expect(onDisk(`/lessons/hero/${l.id}.webp`), l.id).toBe(true);
    }
    expect(readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8")).toMatch(/srcSet=\{objectSrcSet\(id\)\}/);
  });

  it("changes no file the worker pre-caches (no CACHE to move)", () => {
    const sw = readFileSync(path.join(root, "public/sw.js"), "utf8");
    expect(sw).not.toMatch(/demos-768|lessons\/hero/);
  });
});
