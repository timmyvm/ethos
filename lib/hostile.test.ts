import { describe, expect, it } from "vitest";
import {
  ANSWER_SECONDS,
  FALLBACK_QUESTIONS,
  HOSTILE_PROMPTS,
  HOSTILE_ROUNDS,
  TAKE_SECONDS,
  promptById,
  validateHostileVerdict,
  type HostileVerdict,
} from "./hostile";

describe("hostile prompts", () => {
  it("has enough claims that a re-roll always lands somewhere new", () => {
    expect(HOSTILE_PROMPTS.length).toBeGreaterThanOrEqual(10);
  });

  it("ids are unique", () => {
    const ids = HOSTILE_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("claims stay speakable: short, no em dash, no question mark", () => {
    for (const p of HOSTILE_PROMPTS) {
      expect(p.claim.length).toBeLessThanOrEqual(60);
      expect(p.claim).not.toContain("—");
      // A claim is a position to defend, not a question to answer.
      expect(p.claim).not.toContain("?");
    }
  });

  it("resolves by id and refuses the unknown", () => {
    expect(promptById(HOSTILE_PROMPTS[0].id)?.claim).toBe(
      HOSTILE_PROMPTS[0].claim
    );
    expect(promptById("nope")).toBeUndefined();
  });
});

describe("the shape of the boss", () => {
  it("two questions, a one-minute take, 45-second answers", () => {
    expect(HOSTILE_ROUNDS).toBe(2);
    expect(TAKE_SECONDS).toBe(60);
    expect(ANSWER_SECONDS).toBe(45);
  });

  it("fallback questions are real questions and quote nothing", () => {
    for (const q of FALLBACK_QUESTIONS) {
      expect(q.trimEnd().endsWith("?")).toBe(true);
      expect(q).not.toContain("—");
    }
  });
});

describe("validateHostileVerdict — the no-horoscope contract", () => {
  const session = [
    "I think remote work makes teams worse because juniors learn by osmosis",
    "okay the osmosis point is my strongest one and I will defend it",
  ];

  function verdict(cited: string): HostileVerdict {
    const dim = {
      score: 70,
      citedMoment: cited,
      improve: "Name one number next time.",
    };
    return {
      held: dim,
      answered: dim,
      composed: dim,
      coachLine: "The claim held. The second answer drifted.",
    };
  }

  it("passes when every dimension quotes the session verbatim", () => {
    expect(
      validateHostileVerdict(
        verdict('"juniors learn by osmosis" held both rounds'),
        session
      )
    ).toEqual([]);
  });

  it("rejects a cited moment with no verbatim quote", () => {
    const problems = validateHostileVerdict(
      verdict('"a phrase nobody said" was the turning point'),
      session
    );
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain("held");
  });

  it("rejects a cited moment with no quote marks at all", () => {
    const problems = validateHostileVerdict(
      verdict("the osmosis point held both rounds"),
      session
    );
    expect(problems).toHaveLength(3);
  });

  it("rejects an em dash in the copy", () => {
    const v = verdict('"juniors learn by osmosis" held');
    v.coachLine = "The claim held — mostly.";
    expect(validateHostileVerdict(v, session)).toContain(
      "copy contains an em dash"
    );
  });
});
