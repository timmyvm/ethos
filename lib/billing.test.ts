import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BillingError,
  HANDLED_EVENTS,
  cancelPlan,
  checkoutDisclosure,
  createCheckout,
  customerIdOf,
  endEveryPlan,
  ensureCustomer,
  ladderPrices,
  openPortal,
  paidMonths,
  resumePlan,
  safeReturnPath,
  syncCustomer,
  syncUser,
  voidEndedInvoices,
} from "./billing";
import { fakeDb, fakeStripe, type FakePrice } from "./billing-fakes";
import { LADDER_CENTS, formatAud, totalForMonths } from "./pricing";

/**
 * The price ladder's server against an in-memory Stripe and Supabase
 * (lib/billing-fakes.ts). The money rules are the point: a month counts
 * only when it is paid, the next renewal is always the next rung, a
 * declined card keeps its place, only a plan that ends resets it, and a
 * price that is not exactly the ladder's is never charged.
 */

const USER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const SITE = "https://speakethos.com";
const DAY_S = 86_400;

function world(users: string[] = [USER], opts: { live?: boolean } = {}) {
  const stripe = fakeStripe();
  const db = fakeDb(users);
  const deps = {
    stripe: stripe.asStripe(),
    db: db.asClient(),
    now: () => stripe.now(),
    livemode: opts.live ?? false,
  };
  return { stripe, db, deps, sim: stripe.sim };
}

type World = ReturnType<typeof world>;

/** A customer with a billing row, as checkout leaves one. */
function customerFor(w: World, userId = USER): string {
  const customer = w.sim.customer(userId, "tim@example.com");
  w.db.put("billing", { user_id: userId, stripe_customer_id: customer });
  return customer;
}

/** An account one month into a plan, synced the way invoice.paid syncs it. */
async function paying(w: World = world()) {
  const customer = customerFor(w);
  const sub = w.sim.startPlan(customer);
  await syncCustomer(w.deps, customer);
  return { ...w, customer, sub };
}

