import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * COPY-RULES: zero em dashes in anything a person reads, generated copy
 * included. The ban lived only in the coach's prompt, so a reply that
 * ignored it reached Demos's bubble unchanged. It is a soft repair, never
 * a reason to retry or bin a recording.
 */
const EM = "—";
const EN = "–";

let reply = "";
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        create: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: reply }],
        }),
      },
    };
  },
}));

const { coachRep, repairCoachOutput, splitSentences, stripProseDashes, validateCoachOutput } =
  await import("./coach");
const { scoreAccuracy } = await import("./accuracy");
const { tier1Scores, tier2Anchors } = await import("./index-score");
const { computeMetrics } = await import("./metrics");

function fixture() {
  const words = (
    [
      ["So", 0, 0.2],
      [" um,", 0.3, 0.5],
      [" my", 0.6, 0.7],
      [" name", 0.8, 1.0],
      [" is", 1.1, 1.2],
      [" Tim.", 1.3, 1.6],
      [" I", 2.8, 2.9],
      [" build", 3.0, 3.2],
      [" speech", 3.3, 3.6],
      [" apps", 3.7, 58.0],
    ] as const
  ).map(([word, start, end]) => ({ word, start, end }));
  const metrics = computeMetrics(words, 60);
  const transcript = "So um, my name is Tim. I build speech apps";
  return { metrics, transcript, tier1: tier1Scores(metrics, words, []), anchors: tier2Anchors(words, transcript) };
}

const dim = {
  score: 62,
  citedMoment: `"I build speech apps" ${EM} a plain claim.`,
  improve: `Open with the claim ${EM} then one example.`,
};
const dashed = {
  focus: `Kill "um" ${EM} 1 filler this rep.`,
  strength: `1 held pause ${EN} before a sentence.`,
  supply: {
    original: "build speech apps",
    upgrade: "train speech under pressure",
    note: `Names the outcome ${EM} not the artifact.`,
  },
  coachLine: `1 filler in 60 seconds ${EM} kill the um.`,
  dimensions: { structure: dim, credibility: dim, engagement: dim, confidence: dim },
};
const hasDash = (s: string) => s.includes(EM) || / – /.test(s);

describe("stripProseDashes", () => {
  it("turns a prose dash into a comma", () => {
    expect(stripProseDashes(`4 fillers in 62s ${EM} kill the um.`)).toBe("4 fillers in 62s, kill the um.");
    expect(stripProseDashes(`Held it ${EN} twice.`)).toBe("Held it, twice.");
  });

  it("keeps a time range and never leaves a comma before the full stop", () => {
    expect(stripProseDashes(`From 0:42${EN}0:48.`)).toBe(`From 0:42${EN}0:48.`);
    expect(stripProseDashes(`That landed ${EM}.`)).toBe("That landed.");
    expect(stripProseDashes(`${EM} Open with it.`)).toBe("Open with it.");
  });
});

describe("the coach's copy, cleaned", () => {
  it("leaves no dash in any field a person reads, and keeps the quote verbatim", () => {
    const fixed = repairCoachOutput(dashed);
    const read = [
      fixed.focus,
      fixed.strength,
      fixed.supply.upgrade,
      fixed.supply.note,
      fixed.coachLine,
      ...Object.values(fixed.dimensions).flatMap((d) => [d.improve, d.citedMoment]),
    ];
    expect(read.filter(hasDash)).toEqual([]);
    expect(fixed.supply.original).toBe(dashed.supply.original);
    expect(splitSentences(fixed.coachLine)).toHaveLength(splitSentences(dashed.coachLine).length);
  });

  it("never fails validation over a dash", () => {
    const f = fixture();
    expect(validateCoachOutput(dashed, f.transcript, f.metrics, f.tier1, f.anchors)).toEqual([]);
  });

  it("cleans a reply that passes validation first time", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    reply = JSON.stringify(dashed);
    const f = fixture();
    const got = await coachRep(f.transcript, f.metrics, f.tier1, f.anchors);
    expect(got).not.toBeNull();
    expect(hasDash(got!.coachLine) || hasDash(got!.focus)).toBe(false);
  });
});

describe("the fact-check's copy, cleaned", () => {
  it("strips dashes from why and keeps the speaker's quote as said", () => {
    const quote = `it was 1969 ${EM} I think`;
    const result = scoreAccuracy(
      { covered: [0], claims: [{ quote, verdict: "supported", hedged: false, why: `Truth point 0 ${EM} name matches.` }] },
      { id: "t", title: "T", truth: ["a"] } as never
    );
    expect(result.claims[0].why).toBe("Truth point 0, name matches.");
    expect(result.claims[0].quote).toBe(quote);
  });
});

beforeEach(() => {
  reply = "";
});
