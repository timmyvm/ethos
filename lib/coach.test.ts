import { describe, expect, it } from "vitest";
import { tier2Scores, validateCoachOutput, type CoachOutput } from "./coach";
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
