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

describe("the paywall's benefits (#403, E40)", () => {
  const src = readFileSync("components/Paywall.tsx", "utf8");
  const list = src.slice(src.indexOf("const BENEFITS = ["), src.indexOf("];", src.indexOf("const BENEFITS = [")));

  it("keeps five one-line rows, the games in one, so every price on the Stair shows at rest at 375x667", () => {
    // A sixth row (the games split in two) took the body from 61 to 90px
    // of scroll and put 7.99 and 6.99 under the fade (regression review,
    // edges F4); scripts/check-sheet-touch.mjs measures the fold itself.
    expect(list.match(/\{ Glyph:/g)?.length).toBe(5);
    expect(list).toContain("Speed rush, Interview, more Hostile Q&amp;A");
  });

  /* #478 review: Hostile Q&A is free (three rounds a day), so the sheet
     never sells it as a game only Premium plays. */
  it("never sells Hostile Q&A as Premium's alone, now that it is free", () => {
    expect(list).not.toMatch(/(?:and|,) Hostile Q&amp;A/);
  });
});

/*
 * The reel's build 4 (26 Nov): every row sells something only Premium
 * has. "Every word you've earned, kept" sold Say it better, free and
 * uncapped since #507, and read as a threat to saved phrases; the boss
 * row says what app/boss/page.tsx gives Premium (any of the topics, any
 * time; free plays the week's one, once). Five rows, each its own mark.
 */
describe("the paywall's benefits say only what Premium adds", () => {
  const src = readFileSync("components/Paywall.tsx", "utf8");
  const list = src.slice(src.indexOf("const BENEFITS = ["), src.indexOf("];", src.indexOf("const BENEFITS = [")));
  const rows = [...list.matchAll(/\{ Glyph: (\w+), text: ([^\n]+) \},?\n/g)].map((m) => ({ glyph: m[1], text: m[2] }));

  it("keeps five rows, the boss fourth and the games last", () => {
    expect(rows).toHaveLength(5);
    expect(rows[3]).toEqual({ glyph: "IconBoss", text: '"Weekly boss: any topic, any time"' });
    expect(rows[4].glyph).toBe("IconStopwatch");
    expect(rows[4].text).toContain("Speed rush, Interview, more Hostile Q&amp;A");
  });

  it("wears each mark once", () => {
    const glyphs = rows.map((r) => r.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(glyphs.filter((g) => g === "IconBoss")).toHaveLength(1);
  });

  it("never sells Say it better or a kept word, which are free", () => {
    for (const r of rows) expect(r.text).not.toMatch(/word|Say it better|kept/i);
  });

  it("matches what the boss page gives Premium: a picked topic and no week's limit", () => {
    const boss = readFileSync("app/boss/page.tsx", "utf8");
    // Free: one run a week, locked once taken; Premium: any topic, any time.
    expect(boss).toMatch(/const locked = takenThisWeek && premium === false;/);
    expect(boss).toMatch(/paid \? setLibrary\(\(v\) => !v\) : setPaywall\("The boss library"\)/);
    expect(boss).toMatch(/premium runs any topic, any time/);
  });

  it("the workbench's sheets carry the paywall's own rows and closing, not copies", () => {
    for (const f of ["app/workbench/ladder-a/Surfaces.tsx", "app/workbench/ladder-b/PaywallB.tsx"]) {
      const w = readFileSync(f, "utf8");
      expect(w).toMatch(/import \{ BENEFITS(, reasonLine)? \} from "@\/components\/Paywall"/);
      expect(w).not.toMatch(/const BENEFITS = \[/);
      expect(w).toContain("{PAYWALL_COPY.closing}");
      expect(w).not.toMatch(/Every word you've earned|never buys stars, streaks, or scores/);
    }
  });
});
