/**
 * POST /api/billing/cancel: cancel this account's plan at the end of
 * the month it paid for (DECISIONS #377). Premium runs until then, and
 * the plan keeps its place on the ladder until the cancel takes effect,
 * so undoing it (/api/billing/resume) loses nothing.
 *
 * One tap and a confirm in the app, as easy as starting (Australian
 * Consumer Law). Answers 200 { billing, premium }, 401, 404 no plan,
 * 409 already ending or already ended, 429, 503 Stripe isn't
 * configured, 502 Stripe failed (the plan is unchanged).
 */

import { NextRequest, NextResponse } from "next/server";
import { billingFailure, cancelPlan, guardBillingRoute } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await guardBillingRoute(req, { rate: "cancel" });
  if (!gate.ok) return gate.res;

  try {
    return NextResponse.json(await cancelPlan(gate.deps, gate.auth.id));
  } catch (e) {
    return billingFailure(e, "Your plan didn't cancel. Try again in a minute.");
  }
}
