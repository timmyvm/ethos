/**
 * Test doubles for lib/billing.ts, used by lib/billing*.test.ts only.
 *
 * `fakeStripe()` keeps prices, customers, subscriptions and invoices in
 * memory and answers the handful of calls billing makes, with the
 * shapes stripe@22.6.2's types give them (a period on the item, an
 * invoice's subscription under `parent.subscription_details`). Its
 * `sim` side plays Stripe's own clock: a plan starting through
 * Checkout, a renewal paid or declined, retries running out, a cancel
 * taking effect. Webhook signing is the real SDK's.
 *
 * `fakeDb()` is a Supabase client over in-memory tables with the
 * constraints billing leans on: unique keys (23505), the foreign key to
 * auth users (23503), and the cascade when a user is deleted.
 *
 * Nothing here touches a network.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { LADDER_CENTS, LOOKUP_KEYS } from "./pricing";

const DAY_S = 86_400;
const MONTH_S = 30 * DAY_S;

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------
// Stripe

export interface FakePrice {
  id: string;
  object: "price";
  active: boolean;
  currency: string;
  unit_amount: number | null;
  lookup_key: string | null;
  type: string;
  recurring: { interval: string; interval_count: number; usage_type: string } | null;
  billing_scheme: string;
  tax_behavior: string | null;
  transform_quantity: { divide_by: number; round: string } | null;
  product: string;
  /**
   * Prices in other currencies, beside `currency`. Like Stripe, a list
   * returns the field only when asked to expand it, and then the map
   * holds the price's own currency too.
   */
  currency_options?: Record<string, { unit_amount: number | null; tax_behavior: string | null }>;
}

interface FakeItem {
  id: string;
  object: "subscription_item";
  subscription: string;
  price: FakePrice;
  current_period_start: number;
  current_period_end: number;
}

export interface FakeSubscription {
  id: string;
  object: "subscription";
  customer: string;
  status: string;
  created: number;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  ended_at: number | null;
  metadata: Record<string, string>;
  items: { object: "list"; data: FakeItem[]; has_more: boolean; url: string };
}

export interface FakeInvoice {
  id: string;
  object: "invoice";
  customer: string;
  status: string;
  billing_reason: string;
  created: number;
  amount_due: number;
  amount_paid: number;
  parent: {
    type: "subscription_details";
    quote_details: null;
    subscription_details: { subscription: string; metadata: null };
  };
}

export interface FakeSession {
  id: string;
  object: "checkout.session";
  customer: string | null;
  status: "open" | "complete" | "expired";
  expires_at: number;
  url: string;
}

interface FakeCustomer {
  id: string;
  object: "customer";
  email: string | null;
  metadata: Record<string, string>;
  deleted?: true;
}

interface Call {
  method: string;
  args: unknown[];
}

/** The seven rungs exactly as scripts/stripe-setup.mjs makes them. */
export function ladderPriceBook(): FakePrice[] {
  return LADDER_CENTS.map((cents, i) => ({
    id: `price_m${i + 1}`,
    object: "price",
    active: true,
    currency: "aud",
    unit_amount: cents,
    lookup_key: LOOKUP_KEYS[i],
    type: "recurring",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    billing_scheme: "per_unit",
    tax_behavior: "inclusive",
    transform_quantity: null,
    product: "prod_ethos",
  }));
}

/** A Stripe API error the way the SDK raises one. */
export class FakeStripeError extends Error {
  readonly type = "StripeInvalidRequestError";
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
    readonly param?: string
  ) {
    super(message);
  }
}

interface ListParams {
  limit?: number;
  starting_after?: string;
}

