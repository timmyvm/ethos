import { afterEach, describe, expect, it, vi } from "vitest";
import { callbackProblem } from "./auth";
import { SWITCHED_KEY, TAKEN_KEY, googleTakenBootScript, shouldSwitch } from "./google-taken";

function boot(href: string) {
  const url = new URL(href);
  const store = new Map<string, string>();
  vi.stubGlobal("location", { hash: url.hash, search: url.search });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  new Function(googleTakenBootScript)();
  return store;
}

const signup = { from: "/welcome", mode: "signup" as const, at: 1_793_878_000_000 };

describe("Continue with Google, with an account that already has Ethos (#414)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is what Supabase sent Timothy back with, in the fragment or the query", () => {
    const desc = "Identity+is+already+linked+to+another+user";
    for (const href of [
      `https://speakethos.com/#error=server_error&error_code=identity_already_exists&error_description=${desc}`,
      `https://speakethos.com/auth/callback?next=%2Frep&error=server_error&error_code=identity_already_exists&error_description=${desc}`,
      `https://speakethos.com/?error=server_error&error_description=${desc}`,
    ]) {
      expect(boot(href).has(TAKEN_KEY)).toBe(true);
      expect(callbackProblem(href).kind).toBe("taken");
    }
  });

  it("leaves every other return alone", () => {
    expect(boot("https://speakethos.com/#error=access_denied&error_description=User+denied").has(TAKEN_KEY)).toBe(false);
    expect(boot("https://speakethos.com/auth/callback?code=abc").has(TAKEN_KEY)).toBe(false);
    expect(boot("https://speakethos.com/welcome").has(TAKEN_KEY)).toBe(false);
  });

  it("signs in instead, once, and only for a sign-up", () => {
    expect(shouldSwitch(true, signup, null)).toBe(true);
    // The switch already ran for this attempt: never a loop.
    expect(shouldSwitch(true, signup, String(signup.at))).toBe(false);
    // A sign-in that met the error is not turned into another sign-in.
    expect(shouldSwitch(true, { ...signup, mode: "signin" }, null)).toBe(false);
    // No attempt from this tab, or no error: nothing to do.
    expect(shouldSwitch(true, null, null)).toBe(false);
    expect(shouldSwitch(false, signup, null)).toBe(false);
    expect(SWITCHED_KEY).not.toBe(TAKEN_KEY);
  });
});
