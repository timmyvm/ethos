import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where a sign-in lands, and what it says (#497). Timothy, 17 Nov: "If i
 * sign up it wont take me to it ... if u sign into an account that
 * somehow hasnt done the onboarding make them onboard. email or google
 * make them onboard."
 *
 * The host is a fake. `user` is the session this device holds (a user
 * id, or null when signed out). Each account's onboarding row is in
 * `rows` by user id; `remote` stands in for any account not named
 * there, and "fail" is a read that throws. An upsert lands in the
 * signed-in account's row, as the database's owner policy puts it.
 */
type Row = object | null | "fail";
const fake: {
  user: string | null;
  remote: Row;
  rows: Record<string, Row>;
  upserts: (object & { to?: string | null })[];
  upsertOk: boolean;
} = { user: "acct-a", remote: null, rows: {}, upserts: [], upsertOk: true };
const rowOf = (): Row => (fake.user !== null && fake.user in fake.rows ? fake.rows[fake.user] : fake.remote);

vi.mock("./supabase-browser", () => ({
  currentSession: async () => (fake.user ? { userId: fake.user, token: `token-${fake.user}` } : null),
}));

vi.mock("./client-data", () => ({
  fetchOnboarding: async () => {
    if (!fake.user) return null;
    const row = rowOf();
    if (row === "fail") throw new Error("offline");
    return row;
  },
  fetchProfile: async () => ({ display_name: "Tim" }),
  updateDisplayName: async () => true,
  upsertOnboarding: async (row: object) => {
    if (!fake.user || !fake.upsertOk) return false;
    fake.upserts.push({ ...row, to: fake.user });
    fake.rows[fake.user] = row;
    return true;
  },
}));

import { introFinished, syncOnboarding } from "./answers-sync";
import {
  AUTH_NOTE,
  AUTH_NOTE_KEY,
  finishedWithin,
  INTRO_PATH,
  landAfterAuth,
  landingAfterAuth,
  noteFor,
  takeAuthNote,
} from "./auth-landing";
import { MAX_SYNCED_TO, readOnboarding, writeOnboarding } from "./answers";

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
  fake.user = "acct-a";
  fake.remote = null;
  fake.rows = {};
  fake.upserts = [];
  fake.upsertOk = true;
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

/*
 * #499: the mark that says the walk went up is per account, not per
 * device. Once a guest's finished walk reached account A, signing into
 * account B here found the device marked synced, B got nothing, and #497
 * sent B through the introduction on the next device it signed into.
 */
describe("one finished walk on this device, every account it signs into (#499)", () => {
  /** A guest's walk, finished on this device and not yet sent anywhere. */
  const finishHere = () =>
    writeOnboarding({ answers: { ...readOnboarding().answers, name: "Tim", goal: "feet", level: "some" }, step: 9, done: true });
  const to = (who: string) => fake.upserts.filter((u) => u.to === who);
  /** Email: the form's landing. Google: the callback's read. Both ask introFinished. */
  const email = (as: string) => {
    fake.user = as;
    return landAfterAuth(null, "signedIn");
  };
  const google = (as: string) => {
    fake.user = as;
    return finishedWithin();
  };
  const signOut = () => {
    fake.user = null;
  };

  it("email into A, sign out, Google into B: each account gets the walk once, and neither is sent through it", async () => {
    finishHere();
    expect(await email("acct-a")).toBe("/");
    expect(to("acct-a")).toHaveLength(1);
    signOut();
    // Signed out, nobody hears the walk, and it stays this device's.
    await syncOnboarding();
    expect(fake.upserts).toHaveLength(1);
    expect(readOnboarding().done).toBe(true);
    expect(await google("acct-b")).toBe(true);
    expect(to("acct-b")).toHaveLength(1);
    expect(to("acct-b")[0]).toMatchObject({ goal: "feet", level: "some" });
    expect(readOnboarding().syncedTo).toEqual(["acct-a", "acct-b"]);
    // Once: Today's sync, a second landing, a return to A send nothing more.
    await syncOnboarding();
    expect(await google("acct-b")).toBe(true);
    expect(await email("acct-a")).toBe("/");
    expect(fake.upserts).toHaveLength(2);
  });

  it("Google into A, then email into B: the same, the other way round", async () => {
    finishHere();
    expect(await google("acct-a")).toBe(true);
    signOut();
    expect(await email("acct-b")).toBe("/");
    expect(to("acct-a")).toHaveLength(1);
    expect(to("acct-b")).toHaveLength(1);
  });

  it("the guest's own session heard it first, and the account it signs into still gets it", async () => {
    finishHere();
    fake.user = "guest-1";
    await syncOnboarding(); // Today, as a guest: the walk goes up to the guest's session
    expect(to("guest-1")).toHaveLength(1);
    expect(await email("acct-a")).toBe("/");
    expect(to("acct-a")).toHaveLength(1);
  });

  it("B on the next device is not sent through the introduction: B holds the walk now", async () => {
    finishHere();
    await email("acct-a");
    signOut();
    await google("acct-b");
    // A new phone: nothing on it, B's row on the account.
    vi.stubGlobal("localStorage", storage());
    expect(await google("acct-b")).toBe(true);
    expect(readOnboarding()).toMatchObject({ done: true, synced: true, syncedTo: ["acct-b"] });
    expect(readOnboarding().answers.goal).toBe("feet");
  });

  it("an account that finished the introduction itself keeps its own, by email or Google", async () => {
    finishHere();
    await email("acct-a");
    signOut();
    fake.rows["acct-c"] = ROW;
    fake.rows["acct-d"] = ROW;
    expect(await email("acct-c")).toBe("/");
    signOut();
    expect(await google("acct-d")).toBe(true);
    expect(to("acct-c")).toHaveLength(0);
    expect(to("acct-d")).toHaveLength(0);
    expect(fake.rows["acct-c"]).toBe(ROW);
    // Settled with both: a later sync reads nothing more and writes nothing.
    await syncOnboarding();
    fake.user = "acct-c";
    await syncOnboarding();
    expect(fake.upserts).toHaveLength(1);
    expect(readOnboarding().syncedTo).toEqual(["acct-a", "acct-c", "acct-d"]);
  });

  it("a walk that never went up, met by an account with its own, is not written over it on the next sync", async () => {
    finishHere(); // synced false: nothing has heard it yet
    fake.rows["acct-c"] = ROW;
    expect(await email("acct-c")).toBe("/");
    await syncOnboarding();
    await syncOnboarding();
    expect(fake.upserts).toHaveLength(0);
    // And the next account with nothing still gets it.
    signOut();
    expect(await google("acct-b")).toBe(true);
    expect(to("acct-b")).toHaveLength(1);
  });

  it("a change made here goes up to the account it was made under, and to no other", async () => {
    finishHere();
    await email("acct-a");
    signOut();
    await google("acct-b");
    // Settings, signed in to B: a changed answer, then its sync.
    writeOnboarding({ answers: { ...readOnboarding().answers, goal: "present" } });
    const after = await syncOnboarding();
    expect(after.synced).toBe(true);
    expect(to("acct-b").at(-1)).toMatchObject({ goal: "present" });
    // A signs in again: settled with A already, nothing is pending, nothing is sent.
    signOut();
    await email("acct-a");
    expect(to("acct-a")).toHaveLength(1);
  });

  it("an account it cannot read is asked again next time, never written over blind", async () => {
    finishHere();
    fake.rows["acct-a"] = "fail";
    expect(await email("acct-a")).toBe("/");
    expect(fake.upserts).toHaveLength(0);
    expect(readOnboarding().syncedTo).toEqual([]);
    fake.rows["acct-a"] = null;
    await syncOnboarding();
    expect(to("acct-a")).toHaveLength(1);
  });

  it("a send that fails leaves the account unsettled, and the next sync sends it", async () => {
    finishHere();
    fake.upsertOk = false;
    expect(await email("acct-a")).toBe("/");
    expect(readOnboarding().syncedTo).toEqual([]);
    fake.upsertOk = true;
    await syncOnboarding();
    expect(readOnboarding().syncedTo).toEqual(["acct-a"]);
  });

  it("a device marked synced before #499, with no accounts named, gives the walk to an account without one and keeps one that has", async () => {
    localStorage.setItem(
      "ethos.onboarding",
      JSON.stringify({ answers: { name: "Tim", goal: "feet", pains: [] }, step: 9, done: true, synced: true, walk: 2 })
    );
    fake.rows["acct-a"] = ROW; // the account it went up to then
    expect(await email("acct-a")).toBe("/");
    expect(fake.upserts).toHaveLength(0);
    signOut();
    expect(await google("acct-b")).toBe(true);
    expect(to("acct-b")).toHaveLength(1);
  });

  it("an account whose walk came down onto this device is settled with it", async () => {
    fake.rows["acct-a"] = ROW;
    expect(await email("acct-a")).toBe("/");
    expect(readOnboarding().syncedTo).toEqual(["acct-a"]);
    await syncOnboarding();
    expect(fake.upserts).toHaveLength(0);
    // The next account with nothing gets the walk that came down.
    signOut();
    expect(await google("acct-b")).toBe(true);
    expect(to("acct-b")[0]).toMatchObject({ goal: "feet" });
  });

  it("the accounts it remembers are capped, newest kept", () => {
    const ids = Array.from({ length: MAX_SYNCED_TO + 5 }, (_, i) => `acct-${i}`);
    writeOnboarding({ syncedTo: [...ids, "acct-0", 7 as never, ""] });
    const kept = readOnboarding().syncedTo;
    expect(kept).toHaveLength(MAX_SYNCED_TO);
    expect(kept.at(-1)).toBe("acct-0");
    expect(new Set(kept).size).toBe(kept.length);
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
