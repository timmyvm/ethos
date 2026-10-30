import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAYWALL_HEAD_STAYS_MIN_HEIGHT, paywallHeadStays } from "./paywall-head";

/*
 * Where the paywall's head stands (notes1, round 2). The head (the mark,
 * the reason, the headline) stays put above the scroll so a finger on it
 * always drags the sheet. On a 320x568 phone that fixed head took about
 * 155px and left the ladder about 200px to scroll in: with the slider
 * focused, the readout sat in the top fade and the caption was cut off.
 * So on a short screen the head scrolls with the body, as it did before,
 * and only the grabber's strip stays put.
 */
describe("paywallHeadStays", () => {
  it("keeps the head put on a phone with room for it", () => {
    expect(paywallHeadStays(844)).toBe(true);
    expect(paywallHeadStays(667)).toBe(true);
    expect(paywallHeadStays(664)).toBe(true);
  });

  it("lets it scroll on a short screen", () => {
    expect(paywallHeadStays(568)).toBe(false);
    expect(paywallHeadStays(553)).toBe(false);
    expect(paywallHeadStays(PAYWALL_HEAD_STAYS_MIN_HEIGHT - 1)).toBe(false);
    expect(paywallHeadStays(PAYWALL_HEAD_STAYS_MIN_HEIGHT)).toBe(true);
  });
});

describe("the paywall places its head by the screen's height", () => {
  const src = readFileSync("components/Paywall.tsx", "utf8");

  it("draws the head once, above the scroll or inside it", () => {
    expect(src).toMatch(/\{headStays && head\}/);
    expect(src).toMatch(/\{!headStays && head\}/);
  });

  it("keeps the grabber out of the scroll either way", () => {
    const grabber = src.indexOf("h-1 w-10 rounded-full");
    const scroll = src.indexOf("paywall-scroll");
    expect(grabber).toBeGreaterThan(0);
    expect(grabber).toBeLessThan(scroll);
  });
});

describe("the paywall on a short screen", () => {
  it("tightens below 760px tall, where the large Stair cannot clear the shelf", async () => {
    const { paywallShort, PAYWALL_SHORT_MAX_HEIGHT } = await import("./paywall-head");
    expect(PAYWALL_SHORT_MAX_HEIGHT).toBe(759);
    expect(paywallShort(667)).toBe(true);
    expect(paywallShort(568)).toBe(true);
    expect(paywallShort(700)).toBe(true);
    expect(paywallShort(844)).toBe(false);
    expect(paywallShort(760)).toBe(false);
  });
});
