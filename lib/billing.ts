/**
 * The price ladder's server (DECISIONS #377).
 *
 * One Stripe Product, seven monthly AUD Prices found by lookup key
 * (`ethos_ladder_m1` to `_m7`, lib/pricing.ts). Checkout always starts a
 * NEW subscription on month 1. After every paid month the server moves
 * the subscription's single item onto the next rung's Price with
 * proration "none", so the NEXT renewal charges the next rung. No
 * Subscription Schedules: a schedule-managed subscription cannot have
 * its cancellation changed directly, and the customer portal will not
 * manage it.
 *
 * `syncCustomer` is the one function every webhook event and every
 * route runs. It reads Stripe's current truth (never an event's
 * snapshot), so it is idempotent and order-independent:
 *
 *   1. the user: the billing row by customer, else the customer's
 *      `metadata.user_id`;
 *   2. the plan: the newest live (or first-payment-pending) subscription,
 *      else the newest of any status;
 *   3. the month: that subscription's paid invoices billed for its
 *      creation or a renewal. A declined card leaves its invoice open,
 *      so the count holds through Stripe's retries;
 *   4. the copy: the billing row and the profile's entitlement, written
 *      BEFORE the step below, so a price problem can never hold back
 *      Premium starting or ending;
 *   5. the step: a live plan's item moves to the rung for month + 1.
 *      When it cannot, the row's next price is what Stripe will really
 *      charge, never the rung it missed, and the webhook retries.
 *
 * Fail closed on money: every price is checked against LADDER_CENTS
 * before anyone is charged it, so Stripe never bills an amount the
 * paywall did not say.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { BillingRow } from "./client-data";
import { getUserFromAuthHeader, supabaseAdmin, type AuthedUser } from "./db";
import {
  CURRENCY,
  FLOOR_MONTH,
  LADDER_CENTS,
  LOOKUP_KEYS,
  formatAud,
  monthForLookupKey,
  priceForMonth,
  rungIndex,
} from "./pricing";
import { consumeRateLimit } from "./rate-limit";
import { billingConfigured, stripeClient } from "./stripe";

// ---------------------------------------------------------------------
// Statuses

/** A plan still running: it renews, or Stripe is still retrying it. */
export const LIVE_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
];

/** What Premium runs on. past_due keeps it through the retry window. */
export const ENTITLED_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
];

/** A plan that can be the current one: live, or its first payment pending. */
const CANDIDATE_STATUSES: readonly string[] = [...LIVE_STATUSES, "incomplete"];

/** Ended for good; a new plan starts at month 1. */
const ENDED_STATUSES: readonly string[] = ["canceled", "incomplete_expired"];

/** Its first payment is pending, or expired unpaid: there was never a plan to cancel. */
const NEVER_STARTED: readonly string[] = ["incomplete", "incomplete_expired"];

/** The invoices that count as a paid month of the plan. */
const MONTH_REASONS: readonly string[] = [
  "subscription_create",
  "subscription_cycle",
];

export function isLive(status: string | null | undefined): boolean {
  return status != null && LIVE_STATUSES.includes(status);
}

export function isEntitled(status: string | null | undefined): boolean {
  return status != null && ENTITLED_STATUSES.includes(status);
}

/** The webhook acts on exactly these; scripts/stripe-setup.mjs subscribes to them. */
export const HANDLED_EVENTS: readonly string[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
];

/** Premium outlives the paid period by this much, in case the ended webhook is lost. */
const BACKSTOP_MS = 3 * 24 * 60 * 60 * 1000;
const PRICE_CACHE_MS = 10 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
/** An auth user id as Supabase writes it. Anything else names nobody here. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------
// Errors and dependencies

/** An answer for the person, with the status it travels on. */
export class BillingError extends Error {
  readonly status: 404 | 409 | 502;
  /** For the server log only. */
  readonly detail: string | null;
  constructor(status: 404 | 409 | 502, message: string, detail?: string) {
    super(message);
    this.name = "BillingError";
    this.status = status;
    this.detail = detail ?? null;
  }
}

