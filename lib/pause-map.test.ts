import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LANDED_MARK, PauseBar, SEARCHING_MARK, SPEECH_MARK } from "@/components/PauseBar";
import { detectPauses, type Word } from "./metrics";
import { filledMoments, judgePauses, type JudgedPause } from "./pause-quality";

/*
 * The pause map on the numbers step (D52) is a raised `.card` that
 * follows the theme, where it used to be the one black card in the
 * light theme. Its marks are a graphic, so each holds 3:1 against the
 * card it sits on, in both themes: the speech ticks in stone-400, the
 * pauses that landed a point in sage-600, and the searching ones as an
 * ink outline. The tokens are read from app/globals.css, so a token
 * change that drops one under 3:1 fails here.
 */
const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const light = css.slice(0, css.indexOf(':root[data-theme="dark"] {'));
const dark = css.slice(css.indexOf(':root[data-theme="dark"] {'));

type RGB = [number, number, number];
/** A token's value as an opaque colour over `under` (rgba composited). */
const token = (block: string, name: string, under?: RGB): RGB => {
  const m = block.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no --color-${name}`);
  const v = m[1].trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const rgba = v.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (!rgba || !under) throw new Error(`--color-${name} is ${v}`);
  const a = Number(rgba[4]);
  return [1, 2, 3].map((i, k) => Math.round(Number(rgba[i]) * a + under[k] * (1 - a))) as RGB;
};
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("the pause map's marks on the raised card (D52)", () => {
  it("draws each mark in the token this test measures", () => {
    expect(SPEECH_MARK).toContain("bg-stone-400");
    expect(LANDED_MARK).toContain("bg-sage-600");
    expect(SEARCHING_MARK).toMatch(/border-\[1\.5px\]/);
    expect(SEARCHING_MARK).toContain("border-ink");
    const src = readFileSync(path.resolve(__dirname, "../components/PauseBar.tsx"), "utf8");
    expect(src).toMatch(/className="card /);
    expect(src).not.toMatch(/card-stage|cream/);
  });

  for (const [theme, block] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`holds 3:1 against the card in ${theme}`, () => {
      const card = token(block, "raised");
      const marks = {
        speech: token(block, "stone-400", card),
        landed: token(block, "sage-600"),
        searching: token(block, "ink"),
      };
      for (const [name, colour] of Object.entries(marks)) {
        expect(ratio(colour, card), `${name} in ${theme}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

/*
 * The map draws every held pause (review of #424). The bar holds 48
 * marks, and it used to keep the first 48 and drop the rest, so a take
 * with more than about 24 gaps lost its tail: the Pause row under it
 * named "1:16 had a sound in it." and the map ended before 1:16. Speech
 * ticks give way now, then beats, and every held pause keeps its mark,
 * hollow when it did not land, in the order it was said.
 */
describe("the pause map keeps every held pause", () => {
  /** A take at 2.5 words a second, a beat every few words and a held pause every few dozen. */
  function take(o: { words: number; beatEvery: number; heldEvery: number; fillerAtLastHeld?: boolean }) {
    const words: Word[] = [];
    let t = 0.4;
    for (let i = 0; i < o.words; i++) {
      const ends = (i + 1) % o.heldEvery === 0;
      words.push({ word: ` word${i}${ends ? "." : ""}`, start: t, end: t + 0.35 });
      t += 0.4;
      if (ends) t += 1.2;
      else if ((i + 1) % o.beatEvery === 0) t += 0.45;
    }
    const durationS = Math.round((t + 0.5) * 100) / 100;
    const pauses = detectPauses(words);
    const held = pauses.filter((p) => p.kind !== "beat");
    const last = held[held.length - 1];
    const fillers = o.fillerAtLastHeld && last ? [{ word: "um", t: last.t + last.len + 0.2 }] : [];
    return { judged: judgePauses({ pauses, words, fillers, durationS }), durationS };
  }

  /** The bar's own marks, left to right, read off the markup (the legend is outside it). */
  function marks(pauses: JudgedPause[], durationS: number, cutIns: { t: number; label: string }[] = []) {
    const html = renderToStaticMarkup(createElement(PauseBar, { pauses, durationS, marks: cutIns }));
    const bar = html.slice(html.indexOf('role="img"'), html.indexOf("</div>", html.indexOf('role="img"')));
    return [...bar.matchAll(/<span[^>]*class="([^"]*)"/g)].map(([, c]) =>
      c.includes("min-w-[8px]")
        ? c.includes("border-[1.5px]") ? "hollow" : "landed"
        : c.includes("min-w-[3px]") ? "beat" : c.includes("w-[2px] shrink-0") ? "cut-in" : "speech"
    );
  }

  it("draws the filled pause at 1:16 of an 88s take with 34 gaps", () => {
    const { judged, durationS } = take({ words: 175, beatEvery: 5, heldEvery: 30, fillerAtLastHeld: true });
    expect(durationS).toBeGreaterThan(85);
    expect(judged.filter((p) => p.kind === "beat")).toHaveLength(29);
    expect(judged.filter((p) => p.kind !== "beat")).toHaveLength(5);
    expect(filledMoments(judged)?.sentence).toBe("1:16 had a sound in it.");
    const drawn = marks(judged, durationS);
    expect(drawn.length).toBeLessThanOrEqual(48);
    expect(drawn.filter((m) => m === "landed")).toHaveLength(4);
    expect(drawn.filter((m) => m === "hollow")).toHaveLength(1);
    // The hollow mark is the last held pause, the one at 1:16.
    expect(drawn.filter((m) => m === "landed" || m === "hollow").at(-1)).toBe("hollow");
  });

  const takes = [
    { words: 60, beatEvery: 6, heldEvery: 12 },
    { words: 150, beatEvery: 5, heldEvery: 20, fillerAtLastHeld: true },
    { words: 200, beatEvery: 5, heldEvery: 30, fillerAtLastHeld: true },
    { words: 225, beatEvery: 3, heldEvery: 9, fillerAtLastHeld: true },
    { words: 450, beatEvery: 4, heldEvery: 25, fillerAtLastHeld: true },
    { words: 700, beatEvery: 7, heldEvery: 40, fillerAtLastHeld: true },
  ];
  for (const o of takes) {
    it(`draws every held pause in order: ${o.words} words, a held pause every ${o.heldEvery}`, () => {
      const { judged, durationS } = take(o);
      const held = judged.filter((p) => p.kind !== "beat");
      const drawn = marks(judged, durationS, [{ t: durationS * 0.9, label: "Says who?" }]);
      expect(drawn.length).toBeLessThanOrEqual(48);
      // Every held pause, landed or hollow as it was judged, in the order said.
      expect(drawn.filter((m) => m === "landed" || m === "hollow")).toEqual(
        held.map((p) => (p.verdict === "landing" || p.verdict === "opening" ? "landed" : "hollow"))
      );
      // Every filled pause the Pause row names is hollow on the map.
      expect(drawn.filter((m) => m === "hollow").length).toBeGreaterThanOrEqual(judged.filter((p) => p.verdict === "filled").length);
      // The cut-in late in the take keeps its rule, and the take keeps its last speech.
      expect(drawn).toContain("cut-in");
      expect(drawn[drawn.length - 1]).toBe("speech");
      // A run of speech still stands between two held pauses wherever the bar has room for one.
      const heldAt = drawn.flatMap((m, i) => (m === "landed" || m === "hollow" ? [i] : []));
      if (2 * held.length + 2 <= 48) {
        for (let k = 1; k < heldAt.length; k++) expect(heldAt[k] - heldAt[k - 1]).toBeGreaterThan(1);
      }
    });
  }

  it("leaves a short take's map exactly as it was", () => {
    const { judged, durationS } = take({ words: 40, beatEvery: 6, heldEvery: 12 });
    const drawn = marks(judged, durationS);
    expect(drawn.length).toBeLessThan(48);
    expect(drawn.filter((m) => m === "beat")).toHaveLength(judged.filter((p) => p.kind === "beat").length);
  });
});
