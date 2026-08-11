/**
 * Accounts (decisions 11 Aug, §0.1–§0.2).
 *
 * Anonymous-first, as already specced: rep 1 happens with no account,
 * and the account is offered once the product has visibly worked. The
 * whole job of this module is the promise attached to that — anonymous
 * progress SURVIVES the upgrade. No lost reps, no lost streak.
 *
 * The mechanism is that there is no migration: `updateUser` attaches an
 * email and a password to the SAME auth user the anonymous session
 * already had, so every rep, XP event, freeze and coin keeps pointing at
 * the same id. Nothing is copied, so nothing can be dropped in the copy.
 *
 * Email and password only. No social login — one less dependency and one
 * less consent screen.
 */

import { supabaseBrowser } from "./supabase-browser";

/** Where confirmation and reset links come back to. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://speakethos.com";
}

export const MIN_PASSWORD = 8;

export interface AuthResult {
  ok: boolean;
  /** Shown to the user verbatim. Plain, never blaming. */
  error?: string;
  /** True when the next step is in their inbox rather than on screen. */
  checkInbox?: boolean;
}

/**
 * Password rules, stated up front rather than enforced by a red border
 * after the fact. One rule: length. Composition rules ("one symbol, one
 * digit") measurably push people toward `Password1!` and we'd rather
 * have a long simple one.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `${MIN_PASSWORD} characters or more. Length beats punctuation.`;
  }
  return null;
}

export function emailProblem(email: string): string | null {
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email.trim())
    ? null
    : "That doesn't look like an email address.";
}

export interface SessionState {
  /** There is a session at all. */
  signedIn: boolean;
  /** …and it's the throwaway kind, holding progress nobody owns yet. */
  anonymous: boolean;
  email: string | null;
}

export async function sessionState(): Promise<SessionState> {
  const db = supabaseBrowser();
  if (!db) return { signedIn: false, anonymous: false, email: null };
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return { signedIn: false, anonymous: false, email: null };
  return {
    signedIn: true,
    anonymous: user.is_anonymous ?? false,
    email: user.email ?? null,
  };
}

/**
 * Turn the current anonymous session into a real account, or create one
 * from scratch if there isn't a session to upgrade.
 *
 * The upgrade path is the one that matters and it is deliberately NOT
 * "sign up, then move the data across": the password and the email are
 * attached to the existing user, so the reps were never anywhere else.
 */
export async function createAccount(
  email: string,
  password: string
): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };

  const problem = emailProblem(email) ?? passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const { data } = await db.auth.getUser();
  const anonymous = data.user?.is_anonymous ?? false;

  if (anonymous) {
    // Password first: if the email confirmation is the step that fails,
    // the account still has credentials to sign back in with.
    const pw = await db.auth.updateUser({ password });
    if (pw.error) return { ok: false, error: humanise(pw.error.message) };

    const upgrade = await db.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${siteUrl()}/auth/callback` }
    );
    if (upgrade.error) return { ok: false, error: humanise(upgrade.error.message) };
    return { ok: true, checkInbox: true };
  }

  const { error } = await db.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true, checkInbox: true };
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };
  const { error } = await db.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

export async function sendReset(email: string): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };
  const problem = emailProblem(email);
  if (problem) return { ok: false, error: problem };
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    // Straight to the form. Nothing to detect on arrival, so there's no
    // race between the link being read and the page deciding what it is.
    redirectTo: `${siteUrl()}/auth/reset`,
  });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true, checkInbox: true };
}

export async function setNewPassword(password: string): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabaseBrowser()?.auth.signOut();
}

/**
 * Supabase's messages are written for developers. These are the ones a
 * user can actually hit, in the register the rest of the app uses:
 * short, specific, no apology, no blame.
 */
function humanise(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match. Try again, or reset it below.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm the link in your inbox first — then this will work.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email already has an Ethos account. Sign in instead.";
  }
  if (m.includes("user already exists") || m.includes("email address is taken")) {
    return "That email already has an Ethos account. Sign in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many tries in a row. Give it a minute.";
  }
  if (m.includes("weak") || m.includes("password should be")) {
    return `${MIN_PASSWORD} characters or more. Length beats punctuation.`;
  }
  return message;
}
