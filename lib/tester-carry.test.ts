import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A friend joins testing on the introduction (an anonymous session),
 * then signs in to the account they already had. Signing in swaps the
 * session, so the sign-in itself hands the anonymous session's token to
 * /api/tester (`carry`) and the account takes the consent with it.
 * Without this, the consent stayed on an account nobody would open again
 * and the friend's recordings never reached Timothy's report.
 */

const fake = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string; is_anonymous: boolean } },
  signInError: null as null | { message: string },
}));

vi.mock("./supabase-browser", () => {
  const auth = {
    getSession: async () => ({ data: { session: fake.session } }),
    getUser: async () => ({ data: { user: fake.session?.user ?? null } }),
    signInWithPassword: async () => {
      if (fake.signInError) return { error: fake.signInError };
      fake.session = { access_token: "tok_account", user: { id: "account", is_anonymous: false } };
      return { error: null };
    },
    signInWithOAuth: async () => ({ error: null }),
    linkIdentity: async () => ({ error: null }),
  };
  return {
    supabaseBrowser: () => ({ auth }),
    currentSession: async () =>
      fake.session ? { userId: fake.session.user.id, token: fake.session.access_token } : null,
    sessionToken: async () => fake.session?.access_token ?? null,
    ensureSession: async () => fake.session?.access_token ?? null,
  };
});

import { signIn, signInWithGoogle } from "./auth";
import { carryStashed } from "./tester-client";

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
  posts.length = 0;
  fake.signInError = null;
  fake.session = { access_token: "tok_anon", user: { id: "anon", is_anonymous: true } };
  const g = globalThis as Record<string, unknown>;
  g.localStorage = storage();
  g.sessionStorage = storage();
  g.window = { location: { origin: "https://speakethos.com", href: "https://speakethos.com/signin" } };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      if (url === "/api/tester") posts.push({ body: JSON.parse(init.body), auth: init.headers.Authorization ?? null });
      return new Response(
        JSON.stringify({ ok: true, tester: { consent_version: 2, consented_at: "2026-10-30T09:00:00.000Z" } }),
        { status: 200 }
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  const g = globalThis as Record<string, unknown>;
  delete g.localStorage;
  delete g.sessionStorage;
  delete g.window;
});

describe("signing in from a phone that joined testing", () => {
  it("hands the anonymous session's testing to the account, with the account's own token", async () => {
    localStorage.setItem("ethos.tester", "1");
    expect(await signIn("friend@example.com", "a long password")).toEqual({ ok: true });
    expect(posts).toEqual([{ body: { carry: "tok_anon" }, auth: "Bearer tok_account" }]);
    expect(localStorage.getItem("ethos.tester")).toBe("1");
  });

  it("asks nothing of the server when this phone never joined, or the session was already an account", async () => {
    expect(await signIn("friend@example.com", "a long password")).toEqual({ ok: true });
    localStorage.setItem("ethos.tester", "1");
    fake.session = { access_token: "tok_real", user: { id: "real", is_anonymous: false } };
    expect(await signIn("friend@example.com", "a long password")).toEqual({ ok: true });
    expect(posts).toEqual([]);
  });

  it("carries nothing when the sign-in fails", async () => {
    localStorage.setItem("ethos.tester", "1");
    fake.signInError = { message: "Invalid login credentials" };
    expect((await signIn("friend@example.com", "a long password")).ok).toBe(false);
    expect(posts).toEqual([]);
  });

  it("through Google: the token rides the tab's round trip, and the callback carries it once", async () => {
    localStorage.setItem("ethos.tester", "1");
    expect(await signInWithGoogle("signin")).toEqual({ ok: true });
    // Google hands back the account.
    fake.session = { access_token: "tok_google", user: { id: "account", is_anonymous: false } };
    await carryStashed();
    await carryStashed();
    expect(posts).toEqual([{ body: { carry: "tok_anon" }, auth: "Bearer tok_google" }]);
  });

  it("through Google sign-up nothing moves: the identity joins the same user", async () => {
    localStorage.setItem("ethos.tester", "1");
    await signInWithGoogle("signup");
    fake.session = { access_token: "tok_google", user: { id: "anon", is_anonymous: false } };
    await carryStashed();
    expect(posts).toEqual([]);
  });
});
