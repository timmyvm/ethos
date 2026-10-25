/**
 * POST /api/billing/sync: read this account's plan from Stripe now
 * (DECISIONS #377), for the moment the webhook may not have landed yet:
 * back from Checkout, or back from the portal.
 *
 * Answers 200 { billing, premium } (billing is null for an account that
 * never started a plan), 401, 429, 503 Stripe isn't configured, 502.
 * Everyday reads go through fetchBilling() in the browser instead; this
 * route asks Stripe, so it is rate limited.
 */

import { NextRequest, NextResponse } from "next/server";
import { billingFailure, guardBillingRoute, syncUser } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await guardBillingRoute(req, { rate: "sync" });
  if (!gate.ok) return gate.res;

  try {
    return NextResponse.json(await syncUser(gate.deps, gate.auth.id));
  } catch (e) {
    return billingFailure(e, "Your plan didn't load. Try again in a minute.");
  }
}
