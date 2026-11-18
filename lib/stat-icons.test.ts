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

  /*
   * With the hue gone, lightness is the only thing that tells an open
   * day's flame from a spoken day's, and it has to survive the phone's
   * Greyscale filter (#453: colour is never the only sign; the chip's
   * "today's open" is for a screen reader only). The review found the
   * first grey at 162 of 255 against the lit flame's 146 on the light
   * chip: the same flame in Greyscale. This applies each theme's filter
   * the way Chrome does (sRGB, left to right; it reproduces the browser's
   * own readings to the unit), over the chip's ground, and reads the
   * mean lightness of the flame's body.
   */
  it("an open day's flame stays apart from a lit one in Greyscale, in both themes and under Increase Contrast", async () => {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(pub(STAT_ICON_SRC.streak))
      .resize(96, 96)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const css = read("app/globals.css");
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    /* A lit flame stands on the earned chip, sage-100; an unlit one on
       the surface step since #495 (neutral until today is spoken). */
    const [chipLight, chipDark] = [...css.matchAll(/--color-sage-100:\s*(#[0-9a-f]{6});/gi)].map((m) => rgb(m[1]));
    const [openLight, openDark] = [...css.matchAll(/--color-surface:\s*(#[0-9a-f]{6});/gi)].map((m) => rgb(m[1]));
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    /** Mean Greyscale lightness (0 to 255) of the flame's body through `filter`, over `ground`. */
    const lightness = (filter: string, ground: number[]) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 250) continue;
        let [r, g, b] = [data[i], data[i + 1], data[i + 2]].map((v) => v / 255);
        let a = data[i + 3] / 255;
        for (const [, fn, arg] of filter.matchAll(/([a-z-]+)\(([\d.]+)\)/g)) {
          const x = Number(arg);
          if (fn === "grayscale") {
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            [r, g, b] = [r, g, b].map((v) => y * x + v * (1 - x));
          } else if (fn === "brightness") [r, g, b] = [r, g, b].map((v) => clamp(v * x));
          else if (fn === "contrast") [r, g, b] = [r, g, b].map((v) => clamp((v - 0.5) * x + 0.5));
          else if (fn === "opacity") a *= x;
          else throw new Error(`no model for ${fn}`);
        }
        const [cr, cg, cb] = [r, g, b].map((v, k) => v * a + ground[k] * (1 - a));
        sum += 255 * (0.2126 * cr + 0.7152 * cg + 0.0722 * cb);
        n++;
      }
      return sum / n;
    };
    const values = [...css.matchAll(/--stat-unlit: ([^;]+);/g)].map((m) => m[1]);
    const at = css.indexOf("@media (prefers-contrast: more) {");
    const more = [...css.slice(at).matchAll(/--stat-unlit: ([^;]+);/g)].map((m) => m[1]);
    const [light, dark, darkOs] = values;
    expect(darkOs).toBe(dark);
    const cases: [string, string, number[], number[]][] = [
      ["light", light, chipLight, openLight],
      ["dark", dark, chipDark, openDark],
      ["light, more contrast", more[0], chipLight, openLight],
      ["dark, more contrast", more[1], chipDark, openDark],
    ];
    for (const [name, filter, ground, open] of cases) {
      const lit = lightness("", ground);
      const unlit = lightness(filter, open);
      expect(Math.abs(unlit - lit), `${name}: lit ${lit.toFixed(0)}, unlit ${unlit.toFixed(0)}`).toBeGreaterThanOrEqual(30);
    }
    // Light: darker than lit, as the chip's stone ink is; firmer still under more contrast.
    expect(lightness(light, openLight)).toBeLessThan(lightness("", chipLight));
    expect(lightness(more[0], openLight)).toBeLessThan(lightness(light, openLight));
    // Dark: dimmer than lit, so it never reads lit beside the white number;
    // under more contrast it moves the way the stone ink does there, brighter.
    expect(lightness(dark, openDark)).toBeLessThan(lightness("", chipDark));
    expect(lightness(more[1], openDark)).toBeGreaterThan(lightness("", chipDark));
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

  /* #495, the morning tour: the chip stood in sage, the earned wash, on a
     day not yet spoken, holding the unlit flame. Neutral until today is
     spoken, then sage with the lit flame. */
  it("sits on the neutral surface until today is spoken, then on the sage wash", () => {
    expect(badge(6, true)).toContain('data-open="true"');
    expect(badge(6, false)).not.toContain('data-open="true"');
    const sheet = read("app/globals.css");
    const at = sheet.indexOf('.today-earned[data-open="true"] {');
    expect(at).toBeGreaterThan(0);
    const rule = sheet.slice(at, sheet.indexOf("}", at));
    expect(rule).toContain("background: var(--color-surface);");
    expect(rule).not.toMatch(/sage/);
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

  /* #503: Hostile Q&A and the weekly boss wear their 3D marks on Today's
     two tiles, and Hostile's on Practice's tile, where the shield and the
     stopwatch stood. The marks stay at a name's side, never a standing
     object (#478: only the card stands one). */
  it("Today's two tiles and Practice's Hostile tile wear the modes' 3D marks, at a name's size", () => {
    const tiles = read("components/home/ModeTiles.tsx");
    expect(tiles).not.toMatch(/\bIcon(Boss|Stopwatch)\b/);
    expect(tiles).toMatch(/<StatIcon kind="hostile" size=\{MARK\} \/>/);
    expect(tiles).toMatch(/<StatIcon kind="boss" size=\{MARK\} \/>/);
    expect(Number(tiles.match(/const MARK = (\d+);/)![1])).toBeLessThanOrEqual(24);
    const practice = read("app/games/page.tsx");
    expect(practice).toMatch(/hostile: \(s\) => <StatIcon kind="hostile" size=\{s\} \/>/);
    expect(practice).not.toMatch(/\bIconBoss\b/);
  });

  it("the line cup is gone from the set; nothing draws it", () => {
    expect(read("components/Icon.tsx")).not.toMatch(/export function IconTrophy/);
  });
});
