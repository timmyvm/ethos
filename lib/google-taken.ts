/**
 * "Continue with Google" with a Google account that already has Ethos
 * (#414). The account ask links Google to the guest session the phone
 * already holds (lib/auth.ts signInWithGoogle, `linkIdentity`), and when
 * that Google account belongs to an Ethos account already, Supabase says
 * "Identity is already linked to another user" and sends the person back
 * with the error in the URL. Nothing read it there: the phone landed on
 * Today, went to the introduction, reopened its account ask, and the
 * Google button did the same again (Timothy, 5 Nov, three tries in
 * fifteen seconds). Someone who taps Continue with Google with an
 * account means "sign me in", so that is what happens: the sign-in runs
 * with the same Google account, once, and testing joined on the guest
 * rides along as it does for every sign-in (lib/tester-client.ts).
 */
import type { CallbackProblem, OAuthAttempt } from "./auth";

/** Set by the boot script when the page opened carrying the error. */
export const TAKEN_KEY = "ethos.google-taken";
/** The attempt (its `at`) already switched to a sign-in, so it never loops. */
export const SWITCHED_KEY = "ethos.google-switched";

/** Whether this return should become a Google sign-in. */
export function shouldSwitch(
  taken: boolean,
  attempt: OAuthAttempt | null,
  switchedAt: string | null
): boolean {
  if (!taken || !attempt || attempt.mode !== "signup") return false;
  // A guest holding recordings hears what a sign-in leaves first (`warnsFirst`).
  if (warnsFirst(taken, attempt)) return false;
  return switchedAt !== String(attempt.at);
}

/**
 * A sign-up by a guest holding recordings (a pre-#410 guest) met a
 * Google account with Ethos (#426, review). Signing in to it leaves the
 * recordings on the guest, as every sign-in does (#414), and the email
 * path says so before its sign-in; so this one is not switched on its
 * own. The callback's taken screen says what stays, with Google's
 * sign-in and the email form that keeps them.
 */
export function warnsFirst(taken: boolean, attempt: OAuthAttempt | null): boolean {
  return taken && attempt?.mode === "signup" && (attempt.recordings ?? 0) > 0;
}

/**
 * The callback's taken screen, for a return that landed anywhere else
 * (Supabase's Site URL when it drops the redirect): the same error in
 * the fragment, and the page to go on to in `next`, which the callback
 * reads back through `nextFrom` as it reads any. Type-only imports here:
 * the layout inlines this module's boot script on the server.
 */
export function takenScreenHref(next: string | null | undefined): string {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return `/auth/callback${query}#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user`;
}

/** The callback's own reading of the URL, narrowed to this one case. */
export function isTaken(problem: CallbackProblem): boolean {
  return problem.kind === "taken";
}

let switching = false;
/** True while the switch is leaving for Google; the account gate waits. */
export function googleSwitching(): boolean {
  return switching;
}
export function markGoogleSwitching(on: boolean): void {
  switching = on;
}

/**
 * Calls `release` once, at the first sign the person is back on this
 * page without having finished at Google, the same signs the Google
 * button reads (lib/use-oauth-return.ts): the page restored from the
 * back/forward cache, shown again, refocused after a dismissed sheet,
 * or `ms` gone by. The switch's cover used to stay up for good after
 * any of them, with nothing on it to tap. Returns the cleanup.
 */
export function onBackWithoutFinishing(release: () => void, ms: number): () => void {
  const onPageShow = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) fire();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") fire();
  };
  const stop = () => {
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", fire);
    window.clearTimeout(timer);
  };
  function fire() {
    stop();
    release();
  }
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", fire);
  const timer = window.setTimeout(fire, ms);
  return stop;
}

/**
 * Before React, before any redirect drops the URL's fragment: note that
 * this page opened with Google's "already linked" error. Plain ES5 in a
 * string, inlined into <head> (see lib/theme-boot.ts for why a string).
 */
export const googleTakenBootScript = `
(function(){try{
  var p = new URLSearchParams(location.hash.replace(/^#/, ''));
  new URLSearchParams(location.search).forEach(function(v, k){ p.set(k, v); });
  var c = p.get('error_code') || '', d = p.get('error_description') || '';
  if (c === 'identity_already_exists' || /already linked/i.test(d)) sessionStorage.setItem('${TAKEN_KEY}', String(Date.now()));
}catch(e){}})();
`;
