import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * "If i try sign up instead of sign in just sign me in instead of sending
 * me back" (Timothy, 7 Nov, #426). Sign-up meeting an account that has
 * the email already, in every shape the auth server answers with: the
 * Supabase client is faked as lib/auth.test.ts fakes it, answering the
 * way GoTrue does, and the flow functions are driven from outside.
 */

type Err = { message: string; code?: string; status?: number };
type User = {
  id: string;
  email?: string;
  identities?: unknown[];
  created_at?: string;
  confirmation_sent_at?: string;
  is_anonymous?: boolean;
};

const fake = vi.hoisted(() => ({
  /** The session this device holds. */
  session: null as null | { access_token: string; user: { id: string; is_anonymous: boolean } },
  /** What each call answers. */
  updateError: null as null | Err,
  signUp: { user: null, session: null, error: null } as { user: User | null; session: unknown; error: Err | null },
  signInError: null as null | Err,
  resendError: null as null | Err,
  calls: [] as { call: string; args: unknown }[],
}));

vi.mock("./supabase-browser", () => {
  const auth = {
    getUser: async () => ({ data: { user: fake.session?.user ?? null } }),
    getSession: async () => ({ data: { session: fake.session } }),
    updateUser: async (attrs: unknown, o?: unknown) => {
      fake.calls.push({ call: "updateUser", args: { attrs, o } });
      return { data: { user: null }, error: fake.updateError };
    },
    signUp: async (args: unknown) => {
      fake.calls.push({ call: "signUp", args });
      const { user, session, error } = fake.signUp;
      return error ? { data: { user: null, session: null }, error } : { data: { user, session }, error: null };
    },
    signInWithPassword: async (args: { email: string; password: string }) => {
      fake.calls.push({ call: "signInWithPassword", args });
      if (fake.signInError) return { data: { user: null, session: null }, error: fake.signInError };
      fake.session = { access_token: "tok_account", user: { id: "account", is_anonymous: false } };
      return { data: { user: fake.session.user, session: fake.session }, error: null };
    },
    resend: async (args: unknown) => {
      fake.calls.push({ call: "resend", args });
      return { data: {}, error: fake.resendError };
    },
    signInWithOAuth: async (args: unknown) => {
      fake.calls.push({ call: "signInWithOAuth", args });
      return { data: {}, error: null };
    },
    linkIdentity: async (args: unknown) => {
      fake.calls.push({ call: "linkIdentity", args });
      return { data: {}, error: null };
    },
  };
  return {
    supabaseBrowser: () => ({ auth }),
    currentSession: async () => (fake.session ? { userId: fake.session.user.id, token: fake.session.access_token } : null),
    sessionToken: async () => fake.session?.access_token ?? null,
    ensureSession: async () => fake.session?.access_token ?? null,
  };
});

import {
  EXISTING_COPY,
  OAUTH_KEY,
  callbackWelcome,
  carriedEmail,
  createAccount,
  emailFrom,
  parseOAuthAttempt,
  readOAuthAttempt,
  resentLink,
  signIn,
  signInExisting,
  signInWithGoogle,
  withEmail,
} from "./auth";
import { LINK_CARRY_KEY, LINK_CARRY_TTL_MS, carryKeptForLink, forgetTesterHint } from "./tester-client";

const EMAIL = "tim@example.com";
const PASSWORD = "the right password";
const NEXT = "/you?paywall=1";
const BACK = `https://speakethos.com/auth/callback?next=${encodeURIComponent(NEXT)}`;
/** The link an unconfirmed account gets again lands marked (#426, review). */
const RESENT_BACK = `https://speakethos.com/auth/callback?resent=1&next=${encodeURIComponent(NEXT)}`;
const now = "2026-11-07T09:00:00.000Z";
const called = (name: string) => fake.calls.filter((c) => c.call === name);

