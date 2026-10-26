import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, fakeStripe, type FakeDb, type FakeStripe } from "./billing-fakes";

/**
 * The billing routes and account deletion, as the app calls them:
 * statuses and bodies per the contract in lib/billing.ts, against the
 * in-memory Stripe and Supabase of lib/billing-fakes.ts. The session,
 * the clients and the rate limiter are swapped; everything else is real.
 */

const USER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const ANON = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";

const h = vi.hoisted(() => ({
  stripe: null as unknown,
  db: null as unknown,
  secret: null as string | null,
  live: false,
  /** Bearer token -> the user it resolves to. */
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: new Set<string>(),
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
  getUserFromAuthHeader: vi.fn(async (header: string | null) =>
    header?.startsWith("Bearer ") ? (h.sessions.get(header.slice(7)) ?? null) : null
  ),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async (subject: string) =>
    h.limited.has(subject)
      ? { allowed: false, window: "hour", retryAfterS: 1200 }
      : { allowed: true, window: null, retryAfterS: 0 }
  ),
}));

import { DELETE as deleteAccount } from "@/app/api/account/route";
import { POST as cancel } from "@/app/api/billing/cancel/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";
import { POST as resume } from "@/app/api/billing/resume/route";
import { POST as sync } from "@/app/api/billing/sync/route";
import { POST as redeem } from "@/app/api/redeem/route";
import { syncCustomer } from "./billing";
import { consumeRateLimit } from "./rate-limit";

let stripe: FakeStripe;
let db: FakeDb;

