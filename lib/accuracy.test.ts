import { describe, expect, it } from "vitest";
import { quoteIsVerbatim, scoreAccuracy } from "./accuracy";
import type { ColdTopic } from "./cold-topics";

const topic: ColdTopic = {
  id: "t",
  title: "Test topic",
  truth: ["point one", "point two", "point three", "point four"],
  reading: "nowhere",
};

const claim = (
  verdict: "supported" | "contradicted" | "unverifiable",
  hedged = false
) => ({ quote: "something said", verdict, hedged, why: "because" });

describe("quoteIsVerbatim", () => {
  const transcript = "So, um, the thing is — CRISPR uses Cas9 to cut DNA.";

  it("accepts the speaker's own words through punctuation noise", () => {
    expect(quoteIsVerbatim("CRISPR uses Cas9", transcript)).toBe(true);
    expect(quoteIsVerbatim("crispr uses cas9,", transcript)).toBe(true);
  });

  it("rejects a paraphrase", () => {
    expect(quoteIsVerbatim("CRISPR edits genes", transcript)).toBe(false);
  });

  it("rejects a quote too short to mean anything", () => {
    expect(quoteIsVerbatim("um", transcript)).toBe(false);
  });
});

describe("scoreAccuracy", () => {
  it("scores full coverage with no errors at 100", () => {
    const r = scoreAccuracy(
      { claims: [claim("supported")], covered: [0, 1, 2, 3] },
      topic
    );
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(1);
    expect(r.missed).toEqual([]);
  });

  it("scores coverage alone when nothing is wrong", () => {
    const r = scoreAccuracy({ claims: [], covered: [0, 1] }, topic);
    expect(r.score).toBe(50);
    expect(r.missed).toEqual(["point three", "point four"]);
  });

  it("punishes a confident error harder than a hedged one", () => {
    const confident = scoreAccuracy(
      { claims: [claim("contradicted")], covered: [0, 1, 2, 3] },
      topic
    );
    const hedged = scoreAccuracy(
      { claims: [claim("contradicted", true)], covered: [0, 1, 2, 3] },
      topic
    );
    expect(confident.score).toBe(82);
    expect(hedged.score).toBe(94);
    expect(confident.confidentlyWrong).toBe(1);
    expect(hedged.confidentlyWrong).toBe(0);
  });

  it("ignores unverifiable claims", () => {
    const r = scoreAccuracy(
      { claims: [claim("unverifiable"), claim("unverifiable")], covered: [0] },
      topic
    );
    expect(r.score).toBe(25);
  });

  it("never goes below zero", () => {
    const r = scoreAccuracy(
      {
        claims: Array.from({ length: 8 }, () => claim("contradicted")),
        covered: [0],
      },
      topic
    );
    expect(r.score).toBe(0);
  });

  it("dedupes and bounds the covered indices", () => {
    const r = scoreAccuracy(
      { claims: [], covered: [0, 0, 1, 99, -1] },
      topic
    );
    expect(r.covered).toEqual([0, 1]);
    expect(r.score).toBe(50);
  });
});