/** GoTrue's errors as auth-js hands them over (AuthApiError: message, status, code). */
const EMAIL_EXISTS: Err = { message: "A user with this email address has already been registered", status: 422, code: "email_exists" };
const USER_EXISTS: Err = { message: "User already registered", status: 422, code: "user_already_exists" };
const WRONG: Err = { message: "Invalid login credentials", status: 400, code: "invalid_credentials" };
const UNCONFIRMED: Err = { message: "Email not confirmed", status: 400, code: "email_not_confirmed" };
const TOO_SOON: Err = { message: "For security purposes, you can only request this after 41 seconds.", status: 429, code: "over_email_send_rate_limit" };

function storage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const posts: { body: unknown; auth: string | null }[] = [];

beforeEach(() => {
  fake.session = null;
  fake.updateError = null;
  fake.signUp = { user: null, session: null, error: null };
  fake.signInError = null;
  fake.resendError = null;
  fake.calls = [];
  posts.length = 0;
  vi.stubGlobal("window", { location: { origin: "https://speakethos.com", pathname: "/signup", search: "" } });
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      if (url === "/api/tester") posts.push({ body: JSON.parse(init.body), auth: init.headers.Authorization ?? null });
      return new Response(JSON.stringify({ ok: true, tester: { consent_version: 3, consented_at: now } }), { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const guest = () => {
  fake.session = { access_token: "tok_guest", user: { id: "guest", is_anonymous: true } };
};

describe("a guest signs up with an email that has an account (email_exists)", () => {
  it("asks for that account's password in place, and signs nobody up", async () => {
    guest();
    fake.updateError = EMAIL_EXISTS;
    const r = await createAccount(EMAIL, "", NEXT);
    expect(r).toEqual({ ok: false, existing: true, field: "password" });
    // No line of its own: the form says EXISTING_COPY.ask, never "Sign in instead."
    expect(r.error).toBeUndefined();
    expect(called("updateUser")).toHaveLength(1);
    expect(called("signUp")).toHaveLength(0);
    expect(called("signInWithPassword")).toHaveLength(0);
  });

  it("reads the words when an older auth server sends no code", async () => {
    guest();
    fake.updateError = { message: "A user with this email address has already been registered", status: 422 };
    expect(await createAccount(EMAIL, "", NEXT)).toMatchObject({ existing: true });
  });

  it("keeps every other failure as it was", async () => {
    guest();
    fake.updateError = { message: "Email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" };
    const r = await createAccount(EMAIL, "", NEXT);
    expect(r.existing).toBeUndefined();
    expect(r).toEqual({ ok: false, error: "Too many tries in a row. Give it a minute." });
  });

  it("then signs in with the email typed and its password, carrying testing like any sign-in", async () => {
    guest();
    localStorage.setItem("ethos.tester", "1");
    const r = await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(r).toEqual({ ok: true });
    expect(called("signInWithPassword")).toEqual([{ call: "signInWithPassword", args: { email: EMAIL, password: PASSWORD } }]);
    // The guest's testing rides the sign-in (carried_from), the account's token over the guest's.
    expect(posts).toEqual([{ body: { carry: "tok_guest" }, auth: "Bearer tok_account" }]);
    expect(called("signUp")).toHaveLength(0);
  });

  it("trims the address it signs in with, and never another one", async () => {
    await signInExisting(`  ${EMAIL} `, PASSWORD);
    expect(called("signInWithPassword")[0].args).toEqual({ email: EMAIL, password: PASSWORD });
  });
});

describe("a sign-up with no session meets a confirmed account", () => {
  it("is the obfuscated user (identities: []), so it signs in with the same email and password at once", async () => {
    fake.signUp = {
      user: { id: "0f0f0f0f", email: EMAIL, identities: [], created_at: now, confirmation_sent_at: now },
      session: null,
      error: null,
    };
    const r = await createAccount(EMAIL, PASSWORD, NEXT);
    expect(r).toEqual({ ok: true });
    expect(r.checkInbox).toBeUndefined();
    expect(called("signUp")).toHaveLength(1);
    expect(called("signInWithPassword")).toEqual([{ call: "signInWithPassword", args: { email: EMAIL, password: PASSWORD } }]);
    expect(called("resend")).toHaveLength(0);
  });

  it("is user_already_exists when confirmations are off, and signs in the same way", async () => {
    fake.signUp = { user: null, session: null, error: USER_EXISTS };
    expect(await createAccount(EMAIL, PASSWORD, NEXT)).toEqual({ ok: true });
    expect(called("signInWithPassword")).toHaveLength(1);
  });

  it("with the wrong password stays a sign-in for that email, saying so, and makes nothing", async () => {
    fake.signUp = { user: { id: "0f0f0f0f", email: EMAIL, identities: [] }, session: null, error: null };
    fake.signInError = WRONG;
    const r = await createAccount(EMAIL, "not the password", NEXT);
    expect(r).toEqual({ ok: false, existing: true, error: EXISTING_COPY.mismatch, field: "password" });
    expect(r.error).toMatch(/doesn't match that account/);
    // An account made with Google has no password to type (7 Nov).
    expect(r.error).toMatch(/Google/);
    expect(EXISTING_COPY.ask).toMatch(/has an account/);
    expect(EXISTING_COPY.ask).toMatch(/Google/);
    expect(called("signUp")).toHaveLength(1);
    expect(called("resend")).toHaveLength(0);
  });

  it("checks the password rule first, as any sign-up does", async () => {
    expect(await createAccount(EMAIL, "short", NEXT)).toMatchObject({ ok: false, field: "password" });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("an account that signed up with this email and never confirmed it", () => {
  it("with no session: the sign-up sent its link again (an earlier user), so the inbox says so", async () => {
    fake.signUp = {
      user: {
        id: "u-unconfirmed",
        email: EMAIL,
        identities: [{ provider: "email" }],
        created_at: "2026-11-04T09:00:00.000Z",
        confirmation_sent_at: now,
      },
      session: null,
      error: null,
    };
    const r = await createAccount(EMAIL, PASSWORD, NEXT);
    expect(r).toEqual({ ok: true, checkInbox: true, thenSignIn: true, resent: true });
    expect(called("signInWithPassword")).toHaveLength(0);
  });

  it("with no session, a second try inside the minute: the link is on its way, still the inbox", async () => {
    fake.signUp = { user: null, session: null, error: TOO_SOON };
    expect(await createAccount(EMAIL, PASSWORD, NEXT)).toEqual({ ok: true, checkInbox: true, thenSignIn: true, resent: true });
  });

  it("a guest: the sign-in hears email_not_confirmed and the link goes again, to the callback marked, with next", async () => {
    guest();
    fake.signInError = UNCONFIRMED;
    const r = await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(r).toEqual({ ok: true, checkInbox: true, thenSignIn: true, resent: true });
    expect(called("resend")).toEqual([
      { call: "resend", args: { type: "signup", email: EMAIL, options: { emailRedirectTo: RESENT_BACK } } },
    ]);
    expect(BACK).not.toBe(RESENT_BACK);
  });

  it("a guest whose link went under a minute ago: the inbox, not another wall", async () => {
    guest();
    fake.signInError = UNCONFIRMED;
    fake.resendError = TOO_SOON;
    expect(await signInExisting(EMAIL, PASSWORD, NEXT)).toEqual({ ok: true, checkInbox: true, thenSignIn: true, resent: true });
  });

  it("a resend the server refuses stays on the form with its reason, never looping", async () => {
    guest();
    fake.signInError = UNCONFIRMED;
    fake.resendError = { message: "Email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" };
    expect(await signInExisting(EMAIL, PASSWORD, NEXT)).toEqual({
      ok: false,
      existing: true,
      error: "Too many tries in a row. Give it a minute.",
    });
  });
});

describe("a brand-new email is unchanged", () => {
  it("gets its link and the inbox, nothing signed in, nothing resent", async () => {
    fake.signUp = {
      user: { id: "u-new", email: "new@example.com", identities: [{ provider: "email" }], created_at: now, confirmation_sent_at: now },
      session: null,
      error: null,
    };
    expect(await createAccount("new@example.com", PASSWORD, NEXT)).toEqual({ ok: true, checkInbox: true, thenSignIn: true });
    expect(called("signInWithPassword")).toHaveLength(0);
    expect(called("resend")).toHaveLength(0);
  });

  it("with confirmations off, the new account's own session is signed in already", async () => {
    fake.signUp = {
      user: { id: "u-new", email: "new@example.com", identities: [{ provider: "email" }], created_at: now },
      session: { access_token: "tok_new" },
      error: null,
    };
    expect(await createAccount("new@example.com", PASSWORD)).toEqual({ ok: true });
  });

  it("a guest's new email still goes to the inbox with the password page after it", async () => {
    guest();
    expect(await createAccount("new@example.com", "", NEXT)).toEqual({ ok: true, checkInbox: true });
  });
});

describe("the sign-in itself", () => {
  it("asks for a password before it asks the server", async () => {
    expect(await signInExisting(EMAIL, "")).toEqual({ ok: false, existing: true, error: "Enter your password.", field: "password" });
    expect(fake.calls).toHaveLength(0);
  });

  it("is /signin's own sign-in: the same call, the same carry", async () => {
    guest();
    localStorage.setItem("ethos.tester", "1");
    expect(await signIn(EMAIL, PASSWORD)).toEqual({ ok: true });
    expect(posts).toEqual([{ body: { carry: "tok_guest" }, auth: "Bearer tok_account" }]);
    fake.signInError = WRONG;
    expect(await signIn(EMAIL, "nope")).toEqual({ ok: false, error: "That email and password don't match. Try again or reset it." });
  });

  it("says copy within the rules: no em dash, short", () => {
    for (const line of Object.values(EXISTING_COPY)) {
      expect(line).not.toMatch(/—/);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });
});

/*
 * Google (#414, #426): a sign-up whose Google account already has Ethos
 * comes back to /auth/callback with the error, and is signed in from
 * there. That sign-in is a sign-in, begun where Google was first tapped:
 * the callback greets it as one, and never says the guest's recordings
 * came along (they stay on the guest, as every sign-in leaves them).
 */
describe("the Google sign-in a taken sign-up turns into", () => {
  it("is remembered as a sign-in from where Google was tapped, even on the callback", async () => {
    guest();
    vi.stubGlobal("window", { location: { origin: "https://speakethos.com", pathname: "/auth/callback", search: "?next=%2Frep" } });
    sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ from: "/welcome", mode: "signup", at: Date.now() - 5000 }));
    expect(await signInWithGoogle("signin", "/rep", "/welcome")).toEqual({ ok: true });
    expect(readOAuthAttempt()).toMatchObject({ from: "/welcome", mode: "signin" });
    // A plain sign-in, never another link: the link is what met the account.
    expect(called("signInWithOAuth")).toHaveLength(1);
    expect(called("linkIdentity")).toHaveLength(0);
  });

  it("leaves the attempt alone where it cannot say where it began", async () => {
    vi.stubGlobal("window", { location: { origin: "https://speakethos.com", pathname: "/auth/callback", search: "" } });
    sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ from: "/signup", mode: "signup", at: Date.now() - 5000 }));
    await signInWithGoogle("signin");
    // /auth/callback is never a place to come back to, so nothing overwrote it.
    expect(readOAuthAttempt()).toMatchObject({ from: "/signup", mode: "signup" });
  });
});

describe("the address carried between auth screens", () => {
  it("rides a link only when it is an address", () => {
    expect(withEmail("/auth/forgot", EMAIL)).toBe(`/auth/forgot?email=${encodeURIComponent(EMAIL)}`);
    expect(withEmail("/signin?next=%2Fyou", ` ${EMAIL} `)).toBe(`/signin?next=%2Fyou&email=${encodeURIComponent(EMAIL)}`);
    expect(withEmail("/auth/forgot", "tim")).toBe("/auth/forgot");
    expect(withEmail("/auth/forgot", "")).toBe("/auth/forgot");
    expect(withEmail("/auth/forgot", null)).toBe("/auth/forgot");
  });

  it("is read back only when it is one", () => {
    expect(emailFrom(`?email=${encodeURIComponent(EMAIL)}`)).toBe(EMAIL);
    expect(emailFrom("?next=%2Fyou&email=tim%40example.com")).toBe(EMAIL);
    expect(emailFrom("?email=<script>")).toBeNull();
    expect(emailFrom(`?email=${"a".repeat(250)}%40example.com`)).toBeNull();
    expect(emailFrom("")).toBeNull();
    expect(emailFrom(null)).toBeNull();
  });
});

/*
 * The review of #426 (7 Nov). Three findings, each held here:
 * 1. A crafted /signup?email= filled a guest's email-only form, whose one
 *    tap sends the link confirming THIS guest's user to that address.
 * 2. The link an unconfirmed account got again said the guest's
 *    recordings came along (they stay on the guest), and lost the
 *    testing the guest had joined, since the link opens in another tab.
 * 3. Google from a guest holding recordings, to a Google account that
 *    has Ethos, signed in without saying the recordings stay behind.
 */
describe("a link's address fills a sign-in, never a sign-up (review 1)", () => {
  const crafted = `?email=${encodeURIComponent("attacker@evil.test")}`;

  it("a sign-up opens empty whatever the link says, with or without next", () => {
    expect(carriedEmail("signup", crafted)).toBeNull();
    expect(carriedEmail("signup", `?next=%2Fhistory&email=${encodeURIComponent(EMAIL)}`)).toBeNull();
  });

  it("a sign-in still opens with the inbox's address, and only a real one", () => {
    expect(carriedEmail("signin", withEmail("/signin?next=%2Fyou", EMAIL).slice("/signin".length))).toBe(EMAIL);
    expect(carriedEmail("signin", crafted)).toBe("attacker@evil.test");
    expect(carriedEmail("signin", "?email=<script>")).toBeNull();
    expect(carriedEmail("signin", "")).toBeNull();
  });
});

describe("the link an unconfirmed account gets again (review 2)", () => {
  const account = () => {
    fake.session = { access_token: "tok_account", user: { id: "account", is_anonymous: false } };
  };

  it("keeps a testing guest's token on this device, not in this tab, and carries nothing yet", async () => {
    guest();
    localStorage.setItem("ethos.tester", "1");
    fake.signInError = UNCONFIRMED;
    await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(JSON.parse(localStorage.getItem(LINK_CARRY_KEY) ?? "null")).toMatchObject({ token: "tok_guest" });
    expect(sessionStorage.length).toBe(0);
    expect(posts).toEqual([]);
  });

  it("opened, it carries that testing to the account once, then nothing", async () => {
    guest();
    localStorage.setItem("ethos.tester", "1");
    fake.signInError = UNCONFIRMED;
    await signInExisting(EMAIL, PASSWORD, NEXT);
    account();
    expect(await carryKeptForLink()).toBe(true);
    expect(posts).toEqual([{ body: { carry: "tok_guest" }, auth: "Bearer tok_account" }]);
    expect(localStorage.getItem(LINK_CARRY_KEY)).toBeNull();
    expect(await carryKeptForLink()).toBe(false);
    expect(posts).toHaveLength(1);
  });

  it("a link sent under a minute ago keeps it too: that link is the one coming", async () => {
    guest();
    localStorage.setItem("ethos.tester", "1");
    fake.signInError = UNCONFIRMED;
    fake.resendError = TOO_SOON;
    await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(localStorage.getItem(LINK_CARRY_KEY)).not.toBeNull();
  });

  it("keeps nothing for a guest who is not testing, or a resend that was refused", async () => {
    guest();
    fake.signInError = UNCONFIRMED;
    await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(localStorage.getItem(LINK_CARRY_KEY)).toBeNull();
    localStorage.setItem("ethos.tester", "1");
    fake.resendError = { message: "Email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" };
    await signInExisting(EMAIL, PASSWORD, NEXT);
    expect(localStorage.getItem(LINK_CARRY_KEY)).toBeNull();
  });

  it("carries nothing past the link's own life, and signing out forgets it", async () => {
    account();
    const at = Date.parse(now);
    localStorage.setItem(LINK_CARRY_KEY, JSON.stringify({ token: "tok_guest", at }));
    expect(await carryKeptForLink(at + LINK_CARRY_TTL_MS + 1)).toBe(false);
    expect(posts).toEqual([]);
    localStorage.setItem(LINK_CARRY_KEY, JSON.stringify({ token: "tok_guest", at }));
    forgetTesterHint();
    expect(localStorage.getItem(LINK_CARRY_KEY)).toBeNull();
  });

  it("the callback reads the mark from the link it lands on", () => {
    expect(resentLink(new URL(RESENT_BACK).search)).toBe(true);
    expect(resentLink(new URL(BACK).search)).toBe(false);
    expect(resentLink("")).toBe(false);
  });

  it("says only that the email is confirmed, never that the guest's recordings came along", () => {
    expect(callbackWelcome({ email: EMAIL, google: null, resent: true })).toBe(`${EMAIL} is confirmed.`);
    // Even in the tab a Google sign-up began in: the link is an email link.
    expect(callbackWelcome({ email: EMAIL, google: { mode: "signup" }, resent: true })).toBe(`${EMAIL} is confirmed.`);
    // Every other return says what it said before.
    expect(callbackWelcome({ email: EMAIL, google: null, resent: false })).toBe(
      `${EMAIL} is confirmed. Everything you've already recorded came with you.`
    );
    expect(callbackWelcome({ email: EMAIL, google: { mode: "signup" }, resent: false })).toBe(
      `Signed in as ${EMAIL}. Everything you've already recorded came with you.`
    );
    expect(callbackWelcome({ email: EMAIL, google: { mode: "signin" }, resent: false })).toBe(`Signed in as ${EMAIL}.`);
    expect(callbackWelcome({ email: null, google: { mode: "signin" }, resent: false })).toBe("Signed in with Google.");
    expect(callbackWelcome({ email: null, google: null, resent: true })).toBe("Your email is confirmed.");
  });
});

describe("Google from a guest holding recordings (review 3)", () => {
  it("remembers what the guest holds on the sign-up's attempt", async () => {
    guest();
    expect(await signInWithGoogle("signup", NEXT, undefined, 22)).toEqual({ ok: true });
    expect(readOAuthAttempt()).toMatchObject({ from: "/signup", mode: "signup", recordings: 22 });
    expect(called("linkIdentity")).toHaveLength(1);
  });

  it("a guest holding none, and every sign-in, remember nothing of it", async () => {
    guest();
    await signInWithGoogle("signup", NEXT);
    expect(readOAuthAttempt()?.recordings).toBeUndefined();
    await signInWithGoogle("signin", NEXT, "/signup", 22);
    expect(readOAuthAttempt()).toMatchObject({ from: "/signup", mode: "signin" });
    expect(readOAuthAttempt()?.recordings).toBeUndefined();
  });

  it("reads back only a whole positive count", () => {
    const t = Date.now();
    const raw = (recordings: unknown) => JSON.stringify({ from: "/signup", mode: "signup", at: t, recordings });
    expect(parseOAuthAttempt(raw(22), t)?.recordings).toBe(22);
    for (const bad of [0, -3, 2.5, "22", null]) expect(parseOAuthAttempt(raw(bad), t)?.recordings).toBeUndefined();
    expect(parseOAuthAttempt(JSON.stringify({ from: "/signup", mode: "signin", at: t, recordings: 22 }), t)?.recordings).toBeUndefined();
  });
});
