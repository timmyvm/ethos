import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CODE_COPY, CONSENT, CONSENT_VERSION, DOOR_COPY, JOINED_COPY, MATCH_COPY } from "@/content/tester";
import {
  asksForNote,
  cleanNote,
  codeDigits,
  codeReady,
  feedbackRow,
  MATCH_ANSWERS,
  NOTE_MAX,
  scoreSnapshot,
  showsMatchCheck,
  type SnapshotInput,
} from "./tester";

const TESTER = { consent_version: 1, consented_at: "2026-10-30T09:00:00.000Z" };
const KEY = "1761814800000-lesson_the-landing_1-a1b2c3d4";

describe("the code entry", () => {
  it("keeps digits only, four at most, whatever the keyboard sends", () => {
    expect(codeDigits("12")).toBe("12");
    expect(codeDigits("1 2-3a4")).toBe("1234");
    expect(codeDigits("123456")).toBe("1234");
    expect(codeDigits("١٢")).toBe("");
  });

  it("lights Continue at exactly four digits", () => {
    expect(codeReady("123")).toBe(false);
    expect(codeReady("1234")).toBe(true);
    expect(codeReady("12a4")).toBe(false);
  });
});

describe("who sees the match check", () => {
  it("a tester, on a scored recording with its key", () => {
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: KEY })).toBe(true);
  });

  it("nobody else: a non-tester, an unknown state, an unscored take, no key", () => {
    expect(showsMatchCheck({ tester: null, scorable: true, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: undefined, scorable: true, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: false, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: null })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: "has spaces" })).toBe(false);
  });
});

describe("the note", () => {
  it("opens after Roughly and No, never after Yes", () => {
    expect(MATCH_ANSWERS.filter(asksForNote)).toEqual(["roughly", "no"]);
    expect(asksForNote(null)).toBe(false);
  });

  it("is trimmed, capped at the column's length, and nothing when empty", () => {
    expect(cleanNote("  Felt slower than that  ")).toBe("Felt slower than that");
    expect(cleanNote("   ")).toBeNull();
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote("x".repeat(400))).toHaveLength(NOTE_MAX);
    // Capped by characters, so an emoji is never cut in half.
    expect(Array.from(cleanNote("🙂".repeat(300))!)).toHaveLength(NOTE_MAX);
  });
});

const RESULT: SnapshotInput = {
  ethosIndex: 665,
  previousIndex: 662,
  metrics: {
    stars: 2,
    wpm: 145,
    fillerCount: 4,
    durationS: 62.4,
    pauses: [{}, {}, {}, {}],
    heldPauses: 4,
  },
  tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66.25 },
  coach: {
    dimensions: {
      structure: { score: 64 },
      credibility: { score: 58 },
      engagement: { score: 61 },
      confidence: { score: 66 },
    },
  },
  captureMode: "voice",
  judged: { ran: true },
};

describe("what a feedback row holds", () => {
  it("the numbers the screen showed, flat and small", () => {
    const s = scoreSnapshot(RESULT, 71);
    expect(s).toEqual({
      v: 1,
      index: 665,
      previous: 662,
      stars: 2,
      tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66.3 },
      tier2: { structure: 64, credibility: 58, engagement: 61, confidence: 66 },
      presence: 71,
      wpm: 145,
      fillers: 4,
      pauses: 4,
      held: 4,
      seconds: 62.4,
      capture: "voice",
      judged: true,
    });
    // 0020 caps the column at 4000 bytes; this is a tenth of that.
    expect(JSON.stringify(s).length).toBeLessThan(400);
  });

  it("nulls for what was not measured, never zeros", () => {
    const s = scoreSnapshot({ ...RESULT, ethosIndex: null, coach: null, judged: { ran: false } });
    expect(s.index).toBeNull();
    expect(s.tier2).toBeNull();
    expect(s.presence).toBeNull();
  });

  it("one row per recording, keyed by its outbox id, with the answer and the time", () => {
    const now = new Date("2026-10-30T09:15:00.000Z");
    const row = feedbackRow({
      userId: "u1",
      clientId: KEY,
      repId: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      answer: "no",
      note: "  Felt slower than that ",
      scores: scoreSnapshot(RESULT),
      now,
    });
    expect(row).toMatchObject({
      user_id: "u1",
      client_id: KEY,
      rep_id: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      answer: "no",
      note: "Felt slower than that",
      updated_at: "2026-10-30T09:15:00.000Z",
    });
    expect(row.scores.index).toBe(665);
  });

  it("drops the note when the answer moves to Yes", () => {
    const row = feedbackRow({ userId: "u1", clientId: KEY, repId: null, answer: "yes", note: "old", scores: scoreSnapshot(RESULT) });
    expect(row.note).toBeNull();
  });

  it("keeps a rep id only when it is a uuid, so the row is never refused for it", () => {
    const row = feedbackRow({ userId: "u1", clientId: KEY, repId: "rep-live", answer: "yes", note: null, scores: scoreSnapshot(RESULT) });
    expect(row.rep_id).toBeNull();
  });
});

/**
 * The server stores the version a tester agreed to, so the version has
 * to mean one text. Change a word of the consent and this fails until
 * CONSENT_VERSION goes up and the fingerprint below is updated with it.
 */
const CONSENT_FINGERPRINTS: Record<number, string> = {
  1: "d31d36a2b184bb3a",
};

describe("the consent", () => {
  it("is the text its version says it is", () => {
    const fingerprint = createHash("sha256").update(JSON.stringify(CONSENT)).digest("hex").slice(0, 16);
    expect(
      fingerprint,
      `The consent text changed: raise CONSENT_VERSION in content/tester.ts and pin ${fingerprint} under it here`
    ).toBe(CONSENT_FINGERPRINTS[CONSENT_VERSION]);
  });

  it("says what is collected, what for, who sees it, how to delete it, and the parent", () => {
    const text = CONSENT.items.map((i) => `${i.lead} ${i.text}`).join(" ");
    for (const must of [/recordings/, /transcripts/, /scores/, /answer/, /accurate/, /Only Timothy/, /shared or sold/, /deleted, any time/, /Deleting your account in Settings/, /Under 18/, /parent/]) {
      expect(text).toMatch(must);
    }
  });
});

/** COPY-RULES.md, on every tester string. */
describe("tester copy", () => {
  const all = (o: unknown): string[] =>
    typeof o === "string"
      ? [o]
      : typeof o === "function"
        ? [String((o as (s: string) => string)("30 October"))]
        : Array.isArray(o)
          ? o.flatMap(all)
          : o && typeof o === "object"
            ? Object.values(o).flatMap(all)
            : [];
  const strings = all([CONSENT, CODE_COPY, JOINED_COPY, MATCH_COPY, DOOR_COPY]);

  it("has no em dash", () => {
    expect(strings.filter((s) => s.includes("—"))).toEqual([]);
  });

  it("keeps the words that are not Ethos out", () => {
    const banned = /\b(gym|workout|drill|reps?|training|confiden\w*)\b/i;
    expect(strings.filter((s) => banned.test(s))).toEqual([]);
  });

  // The decline is the app's own "Not now" (the account ask's), a door's
  // name rather than a sentence, so the count is the prose.
  it("holds one negation on the consent screen", () => {
    const consent = [CONSENT.title, CONSENT.line, ...CONSENT.items.flatMap((i) => [i.lead, i.text]), CONSENT.agree].join(" ");
    expect(consent.match(/\b(not|never|nothing|nobody|no one|isn't|aren't|don't|doesn't|won't|can't|without)\b/gi)).toEqual(["Nothing"]);
  });
});
