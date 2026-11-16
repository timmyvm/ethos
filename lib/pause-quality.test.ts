import { describe, expect, it } from "vitest";
import { SHAPED_TAKE, whisperTake } from "./__fixtures__/whisper-take";
import { INDEX_WEIGHTS } from "./index-score";
import { computeMetrics, detectFillers, detectPauses, type FillerHit, type Word } from "./metrics";
import { pauseReport, reportJudged, DEAD_AIR_S, PENALTY_CAP, type JudgedPause, type PauseVerdict } from "./pause-quality";

/**
 * Build a word stream from sentences with explicit gaps between them.
 * `["six word sentence goes right here.", 1.4, "another one that is long."]`
 * means: say the first, hold 1.4s, say the second.
 */
function speech(parts: (string | number)[]): { words: Word[]; durationS: number } {
  const words: Word[] = [];
  let t = 0;
  const WORD = 0.35;
  for (const part of parts) {
    if (typeof part === "number") {
      t += part;
      continue;
    }
    for (const raw of part.split(" ")) {
      words.push({ word: ` ${raw}`, start: t, end: t + WORD });
      t += WORD + 0.05;
    }
  }
  return { words, durationS: Math.round(t * 100) / 100 };
}

function report(
  parts: (string | number)[],
  fillers: FillerHit[] = [],
  opts: { leadIn?: number } = {}
) {
  const { words, durationS } = speech(parts);
  if (opts.leadIn) {
    for (const w of words) {
      w.start += opts.leadIn;
      w.end += opts.leadIn;
    }
  }
  const pauses = detectPauses(words);
  return pauseReport({
    pauses,
    words,
    fillers,
    durationS: durationS + (opts.leadIn ?? 0),
  });
}

const SENTENCE_A = "I think the honest answer here is simpler than it looks.";
const SENTENCE_B = "Most teams already know what the problem actually is.";
const SENTENCE_C = "The hard part is saying it out loud in a room.";
const SENTENCE_D = "That is the whole skill and nobody practises it.";

describe("a pause is judged by where it lands", () => {
  it("counts a held pause after a finished point as a landing", () => {
    const r = report([SENTENCE_A, 1.4, SENTENCE_B]);
    expect(r.landings).toBe(1);
    expect(r.hesitations).toBe(0);
    expect(r.pauses.find((p) => p.verdict === "landing")?.note).toContain(
      "after a finished point"
    );
  });

  it("counts a mid-sentence gap as searching, not composure", () => {
    // No sentence end before the gap — the clause is still open.
    const r = report(["I think the honest answer here", 1.4, "is simpler"]);
    expect(r.landings).toBe(0);
    expect(r.hesitations).toBe(1);
    expect(r.pauses.find((p) => p.verdict === "hesitation")?.note).toContain(
      "mid-sentence"
    );
  });

  /**
   * The reported bug. Five slow starts used to score the same as five
   * landed points, because the old score asked whether a pause existed
   * and never whether it was earned.
   */
  it("does not reward a pause after a scrap of a sentence", () => {
    const r = report(["Right. So.", 1.5, SENTENCE_A]);
    expect(r.landings).toBe(0);
    expect(r.pauses.find((p) => p.verdict === "hesitation")?.note).toContain(
      "No point to land"
    );
  });

  it("credits a pause taken before the first word", () => {
    const r = report([SENTENCE_A, 1.4, SENTENCE_B], [], { leadIn: 1.5 });
    // The lead-in silence isn't between two words, so it can't be
    // detected from gaps — this asserts the rep still scores sanely
    // rather than inventing an opening that wasn't measurable.
    expect(r.score).toBeGreaterThan(0);
  });
});

describe("silence you bought back", () => {
  it("refuses to credit a pause with a filler leaning on it", () => {
    const { words, durationS } = speech([SENTENCE_A, 1.4, SENTENCE_B]);
    const gapAt = words.find((w) => /looks\.$/.test(w.word))!.end;
    const r = pauseReport({
      pauses: detectPauses(words),
      words,
      fillers: [{ word: "um", t: gapAt + 0.3 }],
      durationS,
    });
    expect(r.landings).toBe(0);
    expect(r.filled).toBe(1);
    expect(r.headline).toContain("INSTEAD");
  });

  it("scores a filled pause below the same pause left clean", () => {
    const clean = report([SENTENCE_A, 1.4, SENTENCE_B]);
    const { words, durationS } = speech([SENTENCE_A, 1.4, SENTENCE_B]);
    const gapAt = words.find((w) => /looks\.$/.test(w.word))!.end;
    const dirty = pauseReport({
      pauses: detectPauses(words),
      words,
      fillers: [{ word: "um", t: gapAt + 0.3 }],
      durationS,
    });
    expect(dirty.score).toBeLessThan(clean.score);
  });
});

