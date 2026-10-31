import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODE_COPY, CONSENT, CONSENT_VERSION, DOOR_COPY, FELT_COPY, JOINED_COPY, MATCH_COPY, PAUSED_COPY, TEST_COPY } from "@/content/tester";
import {
  askedFrom,
  asksForNote,
  cleanNote,
  codeDigits,
  codeReady,
  feedbackRow,
  FELT_ANSWERS,
  feltRow,
  isCurrentTester,
  isMatchAnswer,
  MATCH_ANSWERS,
  NOTE_MAX,
  pausedTester,
  sameSave,
  scoreSnapshot,
  showsMatchCheck,
  storedSnapshotInput,
  testerNumber,
  withoutPending,
  withPending,
  type SnapshotInput,
} from "./tester";

const TESTER = { consent_version: CONSENT_VERSION, consented_at: "2026-10-30T09:00:00.000Z" };
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

  /* The final check of 30 Oct: the field's maxLength cut a paste to its
     first four characters before the digits were picked out, so " 1234"
     copied from a message landed as 123 and "Code: 1234" as nothing.
     codeDigits keeps four; the field must not cut first. */
  it("takes a pasted code whole, leaving the four-digit cap to codeDigits", () => {
    const field = readFileSync("app/tester/page.tsx", "utf8").match(/<input\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(field).toMatch(/name="tester-code"/);
    expect(field).toMatch(/onChange=\{\(e\) => onChange\(codeDigits\(e\.target\.value\)\)\}/);
    expect(field).not.toMatch(/maxLength=/);
    expect(codeDigits(" 1234")).toBe("1234");
    expect(codeDigits("Code: 1234")).toBe("1234");
  });
});

describe("the tester number's Send", () => {
  /* A live region inside a button takes the button's name with it:
     Chrome named it "" and VoiceOver read "button". The key's name is
     its own (the word it shows, then whose number to whom), and "Sent"
     or "Copied" is said by a status beside it (#402). */
  it("keeps its name, and says Sent or Copied from outside the key", () => {
    const send = readFileSync("components/tester/SendNumber.tsx", "utf8");
    const buttons = send.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).not.toMatch(/role="status"|aria-live/);
    expect(buttons[0]).toMatch(/aria-label=\{canShare \? TEST_COPY\.sendLabel : TEST_COPY\.copyLabel\}/);
    expect(send).toMatch(/<\/button>\s*<span role="status" className="sr-only">/);
  });

  it("is what the tester page and Today's tile give the number", () => {
    expect(readFileSync("app/tester/page.tsx", "utf8")).toMatch(/<SendNumber number=\{number\}/);
    expect(readFileSync("components/tester/TestTile.tsx", "utf8")).toMatch(/<SendNumber number=\{number\} surface="tile"/);
  });
});

describe("the tester page from Settings", () => {
  /* The final check of 30 Oct: opened from Settings' About group, the
     page read the account first behind an empty main, and when its
     words landed Chrome's scroll anchoring carried Settings' scroll in:
     it opened 50 to 84px down, the title cut and the back link off
     screen. Once the read lands, it stands at its top. */
  it("opens at its top once the account's row is read", () => {
    const page = readFileSync("app/tester/page.tsx", "utf8");
    expect(page).toMatch(
      /useLayoutEffect\(\(\) => \{\s*if \(!reading\) window\.scrollTo\(0, 0\);\s*\}, \[reading\]\);/
    );
  });
});

describe("who sees the match check", () => {
  it("a tester, on a scored recording with its key", () => {
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: KEY })).toBe(true);
  });

  /*
   * A tester who agreed to an older consent is asked again before
   * anything more is kept (0021 refuses their answers too): the question
   * waits until they have read the one that names the services.
   */
  it("not a tester whose consent is older than the one on screen", () => {
    const older = { ...TESTER, consent_version: CONSENT_VERSION - 1 };
    expect(isCurrentTester(older)).toBe(false);
    expect(isCurrentTester(TESTER)).toBe(true);
    expect(isCurrentTester(null)).toBe(false);
    expect(showsMatchCheck({ tester: older, scorable: true, clientId: KEY })).toBe(false);
  });

  it("nobody else: a non-tester, an unknown state, an unscored take, no key", () => {
    expect(showsMatchCheck({ tester: null, scorable: true, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: undefined, scorable: true, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: false, clientId: KEY })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: null })).toBe(false);
    expect(showsMatchCheck({ tester: TESTER, scorable: true, clientId: "has spaces" })).toBe(false);
  });
});

