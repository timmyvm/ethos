import { describe, expect, it } from "vitest";
import {
  ANSWER_SECONDS,
  FALLBACK_QUESTIONS,
  HOSTILE_FREE_ROUNDS,
  HOSTILE_PROMPTS,
  HOSTILE_ROUNDS,
  HOSTILE_TAKE_ID,
  TAKE_SECONDS,
  aboutWait,
  claimOfTheDay,
  hostileAllowance,
  hostileCapLine,
  hostileLeftLine,
  hostileNextLine,
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

/*
 * Free for everyone, three rounds in any 24 hours (#478). The phone says
 * the allowance before the take from the takes it already read, counted
 * as the limiter counts them; the server holds the real count.
 */
describe("the free plan's allowance, said before the take", () => {
  const NOW = new Date("2026-11-17T09:00:00.000Z");
  const take = (hoursAgo: number, lesson: string | null = HOSTILE_TAKE_ID) => ({
    lesson_id: lesson,
    created_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  });

  it("is three a day, and a take in the last 24 hours spends one", () => {
    expect(HOSTILE_FREE_ROUNDS).toBe(3);
    expect(hostileAllowance([], NOW)).toEqual({ left: 3, nextAt: null });
    expect(hostileAllowance([take(1)], NOW)).toEqual({ left: 2, nextAt: null });
    expect(hostileAllowance([take(1), take(23.9)], NOW).left).toBe(1);
  });

  it("counts only Hostile's takes, and only the last 24 hours", () => {
    expect(hostileAllowance([take(1, "h4"), take(2, "boss:dunning-kruger"), take(3, null)], NOW).left).toBe(3);
    expect(hostileAllowance([take(24.1), take(30), take(100)], NOW).left).toBe(3);
  });

  it("at the cap, opens the next round when the take that filled it turns 24 hours old", () => {
    const at = hostileAllowance([take(2), take(9), take(5)], NOW);
    expect(at.left).toBe(0);
    expect(at.nextAt?.toISOString()).toBe(new Date(NOW.getTime() + 15 * 3_600_000).toISOString());
    // Past the cap (a take let through on a stale count), the next waits for two to age out.
    const over = hostileAllowance([take(1), take(2), take(3), take(4)], NOW);
    expect(over.left).toBe(0);
    expect(over.nextAt?.toISOString()).toBe(new Date(NOW.getTime() + 21 * 3_600_000).toISOString());
  });

  it("says the count, the wait and the cap in plain words", () => {
    expect(hostileLeftLine(3)).toBe("3 free today");
    expect(hostileLeftLine(1)).toBe("1 free today");
    expect(hostileNextLine(5 * 3600 - 60)).toBe("Next in about 5 hours");
    expect(hostileNextLine(40 * 60)).toBe("Next in about 40 minutes");
    expect(hostileNextLine(20)).toBe("Next in a minute");
    expect(hostileCapLine(15 * 3600)).toBe("That's today's 3 rounds. The next one opens in about 15 hours.");
    expect(aboutWait(89 * 60)).toBe("about 89 minutes");
    expect(aboutWait(90 * 60)).toBe("about 2 hours");
  });
});

describe("the claim of the day (#478)", () => {
  it("is one claim per day, the same all day, and walks every claim before one comes round", () => {
    expect(claimOfTheDay("2026-11-17")).toBe(claimOfTheDay("2026-11-17"));
    const days = Array.from({ length: HOSTILE_PROMPTS.length }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 17 + i));
      return claimOfTheDay(d.toISOString().slice(0, 10)).id;
    });
    expect(new Set(days).size).toBe(HOSTILE_PROMPTS.length);
    expect(claimOfTheDay("2026-11-18").id).not.toBe(claimOfTheDay("2026-11-17").id);
  });

  it("is always a real claim, whatever the key", () => {
    for (const key of ["", "nonsense", "1970-01-01", "2099-12-31"]) {
      expect(HOSTILE_PROMPTS).toContain(claimOfTheDay(key));
    }
  });
});