beforeEach(() => {
  stripe = fakeStripe();
  db = fakeDb([USER, ANON]);
  h.stripe = stripe.asStripe();
  h.db = db.asClient();
  h.secret = "whsec_test";
  h.live = false;
  h.sessions.clear();
  h.sessions.set("tok_user", { id: USER, anonymous: false, email: "tim@example.com" });
  h.sessions.set("tok_anon", { id: ANON, anonymous: true, email: null });
  h.limited.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("STRIPE_PORTAL_CONFIGURATION", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

type Handler = (req: NextRequest) => Promise<Response>;

async function call(
  handler: Handler,
  opts: {
    token?: string | null;
    body?: unknown;
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...opts.headers,
  };
  const token = opts.token === undefined ? "tok_user" : opts.token;
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request("https://preview.speakethos.test/api/x", {
    method: opts.method ?? "POST",
    headers,
    body: opts.method === "DELETE" ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const res = await handler(req as unknown as NextRequest);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** The account one month into a plan, as the webhook leaves it. */
async function paying(): Promise<{ customer: string; sub: string }> {
  const customer = stripe.sim.customer(USER, "tim@example.com");
  db.put("billing", { user_id: USER, stripe_customer_id: customer });
  const sub = stripe.sim.startPlan(customer);
  await syncCustomer({ stripe: stripe.asStripe(), db: db.asClient() }, customer);
  return { customer, sub };
}

describe("POST /api/billing/checkout", () => {
  it("opens Checkout for a new plan on month 1, back to a same-origin path", async () => {
    const res = await call(checkout, { body: { returnTo: "/games" } });
    expect(res).toEqual({
      status: 200,
      body: { url: expect.stringMatching(/^https:\/\/checkout\.stripe\.test\//) },
    });
    const params = stripe.sim.callsTo("checkout.sessions.create")[0].args[0] as Record<string, unknown>;
    expect(params).toMatchObject({
      line_items: [{ price: "price_m1", quantity: 1 }],
      success_url: "https://preview.speakethos.test/you?checkout=done",
      cancel_url: "https://preview.speakethos.test/games",
    });
    expect(consumeRateLimit).toHaveBeenCalledWith(`checkout:u:${USER}`, "user");
    expect(stripe.sim.callsTo("customers.create")[0].args[0]).toMatchObject({
      email: "tim@example.com",
    });
  });

  it("uses NEXT_PUBLIC_SITE_URL, and sends any other host back to /you", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://speakethos.com/");
    await call(checkout, { body: { returnTo: "https://evil.example/you" } });
    expect(stripe.sim.callsTo("checkout.sessions.create")[0].args[0]).toMatchObject({
      success_url: "https://speakethos.com/you?checkout=done",
      cancel_url: "https://speakethos.com/you",
    });
  });

  it("answers { manage: true } for an account already on a live plan, and opens no second one", async () => {
    await paying();
    expect(await call(checkout)).toEqual({ status: 200, body: { manage: true } });
    expect(stripe.sim.callsTo("checkout.sessions.create")).toEqual([]);
  });

  it("answers { manage: true } while the first payment is still pending, and opens no second plan", async () => {
    const customer = stripe.sim.customer(USER, "tim@example.com");
    db.put("billing", { user_id: USER, stripe_customer_id: customer });
    stripe.sim.startPlan(customer, { firstPaid: false });

    expect(await call(checkout)).toEqual({ status: 200, body: { manage: true } });
    expect(stripe.sim.callsTo("checkout.sessions.create")).toEqual([]);
  });

  it("a second tap ends the first Checkout, so it can never be paid as a second plan", async () => {
    const one = await call(checkout);
    const two = await call(checkout);
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    expect(stripe.state.sessions.map((cs) => cs.status)).toEqual(["expired", "open"]);
    expect(() => stripe.sim.completeSession(stripe.state.sessions[0].id)).toThrow();
  });

  it("answers { manage: true } while a declined card is being retried", async () => {
    const { sub } = await paying();
    stripe.sim.renew(sub, { paid: false });
    expect(await call(checkout)).toEqual({ status: 200, body: { manage: true } });
  });

  it("opens a new plan once the last one ended", async () => {
    const { sub } = await paying();
    stripe.sim.retriesRunOut(sub);
    const res = await call(checkout);
    expect(res.status).toBe(200);
    expect(res.body.url).toBeTruthy();
  });

  it("answers 401, 403 needsAccount, 429 and 503 in their places", async () => {
    expect((await call(checkout, { token: null })).status).toBe(401);
    expect((await call(checkout, { token: "tok_expired" })).status).toBe(401);

    expect(await call(checkout, { token: "tok_anon" })).toEqual({
      status: 403,
      body: { error: expect.any(String), needsAccount: true },
    });

    h.limited.add(`checkout:u:${USER}`);
    const limited = await call(checkout);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("Too many tries. Give it an hour.");
    h.limited.clear();

    h.secret = null;
    expect(await call(checkout)).toEqual({
      status: 503,
      body: { error: "Checkout isn't switched on for this server." },
    });
    expect(stripe.state.calls).toEqual([]);
  });

  it("answers 502 and makes nothing when the prices are wrong", async () => {
    stripe.state.priceBook[0].unit_amount = 999;
    const res = await call(checkout);
    expect(res.status).toBe(502);
    expect(String(res.body.error)).not.toMatch(/—/);
    expect(stripe.sim.writes()).toEqual([]);
    expect(db.row("billing", USER)).toBeUndefined();
  });
});

describe("a test-mode plan left in the database after the switch to live keys", () => {
  it("never locks checkout, the portal or deleting the account", async () => {
    const { customer } = await paying();
    h.live = true;
    stripe.sim.otherMode(customer);

    expect((await call(portal)).status).toBe(404);
    const opened = await call(checkout);
    expect(opened.status).toBe(200);
    expect(opened.body.url).toBeTruthy();
    expect(db.row("billing", USER)!.stripe_customer_id).not.toBe(customer);

    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([USER]);
  });

  it("deletes nothing when the only key is test and the row is live", async () => {
    const { customer } = await paying();
    stripe.sim.otherMode(customer);
    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(502);
    expect(db.state.deletedUsers).toEqual([]);
  });
});

describe("POST /api/billing/portal", () => {
  it("is rate limited before it asks Stripe anything", async () => {
    await paying();
    const before = stripe.state.calls.length;
    h.limited.add(`portal:u:${USER}`);
    const res = await call(portal);
    expect(res.status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledWith(`portal:u:${USER}`, "user");
    expect(stripe.state.calls.length).toBe(before);
  });

  it("answers 404 without a plan, and the portal's url with one", async () => {
    expect((await call(portal)).status).toBe(404);

    await paying();
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION", "bpc_ladder");
    const res = await call(portal, { body: { returnTo: "/settings" } });
    expect(res).toEqual({ status: 200, body: { url: expect.stringMatching(/^https:\/\/billing/) } });
    expect(stripe.sim.callsTo("billingPortal.sessions.create")[0].args[0]).toMatchObject({
      return_url: "https://preview.speakethos.test/settings",
      configuration: "bpc_ladder",
    });
  });
});

describe("POST /api/billing/sync", () => {
  it("answers the plan and premium, and null for an account that never started one", async () => {
    expect(await call(sync)).toEqual({ status: 200, body: { billing: null, premium: false } });

    await paying();
    const res = await call(sync);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      billing: expect.objectContaining({ status: "active", ladder_month: 1, next_price_cents: 1199 }),
      premium: true,
    });
    // The browser's copy never carries Stripe ids.
    expect(JSON.stringify(res.body)).not.toMatch(/cus_|sub_|si_/);
    expect(consumeRateLimit).toHaveBeenCalledWith(`sync:u:${USER}`, "user");
  });
});

describe("POST /api/billing/cancel and /resume", () => {
  it("cancels at the end of the paid month, refuses twice, and resume keeps the place", async () => {
    await paying();
    const cancelled = await call(cancel);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toEqual({
      billing: expect.objectContaining({ cancel_at_period_end: true, next_price_cents: null }),
      premium: true,
    });
    expect((await call(cancel)).status).toBe(409);

    const resumed = await call(resume);
    expect(resumed.status).toBe(200);
    expect(resumed.body.billing).toMatchObject({
      ladder_month: 1,
      cancel_at_period_end: false,
      next_price_cents: 1199,
    });
  });

  it("ends a declined plan now: the ended row, Premium off, and the renewal it was retrying voided", async () => {
    const { sub } = await paying();
    stripe.sim.renew(sub, { paid: false });
    await syncCustomer({ stripe: stripe.asStripe(), db: db.asClient() }, db.row("billing", USER)!.stripe_customer_id as string);

    const res = await call(cancel);
    expect(res).toEqual({
      status: 200,
      body: {
        billing: expect.objectContaining({ status: "canceled", cancel_at_period_end: false, next_price_cents: null }),
        premium: false,
      },
    });
    expect(stripe.sim.sub(sub).status).toBe("canceled");
    expect(stripe.state.invoices.at(-1)!.status).toBe("void");
    // Ended, so a second tap is the ended plan's 409.
    expect(await call(cancel)).toEqual({
      status: 409,
      body: { error: "This plan has ended. A new one starts at month 1." },
    });
  });

  it("answers 200, never 'didn't cancel', when the cancel went through and only the copy failed", async () => {
    const { sub } = await paying();
    const update = stripe.api.subscriptions.update;
    stripe.api.subscriptions.update = async (...args: Parameters<typeof update>) => {
      const out = await update(...args);
      db.state.fail.push({ table: "billing", op: "upsert", error: { code: "08006", message: "down" } });
      return out;
    };
    const res = await call(cancel);
    expect(res.status).toBe(200);
    expect(res.body.billing).toMatchObject({ cancel_at_period_end: true });
    expect(stripe.sim.sub(sub).cancel_at_period_end).toBe(true);
  });

  it("answers 404 with no plan and 409 once the plan has ended", async () => {
    expect((await call(cancel)).status).toBe(404);
    expect((await call(resume)).status).toBe(404);

    const { sub } = await paying();
    await call(cancel);
    stripe.sim.renew(sub); // the cancel takes effect
    const res = await call(resume);
    expect(res).toEqual({
      status: 409,
      body: { error: "This plan has ended. A new one starts at month 1." },
    });
    expect((await call(cancel)).status).toBe(409);
  });

  it("answers 401, 429 and 503 before touching Stripe", async () => {
    // A plan exists, so a guard that asked Stripe first would show up here.
    await paying();
    const before = stripe.state.calls.length;
    expect((await call(cancel, { token: null })).status).toBe(401);
    h.limited.add(`resume:u:${USER}`);
    expect((await call(resume)).status).toBe(429);
    expect(stripe.state.calls.length).toBe(before);
    h.limited.clear();
    // Billing off while the client is still reachable, so a stray call would be recorded.
    h.secret = null;
    expect((await call(cancel)).status).toBe(503);
    expect(stripe.state.calls.slice(before)).toEqual([]);
  });
});

describe("DELETE /api/account", () => {
  function withAudio() {
    db.put("reps", { user_id: USER, audio_path: "reps/1-a.webm" });
  }

  it("cancels every plan that has not ended, then deletes the account", async () => {
    const { customer, sub } = await paying();
    const second = stripe.sim.startPlan(customer);
    withAudio();

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(stripe.sim.callsTo("subscriptions.cancel").map((c) => c.args[0]).sort()).toEqual(
      [sub, second].sort()
    );
    expect(db.state.deletedUsers).toEqual([USER]);
    expect(db.state.removedAudio).toEqual(["reps/1-a.webm"]);
    expect(db.state.tables.billing).toEqual([]);
  });

  it("closes an open Checkout, so paying it later starts no plan on a deleted account", async () => {
    expect((await call(checkout)).status).toBe(200);
    const [session] = stripe.state.sessions;

    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(session.status).toBe("expired");
    expect(() => stripe.sim.completeSession(session.id)).toThrow(/expired/);
    expect(db.state.deletedUsers).toEqual([USER]);
    // A customer made for a Checkout nobody paid goes too.
    expect(stripe.sim.callsTo("customers.del")).toHaveLength(1);
  });

  it("deletes the Stripe customer, its email and saved card, once the plans are cancelled and the invoices voided", async () => {
    const { customer, sub } = await paying();
    stripe.sim.renew(sub, { paid: false });
    withAudio();

    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(stripe.sim.callsTo("customers.del").map((c) => c.args[0])).toEqual([customer]);
    expect(stripe.state.customers.get(customer)!.deleted).toBe(true);
    // In order: nothing on the customer can be charged or paid before it goes,
    // and it goes before anything of ours does.
    const order = stripe.state.calls.map((c) => c.method);
    const at = (m: string) => order.indexOf(m);
    expect(at("subscriptions.cancel")).toBeLessThan(at("invoices.voidInvoice"));
    expect(at("invoices.voidInvoice")).toBeLessThan(at("customers.del"));
    expect(stripe.state.invoices.at(-1)!.status).toBe("void");
    expect(db.state.removedAudio).toEqual(["reps/1-a.webm"]);
    expect(db.state.deletedUsers).toEqual([USER]);
  });

  it("deletes nothing else when the customer didn't delete, says the plan is cancelled, and the retry finishes", async () => {
    const { customer } = await paying();
    withAudio();
    stripe.state.fail["customers.del"] = new Error("Stripe is down");

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: {
        error:
          "Your plan is cancelled, but your details at Stripe didn't delete, so nothing else was deleted. Try again in a minute.",
      },
    });
    expect(db.state.deletedUsers).toEqual([]);
    expect(db.state.removedAudio).toEqual([]);
    expect(db.row("billing", USER)).toBeDefined();

    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(stripe.state.customers.get(customer)!.deleted).toBe(true);
    expect(db.state.deletedUsers).toEqual([USER]);
  });

  it("says nothing was deleted when only the customer failed, with no plan to cancel", async () => {
    expect((await call(checkout)).status).toBe(200);
    stripe.state.fail["customers.del"] = new Error("Stripe is down");
    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: { error: "Your details at Stripe didn't delete, so nothing was deleted. Try again in a minute." },
    });
    expect(db.state.deletedUsers).toEqual([]);
  });

  it("finishes when the customer is already gone, as after a retry whose delete went through", async () => {
    const { customer } = await paying();
    db.state.fail.push({ table: "auth.users", op: "delete", error: { code: "500", message: "down" } });
    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(502);
    expect(stripe.state.customers.get(customer)!.deleted).toBe(true);

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({ status: 200, body: { ok: true } });
    expect(db.state.deletedUsers).toEqual([USER]);
  });

  it("lists the recordings before it cancels anything, so a failed read really leaves all of it", async () => {
    const { sub } = await paying();
    withAudio();
    db.state.fail.push({ table: "reps", op: "select", error: { code: "08006", message: "down" } });

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: { error: "Couldn't list your recordings. Nothing was deleted." },
    });
    expect(stripe.sim.sub(sub).status).toBe("active");
    expect(stripe.sim.callsTo("subscriptions.cancel")).toEqual([]);
  });

  it("says the plan is cancelled when a later step fails after the cancel", async () => {
    const { sub } = await paying();
    withAudio();
    db.state.fail.push({ table: "storage:audio", op: "remove", error: { code: "500", message: "down" } });

    const audio = await call(deleteAccount, { method: "DELETE" });
    expect(audio.status).toBe(502);
    expect(audio.body.error).toBe(
      "Your plan is cancelled, but your audio didn't delete. Nothing else was touched; try again."
    );
    expect(stripe.sim.sub(sub).status).toBe("canceled");
    expect(String(audio.body.error)).not.toMatch(/—/);

    // The retry: nothing left to cancel, so the account's own words are back.
    db.state.fail.push({ table: "auth.users", op: "delete", error: { code: "500", message: "down" } });
    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: { error: "The account didn't delete. Try again in a minute." },
    });
  });

  it("says the plan is cancelled when the account itself fails to delete after the cancel", async () => {
    await paying();
    db.state.fail.push({ table: "auth.users", op: "delete", error: { code: "500", message: "down" } });
    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: { error: "Your plan is cancelled, but the account didn't delete. Try again in a minute." },
    });
  });

  it("deletes nothing without a key while a Checkout may have started a plan nobody synced", async () => {
    expect((await call(checkout)).status).toBe(200); // a row, status still null
    h.stripe = null;
    const res = await call(deleteAccount, { method: "DELETE" });
    expect(res.status).toBe(502);
    expect(db.state.deletedUsers).toEqual([]);
  });

  it("voids a cancelled past-due plan's unpaid renewal before the account goes", async () => {
    const { sub } = await paying();
    stripe.sim.renew(sub, { paid: false });

    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(stripe.sim.sub(sub).status).toBe("canceled");
    expect(stripe.state.invoices.at(-1)!.status).toBe("void");
  });

  it("deletes nothing when the unpaid renewal didn't void, and says the plan is cancelled", async () => {
    const { sub } = await paying();
    stripe.sim.renew(sub, { paid: false });
    stripe.state.fail["invoices.voidInvoice"] = new Error("Stripe is down");

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: {
        error:
          "Your plan is cancelled, but its unpaid invoice didn't close, so nothing else was deleted. Try again in a minute.",
      },
    });
    expect(db.state.deletedUsers).toEqual([]);
    // The retry finishes it.
    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(stripe.state.invoices.at(-1)!.status).toBe("void");
  });

  it("deletes nothing when a cancel fails", async () => {
    await paying();
    withAudio();
    stripe.state.fail["subscriptions.cancel"] = new Error("Stripe is down");

    expect(await call(deleteAccount, { method: "DELETE" })).toEqual({
      status: 502,
      body: { error: "Your plan didn't cancel, so nothing was deleted. Try again in a minute." },
    });
    expect(db.state.deletedUsers).toEqual([]);
    expect(db.state.removedAudio).toEqual([]);
    expect(db.row("billing", USER)).toBeDefined();
  });

  it("deletes nothing when a live plan has no Stripe key to cancel it", async () => {
    await paying();
    withAudio();
    h.stripe = null;

    const res = await call(deleteAccount, { method: "DELETE" });
    expect(res.status).toBe(502);
    expect(db.state.deletedUsers).toEqual([]);
    expect(db.state.removedAudio).toEqual([]);
  });

  it("goes ahead without a key when the plan already ended, or there never was one", async () => {
    const { sub } = await paying();
    stripe.sim.retriesRunOut(sub);
    await syncCustomer({ stripe: stripe.asStripe(), db: db.asClient() }, db.row("billing", USER)!.stripe_customer_id as string);
    h.stripe = null;
    expect((await call(deleteAccount, { method: "DELETE" })).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([USER]);

    expect((await call(deleteAccount, { method: "DELETE", token: "tok_anon" })).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([USER, ANON]);
  });
});

