import { describe, expect, it } from "vitest";
import {
  EMAIL_ASKED_MS,
  SIGNED_OUT_HOME,
  accountState,
  backStays,
  emailAskedFor,
  introFirst,
  needsAccount,
  openWithoutAccount,
} from "./account-gate";

const guest = { signedIn: true, anonymous: true, pendingEmail: false };
const account = { signedIn: true, anonymous: false, pendingEmail: false };
const none = { signedIn: false, anonymous: false, pendingEmail: false };

describe("an account before the app (#410)", () => {
  it("sends a guest to sign up from anywhere in the app", () => {
    for (const path of ["/", "/rep?lesson=f1", "/lessons", "/you", "/settings", "/log"]) {
      expect(needsAccount(guest, path, false)).toBe(true);
    }
  });

  it("sends a device with no session too, once it has been through the introduction", () => {
    expect(needsAccount(none, "/", false)).toBe(true);
    expect(needsAccount(none, "/", true)).toBe(false);
  });

  it("lets an account through", () => {
    expect(needsAccount(account, "/rep?lesson=f1", false)).toBe(false);
  });

  it("lets a guest through whose email link is on its way", () => {
    expect(needsAccount({ ...guest, pendingEmail: true }, "/rep", false)).toBe(false);
  });

  it("keeps the introduction, sign-up, the tester door and the reading pages open", () => {
    for (const path of ["/welcome", "/signup?next=%2F", "/signin", "/auth/callback", "/auth/reset?first=1", "/tester", "/tester?from=welcome", "/about", "/privacy", "/terms"]) {
      expect(openWithoutAccount(path)).toBe(true);
      expect(needsAccount(guest, path, false)).toBe(false);
    }
  });

  it("does not open a path that only starts with the same letters", () => {
    expect(openWithoutAccount("/testers-secret")).toBe(false);
    expect(openWithoutAccount("/signupx")).toBe(false);
  });
});

describe("the gate never signs out an account it cannot reach", () => {
  const user = { id: "u1", is_anonymous: false };

  it("says nothing when getSession could not refresh a lapsed token", () => {
    // auth-js answers offline (or with the auth server down) with no
    // session AND an error, while the session is still stored.
    expect(accountState({ data: { session: null }, error: new Error("Failed to fetch") })).toBeNull();
  });

  it("reads a stored session, and no session, as before", () => {
    expect(accountState({ data: { session: { user } }, error: null })).toEqual(account);
    expect(accountState({ data: { session: { user: { ...user, is_anonymous: true } } }, error: null })).toEqual(guest);
    expect(
      accountState({ data: { session: { user: { ...user, is_anonymous: true, new_email: "a@b.co" } } }, error: null })
    ).toEqual({ ...guest, pendingEmail: true });
    expect(accountState({ data: { session: null }, error: null })).toEqual(none);
  });
});

describe("a fresh device opened on any screen", () => {
  it("goes through the introduction first, not only from Today", () => {
    for (const path of ["/", "/rep", "/lessons", "/history", "/words"]) {
      expect(introFirst(path, true)).toBe(true);
    }
  });

  it("stays on the screens open without an account, and once it is not fresh", () => {
    for (const path of ["/welcome", "/tester", "/signin", "/about", "/privacy"]) {
      expect(introFirst(path, true)).toBe(false);
    }
    expect(introFirst("/rep", false)).toBe(false);
  });
});

describe("an auth screen's way back", () => {
  it("is not offered where the gate would send the person straight back", () => {
    expect(backStays(guest, "/history", false)).toBe(false);
    expect(backStays(guest, "/", false)).toBe(false);
    expect(backStays(none, "/rep?lesson=f1", false)).toBe(false);
  });

  it("is offered where they can stay", () => {
    expect(backStays(account, "/history", false)).toBe(true);
    expect(backStays({ ...guest, pendingEmail: true }, "/", false)).toBe(true);
    expect(backStays(guest, "/about", false)).toBe(true);
    expect(backStays(guest, "/tester?from=welcome", false)).toBe(true);
    // A fresh device goes on to the introduction, not back here.
    expect(backStays(none, "/", true)).toBe(true);
    // A state nobody could read keeps it.
    expect(backStays(null, "/history", false)).toBe(true);
  });
});

describe("a guest whose email account timed out at the server", () => {
  const now = 1_793_878_000_000;
  const flag = JSON.stringify({ user: "g1", at: now - 60_000 });
  const guestUser = { id: "g1", is_anonymous: true };

  it("is let through like a guest whose link is on its way", () => {
    expect(accountState({ data: { session: { user: guestUser } }, error: null }, flag, now)).toEqual({
      ...guest,
      pendingEmail: true,
    });
  });

  it("only for that guest, and only while the link lives", () => {
    expect(emailAskedFor(flag, "g1", now)).toBe(true);
    expect(emailAskedFor(flag, "someone-else", now)).toBe(false);
    expect(emailAskedFor(flag, "g1", now - 60_000 + EMAIL_ASKED_MS)).toBe(false);
    expect(emailAskedFor("not json", "g1", now)).toBe(false);
    expect(emailAskedFor(null, "g1", now)).toBe(false);
    expect(accountState({ data: { session: null }, error: null }, flag, now)).toEqual(none);
  });
});

describe("signing out", () => {
  it("lands where a signed-out device is not sent to sign up", () => {
    expect(SIGNED_OUT_HOME).toBe("/signin");
    expect(needsAccount(none, SIGNED_OUT_HOME, false)).toBe(false);
    expect(needsAccount(none, "/", false)).toBe(true);
  });
});
