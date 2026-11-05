import { afterEach, describe, expect, it, vi } from "vitest";
import { callbackProblem } from "./auth";
import { SWITCHED_KEY, TAKEN_KEY, googleTakenBootScript, onBackWithoutFinishing, shouldSwitch } from "./google-taken";

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

/*
 * The switch's cover leaves for Google. Backing out of Google, a
 * dismissed sheet or a page restored from the back/forward cache used to
 * leave it up for good, with nothing on it to tap.
 */
describe("the switch lets go when the person is back without finishing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function install() {
    vi.useFakeTimers();
    const win = Object.assign(new EventTarget(), {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
    const doc = Object.assign(new EventTarget(), { visibilityState: "hidden" });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    const release = vi.fn();
    return { win, doc, release, stop: onBackWithoutFinishing(release, 5000) };
  }

  it("on a page restored from the back/forward cache, and not on a fresh load", () => {
    const { win, release } = install();
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(release).not.toHaveBeenCalled();
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("when the page is shown again or refocused after a dismissed sheet", () => {
    const shown = install();
    shown.doc.visibilityState = "visible";
    shown.doc.dispatchEvent(new Event("visibilitychange"));
    expect(shown.release).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    const focused = install();
    focused.win.dispatchEvent(new Event("focus"));
    expect(focused.release).toHaveBeenCalledTimes(1);
  });

  it("after the bound if no sign ever comes, and only once", () => {
    const { win, release } = install();
    vi.advanceTimersByTime(4999);
    expect(release).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(release).toHaveBeenCalledTimes(1);
    win.dispatchEvent(new Event("focus"));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("not at all once stopped", () => {
    const { win, release, stop } = install();
    stop();
    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(10_000);
    expect(release).not.toHaveBeenCalled();
  });
});