/*
 * The tester number: how a friend tells Timothy which row in the report
 * is theirs (to be paid, to have it all deleted, for the parent's text).
 * The first eight characters of the account's id, in two groups, read
 * the same way by the guide's query (docs/testers.md).
 */
describe("the tester number", () => {
  it("is the account id's first eight characters, in capitals, in two fours", () => {
    expect(testerNumber("3f9a1c2e-0d4a-4c1e-9a77-3b2f5e8d1c40")).toBe("3F9A 1C2E");
  });

  it("is nothing for something that is not an account id", () => {
    expect(testerNumber("")).toBeNull();
    expect(testerNumber("u1")).toBeNull();
  });
});

describe("the two questions", () => {
  /* 0022: the answer after the score is a direction, so an answer that
     it was off says which way; how it felt is one tap before the score
     shows, so no number can lean on it. */
  it("ask how it felt, then which way the score was off, in the table's words", () => {
    expect(FELT_COPY.options.map((o) => o.value)).toEqual([...FELT_ANSWERS]);
    expect(FELT_COPY.options.map((o) => o.label)).toEqual(["Rough", "Okay", "Strong"]);
    expect(FELT_COPY.question).toBe("How did that feel?");
    expect(MATCH_COPY.options.map((o) => o.value)).toEqual([...MATCH_ANSWERS]);
    expect(MATCH_COPY.options.map((o) => o.label)).toEqual(["Too low", "About right", "Too high"]);
    expect(MATCH_COPY.question).toBe("Did the score feel right?");
    const sql = readFileSync("supabase/migrations/0022_tester_data.sql", "utf8");
    expect(sql).toContain(`felt in (${FELT_ANSWERS.map((a) => `'${a}'`).join(", ")})`);
    for (const a of MATCH_ANSWERS) expect(sql).toContain(`'${a}'`);
  });

  /* Review D2: on the last step the score is two steps back, so the
     question names it; a Too low is then about that number, not
     whichever one the tester remembers. */
  it("names the number it is about, and asks plainly without one", () => {
    expect(MATCH_COPY.questionFor(665)).toBe("Did 665 feel right?");
    expect(MATCH_COPY.questionFor(664.6)).toBe("Did 665 feel right?");
    expect(MATCH_COPY.questionFor(null)).toBe("Did the score feel right?");
    expect(MATCH_COPY.questionFor(undefined)).toBe("Did the score feel right?");
  });

  /* Review D8: one save line for every answer, the words COPY-RULES lists. */
  it("says Answer saved for every answer", () => {
    expect(MATCH_COPY).not.toHaveProperty("saved");
    expect(MATCH_COPY.answerSaved).toBe("Answer saved");
    expect(readFileSync("components/tester/MatchCheck.tsx", "utf8")).not.toMatch(/MATCH_COPY\.saved\b/);
  });

  it("reopen one of 0020's answers as no answer, since it answered another question", () => {
    expect(isMatchAnswer("too_low")).toBe(true);
    for (const old of ["yes", "roughly", "no", null, undefined, 3]) expect(isMatchAnswer(old)).toBe(false);
  });
});

/*
 * Review D1: a tester on an older consent who dismissed the ask once
 * stopped answering and sending for the rest of the test, and nothing
 * said so. Where the questions would be, they read that testing is
 * paused, with the way back to agreeing.
 */
