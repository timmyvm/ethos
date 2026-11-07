import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DimensionList } from "@/components/DimensionList";
import type { TakeAudio, TakeSpan } from "@/components/TakeAudio";
import { computeMetrics, type Pause } from "./metrics";
import { filledMoments, reportJudged, saysFilled, type JudgedPause, type PauseVerdict } from "./pause-quality";

/*
 * The Pause row's moments as the results draw them (#424, and its
 * review): a take that cannot play gives plain times and no dead
 * buttons; a take that can gives one chip per named moment, pressed
 * while its own stretch plays; the times sit on one unbroken line so
 * two 44px targets never stack; the row says "had a sound in" once; and
 * the chip's glyph wears Hear it back's terracotta.
 */
const judged = (t: number, verdict: PauseVerdict, len = 1.1): JudgedPause => ({
  t,
  len,
  kind: verdict === "hesitation" ? "mid" : "pre",
  verdict,
  note: "",
});
const TAKE: Record<string, JudgedPause[]> = {
  two: [judged(2.1, "opening", 1.2), judged(15.3, "filled"), judged(20, "hesitation", 0.9), judged(40.2, "filled", 1.3), judged(47, "landing", 1.5)],
  three: [judged(2.1, "opening", 1.2), judged(15.3, "filled"), judged(27.4, "filled", 1), judged(40.2, "filled", 1.3), judged(47, "landing", 1.5)],
  four: [judged(15.3, "filled"), judged(27.4, "filled", 1), judged(40.2, "filled", 1.3), judged(47, "landing", 1.5), judged(52.6, "filled")],
  dead: [judged(15.3, "filled"), judged(30, "dead", 4.2), judged(47, "landing", 1.5)],
};

function take(o: { playable: boolean; span?: TakeSpan | null }): TakeAudio {
  return { element: null, ref: { current: null }, playable: o.playable, span: o.span ?? null, play: () => {}, pause: () => {} };
}

/** The Pause row's detail, as DimensionList draws it with its row open. */
function row(pauses: Pause[], o: { take?: TakeAudio | null; detail?: string } = {}): string {
  const metrics = { ...computeMetrics([], 62), pauses };
  const html = renderToStaticMarkup(
    createElement(DimensionList, {
      tier1: { pause: 70, fillers: 55, repairs: 33, pace: 93, range: 66 },
      anchors: { hedgeCount: 0, restartCount: 0 },
      metrics,
      coach: null,
      pauseDetail: o.detail,
      take: o.take ?? null,
    })
  );
  // The first <details> is the Pause row; its detail is the .reveal block.
  const start = html.indexOf('class="reveal');
  return html.slice(start, html.indexOf("</details>", start));
}
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"');

