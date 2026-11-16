import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatIcon } from "@/components/StatIcon";
import { StreakBadge } from "@/components/StreakBadge";
import { STAT_ICON_MAX_BYTES, STAT_ICON_PX, STAT_ICON_SRC, STAT_KINDS } from "./stat-icons";

/*
 * The stat icons (#487): every count's mark is a 3D file. Each kind
 * names a file that ships, at the cut's size and under its ceiling; the
 * service worker keeps them offline; an unlit streak is the lit file
 * greyed, per theme and under Increase Contrast; and the component never
 * moves the page or speaks over the count beside it.
 */
const root = join(__dirname, "..");
const pub = (p: string) => join(root, "public", p);
const read = (f: string) => readFileSync(join(root, f), "utf8");

/** A WebP's canvas size from its VP8X header (the cut always writes one: it has alpha). */
function webpSize(file: string) {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  expect(b.toString("ascii", 12, 16)).toBe("VP8X");
  const hasAlpha = (b[20] & 0x10) !== 0;
  const w = 1 + b.readUIntLE(24, 3);
  const h = 1 + b.readUIntLE(27, 3);
  return { w, h, hasAlpha };
}

describe("the stat icon files (#487)", () => {
  for (const kind of STAT_KINDS) {
    it(`${kind} ships at ${STAT_ICON_PX}px with alpha, under the ceiling`, () => {
      const file = pub(STAT_ICON_SRC[kind]);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(STAT_ICON_MAX_BYTES);
      expect(webpSize(file)).toEqual({ w: STAT_ICON_PX, h: STAT_ICON_PX, hasAlpha: true });
    });

    it(`${kind} keeps its full-size source, so the cut can be re-run`, () => {
      expect(existsSync(join(root, "assets/icons-3d", `${kind}.png`))).toBe(true);
    });
  }

  it("names every file the cut writes, and nothing else", () => {
    const cut = read("scripts/cut-stat-icons.mjs");
    const names = Object.keys(JSON.parse(cut.match(/const OPTICAL = (\{[^}]*\})/)![1].replace(/(\w+):/g, '"$1":')));
    expect(names.sort()).toEqual([...STAT_KINDS].sort());
    for (const kind of STAT_KINDS) expect(STAT_ICON_SRC[kind]).toBe(`/icons/3d/${kind}.webp`);
  });

  it("are precached by the service worker, under a cache newer than the line icons'", () => {
    const sw = read("public/sw.js");
    for (const kind of STAT_KINDS) expect(sw).toContain(`"${STAT_ICON_SRC[kind]}"`);
    const v = Number(sw.match(/const CACHE = "ethos-v(\d+)";/)![1]);
    expect(v).toBeGreaterThanOrEqual(19);
  });
});

describe("StatIcon", () => {
  const html = (props: Parameters<typeof StatIcon>[0]) => renderToStaticMarkup(createElement(StatIcon, props));

  it("is a plain image at its own size: no shift, nothing said over the count", () => {
    const h = html({ kind: "xp", size: 24 });
    expect(h.match(/<img /g)?.length).toBe(1);
    expect(h).toContain('src="/icons/3d/xp.webp"');
    expect(h).toContain('width="24"');
    expect(h).toContain('height="24"');
    expect(h).toContain('alt=""');
    expect(h).toContain('decoding="async"');
    expect(h).toContain('draggable="false"');
    expect(h).not.toContain("data-lit");
  });

  it("unlit is the same file, marked for the grey filter", () => {
    const lit = html({ kind: "streak" });
    const unlit = html({ kind: "streak", lit: false });
    expect(unlit).toContain('data-lit="false"');
    expect(unlit.match(/src="([^"]+)"/)![1]).toBe(lit.match(/src="([^"]+)"/)![1]);
  });

  it("the grey is drawn in both themes and firmer under Increase Contrast, with no hue", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.stat-icon\[data-lit="false"\]\s*\{\s*filter: var\(--stat-unlit\);/);
    const values = [...css.matchAll(/--stat-unlit: ([^;]+);/g)].map((m) => m[1]);
    // Light, dark (data-theme and the OS), and both themes again under more contrast.
    expect(values.length).toBe(5);
    for (const v of values) {
      expect(v).toMatch(/^grayscale\(1\)/);
      expect(v).not.toMatch(/hue-rotate|sepia|saturate/);
    }
    // Increase Contrast restates it beside the neutrals (#448's block), in both themes.
    const at = css.indexOf("@media (prefers-contrast: more) {");
    const block = css.slice(at, css.indexOf("\n}\n", at));
    expect(block.match(/--stat-unlit:/g)?.length).toBe(2);
  });
});

describe("the streak chip's flame", () => {
  const badge = (current: number, atRisk: boolean) =>
    renderToStaticMarkup(
      createElement(StreakBadge, {
        streak: { current, longest: Math.max(current, 7), atRisk, didToday: !atRisk && current > 0 } as never,
      })
    );

  it("is the 3D flame, lit once today is spoken", () => {
    const h = badge(6, false);
    expect(h).toContain('src="/icons/3d/streak.webp"');
    expect(h).not.toContain('data-lit="false"');
    expect(h).toContain("Streak 6");
  });

  it("is the same flame greyed on an open day and at zero, the words still said", () => {
    for (const [n, risk] of [[6, true], [0, false]] as const) {
      const h = badge(n, risk);
      expect(h).toContain('src="/icons/3d/streak.webp"');
      expect(h).toContain('data-lit="false"');
      expect(h).toContain(`Streak ${n}, today&#x27;s open`);
    }
  });
});

describe("where the line glyphs went", () => {
  it("no surface that shows a streak, a freeze or a game's best draws the line glyph for it", () => {
    for (const f of [
      "components/StreakBadge.tsx",
      "components/shop/ItemArt.tsx",
      "app/games/page.tsx",
      "components/rep/BestPlaque.tsx",
      "components/Moment.tsx",
      "app/active/page.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/\bIcon(Flame|Freeze|Trophy|Bolt)\b/);
      expect(read(f), f).toMatch(/<StatIcon kind="(streak|freeze|trophy)"/);
    }
  });

  it("the line cup is gone from the set; nothing draws it", () => {
    expect(read("components/Icon.tsx")).not.toMatch(/export function IconTrophy/);
  });
});
