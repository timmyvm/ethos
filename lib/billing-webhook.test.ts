import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { fakeDb, fakeStripe, type FakeDb, type FakeStripe } from "./billing-fakes";

/**
 * The real webhook route, driven with payloads signed the way Stripe
 * signs them (the SDK's own test header), against the in-memory Stripe
 * and Supabase of lib/billing-fakes.ts. lib/stripe and lib/db are
 * swapped for the fakes; lib/billing runs for real. No network.
 */

const SECRET = "whsec_test_ethos_ladder_0123456789";
const USER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";

const h = vi.hoisted(() => ({
  stripe: null as unknown,
  db: null as unknown,
  secret: null as string | null,
  live: false,
}));

vi.mock("@/lib/stripe", () => ({
  stripeClient: () => h.stripe,
  webhookSecret: () => h.secret,
  billingConfigured: () => Boolean(h.stripe && h.secret),
  stripeLivemode: () => h.live,
}));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  supabaseAdmin: () => h.db,
}));

import { POST } from "@/app/api/billing/webhook/route";

let stripe: FakeStripe;
let db: FakeDb;
let seq = 0;

beforeEach(() => {
  stripe = fakeStripe();
  db = fakeDb([USER]);
  h.stripe = stripe.asStripe();
  h.db = db.asClient();
  h.secret = SECRET;
  h.live = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A customer with a billing row and a plan whose first month is paid, before any sync. */
function payingCustomer(): { customer: string; sub: string } {
  const customer = stripe.sim.customer(USER, "tim@example.com");
  db.put("billing", { user_id: USER, stripe_customer_id: customer });
  const sub = stripe.sim.startPlan(customer);
  return { customer, sub };
}

function eventBody(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({
    id: `evt_test_${++seq}`,
    object: "event",
    api_version: Stripe.API_VERSION,
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  });
}

function sign(payload: string, secret = SECRET): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

function deliver(payload: string, signature: string | null): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== null) headers["stripe-signature"] = signature;
  const req = new Request("https://speakethos.com/api/billing/webhook", {
    method: "POST",
    headers,
    body: payload,
  });
  return POST(req as unknown as NextRequest);
}

function stripeWrites() {
  return stripe.sim.writes();
}

