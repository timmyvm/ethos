import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where a sign-in lands, and what it says (#497). Timothy, 17 Nov: "If i
 * sign up it wont take me to it ... if u sign into an account that
 * somehow hasnt done the onboarding make them onboard. email or google
 * make them onboard."
 *
 * The account's onboarding row is a fake: `remote` is the row, or
 * "fail" for a read that throws.
 */
const fake: { remote: object | null | "fail"; upserts: object[] } = { remote: null, upserts: [] };

vi.mock("./client-data", () => ({
  fetchOnboarding: async () => {
    if (fake.remote === "fail") throw new Error("offline");
    return fake.remote;
  },
  fetchProfile: async () => ({ display_name: "Tim" }),
  updateDisplayName: async () => true,
  upsertOnboarding: async (row: object) => {
    fake.upserts.push(row);
    return true;
  },
}));

import { introFinished } from "./answers-sync";
import {
  AUTH_NOTE,
  AUTH_NOTE_KEY,
  INTRO_PATH,
  landAfterAuth,
  landingAfterAuth,
  noteFor,
  takeAuthNote,
} from "./auth-landing";
import { readOnboarding, writeOnboarding } from "./answers";

function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const ROW = {
  age_band: "18_24",
  goal: "feet",
  pains: ["fillers"],
  level: "sometimes",
  context: "work",
  reminder_hour: 18,
  portfolio: {},
  rules_version: 1,
};

beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  fake.remote = null;
  fake.upserts = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("where a sign-in lands", () => {
  it("sends an account that has not done the introduction to it, the room first", () => {
    expect(landingAfterAuth(false, null)).toBe(INTRO_PATH);
    // Even when a page asked for the account: the introduction comes first.
    expect(landingAfterAuth(false, "/history")).toBe(INTRO_PATH);
  });

  it("sends a finished one where it was going, as before", () => {
    expect(landingAfterAuth(true, null)).toBe("/");
    expect(landingAfterAuth(true, "/history?paywall=1")).toBe("/history?paywall=1");
  });

  it("never guesses: an account it could not read goes where it was going", () => {
    expect(landingAfterAuth(null, null)).toBe("/");
    expect(landingAfterAuth(null, "/history")).toBe("/history");
  });
});

describe("introFinished: the account's row and this device's walk, merged", () => {
  it("email sign-in, finished: the account's row comes down, so the walk opens on its plan", async () => {
    fake.remote = ROW;
    expect(await introFinished()).toBe(true);
    const s = readOnboarding();
    expect(s.done).toBe(true);
    expect(s.synced).toBe(true);
    expect(s.answers.goal).toBe("feet");
  });

  it("email sign-in, not finished: no row and no finished walk here", async () => {
    expect(await introFinished()).toBe(false);
    expect(readOnboarding().done).toBe(false);
  });

  it("a walk left part way on this device yields to an account that finished elsewhere", async () => {
    writeOnboarding({ answers: { ...readOnboarding().answers, name: "Tim" }, step: 2 });
    fake.remote = ROW;
    expect(await introFinished()).toBe(true);
    expect(readOnboarding().done).toBe(true);
  });

  it("a guest who finished on this device counts as finished, and the walk goes up to the account", async () => {
    writeOnboarding({ answers: { ...readOnboarding().answers, name: "Tim", goal: "feet" }, done: true });
    expect(await introFinished()).toBe(true);
    expect(fake.upserts).toHaveLength(1);
  });

  it("an account it cannot read is not called unfinished", async () => {
    fake.remote = "fail";
    expect(await introFinished()).toBeNull();
  });
});

describe("the line the landing says, once", () => {
  it("names which account this was", () => {
    expect(noteFor("signin", "existing")).toBe("signedIn");
    expect(noteFor("signin", undefined)).toBe("signedIn");
    expect(noteFor("signup", "existing")).toBe("existing");
    expect(noteFor("signup", "new")).toBe("created");
    expect(AUTH_NOTE.signedIn).toBe("Signed in to your account.");
    expect(AUTH_NOTE.existing).toBe("That email already has an account, so you're signed in.");
    expect(AUTH_NOTE.created).toBe("Account created.");
  });

  it("is short, plain and dashless", () => {
    for (const line of Object.values(AUTH_NOTE)) {
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(10);
      expect(line).not.toMatch(/[—–!]/);
    }
  });

  it("is taken once: the landing reads it and a reload says nothing", async () => {
    fake.remote = ROW;
    expect(await landAfterAuth(null, "existing")).toBe("/");
    expect(sessionStorage.getItem(AUTH_NOTE_KEY)).toBe("existing");
    expect(takeAuthNote()).toBe(AUTH_NOTE.existing);
    expect(takeAuthNote()).toBeNull();
  });

  it("goes to the introduction for an unfinished account, and says it there", async () => {
    expect(await landAfterAuth("/history", "created")).toBe(INTRO_PATH);
    expect(takeAuthNote()).toBe("Account created.");
  });

  it("ignores anything else left under its key", () => {
    sessionStorage.setItem(AUTH_NOTE_KEY, "toString");
    expect(takeAuthNote()).toBeNull();
  });
});
