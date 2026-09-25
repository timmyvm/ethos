import { afterEach, describe, expect, it, vi } from "vitest";

/* A stand-in Supabase client whose Google calls fail, so the failure
   paths of signInWithGoogle can be watched from outside. */
const fake = vi.hoisted(() => ({
  anonymous: false,
  error: null as null | { message: string },
}));
vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: {
      getUser: async () => ({ data: { user: { is_anonymous: fake.anonymous } } }),
      linkIdentity: async () => ({ error: fake.error }),
      signInWithOAuth: async () => ({ error: fake.error }),
    },
  }),
}));

import {
  attemptStartedOn,
  OAUTH_KEY,
  signInWithGoogle,
  callbackCarriesSession,
  callbackProblem,
  emailProblem,
  MIN_PASSWORD,
  OAUTH_TTL_MS,
  parseOAuthAttempt,
  passwordProblem,
  safeReturnPath,
} from "./auth";

describe("password rules", () => {
  it("asks for length and nothing else", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD))).toBeNull();
    // No composition rule: a long simple passphrase is fine, which is
    // the point — "one symbol, one digit" pushes people to Password1!.
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });

  it("rejects a short one with the reason, not a red border", () => {
    expect(passwordProblem("short")).toContain(String(MIN_PASSWORD));
  });
});

describe("email rules", () => {
  it("accepts an ordinary address", () => {
    expect(emailProblem("tim@speakethos.com")).toBeNull();
    expect(emailProblem("  tim@speakethos.com  ")).toBeNull();
  });

  it("rejects what obviously isn't one", () => {
    expect(emailProblem("tim")).not.toBeNull();
    expect(emailProblem("tim@localhost")).not.toBeNull();
    expect(emailProblem("")).not.toBeNull();
  });
});

/*
 * "After trying with Google, after you click out you can't click back
 * into sign in with Google" (25 Sep). The button half lives in
 * lib/use-oauth-return.ts and scripts/check-google-return.mjs; these are
 * the callback half: reading what came back, and where to send them.
 */
describe("the Google round trip, coming back", () => {
  const CB = "https://speakethos.com/auth/callback";

  it("reads a cancel at Google as Google not finishing, not a used link", () => {
    // Supabase puts the error in the query or the fragment depending on
    // the flow; the query wins, as it does in the client.
    expect(callbackProblem(`${CB}?error=access_denied&error_description=The+user+denied+the+request`)).toEqual({ kind: "google" });
    expect(callbackProblem(`${CB}#error=access_denied&error_code=access_denied`)).toEqual({ kind: "google" });
    expect(callbackProblem(`${CB}?error=server_error`)).toEqual({ kind: "google" });
  });

  it("keeps an expired email link as a link problem", () => {
    expect(
      callbackProblem(`${CB}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)
    ).toEqual({ kind: "link" });
  });

  it("says plainly when the Google account belongs to someone else", () => {
    const p = callbackProblem(`${CB}#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user`);
    expect(p.kind).toBe("taken");
    if (p.kind === "taken") expect(p.message).toMatch(/Sign in with it/);
  });

  it("sees nothing wrong in a clean return or a session in the URL", () => {
    expect(callbackProblem(CB)).toEqual({ kind: "none" });
    expect(callbackProblem(`${CB}#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer`)).toEqual({ kind: "none" });
    expect(callbackProblem("not a url")).toEqual({ kind: "none" });
  });

  it("knows when a session is on its way in", () => {
    expect(callbackCarriesSession(`${CB}#access_token=a&refresh_token=r`)).toBe(true);
    expect(callbackCarriesSession(`${CB}?code=abc`)).toBe(true);
    expect(callbackCarriesSession(`${CB}?error=access_denied`)).toBe(false);
    expect(callbackCarriesSession(CB)).toBe(false);
  });

  it("only ever sends them back to a path on this site", () => {
    expect(safeReturnPath("/signup")).toBe("/signup");
    expect(safeReturnPath("/welcome?step=plan")).toBe("/welcome?step=plan");
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("/\\evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
    // Never back to the callback itself, which would loop.
    expect(safeReturnPath("/auth/callback")).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
  });

  it("remembers the attempt for this round trip and no longer", () => {
    const now = 1_000_000_000;
    const raw = (o: object) => JSON.stringify(o);
    expect(parseOAuthAttempt(raw({ from: "/signin", mode: "signin", at: now - 1000 }), now)).toEqual({ from: "/signin", mode: "signin", at: now - 1000 });
    expect(parseOAuthAttempt(raw({ from: "/signin", mode: "signin", at: now - OAUTH_TTL_MS - 1 }), now)).toBeNull();
    expect(parseOAuthAttempt(raw({ from: "//evil.example", mode: "signin", at: now }), now)).toBeNull();
    expect(parseOAuthAttempt(raw({ from: "/signup", mode: "admin", at: now }), now)).toBeNull();
    expect(parseOAuthAttempt("{not json", now)).toBeNull();
    expect(parseOAuthAttempt(null, now)).toBeNull();
  });
});

describe("the Google attempt, remembered and forgotten", () => {
  const store = new Map<string, string>();
  const install = (pathname: string) => {
    store.clear();
    vi.stubGlobal("window", { location: { pathname, search: "", origin: "https://speakethos.com" } });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    fake.anonymous = false;
    fake.error = null;
  });

  it("keeps the attempt when the browser is on its way to Google", async () => {
    install("/signup");
    expect(await signInWithGoogle("signup")).toEqual({ ok: true });
    expect(JSON.parse(store.get(OAUTH_KEY) ?? "{}").from).toBe("/signup");
  });

  it("forgets it when the call fails, so a later callback is not read as a Google return", async () => {
    install("/signin");
    fake.error = { message: "Request rate limit reached" };
    const r = await signInWithGoogle("signin");
    expect(r.ok).toBe(false);
    expect(store.has(OAUTH_KEY)).toBe(false);
  });

  it("forgets it when linking to an anonymous session fails too", async () => {
    install("/welcome");
    fake.anonymous = true;
    fake.error = { message: "Manual linking is disabled" };
    const r = await signInWithGoogle("signup");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/email/) });
    expect(store.has(OAUTH_KEY)).toBe(false);
  });

  it("knows which page an attempt started on, whatever its query", () => {
    const at = Date.now();
    expect(attemptStartedOn({ from: "/welcome", mode: "signup", at }, "/welcome")).toBe(true);
    expect(attemptStartedOn({ from: "/welcome?step=plan", mode: "signup", at }, "/welcome")).toBe(true);
    expect(attemptStartedOn({ from: "/welcomer", mode: "signup", at }, "/welcome")).toBe(false);
    expect(attemptStartedOn({ from: "/signup", mode: "signup", at }, "/welcome")).toBe(false);
    expect(attemptStartedOn(null, "/welcome")).toBe(false);
  });
});