/** The next renewal, paid, then the webhook's sync. */
async function nextMonth(w: Awaited<ReturnType<typeof paying>>): Promise<number> {
  const charged = w.sim.renew(w.sub);
  await syncCustomer(w.deps, w.customer);
  return charged;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("counting months", () => {
  it("counts paid invoices for the plan's start and its renewals, nothing else", async () => {
    const w = world();
    const sub = w.sim.startPlan(customerFor(w));
    w.sim.invoice(sub, "subscription_cycle", "paid");
    w.sim.invoice(sub, "subscription_cycle", "open");
    w.sim.invoice(sub, "subscription_update", "paid");
    w.sim.invoice(sub, "subscription_threshold", "paid");
    w.sim.invoice(sub, "manual", "paid");

    expect(await paidMonths(w.deps.stripe, sub)).toBe(2);
  });

  it("pages through a long plan and never counts another plan's invoices", async () => {
    const w = world();
    const customer = customerFor(w);
    const long = w.sim.startPlan(customer);
    for (let i = 0; i < 230; i++) w.sim.invoice(long, "subscription_cycle", "paid");
    const other = w.sim.startPlan(customer);
    w.sim.invoice(other, "subscription_cycle", "paid");

    expect(await paidMonths(w.deps.stripe, long)).toBe(231);
    expect(w.sim.callsTo("invoices.list")).toHaveLength(3);
    expect(await paidMonths(w.deps.stripe, other)).toBe(2);
  });
});

describe("the ladder", () => {
  it("steps to the next rung after a paid month, and never again while it is right", async () => {
    const w = await paying();

    expect(w.sim.itemPrice(w.sub)).toBe("price_m2");
    const steps = w.sim.callsTo("subscriptions.update");
    expect(steps).toHaveLength(1);
    expect(steps[0].args[1]).toEqual({
      items: [{ id: w.sim.sub(w.sub).items.data[0].id, price: "price_m2" }],
      proration_behavior: "none",
    });
    expect(steps[0].args[2]).toEqual({ idempotencyKey: `ethos-ladder-${w.sub}-2` });

    await syncCustomer(w.deps, w.customer);
    await syncCustomer(w.deps, w.customer);
    expect(w.sim.callsTo("subscriptions.update")).toHaveLength(1);
    expect(w.db.row("billing", USER)).toMatchObject({
      stripe_subscription_id: w.sub,
      status: "active",
      ladder_month: 1,
      price_cents: 1299,
      next_price_cents: 1199,
      cancel_at_period_end: false,
    });
  });

  it("charges A$104.88 for an unbroken first year, then holds the floor", async () => {
    const w = await paying();
    for (let month = 2; month <= 14; month++) await nextMonth(w);

    const charges = w.sim.charges(w.sub);
    expect(charges).toEqual([
      1299, 1199, 1099, 999, 899, 799, 699, 699, 699, 699, 699, 699, 699, 699,
    ]);
    const firstYear = charges.slice(0, 12).reduce((a, b) => a + b, 0);
    expect(firstYear).toBe(10488);
    expect(firstYear).toBe(totalForMonths(12));
    expect(formatAud(firstYear)).toBe("A$104.88");
    // Six steps (onto months 2 to 7), then the floor never moves.
    expect(w.sim.callsTo("subscriptions.update")).toHaveLength(6);
    expect(w.db.row("billing", USER)).toMatchObject({
      ladder_month: 14,
      price_cents: 699,
      next_price_cents: 699,
    });
  });

  it("never steps a plan back down a rung, and says what the renewal will really charge", async () => {
    const w = await paying(); // month 1 paid, the item on month 2's price
    // A newer sync, or a dashboard edit, already put the item further on.
    w.sim.sub(w.sub).items.data[0].price = structuredClone(w.stripe.state.priceBook[3]);

    const out = await syncCustomer(w.deps, w.customer);
    expect(w.sim.itemPrice(w.sub)).toBe("price_m4");
    expect(w.sim.callsTo("subscriptions.update")).toHaveLength(1); // the first step only
    expect(out?.billing).toMatchObject({ ladder_month: 1, next_price_cents: 999 });
    expect(w.db.row("billing", USER)?.next_price_cents).toBe(999);
  });

  it("catches up a step whose webhook never came, before the next renewal", async () => {
    const w = await paying();
    w.sim.renew(w.sub); // month 2 paid at A$11.99, its invoice.paid lost
    await syncCustomer(w.deps, w.customer); // invoice.upcoming, days later
    expect(w.sim.itemPrice(w.sub)).toBe("price_m3");
    expect(w.sim.renew(w.sub)).toBe(1099);
  });
});

describe("a declined card", () => {
  it("keeps its place and its Premium while Stripe retries", async () => {
    const w = await paying();
    await nextMonth(w); // month 2 paid; the item now waits on month 3
    expect(w.sim.renew(w.sub, { paid: false })).toBe(0);
    const stepsBefore = w.sim.callsTo("subscriptions.update").length;

    const out = await syncCustomer(w.deps, w.customer);
    expect(out).toEqual({
      billing: expect.objectContaining({
        status: "past_due",
        ladder_month: 2,
        price_cents: 1199,
        next_price_cents: 1099,
      }),
      premium: true,
    });
    expect(w.sim.itemPrice(w.sub)).toBe("price_m3");
    expect(w.sim.callsTo("subscriptions.update")).toHaveLength(stepsBefore);
    expect(w.db.row("profiles", USER)).toMatchObject({
      premium: true,
      premium_source: "stripe",
    });

    // A retry succeeds: month 3 is paid at month 3's price, and the plan steps on.
    expect(w.sim.payOpen(w.sub)).toBe(1099);
    await syncCustomer(w.deps, w.customer);
    expect(w.db.row("billing", USER)).toMatchObject({
      status: "active",
      ladder_month: 3,
      next_price_cents: 999,
    });
    expect(w.sim.itemPrice(w.sub)).toBe("price_m4");
  });

  it("ends the plan when the retries run out, and the next plan starts at month 1", async () => {
    const w = await paying();
    for (let i = 0; i < 4; i++) await nextMonth(w);
    w.sim.renew(w.sub, { paid: false });
    await syncCustomer(w.deps, w.customer);
    w.sim.advance(14 * DAY_S); // the retry window
    w.sim.retriesRunOut(w.sub);

    const ended = await syncCustomer(w.deps, w.customer);
    expect(ended).toEqual({
      billing: expect.objectContaining({
        status: "canceled",
        ladder_month: 5,
        next_price_cents: null,
        cancel_at_period_end: false,
        // The day it ended, not the end of the month nobody paid for.
        current_period_end: w.stripe.now().toISOString(),
      }),
      premium: false,
    });
    expect(Date.parse(ended!.billing!.current_period_end!)).toBeLessThan(
      w.sim.sub(w.sub).items.data[0].current_period_end * 1000
    );
    expect(w.db.row("profiles", USER)).toMatchObject({
      premium: false,
      premium_source: null,
      premium_until: null,
    });

    const again = w.sim.startPlan(w.customer);
    const restarted = await syncCustomer(w.deps, w.customer);
    expect(restarted?.billing).toMatchObject({
      status: "active",
      ladder_month: 1,
      price_cents: 1299,
      next_price_cents: 1199,
    });
    expect(w.db.row("billing", USER)?.stripe_subscription_id).toBe(again);
    expect(w.sim.charges(again)).toEqual([1299]);
    expect(w.sim.itemPrice(again)).toBe("price_m2");
  });
});

describe("an ended plan's unpaid invoice", () => {
  it("is voided when the retries run out, so nobody pays for a month Premium never covers", async () => {
    const w = await paying();
    for (let i = 0; i < 3; i++) await nextMonth(w);
    w.sim.renew(w.sub, { paid: false }); // month 5, A$8.99, declined
    await syncCustomer(w.deps, w.customer);
    w.sim.advance(14 * DAY_S);
    w.sim.retriesRunOut(w.sub);

    await syncCustomer(w.deps, w.customer); // customer.subscription.deleted
    const renewal = w.stripe.state.invoices.at(-1)!;
    expect(renewal.status).toBe("void");
    expect(w.sim.callsTo("invoices.voidInvoice")[0].args[2]).toEqual({
      idempotencyKey: `ethos-void-${renewal.id}`,
    });
    // The email's link a week later: nothing left to pay.
    w.sim.advance(7 * DAY_S);
    expect(() => w.sim.payOpen(w.sub)).toThrow(/no open invoice/);
    expect(w.db.row("billing", USER)).toMatchObject({ status: "canceled", ladder_month: 4 });
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false });
  });

  it("never holds back Premium ending when the void fails, and a later sync voids it behind a new plan", async () => {
    const w = await paying();
    w.sim.renew(w.sub, { paid: false });
    w.sim.retriesRunOut(w.sub);
    w.stripe.state.fail["invoices.voidInvoice"] = new Error("Stripe is down");

    await expect(syncCustomer(w.deps, w.customer)).rejects.toThrow("Stripe is down");
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false });
    expect(w.db.row("billing", USER)).toMatchObject({ status: "canceled" });

    const again = w.sim.startPlan(w.customer);
    await syncCustomer(w.deps, w.customer);
    expect(w.db.row("billing", USER)?.stripe_subscription_id).toBe(again);
    expect(() => w.sim.payOpen(w.sub)).toThrow(/no open invoice/);
  });

  it("is voided on account deletion, so a cancelled past-due plan has nothing left to pay", async () => {
    const w = await paying();
    w.sim.renew(w.sub, { paid: false }); // past_due
    await endEveryPlan(w.deps.stripe, w.customer);
    await voidEndedInvoices(w.deps.stripe, w.customer);
    expect(w.sim.callsTo("invoices.voidInvoice")).toHaveLength(1);
    expect(w.sim.sub(w.sub).status).toBe("canceled");
    expect(w.stripe.state.invoices.at(-1)!.status).toBe("void");
  });
});

/**
 * The next invoices.list call reads Stripe as it is, then stalls before
 * answering until released: a sync that read early and writes late.
 */
function holdNextRead(w: World) {
  let release!: () => void;
  let reached!: () => void;
  const reachedP = new Promise<void>((r) => (reached = r));
  const released = new Promise<void>((r) => (release = r));
  const list = w.stripe.api.invoices.list;
  let armed = true;
  w.stripe.api.invoices.list = async (params: Parameters<typeof list>[0]) => {
    const out = await list(params);
    if (armed) {
      armed = false;
      reached();
      await released;
    }
    return out;
  };
  return { reached: reachedP, release };
}