describe("POST /api/redeem", () => {
  it("limits guesses by address too, so fresh anonymous ids buy no more tries", async () => {
    vi.stubEnv("PREMIUM_UNLOCK_CODE", "ETHOS-INVITE");
    const from = { "x-forwarded-for": "203.0.113.9, 10.0.0.1" };
    h.limited.add("redeem:ip:203.0.113.9");

    // A brand-new anonymous session, its own limit untouched.
    const res = await call(redeem, { token: "tok_anon", body: { code: "ETHOS-INVITE" }, headers: from });
    expect(res.status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledWith("redeem:ip:203.0.113.9", "user");
    expect(db.row("profiles", ANON)).toBeUndefined();

    // Another address, the same code: the per-account limit still applies.
    h.limited.clear();
    const ok = await call(redeem, {
      token: "tok_anon",
      body: { code: "ETHOS-INVITE" },
      headers: { "x-forwarded-for": "198.51.100.7" },
    });
    expect(ok.status).toBe(200);
    expect(consumeRateLimit).toHaveBeenCalledWith(`redeem:u:${ANON}`, "anon");
  });

  it("writes a code's premium as 'code', which a plan ending never switches off", async () => {
    vi.stubEnv("PREMIUM_UNLOCK_CODE", "ETHOS-INVITE");
    const { sub, customer } = await paying();

    expect(await call(redeem, { body: { code: "ETHOS-INVITE" } })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(db.row("profiles", USER)).toMatchObject({
      premium: true,
      premium_source: "code",
      premium_until: null,
    });

    stripe.sim.retriesRunOut(sub);
    const out = await syncCustomer({ stripe: stripe.asStripe(), db: db.asClient() }, customer);
    expect(out?.premium).toBe(true);
    expect(db.row("profiles", USER)).toMatchObject({ premium: true, premium_source: "code" });
  });
});