const NO_PLAN = "There's no plan on this account.";
const ENDED = "This plan has ended. A new one starts at month 1.";
const ALREADY_ENDING = "This plan is already set to end.";
const PRICES_WRONG =
  "Premium's prices aren't set up right on this server, so nothing was charged. Try again later.";

export interface BillingDeps {
  stripe: Stripe;
  /** Service role: the billing table and the profile's premium columns. */
  db: SupabaseClient;
  /** The clock, for tests. */
  now?: () => Date;
}

export interface SyncResult {
  billing: BillingRow | null;
  /** The account's premium after this sync: a paid plan, or a code. */
  premium: boolean;
}

// ---------------------------------------------------------------------
// The ladder's prices

export interface LadderPrice {
  /** 1 to 7; 7 is the floor and repeats forever. */
  month: number;
  id: string;
  cents: number;
}

let priceCache = new WeakMap<object, { at: number; prices: LadderPrice[] }>();

/** Tests only: forget every verified price list. */
export function clearLadderCache(): void {
  priceCache = new WeakMap();
}

/**
 * What is wrong with `price` as month `month`'s rung, or null when it
 * is exactly what the paywall says: AUD, the ladder's amount, GST
 * inclusive, monthly, licensed, per unit, active.
 */
export function ladderPriceProblem(
  price: Stripe.Price,
  month: number
): string | null {
  const want = LADDER_CENTS[rungIndex(month)];
  if (!price.active) return "archived";
  if (price.currency !== CURRENCY) return `currency ${price.currency}`;
  if (price.type !== "recurring" || !price.recurring) return "not recurring";
  if (price.recurring.interval !== "month") return `interval ${price.recurring.interval}`;
  if (price.recurring.interval_count !== 1)
    return `interval_count ${price.recurring.interval_count}`;
  if (price.recurring.usage_type !== "licensed") return "metered";
  if (price.billing_scheme !== "per_unit") return "tiered";
  if (price.transform_quantity != null) return "transform_quantity set";
  if (price.unit_amount !== want) return `unit_amount ${price.unit_amount}, ladder says ${want}`;
  if (price.tax_behavior !== "inclusive") return `tax_behavior ${price.tax_behavior}`;
  return null;
}

/**
 * The seven rungs, month 1 first, each verified. Cached for ten
 * minutes per client. Missing or wrong throws: nothing is charged.
 */
export async function ladderPrices(
  stripe: Stripe,
  now: number = Date.now()
): Promise<LadderPrice[]> {
  const hit = priceCache.get(stripe);
  if (hit && now - hit.at < PRICE_CACHE_MS) return hit.prices;

  const found = await stripe.prices.list({
    lookup_keys: [...LOOKUP_KEYS],
    active: true,
    limit: 100,
  });
  const prices = LOOKUP_KEYS.map((key, i) => {
    const matches = found.data.filter((p) => p.lookup_key === key);
    if (matches.length !== 1) {
      throw new BillingError(502, PRICES_WRONG, `${key}: ${matches.length} active prices`);
    }
    const problem = ladderPriceProblem(matches[0], i + 1);
    if (problem) {
      throw new BillingError(502, PRICES_WRONG, `${key} (${matches[0].id}): ${problem}`);
    }
    return { month: i + 1, id: matches[0].id, cents: LADDER_CENTS[i] };
  });
  priceCache.set(stripe, { at: now, prices });
  return prices;
}

function rungFor(prices: LadderPrice[], month: number): LadderPrice {
  return prices[rungIndex(month)];
}

// ---------------------------------------------------------------------
// The billing row

interface StoredBilling extends BillingRow {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
}

const BILLING_COLUMNS =
  "user_id, stripe_customer_id, stripe_subscription_id, status, ladder_month, price_cents, next_price_cents, current_period_end, cancel_at_period_end";