describe("two syncs at once", () => {
  it("a sync that read the plan before it ended never leaves Premium on after a newer sync cleared it", async () => {
    const w = await paying();
    await nextMonth(w);
    w.sim.renew(w.sub, { paid: false });
    await syncCustomer(w.deps, w.customer); // past_due, Premium on through the retries

    // The last invoice.payment_failed: its sync reads past_due, then stalls.
    const hold = holdNextRead(w);
    const stale = syncCustomer(w.deps, w.customer);
    await hold.reached;
    // The retries run out; customer.subscription.deleted's sync runs to the end.
    w.sim.retriesRunOut(w.sub);
    await syncCustomer(w.deps, w.customer);
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false });

    hold.release();
    await stale;
    expect(w.db.row("billing", USER)).toMatchObject({ status: "canceled", next_price_cents: null });
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false, premium_source: null });
  });

  it("a sync that read a first payment as pending never switches off the Premium a newer sync gave", async () => {
    const w = world();
    const customer = customerFor(w);
    const sub = w.sim.startPlan(customer, { firstPaid: false });

    // customer.subscription.created's sync reads incomplete, then stalls.
    const hold = holdNextRead(w);
    const stale = syncCustomer(w.deps, customer);
    await hold.reached;
    // The payment lands; invoice.paid's sync runs to the end.
    w.sim.payOpen(sub);
    await syncCustomer(w.deps, customer);
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: true });

    hold.release();
    await stale;
    expect(w.db.row("billing", USER)).toMatchObject({ status: "active", ladder_month: 1 });
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: true, premium_source: "stripe" });
    expect(w.sim.itemPrice(sub)).toBe("price_m2");
    expect(w.sim.callsTo("subscriptions.update")).toHaveLength(1);
  });

  it("a renewal paid between the read and the write never leaves last month's count", async () => {
    const w = await paying();
    for (let i = 0; i < 7; i++) await nextMonth(w); // month 8: on the floor, no step to give it away
    const item = w.sim.sub(w.sub).items.data[0];
    w.stripe.state.clock = item.current_period_end;
    item.current_period_start = item.current_period_end;
    item.current_period_end += 30 * DAY_S; // the period rolled, its invoice not paid yet

    const hold = holdNextRead(w);
    const stale = syncCustomer(w.deps, w.customer);
    await hold.reached;
    w.sim.invoice(w.sub, "subscription_cycle", "paid"); // paid an hour later, nothing else changed
    await syncCustomer(w.deps, w.customer);

    hold.release();
    await stale;
    expect(w.db.row("billing", USER)).toMatchObject({ ladder_month: 9 });
  });

  it("gives up and throws, so Stripe retries, when the plan never holds still", async () => {
    const w = await paying();
    const list = w.stripe.api.subscriptions.list;
    w.stripe.api.subscriptions.list = async (params: Parameters<typeof list>[0]) => {
      const out = await list(params);
      w.sim.advance(1);
      w.sim.sub(w.sub).items.data[0].current_period_end += 1; // something new every read
      return out;
    };
    await expect(syncCustomer(w.deps, w.customer)).rejects.toThrow(/kept changing/);
  });
});

describe("premium on the profile", () => {
  it("runs to the paid period's end plus three days", async () => {
    const w = await paying();
    const end = w.sim.sub(w.sub).items.data[0].current_period_end;

    expect(w.db.row("billing", USER)?.current_period_end).toBe(
      new Date(end * 1000).toISOString()
    );
    expect(w.db.row("profiles", USER)?.premium_until).toBe(
      new Date((end + 3 * DAY_S) * 1000).toISOString()
    );
  });

  it("ends with the plan when the premium came from the plan", async () => {
    const w = await paying();
    await cancelPlan(w.deps, USER);
    expect(w.sim.renew(w.sub)).toBe(0); // the cancel takes effect

    const out = await syncCustomer(w.deps, w.customer);
    expect(out?.premium).toBe(false);
    expect(out?.billing?.status).toBe("canceled");
    expect(w.db.row("profiles", USER)).toMatchObject({
      premium: false,
      premium_until: null,
      premium_source: null,
    });
  });

  it("never touches a premium given by code, while the plan runs or after it ends", async () => {
    const w = world();
    const code = { user_id: USER, premium: true, premium_source: "code", premium_until: null };
    w.db.put("profiles", code);
    const p = await paying(w);

    expect(w.db.row("profiles", USER)).toEqual(code);
    await cancelPlan(w.deps, USER);
    w.sim.renew(p.sub);
    const out = await syncCustomer(w.deps, p.customer);

    expect(out?.premium).toBe(true);
    expect(w.db.row("profiles", USER)).toEqual(code);
  });

  it("gives a paid plan its Premium when an older given premium has run out", async () => {
    const w = world();
    const lapsed = new Date(w.stripe.now().getTime() - DAY_S * 1000).toISOString();
    w.db.put("profiles", {
      user_id: USER,
      premium: true,
      premium_source: "code",
      premium_until: lapsed,
    });
    const p = await paying(w);
    const end = w.sim.sub(p.sub).items.data[0].current_period_end;

    expect(w.db.row("profiles", USER)).toMatchObject({
      premium: true,
      premium_source: "stripe",
      premium_until: new Date((end + 3 * DAY_S) * 1000).toISOString(),
    });
  });
});

