import { describe, expect, it } from "vitest";
import { needsAccount, openWithoutAccount } from "./account-gate";

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
