/**
 * POST /api/billing/checkout: start a Premium plan (DECISIONS #377).
 *
 * Body `{ returnTo? }`, a same-origin path Checkout's back arrow returns
 * to (anything else is /you). Answers:
 *
 *   200 { url }          Stripe Checkout for a NEW plan on month 1's price
 *   200 { manage: true } the account already has a live plan, or one whose
 *                        first payment is still pending; open the portal
 *                        (/api/billing/portal), never a second plan
 *   401                  no session
 *   503                  Stripe isn't configured on this server
 *   403 { needsAccount } an anonymous-first session: a paid plan needs an
 *                        account it can follow to another device
 *   429                  too many tries
 *   502                  Stripe or the price list failed; nothing charged
 *
 * The ladder's prices are verified before the session is made
 * (lib/billing.ts), and Checkout's pay button carries the whole ladder,
 * the renewal and the reset rule. Any older Checkout still open for the
 * account is closed first, so two tabs can never become two plans.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  billingFailure,
  createCheckout,
  guardBillingRoute,
  hasPlanToManage,
  safeReturnPath,
  siteFrom,
  syncUser,
} from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await guardBillingRoute(req, {
    rate: "checkout",
    needsAccount: true,
    offMessage: "Checkout isn't switched on for this server.",
  });
  if (!gate.ok) return gate.res;

  const body = (await req.json().catch(() => null)) as { returnTo?: unknown } | null;

  try {
    // An account with a row may already be paying: Stripe's word first.
    const { billing } = await syncUser(gate.deps, gate.auth.id);
    if (hasPlanToManage(billing?.status)) return NextResponse.json({ manage: true });

    const out = await createCheckout(gate.deps, {
      userId: gate.auth.id,
      email: gate.auth.email ?? null,
      site: siteFrom(req),
      returnTo: safeReturnPath(body?.returnTo),
    });
    return NextResponse.json(out);
  } catch (e) {
    return billingFailure(
      e,
      "Checkout didn't open, and nothing was charged. Try again in a minute."
    );
  }
}