describe("cancel and resume", () => {
  it("cancel keeps Premium to the end of the paid month; resume keeps the month and the next price", async () => {
    const w = await paying();
    await nextMonth(w);
    await nextMonth(w);

    const cancelled = await cancelPlan(w.deps, USER);
    expect(cancelled).toEqual({
      billing: expect.objectContaining({
        status: "active",
        ladder_month: 3,
        price_cents: 1099,
        next_price_cents: null,
        cancel_at_period_end: true,
      }),
      premium: true,
    });
    expect(w.sim.callsTo("subscriptions.update").at(-1)?.args[1]).toEqual({
      cancel_at_period_end: true,
    });

    const resumed = await resumePlan(w.deps, USER);
    expect(resumed).toEqual({
      billing: expect.objectContaining({
        ladder_month: 3,
        next_price_cents: 999,
        cancel_at_period_end: false,
      }),
      premium: true,
    });
    expect(w.sim.renew(w.sub)).toBe(999);
  });

  it("answers what Stripe now holds when the copy fails to sync after a cancel went through", async () => {
    const w = await paying();
    const update = w.stripe.api.subscriptions.update;
    w.stripe.api.subscriptions.update = async (...args: Parameters<typeof update>) => {
      const out = await update(...args);
      // Supabase blips right after Stripe took the change.
      w.db.state.fail.push({ table: "billing", op: "upsert", error: { code: "08006", message: "down" } });
      return out;
    };

    const out = await cancelPlan(w.deps, USER);
    expect(w.sim.sub(w.sub).cancel_at_period_end).toBe(true);
    expect(out).toEqual({
      billing: expect.objectContaining({ cancel_at_period_end: true, next_price_cents: null }),
      premium: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("the webhook will repair it"),
      expect.stringContaining("billing write failed")
    );
  });

  it("answers what Stripe now holds when the copy fails to sync after a resume went through", async () => {
    const w = await paying();
    await cancelPlan(w.deps, USER);
    const update = w.stripe.api.subscriptions.update;
    w.stripe.api.subscriptions.update = async (...args: Parameters<typeof update>) => {
      const out = await update(...args);
      w.db.state.fail.push({ table: "profiles", op: "upsert", error: { code: "08006", message: "down" } });
      return out;
    };

    const out = await resumePlan(w.deps, USER);
    expect(w.sim.sub(w.sub).cancel_at_period_end).toBe(false);
    expect(out).toEqual({
      billing: expect.objectContaining({
        status: "active",
        cancel_at_period_end: false,
        next_price_cents: 1199,
        current_period_end: new Date(w.sim.sub(w.sub).items.data[0].current_period_end * 1000).toISOString(),
      }),
      premium: true,
    });
  });

  it("refuses a second cancel, and a resume or cancel once the plan has ended", async () => {
    const w = await paying();
    await cancelPlan(w.deps, USER);
    await expect(cancelPlan(w.deps, USER)).rejects.toMatchObject({
      status: 409,
      message: "This plan is already set to end.",
    });

    w.sim.renew(w.sub);
    await expect(resumePlan(w.deps, USER)).rejects.toMatchObject({
      status: 409,
      message: "This plan has ended. A new one starts at month 1.",
    });
    await expect(cancelPlan(w.deps, USER)).rejects.toBeInstanceOf(BillingError);
    await expect(cancelPlan(w.deps, USER)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 404 with no plan, and resume on a renewing plan changes nothing", async () => {
    const empty = world();
    await expect(cancelPlan(empty.deps, USER)).rejects.toMatchObject({ status: 404 });
    customerFor(empty); // checkout opened, never paid
    await expect(resumePlan(empty.deps, USER)).rejects.toMatchObject({ status: 404 });

    const w = await paying();
    const before = w.sim.writes().length;
    const out = await resumePlan(w.deps, USER);
    expect(out.billing).toMatchObject({ cancel_at_period_end: false, next_price_cents: 1199 });
    expect(w.sim.writes()).toHaveLength(before);
  });

  it("answers 404, not 409, for a first payment that never came", async () => {
    const w = world();
    const customer = customerFor(w);
    const sub = w.sim.startPlan(customer, { firstPaid: false });
    w.sim.sub(sub).status = "incomplete_expired";

    await expect(cancelPlan(w.deps, USER)).rejects.toMatchObject({ status: 404 });
    await expect(resumePlan(w.deps, USER)).rejects.toMatchObject({ status: 404 });
    expect(w.sim.writes()).toEqual([]);
  });

  it("treats a cancel date set elsewhere as ending, and resume clears it", async () => {
    const w = await paying();
    const end = w.sim.sub(w.sub).items.data[0].current_period_end;
    w.sim.sub(w.sub).cancel_at = end - 10 * DAY_S; // set in the dashboard

    const synced = await syncCustomer(w.deps, w.customer);
    expect(synced?.billing).toMatchObject({
      cancel_at_period_end: true,
      next_price_cents: null,
      current_period_end: new Date((end - 10 * DAY_S) * 1000).toISOString(),
    });

    const resumed = await resumePlan(w.deps, USER);
    expect(w.sim.callsTo("subscriptions.update").at(-1)?.args[1]).toEqual({ cancel_at: "" });
    expect(w.sim.sub(w.sub).cancel_at).toBeNull();
    expect(resumed.billing).toMatchObject({ cancel_at_period_end: false, next_price_cents: 1199 });
  });
});

describe("a cancel date past this period", () => {
  it("still reads as renewing, with its next charge, and cancel brings the end to this period", async () => {
    const w = await paying();
    const end = w.sim.sub(w.sub).items.data[0].current_period_end;
    // Support set a date in the dashboard, in the period after next.
    w.sim.sub(w.sub).cancel_at = end + 20 * DAY_S;

    const synced = await syncCustomer(w.deps, w.customer);
    expect(synced?.billing).toMatchObject({
      cancel_at_period_end: false,
      next_price_cents: 1199,
      current_period_end: new Date(end * 1000).toISOString(),
    });

    const cancelled = await cancelPlan(w.deps, USER);
    expect(w.sim.callsTo("subscriptions.update").at(-1)?.args[1]).toEqual({ cancel_at: end });
    expect(w.sim.sub(w.sub).cancel_at).toBe(end);
    expect(cancelled.billing).toMatchObject({
      cancel_at_period_end: true,
      next_price_cents: null,
      current_period_end: new Date(end * 1000).toISOString(),
    });
    // Nothing more is charged: the plan ends at this period's end.
    expect(w.sim.renew(w.sub)).toBe(0);
    expect(w.sim.sub(w.sub).status).toBe("canceled");
  });
});

describe("checkout", () => {
  it("opens a new plan on month 1 with the whole ladder above the pay button", async () => {
    const w = world();
    const out = await createCheckout(w.deps, {
      userId: USER,
      email: "tim@example.com",
      site: SITE,
      returnTo: "/games",
    });

    expect(out).toEqual({ url: expect.stringMatching(/^https:\/\/checkout\.stripe\.test\//) });
    const params = w.sim.callsTo("checkout.sessions.create")[0].args[0] as { customer: string };
    expect(params).toEqual({
      mode: "subscription",
      customer: expect.stringMatching(/^cus_/),
      line_items: [{ price: "price_m1", quantity: 1 }],
      client_reference_id: USER,
      metadata: { user_id: USER },
      subscription_data: { metadata: { user_id: USER } },
      success_url: `${SITE}/you?checkout=done`,
      cancel_url: `${SITE}/games`,
      allow_promotion_codes: false,
      currency: "aud",
      adaptive_pricing: { enabled: false },
      custom_text: { submit: { message: checkoutDisclosure() } },
      // Half an hour and a little, never Stripe's default of a day.
      expires_at: Math.floor(w.stripe.now().getTime() / 1000) + 35 * 60,
    });
    expect(w.db.row("billing", USER)).toMatchObject({
      stripe_customer_id: params.customer,
      ladder_month: 0,
      status: null,
    });
    expect(w.sim.callsTo("customers.create")[0].args).toEqual([
      { email: "tim@example.com", metadata: { user_id: USER } },
      { idempotencyKey: `ethos-customer-${USER}` },
    ]);

    await createCheckout(w.deps, { userId: USER, email: null, site: SITE, returnTo: "/you" });
    expect(w.sim.callsTo("customers.create")).toHaveLength(1);
  });

  it("discloses every rung, the renewal and the reset rule, plainly", () => {
    const text = checkoutDisclosure();
    for (const cents of LADDER_CENTS) expect(text).toContain(formatAud(cents));
    expect(text).toContain("Renews monthly until you cancel.");
    expect(text).toContain("A$12.99 for the first month");
    expect(text).toContain("A$6.99 from month 7 on");
    expect(text).toContain("Premium runs to the end of the month you paid for");
    expect(text).toContain("a new one starts again at A$12.99");
    expect(text).toContain("A declined card keeps your place");
    expect(text.length).toBeLessThan(1200);
    expect(text).not.toMatch(/—|addict|hurry|last chance|don't lose|before it's gone/i);
    // "a dollar less each month" stays true only while every step is a dollar.
    for (let i = 1; i < LADDER_CENTS.length; i++) {
      expect(LADDER_CENTS[i - 1] - LADDER_CENTS[i]).toBe(100);
    }
  });

  it("uses the winner's customer when two taps race to make one", async () => {
    const w = world();
    const create = w.stripe.api.customers.create;
    w.stripe.api.customers.create = async (...args) => {
      // The other request's row lands between our read and our insert.
      w.db.put("billing", { user_id: USER, stripe_customer_id: "cus_winner" });
      return create(...args);
    };
    expect(await ensureCustomer(w.deps, USER, null)).toBe("cus_winner");
    expect(w.db.state.tables.billing).toHaveLength(1);
  });

  const corruptions: [string, (book: FakePrice[]) => void][] = [
    ["a missing rung", (book) => void book.splice(6, 1)],
    ["an archived rung", (book) => void (book[3].active = false)],
    ["a wrong amount", (book) => void (book[2].unit_amount = 999)],
    ["another currency", (book) => void (book[0].currency = "usd")],
    [
      "a price in a second currency",
      (book) =>
        void (book[0].currency_options = { usd: { unit_amount: 899, tax_behavior: "inclusive" } }),
    ],
    ["GST added on top", (book) => void (book[1].tax_behavior = "exclusive")],
    [
      "a yearly price",
      (book) =>
        void (book[4].recurring = { interval: "year", interval_count: 1, usage_type: "licensed" }),
    ],
    [
      "every second month",
      (book) =>
        void (book[5].recurring = { interval: "month", interval_count: 2, usage_type: "licensed" }),
    ],
    ["two prices on one key", (book) => void book.push({ ...book[0], id: "price_twin" })],
  ];

  it.each(corruptions)("fails closed on %s: nothing is made, nothing charged", async (_, corrupt) => {
    const w = world();
    corrupt(w.stripe.state.priceBook);

    await expect(
      createCheckout(w.deps, { userId: USER, email: null, site: SITE, returnTo: "/you" })
    ).rejects.toMatchObject({ status: 502 });
    expect(w.sim.writes()).toEqual([]);
    expect(w.db.row("billing", USER)).toBeUndefined();
  });

  it("caches the verified prices for ten minutes", async () => {
    const w = world();
    const t = Date.now();
    const first = await ladderPrices(w.deps.stripe, t);
    expect(first.map((p) => p.id)).toEqual(LADDER_CENTS.map((_, i) => `price_m${i + 1}`));
    await ladderPrices(w.deps.stripe, t + 9 * 60_000);
    expect(w.sim.callsTo("prices.list")).toHaveLength(1);
    await ladderPrices(w.deps.stripe, t + 11 * 60_000);
    expect(w.sim.callsTo("prices.list")).toHaveLength(2);
  });

  it("never lets a wrong price hold back Premium, and the webhook retries the step", async () => {
    const w = world();
    const customer = customerFor(w);
    w.sim.startPlan(customer);
    w.stripe.state.priceBook[1].unit_amount = 1299; // month 2 priced as month 1

    await expect(syncCustomer(w.deps, customer)).rejects.toMatchObject({ status: 502 });
    expect(w.sim.callsTo("subscriptions.update")).toEqual([]);
    // The item never left month 1's price, so the next renewal says so.
    expect(w.db.row("billing", USER)).toMatchObject({
      status: "active",
      ladder_month: 1,
      next_price_cents: 1299,
    });
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: true });

    // The person's own sync answers; the failed step goes to the log.
    await expect(syncUser(w.deps, USER)).resolves.toMatchObject({ premium: true });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("rung step failed"),
      expect.stringContaining("ethos_ladder_m2")
    );

    // Fixed in Stripe: a failed check is never cached, so the next sync
    // steps, and the row says the rung again.
    w.stripe.state.priceBook[1].unit_amount = 1199;
    await syncCustomer(w.deps, customer);
    expect(w.db.row("billing", USER)?.next_price_cents).toBe(1199);
  });

  it("never steps a plan on a price that is not the ladder's, and says what it will really charge", async () => {
    // A yearly plan made by hand in the dashboard, on another product.
    const w = world();
    const customer = customerFor(w);
    const sub = w.sim.startPlan(customer);
    w.sim.sub(sub).items.data[0].price = {
      ...structuredClone(w.stripe.state.priceBook[0]),
      id: "price_yearly",
      lookup_key: null,
      product: "prod_other",
      unit_amount: 9900,
      recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
    };

    const out = await syncCustomer(w.deps, customer);
    expect(w.sim.callsTo("subscriptions.update")).toEqual([]);
    expect(w.sim.itemPrice(sub)).toBe("price_yearly");
    expect(out?.billing).toMatchObject({ ladder_month: 1, next_price_cents: 9900 });
    expect(out?.premium).toBe(true);
  });

  it("still steps a plan on an old rung whose key moved to a corrected price", async () => {
    const w = world();
    const customer = customerFor(w);
    const sub = w.sim.startPlan(customer);
    // stripe-setup.mjs moved ethos_ladder_m1 off this price (transfer_lookup_key).
    w.sim.sub(sub).items.data[0].price = {
      ...structuredClone(w.stripe.state.priceBook[0]),
      id: "price_m1_old",
      lookup_key: null,
    };

    await syncCustomer(w.deps, customer);
    expect(w.sim.itemPrice(sub)).toBe("price_m2");
  });

  it("never steps a plan with more than one item, and says what it will really charge", async () => {
    const w = world();
    const customer = customerFor(w);
    const sub = w.sim.startPlan(customer);
    const item = w.sim.sub(sub).items.data[0];
    w.sim.sub(sub).items.data.push({ ...structuredClone(item), id: "si_extra" });

    const out = await syncCustomer(w.deps, customer);
    expect(w.sim.callsTo("subscriptions.update")).toEqual([]);
    expect(out?.billing).toMatchObject({ ladder_month: 1, next_price_cents: 2598 });
    expect(out?.premium).toBe(true);
  });
});

describe("two Checkouts, one plan", () => {
  const open = (w: World) =>
    createCheckout(w.deps, { userId: USER, email: null, site: SITE, returnTo: "/you" });

  it("ends every older open Checkout before opening a new one, so only the newest can be paid", async () => {
    const w = world();
    await open(w); // phone
    await open(w); // laptop, before the phone's was paid
    const [first, second] = w.stripe.state.sessions;
    expect(first.status).toBe("expired");
    expect(second.status).toBe("open");

    // Paying on the laptop starts the plan; the phone's tab shows Stripe's expired page.
    const sub = w.sim.completeSession(second.id);
    expect(() => w.sim.completeSession(first.id)).toThrow(/expired/);
    await syncCustomer(w.deps, w.stripe.state.sessions[1].customer!);
    expect(w.stripe.state.subs.map((x) => x.id)).toEqual([sub]);
    expect(w.sim.charges(sub)).toEqual([1299]);
  });

  it("opens no second Checkout when the older one was paid while it was being closed", async () => {
    const w = world();
    await open(w);
    const first = w.stripe.state.sessions[0];
    const expire = w.stripe.api.checkout.sessions.expire;
    w.stripe.api.checkout.sessions.expire = async (id: string) => {
      w.sim.completeSession(id); // paid a moment before the expire reached Stripe
      return expire(id);
    };

    expect(await open(w)).toEqual({ manage: true });
    expect(w.sim.callsTo("checkout.sessions.create")).toHaveLength(1);
    expect(first.status).toBe("complete");
    expect(w.stripe.state.subs).toHaveLength(1);
  });

  it("opens no second Checkout over a plan whose first payment is still pending", async () => {
    const w = world();
    const customer = customerFor(w);
    w.sim.startPlan(customer, { firstPaid: false }); // a debit that settles over days

    expect(await open(w)).toEqual({ manage: true });
    expect(w.sim.callsTo("checkout.sessions.create")).toEqual([]);
  });
});

describe("more than one plan", () => {
  it("an in-app cancel ends every live plan, so a duplicate stops billing too", async () => {
    const w = world();
    const customer = customerFor(w);
    const first = w.sim.startPlan(customer);
    await syncCustomer(w.deps, customer);
    const dup = w.sim.startPlan(customer);
    await syncCustomer(w.deps, customer);

    const out = await cancelPlan(w.deps, USER);
    expect(out.billing).toMatchObject({ cancel_at_period_end: true, next_price_cents: null });
    expect(w.sim.sub(first).cancel_at_period_end).toBe(true);
    expect(w.sim.sub(dup).cancel_at_period_end).toBe(true);
    await expect(cancelPlan(w.deps, USER)).rejects.toMatchObject({ status: 409 });

    expect(w.sim.renew(first)).toBe(0);
    expect(w.sim.renew(dup)).toBe(0);
  });

  it("an in-app cancel reaches a duplicate even when the kept plan is already ending", async () => {
    const w = world();
    const customer = customerFor(w);
    const kept = w.sim.startPlan(customer);
    w.sim.renew(kept); // two paid months: the plan the account reads
    w.sim.sub(kept).cancel_at_period_end = true;
    w.sim.sub(kept).cancel_at = w.sim.sub(kept).items.data[0].current_period_end;
    const dup = w.sim.startPlan(customer);

    const out = await cancelPlan(w.deps, USER);
    expect(w.sim.sub(dup).cancel_at_period_end).toBe(true);
    expect(out.billing).toMatchObject({ ladder_month: 2, cancel_at_period_end: true });
    expect(w.sim.renew(dup)).toBe(0);
  });

  it("keeps the plan with the most paid months, logs the other and cancels nothing", async () => {
    const w = world();
    const customer = customerFor(w);
    const old = w.sim.startPlan(customer);
    w.sim.renew(old);
    w.sim.renew(old);
    const dup = w.sim.startPlan(customer);

    const out = await syncCustomer(w.deps, customer);
    expect(out?.billing?.ladder_month).toBe(3);
    expect(w.db.row("billing", USER)?.stripe_subscription_id).toBe(old);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`kept ${old}`));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(dup));
    expect(w.sim.callsTo("subscriptions.cancel")).toEqual([]);
    expect(w.sim.sub(dup).status).toBe("active");
    expect(w.sim.itemPrice(dup)).toBe("price_m1");
  });

  it("never lets a first payment still pending displace a paying plan", async () => {
    const w = world();
    const customer = customerFor(w);
    const paid = w.sim.startPlan(customer);
    w.sim.startPlan(customer, { firstPaid: false });

    await syncCustomer(w.deps, customer);
    expect(w.db.row("billing", USER)?.stripe_subscription_id).toBe(paid);
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("live plans"));
  });
});