export function fakeStripe() {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${String(++seq).padStart(4, "0")}`;

  const state = {
    /** Unix seconds; the simulation moves it, billing reads it through deps.now. */
    clock: 1_790_000_000,
    priceBook: ladderPriceBook(),
    customers: new Map<string, FakeCustomer>(),
    subs: [] as FakeSubscription[],
    invoices: [] as FakeInvoice[],
    sessions: [] as FakeSession[],
    calls: [] as Call[],
    idempotent: new Map<string, unknown>(),
    /** Throw this from the named method once. */
    fail: {} as Record<string, Error | undefined>,
  };

  function record(method: string, args: unknown[]): void {
    state.calls.push({ method, args: clone(args) });
    const failure = state.fail[method];
    if (failure) {
      delete state.fail[method];
      throw failure;
    }
  }

  function page<T extends { id: string }>(rows: T[], params: ListParams) {
    const start = params.starting_after
      ? rows.findIndex((r) => r.id === params.starting_after) + 1
      : 0;
    const limit = params.limit ?? 10;
    return {
      object: "list" as const,
      data: clone(rows.slice(start, start + limit)),
      has_more: start + limit < rows.length,
      url: "/v1/fake",
    };
  }

  function once<T>(opts: { idempotencyKey?: string } | undefined, run: () => T): T {
    const key = opts?.idempotencyKey;
    if (!key) return run();
    if (state.idempotent.has(key)) return clone(state.idempotent.get(key) as T);
    const out = run();
    state.idempotent.set(key, clone(out));
    return out;
  }

  /**
   * A customer this key can see. Stripe answers resource_missing for one
   * it can't: made in the other mode, or never made. A deleted customer
   * still lists its (cancelled) subscriptions and invoices, but nothing
   * new can be made on it.
   */
  function seeCustomer(id: string | undefined, opts: { making?: boolean } = {}): void {
    if (!id) return;
    const found = state.customers.get(id);
    if (!found || (opts.making && found.deleted)) {
      throw new FakeStripeError("resource_missing", `No such customer: '${id}'`, 400, "customer");
    }
  }

  function sub(id: string): FakeSubscription {
    const found = state.subs.find((s) => s.id === id);
    if (!found) throw new FakeStripeError("resource_missing", `No such subscription: ${id}`, 404);
    return found;
  }

  function session(id: string): FakeSession {
    const found = state.sessions.find((cs) => cs.id === id);
    if (!found) throw new FakeStripeError("resource_missing", `No such checkout.session: ${id}`, 404);
    return found;
  }

  function price(id: string): FakePrice {
    const found = state.priceBook.find((p) => p.id === id);
    if (!found) throw new FakeStripeError("resource_missing", `No such price: ${id}`, 404);
    return found;
  }

  function newestFirst<T extends { created: number; id: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => b.created - a.created || (b.id < a.id ? -1 : 1));
  }

  function invoice(
    s: FakeSubscription,
    reason: string,
    status: "paid" | "open"
  ): FakeInvoice {
    const amount = s.items.data[0]?.price.unit_amount ?? 0;
    const inv: FakeInvoice = {
      id: nextId("in"),
      object: "invoice",
      customer: s.customer,
      status,
      billing_reason: reason,
      created: state.clock,
      amount_due: amount,
      amount_paid: status === "paid" ? amount : 0,
      parent: {
        type: "subscription_details",
        quote_details: null,
        subscription_details: { subscription: s.id, metadata: null },
      },
    };
    state.invoices.push(inv);
    return inv;
  }

  const api = {
    webhooks: Stripe.webhooks,

    prices: {
      async list(
        params: ListParams & { lookup_keys?: string[]; active?: boolean; expand?: string[] }
      ) {
        record("prices.list", [params]);
        const expanded = params.expand?.includes("data.currency_options") ?? false;
        const rows = state.priceBook
          .filter(
            (p) =>
              (!params.lookup_keys ||
                (p.lookup_key !== null && params.lookup_keys.includes(p.lookup_key))) &&
              (params.active === undefined || p.active === params.active)
          )
          .map((p) => {
            const { currency_options: extra, ...rest } = p;
            return expanded
              ? {
                  ...rest,
                  currency_options: {
                    [p.currency]: { unit_amount: p.unit_amount, tax_behavior: p.tax_behavior },
                    ...extra,
                  },
                }
              : rest;
          });
        return page(rows, params);
      },
    },

    customers: {
      async create(
        params: { email?: string; metadata?: Record<string, string> },
        opts?: { idempotencyKey?: string }
      ) {
        record("customers.create", [params, opts]);
        return once(opts, () => {
          const customer: FakeCustomer = {
            id: nextId("cus"),
            object: "customer",
            email: params.email ?? null,
            metadata: { ...params.metadata },
          };
          state.customers.set(customer.id, customer);
          return clone(customer);
        });
      },
      async retrieve(id: string) {
        record("customers.retrieve", [id]);
        const found = state.customers.get(id);
        if (!found) throw new FakeStripeError("resource_missing", `No such customer: ${id}`, 404);
        return found.deleted
          ? { id, object: "customer" as const, deleted: true as const }
          : clone(found);
      },
      /**
       * Like Stripe: the customer goes (a retrieve says deleted), every
       * plan on it still running is cancelled at once, and its invoices
       * stay listed. Deleting one already deleted is "No such customer".
       */
      async del(id: string) {
        record("customers.del", [id]);
        const found = state.customers.get(id);
        if (!found || found.deleted) {
          throw new FakeStripeError("resource_missing", `No such customer: '${id}'`, 404, "id");
        }
        sim.deleteCustomer(id);
        return { id, object: "customer" as const, deleted: true as const };
      },
    },

    subscriptions: {
      async list(params: ListParams & { customer?: string; status?: string }) {
        record("subscriptions.list", [params]);
        seeCustomer(params.customer);
        const rows = newestFirst(state.subs).filter(
          (s) =>
            (!params.customer || s.customer === params.customer) &&
            (params.status === "all" ||
              (params.status ? s.status === params.status : s.status !== "canceled"))
        );
        return page(rows, params);
      },
      async retrieve(id: string) {
        record("subscriptions.retrieve", [id]);
        return clone(sub(id));
      },
      async update(
        id: string,
        params: {
          items?: { id?: string; price?: string }[];
          proration_behavior?: string;
          cancel_at_period_end?: boolean;
          cancel_at?: number | "";
        },
        opts?: { idempotencyKey?: string }
      ) {
        record("subscriptions.update", [id, params, opts]);
        return once(opts, () => {
          const s = sub(id);
          if (s.status === "canceled" || s.status === "incomplete_expired") {
            throw new FakeStripeError(
              "resource_missing",
              "A canceled subscription can only update its metadata."
            );
          }
          for (const change of params.items ?? []) {
            const item = s.items.data.find((i) => i.id === change.id);
            if (!item) throw new FakeStripeError("resource_missing", `No such item: ${change.id}`);
            if (change.price) item.price = clone(price(change.price));
          }
          if (params.cancel_at_period_end === true) {
            s.cancel_at_period_end = true;
            // The current API sets cancel_at to the period's end as well.
            s.cancel_at = s.items.data[0]?.current_period_end ?? null;
          } else if (params.cancel_at_period_end === false) {
            s.cancel_at_period_end = false;
            s.cancel_at = null;
          }
          if (params.cancel_at === "") s.cancel_at = null;
          else if (typeof params.cancel_at === "number") s.cancel_at = params.cancel_at;
          return clone(s);
        });
      },
      async cancel(id: string) {
        record("subscriptions.cancel", [id]);
        const s = sub(id);
        s.status = "canceled";
        s.ended_at = state.clock;
        return clone(s);
      },
    },

    invoices: {
      async list(
        params: ListParams & { subscription?: string; customer?: string; status?: string }
      ) {
        record("invoices.list", [params]);
        seeCustomer(params.customer);
        const rows = newestFirst(state.invoices).filter(
          (inv) =>
            (!params.subscription ||
              inv.parent.subscription_details.subscription === params.subscription) &&
            (!params.customer || inv.customer === params.customer) &&
            (!params.status || inv.status === params.status)
        );
        return page(rows, params);
      },
      async voidInvoice(id: string, params?: unknown, opts?: { idempotencyKey?: string }) {
        record("invoices.voidInvoice", [id, params ?? {}, opts]);
        return once(opts, () => {
          const inv = state.invoices.find((i) => i.id === id);
          if (!inv) throw new FakeStripeError("resource_missing", `No such invoice: ${id}`, 404);
          if (inv.status !== "open" && inv.status !== "uncollectible") {
            throw new FakeStripeError("invoice_not_open", `A ${inv.status} invoice can't be voided.`);
          }
          inv.status = "void";
          return clone(inv);
        });
      },
    },

    checkout: {
      sessions: {
        async create(params: Record<string, unknown>) {
          record("checkout.sessions.create", [params]);
          seeCustomer(params.customer as string | undefined, { making: true });
          const id = nextId("cs_test");
          const made: FakeSession = {
            id,
            object: "checkout.session",
            customer: typeof params.customer === "string" ? params.customer : null,
            status: "open",
            // Stripe's default is 24 hours after creation.
            expires_at: typeof params.expires_at === "number" ? params.expires_at : state.clock + DAY_S,
            url: `https://checkout.stripe.test/c/pay/${id}`,
          };
          state.sessions.push(made);
          return clone(made);
        },
        async list(params: ListParams & { customer?: string; status?: string }) {
          record("checkout.sessions.list", [params]);
          seeCustomer(params.customer);
          const rows = [...state.sessions]
            .reverse()
            .filter(
              (cs) =>
                (!params.customer || cs.customer === params.customer) &&
                (!params.status || cs.status === params.status)
            );
          return page(rows, params);
        },
        async retrieve(id: string) {
          record("checkout.sessions.retrieve", [id]);
          return clone(session(id));
        },
        async expire(id: string) {
          record("checkout.sessions.expire", [id]);
          const cs = session(id);
          if (cs.status !== "open") {
            throw new FakeStripeError(
              "checkout_session_not_open",
              `Only an open Checkout Session can be expired; this one is ${cs.status}.`
            );
          }
          cs.status = "expired";
          return clone(cs);
        },
      },
    },

    billingPortal: {
      sessions: {
        async create(params: Record<string, unknown>) {
          record("billingPortal.sessions.create", [params]);
          seeCustomer(params.customer as string | undefined, { making: true });
          const id = nextId("bps");
          return { id, object: "billing_portal.session", url: `https://billing.stripe.test/p/session/${id}` };
        },
      },
    },
  };

  /** Stripe's side of the world, moved by the test. */
  const sim = {
    advance(seconds: number) {
      state.clock += seconds;
    },

    customer(userId: string | null, email: string | null = null): string {
      const customer: FakeCustomer = {
        id: nextId("cus"),
        object: "customer",
        email,
        metadata: userId ? { user_id: userId } : {},
      };
      state.customers.set(customer.id, customer);
      return customer.id;
    },

    /**
     * The server's key moved to the other mode (test to live): this
     * customer, and everything on it, is out of its sight.
     */
    otherMode(customerId: string): void {
      state.customers.delete(customerId);
    },

    /** Deleted in the dashboard: Stripe cancels its plans at once. */
    deleteCustomer(customerId: string): void {
      const found = state.customers.get(customerId);
      if (!found) throw new Error(`no customer ${customerId}`);
      found.deleted = true;
      for (const s of state.subs) {
        if (s.customer === customerId && s.status !== "canceled" && s.status !== "incomplete_expired") {
          s.status = "canceled";
          s.ended_at = state.clock;
        }
      }
    },

    /** Checkout completes: a new plan on month 1's price, its first month paid. */
    startPlan(customerId: string, opts: { firstPaid?: boolean } = {}): string {
      sim.advance(60);
      const id = nextId("sub");
      const s: FakeSubscription = {
        id,
        object: "subscription",
        customer: customerId,
        status: opts.firstPaid === false ? "incomplete" : "active",
        created: state.clock,
        cancel_at_period_end: false,
        cancel_at: null,
        ended_at: null,
        metadata: {},
        items: {
          object: "list",
          has_more: false,
          url: `/v1/subscription_items?subscription=${id}`,
          data: [
            {
              id: nextId("si"),
              object: "subscription_item",
              subscription: id,
              price: clone(state.priceBook[0]),
              current_period_start: state.clock,
              current_period_end: state.clock + MONTH_S,
            },
          ],
        },
      };
      state.subs.push(s);
      invoice(s, "subscription_create", opts.firstPaid === false ? "open" : "paid");
      return id;
    },

    /**
     * The period ends. A plan set to end ends; otherwise a renewal is
     * invoiced at the item's price as it stands, paid or declined.
     * Returns what was charged (0 when nothing was).
     */
    renew(subId: string, opts: { paid?: boolean } = {}): number {
      const s = sub(subId);
      // An ended plan never renews.
      if (s.status === "canceled" || s.status === "incomplete_expired") return 0;
      const item = s.items.data[0];
      state.clock = item.current_period_end;
      if (s.cancel_at_period_end || (s.cancel_at !== null && s.cancel_at <= state.clock)) {
        s.status = "canceled";
        s.ended_at = state.clock;
        return 0;
      }
      item.current_period_start = item.current_period_end;
      item.current_period_end += MONTH_S;
      const paid = opts.paid !== false;
      const inv = invoice(s, "subscription_cycle", paid ? "paid" : "open");
      s.status = paid ? "active" : "past_due";
      return paid ? inv.amount_paid : 0;
    },

    /**
     * The person pays on a Checkout page: a plan starts on its customer.
     * An expired (or already paid) session shows Stripe's expired page.
     */
    completeSession(sessionId: string, opts: { firstPaid?: boolean } = {}): string {
      const cs = session(sessionId);
      if (cs.status !== "open" || cs.expires_at <= state.clock) {
        throw new Error(`checkout session ${sessionId} is ${cs.status}; it can't be paid`);
      }
      if (!cs.customer) throw new Error(`checkout session ${sessionId} has no customer`);
      cs.status = "complete";
      return sim.startPlan(cs.customer, opts);
    },

    /**
     * The open renewal is paid: a retry succeeds, or the person pays it
     * from the email's link or the portal. An ended plan stays ended.
     */
    payOpen(subId: string): number {
      const inv = newestFirst(state.invoices).find(
        (i) =>
          i.parent.subscription_details.subscription === subId &&
          (i.status === "open" || i.status === "uncollectible")
      );
      if (!inv) throw new Error(`no open invoice on ${subId}`);
      inv.status = "paid";
      inv.amount_paid = inv.amount_due;
      const s = sub(subId);
      if (s.status !== "canceled" && s.status !== "incomplete_expired") s.status = "active";
      return inv.amount_paid;
    },

    /**
     * Smart Retries give up and the plan is cancelled (the dashboard
     * setting). Like Stripe, the declined renewal is left open: still
     * payable from its email link or the portal's invoice history.
     */
    retriesRunOut(subId: string): void {
      const s = sub(subId);
      s.status = "canceled";
      s.ended_at = state.clock;
    },

    /** Add an invoice by hand, for counting tests. */
    invoice(subId: string, reason: string, status: "paid" | "open"): void {
      sim.advance(1);
      invoice(sub(subId), reason, status);
    },

    /** What each paid invoice for a month of this plan charged, oldest first. */
    charges(subId: string): number[] {
      return state.invoices
        .filter(
          (i) =>
            i.parent.subscription_details.subscription === subId &&
            i.status === "paid" &&
            (i.billing_reason === "subscription_create" ||
              i.billing_reason === "subscription_cycle")
        )
        .map((i) => i.amount_paid);
    },

    sub(subId: string): FakeSubscription {
      return sub(subId);
    },

    itemPrice(subId: string): string {
      return sub(subId).items.data[0].price.id;
    },

    callsTo(method: string): Call[] {
      return state.calls.filter((c) => c.method === method);
    },

    /** Calls that change something in Stripe. */
    writes(): Call[] {
      return state.calls.filter((c) =>
        /\.(create|update|cancel|expire|voidInvoice|del)$/.test(c.method)
      );
    },
  };

  return {
    state,
    sim,
    api,
    asStripe(): Stripe {
      return api as unknown as Stripe;
    },
    now(): Date {
      return new Date(state.clock * 1000);
    },
  };
}

