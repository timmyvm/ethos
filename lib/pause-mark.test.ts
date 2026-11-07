import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudioScrubber, BAND_MIN, PAUSE_MARK, PLAYHEAD, PLAYHEAD_ON_LANDED } from "@/components/AudioScrubber";
import { LANDED_MARK, PauseBar } from "@/components/PauseBar";
import type { TakeAudio } from "@/components/TakeAudio";
import type { Pause } from "./metrics";
import { heldPauseMarks, landedAt, LANDED_MIN_PX, landedPause, PAUSE_MARK_WORDS, pauseMark, PLAYHEAD_PX, type MarkedPause } from "./pause-mark";
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

/*
 * Landed pauses read on the track (#425, Timothy's "yeah do it"): a
 * well-held pause was a 40% sage wash, about 1.5:1 on the sand beside
 * the solid filler ticks. Now it is the pause map's own solid sage, the
 * searching band stays a quiet stone, no band is under 4px, and the key
 * wears the band's own class. Their contrast is measured from the tokens
 * in lib/today-colour.test.ts.
 */
describe("Hear it back's landed pauses read (#425)", () => {
  /** Every span on the track, in order, as [kind, class]. */
  function track(html: string) {
    const bar = html.slice(html.indexOf('class="relative h-8 overflow-hidden bg-sand"'), html.indexOf("<input"));
    return [...bar.matchAll(/<span([^>]*)class="([^"]*)"/g)].map(([, attrs, cls]) => {
      const mark = attrs.match(/data-pause-mark="(\w+)"/)?.[1];
      return [mark ?? (attrs.includes("data-playhead") ? "playhead" : cls.includes("var(--tone)") ? "filler" : "cut-in"), cls] as const;
    });
  }
  /** The legend's swatches, as [word, the swatch's mark class]. */
  function keys(html: string) {
    const head = html.slice(0, html.indexOf('type="range"'));
    return [...head.matchAll(/<span class="inline-flex items-center gap-1"><span aria-hidden="true" class="[^"]*"><span class="([^"]*)"><\/span><\/span>([^<]+)<\/span>/g)].map(
      ([, cls, word]) => [word, cls] as const
    );
  }

  it("draws a landed pause in the pause map's solid sage, a searching one in the quiet stone it was", () => {
    expect(PAUSE_MARK.landed).toBe(LANDED_MARK);
    expect(PAUSE_MARK.landed).toBe("bg-sage-600");
    // The review of #425: /35 at 4px made a long take's track busy; the
    // searching stone is the /30 it was before #425.
    expect(PAUSE_MARK.searching).toBe("bg-stone-400/30");
    const bands = track(scrubber(TWO_FILLED)).filter(([k]) => k === "landed" || k === "searching");
    expect(bands.map(([k]) => k)).toEqual(["landed", "searching", "searching", "searching", "landed"]);
    for (const [kind, cls] of bands) {
      expect(cls).toBe(kind === "landed" ? `absolute top-0 h-full ${BAND_MIN} ${PAUSE_MARK.landed}` : `absolute top-0 h-full ${PAUSE_MARK.searching}`);
    }
  });

  it("keeps a landed band at full height and 4px at least, from its own second", () => {
    expect(BAND_MIN).toBe("min-w-[4px]");
    expect(BAND_MIN).toBe(`min-w-[${LANDED_MIN_PX}px]`);
    // A 0.4s landing on a 62s take: 0.65% wide, about 1.3px on a phone.
    const html = scrubber([p(30, "pre", "landing", 0.4)]);
    expect(html).toMatch(/data-pause-mark="landed" class="absolute top-0 h-full min-w-\[4px\] bg-sage-600" style="left:48\.387\d*%;width:0\.645\d*%"/);
  });

  it("draws a searching band to the take's own scale, with no floor (the review of #425)", () => {
    // The same 0.4s, searching: 0.65% of the track and nothing more, so
    // ten short searching pauses on a 90s take stay hairlines.
    const html = scrubber([p(30, "mid", "hesitation", 0.4)]);
    expect(html).toMatch(/data-pause-mark="searching" class="absolute top-0 h-full bg-stone-400\/30" style="left:48\.387\d*%;width:0\.645\d*%"/);
    const quiet = track(scrubber(TWO_FILLED)).filter(([k]) => k === "searching");
    expect(quiet.length).toBe(3);
    for (const [, cls] of quiet) expect(cls).not.toContain("min-w");
  });

  it("draws a row from before verdicts by its kind at the same strength", () => {
    const bands = track(scrubber(UNJUDGED)).filter(([k]) => k === "landed" || k === "searching");
    expect(bands.map(([k]) => k)).toEqual(["landed", "searching", "landed"]);
    expect(bands[0][1]).toContain("bg-sage-600");
    expect(bands[1][1]).toBe("absolute top-0 h-full bg-stone-400/30");
  });

  it("keys each pause with its band's own class", () => {
    const k = Object.fromEntries(keys(scrubber(TWO_FILLED)));
    expect(k[PAUSE_MARK_WORDS.landed]).toBe(`absolute inset-0 ${PAUSE_MARK.landed}`);
    expect(k[PAUSE_MARK_WORDS.searching]).toBe(`absolute inset-0 ${PAUSE_MARK.searching}`);
  });

  it("leaves the fillers, the cut-in and the playhead as they were", () => {
    const marks = track(scrubber(TWO_FILLED, [{ t: 24.2, label: "Says who?" }]));
    expect(marks.find(([k]) => k === "filler")?.[1]).toBe("absolute top-0 h-full w-[3px] bg-[var(--tone)]");
    expect(marks.find(([k]) => k === "cut-in")?.[1]).toBe("absolute top-0 h-full w-[3px] bg-ink/70");
    // At 0:00 the playhead is the plain 2px ink rule it always was.
    expect(marks.at(-1)).toEqual(["playhead", `absolute top-0 h-full w-[2px] ${PLAYHEAD}`]);
    expect(marks.at(-1)?.[1]).toContain(`w-[${PLAYHEAD_PX}px]`);
    expect(PLAYHEAD).toBe("bg-ink");
    // Inside a landed band, only the dark theme's ink changes.
    expect(PLAYHEAD_ON_LANDED).toBe("bg-ink dark:bg-ground");
  });

  it("knows when the playhead stands in a pause that landed, by the same rule", () => {
    const pauses = [p(2, "pre", "opening", 1.2), p(10, "pre", "filled", 1), p(20, "mid", "hesitation", 1), p(30, "pre"), p(40, "beat", undefined, 0.5)];
    expect(landedAt(pauses, 2)).toBe(true);
    expect(landedAt(pauses, 2.6)).toBe(true);
    expect(landedAt(pauses, 3.19)).toBe(true);
    // [start, end): at its last second the playhead has left the band (the review of #425).
    expect(landedAt(pauses, 3.2)).toBe(false);
    expect(landedAt(pauses, 3.3)).toBe(false);
    expect(landedAt(pauses, 10.5)).toBe(false); // filled before a sentence: not earned
    expect(landedAt(pauses, 20.5)).toBe(false);
    expect(landedAt(pauses, 30.5)).toBe(true); // no verdict: by its kind
    expect(landedAt(pauses, 40.2)).toBe(false); // beats are never drawn
    expect(landedAt([], 1)).toBe(false);
  });
});