describe("who a customer is", () => {
  it("skips a customer that names nobody, without throwing", async () => {
    const w = world();
    const stranger = w.sim.customer(null);
    await expect(syncCustomer(w.deps, stranger)).resolves.toBeNull();
    expect(w.db.state.tables.billing).toEqual([]);
  });

  it("finds the account by the customer's metadata and writes its row", async () => {
    const w = world();
    const customer = w.sim.customer(USER);
    w.sim.startPlan(customer);
    await syncCustomer(w.deps, customer);
    expect(w.db.row("billing", USER)).toMatchObject({
      stripe_customer_id: customer,
      ladder_month: 1,
    });
  });

  it("ends a deleted account's plan rather than billing it forever, and answers without throwing", async () => {
    // A Checkout paid after the account was deleted: the customer still names the user.
    const w = world([]);
    const customer = w.sim.customer(USER);
    const sub = w.sim.startPlan(customer);
    await expect(syncCustomer(w.deps, customer)).resolves.toBeNull();
    expect(w.db.state.tables.profiles).toEqual([]);
    expect(w.sim.sub(sub).status).toBe("canceled");
    expect(w.sim.renew(sub)).toBe(0);
    // The ended event's own sync finds nothing left to end.
    await expect(syncCustomer(w.deps, customer)).resolves.toBeNull();
    expect(w.sim.callsTo("subscriptions.cancel")).toHaveLength(1);
  });

  it("leaves a plan that isn't the ladder's alone on a customer naming a user who isn't here", async () => {
    // Another product on the same Stripe account whose user ids happen to be uuids.
    const w = world([]);
    const customer = w.sim.customer(USER);
    const sub = w.sim.startPlan(customer);
    w.sim.sub(sub).items.data[0].price = {
      ...structuredClone(w.stripe.state.priceBook[0]),
      id: "price_theirs",
      lookup_key: null,
      product: "prod_theirs",
    };
    await expect(syncCustomer(w.deps, customer)).resolves.toBeNull();
    expect(w.sim.sub(sub).status).toBe("active");
    expect(w.sim.callsTo("subscriptions.cancel")).toEqual([]);
  });

  it("skips a customer whose user id is not an Ethos id, without throwing", async () => {
    // Another product on the same Stripe account, with its own idea of a user id.
    const w = world();
    const foreign = w.sim.customer("u_123");
    w.sim.startPlan(foreign);
    await expect(syncCustomer(w.deps, foreign)).resolves.toBeNull();
    expect(w.db.state.tables.billing).toEqual([]);
    expect(w.sim.writes()).toEqual([]);
  });

  it("never moves an account onto a second customer", async () => {
    const w = world();
    const mine = customerFor(w);
    const impostor = w.sim.customer(USER);
    await expect(syncCustomer(w.deps, impostor)).resolves.toBeNull();
    expect(w.db.row("billing", USER)?.stripe_customer_id).toBe(mine);
  });
});