describe("the webhook's signature", () => {
  it("syncs on a correctly signed event: the month, the next rung, Premium", async () => {
    const { customer, sub } = payingCustomer();
    const body = eventBody("invoice.paid", { id: "in_x", object: "invoice", customer });

    const res = await deliver(body, sign(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(db.row("billing", USER)).toMatchObject({
      stripe_subscription_id: sub,
      status: "active",
      ladder_month: 1,
      price_cents: 1299,
      next_price_cents: 1199,
    });
    expect(stripe.sim.itemPrice(sub)).toBe("price_m2");
    expect(db.row("profiles", USER)).toMatchObject({ premium: true, premium_source: "stripe" });
  });

  it("refuses a payload signed with another secret, and touches nothing", async () => {
    const { customer } = payingCustomer();
    const body = eventBody("invoice.paid", { object: "invoice", customer });

    const res = await deliver(body, sign(body, "whsec_someone_else"));
    expect(res.status).toBe(400);
    expect(stripe.state.calls).toEqual([]);
    expect(db.state.log).toEqual([]);
  });

  it("refuses a body changed after it was signed", async () => {
    const { customer } = payingCustomer();
    const body = eventBody("invoice.paid", { object: "invoice", customer });
    const signature = sign(body);
    const forged = body.replace(customer, "cus_someone_else");

    expect((await deliver(forged, signature)).status).toBe(400);
    expect(stripe.state.calls).toEqual([]);
  });

  it("refuses a missing signature, and an old one replayed", async () => {
    const { customer } = payingCustomer();
    const body = eventBody("invoice.paid", { object: "invoice", customer });
    expect((await deliver(body, null)).status).toBe(400);
    expect((await deliver(body, "t=1,v1=deadbeef")).status).toBe(400);

    const stale = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect((await deliver(body, stale)).status).toBe(400);
    expect(stripe.state.calls).toEqual([]);
    expect(db.state.log).toEqual([]);
  });

  it("answers 503 while billing is not switched on", async () => {
    h.secret = null;
    const body = eventBody("invoice.paid", { object: "invoice", customer: "cus_1" });
    expect((await deliver(body, sign(body))).status).toBe(503);
  });
});

describe("what the webhook does with a verified event", () => {
  it("reads Stripe's truth, never the event's snapshot", async () => {
    const { customer, sub } = payingCustomer();
    // A stale event: it says the plan ended, Stripe says it is running.
    const body = eventBody("customer.subscription.deleted", {
      id: sub,
      object: "subscription",
      customer,
      status: "canceled",
    });

    expect((await deliver(body, sign(body))).status).toBe(200);
    expect(db.row("billing", USER)).toMatchObject({ status: "active", ladder_month: 1 });
    expect(db.row("profiles", USER)).toMatchObject({ premium: true });
  });

  it("lands on the same state however often an event comes, and steps once", async () => {
    const { customer } = payingCustomer();
    for (const type of [
      "checkout.session.completed",
      "customer.subscription.created",
      "invoice.paid",
      "invoice.paid",
      "invoice.upcoming",
    ]) {
      const body = eventBody(type, { object: type.split(".")[0], customer });
      expect((await deliver(body, sign(body))).status).toBe(200);
    }
    expect(stripe.sim.callsTo("subscriptions.update")).toHaveLength(1);
    expect(db.state.tables.billing).toHaveLength(1);
    expect(db.row("billing", USER)).toMatchObject({ ladder_month: 1, next_price_cents: 1199 });
  });

  it("acts when the plan ends: Premium off, the next plan back at month 1", async () => {
    const { customer, sub } = payingCustomer();
    const paid = eventBody("invoice.paid", { object: "invoice", customer });
    await deliver(paid, sign(paid));
    stripe.sim.renew(sub);
    await deliver(paid, sign(paid));
    stripe.sim.renew(sub, { paid: false });
    stripe.sim.retriesRunOut(sub);

    const ended = eventBody("customer.subscription.deleted", { id: sub, object: "subscription", customer });
    expect((await deliver(ended, sign(ended))).status).toBe(200);
    expect(db.row("billing", USER)).toMatchObject({ status: "canceled", ladder_month: 2 });
    expect(db.row("profiles", USER)).toMatchObject({ premium: false, premium_source: null });
    // The declined renewal Stripe left open can no longer be paid.
    expect(stripe.state.invoices.at(-1)).toMatchObject({ billing_reason: "subscription_cycle", status: "void" });

    const again = stripe.sim.startPlan(customer);
    const started = eventBody("checkout.session.completed", { object: "checkout.session", customer });
    await deliver(started, sign(started));
    expect(db.row("billing", USER)).toMatchObject({
      stripe_subscription_id: again,
      ladder_month: 1,
      price_cents: 1299,
    });
  });

  it("answers 200 to an event it does not act on, and asks Stripe nothing", async () => {
    const body = eventBody("charge.succeeded", { object: "charge", customer: "cus_1" });
    const res = await deliver(body, sign(body));
    expect(res.status).toBe(200);
    expect(stripe.state.calls).toEqual([]);
    expect(db.state.log).toEqual([]);
  });

  it("answers 200 to a customer it does not know, and writes nothing", async () => {
    const stranger = stripe.sim.customer(null);
    const body = eventBody("invoice.paid", { object: "invoice", customer: stranger });
    expect((await deliver(body, sign(body))).status).toBe(200);
    expect(db.state.tables.billing).toEqual([]);
    expect(db.state.tables.profiles).toEqual([]);
  });

  it("answers 200 to a customer whose user id is not an Ethos id", async () => {
    const foreign = stripe.sim.customer("someone@example.com");
    stripe.sim.startPlan(foreign);
    const body = eventBody("invoice.paid", { object: "invoice", customer: foreign });
    expect((await deliver(body, sign(body))).status).toBe(200);
    expect(db.state.tables.billing).toEqual([]);
  });

  it("answers 200 to an event that names no customer", async () => {
    const body = eventBody("invoice.paid", { object: "invoice", customer: null });
    expect((await deliver(body, sign(body))).status).toBe(200);
    expect(stripe.state.calls).toEqual([]);
  });

  it("answers 500 when the sync fails, so Stripe sends it again", async () => {
    const { customer } = payingCustomer();
    db.state.fail.push({ table: "billing", op: "upsert", error: { code: "08006", message: "down" } });
    const body = eventBody("invoice.paid", { object: "invoice", customer });

    expect((await deliver(body, sign(body))).status).toBe(500);
    // The retry lands once the database is back.
    expect((await deliver(body, sign(body))).status).toBe(200);
    expect(db.row("billing", USER)).toMatchObject({ ladder_month: 1 });
  });

  it("answers 500 on a wrong price after writing Premium, and never charges it", async () => {
    const { customer, sub } = payingCustomer();
    stripe.state.priceBook[1].unit_amount = 1099; // month 2 at month 3's price
    const body = eventBody("invoice.paid", { object: "invoice", customer });

    expect((await deliver(body, sign(body))).status).toBe(500);
    expect(stripe.sim.callsTo("subscriptions.update")).toEqual([]);
    expect(stripe.sim.itemPrice(sub)).toBe("price_m1");
    expect(db.row("profiles", USER)).toMatchObject({ premium: true });
    expect(stripeWrites()).toEqual([]);
  });
});
