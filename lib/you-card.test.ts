import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODE_EXPLORE, CODE_LINE } from "./plan-view";

/*
 * You's top card (#485), from Timothy's screenshots of 16 Nov: the gear
 * on its own, one card for all of it, the three numbers with their marks,
 * XP in its own purple, and Premium by code said his way.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const you = strip(readFileSync("app/you/page.tsx", "utf8"));
const css = readFileSync("app/globals.css", "utf8");

const fn = (src: string, name: string) => {
  const at = src.indexOf(`function ${name}(`);
  return src.slice(at, src.indexOf("\n}\n", at));
};

describe("the gear", () => {
  it("is the icon alone: no square behind it, its 44px target and its name kept", () => {
    const gear = fn(you, "SettingsButton");
    expect(gear).toMatch(/aria-label="Settings"/);
    expect(gear).toMatch(/size-11/);
    expect(gear).not.toMatch(/bg-surface|bg-raised|border\b|rounded-full/);
    expect(gear).toMatch(/<IconGear size=\{24\} \/>/);
  });
});

describe("the one card", () => {
  it("holds the photo, the name, the level, the bar and the three numbers", () => {
    const at = you.indexOf('data-look="you-card"');
    const card = you.slice(at, you.indexOf("</section>", at));
    for (const part of [
      "{avatar.coin}",
      'aria-label="Edit your name"',
      "Add your name",
      "Level{\" \"}",
      "xp-fill",
      "levelLine(",
      "reachLine(",
      'label="Streak"',
      'label="Best streak"',
      'label="XP today"',
    ]) {
      expect(card, part).toContain(part);
    }
    // The old line and the week's XP are gone.
    expect(you).not.toMatch(/of \{level\.forNext\} to level/);
    expect(you).not.toMatch(/XP this week/);
    // One card, not a stage over a second card.
    expect(you).not.toMatch(/aria-label="Your numbers" className="card/);
  });

  it("marks each number: the flames by today, XP with its own glyph", () => {
    expect(you).toMatch(/label="Streak"[\s\S]{0,200}mark=\{<IconFlame size=\{20\} \/>\}/);
    expect(you).toMatch(/label="Best streak"[\s\S]{0,200}mark=\{<IconFlame size=\{20\} \/>\}/);
    expect(you).toMatch(/label="XP today" value=\{xpFailed \? null : xp\?\.today\} mark=\{<IconXp size=\{20\} \/>\}/);
    // Grey and lit differ in shape too: only the lit flame fills its core.
    expect(css).toMatch(/\.streak-lit svg\[fill="none"\] > path:not\(\[fill\]\):last-child \{\s*fill: var\(--streak\);/);
  });
});

describe("XP's purple", () => {
  const value = (block: string, token: string) => block.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`))?.[1];
  const light = css.slice(css.indexOf(":root {\n  --xp:"), css.indexOf("}", css.indexOf(":root {\n  --xp:")));
  const darkAt = css.indexOf(':root[data-theme="dark"] {\n  --xp:');
  const dark = css.slice(darkAt, css.indexOf("}", darkAt));

  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("is a token in light and dark", () => {
    expect(value(light, "--xp")).toBe("#ad22dd");
    expect(value(dark, "--xp")).toBe("#cf74ff");
  });

  it("holds 3:1 for the bar on its trough and 4.5:1 for text on the card, in both themes", () => {
    const l = value(light, "--xp")!;
    const d = value(dark, "--xp")!;
    expect(ratio(l, "#e4e4e4")).toBeGreaterThanOrEqual(3);
    expect(ratio(l, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(d, "#333333")).toBeGreaterThanOrEqual(3);
    expect(ratio(d, "#2a2a2a")).toBeGreaterThanOrEqual(4.5);
  });

  it("is never plum or Variety's violet", () => {
    for (const v of [value(light, "--xp"), value(dark, "--xp")]) {
      expect(v).not.toBe("#62336c");
      expect(v).not.toBe("#7048e6");
      expect(v).not.toBe("#b191d2");
      expect(v).not.toBe("#d4a8e8");
    }
    // The bar, the glyph and today's XP read the token, never a plum or tone class.
    const card = you.slice(you.indexOf('data-look="you-card"'), you.indexOf("</section>", you.indexOf('data-look="you-card"')));
    expect(card).not.toMatch(/plum-|--tone|\btone-/);
  });
});

describe("Premium by code", () => {
  it("says Timothy's line, with Explore to what Premium gives", () => {
    expect(CODE_LINE).toBe("Yay! You've got Premium 🎉");
    expect(CODE_EXPLORE).toBe("Explore");
    expect(you).toMatch(/data-look="premium-on"[\s\S]{0,80}\{CODE_LINE\}/);
    expect(you).toMatch(/data-look="premium-explore"[\s\S]{0,200}onClick=\{\(\) => setExploring\(true\)\}/);
    expect(you).toMatch(/\{exploring && <PremiumHave onClose=\{\(\) => setExploring\(false\)\} \/>\}/);
  });

  it("opens the paywall's own list, on a sheet that sells nothing", () => {
    const have = strip(readFileSync("components/premium/PremiumHave.tsx", "utf8"));
    expect(have).toMatch(/import \{ BENEFITS \} from "@\/components\/Paywall"/);
    expect(have).toMatch(/BENEFITS\.map/);
    expect(have).not.toMatch(/card-premium|Start at|PAYWALL_COPY|Stair/);
  });
});
