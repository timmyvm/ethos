import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Settings' account page (#479), with the Supabase client faked the way
 * lib/auth-existing.test.ts fakes it: each call answers as GoTrue does,
 * and every action is driven through its success and its failures.
 */

type Err = { message: string; status?: number };

const fake = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: Record<string, unknown> },
  user: null as null | Record<string, unknown>,
  getUserError: null as null | { message: string },
  updateError: null as null | Err,
  signInError: null as null | Err,
  linkError: null as null | Err,
  signOutError: null as null | Err,
  throwOnLink: false,
  calls: [] as { call: string; args: unknown }[],
}));

vi.mock("./supabase-browser", () => {
  const auth = {
    getSession: async () => ({ data: { session: fake.session } }),
    getUser: async () => ({ data: { user: fake.getUserError ? null : fake.user }, error: fake.getUserError }),
    updateUser: async (attrs: unknown, o?: unknown) => {
      fake.calls.push({ call: "updateUser", args: { attrs, o } });
      return { data: { user: null }, error: fake.updateError };
    },
    signInWithPassword: async (args: unknown) => {
      fake.calls.push({ call: "signInWithPassword", args });
      return { data: {}, error: fake.signInError };
    },
    linkIdentity: async (args: unknown) => {
      fake.calls.push({ call: "linkIdentity", args });
      if (fake.throwOnLink) throw new Error("network");
      return { data: {}, error: fake.linkError };
    },
    signOut: async (args: unknown) => {
      fake.calls.push({ call: "signOut", args });
      return { error: fake.signOutError };
    },
  };
  return {
    supabaseBrowser: () => ({ auth }),
    currentSession: async () => null,
    sessionToken: async () => null,
    ensureSession: async () => null,
  };
});

import {
  accountView,
  changeEmail,
  changePassword,
  linkGoogle,
  readAccount,
  signOutEverywhere,
} from "./account-settings";
import { OAUTH_KEY, settingsLanding } from "./auth";

