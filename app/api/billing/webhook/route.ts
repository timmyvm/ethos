/**
 * POST /api/billing/webhook: Stripe, and only Stripe (DECISIONS #377).
 *
 * The raw body is checked against STRIPE_WEBHOOK_SECRET before anything
 * is read; a missing or wrong signature is a 400 and touches nothing.
 * Every handled event does one thing: hand its customer to
 * syncCustomer, which reads Stripe's current truth rather than the
 * event's snapshot, so duplicates and out-of-order deliveries all land
 * on the same state. A failed sync answers 500 so Stripe retries it;
 * events this server does not act on answer 200.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { HANDLED_EVENTS, customerIdOf, syncCustomer } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/db";
import { stripeClient, webhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = stripeClient();
  const secret = webhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Billing isn't switched on for this server." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  if (!HANDLED_EVENTS.includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  const customerId = customerIdOf(event.data.object);
  if (!customerId) {
    console.error(`billing webhook: ${event.type} ${event.id} names no customer`);
    return NextResponse.json({ received: true });
  }

  const db = supabaseAdmin();
  if (!db) {
    // Stripe retries a 5xx, and the database may be back by then.
    return NextResponse.json({ error: "Accounts aren't configured." }, { status: 500 });
  }

  try {
    await syncCustomer({ stripe, db }, customerId);
  } catch (e) {
    console.error(
      `billing webhook: sync failed for ${event.type} ${event.id} (${customerId})`,
      e instanceof Error ? `${e.name}: ${e.message}` : e
    );
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
