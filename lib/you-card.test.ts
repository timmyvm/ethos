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

  it("holds the reach line until the recordings say whether today is spoken", () => {
    // Before they are read the streak is the empty one (today not spoken),
    // so the line would say "Today's practice" and then "One more recording".
    expect(you).toMatch(
      /\{loading \? \(\s*<Line [^>]*\/>\s*\) : \(\s*<p data-look="reach-line"[^>]*>\s*\{reachLine\(xp\?\.total \?\? 0, streak\.didToday\)\}/
    );
  });

  it("marks each number: the flames by today, XP with its own glyph", () => {
    // The marks are #487's 3D icons: the streak's flame unlit until today
    // is spoken, the best streak's crowned flame, the XP bolt.
    expect(you).toMatch(/label="Streak"[\s\S]{0,200}mark=\{<StatIcon kind="streak" lit=\{streakFlame\(streak\.current, streak\.didToday\) === "lit"\} size=\{22\} \/>\}/);
    expect(you).toMatch(/label="Best streak"[\s\S]{0,200}mark=\{<StatIcon kind="best" lit=\{bestFlame\(streak\.longest\) === "lit"\} size=\{22\} \/>\}/);
    expect(you).toMatch(/label="XP today" value=\{xpFailed \? null : xp\?\.today\} mark=\{<StatIcon kind="xp" size=\{22\} \/>\}/);
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

  it("holds under Increase Contrast too, deeper in light and lighter in dark, its hue kept", () => {
    const icAt = css.indexOf("@media screen and (prefers-contrast: more) {\n  :root {\n    --xp:");
    expect(icAt).toBeGreaterThan(-1);
    const ic = css.slice(icAt, css.indexOf("\n}\n", icAt));
    const icLight = ic.slice(0, ic.indexOf(":root[data-theme"));
    const icDark = ic.slice(ic.indexOf(':root[data-theme="dark"]'));
    const l = value(icLight, "--xp")!;
    const d = value(icDark, "--xp")!;
    // Stronger than the plain values, never weaker: the card, the surface and the trough.
    for (const ground of ["#ffffff", "#f4f4f4", "#e4e4e4"]) {
      expect(ratio(l, ground)).toBeGreaterThan(ratio(value(light, "--xp")!, ground));
      expect(ratio(l, ground)).toBeGreaterThanOrEqual(4.5);
    }
    for (const ground of ["#2a2a2a", "#333333"]) {
      expect(ratio(d, ground)).toBeGreaterThan(ratio(value(dark, "--xp")!, ground));
      expect(ratio(d, ground)).toBeGreaterThanOrEqual(4.5);
    }
    // It comes after the plain and dark blocks, so it is the one that applies.
    expect(icAt).toBeGreaterThan(darkAt);
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

/* The photo's saving moved whole into the one picture's hook (#488),
   components/picture/usePicture.tsx; its failed line into
   components/picture/PictureChoices.tsx's PictureProblem. */
describe("the photo's coin while it saves", () => {
  it("draws the square the phone made, never the camera's original", () => {
    const hook = strip(readFileSync("components/picture/usePicture.tsx", "utf8"));
    const keep = hook.slice(hook.indexOf("async function keep("), hook.indexOf("async function removePhoto("));
    expect(keep).toMatch(/picture = await makeAvatar\(file\)/);
    expect(keep).toMatch(/setLocal\(URL\.createObjectURL\(picture\.blob\)\)/);
    expect(keep).toMatch(/await uploadAvatar\(picture\)/);
    expect(keep).not.toMatch(/createObjectURL\(file\)/);
    // The made square is drawn before it is sent.
    expect(keep.indexOf("setLocal(")).toBeLessThan(keep.indexOf("uploadAvatar("));
  });

  it("puts under a failed line only the door avatarRetry names, its own words on it", () => {
    const hook = strip(readFileSync("components/picture/usePicture.tsx", "utf8"));
    const line = strip(readFileSync("components/picture/PictureChoices.tsx", "utf8"));
    expect(hook).toMatch(/const door = error \? avatarRetry\(error\) : null;/);
    expect(hook).toMatch(/const retry = door && run \? \{ label: door\.label, run \} : null;/);
    expect(line).toMatch(/\{state\.retry && \(/);
    expect(line).toMatch(/\{state\.retry\.label\}/);
    expect(line).not.toMatch(/>\s*Try again\s*</);
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

/*
 * A lexicon row at 320 (#496, the morning tour, docs/look/tour/16-you-top-320-light.png):
 * "doing stuff for →" broke after the arrow and the pill dropped to a
 * line of its own. The arrow and the upgrade are one unit, so a row
 * that wraps carries both to the next line.
 */
describe("a lexicon swap", () => {
  const swap = fn(you, "Swap");

  it("keeps the arrow and the upgrade together in one unit that wraps whole", () => {
    const unit = swap.slice(swap.indexOf("<span data-swap-to"));
    expect(unit).toMatch(/^<span data-swap-to="" className="flex min-w-0 max-w-full items-center gap-2\.5">/);
    const arrow = unit.indexOf("<svg");
    const pill = unit.indexOf('<span className="you-word');
    const close = unit.lastIndexOf("</span>\n      </span>");
    expect(arrow).toBeGreaterThan(0);
    expect(pill).toBeGreaterThan(arrow);
    expect(close).toBeGreaterThan(pill);
    // What was said stays outside it, the one part that may sit alone.
    expect(swap.indexOf("line-through")).toBeLessThan(swap.indexOf("<span data-swap-to"));
  });

  it("stands in a row that wraps, so the unit moves down whole", () => {
    expect(you).toMatch(/const SWAP_ROW = "flex min-h-14 flex-wrap items-center/);
  });
});