describe("a customer this key can't see", () => {
  const open = (w: World) =>
    createCheckout(w.deps, { userId: USER, email: "tim@example.com", site: SITE, returnTo: "/you" });

  it("a test-mode row under live keys: the stale plan clears, and checkout opens on a new customer", async () => {
    const w = await paying(world([USER], { live: true }));
    w.sim.otherMode(w.customer); // the end-to-end test ran in test mode on this database

    const synced = await syncUser(w.deps, USER);
    expect(synced).toEqual({
      billing: expect.objectContaining({ status: null, ladder_month: 0, next_price_cents: null }),
      premium: false,
    });
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false, premium_source: null });

    expect(await open(w)).toEqual({ url: expect.stringMatching(/^https:/) });
    const fresh = w.db.row("billing", USER)!.stripe_customer_id as string;
    expect(fresh).not.toBe(w.customer);
    expect(w.sim.callsTo("customers.create").at(-1)?.args[1]).toEqual({
      idempotencyKey: `ethos-customer-${USER}-${w.customer}`,
    });
    expect(w.stripe.state.sessions.at(-1)?.customer).toBe(fresh);
  });

  it("a test-mode row under live keys never blocks account deletion", async () => {
    const w = await paying(world([USER], { live: true }));
    w.sim.otherMode(w.customer);
    expect(await endEveryPlan(w.deps.stripe, w.customer, { livemode: true })).toBe(0);
    expect(await voidEndedInvoices(w.deps.stripe, w.customer, { livemode: true })).toBe(0);
  });

  it("the portal answers 404 for a test-mode plan under live keys, and clears it", async () => {
    const w = await paying(world([USER], { live: true }));
    w.sim.otherMode(w.customer);
    await expect(
      openPortal(w.deps, { userId: USER, site: SITE, returnTo: "/you" })
    ).rejects.toMatchObject({ status: 404 });
    expect(w.db.row("billing", USER)).toMatchObject({ stripe_subscription_id: null, status: null });
  });

  it("a customer deleted in the dashboard: checkout opens on a new one", async () => {
    const w = await paying();
    w.sim.deleteCustomer(w.customer);
    await syncUser(w.deps, USER);
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: false });

    expect(await open(w)).toEqual({ url: expect.stringMatching(/^https:/) });
    expect(w.db.row("billing", USER)!.stripe_customer_id).not.toBe(w.customer);
  });

  it("under a test key a live row is never touched: sync, checkout and deletion all stop", async () => {
    const w = await paying(world([USER], { live: false }));
    const before = structuredClone(w.db.row("billing", USER));
    w.sim.otherMode(w.customer); // a Preview with test keys on the production database

    await expect(syncUser(w.deps, USER)).rejects.toMatchObject({ code: "resource_missing" });
    await expect(open(w)).rejects.toMatchObject({ code: "resource_missing" });
    await expect(endEveryPlan(w.deps.stripe, w.customer)).rejects.toMatchObject({
      code: "resource_missing",
    });
    expect(w.db.row("billing", USER)).toEqual(before);
    expect(w.db.row("profiles", USER)).toMatchObject({ premium: true });
    expect(w.sim.callsTo("customers.create")).toEqual([]);
  });
});

