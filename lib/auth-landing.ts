/**
 * Where a sign-in lands, and the one line that says what happened (#497).
 *
 * Timothy, 17 Nov: "If i sign up it wont take me to it. or maybe i
 * signed in w an acc that was anyway. Say signing into account or
 * account exists after u sign in. if u sign into an account that
 * somehow hasnt done the onboarding make them onboard."
 *
 * Every way onto an account (email and password, a sign-up that met an
 * account, a confirmation link, Google through /auth/callback, a
 * password link) asks `introFinished` once it is signed in: not
 * finished, the introduction (/welcome, the room first); finished, where
 * it was going. A read that fails leaves it going where it was going,
 * so nobody who finished is ever sent back through it, and the
 * introduction never sends anyone anywhere, so nothing loops.
 *
 * The email form's landing screen says what happened once, in the
 * toast's ink capsule (components/AuthNote.tsx): the note is left in
 * this tab's sessionStorage just before the page goes, and taken (read
 * and removed) by the page it lands on. /auth/callback says it on its
 * own screen instead (lib/auth.ts `callbackWelcome`).
 */
import { introFinished } from "./answers-sync";

export const AUTH_NOTE = {
  /** /signin: an account that was there already. */
  signedIn: "Signed in to your account.",
  /** A sign-up that met an account with that email and signed in to it (#426). */
  existing: "That email already has an account, so you're signed in.",
  /** A sign-up that made the account and is signed in to it. */
  created: "Account created.",
} as const;

export type AuthNote = keyof typeof AUTH_NOTE;

export const AUTH_NOTE_KEY = "ethos.auth-note";

/** The introduction, which opens on the room for a walk not begun. */
export const INTRO_PATH = "/welcome";

/**
 * How long a landing waits on the account's onboarding row before it goes
 * where it was going anyway. One small read; a slow network still lands.
 */
export const FINISHED_CAP_MS = 2500;

/** What the form's own sign-in told it, as the note to leave. */
export function noteFor(mode: "signup" | "signin", account: "existing" | "new" | undefined): AuthNote {
  if (mode === "signin") return "signedIn";
  return account === "new" ? "created" : "existing";
}

/**
 * Where someone signed in goes: the introduction when it is not finished,
 * else the page that asked (`next`) or Today. Pure.
 */
export function landingAfterAuth(finished: boolean | null, next: string | null): string {
  if (finished === false) return INTRO_PATH;
  return next ?? "/";
}

/** `introFinished`, or null once the cap runs out or the read fails. */
export function finishedWithin(ms = FINISHED_CAP_MS): Promise<boolean | null> {
  return Promise.race([
    introFinished().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function leaveAuthNote(note: AuthNote): void {
  try {
    sessionStorage.setItem(AUTH_NOTE_KEY, note);
  } catch {}
}

/** The note left for this page, once: read and removed, so a reload says nothing. */
export function takeAuthNote(): string | null {
  try {
    const left = sessionStorage.getItem(AUTH_NOTE_KEY);
    if (left === null) return null;
    sessionStorage.removeItem(AUTH_NOTE_KEY);
    return Object.keys(AUTH_NOTE).includes(left) ? AUTH_NOTE[left as AuthNote] : null;
  } catch {
    return null;
  }
}

/** Once signed in on the form: leaves the note and says where to go. */
export async function landAfterAuth(next: string | null, note: AuthNote): Promise<string> {
  const finished = await finishedWithin();
  leaveAuthNote(note);
  return landingAfterAuth(finished, next);
}
