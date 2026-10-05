/**
 * Accounts (decisions 11 Aug, §0.1–§0.2).
 *
 * Anonymous-first, as already specced: rep 1 happens with no account,
 * and the account is offered once the product has visibly worked. The
 * whole job of this module is the promise attached to that — anonymous
 * progress SURVIVES the upgrade. No lost reps, no lost streak.
 *
 * The mechanism is that there is no migration: `updateUser` attaches an
 * email to the SAME auth user the anonymous session already had, so
 * every rep, XP event, freeze and coin keeps pointing at the same id.
 * Nothing is copied, so nothing can be dropped in the copy.
 *
 * The password comes LAST, on the page the confirmation link lands on
 * (DECISIONS #142): GoTrue refuses to put a password on an anonymous
 * user with no email, so the order isn't a style choice — attach email,
 * prove ownership from the inbox, then set the password on an identity
 * that can carry it.
 *
 * Email + password, plus Google (27 Aug, Timothy's call — the provider
 * is configured in the Supabase dashboard). The anonymous promise holds
 * on the Google path too: an anonymous session with recordings LINKS the
 * Google identity to the same auth user rather than signing into a new
 * one, so nothing migrates and nothing can be lost migrating.
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
  /** Quiet caveat under the check-inbox headline (slow email server). */
  note?: string;
  /**
   * The field the error is about, when it is one field's fault: the
   * form marks it invalid, ties the message to it and puts the cursor
   * back in it (auth-19). Absent for anything the server said.
   */
  field?: "email" | "password";
}

/**
 * The auth server sends confirmation mail synchronously, and a hung
 * SMTP connection eats its whole 10s budget before returning 504
 * (measured 12 Aug, BUILT.md). The send usually completes AFTER the
 * error, so a timeout is routed to the check-inbox screen with this
 * caveat instead of stranding the user on the form. The real fix is
 * the dashboard's SMTP settings; this is the honest handling of the
 * failure until then, and the console line is what makes it visible.
 */
const SLOW_EMAIL_NOTE =
  "The email server was slow, so the mail may take a few minutes. Nothing there after that? Send it again.";

function emailTimedOut(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("deadline") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("504") ||
    m.includes("gateway")
  );
}

