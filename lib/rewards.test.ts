import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { computeMetrics, substance, type RepMetrics } from "./metrics";
import type { Milestone } from "./progress";
import {
  anticipation,
  celebrates,
  composedHeard,
  endNote,
  personalBests,
  MOST_PAUSES,
} from "./rewards";
import type { StreakState } from "./streak";

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

/* A star milestone since #215 retired the unit unlock: these tests are
   about how `anticipation` frames a milestone, not about which kinds
   exist. */
const ms = (over: Partial<Milestone> = {}): Milestone => ({
  id: "m",
  kind: "star",
  label: "3★ on The baseline",
  detail: "best so far is 2★",
  current: 2,
  target: 3,
  progress: 0.66,
  remaining: 1,
  line: "Next: star 3 of 3 on The baseline",
  ...over,
});

/** Enough words to score (`isScorable`): these are real takes. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";

const metrics = (over: Partial<RepMetrics> = {}): RepMetrics => ({
  ...computeMetrics([], 60),
  substance: substance(SAID),
  durationS: 60,
  wpm: 145,
  fillerCount: 3,
  fillersPerMin: 3,
  heldPauses: 2,
  composedPauses: 0,
  midSentencePauses: 2,
  stars: 2,
  ...over,
});

const rep = (over: Partial<RepRow> = {}): RepRow =>
  ({
    id: Math.random().toString(36),
    duration_s: 60,
    transcript: SAID,
    filler_count: 6,
    ethos_index: 600,
    pauses: [],
    created_at: new Date().toISOString(),
    ...over,
  }) as RepRow;

describe("anticipation", () => {
  it("leads with the streak when one is on the line", () => {
    const a = anticipation([ms()], streak({ current: 5 }));
    expect(a?.headline).toContain("5-day streak");
    expect(a?.detail).toBe("Next: star 3 of 3 on The baseline");
  });

  it("falls back to the closest milestone, in its own line", () => {
    const a = anticipation([ms()], streak({ current: 0 }));
    expect(a?.headline).toBe("Next: star 3 of 3 on The baseline");
    expect(a?.detail).toBe("best so far is 2★");
  });

  /* The two-second test (#483): Timothy read "Ethos 800 · 96 to go" under
     Record on 16 Nov and could not say what it meant. The line names the
     score as a score, and the target, with nothing to work out. */
  it("says the Index milestone as a best score and a next one, never a gap", () => {
    const a = anticipation(
      [ms({ kind: "index", label: "Ethos 800", detail: "best is 704", line: "Your best score is 704. Next: 800." })],
      streak({ current: 0 })
    );
    expect(a?.headline).toBe("Your best score is 704. Next: 800.");
    expect(a?.headline).not.toMatch(/to go|·/);
  });

  it("keeps the next milestone's line whole rather than splicing it", () => {
    const line = "Your best score is 689. Next: 700.";
    const a = anticipation([ms({ label: "Ethos 700", detail: "best is 689", line })], streak({ current: 4 }));
    expect(a?.detail).toBe(line);
    expect(a?.detail).not.toMatch(/puts you .* on/);
  });

  it("says nothing rather than something empty", () => {
    expect(anticipation([], streak())).toBeNull();
  });

  it("always carries a number when it speaks", () => {
    for (const s of [streak(), streak({ current: 3 })]) {
      const a = anticipation([ms()], s);
      expect(`${a?.headline} ${a?.detail}`).toMatch(/\d/);
    }
  });
});

