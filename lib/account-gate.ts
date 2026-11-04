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

const OPEN_PREFIXES = ["/welcome", "/signup", "/signin", "/auth", "/tester", "/about", "/privacy", "/terms"];

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
 * is not asked here: Today sends it through the introduction, which ends
 * on the account ask.
 */
export function needsAccount(state: AccountState, path: string, fresh: boolean): boolean {
  if (fresh || openWithoutAccount(path)) return false;
  if (state.signedIn && !state.anonymous) return false;
  // The email is on its way: the account exists once they open the link.
  if (state.anonymous && state.pendingEmail) return false;
  return true;
}
