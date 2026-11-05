/**
 * An account before the app (#410, Timothy: "in onboarding they have to
 * make an account", guests too). The introduction ends on its account
 * ask with no "Not now", and anywhere else in the app a guest (or a
 * device with no session that has been through the introduction) is
 * sent to sign up, then brought back where they were.
 *
 * Open without an account: the introduction and every screen sign-up
 * needs (the auth pages, the inbox link's landing, the tester code and
 * consent, which come before the account ask), and the pages a person
 * reads before deciding (about, privacy, terms).
 */

import { supabaseBrowser } from "./supabase-browser";

const OPEN_PREFIXES = ["/welcome", "/signup", "/signin", "/auth", "/tester", "/about", "/privacy", "/terms"];

/**
 * Where Sign out lands. A signed-out device that has been through the
 * introduction is sent to sign up from Today, and an account holder
 * leaving theirs was landing on "Create your account".
 */
export const SIGNED_OUT_HOME = "/signin";

export interface AccountState {
  /** A session exists, guest or account. */
  signedIn: boolean;
  /** The session is a guest's (Supabase anonymous). */
  anonymous: boolean;
  /** A guest who asked for an email account and has a confirmation link on its way. */
  pendingEmail: boolean;
}

export function openWithoutAccount(path: string): boolean {
  return OPEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/**
 * Whether this screen sends the person to sign up first. A fresh device
 * is not asked here: it goes through the introduction instead
 * (`introFirst`), which ends on the account ask.
 */
export function needsAccount(state: AccountState, path: string, fresh: boolean): boolean {
  if (fresh || openWithoutAccount(path)) return false;
  if (state.signedIn && !state.anonymous) return false;
  // The email is on its way: the account exists once they open the link.
  if (state.anonymous && state.pendingEmail) return false;
  return true;
}

/**
 * Whether a fresh device is sent to the introduction from this screen.
 * Today did it alone, so a shared link to /rep or /history on a new
 * browser stayed put and could record without an account.
 */
export function introFirst(path: string, fresh: boolean): boolean {
  return fresh && !openWithoutAccount(path);
}

/**
 * Whether an auth screen's way back to `href` lets the person stay
 * there. Not when the gate would send them straight back to sign up:
 * that Back looked dead, and testers tapped it again and again. An
 * unknown state keeps it.
 */
export function backStays(state: AccountState | null, href: string, fresh: boolean): boolean {
  if (!state) return true;
  const path = href.split(/[?#]/)[0] || "/";
  return !needsAccount(state, path, fresh);
}

/** What auth-js's getSession answers, as much of it as the gate reads. */
export interface SessionRead {
  data: { session: { user: { id: string; is_anonymous?: boolean; new_email?: string } } | null };
  error: unknown;
}

/**
 * The gate's reading of this device's stored session, or null when it
 * cannot say. getSession answers with an error and no session when a
 * lapsed token could not be refreshed (offline, or the auth server
 * down) while the session is still stored: that is an account it
 * cannot reach, never a device without one, and reading it as signed
 * out sent account holders to "Create your account".
 */
export function accountState(read: SessionRead, emailAsked: string | null = null, now = Date.now()): AccountState | null {
  if (read.error) return null;
  const user = read.data.session?.user ?? null;
  return {
    signedIn: user !== null,
    anonymous: user?.is_anonymous ?? false,
    pendingEmail: Boolean(user?.new_email) || (user !== null && emailAskedFor(emailAsked, user.id, now)),
  };
}

/**
 * A guest's email account asked for when the auth server's answer timed
 * out (lib/auth.ts createAccount). The mail usually goes anyway, but the
 * session never learns the new address, so the gate sent them straight
 * back to the form they had just used. Kept for that guest only, and
 * for as long as Supabase's confirmation link lives (24 hours).
 */
export const EMAIL_ASKED_KEY = "ethos.email-asked";
export const EMAIL_ASKED_MS = 24 * 60 * 60_000;

export function emailAskedFor(raw: string | null, userId: string, now = Date.now()): boolean {
  if (!raw) return false;
  try {
    const p = JSON.parse(raw) as { user?: unknown; at?: unknown };
    if (p.user !== userId || typeof p.at !== "number") return false;
    return now - p.at < EMAIL_ASKED_MS && p.at <= now + 60_000;
  } catch {
    return false;
  }
}

export function rememberEmailAsked(userId: string, now = Date.now()): void {
  try {
    localStorage.setItem(EMAIL_ASKED_KEY, JSON.stringify({ user: userId, at: now }));
  } catch {}
}

function readEmailAsked(): string | null {
  try {
    return localStorage.getItem(EMAIL_ASKED_KEY);
  } catch {
    return null;
  }
}

/**
 * This device's state as the gate reads it, from the stored session (no
 * network call unless a lapsed token needs refreshing), or null when it
 * cannot say.
 */
export async function readAccountState(): Promise<AccountState | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  try {
    return accountState(await db.auth.getSession(), readEmailAsked());
  } catch {
    return null;
  }
}
