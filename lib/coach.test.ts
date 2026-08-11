import { describe, expect, it } from "vitest";
import {
  repairCoachOutput,
  splitProblems,
  splitSentences,
  tier2Scores,
  validateCoachOutput,
  type CoachOutput,
} from "./coach";
import { tier1Scores, tier2Anchors } from "./index-score";
import { computeMetrics, type Word } from "./metrics";

// A rep with known numbers: 60s, 10 words, 1 filler ("um"), 1 held pause.
function fixture() {
  const words: Word[] = [
    ["So", 0, 0.2],
    [" um,", 0.3, 0.5],
    [" my", 0.6, 0.7],
    [" name", 0.8, 1.0],
    [" is", 1.1, 1.2],
    [" Tim.", 1.3, 1.6],
    [" I", 2.8, 2.9], // 1.2s held pause after "Tim." → pre
    [" build", 3.0, 3.2],
    [" speech", 3.3, 3.6],
    [" apps", 3.7, 58.0],
  ].map(([word, start, end]) => ({
    word: word as string,
    start: start as number,
    end: end as number,
  }));
  const metrics = computeMetrics(words, 60);
  const transcript = "So um, my name is Tim. I build speech apps";
  return {
    metrics,
    transcript,
    tier1: tier1Scores(metrics, words, []),
    anchors: tier2Anchors(words, transcript),
  };
}

const dim = (partial = {}) => ({
  score: 62,
  citedMoment: '"I build speech apps" lands as a plain claim.',
  improve: "Open with the claim, then one example.",
  ...partial,
});

function out(partial: Partial<CoachOutput> = {}): CoachOutput {
  return {
    focus: 'Kill "um" — 1 filler this rep.',
    strength: "1 held pause landed before a sentence.",
    supply: {
      original: "build speech apps",
      upgrade: "train speech under pressure",
      note: "Names the outcome, not the artifact.",
    },
    coachLine: "1 filler in 60 seconds. 1 held pause landed before a sentence.",
    dimensions: {
      structure: dim(),
      credibility: dim(),
      engagement: dim(),
      confidence: dim(),
    },
    ...partial,
  };
}

function validate(o: CoachOutput) {
  const f = fixture();
  return validateCoachOutput(o, f.transcript, f.metrics, f.tier1, f.anchors);
}

describe("validateCoachOutput", () => {
  it("passes clean, grounded, cited output", () => {
    expect(validate(out())).toEqual([]);
  });

  it("rejects banned manosphere/hype language", () => {
    const problems = validate(
      out({ coachLine: "1 filler. Dominate the room tomorrow." })
    );
    expect(problems.some((p) => p.includes("dominate"))).toBe(true);
  });

  it("rejects hype adjectives anywhere in the copy", () => {
    const problems = validate(out({ strength: "Amazing pause control." }));
    expect(problems.some((p) => p.includes("amazing"))).toBe(true);
  });

  it("rejects coach lines longer than two sentences", () => {
    const problems = validate(
      out({ coachLine: "1 filler. 1 pause. 60 seconds total." })
    );
    expect(problems.some((p) => p.includes("sentences"))).toBe(true);
  });

  it("rejects a supply that isn't a verbatim quote", () => {
    const problems = validate(
      out({
        supply: {
          original: "constructing applications",
          upgrade: "building",
          note: "Simpler.",
        },
      })
    );
    expect(problems.some((p) => p.includes("verbatim"))).toBe(true);
  });

  it("rejects invented numbers (no-horoscope rule)", () => {
    const problems = validate(
      out({ coachLine: "You said 19 fillers last week. 1 today." })
    );
    expect(problems.some((p) => p.includes("19"))).toBe(true);
  });

  it("rejects a focus with no metric basis", () => {
    const problems = validate(out({ focus: "Be more confident tomorrow." }));
    expect(problems.some((p) => p.includes("focus"))).toBe(true);
  });

  it("rejects a strength with no metric basis", () => {
    const problems = validate(out({ strength: "You came across as likable." }));
    expect(problems.some((p) => p.includes("strength"))).toBe(true);
  });

  it("rejects a judged score whose citedMoment has no evidence (DECISIONS #19)", () => {
    const problems = validate(
      out({
        dimensions: {
          structure: dim({ citedMoment: "The structure felt loose overall." }),
          credibility: dim(),
          engagement: dim(),
          confidence: dim(),
        },
      })
    );
    expect(problems.some((p) => p.startsWith("structure.citedMoment"))).toBe(
      true
    );
  });

  it("accepts a timestamp as citation evidence", () => {
    const problems = validate(
      out({
        dimensions: {
          structure: dim({ citedMoment: "Trails off at 0:52 with no close." }),
          credibility: dim(),
          engagement: dim(),
          confidence: dim(),
        },
      })
    );
    expect(problems).toEqual([]);
  });
});

/**
 * Regression: a real rep (10 Aug, 35.58s, 11 "you know"s → 18.55/min)
 * came back with no Ethos Index. The coach was shown durationS 35.58
 * and fillersPerMin 18.55, then told those numbers were invented,
 * because only the ROUNDED values were on the allowlist. Three
 * rejections, coach null, no Index.
 */
