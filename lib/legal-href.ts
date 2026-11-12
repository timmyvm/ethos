import { authHref } from "./use-paywall-return";

/**
 * Privacy and Terms, from an account ask (#446).
 *
 * What an account agrees to can be read before it is made: both asks
 * (the introduction's last step and /signup) link the two pages in the
 * words Settings uses for them. The link says where it came from, so
 * the page's back is the ask that was left: `from=welcome`, where the
 * walk resumes on its account step, or `from=signup` with the `next`
 * the form was carrying (a paywall's return), checked as every `next`
 * is.
 */
export type LegalFrom = "signup" | "welcome";

export function legalHref(path: "/privacy" | "/terms", from: LegalFrom, next: string | null = null): string {
  const kept = from === "signup" ? authHref("signup", next).split("?")[1] : undefined;
  return `${path}?from=${from}${kept ? `&${kept}` : ""}`;
}