describe("endNote", () => {
  const base = { repCount: 4 };

  it("prefers a pause between sentences, the hardest thing to do (#427, in #490's words)", () => {
    const e = endNote({
      ...base,
      metrics: metrics({ composedPauses: 2 }),
      streak: streak({ current: 5 }),
    });
    expect(e.headline).toBe("2 pauses between sentences");
  });

  it("never counts a pause the take judged filled as composed (#422)", () => {
    const pre = (t: number, verdict: string) => ({ t, len: 1.2, kind: "pre", verdict, note: "" });
    const judged = metrics({
      composedPauses: 3,
      pauses: [pre(10, "landing"), pre(20, "filled"), pre(30, "landing")] as unknown as RepMetrics["pauses"],
    });
    expect(composedHeard(judged)).toBe(2);
    expect(endNote({ ...base, metrics: judged, streak: streak() }).headline).toBe("2 pauses between sentences");

    const allFilled = metrics({
      composedPauses: 2,
      fillerCount: 0,
      pauses: [pre(10, "filled"), pre(20, "filled")] as unknown as RepMetrics["pauses"],
    });
    expect(endNote({ ...base, metrics: allFilled, streak: streak() }).headline).toBe("Zero fillers");

    // No verdicts on the pauses (an older shape): the kind alone, as before.
    expect(composedHeard(metrics({ composedPauses: 2 }))).toBe(2);
  });

  it("falls through to a clean rep, then the zone, then the streak", () => {
    expect(
      endNote({
        ...base,
        metrics: metrics({ fillerCount: 0 }),
        streak: streak(),
      }).headline
    ).toBe("Zero fillers");
    expect(
      endNote({ ...base, metrics: metrics({ wpm: 145 }), streak: streak() })
        .headline
    ).toBe("145 words a minute");
    expect(
      endNote({
        ...base,
        metrics: metrics({ wpm: 200 }),
        streak: streak({ current: 4 }),
      }).headline
    ).toBe("4 days running");
  });

  it("always ends on something, even for a rough first rep", () => {
    const e = endNote({
      ...base,
      repCount: 1,
      metrics: metrics({ wpm: 210, fillerCount: 22, composedPauses: 0 }),
      streak: streak({ current: 1 }),
    });
    expect(e.headline).toBe("Recording 1 logged");
    expect(e.detail).toMatch(/\w/);
  });

  /* "Zero fillers, 5 seconds, clean." stood under "Not enough to score". */
  it("ends a take too short to score on its streak or its count, never a number", () => {
    const short = metrics({
      substance: substance("Okay then."),
      durationS: 5,
      fillerCount: 0,
      composedPauses: 1,
      wpm: 145,
    });
    expect(endNote({ ...base, metrics: short, streak: streak({ current: 3 }) }).headline).toBe(
      "3 days running"
    );
    expect(endNote({ ...base, metrics: short, streak: streak() }).headline).toBe(
      "Recording 4 logged"
    );
  });

  it("never ends on a criticism", () => {
    const harsh = /too many|bad|poor|worse|failed|sloppy/i;
    for (const m of [
      metrics({ fillerCount: 30, wpm: 220, composedPauses: 0 }),
      metrics({ composedPauses: 3 }),
      metrics({ fillerCount: 0 }),
    ]) {
      const e = endNote({ ...base, metrics: m, streak: streak({ current: 2 }) });
      expect(`${e.headline} ${e.detail}`).not.toMatch(harsh);
    }
  });
});

