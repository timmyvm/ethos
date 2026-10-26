import { afterEach, describe, expect, it, vi } from "vitest";

/* A stand-in Supabase client whose Google calls fail, so the failure
   paths of signInWithGoogle can be watched from outside. */
const fake = vi.hoisted(() => ({
  anonymous: false,
  error: null as null | { message: string },
  /** Where each call asked the auth server to send the person back. */
  redirects: [] as { call: string; to: string | undefined }[],
}));
vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: {
      getUser: async () => ({ data: { user: { is_anonymous: fake.anonymous } } }),
      linkIdentity: async (a: { options?: { redirectTo?: string } }) => {
        fake.redirects.push({ call: "linkIdentity", to: a.options?.redirectTo });
        return { error: fake.error };
      },
      signInWithOAuth: async (a: { options?: { redirectTo?: string } }) => {
        fake.redirects.push({ call: "signInWithOAuth", to: a.options?.redirectTo });
        return { error: fake.error };
      },
      updateUser: async (_: unknown, o?: { emailRedirectTo?: string }) => {
        fake.redirects.push({ call: "updateUser", to: o?.emailRedirectTo });
        return { error: null };
      },
      signUp: async (a: { options?: { emailRedirectTo?: string } }) => {
        fake.redirects.push({ call: "signUp", to: a.options?.emailRedirectTo });
        return { error: null };
      },
      getSession: async () => ({ data: { session: { access_token: "tok" } } }),
      signOut: async () => ({ error: null }),
    },
  }),
}));