/**
 * Password rules, stated up front rather than enforced by a red border
 * after the fact. One rule: length. Composition rules ("one symbol, one
 * digit") measurably push people toward `Password1!` and we'd rather
 * have a long simple one.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Use ${MIN_PASSWORD} characters or more.`;
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

  const { data } = await db.auth.getUser();
  const anonymous = data.user?.is_anonymous ?? false;

  if (anonymous) {
    /*
     * Email only — no password is collected on this path (#142). The
     * original order set the password first ("so a failed confirmation
     * still leaves credentials"), and GoTrue rejected it every single
     * time: a password cannot attach to an anonymous user with no
     * email. The upgrade therefore never worked until 12 Aug. This is
     * Supabase's documented convert sequence instead: attach the
     * email, prove ownership via the inbox, and the landing page
     * (/auth/reset?first=1 — straight there, no callback race, #82)
     * collects the password once there's an identity to hang it on.
     */
    const problem = emailProblem(email);
    if (problem) return { ok: false, error: problem, field: "email" };

    const upgrade = await db.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${siteUrl()}/auth/reset?first=1` }
    );
    if (upgrade.error) {
      if (emailTimedOut(upgrade.error.message)) {
        console.error(
          "auth: email attach timed out (SMTP misconfig, BUILT.md):",
          upgrade.error.message
        );
        return { ok: true, checkInbox: true, note: SLOW_EMAIL_NOTE };
      }
      return { ok: false, error: humanise(upgrade.error.message) };
    }
    return { ok: true, checkInbox: true };
  }

  const emailWrong = emailProblem(email);
  if (emailWrong) return { ok: false, error: emailWrong, field: "email" };
  const passwordWrong = passwordProblem(password);
  if (passwordWrong) {
    return { ok: false, error: passwordWrong, field: "password" };
  }

  const { error } = await db.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    if (emailTimedOut(error.message)) {
      console.error("auth: signup email timed out:", error.message);
      return { ok: true, checkInbox: true, note: SLOW_EMAIL_NOTE };
    }
    return { ok: false, error: humanise(error.message) };
  }
  return { ok: true, checkInbox: true };
}

/**
 * Google, both jobs. On /signup an anonymous session with progress
 * LINKS the Google identity to the user its reps already point at —
 * signing in fresh there would orphan them. On /signin the intent is
 * "get into my existing account", so it's a plain OAuth sign-in and the
 * form's warning about this device's recordings covers the trade.
 *
 * Both calls navigate away to Google on success, so `ok: true` here
 * means "the redirect is happening", not "signed in".
 */
export async function signInWithGoogle(
  mode: "signup" | "signin"
): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };

  // Before leaving: where they started, so a cancel at Google can send
  // them straight back there (app/auth/callback). Written before the
  // call because a successful call is already navigating; every failure
  // below takes it back, so a call that never left leaves no attempt
  // behind to mislabel a later /auth/callback visit.
  rememberOAuthAttempt(mode);
  const failed = (message: string): AuthResult => {
    forgetOAuthAttempt();
    return { ok: false, error: humanise(message) };
  };
  const redirectTo = `${siteUrl()}/auth/callback`;
  try {
    if (mode === "signup") {
      const { data } = await db.auth.getUser();
      if (data.user?.is_anonymous) {
        const { error } = await db.auth.linkIdentity({
          provider: "google",
          options: { redirectTo },
        });
        if (error) return failed(error.message);
        return { ok: true };
      }
    }

    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) return failed(error.message);
    return { ok: true };
  } catch (e) {
    forgetOAuthAttempt();
    throw e;
  }
}

/*
 * ---- The Google round trip, coming back ------------------------------
 *
 * Tapping Google hands the page to Google, and there are three ways
 * back that are not "signed in": the OAuth sheet is dismissed (an
 * installed PWA or iOS shows the same live page again), the browser's
 * back button restores the page from the back/forward cache, or the
 * person says no AT Google and Supabase lands them on /auth/callback
 * with `error=access_denied`. The first two used to leave the button
 * disabled for good, the third read "That link has already been used."
 * These are the pieces both ends share.
 */

/** sessionStorage, so it rides the same tab's round trip and nothing else. */
export const OAUTH_KEY = "ethos.oauth";
/** An attempt older than this is not the one that just came back. */
export const OAUTH_TTL_MS = 30 * 60_000;
/**
 * How long a Google tap holds its button before giving it back even if
 * no return signal ever fires. Long enough to stop a double tap, short
 * enough that a dismissed sheet never strands anyone.
 */
export const GOOGLE_PENDING_MS = 5000;

export interface OAuthAttempt {
  /** The path the attempt started from, e.g. "/signup" or "/welcome". */
  from: string;
  mode: "signup" | "signin";
  at: number;
}

/**
 * A path this app may send somebody back to: same-origin, absolute,
 * and not the callback itself (which would loop).
 */
export function safeReturnPath(path: unknown): string | null {
  if (typeof path !== "string") return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return null;
  }
  if (path.startsWith("/auth/")) return null;
  return path;
}

export function parseOAuthAttempt(
  raw: string | null,
  now: number = Date.now()
): OAuthAttempt | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<OAuthAttempt>;
    const from = safeReturnPath(p.from);
    if (!from) return null;
    if (p.mode !== "signup" && p.mode !== "signin") return null;
    if (typeof p.at !== "number" || now - p.at > OAUTH_TTL_MS || p.at > now + 60_000) {
      return null;
    }
    return { from, mode: p.mode, at: p.at };
  } catch {
    return null;
  }
}

export function rememberOAuthAttempt(mode: "signup" | "signin"): void {
  if (typeof window === "undefined") return;
  const from = safeReturnPath(window.location.pathname + window.location.search);
  if (!from) return;
  try {
    sessionStorage.setItem(
      OAUTH_KEY,
      JSON.stringify({ from, mode, at: Date.now() } satisfies OAuthAttempt)
    );
  } catch {}
}

export function readOAuthAttempt(): OAuthAttempt | null {
  try {
    return parseOAuthAttempt(sessionStorage.getItem(OAUTH_KEY));
  } catch {
    return null;
  }
}

/**
 * True when the attempt started on `path` (its own page, any query).
 * The introduction uses it to reopen on its account ask when somebody
 * comes back from Google without an account: a browser that reloads on
 * back, rather than restoring, would otherwise land them on the plan
 * with no Google button in sight (review of 25 Sep).
 */
export function attemptStartedOn(
  attempt: OAuthAttempt | null,
  path: string
): boolean {
  if (!attempt) return false;
  const [pathname] = attempt.from.split(/[?#]/);
  return pathname === path;
}

export function forgetOAuthAttempt(): void {
  try {
    sessionStorage.removeItem(OAUTH_KEY);
  } catch {}
}

/**
 * What an /auth/callback URL says went wrong, read the way Supabase
 * reads it: the fragment and the query both, the query winning.
 *
 * - `link`: an email link that expired or was already used.
 * - `taken`: the Google account already belongs to another user, so the
 *   anonymous session could not be linked to it.
 * - `google`: anything else, which from the person's side is one thing:
 *   Google did not finish signing them in (most often, they said no).
 */
export type CallbackProblem =
  | { kind: "none" }
  | { kind: "link" }
  | { kind: "taken"; message: string }
  | { kind: "google" };

export function callbackProblem(href: string): CallbackProblem {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  url.searchParams.forEach((v, k) => params.set(k, v));
  const error = params.get("error");
  const code = params.get("error_code");
  const description = params.get("error_description") ?? "";
  if (!error && !code && !description) return { kind: "none" };
  if (code === "otp_expired" || /email link|otp/i.test(description)) {
    return { kind: "link" };
  }
  if (
    code === "identity_already_exists" ||
    /already linked|already exists/i.test(description)
  ) {
    return { kind: "taken", message: humanise("identity is already linked") };
  }
  return { kind: "google" };
}

/** True when the URL is carrying a session in (tokens or a PKCE code). */
export function callbackCarriesSession(href: string): boolean {
  try {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    return hash.has("access_token") || url.searchParams.has("code");
  } catch {
    return false;
  }
}

const SIGNED_OUT: SessionState = { signedIn: false, anonymous: false, email: null };

/**
 * Wait for a real (non-anonymous) account, bounded. The client reads the
 * session out of the URL as it initialises, and `getUser` already waits
 * for that, so this usually resolves on the first read; the listener and
 * the deadline cover a slow exchange without a fixed sleep.
 */
export async function waitForAccount(timeoutMs = 5000): Promise<SessionState> {
  const db = supabaseBrowser();
  if (!db) return SIGNED_OUT;
  await db.auth.initialize().catch(() => {});
  const first = await sessionState().catch(() => SIGNED_OUT);
  if ((first.signedIn && !first.anonymous) || timeoutMs <= 0) return first;
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe = () => {};
    const finish = (s: SessionState) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(s);
    };
    const timer = setTimeout(() => {
      sessionState().then(finish, () => finish(first));
    }, timeoutMs);
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user && !user.is_anonymous) {
        finish({ signedIn: true, anonymous: false, email: user.email ?? null });
      }
    });
    unsubscribe = () => data.subscription.unsubscribe();
    if (done) unsubscribe();
  });
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  /* Checked here, before Supabase, as createAccount and sendReset do:
     the form is noValidate (auth-19), so this is the only thing between
     an empty field and a developer's error message. */
  const emailWrong = emailProblem(email);
  if (emailWrong) return { ok: false, error: emailWrong, field: "email" };
  if (!password) {
    return { ok: false, error: "Enter your password.", field: "password" };
  }
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
  if (problem) return { ok: false, error: problem, field: "email" };
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    // Straight to the form. Nothing to detect on arrival, so there's no
    // race between the link being read and the page deciding what it is.
    redirectTo: `${siteUrl()}/auth/reset`,
  });
  if (error) {
    if (emailTimedOut(error.message)) {
      console.error("auth: reset email timed out:", error.message);
      return { ok: true, checkInbox: true, note: SLOW_EMAIL_NOTE };
    }
    return { ok: false, error: humanise(error.message) };
  }
  return { ok: true, checkInbox: true };
}

export async function setNewPassword(password: string): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem, field: "password" };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabaseBrowser()?.auth.signOut();
}

/**
 * The end of the road: /api/account deletes the audio, every row and
 * the auth user itself (in that order, so a partial failure strands
 * nothing). Anonymous sessions qualify too; their token authorises
 * deleting exactly themselves. On success the local session is signed
 * out here; the caller clears the rest of the device.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Accounts aren't configured yet." };
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: "There's no signed-in session to delete." };
  }
  let res: Response;
  try {
    res = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return {
      ok: false,
      error: "The server didn't answer. Nothing was deleted; try again.",
    };
  }
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: body?.error ?? "That didn't go through. Nothing was deleted.",
    };
  }
  await db.auth.signOut().catch(() => {});
  return { ok: true };
}

/**
 * Supabase's messages are written for developers. These are the ones a
 * user can actually hit, in the register the rest of the app uses:
 * short, specific, no apology, no blame.
 */
function humanise(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    // "Forgot?" sits on the password row, above this line (auth-16).
    return "That email and password don't match. Try again or reset it.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm the link in your inbox first. Then this will work.";
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
  if (m.includes("manual linking")) {
    // linkIdentity needs the dashboard's manual-linking toggle. The
    // person on this screen can't flip it, so offer the path that works.
    return "Google can't attach to this device's recordings yet. Save with your email instead.";
  }
  if (m.includes("identity is already linked")) {
    return "That Google account already belongs to another Ethos account. Sign in with it instead.";
  }
  if (m.includes("anonymous user")) {
    // Only reachable if a password update runs before the email is
    // confirmed — the exact wall #142 exists to route around.
    return "Confirm your email first. The link in your inbox does it.";
  }
  if (
    m.includes("deadline") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("504")
  ) {
    // Measured 12 Aug: the auth server sends the confirmation mail
    // synchronously, and a hung SMTP connection eats its whole 10s
    // budget — the request often completes AFTER this error reached
    // the user, so "check your inbox anyway" is honest advice.
    return "The email server took too long. Check your inbox anyway; the mail often lands after this error.";
  }
  if (m.includes("weak") || m.includes("password should be")) {
    return `Use ${MIN_PASSWORD} characters or more.`;
  }
  return message;
}
