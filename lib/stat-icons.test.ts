import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readTones, statTonesModule } from "@/components/icons/flat/export";
import { STAT_FLAT_KINDS } from "@/components/icons/flat/stat-drawings";
import { StatIcon } from "@/components/StatIcon";
import { StreakBadge } from "@/components/StreakBadge";
import { STAT_FLAT_KIND, STAT_KINDS } from "./stat-icons";

/*
 * The stat icons: every count's mark is a flat drawing, inline. Each kind
 * names a drawing in the flat set; no file is fetched for one; an unlit
 * streak is the same drawing in its grey tones (never a filter), firmer
 * under Increase Contrast; and the component never moves the page or
 * speaks over the count beside it. The greys' own numbers (3:1 on the
 * chip, 30 under the lit flame in Greyscale) are lib/flat-icons.test.ts's.
 */
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const html = (props: Parameters<typeof StatIcon>[0]) => renderToStaticMarkup(createElement(StatIcon, props));

describe("the stat kinds", () => {
  it("each is a drawing in the flat set; a game's best is the best's cup", () => {
    for (const kind of STAT_KINDS) expect(STAT_FLAT_KINDS, kind).toContain(STAT_FLAT_KIND[kind]);
    expect(STAT_FLAT_KIND.trophy).toBe("best");
    // Every flat stat drawing is reached by some kind.
    expect(new Set(Object.values(STAT_FLAT_KIND))).toEqual(new Set(STAT_FLAT_KINDS));
  });

  it("no file is left for them: the 3D cuts, their large flame and their warm-up are gone", () => {
    expect(existsSync(join(root, "public/icons/3d"))).toBe(false);
    expect(existsSync(join(root, "scripts/cut-stat-icons.mjs"))).toBe(false);
    const lib = read("lib/stat-icons.ts");
    expect(lib).not.toMatch(/STAT_ICON_(SRC|PX|MAX_BYTES|LARGE)|warmLargeStatIcon/);
    expect(read("app/rep/page.tsx")).not.toMatch(/warmLargeStatIcon/);
    expect(read("public/sw.js")).not.toMatch(/\/icons\/3d\//);
  });
});

describe("StatIcon", () => {
  it("is an inline drawing at its own size: no image, no shift, nothing said over the count", () => {
    const h = html({ kind: "xp", size: 24 });
    expect(h).not.toMatch(/<img\b/);
    expect(h.match(/<svg /g)?.length).toBe(1);
    expect(h).toContain('viewBox="0 0 96 96"');
    expect(h).toContain('width="24"');
    expect(h).toContain('height="24"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('data-kind="xp"');
    expect(h).toMatch(/class="fi stat-icon"/);
    expect(h).not.toContain("data-lit");
  });

  it("draws each kind as its flat drawing, the trophy as the cup", () => {
    for (const kind of STAT_KINDS) expect(html({ kind }), kind).toContain(`data-kind="${STAT_FLAT_KIND[kind]}"`);
    expect(html({ kind: "trophy" })).toBe(html({ kind: "best" }));
  });

  it("keeps a caller's class beside its own", () => {
    expect(html({ kind: "freeze", size: 24, className: "home-freeze-mark" })).toContain('class="fi stat-icon home-freeze-mark"');
  });

  it("unlit is the same drawing, marked for its grey tones", () => {
    const lit = html({ kind: "streak" });
    const unlit = html({ kind: "streak", lit: false });
    expect(unlit).toContain('data-lit="false"');
    // The same shapes and roles: only the mark, the ids and each fill's fallback hex (lit or unlit) differ.
    const shapes = (s: string) =>
      s.replace(/ data-lit="false"/, "").replace(/id="[^"]*"|url\(#[^)]*\)/g, "").replace(/, #[0-9a-f]{6}\)/g, ")");
    expect(shapes(unlit)).toBe(shapes(lit));
  });

  it("drops the light under 24px and keeps it from there up (the size ladder)", () => {
    expect(html({ kind: "streak", size: 20 })).not.toContain('data-part="light"');
    expect(html({ kind: "streak", size: 24 })).toContain('data-part="light"');
    expect(html({ kind: "streak", size: 380 })).toContain('data-part="light"');
  });

  /* The light is drawn by the size a caller passes, so CSS that shows the
     mark smaller must not take it under 24 when the prop drew a light:
     the short best plaque showed its 30px cup at 22 with the light still
     on it, a 2px pale pill (#516 review). */
  it("the best plaque's cup keeps 24px or more wherever it is shown with its light", () => {
    const prop = Number(read("components/rep/BestPlaque.tsx").match(/<StatIcon kind="trophy" size=\{(\d+)\} \/>/)?.[1]);
    expect(prop).toBeGreaterThanOrEqual(24);
    expect(html({ kind: "trophy", size: prop })).toContain('data-part="light"');
    const css = read("app/globals.css");
    const shown = [...css.matchAll(/\.best-plaque-mark > \.stat-icon[^{]*\{\s*width: (\d+)px;\s*height: (\d+)px;/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(shown.length).toBeGreaterThanOrEqual(2); // the plaque's own, and under 700pt tall
    for (const [w, h] of shown) {
      expect(w).toBeGreaterThanOrEqual(24);
      expect(h).toBe(w);
    }
  });

  /* Offline before the worker kept the page's CSS (#516 review), the 3D
     files kept their colours and the inline marks drew black: a fill was
     only `var(--fi-...)`. Each fill now carries its hex as the fallback,
     read from flat-icons.css (stat-tones.ts, generated), lit or unlit. */
  it("keeps its colours without the stylesheet: each fill falls back to its own hex, lit and unlit", () => {
    const css = read("components/icons/flat/flat-icons.css");
    expect(statTonesModule(css)).toBe(read("components/icons/flat/stat-tones.ts"));
    const lit = readTones(css);
    const unlit = readTones(css, '.fi[data-lit="false"]');
    for (const kind of STAT_KINDS) {
      const flat = STAT_FLAT_KIND[kind];
      for (const [on, tones] of [[true, lit], [false, unlit]] as const) {
        const fills = [...html({ kind, lit: on, size: 40 }).matchAll(/ fill="([^"]*)"/g)].map((m) => m[1]);
        expect(fills.length, kind).toBeGreaterThan(1);
        for (const f of fills) {
          const m = f.match(/^var\((--fi-[\w-]+), (#[0-9a-f]{6})\)$/);
          expect(m, `${kind} ${on ? "lit" : "unlit"}: ${f}`).not.toBeNull();
          expect(m![1].startsWith(`--fi-${flat}-`), f).toBe(true);
          expect(m![2], f).toBe(tones.get(m![1]));
        }
      }
    }
  });

  it("still takes `large` from a caller written for the 3D set, and draws the same", () => {
    expect(html({ kind: "streak", size: 380, large: true })).toBe(html({ kind: "streak", size: 380 }));
  });

  it("is greyed by its tones, never a filter: the 3D set's filter rules are gone", () => {
    const css = read("app/globals.css");
    expect(css).not.toMatch(/--stat-unlit/);
    expect(css).not.toMatch(/\.stat-icon\[data-lit="false"\]/);
    const flat = read("components/icons/flat/flat-icons.css");
    expect(flat).not.toMatch(/filter\s*:/);
  });

  /*
   * Increase Contrast moves the neutrals in #448's block (app/globals.css):
   * darker ink in light, brighter in dark. The unlit greys move with them,
   * in a block of their own beside the greys they restate, for every role
   * a stat names.
   */
  it("firms its unlit greys under Increase Contrast, with the stone ink: darker in light, brighter in dark", () => {
    const flat = read("components/icons/flat/flat-icons.css");
    const at = flat.indexOf("@media (prefers-contrast: more) {");
    expect(at).toBeGreaterThan(0);
    const more = flat.slice(at);
    const vars = (src: string, selector: string) => {
      const i = src.indexOf(`${selector} {`);
      expect(i, selector).toBeGreaterThanOrEqual(0);
      const body = src.slice(src.indexOf("{", i) + 1, src.indexOf("}", i));
      return new Map([...body.matchAll(/(--fi-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    };
    const grey = (c: string) => {
      const n = parseInt(c.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const UNLIT = '.fi[data-lit="false"]';
    const DARK = ':root[data-theme="dark"] .fi[data-lit="false"]';
    const plain = { light: vars(flat.slice(0, at), `\n${UNLIT}`), dark: vars(flat.slice(0, at), DARK) };
    const firm = { light: vars(more, `  ${UNLIT}`), dark: vars(more, DARK) };
    for (const theme of ["light", "dark"] as const) {
      expect([...firm[theme].keys()].sort(), theme).toEqual([...plain[theme].keys()].sort());
      for (const [key, value] of plain[theme]) {
        const moved = grey(firm[theme].get(key)!) - grey(value);
        if (theme === "light") expect(moved, `${theme} ${key}`).toBeLessThan(0);
        else expect(moved, `${theme} ${key}`).toBeGreaterThan(0);
      }
    }
    // Dark: the unlit flame stands clear of the lit one in Greyscale, on the bright side.
    const litFlame = grey(vars(flat, "\n.fi").get("--fi-streak-base")!);
    expect(grey(firm.dark.get("--fi-streak-base")!) - litFlame).toBeGreaterThanOrEqual(30);
    expect(litFlame - grey(firm.light.get("--fi-streak-base")!)).toBeGreaterThanOrEqual(30);
  });
});

describe("the streak chip's flame", () => {
  const badge = (current: number, atRisk: boolean) =>
    renderToStaticMarkup(
      createElement(StreakBadge, {
        streak: { current, longest: Math.max(current, 7), atRisk, didToday: !atRisk && current > 0 } as never,
      })
    );

  it("is the flat flame, lit once today is spoken", () => {
    const h = badge(6, false);
    expect(h).toContain('data-kind="streak"');
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
      expect(h).toContain('data-kind="streak"');
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

  /* #500: Hostile Q&A and the weekly boss lead their rows on Today with
     their marks, 72px (56 under 360), where the shield and the stopwatch
     stood on two tinted tiles. Never unlit: the done state is the line's
     words. No pool under them since the flat set. */
  it("Today's two rows wear the modes' marks, lit, at 72 and 56 under 360, with no pool", () => {
    const rows = read("components/home/ModeRows.tsx");
    expect(rows).not.toMatch(/\bIcon(Boss|Stopwatch)\b/);
    expect(rows).toContain("<StatIcon kind={t.id} size={72} />");
    expect(rows).not.toMatch(/lit=\{/);
    const css = read("app/globals.css");
    expect(css).toMatch(/\.home-mode \{\n  --mark: 72px;/);
    expect(css).toMatch(/@media \(max-width: 359px\) \{\n  \.home-mode \{\n    --mark: 56px;/);
    expect(css).not.toMatch(/\.home-mode-art::before/);
    const practice = read("app/games/page.tsx");
    expect(practice).toMatch(/hostile: \(s\) => <StatIcon kind="hostile" size=\{s\} \/>/);
    expect(practice).not.toMatch(/\bIconBoss\b/);
  });

  it("the line cup is gone from the set; nothing draws it", () => {
    expect(read("components/Icon.tsx")).not.toMatch(/export function IconTrophy/);
  });
});