export type FakeStripe = ReturnType<typeof fakeStripe>;

// ---------------------------------------------------------------------
// Supabase

type Row = Record<string, unknown>;

interface DbError {
  code: string;
  message: string;
}

interface Result {
  data: unknown;
  error: DbError | null;
}

const UNIQUE: Record<string, string[]> = {
  billing: ["user_id", "stripe_customer_id"],
  profiles: ["user_id"],
  testers: ["user_id"],
};

/** Tables whose user_id references auth.users on delete cascade (testers: 0020). */
const OWNED = ["billing", "profiles", "reps", "testers", "tester_feedback"];

/** Columns typed uuid: Postgres refuses to compare one with anything else (22P02). */
const UUID_COLUMNS: Record<string, string[]> = {
  billing: ["user_id"],
  profiles: ["user_id"],
  reps: ["user_id"],
  testers: ["user_id"],
  tester_feedback: ["user_id"],
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULTS: Record<string, Row> = {
  billing: {
    stripe_subscription_id: null,
    status: null,
    ladder_month: 0,
    price_cents: null,
    next_price_cents: null,
    current_period_end: null,
    cancel_at_period_end: false,
  },
  profiles: { premium: false, premium_until: null, premium_source: null },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fakeDb(users: string[]) {
  const state = {
    users: new Set(users),
    tables: { billing: [], profiles: [], reps: [], rate_limits: [] } as Record<string, Row[]>,
    removedAudio: [] as string[],
    /** Every playback link the server signed (app/api/audio). */
    signed: [] as { path: string; expiresIn: number }[],
    deletedUsers: [] as string[],
    /** Fail the next `op` on `table` with this error. */
    fail: [] as { table: string; op: string; error: DbError }[],
    log: [] as { table: string; op: string }[],
  };

  function rows(table: string): Row[] {
    return (state.tables[table] ??= []);
  }

  function failure(table: string, op: string): DbError | null {
    const i = state.fail.findIndex((f) => f.table === table && f.op === op);
    if (i < 0) return null;
    return state.fail.splice(i, 1)[0].error;
  }

  function violates(table: string, row: Row, except: Row | null): DbError | null {
    if (OWNED.includes(table) && !state.users.has(row.user_id as string)) {
      return { code: "23503", message: `insert or update on table "${table}" violates foreign key constraint` };
    }
    for (const col of UNIQUE[table] ?? []) {
      if (rows(table).some((r) => r !== except && r[col] === row[col])) {
        return { code: "23505", message: `duplicate key value violates unique constraint "${table}_${col}_key"` };
      }
    }
    return null;
  }

  class Query implements PromiseLike<Result> {
    private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    private columns = "*";
    private filters: ((r: Row) => boolean)[] = [];
    private payload: Row = {};
    private conflict = "id";
    private typeError: DbError | null = null;

    constructor(private readonly table: string) {}

    select(columns = "*") {
      if (this.op === "select") this.columns = columns;
      return this;
    }
    insert(row: Row) {
      this.op = "insert";
      this.payload = row;
      return this;
    }
    upsert(row: Row, opts?: { onConflict?: string }) {
      this.op = "upsert";
      this.payload = row;
      this.conflict = opts?.onConflict ?? "id";
      return this;
    }
    update(patch: Row) {
      this.op = "update";
      this.payload = patch;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      if (
        UUID_COLUMNS[this.table]?.includes(column) &&
        !(typeof value === "string" && UUID_RE.test(value))
      ) {
        this.typeError ??= {
          code: "22P02",
          message: `invalid input syntax for type uuid: "${String(value)}"`,
        };
      }
      this.filters.push((r) => r[column] === value);
      return this;
    }
    not(column: string, operator: string, value: unknown) {
      if (operator === "is" && value === null) this.filters.push((r) => r[column] != null);
      return this;
    }
    like(column: string, pattern: string) {
      const re = new RegExp(`^${pattern.split("%").map(escapeRegex).join(".*")}$`);
      this.filters.push((r) => typeof r[column] === "string" && re.test(r[column] as string));
      return this;
    }

    async maybeSingle(): Promise<Result> {
      const out = this.run();
      if (out.error) return out;
      const found = out.data as Row[];
      if (found.length > 1) {
        return { data: null, error: { code: "PGRST116", message: "more than one row" } };
      }
      return { data: found[0] ?? null, error: null };
    }

    then<A = Result, B = never>(
      onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }

    private matches(r: Row): boolean {
      return this.filters.every((f) => f(r));
    }

    private run(): Result {
      state.log.push({ table: this.table, op: this.op });
      const injected = failure(this.table, this.op);
      if (injected) return { data: null, error: injected };
      if (this.typeError) return { data: null, error: this.typeError };
      const table = rows(this.table);

      if (this.op === "select") {
        const cols =
          this.columns.trim() === "*" ? null : this.columns.split(",").map((c) => c.trim());
        const out = table
          .filter((r) => this.matches(r))
          .map((r) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c] ?? null])) : { ...r }));
        return { data: clone(out), error: null };
      }

      if (this.op === "insert") {
        const row = { ...DEFAULTS[this.table], ...clone(this.payload) };
        const bad = violates(this.table, row, null);
        if (bad) return { data: null, error: bad };
        table.push(row);
        return { data: null, error: null };
      }

      if (this.op === "upsert") {
        const existing = table.find((r) => r[this.conflict] === this.payload[this.conflict]) ?? null;
        const row = { ...DEFAULTS[this.table], ...existing, ...clone(this.payload) };
        const bad = violates(this.table, row, existing);
        if (bad) return { data: null, error: bad };
        if (existing) Object.assign(existing, row);
        else table.push(row);
        return { data: null, error: null };
      }

      if (this.op === "update") {
        for (const r of table) if (this.matches(r)) Object.assign(r, clone(this.payload));
        return { data: null, error: null };
      }

      state.tables[this.table] = table.filter((r) => !this.matches(r));
      return { data: null, error: null };
    }
  }

  const client = {
    from(table: string) {
      return new Query(table);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            const injected = failure(`storage:${bucket}`, "remove");
            if (injected) return { data: null, error: injected };
            state.removedAudio.push(...paths);
            return { data: [], error: null };
          },
          async createSignedUrl(path: string, expiresIn: number) {
            const injected = failure(`storage:${bucket}`, "sign");
            if (injected) return { data: null, error: injected };
            state.signed.push({ path, expiresIn });
            return {
              data: { signedUrl: `https://storage.test/object/sign/${bucket}/${path}?token=t` },
              error: null,
            };
          },
        };
      },
    },
    auth: {
      admin: {
        async deleteUser(id: string) {
          const injected = failure("auth.users", "delete");
          if (injected) return { data: { user: null }, error: injected };
          state.users.delete(id);
          state.deletedUsers.push(id);
          for (const table of OWNED) {
            state.tables[table] = rows(table).filter((r) => r.user_id !== id);
          }
          return { data: { user: null }, error: null };
        },
      },
    },
  };

  return {
    state,
    client,
    asClient(): SupabaseClient {
      return client as unknown as SupabaseClient;
    },
    row(table: string, userId: string): Row | undefined {
      return rows(table).find((r) => r.user_id === userId);
    },
    put(table: string, row: Row): void {
      rows(table).push({ ...DEFAULTS[table], ...row });
    },
  };
}

export type FakeDb = ReturnType<typeof fakeDb>;
