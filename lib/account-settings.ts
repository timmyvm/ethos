/**
 * Settings' account page (#479): change the email, change or set the
 * password, link Google, sign out of every device. Each needs a signed-in
 * account with an email; a guest session is asked to save its progress
 * instead (the account ask on You), and nothing here runs for one.
 *
 * Every action is Supabase Auth's own (updateUser, linkIdentity, signOut
 * with the global scope), and every answer comes back as an AuthResult
 * in the auth screens' register, its failures through lib/auth.ts
 * `humanise`.
 */

import {
  SETTINGS_ACCOUNT,
  SLOW_EMAIL_NOTE,
  emailProblem,
  emailTimedOut,
  forgetOAuthAttempt,
  humanise,
  passwordProblem,
  rememberOAuthAttempt,
  siteUrl,
  withNext,
  type AuthResult,
} from "./auth";
import { supabaseBrowser } from "./supabase-browser";

/** The parts of an auth user this page reads (Supabase's `User`). */
export interface AccountUser {
  email?: string | null;
  new_email?: string | null;
  is_anonymous?: boolean | null;
  identities?: { provider?: string | null }[] | null;
  app_metadata?: { provider?: string | null; providers?: unknown } | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface AccountView {
  /** `account`: signed in with an email. `guest`: an anonymous session. `none`: no session. */
  kind: "account" | "guest" | "none";
  email: string | null;
  /** An email change waiting on its link (`new_email`). */
  pendingEmail: string | null;
  /** Google is a way in. */
  google: boolean;
  /** A password is a way in. */
  password: boolean;
}

/**
 * What the account holds, read off the auth user. A password is known
 * three ways: the email identity (a sign-up with one), the flag this page
 * sets when it gives a Google account one (`password_set`), or no Google
 * at all, since a password is then the only way the account signs in.
 */
export function accountView(user: AccountUser | null | undefined): AccountView {
  if (!user) return { kind: "none", email: null, pendingEmail: null, google: false, password: false };
  if (user.is_anonymous) return { kind: "guest", email: null, pendingEmail: null, google: false, password: false };
  const providers = new Set<string>();
  for (const i of user.identities ?? []) if (i?.provider) providers.add(i.provider);
  const listed = user.app_metadata?.providers;
  if (Array.isArray(listed)) for (const p of listed) if (typeof p === "string") providers.add(p);
  if (user.app_metadata?.provider) providers.add(user.app_metadata.provider);
  const google = providers.has("google");
  const password = providers.has("email") || user.user_metadata?.password_set === true || !google;
  return {
    kind: user.email ? "account" : "guest",
    email: user.email ?? null,
    pendingEmail: user.new_email && user.new_email !== user.email ? user.new_email : null,
    google,
    password,
  };
}

/** The account as the server has it now; null when it cannot be read. */
export async function readAccount(): Promise<AccountView | null> {
  const db = supabaseBrowser();
  if (!db) return accountView(null);
  try {
    const { data: s } = await db.auth.getSession();
    if (!s.session) return accountView(null);
    const { data, error } = await db.auth.getUser();
    // A failed server read keeps the session's own copy of the user.
    return accountView(error ? s.session.user : data.user);
  } catch {
    return null;
  }
}

const NOT_SET_UP: AuthResult = { ok: false, error: "Accounts aren't configured yet." };

/**
 * A new email. Supabase keeps the old one until the link it sends is
 * opened (both links, with "Secure email change" on), so nothing changes
 * here yet; the link lands on /auth/callback, which says which step it was.
 */
export async function changeEmail(next: string, current: string | null): Promise<AuthResult> {
  const problem = emailProblem(next);
  if (problem) return { ok: false, error: problem, field: "email" };
  const email = next.trim();
  if (current && email.toLowerCase() === current.toLowerCase()) {
    return { ok: false, error: "That's the email you have now.", field: "email" };
  }
  const db = supabaseBrowser();
  if (!db) return NOT_SET_UP;
  const { error } = await db.auth.updateUser(
    { email },
    { emailRedirectTo: `${siteUrl()}${withNext("/auth/callback?changed=email", SETTINGS_ACCOUNT)}` }
  );
  if (error) {
    if (emailTimedOut(error.message)) return { ok: true, checkInbox: true, note: SLOW_EMAIL_NOTE };
    const m = error.message.toLowerCase();
    if (m.includes("already been registered") || m.includes("already registered") || m.includes("email address is taken") || m.includes("email_exists")) {
      return { ok: false, error: "Another Ethos account has that email.", field: "email" };
    }
    return { ok: false, error: humanise(error.message) };
  }
  return { ok: true, checkInbox: true };
}

/** What the change-password form sends: the password now and the new one. */
export interface PasswordChange {
  email: string;
  /** The password now; absent when the account has none (Google only). */
  current?: string;
  next: string;
}

/** What the password form's result can point at. */
export type PasswordResult = Omit<AuthResult, "field"> & { field?: "current" | "password" };

/**
 * Change the password, or give a Google-only account its first one. The
 * password now is checked first, by signing in with it (the same
 * account, so the session stays this person's), so a phone left
 * unlocked cannot take the account. Then the new one is set, and the
 * account is marked as holding one.
 */
export async function changePassword({ email, current, next }: PasswordChange): Promise<PasswordResult> {
  if (current !== undefined && !current) {
    return { ok: false, error: "Enter the password you have now.", field: "current" };
  }
  const problem = passwordProblem(next, email);
  if (problem) return { ok: false, error: problem, field: "password" };
  if (current !== undefined && current === next) {
    return { ok: false, error: "That's the password you have now. Pick a new one.", field: "password" };
  }
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: NOT_SET_UP.error };
  if (current !== undefined) {
    const { error: wrong } = await db.auth.signInWithPassword({ email, password: current });
    if (wrong) {
      return /invalid login credentials/i.test(wrong.message)
        ? { ok: false, error: "That isn't the password you have now.", field: "current" }
        : { ok: false, error: humanise(wrong.message) };
    }
  }
  const { error } = await db.auth.updateUser({ password: next, data: { password_set: true } });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

/**
 * Add Google as a way into this account. The browser goes to Google and
 * comes back to /auth/callback marked `linked=google`, then on to this
 * page. A Google account that already has its own Ethos account is
 * refused by the server, and the callback says so.
 */
export async function linkGoogle(): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return NOT_SET_UP;
  rememberOAuthAttempt("signin", SETTINGS_ACCOUNT);
  try {
    const { error } = await db.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${siteUrl()}${withNext("/auth/callback?linked=google", SETTINGS_ACCOUNT)}` },
    });
    if (error) {
      forgetOAuthAttempt();
      // humanise's line for this one is the guest's ("save with your
      // email instead"); this account already has its email.
      return {
        ok: false,
        error: /manual linking/i.test(error.message) ? "Ethos can't link Google yet." : humanise(error.message),
      };
    }
    return { ok: true };
  } catch {
    forgetOAuthAttempt();
    return { ok: false, error: "Google didn't open. Try again." };
  }
}

/**
 * Sign out on every phone and browser this account is signed in on, this
 * one included. A failure leaves this one signed in and says so.
 */
export async function signOutEverywhere(): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return NOT_SET_UP;
  try {
    const { error } = await db.auth.signOut({ scope: "global" });
    if (error) return { ok: false, error: "That didn't go through, so you're still signed in. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "That didn't go through, so you're still signed in. Try again." };
  }
}
