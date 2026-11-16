import { describe, expect, it } from "vitest";
import { GATE_STREAK, gateMoment, isFirstRun, roomDue, WELCOMED_KEY } from "./onboarding";

/**
 * The room (#475): a first run opens on it, and nobody else sees it.
 */
describe("roomDue", () => {
  const fresh = { asked: null, done: false, step: 0, keys: [] as string[] };

  it("opens a first run on the room", () => {
    expect(roomDue(fresh)).toBe(true);
    // The walk marks the browser welcomed on mount: the room still plays.
    expect(roomDue({ ...fresh, keys: [WELCOMED_KEY, "ethos.prefs"] })).toBe(true);
  });

  it("never opens for someone signed in, or anyone holding a session", () => {
    expect(roomDue({ ...fresh, keys: ["sb-abcdefgh-auth-token"] })).toBe(false);
  });

  it("never opens on a finished introduction", () => {
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
