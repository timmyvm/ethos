/**
 * POST /api/billing/portal: Stripe's customer portal for this account's
 * plan (DECISIONS #377): the card, the invoices, and cancelling.
 *
 * Body `{ returnTo? }`, a same-origin path the portal's back link
 * returns to (anything else is /you). Answers 200 { url }, 401 no
 * session, 404 no plan, 503 Stripe isn't configured, 502 Stripe failed.
 *
 * STRIPE_PORTAL_CONFIGURATION picks the configuration
 * scripts/stripe-setup.mjs made (cancel at period end, no plan
 * switching); unset, the account's default applies.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  billingFailure,
  guardBillingRoute,
  openPortal,
  safeReturnPath,
  siteFrom,
} from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await guardBillingRoute(req, {});
  if (!gate.ok) return gate.res;

  const body = (await req.json().catch(() => null)) as { returnTo?: unknown } | null;

  try {
    const url = await openPortal(gate.deps, {
      userId: gate.auth.id,
      site: siteFrom(req),
      returnTo: safeReturnPath(body?.returnTo),
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION?.trim() || null,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return billingFailure(e, "Your plan's page didn't open. Try again in a minute.");
  }
}
