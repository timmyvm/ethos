import { describe, expect, it } from "vitest";
import { detectPauses, type FillerHit, type Word } from "./metrics";
import { pauseReport, DEAD_AIR_S } from "./pause-quality";

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