describe("a tester on an older consent", () => {
  const at = "2026-10-30T09:00:00.000Z";
  it("is told testing is paused where the questions would be, and nobody else is", () => {
    expect(pausedTester({ consent_version: CONSENT_VERSION - 1, consented_at: at })).toBe(true);
    expect(pausedTester({ consent_version: 1, consented_at: at })).toBe(true);
    expect(pausedTester({ consent_version: CONSENT_VERSION, consented_at: at })).toBe(false);
    expect(pausedTester(null)).toBe(false);
    expect(pausedTester(undefined)).toBe(false);
    expect(PAUSED_COPY).toEqual({ line: "Testing is paused.", action: "Agree again" });
  });

  it("goes back to the recording's page in the Log after agreeing there", () => {
    expect(askedFrom("/rep/8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c")).toBe("/rep/8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c");
    expect(askedFrom("/rep/not-an-id")).toBe("/");
    expect(askedFrom("/rep")).toBe("/");
  });

  /* Review D7: the ask says what is new, not only that there is more. */
  it("is told what testing now also keeps", () => {
    expect(CONSENT.renewLine).toMatch(/how you use Ethos, your device, your connection and problems/);
  });
});

describe("the note", () => {
  it("opens after Too low and Too high, never after About right", () => {
    expect(MATCH_ANSWERS.filter(asksForNote)).toEqual(["too_low", "too_high"]);
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
      seen: "results",
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

  it("says where it was answered: on results, or later from the Log", () => {
    expect(scoreSnapshot(RESULT).seen).toBe("results");
    expect(scoreSnapshot(RESULT, null, "log").seen).toBe("log");
  });

  it("from a stored recording, the same numbers the Log shows", () => {
    const input = storedSnapshotInput({
      ethos_index: 665,
      stars: 2,
      wpm: 145,
      filler_count: 4,
      duration_s: 62.4,
      pauses: [
        { kind: "pre" },
        { kind: "mid" },
        { kind: "beat" },
        { kind: "mid" },
        { kind: "mid" },
      ],
      dimensions: {
        tier1: RESULT.tier1,
        tier2: {
          structure: { score: 64 },
          credibility: { score: 58 },
          engagement: { score: 61 },
          confidence: { score: 66 },
        },
      },
      capture_mode: "voice",
    });
    const s = scoreSnapshot(input, 71, "log");
    expect(s).toMatchObject({
      index: 665,
      previous: null,
      stars: 2,
      tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66.3 },
      tier2: { structure: 64, credibility: 58, engagement: 61, confidence: 66 },
      presence: 71,
      pauses: 5,
      held: 4,
      judged: true,
      seen: "log",
    });
    // No judged read stored: nothing judged said.
    const bare = storedSnapshotInput({
      ethos_index: null, stars: 1, wpm: 0, filler_count: 0, duration_s: 4,
      pauses: null, dimensions: null, capture_mode: "voice",
    });
    expect(scoreSnapshot(bare, null, "log")).toMatchObject({ index: null, tier2: null, judged: false, pauses: 0 });
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
      clientId: KEY,
      repId: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      answer: "too_low",
      note: "  Felt slower than that ",
      scores: scoreSnapshot(RESULT),
      now,
    });
    expect(row).toMatchObject({
      client_id: KEY,
      rep_id: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      answer: "too_low",
      note: "Felt slower than that",
      updated_at: "2026-10-30T09:15:00.000Z",
    });
    expect(row.scores?.index).toBe(665);
    // How it felt is its own save: this one leaves it as the row has it.
    expect("felt" in row).toBe(false);
  });

  it("drops the note when the answer moves to About right", () => {
    const row = feedbackRow({ clientId: KEY, repId: null, answer: "about_right", note: "old", scores: scoreSnapshot(RESULT) });
    expect(row.note).toBeNull();
  });

  it("sends a rep id only when it is a uuid, so the row is never refused for it, nor a known one cleared", () => {
    const row = feedbackRow({ clientId: KEY, repId: "rep-live", answer: "about_right", note: null, scores: scoreSnapshot(RESULT) });
    expect("rep_id" in row).toBe(false);
    expect("rep_id" in feedbackRow({ clientId: KEY, repId: null, answer: "about_right", note: null, scores: scoreSnapshot(RESULT) })).toBe(false);
  });

  it("how it felt is a row of its own keys: the feeling and the time, never an answer, a note or scores", () => {
    const row = feltRow({ clientId: KEY, repId: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c", felt: "rough", now: new Date("2026-10-30T09:14:00.000Z") });
    expect(row).toEqual({
      client_id: KEY,
      rep_id: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      felt: "rough",
      updated_at: "2026-10-30T09:14:00.000Z",
    });
  });
});

/*
 * D4: an answer that has not landed is kept on the phone, by recording,
 * until a later save lands it. A newer answer for the same recording
 * replaces an older one, and an older one landing never clears a newer.
 */
describe("answers waiting to land", () => {
  const row = (answer: "about_right" | "too_low", at: string, clientId = KEY) =>
    feedbackRow({ clientId, repId: null, answer, note: null, scores: scoreSnapshot(RESULT), now: new Date(at) });

  it("keeps the newest answer per recording", () => {
    const a = row("about_right", "2026-10-30T09:00:00Z");
    const b = row("too_low", "2026-10-30T09:01:00Z");
    const other = row("about_right", "2026-10-30T09:02:00Z", "k-other");
    let m = withPending({}, a);
    m = withPending(m, b);
    m = withPending(m, other);
    expect(Object.keys(m).sort()).toEqual([KEY, "k-other"].sort());
    expect(m[KEY].answer).toBe("too_low");
    // An older one written late never replaces a newer one.
    expect(withPending(m, a)[KEY].answer).toBe("too_low");
  });

  /* How it felt is saved before the score and the answer after it, as
     two saves of one row. If the first never landed, the second carries
     it: nothing said about a recording is lost to a bad connection. */
  it("carries how it felt, still waiting, with the answer after the score", () => {
    const felt = feltRow({ clientId: KEY, repId: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c", felt: "rough", now: new Date("2026-10-30T09:00:00Z") });
    const answer = row("too_low", "2026-10-30T09:01:00Z");
    const m = withPending(withPending({}, felt), answer);
    expect(m[KEY]).toMatchObject({
      felt: "rough",
      answer: "too_low",
      rep_id: "8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c",
      updated_at: answer.updated_at,
    });
    // In either order: a late feeling fills in, and never moves the time back.
    const late = withPending(withPending({}, answer), felt);
    expect(late[KEY]).toMatchObject({ felt: "rough", answer: "too_low", updated_at: answer.updated_at });
    // Landing the merged row lets go of it.
    expect(withoutPending(m, m[KEY])).toEqual({});
  });

  it("lets go of an answer once it landed, and only that one", () => {
    const a = row("about_right", "2026-10-30T09:00:00Z");
    const b = row("too_low", "2026-10-30T09:01:00Z");
    const m = withPending({}, b);
    expect(withoutPending(m, a)).toEqual(m);
    expect(withoutPending(m, b)).toEqual({});
  });
});

/* T6: one tap of Save note right after the field was left is one write. */
describe("a save that would repeat the last one", () => {
  it("is the same answer with the same note, as stored", () => {
    expect(sameSave({ answer: "too_low", note: "Felt fast " }, { answer: "too_low", note: "Felt fast" })).toBe(true);
    expect(sameSave({ answer: "too_low", note: "Felt fast" }, { answer: "too_low", note: "Felt slow" })).toBe(false);
    expect(sameSave({ answer: "too_low", note: "x" }, { answer: "too_high", note: "x" })).toBe(false);
    // About right stores no note, so a note left in the field changes nothing.
    expect(sameSave({ answer: "about_right", note: "" }, { answer: "about_right", note: "left over" })).toBe(true);
    expect(sameSave(null, { answer: "about_right", note: "" })).toBe(false);
  });
});

/**
 * The server stores the version a tester agreed to, so the version has
 * to mean one text. Change a word of the consent and this fails until
 * CONSENT_VERSION goes up and the fingerprint below is updated with it.
 */
const CONSENT_FINGERPRINTS: Record<number, string> = {
  1: "d31d36a2b184bb3a",
  2: "bb38c1a2e720688f",
  // Re-pinned before it shipped (30 Oct, the review of the build that
  // carries it: an upload goes as it is, what stays when they keep using
  // Ethos, what an older consent's tester now also agrees to). Nobody
  // had agreed to version 3 yet: production still shows version 2.
  3: "b1106fce09864f62",
};

describe("the consent", () => {
  it("is the text its version says it is", () => {
    const fingerprint = createHash("sha256").update(JSON.stringify(CONSENT)).digest("hex").slice(0, 16);
    expect(
      fingerprint,
      `The consent text changed: raise CONSENT_VERSION in content/tester.ts and pin ${fingerprint} under it here`
    ).toBe(CONSENT_FINGERPRINTS[CONSENT_VERSION]);
  });

  /*
   * Version 3 is Timothy's full list (30 Oct): consent to a named list
   * holds where a blanket waiver does not, so everything collected is
   * named, with what for, who, how long, how fast it goes when asked,
   * and the parent.
   */
  it("names everything kept, what for, who sees it, how long, deleting it, and the parent", () => {
    const kept = CONSENT.kept.map((i) => i.lead);
    expect(kept).toEqual([
      "Your recordings",
      "Transcripts",
      "Your scores",
      "Your answers",
      "How you use it",
      "Your device",
      "Your connection",
      "Problems",
    ]);
    const text = [...CONSENT.kept, ...CONSENT.items].map((i) => `${i.lead} ${i.text}`).join(" ");
    for (const must of [
      /Every audio recording/, /camera/, /word for word, with timestamps/, /Every score, star, streak and number/,
      /name, age, goal and the hour you picked/, /email/, /every answer and note/,
      /Which screens you open, what you tap, when, and for how long/,
      /Phone model, operating system, browser, screen size, language, time zone/, /home screen/,
      /IP address and basic network info/, /Errors and crashes, and what was on screen/,
      /Making the scores accurate and fixing what breaks/, /Only Timothy/, /Nothing is sold/,
      /services that run the app, named in Privacy/, /12 months after the test/, /deleted within 7 days/,
      /Deleting your account in Settings/, /Under 18/, /parent or guardian/,
      // Review P3: an upload goes as it is; review P2: what stays when they keep using Ethos.
      /every file you upload \(video included\)/, /live camera's video stays on your phone/,
      /If you keep using Ethos, your recordings and scores stay in your account/,
    ]) {
      expect(text).toMatch(must);
    }
  });

  /*
   * Every recording goes through the services Privacy names (OpenAI and
   * Anthropic score it, Supabase and Vercel hold it). Version 1 said
   * "Nothing is shared", which a parent could read as "no company sees
   * it". The consent says where it goes and links the page that names
   * them.
   */
  it("says it goes only to the services Privacy names, and links Privacy", () => {
    const who = CONSENT.items.find((i) => i.lead === "Who sees it")!;
    expect(who.text).toMatch(/goes only to the services that run the app, named in Privacy\.$/);
    expect(who.text).not.toMatch(/shared/);
    expect(who).toMatchObject({ link: { word: "Privacy", href: "/privacy#testers" } });
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
  const strings = all([CONSENT, CODE_COPY, JOINED_COPY, FELT_COPY, MATCH_COPY, PAUSED_COPY, DOOR_COPY, TEST_COPY]);

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
    const consent = [
      CONSENT.title,
      CONSENT.line,
      CONSENT.renewLine,
      CONSENT.keptLead,
      ...[...CONSENT.kept, ...CONSENT.items].flatMap((i) => [i.lead, i.text]),
      CONSENT.agree,
    ].join(" ");
    expect(consent.match(/\b(not|never|nothing|nobody|no one|isn't|aren't|don't|doesn't|won't|can't|without)\b/gi)).toEqual(["Nothing"]);
  });
});