describe("syncUser and the portal", () => {
  it("asks Stripe nothing for an account with no billing row", async () => {
    const w = world();
    expect(await syncUser(w.deps, USER)).toEqual({ billing: null, premium: false });
    w.db.put("profiles", { user_id: USER, premium: true, premium_source: "code" });
    expect(await syncUser(w.deps, USER)).toEqual({ billing: null, premium: true });
    expect(w.stripe.state.calls).toEqual([]);
  });

  it("opens the portal only for an account with a plan", async () => {
    const empty = world();
    const opts = { userId: USER, site: SITE, returnTo: "/settings", configuration: "bpc_1" };
    await expect(openPortal(empty.deps, opts)).rejects.toMatchObject({ status: 404 });
    customerFor(empty);
    await expect(openPortal(empty.deps, opts)).rejects.toMatchObject({ status: 404 });

    const w = await paying();
    expect(await openPortal(w.deps, opts)).toMatch(/^https:\/\/billing\.stripe\.test\//);
    expect(w.sim.callsTo("billingPortal.sessions.create")[0].args[0]).toEqual({
      customer: w.customer,
      return_url: `${SITE}/settings`,
      configuration: "bpc_1",
    });
  });
});

describe("account deletion", () => {
  it("cancels every plan that has not ended, now", async () => {
    const w = world();
    const customer = customerFor(w);
    const ended = w.sim.startPlan(customer);
    w.sim.retriesRunOut(ended);
    const late = w.sim.startPlan(customer);
    w.sim.renew(late, { paid: false });
    const pending = w.sim.startPlan(customer, { firstPaid: false });

    expect(await endEveryPlan(w.deps.stripe, customer)).toBe(2);
    expect(w.sim.callsTo("subscriptions.cancel").map((c) => c.args[0]).sort()).toEqual(
      [late, pending].sort()
    );
    expect(w.sim.sub(late).status).toBe("canceled");
  });

  it("closes the customer's open Checkouts first, so none can be paid afterwards", async () => {
    const w = world();
    await createCheckout(w.deps, { userId: USER, email: null, site: SITE, returnTo: "/you" });
    const customer = w.db.row("billing", USER)!.stripe_customer_id as string;
    const [session] = w.stripe.state.sessions;

    expect(await endEveryPlan(w.deps.stripe, customer)).toBe(0);
    expect(session.status).toBe("expired");
    expect(() => w.sim.completeSession(session.id)).toThrow(/expired/);
  });

  it("cancels the plan of a Checkout paid while it was being closed", async () => {
    const w = world();
    await createCheckout(w.deps, { userId: USER, email: null, site: SITE, returnTo: "/you" });
    const customer = w.db.row("billing", USER)!.stripe_customer_id as string;
    const expire = w.stripe.api.checkout.sessions.expire;
    let paid = "";
    w.stripe.api.checkout.sessions.expire = async (id: string) => {
      paid = w.sim.completeSession(id);
      return expire(id);
    };

    expect(await endEveryPlan(w.deps.stripe, customer)).toBe(1);
    expect(w.sim.sub(paid).status).toBe("canceled");
  });
});

describe("helpers", () => {
  it.each([
    ["/games", "/games"],
    ["/lessons?from=paywall#ladder", "/lessons?from=paywall#ladder"],
    ["/a/../you", "/you"],
    ["https://evil.example/you", "/you"],
    ["//evil.example", "/you"],
    ["/\\evil.example", "/you"],
    ["javascript:alert(1)", "/you"],
    ["/you\nLocation: x", "/you"],
    ["", "/you"],
    [42, "/you"],
    [null, "/you"],
  ])("returns %j to %j", (raw, path) => {
    expect(safeReturnPath(raw)).toBe(path);
  });

  it("finds the customer on any event's object", () => {
    expect(customerIdOf({ customer: "cus_1" })).toBe("cus_1");
    expect(customerIdOf({ customer: { id: "cus_2", object: "customer" } })).toBe("cus_2");
    expect(customerIdOf({ customer: null })).toBeNull();
    expect(customerIdOf({ customer: "" })).toBeNull();
    expect(customerIdOf(null)).toBeNull();
  });

  it("subscribes the webhook to exactly the events it acts on", () => {
    const script = readFileSync("scripts/stripe-setup.mjs", "utf8");
    const block = script.match(/const EVENTS = \[([\s\S]*?)\];/)?.[1] ?? "";
    const listed = [...block.matchAll(/"([a-z_.]+)"/g)].map((m) => m[1]);
    expect([...listed].sort()).toEqual([...HANDLED_EVENTS].sort());
  });

  it("asks for Stripe's own one-plan limit in the dashboard checklist", () => {
    const script = readFileSync("scripts/stripe-setup.mjs", "utf8");
    expect(script).toContain("Limit customers to one subscription");
  });

  it("makes the prices at exactly the ladder the server charges", () => {
    const script = readFileSync("scripts/stripe-setup.mjs", "utf8");
    const block = script.match(/const LADDER_CENTS = \[([^\]]*)\];/)?.[1] ?? "";
    expect(block.split(",").map((n) => Number(n.trim()))).toEqual([...LADDER_CENTS]);
    expect(script).toContain('tax_behavior: "inclusive"');
    expect(script).toContain("transfer_lookup_key: true");
    // A rung with a second currency is replaced, the same check the server makes.
    expect(script).toContain('expand: ["data.currency_options"]');
    expect(script).toMatch(/currency_options[\s\S]*filter\(\(c\) => c !== CURRENCY\)/);
    expect(script).toContain('mode: "at_period_end"');
    expect(script).toContain("subscription_update: { enabled: false }");
  });
});