describe("personalBests", () => {
  it("stays quiet on the very first rep", () => {
    expect(personalBests([], metrics(), 700)).toEqual([]);
  });

  it("compares against every prior rep, including the most recent", () => {
    // The regression: treating the argument as "history minus the new
    // rep" dropped the 640 and claimed the record was 600.
    const out = personalBests(
      [rep({ ethos_index: 600 }), rep({ ethos_index: 640 })],
      metrics(),
      700
    );
    expect(out[0].headline).toBe("Best Ethos yet");
    expect(out[0].detail).toBe("700, past your 640");
  });

  it("counts a single prior rep as a record to beat", () => {
    const out = personalBests([rep({ ethos_index: 600 })], metrics(), 700);
    expect(out[0].detail).toBe("700, past your 600");
  });

  it("says nothing when the rep did not beat anything", () => {
    const out = personalBests(
      [
        rep({ ethos_index: 800, filler_count: 0 }),
        rep({ ethos_index: 810, filler_count: 0 }),
      ],
      metrics({ fillersPerMin: 9, heldPauses: 0 }),
      600
    );
    expect(out).toEqual([]);
  });

  /* A two-word take read "Cleanest recording yet, 0/min, under your 3". */
  it("holds and breaks no record with a take too short to score", () => {
    const prior = [rep({ filler_count: 5 }), rep({ filler_count: 3 })];
    const short = metrics({ substance: substance("Okay then."), fillersPerMin: 0, heldPauses: 9 });
    expect(personalBests(prior, short, null)).toEqual([]);
    // A stored short take at 0 fillers a minute is no best to beat.
    const out = personalBests(
      [...prior, rep({ transcript: "Hi.", filler_count: 0, duration_s: 3 })],
      metrics({ fillersPerMin: 1 }),
      null
    );
    expect(out.map((b) => b.detail)).toContain("1 filler a minute, under your 3");
    // Nothing measured before it: nothing to beat, and no "past -Infinity".
    expect(personalBests([rep({ transcript: "Hi." })], metrics({ heldPauses: 4 }), null)).toEqual([]);
  });

  /* The review of #490: the record is a count, never an amount of
     silence ("Most silence you've held"). Since the reel's honest wins
     (build 6) it counts pauses between sentences only, #495's rule on the
     Log: a pause mid-sentence is the fault Demos names, so more of them
     never breaks a record. */
  const pause = (t: number, kind: "pre" | "mid" | "beat") => ({ t, len: kind === "beat" ? 0.4 : 1.1, kind });
  const pauses = (pre: number, mid: number) => [
    ...Array.from({ length: pre }, (_, i) => pause(2 + i * 5, "pre")),
    ...Array.from({ length: mid }, (_, i) => pause(3 + i * 5, "mid")),
    pause(40, "beat"),
  ];

  it("breaks no pause record with more pauses mid-sentence", () => {
    const out = personalBests(
      [rep({ pauses: pauses(3, 0) })],
      metrics({ heldPauses: 8, composedPauses: 2, midSentencePauses: 6, pauses: pauses(2, 6) }),
      null
    );
    expect(out.map((b) => b.headline)).not.toContain(MOST_PAUSES);
  });

  it("counts pauses between sentences against the most in any earlier recording", () => {
    const out = personalBests(
      [rep({ pauses: pauses(3, 0) }), rep({ pauses: pauses(1, 7) }), { ...rep(), pauses: null } as unknown as RepRow],
      metrics({ heldPauses: 4, composedPauses: 4, midSentencePauses: 0, pauses: pauses(4, 0) }),
      null
    );
    expect(out.find((b) => b.headline === MOST_PAUSES)).toEqual({
      headline: "Most pauses yet",
      detail: "4 pauses between sentences, past your 3",
      tone: "earned",
    });
    expect(out.map((b) => b.headline)).not.toContain("Most silence you've held");
  });

  it("says one pause in the singular", () => {
    const out = personalBests(
      [rep({ pauses: pauses(0, 5) })],
      metrics({ heldPauses: 1, composedPauses: 1, midSentencePauses: 0, pauses: pauses(1, 0) }),
      null
    );
    expect(out.find((b) => b.headline === MOST_PAUSES)?.detail).toBe("1 pause between sentences, past your 0");
  });

  it("names the number it beat, every time", () => {
    const out = personalBests(
      [rep({ ethos_index: 500, filler_count: 12 }), rep({ ethos_index: 520 })],
      metrics({ fillersPerMin: 1, heldPauses: 5 }),
      900
    );
    expect(out.length).toBeGreaterThan(0);
    for (const b of out) expect(b.detail).toMatch(/\d/);
  });
});

describe("celebrates (D52)", () => {
  const prior = [rep({ ethos_index: 640 }), rep({ ethos_index: 662 }), rep({ ethos_index: null })];

  it("celebrates three stars, whatever the Index", () => {
    expect(celebrates(prior, 3, 500)).toBe(true);
    expect(celebrates([], 3, null)).toBe(true);
  });

  it("celebrates a new best Index", () => {
    expect(celebrates(prior, 2, 663)).toBe(true);
  });

  it("does not celebrate two stars a few points up on the last take but under the best", () => {
    expect(celebrates([rep({ ethos_index: 700 }), rep({ ethos_index: 662 })], 2, 665)).toBe(false);
  });

  it("does not celebrate tying the best, an unscored take, or a first take under three stars", () => {
    expect(celebrates(prior, 2, 662)).toBe(false);
    expect(celebrates(prior, 2, null)).toBe(false);
    expect(celebrates([], 2, 700)).toBe(false);
  });
});