function publicRow(row: BillingRow): BillingRow {
  return {
    status: row.status,
    ladder_month: row.ladder_month,
    price_cents: row.price_cents,
    next_price_cents: row.next_price_cents,
    current_period_end: row.current_period_end,
    cancel_at_period_end: row.cancel_at_period_end,
  };
}

async function billingBy(
  db: SupabaseClient,
  column: "user_id" | "stripe_customer_id",
  value: string
): Promise<StoredBilling | null> {
  const { data, error } = await db
    .from("billing")
    .select(BILLING_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (error) throw new Error(`billing read failed: ${error.message}`);
  return (data as unknown as StoredBilling | null) ?? null;
}

/**
 * The account's Stripe customer, made on first need. The idempotency
 * key makes two taps one customer; a lost insert race re-reads the
 * winner's row.
 */
export async function ensureCustomer(
  deps: BillingDeps,
  userId: string,
  email: string | null
): Promise<string> {
  const existing = await billingBy(deps.db, "user_id", userId);
  if (existing) return existing.stripe_customer_id;

  const customer = await deps.stripe.customers.create(
    { ...(email ? { email } : {}), metadata: { user_id: userId } },
    { idempotencyKey: `ethos-customer-${userId}` }
  );
  const { error } = await deps.db
    .from("billing")
    .insert({ user_id: userId, stripe_customer_id: customer.id });
  if (!error) return customer.id;
  if (error.code === UNIQUE_VIOLATION) {
    const winner = await billingBy(deps.db, "user_id", userId);
    if (winner) return winner.stripe_customer_id;
  }
  throw new Error(`billing insert failed: ${error.message}`);
}

// ---------------------------------------------------------------------
// Reading Stripe's truth

/** Paid months of one subscription: paid invoices for its creation or a renewal. */
export async function paidMonths(
  stripe: Stripe,
  subscriptionId: string
): Promise<number> {
  let count = 0;
  let after: string | undefined;
  for (;;) {
    const page = await stripe.invoices.list({
      subscription: subscriptionId,
      status: "paid",
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    for (const invoice of page.data) {
      if (invoice.status !== "paid") continue;
      if (!invoice.billing_reason || !MONTH_REASONS.includes(invoice.billing_reason)) continue;
      const owner = invoice.parent?.subscription_details?.subscription;
      const ownerId = typeof owner === "string" ? owner : owner?.id;
      if (ownerId && ownerId !== subscriptionId) continue;
      count++;
    }
    const last = page.data[page.data.length - 1];
    if (!page.has_more || !last) return count;
    after = last.id;
  }
}

interface Plan {
  sub: Stripe.Subscription;
  months: number;
}

function entitledRank(status: string): number {
  return isEntitled(status) ? 2 : isLive(status) ? 1 : 0;
}

/**
 * The plan this account is on: the newest candidate, or with several,
 * the one with the most paid months (then the one Premium runs on, then
 * the newest). Nothing is cancelled automatically; a duplicate is
 * logged for a person to look at.
 */
async function currentPlan(
  stripe: Stripe,
  customerId: string,
  subs: Stripe.Subscription[]
): Promise<Plan | null> {
  const newest = [...subs].sort((a, b) => b.created - a.created);
  const candidates = newest.filter((s) => CANDIDATE_STATUSES.includes(s.status));
  const pool = candidates.length > 0 ? candidates : newest.slice(0, 1);
  if (pool.length === 0) return null;
  if (pool.length === 1) {
    return { sub: pool[0], months: await paidMonths(stripe, pool[0].id) };
  }

  const counted = await Promise.all(
    pool.map(async (sub) => ({ sub, months: await paidMonths(stripe, sub.id) }))
  );
  counted.sort(
    (a, b) =>
      b.months - a.months ||
      entitledRank(b.sub.status) - entitledRank(a.sub.status) ||
      b.sub.created - a.sub.created
  );
  const live = counted.filter((p) => isLive(p.sub.status));
  if (live.length > 1) {
    console.error(
      `billing: ${live.length} live plans on ${customerId}; kept ${counted[0].sub.id} ` +
        `(${counted[0].months} paid), left ${live
          .filter((p) => p !== counted[0])
          .map((p) => `${p.sub.id} (${p.months} paid)`)
          .join(", ")} for a person to look at`
    );
  }
  return counted[0];
}

/**
 * The plan's item: `period` dates the plan, `step` is the item the
 * ladder may move. Checkout makes exactly one; with any other count the
 * dates still read from the first, but nothing is stepped, because
 * moving one item of several would charge an amount nobody was shown.
 */
function planItem(sub: Stripe.Subscription): {
  period: Stripe.SubscriptionItem | null;
  step: Stripe.SubscriptionItem | null;
} {
  const items = sub.items?.data ?? [];
  if (items.length !== 1) {
    console.error(`billing: ${sub.id} has ${items.length} items; the ladder steps only one`);
  }
  return { period: items[0] ?? null, step: items.length === 1 ? items[0] : null };
}

// ---------------------------------------------------------------------
// Sync

interface Synced {
  userId: string;
  customerId: string;
  subscription: Stripe.Subscription | null;
  billing: BillingRow;
  premium: boolean;
  /** The rung step failed; everything else was written. */
  stepError: unknown;
}

/** Who a Stripe customer is; null (logged) when nobody we know. */
async function userForCustomer(
  deps: BillingDeps,
  customerId: string
): Promise<string | null> {
  const row = await billingBy(deps.db, "stripe_customer_id", customerId);
  if (row) return row.user_id;

  let claimed: string | null = null;
  try {
    const customer = await deps.stripe.customers.retrieve(customerId);
    claimed = "metadata" in customer ? customer.metadata?.user_id?.trim() || null : null;
  } catch (e) {
    if ((e as { code?: string })?.code !== "resource_missing") throw e;
  }
  if (!claimed) {
    console.error(`billing: customer ${customerId} names no user; not synced`);
    return null;
  }
  // Another product on the same Stripe account may keep its own kind of
  // user id here. Postgres would refuse it as a uuid, and the webhook
  // would answer 500 for days over a customer that was never ours.
  if (!USER_ID.test(claimed)) {
    console.error(
      `billing: customer ${customerId} names user ${JSON.stringify(claimed)}, not an Ethos id; not synced`
    );
    return null;
  }
  const theirs = await billingBy(deps.db, "user_id", claimed);
  if (theirs && theirs.stripe_customer_id !== customerId) {
    console.error(
      `billing: customer ${customerId} claims user ${claimed}, who is on ${theirs.stripe_customer_id}; not synced`
    );
    return null;
  }
  return claimed;
}

/**
 * Premium on the profile. A paid plan writes premium with source
 * 'stripe' and a backstop expiry; an ended one clears ONLY a premium
 * this module wrote. A premium given by code is never touched.
 * Returns the account's premium afterwards.
 */
async function writeEntitlement(
  db: SupabaseClient,
  userId: string,
  entitled: boolean,
  paidUntil: Date | null,
  now: Date
): Promise<boolean> {
  const { data, error } = await db
    .from("profiles")
    .select("premium, premium_until, premium_source")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile read failed: ${error.message}`);
  const profile = data as {
    premium: boolean | null;
    premium_until: string | null;
    premium_source: string | null;
  } | null;
  // A premium this module did not write, still running. A code's premium
  // has no end; one that somehow ran out is no reason to withhold a paid one.
  const given =
    Boolean(profile?.premium) &&
    profile?.premium_source !== "stripe" &&
    (!profile?.premium_until || new Date(profile.premium_until) > now);

  if (entitled) {
    if (given) return true;
    const until = new Date((paidUntil ?? now).getTime() + BACKSTOP_MS);
    const { error: writeError } = await db.from("profiles").upsert(
      {
        user_id: userId,
        premium: true,
        premium_source: "stripe",
        premium_until: until.toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (writeError) throw new Error(`premium write failed: ${writeError.message}`);
    return true;
  }

  if (profile?.premium_source === "stripe") {
    const { error: clearError } = await db
      .from("profiles")
      .update({ premium: false, premium_until: null, premium_source: null })
      .eq("user_id", userId)
      .eq("premium_source", "stripe");
    if (clearError) throw new Error(`premium clear failed: ${clearError.message}`);
    return false;
  }
  return given;
}

/**
 * Move a live plan's item to the rung for month + 1. Null when it is
 * already there. Never moves it down: paid months only ever grow, so an
 * item on a later rung means this sync read Stripe before a newer one
 * did, and stepping back would charge more than the ladder promised.
 */
async function stepRung(
  stripe: Stripe,
  sub: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
  months: number
): Promise<Stripe.Subscription | null> {
  const next = rungFor(await ladderPrices(stripe), months + 1);
  if (item.price.id === next.id) return null;
  const at = monthForLookupKey(item.price.lookup_key);
  if (at !== null && rungIndex(at) > rungIndex(months + 1)) {
    console.error(
      `billing: ${sub.id} is on month ${at}'s price with ${months} paid; left there, never stepped back`
    );
    return null;
  }
  return stripe.subscriptions.update(
    sub.id,
    { items: [{ id: item.id, price: next.id }], proration_behavior: "none" },
    { idempotencyKey: `ethos-ladder-${sub.id}-${months + 1}` }
  );
}

async function syncInner(
  deps: BillingDeps,
  customerId: string
): Promise<Synced | null> {
  const { stripe, db } = deps;
  const now = deps.now?.() ?? new Date();

  const userId = await userForCustomer(deps, customerId);
  if (!userId) return null;

  const subs = (
    await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })
  ).data;
  const plan = await currentPlan(stripe, customerId, subs);
  const sub = plan?.sub ?? null;
  const months = plan?.months ?? 0;
  const status = sub?.status ?? null;
  const live = isLive(status);
  const { period, step } = sub ? planItem(sub) : { period: null, step: null };

  const ending = Boolean(live && sub && (sub.cancel_at_period_end || sub.cancel_at != null));
  // The day the paid time runs to: the period's end, or an earlier
  // cancel_at date when one is set. A plan that ended reads the day it
  // ended: one whose retries ran out had already rolled into a month
  // nobody paid for, and that month's end is no date to show anyone.
  let paidToS = period?.current_period_end ?? null;
  if (ending && sub?.cancel_at != null && (paidToS == null || sub.cancel_at < paidToS)) {
    paidToS = sub.cancel_at;
  }
  if (sub && ENDED_STATUSES.includes(sub.status) && sub.ended_at != null) {
    paidToS = sub.ended_at;
  }
  const paidTo = paidToS != null ? new Date(paidToS * 1000) : null;

  const billing: BillingRow = {
    status,
    ladder_month: months,
    price_cents: months >= 1 ? priceForMonth(months) : null,
    next_price_cents: live && !ending ? priceForMonth(months + 1) : null,
    current_period_end: paidTo ? paidTo.toISOString() : null,
    cancel_at_period_end: ending,
  };

  const { error } = await db.from("billing").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub?.id ?? null,
      ...billing,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      console.error(`billing: user ${userId} no longer exists; ${customerId} not synced`);
      return null;
    }
    throw new Error(`billing write failed: ${error.message}`);
  }

  const premium = await writeEntitlement(db, userId, isEntitled(status), paidTo, now);

  let subscription = sub;
  let stepError: unknown = null;
  if (sub && step && live && months >= 1) {
    try {
      subscription = (await stepRung(stripe, sub, step, months)) ?? sub;
    } catch (e) {
      stepError = e;
    }
  }
  // When the plan is not on its rung after all (the step failed, or the
  // plan is not one the ladder steps), say what the next renewal will
  // really charge, never the rung it missed.
  if (subscription && billing.next_price_cents != null) {
    const real = renewalCents(subscription);
    if (real !== billing.next_price_cents) {
      billing.next_price_cents = real;
      const { error: fixError } = await db
        .from("billing")
        .update({ next_price_cents: real })
        .eq("user_id", userId);
      if (fixError) throw new Error(`billing write failed: ${fixError.message}`);
    }
  }

  return { userId, customerId, subscription, billing, premium, stepError };
}