import {
  attemptStartedOn,
  createAccount,
  deleteAccount,
  OAUTH_KEY,
  signInWithGoogle,
  callbackCarriesSession,
  callbackProblem,
  emailProblem,
  MIN_PASSWORD,
  OAUTH_TTL_MS,
  parseOAuthAttempt,
  passwordProblem,
  resetReady,
  safeReturnPath,
  signIn,
  withNext,
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

describe("signing in checks the fields before the server does", () => {
  // The forms are noValidate (auth-19): the browser's bubble no longer
  // runs, so these are what an empty or malformed sign-in hears, and
  // `field` is how the form knows which input to mark and refocus.
  it("names a malformed address and points at the email field", async () => {
    expect(await signIn("tim", "a long password")).toEqual({
      ok: false,
      error: expect.stringMatching(/email/),
      field: "email",
    });
  });

  it("asks for the password when it is empty", async () => {
    expect(await signIn("tim@speakethos.com", "")).toEqual({
      ok: false,
      error: "Enter your password.",
      field: "password",
    });
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

/*
 * The paywall's account ask promises the person comes back to the sheet
 * ("paywall=1"). Every way through sign-up has to carry that `next` to
 * the page the confirmation link or Google lands on, or they end on
 * Today with the sheet gone.
 */
describe("sign-up carries where to come back to", () => {
  const next = "/you?paywall=1";
  const encoded = encodeURIComponent(next);
  afterEach(() => {
    vi.unstubAllGlobals();
    fake.anonymous = false;
    fake.error = null;
    fake.redirects = [];
  });
  const install = () => {
    vi.stubGlobal("window", { location: { pathname: "/signup", search: `?next=${encoded}`, origin: "https://speakethos.com" } });
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  };

  it("adds a safe next to a path, keeping the query it has", () => {
    expect(withNext("/auth/reset?first=1", next)).toBe(`/auth/reset?first=1&next=${encoded}`);
    expect(withNext("/auth/callback", next)).toBe(`/auth/callback?next=${encoded}`);
  });

  it("drops a next that could leave the site or loop", () => {
    expect(withNext("/auth/callback", "//evil.com")).toBe("/auth/callback");
    expect(withNext("/auth/callback", "https://evil.com/x")).toBe("/auth/callback");
    expect(withNext("/auth/callback", "/signup?next=%2Fyou")).toBe("/auth/callback");
    expect(withNext("/auth/callback", null)).toBe("/auth/callback");
  });

  it("sends an anonymous session's confirmation link to the password page with next", async () => {
    install();
    fake.anonymous = true;
    expect(await createAccount("a@b.co", "", next)).toEqual({ ok: true, checkInbox: true });
    expect(fake.redirects).toEqual([{ call: "updateUser", to: `https://speakethos.com/auth/reset?first=1&next=${encoded}` }]);
  });

  it("sends a fresh sign-up's confirmation link to the callback with next", async () => {
    install();
    expect(await createAccount("a@b.co", "longenough", next)).toEqual({ ok: true, checkInbox: true });
    expect(fake.redirects).toEqual([{ call: "signUp", to: `https://speakethos.com/auth/callback?next=${encoded}` }]);
  });

  it("sends Google back to the callback with next, linking or signing in", async () => {
    install();
    fake.anonymous = true;
    await signInWithGoogle("signup", next);
    fake.anonymous = false;
    await signInWithGoogle("signin", next);
    expect(fake.redirects).toEqual([
      { call: "linkIdentity", to: `https://speakethos.com/auth/callback?next=${encoded}` },
      { call: "signInWithOAuth", to: `https://speakethos.com/auth/callback?next=${encoded}` },
    ]);
  });

  it("keeps the old landing pages when there is nowhere to come back to", async () => {
    install();
    fake.anonymous = true;
    await createAccount("a@b.co", "");
    expect(fake.redirects[0].to).toBe("https://speakethos.com/auth/reset?first=1");
  });
});

describe("deleting the account, when the server cannot say what happened", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never tells someone with a plan that nothing happened: the plan is cancelled first", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network");
    });
    const lost = await deleteAccount({ plan: true });
    expect(lost.ok).toBe(false);
    expect(lost.error).toBe("The server didn't answer. Your account is still here, but your plan may have ended. Try again.");
    vi.stubGlobal("fetch", async () => new Response("<html>gateway</html>", { status: 504 }));
    expect((await deleteAccount({ plan: true })).error).toBe(
      "That didn't go through. Your account is still here, but your plan may have ended. Try again."
    );
  });

  it("keeps the plain line for an account with no plan", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network");
    });
    expect((await deleteAccount()).error).toBe("The server didn't answer. Nothing was deleted; try again.");
    vi.stubGlobal("fetch", async () => new Response("", { status: 502 }));
    expect((await deleteAccount()).error).toBe("That didn't go through. Nothing was deleted.");
  });

  it("says the server's own sentence when it has one", async () => {
    const said = "Your plan is cancelled, but your audio didn't delete. Nothing else was touched; try again.";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: said }), { status: 502 }));
    expect((await deleteAccount({ plan: true })).error).toBe(said);
  });
});

/*
 * /auth/reset decides between the password form and "That link has
 * expired". The device that started a save still holds its anonymous
 * session when the save link turns out dead (auth-js keeps the session
 * on a failed URL login), so that session is not a confirmed email.
 */
describe("the password page, after a save link", () => {
  const anon = { signedIn: true, anonymous: true, email: null };
  const real = { signedIn: true, anonymous: false, email: "t@x.co" };
  const out = { signedIn: false, anonymous: false, email: null };
  const dead = "https://speakethos.com/auth/reset?first=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
  const fine = "https://speakethos.com/auth/reset?first=1";

  it("sends an expired link on the saving device to the expired-link screen", () => {
    expect(resetReady(anon, true, dead)).toBe(false);
  });

  it("still lets a fresh first-password link through", () => {
    expect(resetReady(anon, true, fine)).toBe(true);
    expect(resetReady(real, true, fine)).toBe(true);
  });

  it("lets a confirmed account reopening its used link set a password", () => {
    expect(resetReady(real, true, dead)).toBe(true);
  });

  it("keeps the reset flow to full accounts", () => {
    expect(resetReady(anon, false, fine)).toBe(false);
    expect(resetReady(real, false, fine)).toBe(true);
    expect(resetReady(out, true, fine)).toBe(false);
  });
});
