import { describe, expect, it } from "vitest";
import {
  ANSWER_SECONDS,
  FALLBACK_QUESTIONS,
  HOSTILE_PROMPTS,
  HOSTILE_ROUNDS,
  TAKE_SECONDS,
  hostileRecord,
  hostileRecordOf,
  isRepId,
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

/*
 * The verdict is stored on the take it judged (the games plan, item 15),
 * in `reps.round` beside the measured game rounds, so it has to tell
 * itself apart from them and read back only as itself.
 */
describe("the stored verdict", () => {
  const verdict: HostileVerdict = {
    held: { score: 68, citedMoment: 'You said "teams lose the hallway".', improve: "Name one team." },
    answered: { score: 54, citedMoment: 'You said "it feels slower".', improve: "Answer first." },
    composed: { score: 72, citedMoment: 'You paused before "fair, but".', improve: "Keep that pause." },
    coachLine: "You held the claim.",
  };

  it("is marked as Hostile's, with the claim and the questions asked", () => {
    const rec = hostileRecord("remote-work", verdict, [
      { question: "Which team?", quoted: "teams lose the hallway" },
      { question: "Slower how?" },
      { question: "A third never asked" },
    ]);
    expect(rec).toEqual({
      v: 1,
      game: "hostile",
      claimId: "remote-work",
      verdict,
      questions: [
        { question: "Which team?", quoted: "teams lose the hallway" },
        { question: "Slower how?", quoted: "" },
      ],
    });
    expect(hostileRecordOf(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
  });

  it("keeps only the verdict's own fields", () => {
    const rec = hostileRecord("zoos", { ...verdict, overall: 99 } as HostileVerdict, []);
    expect(Object.keys(rec.verdict).sort()).toEqual(["answered", "coachLine", "composed", "held"]);
  });

  it("reads a game round, nothing, or junk as not Hostile's", () => {
    expect(hostileRecordOf(null)).toBeNull();
    expect(hostileRecordOf({ v: 1, game: "qa", level: 2 })).toBeNull();
    expect(hostileRecordOf({ v: 1, game: "hostile", claimId: "x", verdict: { held: 1 }, questions: [] })).toBeNull();
  });

  it("takes a recording id only in a plain shape", () => {
    expect(isRepId("7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f")).toBe(true);
    expect(isRepId("")).toBe(false);
    expect(isRepId("x,eq.1")).toBe(false);
    expect(isRepId(42)).toBe(false);
    expect(isRepId("a".repeat(65))).toBe(false);
  });
});