/*
 * The review of #425: the playhead's colour was decided by the pause's
 * seconds, measured from the playhead's left edge, but a landed band is
 * drawn 4px at least and the playhead is 2px wide. On a 90s take at
 * 320 a 0.8s landing is 1.19px of seconds drawn 4px wide, so for most
 * of its width the playhead's centre stood on the sage in the light ink
 * at 2.25:1 in dark, and at a band's last second the near-black stood
 * on the dark sand at 1.49:1. Now the band is the one drawn and what
 * stands on it is the playhead's centre.
 */
describe("the playhead stands in a landing as the track draws it (the review of #425)", () => {
  const take = [
    p(2.1, "pre", "opening", 1.2),
    p(35, "pre", "landing", 1.4),
    p(48, "mid", "hesitation", 0.8),
    p(61, "pre", "landing", 0.8),
    p(67, "mid", "hesitation", 0.9),
    p(75, "pre", "landing", 1.6),
  ];
  // The track's scale: a 90s take on a 320 phone's 134px track, and on a 390 phone's 204px.
  const at320 = 90 / 134;
  const at390 = 90 / 204;
  /** The playhead's centre px and the band's drawn px, as the browser lays them out. */
  const drawnOn = (t: number, pause: Pause, trackPx: number, durationS = 90) => {
    const x = (s: number) => (s / durationS) * trackPx;
    const centre = x(t) + PLAYHEAD_PX / 2;
    return centre >= x(pause.t) && centre < x(pause.t) + Math.max(x(pause.len), LANDED_MIN_PX);
  };

  it("holds the dark ink across a short landing widened to 4px, at 320", () => {
    // The review's stops: the centre still inside the drawn band, past the pause's 0.8s.
    for (const t of [61.9, 62.1, 62.4, 62.8]) {
      expect(landedAt(take, t, at320), `${t}s`).toBe(true);
      expect(landedAt(take, t), `${t}s by seconds alone`).toBe(false);
    }
    // Drawn [61.0s, 63.69s); the centre is 1px (0.67s) right of t.
    expect(landedAt(take, 60.3, at320)).toBe(false);
    expect(landedAt(take, 60.35, at320)).toBe(true);
    expect(landedAt(take, 63.0, at320)).toBe(true);
    expect(landedAt(take, 63.05, at320)).toBe(false);
  });

  it("holds it at 390 too, where the review read 2.22 to 2.24:1", () => {
    for (const t of [60.7, 61.9, 62.1]) expect(landedAt(take, t, at390), `${t}s`).toBe(true);
    expect(landedAt(take, 60.5, at390)).toBe(false);
    expect(landedAt(take, 62.35, at390)).toBe(false);
  });

  it("lets it go where a long landing's sage ends, so the near-black never stands on the sand past it", () => {
    // 75.0s, 1.6s: 3.6px at 390, drawn 4px, to 76.76s.
    expect(landedAt(take, 76.3, at390)).toBe(true);
    for (const t of [76.55, 76.6, 76.7]) expect(landedAt(take, t, at390), `${t}s`).toBe(false);
    // A landing wider than 4px is drawn to its own seconds: 1.5s of a 62s take is 4.9px of 204.
    const own = [p(47, "pre", "landing", 1.5)];
    expect(landedAt(own, 48.19, 62 / 204)).toBe(true);
    expect(landedAt(own, 48.21, 62 / 204)).toBe(false);
  });

  it("agrees with the drawn geometry at every tenth of a second, at both widths", () => {
    for (const [trackPx, spp] of [[134, at320], [204, at390]] as const) {
      for (let i = 0; i <= 900; i++) {
        const t = i / 10;
        const drawn = take.filter((q) => landedPause(q)).some((q) => drawnOn(t, q, trackPx));
        expect(landedAt(take, t, spp), `${t}s on ${trackPx}px`).toBe(drawn);
      }
    }
  });

  it("never counts a searching pause, however the track widens a landing", () => {
    for (const t of [48, 48.4, 48.9, 67.2, 67.9]) expect(landedAt(take, t, at320), `${t}s`).toBe(false);
  });

  it("reads the pause's own seconds before the track is measured", () => {
    expect(landedAt(take, 61.5, 0)).toBe(true);
    expect(landedAt(take, 61.9, 0)).toBe(false);
    expect(landedAt(take, 61.9, Number.NaN)).toBe(false);
    expect(landedAt(take, 61.9, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