/** Where the element opened at `from` closes, counting nested <span>s. */
function spanEnd(html: string, from: number): number {
  let depth = 0;
  const tag = /<(\/?)span\b[^>]*>/g;
  tag.lastIndex = from;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

describe("a take that cannot play names its moments as plain times", () => {
  for (const [name, t] of [
    ["no take", null],
    ["a take whose file would not decode", take({ playable: false })],
  ] as const) {
    it(`${name}: no buttons, the times as text`, () => {
      const html = row(TAKE.two, { take: t });
      expect(html).not.toMatch(/<button[^>]*data-pause-moment/);
      expect(html.match(/<span data-pause-moment[^>]*>0:(15|40)<\/span>/g)).toHaveLength(2);
      expect(text(html)).toContain("0:15 and 0:40 had a sound in them.");
    });
  }
});

describe("a take that can play gives each named moment a chip", () => {
  it("one button per named moment, none pressed while nothing plays", () => {
    for (const [name, n] of [["two", 2], ["three", 3], ["four", 3]] as const) {
      const html = row(TAKE[name], { take: take({ playable: true }) });
      const buttons = html.match(/<button[^>]*data-pause-moment[^>]*>/g) ?? [];
      expect(buttons, name).toHaveLength(n);
      for (const b of buttons) expect(b).toContain('aria-pressed="false"');
    }
  });

  it("presses the chip whose stretch is playing, and only that one", () => {
    const [, second] = filledMoments(TAKE.three)!.moments;
    const html = row(TAKE.three, { take: take({ playable: true, span: { from: second.from, until: second.until } }) });
    const pressed = (html.match(/<button[^>]*data-pause-moment[^>]*>/g) ?? []).map((b) => /aria-pressed="true"/.test(b));
    expect(pressed).toEqual([false, true, false]);
    expect(html).toContain(`aria-label="${second.label}" aria-pressed="true"`);
    // Its pill says so: the playing edge and the pause glyph.
    expect(html).toMatch(/data-playing="true"/g);
  });

  it("a span from Hear it back (no end) presses no chip", () => {
    const html = row(TAKE.two, { take: take({ playable: true, span: null }) });
    expect(html).not.toContain('aria-pressed="true"');
  });
});

describe("the times share one line, so two 44px targets never stack", () => {
  for (const name of ["two", "three", "four"]) {
    for (const playable of [true, false]) {
      it(`${name} moments, ${playable ? "chips" : "plain"}: every time inside one unbroken run`, () => {
        const html = row(TAKE[name], { take: take({ playable }) });
        const runs = [...html.matchAll(/<span data-moment-run[^>]*class="whitespace-nowrap"[^>]*>/g)];
        expect(runs).toHaveLength(1);
        const from = runs[0].index!;
        const to = spanEnd(html, from);
        const times = [...html.matchAll(/data-pause-moment/g)].map((m) => m.index!);
        expect(times.length).toBeGreaterThan(0);
        for (const at of times) {
          expect(at).toBeGreaterThan(from);
          expect(at).toBeLessThan(to);
        }
        // The words between the times are inside it; the predicate after it can break.
        const run = text(html.slice(from, to));
        expect(run).toMatch(name === "two" ? /^0:15 and 0:40$/ : /^0:15, 0:27(,| and) 0:40$/);
      });
    }
  }
});

describe("the row says it once", () => {
  const headline = (pauses: JudgedPause[]) => reportJudged(pauses, 62).headline!;

  it("the live results' filled headline counts them, so the moments only say where", () => {
    for (const [name, where] of [
      ["two", "At 0:15 and 0:40."],
      ["three", "At 0:15, 0:27 and 0:40."],
      ["four", "At 0:15, 0:27, 0:40 and 1 more."],
    ] as const) {
      const detail = headline(TAKE[name]);
      expect(saysFilled(detail), name).toBe(true);
      const said = text(row(TAKE[name], { take: take({ playable: true }), detail }));
      expect(said.match(/had a sound in/g), name).toHaveLength(1);
      expect(said, name).toContain(where);
    }
  });

  it("the dead-air headline says nothing of them, so the moments say it whole", () => {
    const detail = headline(TAKE.dead);
    expect(detail).toMatch(/dead air/);
    expect(saysFilled(detail)).toBe(false);
    const said = text(row(TAKE.dead, { take: take({ playable: true }), detail }));
    expect(said.match(/had a sound in/g)).toHaveLength(1);
    expect(said).toContain("0:15 had a sound in it.");
  });

  it("a stored recording's counts line says nothing of them either", () => {
    const said = text(row(TAKE.two, { take: take({ playable: true }) }));
    expect(said).toMatch(/before a sentence/);
    expect(said.match(/had a sound in/g)).toHaveLength(1);
    expect(said).toContain("0:15 and 0:40 had a sound in them.");
  });
});

describe("the chip plays in Hear it back's grammar", () => {
  it("its glyph is the tap's terracotta, as the filler chips' and the play key's are", () => {
    const html = row(TAKE.two, { take: take({ playable: true }) });
    const glyphs = html.match(/<svg[^>]*class="([^"]*)"/g) ?? [];
    expect(glyphs.length).toBeGreaterThan(0);
    for (const g of glyphs) {
      expect(g).toContain("text-terracotta-500");
      expect(g).not.toContain("--tone");
    }
    const scrubber = readFileSync(path.resolve(__dirname, "../components/AudioScrubber.tsx"), "utf8");
    expect(scrubber).toMatch(/className="text-terracotta-500"/);
    expect(scrubber).toMatch(/bg-surface text-terracotta-500/);
  });

  it("its playing edge is ink, never a trait's tone", () => {
    const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
    const rule = css.match(/\.moment-pill\[data-playing\]\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/border-color:\s*var\(--color-ink\)/);
    expect(rule?.[1]).not.toMatch(/--tone/);
  });
});
