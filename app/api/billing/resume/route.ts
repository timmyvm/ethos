/**
 * POST /api/billing/resume: undo a cancel that has not taken effect yet
 * (DECISIONS #377). The plan never ended, so it keeps its month on the
 * ladder and its next price. A plan already set to renew answers the
 * same 200 with nothing changed.
 *
 * Answers 200 { billing, premium }, 401, 404 no plan, 409 the plan
 * already ended (a new one starts at month 1 through checkout), 429,
 * 503 Stripe isn't configured, 502 Stripe failed.
 */

import { NextRequest, NextResponse } from "next/server";
import { billingFailure, guardBillingRoute, resumePlan } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await guardBillingRoute(req, { rate: "resume" });
  if (!gate.ok) return gate.res;

  try {
    return NextResponse.json(await resumePlan(gate.deps, gate.auth.id));
  } catch (e) {
    return billingFailure(e, "Your plan didn't change. Try again in a minute.");
  }
}
