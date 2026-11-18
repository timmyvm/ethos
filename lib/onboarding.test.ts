import { describe, expect, it } from "vitest";
import {
  ACCOUNT_LINE,
  accountIn,
  GATE_STREAK,
  gateMoment,
  isFirstRun,
  PLAN_COPY,
  QUESTIONS,
  ROAD_INVITE,
  ROAD_INVITE_STEP,
  roomDue,
  WELCOMED_KEY,
} from "./onboarding";

/*
 * The guide (#501, #501 review): the last two screens before the first
 * recording each say it comes next, and /you counts the questions it
 * opens on truthfully.
 */
describe("the walk's guide to the first recording", () => {
  it("the plan and the account ask both say the 60 seconds come next", () => {
    for (const line of [PLAN_COPY.next, PLAN_COPY.start, ACCOUNT_LINE]) expect(line).toMatch(/speak for 60 seconds\.$/);
  });

  it("/you's way into an unfinished walk counts the questions it opens on", () => {
    const from = QUESTIONS.findIndex((q) => q.id === ROAD_INVITE_STEP);
    const words = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    expect(from).toBeGreaterThanOrEqual(0);
    expect(ROAD_INVITE.startsWith(`${words[QUESTIONS.length - from - 1]} questions`)).toBe(true);
  });
});

/**
 * The room (#475): a first run opens on it, and so does anyone whose
 * introduction is not finished, signed in or not (#497).
 */
describe("roomDue", () => {
  const fresh = { asked: null, done: false, step: 0 };

  it("opens on the room for anyone whose introduction is not finished, a session or none (#497)", () => {
    // `done` is the device's walk, merged with the account's row at
    // sign-in (lib/auth-landing.ts): a session is no longer read here.
    expect(roomDue(fresh)).toBe(true);
  });

  it("never opens on a finished introduction, whoever is signed in", () => {
    expect(roomDue({ ...fresh, done: true })).toBe(false);
  });

  it("never opens past the room: a refresh on the name lands on the name", () => {
    expect(roomDue({ ...fresh, step: 1 })).toBe(false);
    expect(roomDue({ ...fresh, step: 4 })).toBe(false);
  });

  it("never opens on a deep link into the walk", () => {
    expect(roomDue({ ...fresh, asked: "plan" })).toBe(false);
    expect(roomDue({ ...fresh, asked: "ageBand" })).toBe(false);
  });
});

/** The door's Sign in and Tester code are for someone without an account (#497). */
describe("accountIn", () => {
  const stored = (user: object | null) => JSON.stringify({ access_token: "t", refresh_token: "r", user });

  it("is an account's stored session", () => {
    expect(accountIn([["sb-abc-auth-token", stored({ id: "u1", is_anonymous: false })]])).toBe(true);
    expect(accountIn([[WELCOMED_KEY, "x"], ["sb-supabase.local-auth-token", stored({ id: "u1" })]])).toBe(true);
  });

  it("is not a guest's session, nor none, nor something unreadable", () => {
    expect(accountIn([["sb-abc-auth-token", stored({ id: "g1", is_anonymous: true })]])).toBe(false);
    expect(accountIn([])).toBe(false);
    expect(accountIn([["sb-abc-auth-token", null]])).toBe(false);
    expect(accountIn([["sb-abc-auth-token", "not json"]])).toBe(false);
    expect(accountIn([["sb-abc-auth-token", stored(null)]])).toBe(false);
    expect(accountIn([["ethos.session", stored({ id: "u1" })]])).toBe(false);
  });
});

/**
 * The first-session pathway (DECISIONS #133–#134). These assert the two
 * properties the funnel depends on: a returning device is never bounced
 * into the intro, and the save-progress wall fires exactly at its two
 * moments and only for sessions that have something to lose.
 */

describe("isFirstRun", () => {
  it("treats an empty browser as a first run", () => {
    expect(isFirstRun([])).toBe(true);
  });

  it("ignores unrelated keys", () => {
    expect(isFirstRun(["ethos.prefs", "theme"])).toBe(true);
  });

  it("is not a first run once welcomed", () => {
    expect(isFirstRun([WELCOMED_KEY])).toBe(false);
  });

  /**
   * The flag shipped after real devices already had sessions. A device
   * with a Supabase session predates the flag and must not see the
   * intro — the token IS the proof it has been here.
   */
  it("is not a first run when a Supabase session exists", () => {
    expect(isFirstRun(["sb-abcdefgh-auth-token"])).toBe(false);
  });

  it("does not mistake other sb- keys for a session", () => {
    expect(isFirstRun(["sb-something-else"])).toBe(true);
  });

  /** Signing out clears the token but the welcomed flag stays. */
  it("stays welcomed after sign-out", () => {
    expect(isFirstRun([WELCOMED_KEY, "ethos.prefs"])).toBe(false);
  });
});

describe("gateMoment", () => {
  const none = { rep1: false, streak: false };

  it("never fires for a signed-up account", () => {
    expect(
      gateMoment({
        anonymous: false,
        repCountBefore: 0,
        streakNow: 10,
        shown: none,
      })
    ).toBeNull();
  });

  it("fires the rep-1 wall after the first rep", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 0,
        streakNow: 1,
        shown: none,
      })
    ).toBe("rep1");
  });

  it("does not repeat the rep-1 wall", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 0,
        streakNow: 1,
        shown: { rep1: true, streak: false },
      })
    ).toBeNull();
  });

  /**
   * An unknown rep count never gets the rep-1 wall — if the fetch
   * failed we cannot know this was the first rep, and a wall shown to
   * the wrong person reads as a broken app rather than an offer.
   */
  it("skips the rep-1 wall when the count is unknown", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: null,
        streakNow: 1,
        shown: none,
      })
    ).toBeNull();
  });

  it(`fires the streak wall at ${GATE_STREAK} days`, () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 2,
        streakNow: GATE_STREAK,
        shown: { rep1: true, streak: false },
      })
    ).toBe("streak");
  });

  /** Declined at rep 1, kept going: the second ask still lands. */
  it("fires the streak wall late if it was never shown", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 6,
        streakNow: GATE_STREAK + 2,
        shown: { rep1: true, streak: false },
      })
    ).toBe("streak");
  });

  it("goes quiet once both have shown", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 9,
        streakNow: 30,
        shown: { rep1: true, streak: true },
      })
    ).toBeNull();
  });

  it("prefers the rep-1 wall when both are due", () => {
    expect(
      gateMoment({
        anonymous: true,
        repCountBefore: 0,
        streakNow: GATE_STREAK,
        shown: none,
      })
    ).toBe("rep1");
  });
});