describe("numbers the coach was handed are citable", () => {
  // 96 words in 35.58s (≈162 wpm) with 11 "you know" bigrams → 18.55/min.
  // "you" and "know" must be separate tokens: that's how Whisper emits
  // them and how the bigram detector sees them.
  const tokens: string[] = [];
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 6; j++) tokens.push(`word${i}${j}`);
    tokens.push("you", "know");
  }
  while (tokens.length < 96) tokens.push(`tail${tokens.length}`);
  const step = 35.58 / tokens.length;
  const words: Word[] = tokens.map((t, i) => ({
    word: (i === 0 ? "" : " ") + t,
    start: i * step,
    end: i * step + step * 0.8,
  }));
  const metrics = computeMetrics(words, 35.58);
  const transcript = words.map((w) => w.word).join("").trim();
  const tier1 = tier1Scores(metrics, words, []);
  const anchors = tier2Anchors(words, transcript);

  const withLine = (coachLine: string): CoachOutput => ({
    focus: `Kill "you know" — ${metrics.fillerCount} of them.`,
    strength: `Held ${metrics.heldPauses} pauses.`,
    supply: { original: "you know", upgrade: "(pause)", note: "Silence reads as thought." },
    coachLine,
    dimensions: {
      structure: { score: 55, citedMoment: `"${transcript.slice(0, 20)}"`, improve: "Open with the claim." },
      credibility: { score: 55, citedMoment: "0:12", improve: "One concrete detail." },
      engagement: { score: 55, citedMoment: "0:20", improve: "One image." },
      confidence: { score: 55, citedMoment: "0:30", improve: "Land the ending." },
    },
  });

  const check = (line: string) =>
    validateCoachOutput(withLine(line), transcript, metrics, tier1, anchors).filter(
      (p) => p.includes("cites number")
    );

  it("exposes the fractional metrics it will be quoted on", () => {
    expect(metrics.durationS).toBe(35.58);
    expect(metrics.fillersPerMin).toBeCloseTo(18.55, 1);
  });

  it("accepts the exact fractional value it was given", () => {
    expect(check(`${metrics.fillerCount} fillers. ${metrics.fillersPerMin} a minute.`)).toEqual([]);
  });

  it("accepts the floored duration — 35 seconds, not just 36", () => {
    expect(check(`${metrics.fillerCount} fillers in 35 seconds.`)).toEqual([]);
  });

  it("accepts the rounded duration too", () => {
    expect(check(`${metrics.fillerCount} fillers in 36 seconds.`)).toEqual([]);
  });

  it("still rejects a number that came from nowhere", () => {
    expect(check("You improved 42 percent this week.")).toHaveLength(1);
  });

  it("reads a decimal as one number, not two integers", () => {
    // "18.55" must not be parsed as 18 and 55 — 55 is not a metric.
    expect(check("18.55 a minute.")).toEqual([]);
  });
});

describe("tier2Scores", () => {
  it("extracts the four judged scores", () => {
    expect(tier2Scores(out())).toEqual({
      structure: 62,
      credibility: 62,
      engagement: 62,
      confidence: 62,
    });
  });
});

/**
 * Observed in production on 11 Aug, from the runtime logs:
 *
 *   [coach] gave up after 3 attempts: coachLine has 3 sentences; max is 2
 *
 * Two bugs behind one symptom. The sentence splitter counted the point in
 * a decimal as a sentence end — and every coachLine is REQUIRED to cite a
 * metric, half of which are decimals — so ordinary two-sentence lines
 * read as three. And a style violation then cost the rep its entire
 * Ethos Index, the product's headline number.
 */
describe("sentence counting survives the numbers", () => {
  it("does not count a decimal point as a sentence end", () => {
    expect(splitSentences("1.5 fillers a minute. Kill the 'um'.")).toHaveLength(2);
    expect(splitSentences("You held 2.4s of silence at 0:47.")).toHaveLength(1);
    expect(splitSentences("17.84 per minute is high.")).toHaveLength(1);
  });

  it("still counts real sentences", () => {
    expect(splitSentences("One. Two. Three.")).toHaveLength(3);
    expect(splitSentences("Clean rep! Now hold a pause?")).toHaveLength(2);
  });

  it("handles a number ending a sentence", () => {
    expect(splitSentences("Your pace was 132. Hold it there.")).toHaveLength(2);
  });
});

describe("style never costs the rep its score", () => {
  it("treats a long coachLine as soft and everything else as hard", () => {
    const { hard, soft } = splitProblems([
      "coachLine has 3 sentences; max is 2",
      'supply.original "x" is not a verbatim quote from the transcript',
      "cites number 47, which is not in the metrics",
    ]);
    expect(soft).toHaveLength(1);
    expect(hard).toHaveLength(2);
  });

  /**
   * The no-horoscope rule (DECISIONS #19) stays worth failing over. Only
   * house style is repairable.
   */
  it("keeps grounding failures hard", () => {
    const { hard, soft } = splitProblems([
      "structure cites no quoted moment or timestamp",
    ]);
    expect(hard).toHaveLength(1);
    expect(soft).toHaveLength(0);
  });

  it("trims an over-long coachLine to house style", () => {
    const out = {
      focus: "f",
      strength: "s",
      supply: { original: "a", upgrade: "b", note: "n" },
      coachLine: "First point. Second point. Third flourish.",
      dimensions: {} as never,
    };
    const fixed = repairCoachOutput(out as never);
    expect(splitSentences(fixed.coachLine)).toHaveLength(2);
    expect(fixed.coachLine).toContain("First point");
    expect(fixed.coachLine).not.toContain("Third flourish");
  });

  it("leaves a compliant line alone", () => {
    const out = {
      focus: "f",
      strength: "s",
      supply: { original: "a", upgrade: "b", note: "n" },
      coachLine: "1.5 fillers a minute. Kill the 'um'.",
      dimensions: {} as never,
    };
    expect(repairCoachOutput(out as never).coachLine).toBe(out.coachLine);
  });
});
