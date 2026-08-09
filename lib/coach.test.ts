import { describe, expect, it } from "vitest";
import { validateCoachOutput, type CoachOutput } from "./coach";
import { computeMetrics, type Word } from "./metrics";

// A rep with known numbers: 60s, 10 words, 1 filler ("um"), 1 held pause.
function fixtureMetrics() {
  const words: Word[] = [
    ["So", 0, 0.2],
    [" um,", 0.3, 0.5],
    [" my", 0.6, 0.7],
    [" name", 0.8, 1.0],
    [" is", 1.1, 1.2],
    [" Tim.", 1.3, 1.6],
    [" I", 2.8, 2.9], // 1.2s held pause after "Tim." → pre
    [" build", 3.0, 3.3],
    [" speech", 3.4, 3.7],
    [" apps", 3.8, 58.0],
  ].map(([word, start, end]) => ({
    word: word as string,
    start: start as number,
    end: end as number,
  }));
  return computeMetrics(words, 60);
}

const TRANSCRIPT = "So um, my name is Tim. I build speech apps";

function out(partial: Partial<CoachOutput> = {}): CoachOutput {
  return {
    focus: 'Kill "um" — 1 filler this rep.',
    supply: {
      original: "build speech apps",
      upgrade: "train speech under pressure",
      note: "Names the outcome, not the artifact.",
    },
    coachLine: "1 filler in 60 seconds. 1 held pause landed before a sentence.",
    ...partial,
  };
}

describe("validateCoachOutput", () => {
  it("passes clean, grounded output", () => {
    expect(validateCoachOutput(out(), TRANSCRIPT, fixtureMetrics())).toEqual(
      []
    );
  });

  it("rejects banned manosphere/hype language", () => {
    const problems = validateCoachOutput(
      out({ coachLine: "1 filler. Dominate the room tomorrow." }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("dominate"))).toBe(true);
  });

  it("rejects hype adjectives", () => {
    const problems = validateCoachOutput(
      out({ coachLine: "Amazing rep. 1 filler." }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("amazing"))).toBe(true);
  });

  it("rejects coach lines longer than two sentences", () => {
    const problems = validateCoachOutput(
      out({ coachLine: "1 filler. 1 pause. 60 seconds total." }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("sentences"))).toBe(true);
  });

  it("rejects a supply that isn't a verbatim quote", () => {
    const problems = validateCoachOutput(
      out({
        supply: {
          original: "constructing applications",
          upgrade: "building",
          note: "Simpler.",
        },
      }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("verbatim"))).toBe(true);
  });

  it("rejects invented numbers (no-horoscope rule)", () => {
    const problems = validateCoachOutput(
      out({ coachLine: "You said 19 fillers last week. 1 today." }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("19"))).toBe(true);
  });

  it("rejects a focus with no metric basis", () => {
    const problems = validateCoachOutput(
      out({ focus: "Be more confident tomorrow." }),
      TRANSCRIPT,
      fixtureMetrics()
    );
    expect(problems.some((p) => p.includes("focus"))).toBe(true);
  });
});
