import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudioScrubber } from "@/components/AudioScrubber";
import { LANDED_MARK, PauseBar } from "@/components/PauseBar";
import type { TakeAudio } from "@/components/TakeAudio";
import type { Pause } from "./metrics";
import { heldPauseMarks, landedPause, PAUSE_MARK_WORDS, pauseMark, type MarkedPause } from "./pause-mark";
import type { PauseVerdict } from "./pause-quality";

/*
 * One mark rule for the take's pauses on both steps (DECISIONS #424):
 * the pause map on the numbers step and Hear it back's track on the
 * words step. Sage follows the verdict the take stored, so a pause
 * before a sentence that the Pause row calls filled is never drawn as
 * earned; a row from before verdicts keeps the kind check both
 * drawings always had. Nothing here judges a pause.
 */
const VERDICTS: PauseVerdict[] = ["landing", "opening", "hesitation", "filled", "dead", "beat"];

describe("the mark rule", () => {
  it("marks a judged pause by its verdict, whatever its kind", () => {
    for (const kind of ["pre", "mid"] as const) {
      for (const verdict of VERDICTS) {
        const expected = verdict === "landing" || verdict === "opening" ? "landed" : "searching";
        expect(pauseMark({ kind, verdict }), `${kind} ${verdict}`).toBe(expected);
        expect(landedPause({ kind, verdict })).toBe(expected === "landed");
      }
    }
  });

  it("never draws a filled pause before a sentence as earned", () => {
    expect(pauseMark({ kind: "pre", verdict: "filled" })).toBe("searching");
    expect(pauseMark({ kind: "pre", verdict: "dead" })).toBe("searching");
    expect(pauseMark({ kind: "pre", verdict: "hesitation" })).toBe("searching");
  });

  it("marks a pause recorded before verdicts by its kind, as before", () => {
    expect(pauseMark({ kind: "pre" })).toBe("landed");
    expect(pauseMark({ kind: "mid" })).toBe("searching");
  });

  it("counts held pauses by mark, leaving beats out", () => {
    const pauses: MarkedPause[] = [
      { kind: "pre", verdict: "opening" },
      { kind: "pre", verdict: "filled" },
      { kind: "mid", verdict: "hesitation" },
      { kind: "mid", verdict: "filled" },
      { kind: "pre", verdict: "landing" },
      { kind: "beat", verdict: "beat" },
      { kind: "beat" },
    ];
    expect(heldPauseMarks(pauses)).toEqual({ held: 5, landed: 2, searching: 3 });
    expect(heldPauseMarks([{ kind: "pre" }, { kind: "mid" }, { kind: "beat" }])).toEqual({ held: 2, landed: 1, searching: 1 });
    expect(heldPauseMarks([])).toEqual({ held: 0, landed: 0, searching: 0 });
  });
});

/* Both drawings, rendered. */
const p = (t: number, kind: Pause["kind"], verdict?: PauseVerdict, len = 1.1): Pause & MarkedPause => ({ t, len, kind, ...(verdict ? { verdict } : {}) });
/** Two filled: one before a sentence (drawn sage by its kind until #424's last line), one mid-sentence. */
const TWO_FILLED = [p(2.1, "pre", "opening", 1.2), p(20, "mid", "hesitation", 0.9), p(27.4, "pre", "filled", 1), p(36.8, "mid", "filled", 1), p(47, "pre", "landing", 1.5)];
const CLEAN = [p(2.1, "pre", "opening", 1.2), p(20, "mid", "hesitation", 0.9), p(30.2, "pre", "landing", 1.3), p(47, "pre", "landing", 1.5)];
const UNJUDGED = [p(6, "pre"), p(17, "mid"), p(28, "pre"), p(39, "beat", undefined, 0.5)];

