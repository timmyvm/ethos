/**
 * Coming back from Stripe (docs/ladder-spec.md, "Checkout return").
 *
 * Checkout's success page sends the browser to `/you?checkout=done`
 * (lib/billing.ts). The portal's back link goes wherever the manage
 * sheet said, and the sheet says the page it was opened on plus
 * `portal=done`, so that page knows to ask Stripe once for the plan as
 * it now stands (a new card clears a declined renewal; a cancel made
 * in the portal ends the plan). Both flags come out of the address as
 * soon as they are read, so a reload or a shared link never syncs or
 * celebrates twice.
 *
 * Pure: the pages read `window.location` after mount and pass it here.
 */

export const CHECKOUT_PARAM = "checkout";
export const PORTAL_PARAM = "portal";
const DONE = "done";

const BASE = "https://ethos.invalid";

export type StripeReturn = "checkout" | "portal" | null;

/** Which return a path carries. Checkout wins if somehow both are set. */
export function readReturn(path: string): StripeReturn {
  try {
    const q = new URL(path, BASE).searchParams;
    if (q.get(CHECKOUT_PARAM) === DONE) return "checkout";
    if (q.get(PORTAL_PARAM) === DONE) return "portal";
  } catch {
    // A path the URL parser refuses carries no return.
  }
  return null;
}

/** `path` without either flag, keeping its other query and its hash. */
export function withoutReturn(path: string): string {
  try {
    const url = new URL(path, BASE);
    url.searchParams.delete(CHECKOUT_PARAM);
    url.searchParams.delete(PORTAL_PARAM);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}

/** Where the portal's back link should land: this page, flagged. */
export function withPortalReturn(path: string): string {
  try {
    const url = new URL(path, BASE);
    if (url.origin !== BASE) return `/you?${PORTAL_PARAM}=${DONE}`;
    url.searchParams.delete(CHECKOUT_PARAM);
    url.searchParams.set(PORTAL_PARAM, DONE);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/you?${PORTAL_PARAM}=${DONE}`;
  }
}

/**
 * The plan slot on You during a checkout return:
 * - `switching`: sync is out; the card's skeleton says so.
 * - `on`: the celebration takes the card's place for this visit.
 * - `slow`: the payment went through but the plan has not shown yet.
 * - null: nothing to add; the card draws the plan as it is.
 */
export type Arrival = "switching" | "on" | "slow" | null;

/**
 * What a checkout return draws once sync has answered (`plan` null when
 * it failed or found no plan yet), and whether to re-read the row once
 * more. The celebration is only for a plan live in its first month: a
 * later month on `?checkout=done` is an old link, not a purchase. A
 * first payment still pending draws the card's own "Payment pending"
 * (saying the payment went through would contradict it) and is re-read
 * once, like a sync that failed. `final` is that one re-read: nothing
 * is scheduled after it.
 */
export function checkoutOutcome(
  plan: { live: boolean; month: number; kind: string } | null,
  final = false
): { arrival: Exclude<Arrival, "switching">; reread: boolean } {
  if (plan?.live && plan.month === 1) return { arrival: "on", reread: false };
  if (plan?.live) return { arrival: null, reread: false };
  if (plan?.kind === "incomplete") return { arrival: null, reread: !final };
  return { arrival: "slow", reread: !final };
}