/** What the plan's next renewal charges as Stripe has it: every item, at its quantity. */
function renewalCents(sub: Stripe.Subscription): number | null {
  let total = 0;
  for (const item of sub.items?.data ?? []) {
    if (item.price?.unit_amount == null) return null;
    total += item.price.unit_amount * (item.quantity ?? 1);
  }
  return total;
}

/**
 * THE sync. Every webhook event lands here. Throws when anything fails,
 * the rung step included, so Stripe retries the event; returns null
 * (logged, never thrown) for a customer that is nobody we know.
 */
export async function syncCustomer(
  deps: BillingDeps,
  customerId: string
): Promise<SyncResult | null> {
  const synced = await syncInner(deps, customerId);
  if (!synced) return null;
  if (synced.stepError) throw synced.stepError;
  return { billing: synced.billing, premium: synced.premium };
}

/** The same sync for a person's own request: a failed step is logged, not theirs to see. */
async function syncForRoute(
  deps: BillingDeps,
  customerId: string
): Promise<Synced | null> {
  const synced = await syncInner(deps, customerId);
  if (synced?.stepError) {
    console.error(`billing: rung step failed for ${customerId}`, explain(synced.stepError));
  }
  return synced;
}

/** The profile's premium alone, for an account with no billing row. */
async function storedPremium(
  db: SupabaseClient,
  userId: string,
  now: Date
): Promise<boolean> {
  const { data, error } = await db
    .from("profiles")
    .select("premium, premium_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile read failed: ${error.message}`);
  const profile = data as { premium: boolean | null; premium_until: string | null } | null;
  if (!profile?.premium) return false;
  return !profile.premium_until || new Date(profile.premium_until) > now;
}

/** Sync the account behind a user id. No billing row: nothing to ask Stripe. */
export async function syncUser(deps: BillingDeps, userId: string): Promise<SyncResult> {
  const now = deps.now?.() ?? new Date();
  const row = await billingBy(deps.db, "user_id", userId);
  if (!row) return { billing: null, premium: await storedPremium(deps.db, userId, now) };
  const synced = await syncForRoute(deps, row.stripe_customer_id);
  if (!synced) return { billing: publicRow(row), premium: await storedPremium(deps.db, userId, now) };
  return { billing: synced.billing, premium: synced.premium };
}

/** The account's plan, synced; 404 when it has none. */
async function syncedPlan(
  deps: BillingDeps,
  userId: string
): Promise<Synced & { subscription: Stripe.Subscription }> {
  const row = await billingBy(deps.db, "user_id", userId);
  if (!row) throw new BillingError(404, NO_PLAN);
  const synced = await syncForRoute(deps, row.stripe_customer_id);
  const sub = synced?.subscription;
  // A first payment still pending, or one that never came, never started a plan.
  if (!synced || !sub || NEVER_STARTED.includes(sub.status)) {
    throw new BillingError(404, NO_PLAN);
  }
  return { ...synced, subscription: sub };
}

// ---------------------------------------------------------------------
// Cancel and resume

/**
 * Cancel at the end of the paid month: Premium runs until then, and the
 * plan keeps its place on the ladder until the cancel takes effect.
 */
export async function cancelPlan(deps: BillingDeps, userId: string): Promise<SyncResult> {
  const synced = await syncedPlan(deps, userId);
  const sub = synced.subscription;
  if (!isLive(sub.status)) throw new BillingError(409, ENDED);
  if (synced.billing.cancel_at_period_end) throw new BillingError(409, ALREADY_ENDING);

  await deps.stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  const after = await syncForRoute(deps, synced.customerId);
  return after
    ? { billing: after.billing, premium: after.premium }
    : { billing: synced.billing, premium: synced.premium };
}

/**
 * Undo a pending cancel. The plan never ended, so it keeps its month
 * and its next price. A plan that already ended cannot come back: a new
 * one starts at month 1 through checkout.
 */
export async function resumePlan(deps: BillingDeps, userId: string): Promise<SyncResult> {
  const synced = await syncedPlan(deps, userId);
  const sub = synced.subscription;
  if (!isLive(sub.status)) throw new BillingError(409, ENDED);
  if (!synced.billing.cancel_at_period_end) {
    return { billing: synced.billing, premium: synced.premium };
  }

  const updated = await deps.stripe.subscriptions.update(
    sub.id,
    sub.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: "" }
  );
  // A cancel_at date can outlive the flag; clear it too.
  if (updated.cancel_at != null) {
    await deps.stripe.subscriptions.update(sub.id, { cancel_at: "" });
  }
  const after = await syncForRoute(deps, synced.customerId);
  return after
    ? { billing: after.billing, premium: after.premium }
    : { billing: synced.billing, premium: synced.premium };
}