describe("dead air", () => {
  it("marks a pause past the dead-air threshold", () => {
    const r = report([SENTENCE_A, DEAD_AIR_S + 1, SENTENCE_B]);
    expect(r.dead).toBe(1);
    expect(r.landings).toBe(0);
    expect(r.headline).toContain("dead air");
  });

  it("costs more than it could ever have earned", () => {
    const good = report([SENTENCE_A, 1.4, SENTENCE_B]);
    const lost = report([SENTENCE_A, DEAD_AIR_S + 1, SENTENCE_B]);
    expect(lost.score).toBeLessThan(good.score);
  });
});

describe("the score", () => {
  it("is a ratio, so good and bad pauses cancel toward the middle", () => {
    const allGood = report([SENTENCE_A, 1.4, SENTENCE_B, 1.4, SENTENCE_C, 1.4, SENTENCE_D]);
    const mixed = report([
      SENTENCE_A,
      1.4,
      "and the reason for that",
      1.4,
      "is that most people",
      1.4,
      SENTENCE_D,
    ]);
    expect(allGood.score).toBeGreaterThan(mixed.score + 20);
  });

  /**
   * The old score gave 60/100 for saying nothing in particular with no
   * silence in it at all. Never coming up for air is the bottom of the
   * range, not a passing grade.
   */
  it("does not hand out a baseline for a rep with no held pauses", () => {
    const r = report([`${SENTENCE_A} ${SENTENCE_B} ${SENTENCE_C}`]);
    expect(r.score).toBeLessThan(40);
    expect(r.headline).toContain("No held pauses");
  });

  it("still tops out at 100 for a genuinely well-paced rep", () => {
    const r = report([
      SENTENCE_A, 1.5, SENTENCE_B, 1.4, SENTENCE_C, 1.6, SENTENCE_D,
    ]);
    expect(r.score).toBeGreaterThan(75);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("never leaves the 0–100 range", () => {
    const awful = report([
      SENTENCE_A, 6, SENTENCE_B, 7, SENTENCE_C, 8, SENTENCE_D,
    ]);
    expect(awful.score).toBeGreaterThanOrEqual(0);
    expect(awful.score).toBeLessThanOrEqual(100);
  });
});

describe("the headline", () => {
  it("names the biggest problem, not a list of them", () => {
    const r = report([SENTENCE_A, DEAD_AIR_S + 1, SENTENCE_B, 1.4, "and then"]);
    expect(r.headline).toContain("dead air");
    expect(r.headline).not.toContain("mid-sentence");
  });

  it("says something true and useful when nothing is wrong", () => {
    const r = report([SENTENCE_A, 1.5, SENTENCE_B, 1.4, SENTENCE_C]);
    expect(r.headline).toContain("landed after a finished point");
  });
});

/**
 * The microphone's own account of a gap.
 *
 * Whisper deletes non-lexical fillers, so a swallowed "um" reaches the
 * engine as an empty stretch of timeline — and was being scored as
 * composure. The envelope closes that: silence you made a noise in is
 * not silence, whatever the transcript says.
 */
describe("gaps the mic heard a sound in", () => {
  const parts = [SENTENCE_A, 1.4, SENTENCE_B, 1.4, SENTENCE_C];

  function withEnvelope(gapWasVoiced: boolean) {
    const { words, durationS } = speech(parts);
    const pauses = detectPauses(words);
    // Loud speech throughout, with a floor of real silence so the rep
    // has dynamic range to calibrate against.
    const rate = 20;
    const levels = new Array(Math.ceil(durationS * rate) + 40).fill(0.5);
    for (let i = levels.length - 40; i < levels.length; i++) levels[i] = 0.02;
    // Every held gap gets the same treatment — one loud gap in an
    // otherwise silent set would make this test about the wrong thing.
    for (const p of pauses.filter((x) => x.kind !== "beat")) {
      const from = Math.round(p.t * rate);
      const to = Math.round((p.t + p.len) * rate);
      for (let i = from; i < to; i++) levels[i] = gapWasVoiced ? 0.3 : 0.02;
    }
    return pauseReport({
      pauses,
      words,
      fillers: [],
      durationS,
      envelope: { levels, rate },
    });
  }

  it("credits a gap the mic confirms was silent", () => {
    const r = withEnvelope(false);
    expect(r.landings).toBeGreaterThan(0);
    expect(r.filled).toBe(0);
  });

  it("refuses to credit a gap that had a sound in it", () => {
    const r = withEnvelope(true);
    expect(r.filled).toBeGreaterThan(0);
    expect(r.pauses.find((p) => p.verdict === "filled")?.note).toContain(
      "the transcript didn't"
    );
  });

  it("scores the voiced version lower than the silent one", () => {
    expect(withEnvelope(true).score).toBeLessThan(withEnvelope(false).score);
  });

  /**
   * Without an envelope the engine must behave exactly as before rather
   * than assuming silence — every rep recorded before this shipped, and
   * every browser that can't sample, still has to score the same way.
   */
  it("changes nothing when there is no envelope", () => {
    const { words, durationS } = speech(parts);
    const base = pauseReport({
      pauses: detectPauses(words),
      words,
      fillers: [],
      durationS,
    });
    expect(base.filled).toBe(0);
    expect(base.landings).toBeGreaterThan(0);
  });
});

/*
 * #476, for new takes. Every test above uses punctuated words, which
 * Whisper never returns; these read what it does return: words with no
 * punctuation, and segments whose text has it.
 */
describe("a take as Whisper returns it (#476)", () => {
  const take = whisperTake(SHAPED_TAKE);
  const m = computeMetrics(take.words, take.durationS, take.segments);
  const r = pauseReport({
    pauses: m.pauses,
    words: take.words,
    fillers: m.fillers,
    durationS: m.durationS,
    segments: take.segments,
  });
  const held = r.pauses.filter((p) => p.verdict !== "beat");

  it("finds its sentence ends in the segment text", () => {
    expect(take.words.some((w) => /[.?!,]/.test(w.word.replace(/^\d+\.\d+$/, "")))).toBe(false);
    expect(held.map((p) => p.kind)).toEqual(["pre", "mid", "pre", "pre", "pre", "pre", "mid", "pre"]);
  });

  it("judges each held pause by what came before it", () => {
    // talk. | say... | losing. (mid-segment) | left. | thing. (fallback, then "Like,")
    // | them. (an um 1.1s on) | um, | lands. (the last fifth)
    expect(held.map((p) => p.verdict)).toEqual([
      "landing",
      "hesitation",
      "landing",
      "landing",
      "landing",
      "landing",
      "filled",
      "landing",
    ]);
    expect(r.landedTheEnding).toBe(true);
  });

  it("counts the words of a finished point back to the last full stop", () => {
    // "So um I've been thinking. About why most." The pause after "most"
    // closes 3 words: no point to land yet. Before #476 the walk back found
    // no full stop in Whisper's words and counted every word to the start.
    const words = take.words.slice(0, 8).map((w) => w.word);
    const short = whisperTake([
      { text: words.slice(0, 5).join(" ") + ". " + words.slice(5).join(" ") + ". [1.2]" },
      { text: "That was the point." },
    ]);
    const sm = computeMetrics(short.words, short.durationS, short.segments);
    const sr = pauseReport({ pauses: sm.pauses, words: short.words, fillers: sm.fillers, durationS: sm.durationS, segments: short.segments });
    const pause = sr.pauses.find((p) => p.verdict !== "beat")!;
    expect(pause.kind).toBe("pre");
    expect(pause.verdict).toBe("hesitation");
    expect(pause.note).toContain("a pause after 3 words");
  });

  it("scores it 73: placement 6 of 8 (50.25), the rate (25), the ending (8), one filled (-10)", () => {
    expect(r.score).toBe(73);
  });
});

describe("filled means an um, uh or erm leaning on the pause (#476)", () => {
  const { words, durationS } = speech([SENTENCE_A, 1.4, SENTENCE_B]);
  const gapAt = words.find((w) => /looks\.$/.test(w.word))!.end;
  const gapEnd = gapAt + 1.4;
  const judge = (fillers: FillerHit[]) =>
    pauseReport({ pauses: detectPauses(words), words, fillers, durationS }).pauses.find((p) => p.verdict !== "beat")!
      .verdict;

  it("is the Fillers ring's set: a like or a you know beside a silence does not fill it", () => {
    expect(judge([{ word: "like", t: gapEnd }])).toBe("landing");
    expect(judge([{ word: "you know", t: gapEnd }])).toBe("landing");
    expect(judge([{ word: "basically", t: gapAt - 0.4 }])).toBe("landing");
    expect(judge([{ word: "uh", t: gapEnd }])).toBe("filled");
    expect(judge([{ word: "erm", t: gapEnd }])).toBe("filled");
  });

  it("leans within half a second of either edge, not 1.2", () => {
    expect(judge([{ word: "um", t: gapEnd + 0.4 }])).toBe("filled");
    expect(judge([{ word: "um", t: gapEnd + 0.7 }])).toBe("landing");
    expect(judge([{ word: "um", t: gapAt - 0.45 }])).toBe("filled");
  });

  it("measures from where a long um ends, not where it began", () => {
    // A 0.9s "um" right before the silence: its start is 0.9s away, its end 0.
    const said = speech([SENTENCE_A]).words;
    const last = said[said.length - 1].end;
    const um: Word = { word: " um", start: Math.round((last + 0.05) * 100) / 100, end: Math.round((last + 0.95) * 100) / 100 };
    const next = speech([SENTENCE_B]).words.map((w) => ({ ...w, start: w.start + um.end + 1.3, end: w.end + um.end + 1.3 }));
    const all = [...said, um, ...next];
    const { fillers } = detectFillers(all);
    const r = pauseReport({ pauses: detectPauses(all), words: all, fillers, durationS: next[next.length - 1].end + 0.5 });
    const pause = r.pauses.find((p) => p.verdict !== "beat")!;
    expect(pause.t).toBeCloseTo(um.end, 2);
    expect(pause.verdict).toBe("filled");
  });
});

describe("the score's parts (#476)", () => {
  const jp = (t: number, verdict: PauseVerdict): JudgedPause => ({ t, len: 1.2, kind: "pre", verdict, note: "" });
  const landings = (ts: number[]) => ts.map((t) => jp(t, "landing"));

  it("reaches 100 with no opening: placement took the opening's 7 points", () => {
    // Before #476 this was 93, the most any take could score: the opening
    // bonus paid for silence before the first word, which is never a gap.
    expect(reportJudged(landings([10, 30, 50]), 60).score).toBe(100);
  });

  it("counts an opening as placement only", () => {
    const withOpening = reportJudged([jp(0.6, "opening"), ...landings([20, 50])], 60).score;
    const without = reportJudged([jp(0.6, "hesitation"), ...landings([20, 50])], 60).score;
    expect(withOpening - without).toBe(22); // 67 / 3, rounded
  });

  it(`caps filled and dead air together at ${PENALTY_CAP}`, () => {
    const pauses = [...landings([10, 20]), jp(30, "filled"), jp(35, "filled"), jp(40, "filled"), jp(45, "dead"), jp(52, "dead")];
    // 2 of 7 placed (19.14) + the rate (25) - 15, where it was 30 + 24 off: 0.
    expect(reportJudged(pauses, 60).score).toBe(29);
    expect(reportJudged([...landings([10, 20]), jp(30, "filled")], 60).score).toBe(
      reportJudged(landings([10, 20]), 60).score - 22 - 10
    );
  });

  it("costs the same habit the same at any length", () => {
    // 4 landings and 2 filled a minute, for one minute and for two.
    const one = [...landings([5, 15, 25, 50]), jp(30, "filled"), jp(40, "filled")];
    const two = [
      ...landings([5, 15, 25, 35, 45, 55, 65, 100]),
      ...[70, 75, 80, 85].map((t) => jp(t, "filled")),
    ];
    expect(reportJudged(one, 60).score).toBe(63);
    expect(reportJudged(two, 120).score).toBe(63); // 53 and 33 before #476
  });

  it("leaves the Index's weights as they were: only the Pause dimension's input moves", () => {
    expect(INDEX_WEIGHTS).toEqual({
      pause: 150,
      fillers: 100,
      repairs: 50,
      pace: 100,
      range: 100,
      structure: 150,
      credibility: 150,
      engagement: 100,
      confidence: 100,
    });
  });

  it("still scores a take with no held pause 20", () => {
    expect(reportJudged([{ t: 3, len: 0.5, kind: "beat", verdict: "beat", note: "" }], 60).score).toBe(20);
  });
});