const store = new Map<string, string>();
beforeEach(() => {
  fake.session = null;
  fake.user = null;
  fake.getUserError = null;
  fake.updateError = null;
  fake.signInError = null;
  fake.linkError = null;
  fake.signOutError = null;
  fake.throwOnLink = false;
  fake.calls = [];
  store.clear();
  vi.stubGlobal("window", { location: { origin: "https://speakethos.com", pathname: "/settings/account", search: "" } });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const EMAIL_USER = {
  email: "tim@example.com",
  is_anonymous: false,
  identities: [{ provider: "email" }],
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
};
const GOOGLE_USER = {
  email: "tim@example.com",
  is_anonymous: false,
  identities: [{ provider: "google" }],
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: {},
};

describe("what the account holds", () => {
  it("reads an email account: a password, no Google", () => {
    expect(accountView(EMAIL_USER)).toEqual({ kind: "account", email: "tim@example.com", pendingEmail: null, google: false, password: true });
  });

  it("reads a Google-only account as having no password until one is set", () => {
    expect(accountView(GOOGLE_USER)).toMatchObject({ google: true, password: false });
    expect(accountView({ ...GOOGLE_USER, user_metadata: { password_set: true } })).toMatchObject({ google: true, password: true });
  });

  it("reads both ways in when Google is linked to an email account", () => {
    expect(accountView({ ...EMAIL_USER, identities: [{ provider: "email" }, { provider: "google" }] })).toMatchObject({ google: true, password: true });
  });

  it("counts a password on an account with no Google, whatever its identities say", () => {
    // A guest who saved with an email may list no email identity: a password is still its only way in.
    expect(accountView({ email: "a@b.co", is_anonymous: false, identities: [], app_metadata: {} })).toMatchObject({ password: true, google: false });
  });

  it("names an email change still waiting on its link", () => {
    expect(accountView({ ...EMAIL_USER, new_email: "new@example.com" }).pendingEmail).toBe("new@example.com");
    expect(accountView({ ...EMAIL_USER, new_email: "tim@example.com" }).pendingEmail).toBeNull();
  });

  it("tells a guest and no session apart, and offers neither anything", () => {
    expect(accountView({ is_anonymous: true })).toMatchObject({ kind: "guest", google: false, password: false });
    expect(accountView(null).kind).toBe("none");
  });

  it("reads the server's user, and keeps the session's when the server cannot answer", async () => {
    fake.session = { access_token: "t", user: { ...EMAIL_USER, email: "old@example.com" } };
    fake.user = { ...EMAIL_USER, new_email: "new@example.com" };
    expect(await readAccount()).toMatchObject({ email: "tim@example.com", pendingEmail: "new@example.com" });
    fake.getUserError = { message: "fetch failed" };
    expect(await readAccount()).toMatchObject({ email: "old@example.com", pendingEmail: null });
    fake.session = null;
    expect((await readAccount())?.kind).toBe("none");
  });
});

describe("changing the email", () => {
  it("sends the link and says to check the inbox, coming back to the account page", async () => {
    const r = await changeEmail(" new@example.com ", "tim@example.com");
    expect(r).toEqual({ ok: true, checkInbox: true });
    const sent = fake.calls.find((c) => c.call === "updateUser")!.args as { attrs: { email: string }; o: { emailRedirectTo: string } };
    expect(sent.attrs).toEqual({ email: "new@example.com" });
    expect(sent.o.emailRedirectTo).toBe("https://speakethos.com/auth/callback?changed=email&next=%2Fsettings%2Faccount");
  });

  it("checks the address before the server sees it", async () => {
    expect(await changeEmail("not an email", "tim@example.com")).toMatchObject({ ok: false, field: "email" });
    expect(await changeEmail("TIM@example.com", "tim@example.com")).toEqual({ ok: false, error: "That's the email you have now.", field: "email" });
    expect(fake.calls).toEqual([]);
  });

  it("says when another account has the address", async () => {
    fake.updateError = { message: "A user with this email address has already been registered", status: 422 };
    expect(await changeEmail("taken@example.com", "tim@example.com")).toEqual({ ok: false, error: "Another Ethos account has that email.", field: "email" });
  });

  it("says a slow email server's link may still come", async () => {
    fake.updateError = { message: "Error sending email change email: context deadline exceeded" };
    expect(await changeEmail("new@example.com", "tim@example.com")).toMatchObject({ ok: true, checkInbox: true, note: expect.stringMatching(/slow/) });
  });

  it("puts any other failure in plain words", async () => {
    fake.updateError = { message: "For security purposes, you can only request this after 30 seconds. Too many requests" };
    expect(await changeEmail("new@example.com", "tim@example.com")).toEqual({ ok: false, error: "Too many tries in a row. Give it a minute." });
  });
});

describe("changing the password", () => {
  const change = { email: "tim@example.com", current: "old horse battery", next: "a new long phrase" };

  it("checks the password now, then sets the new one and marks the account as holding one", async () => {
    expect(await changePassword(change)).toEqual({ ok: true });
    expect(fake.calls.map((c) => c.call)).toEqual(["signInWithPassword", "updateUser"]);
    expect(fake.calls[0].args).toEqual({ email: "tim@example.com", password: "old horse battery" });
    expect((fake.calls[1].args as { attrs: unknown }).attrs).toEqual({ password: "a new long phrase", data: { password_set: true } });
  });

  it("refuses a wrong password now without touching the password", async () => {
    fake.signInError = { message: "Invalid login credentials", status: 400 };
    expect(await changePassword(change)).toEqual({ ok: false, error: "That isn't the password you have now.", field: "current" });
    expect(fake.calls.map((c) => c.call)).toEqual(["signInWithPassword"]);
  });

  it("asks for the password now, a long enough new one, and a different one, before the server", async () => {
    expect(await changePassword({ ...change, current: "" })).toMatchObject({ ok: false, field: "current" });
    expect(await changePassword({ ...change, next: "short" })).toMatchObject({ ok: false, field: "password" });
    expect(await changePassword({ ...change, next: change.current })).toMatchObject({ ok: false, field: "password" });
    expect(fake.calls).toEqual([]);
  });

  it("gives a Google-only account its first password with no password to check", async () => {
    expect(await changePassword({ email: "tim@example.com", next: "a new long phrase" })).toEqual({ ok: true });
    expect(fake.calls.map((c) => c.call)).toEqual(["updateUser"]);
  });

  it("says the server's refusal in plain words", async () => {
    fake.updateError = { message: "New password should be different from the old password.", status: 422 };
    expect(await changePassword(change)).toEqual({ ok: false, error: "That's the password you have now. Pick a new one." });
    fake.updateError = { message: "Password update requires reauthentication", status: 401 };
    expect(await changePassword(change)).toEqual({ ok: false, error: "Sign out and back in, then change it." });
  });
});

describe("linking Google", () => {
  it("goes to Google and comes back to the account page, the attempt remembered", async () => {
    expect(await linkGoogle()).toEqual({ ok: true });
    const sent = fake.calls[0].args as { provider: string; options: { redirectTo: string } };
    expect(sent.provider).toBe("google");
    expect(sent.options.redirectTo).toBe("https://speakethos.com/auth/callback?linked=google&next=%2Fsettings%2Faccount");
    expect(JSON.parse(store.get(OAUTH_KEY)!)).toMatchObject({ from: "/settings/account", mode: "signin" });
  });

  it("forgets the attempt when the server refuses or the call throws", async () => {
    fake.linkError = { message: "Manual linking is disabled" };
    expect(await linkGoogle()).toEqual({ ok: false, error: "Ethos can't link Google yet." });
    expect(store.has(OAUTH_KEY)).toBe(false);
    fake.linkError = null;
    fake.throwOnLink = true;
    expect(await linkGoogle()).toEqual({ ok: false, error: "Google didn't open. Try again." });
    expect(store.has(OAUTH_KEY)).toBe(false);
  });
});

describe("signing out everywhere", () => {
  it("signs every session out, this one included", async () => {
    expect(await signOutEverywhere()).toEqual({ ok: true });
    expect(fake.calls[0]).toEqual({ call: "signOut", args: { scope: "global" } });
  });

  it("says this phone is still signed in when it fails", async () => {
    fake.signOutError = { message: "Internal Server Error", status: 500 };
    expect(await signOutEverywhere()).toEqual({ ok: false, error: "That didn't go through, so you're still signed in. Try again." });
  });

  /* #508 review: a plain sign-out cleared these and this one did not, and
     the page leaves for /signin, where nothing else would. */
  describe("what this phone kept for the account", () => {
    const disk = new Map<string, string>();
    const kept = () => {
      disk.clear();
      disk.set("ethos.held", JSON.stringify({ v: 1, owner: "user-a", items: { profile: { display_name: "Tim" } } }));
      disk.set("ethos.cue", JSON.stringify({ text: "a sentence of their own words" }));
      disk.set("ethos.cue.skipped", "1");
      disk.set("ethos.theme", "dark");
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => disk.get(k) ?? null,
        setItem: (k: string, v: string) => void disk.set(k, v),
        removeItem: (k: string) => void disk.delete(k),
      });
    };

    it("goes with it: the numbers kept between opens and the carried cue", async () => {
      kept();
      expect(await signOutEverywhere()).toEqual({ ok: true });
      expect(disk.has("ethos.held")).toBe(false);
      expect(disk.has("ethos.cue")).toBe(false);
      expect(disk.has("ethos.cue.skipped")).toBe(false);
      // The phone's own settings are not the account's.
      expect(disk.get("ethos.theme")).toBe("dark");
    });

    it("stays when the sign-out failed, since this phone is still signed in", async () => {
      kept();
      fake.signOutError = { message: "Internal Server Error", status: 500 };
      await signOutEverywhere();
      expect(disk.has("ethos.held")).toBe(true);
      expect(disk.has("ethos.cue")).toBe(true);
    });
  });
});

describe("where a Settings round trip lands", () => {
  it("reads an email change's first link and its last", () => {
    const half = "https://speakethos.com/auth/callback?changed=email&next=%2Fsettings%2Faccount#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email";
    expect(settingsLanding(half)).toEqual({ kind: "email", step: "half" });
    expect(settingsLanding("https://speakethos.com/auth/callback?changed=email#access_token=x")).toEqual({ kind: "email", step: "done" });
  });

  it("reads Google's return from linking, and nothing else", () => {
    expect(settingsLanding("https://speakethos.com/auth/callback?linked=google")).toEqual({ kind: "google" });
    expect(settingsLanding("https://speakethos.com/auth/callback?resent=1")).toBeNull();
    expect(settingsLanding("not a url")).toBeNull();
  });
});