// ---------------------------------------------------------------------
// Checkout and the portal

/**
 * The words above Checkout's pay button: the whole ladder, the renewal
 * and the reset rule, before anyone pays (Australian Consumer Law).
 * Built from LADDER_CENTS so it can never disagree with the charge.
 */
export function checkoutDisclosure(): string {
  const [first, ...rest] = LADDER_CENTS.map(formatAud);
  const floor = rest[rest.length - 1];
  const between = rest.slice(0, -1).join(", ");
  return (
    `Renews monthly until you cancel. ${first} for the first month, then a dollar less ` +
    `each month you stay: ${between}, and ${floor} from month ${FLOOR_MONTH} on. ` +
    `Cancel any time and Premium runs to the end of the month you paid for. ` +
    `If your plan ends, a new one starts again at ${first}. ` +
    `A declined card keeps your place while we retry.`
  );
}

/** A Checkout Session for a NEW plan on month 1's price. Returns its URL. */
export async function createCheckout(
  deps: BillingDeps,
  opts: { userId: string; email: string | null; site: string; returnTo: string }
): Promise<string> {
  // Verify the ladder before anything is made, so a wrong price stops here.
  const first = rungFor(await ladderPrices(deps.stripe), 1);
  const customer = await ensureCustomer(deps, opts.userId, opts.email);
  const session = await deps.stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: first.id, quantity: 1 }],
    client_reference_id: opts.userId,
    metadata: { user_id: opts.userId },
    subscription_data: { metadata: { user_id: opts.userId } },
    success_url: `${opts.site}/you?checkout=done`,
    cancel_url: `${opts.site}${opts.returnTo}`,
    allow_promotion_codes: false,
    // Everyone pays the A$ amount the paywall and the text below show,
    // never Stripe's conversion of it into another currency.
    adaptive_pricing: { enabled: false },
    custom_text: { submit: { message: checkoutDisclosure() } },
  });
  if (!session.url) throw new Error(`checkout session ${session.id} came back without a url`);
  return session.url;
}