const take: TakeAudio = { element: null, ref: { current: null }, playable: true, span: null, play: () => {}, pause: () => {} };
function scrubber(pauses: (Pause & MarkedPause)[], marks: { t: number; label: string }[] = []) {
  return renderToStaticMarkup(createElement(AudioScrubber, { take, durationS: 62, fillers: [{ word: "um", t: 10 }], pauses, marks }));
}
/** The track's bands, left to right, as [second, mark, sage?]. */
function bands(html: string) {
  return [...html.matchAll(/<span[^>]*data-pause-mark="(\w+)"[^>]*class="([^"]*)"[^>]*style="left:([\d.]+)%/g)].map(([, mark, cls, left]) => [
    Math.round(Number(left) * 0.62 * 10) / 10,
    mark,
    cls.includes("sage"),
  ]);
}
const legend = (html: string) => {
  const head = html.slice(0, html.indexOf('type="range"'));
  return [...head.matchAll(/<span class="inline-flex items-center gap-1">.*?<\/span><\/span>([^<]+)<\/span>/g)].map((m) => m[1]);
};

describe("Hear it back's track marks pauses as the pause map does", () => {
  it("draws a filled pause before a sentence in the neutral mark, and only landings in sage", () => {
    expect(bands(scrubber(TWO_FILLED))).toEqual([
      [2.1, "landed", true],
      [20, "searching", false],
      [27.4, "searching", false],
      [36.8, "searching", false],
      [47, "landed", true],
    ]);
  });

  it("names its marks in the pause map's words", () => {
    expect(legend(scrubber(TWO_FILLED))).toEqual(["filler", PAUSE_MARK_WORDS.landed, PAUSE_MARK_WORDS.searching]);
    const map = renderToStaticMarkup(createElement(PauseBar, { pauses: TWO_FILLED, durationS: 62 }));
    expect(map).toContain(`>${PAUSE_MARK_WORDS.landed}</span>`);
    expect(map).toContain(`>${PAUSE_MARK_WORDS.searching}</span>`);
    expect(map).toContain(`aria-label="5 held pauses, 2 landed a point"`);
  });

  it("keys only the marks the take has", () => {
    const allLanded = [p(2.1, "pre", "opening"), p(30, "pre", "landing")];
    expect(legend(scrubber(allLanded))).toEqual(["filler", PAUSE_MARK_WORDS.landed]);
    const noneLanded = [p(12, "pre", "filled"), p(30, "mid", "hesitation")];
    expect(legend(scrubber(noneLanded))).toEqual(["filler", PAUSE_MARK_WORDS.searching]);
  });

  it("draws a clean take as it always did", () => {
    expect(bands(scrubber(CLEAN)).map(([t, , sage]) => [t, sage])).toEqual([
      [2.1, true],
      [20, false],
      [30.2, true],
      [47, true],
    ]);
  });

  it("draws a row from before verdicts by its kind, beats left off the track", () => {
    expect(bands(scrubber(UNJUDGED))).toEqual([
      [6, "landed", true],
      [17, "searching", false],
      [28, "landed", true],
    ]);
  });

  it("agrees with the pause map, pause for pause", () => {
    const map = renderToStaticMarkup(createElement(PauseBar, { pauses: TWO_FILLED, durationS: 62 }));
    const bar = map.slice(map.indexOf('role="img"'), map.indexOf("</div>", map.indexOf('role="img"')));
    const mapMarks = [...bar.matchAll(/<span[^>]*class="([^"]*min-w-\[8px\][^"]*)"/g)].map(([, c]) => (c.includes(LANDED_MARK) ? "landed" : "searching"));
    expect(mapMarks).toEqual(bands(scrubber(TWO_FILLED)).map(([, mark]) => mark));
  });

  it("keeps the round's cut-in on the track and in its chips", () => {
    const html = scrubber(TWO_FILLED, [{ t: 24.2, label: "Says who?" }]);
    expect(legend(html)[0]).toBe("cut-in");
    expect(html).toMatch(/class="absolute top-0 h-full w-\[3px\] bg-ink\/70" style="left:39\.0322/);
    expect(html).toContain('aria-label="Says who? 0:24, play from a second before Demos cut in"');
  });
});