/** A customer portal session: card, invoices, cancel. Returns its URL. */
export async function openPortal(
  deps: BillingDeps,
  opts: { userId: string; site: string; returnTo: string; configuration?: string | null }
): Promise<string> {
  const row = await billingBy(deps.db, "user_id", opts.userId);
  if (!row) throw new BillingError(404, NO_PLAN);
  if (!row.stripe_subscription_id) {
    // Back from checkout before the webhook landed: ask Stripe.
    const synced = await syncForRoute(deps, row.stripe_customer_id);
    if (!synced?.subscription) throw new BillingError(404, NO_PLAN);
  }
  const session = await deps.stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${opts.site}${opts.returnTo}`,
    ...(opts.configuration ? { configuration: opts.configuration } : {}),
  });
  return session.url;
}

/**
 * Account deletion: every plan that has not ended, cancelled now, so a
 * deleted account is never charged again. Returns how many it ended.
 */
export async function endEveryPlan(stripe: Stripe, customerId: string): Promise<number> {
  let ended = 0;
  let after: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    for (const sub of page.data) {
      if (ENDED_STATUSES.includes(sub.status)) continue;
      await stripe.subscriptions.cancel(sub.id);
      ended++;
    }
    const last = page.data[page.data.length - 1];
    if (!page.has_more || !last) return ended;
    after = last.id;
  }
}

// ---------------------------------------------------------------------
// HTTP: shared by the /api/billing routes

/** The customer id on a webhook event's object, whatever its type. */
export function customerIdOf(object: unknown): string | null {
  const customer = (object as { customer?: unknown } | null)?.customer;
  if (typeof customer === "string") return customer || null;
  const id = (customer as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : null;
}

/** NEXT_PUBLIC_SITE_URL, else the origin the request came to. */
export function siteFrom(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

/** A same-origin path to come back to, or /you. Never another host. */
export function safeReturnPath(raw: unknown): string {
  const fallback = "/you";
  if (typeof raw !== "string") return fallback;
  const path = raw.trim();
  if (
    path.length === 0 ||
    path.length > 512 ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(path)
  ) {
    return fallback;
  }
  try {
    const base = "https://ethos.invalid";
    const url = new URL(path, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function explain(e: unknown): string {
  if (e instanceof BillingError) return `${e.message}${e.detail ? ` (${e.detail})` : ""}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export type Guarded =
  | { ok: true; auth: AuthedUser; deps: BillingDeps }
  | { ok: false; res: NextResponse };

/**
 * The front door of every billing route but the webhook, in order:
 * 401 no session, 503 billing off, 403 an anonymous session where a
 * real account is needed, 429 too many tries (when `rate` names the
 * route's limiter key; real accounts get the user tier).
 */
export async function guardBillingRoute(
  req: Request,
  opts: { rate?: string; offMessage?: string; needsAccount?: boolean }
): Promise<Guarded> {
  const auth = await getUserFromAuthHeader(req.headers.get("authorization")).catch(
    () => null
  );
  if (!auth) {
    return { ok: false, res: jsonError(401, "That session has expired. Sign in and try again.") };
  }

  const stripe = stripeClient();
  const db = supabaseAdmin();
  if (!billingConfigured() || !stripe) {
    return {
      ok: false,
      res: jsonError(503, opts.offMessage ?? "Billing isn't switched on for this server."),
    };
  }
  if (!db) {
    return { ok: false, res: jsonError(503, "Accounts aren't configured on this server.") };
  }

  if (opts.needsAccount && auth.anonymous) {
    return {
      ok: false,
      res: jsonError(403, "Premium needs an account. Make one and everything you've practised stays.", {
        needsAccount: true,
      }),
    };
  }

  const verdict = opts.rate
    ? await consumeRateLimit(`${opts.rate}:u:${auth.id}`, auth.anonymous ? "anon" : "user")
    : null;
  if (verdict && !verdict.allowed) {
    return {
      ok: false,
      res: jsonError(
        429,
        verdict.window === "day"
          ? "That's the limit for today. Try again tomorrow."
          : "Too many tries. Give it an hour.",
        { retryAfterS: verdict.retryAfterS }
      ),
    };
  }

  return { ok: true, auth, deps: { stripe, db } };
}

/** A failed billing call as the person reads it; the detail goes to the log. */
export function billingFailure(e: unknown, fallback: string): NextResponse {
  if (e instanceof BillingError) {
    if (e.status === 502) console.error("billing:", explain(e));
    return jsonError(e.status, e.message);
  }
  console.error("billing:", explain(e));
  return jsonError(502, fallback);
}
