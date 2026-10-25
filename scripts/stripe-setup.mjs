/**
 * One-time Stripe setup for Premium's price ladder (DECISIONS #377).
 * Safe to run again: it finds what is already there, keeps what is
 * right, and fixes or makes only what is missing or wrong.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --site https://speakethos.com
 *   STRIPE_SECRET_KEY=... node scripts/stripe-setup.mjs --check    # read only, changes nothing
 *
 * What it sets up:
 *   1. The Product "Ethos Premium" (metadata ethos=ladder).
 *   2. Seven monthly AUD Prices, GST inclusive, lookup keys
 *      ethos_ladder_m1 to ethos_ladder_m7, at the ladder's amounts. A key
 *      on a wrong price moves to a new, right one (transfer_lookup_key).
 *      lib/billing.ts checks the same things before it charges anyone.
 *   3. A customer portal configuration: card, invoices, and cancel at the
 *      end of the paid month. No plan switching, because the ladder moves
 *      the price itself. Its id goes in STRIPE_PORTAL_CONFIGURATION.
 *   4. The webhook endpoint <site>/api/billing/webhook on exactly the
 *      events app/api/billing/webhook acts on. Its signing secret is shown
 *      once, when it is made, and goes in STRIPE_WEBHOOK_SECRET.
 *
 * Then a checklist of what only the dashboard can set.
 *
 * Run it in test mode first (an sk_test_ key), then again with the live
 * key: test and live are separate worlds in Stripe, so each needs it once.
 */

import Stripe from "stripe";

// lib/pricing.ts LADDER_CENTS; lib/billing.test.ts holds the two equal.
const LADDER_CENTS = [1299, 1199, 1099, 999, 899, 799, 699];
const LOOKUP_KEYS = LADDER_CENTS.map((_, i) => `ethos_ladder_m${i + 1}`);
const CURRENCY = "aud";

// lib/billing.ts HANDLED_EVENTS; lib/billing.test.ts holds the two equal.
const EVENTS = [
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

const PRODUCT_NAME = "Ethos Premium";
const TAG = { ethos: "ladder" };

// ---------------------------------------------------------------------
// Arguments

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) fail(`${name} needs a value`);
  return value;
}

function fail(message) {
  console.error(`\nstripe-setup: ${message}`);
  process.exit(1);
}

const CHECK_ONLY = process.argv.includes("--check");
const SITE = (arg("--site") ?? "https://speakethos.com").replace(/\/+$/, "");
if (!URL.canParse(SITE)) fail(`--site is not a URL: ${SITE}`);
if (new URL(SITE).protocol !== "https:") {
  fail(`--site must be https; Stripe delivers live webhooks only over https: ${SITE}`);
}
const WEBHOOK_URL = `${SITE}/api/billing/webhook`;

const KEY = process.env.STRIPE_SECRET_KEY?.trim();
if (!KEY) fail("set STRIPE_SECRET_KEY (Dashboard > Developers > API keys)");
const MODE = /^(sk|rk)_live_/.test(KEY) ? "LIVE" : "test";

const stripe = new Stripe(KEY, { maxNetworkRetries: 2, appInfo: { name: "Ethos setup" } });

const changes = [];
const warnings = [];

function done(line) {
  console.log(`  ok    ${line}`);
}
function change(line) {
  changes.push(line);
  console.log(`  ${CHECK_ONLY ? "would" : "made "} ${line}`);
}
function warn(line) {
  warnings.push(line);
  console.log(`  warn  ${line}`);
}

async function all(list) {
  const out = [];
  for await (const row of list) out.push(row);
  return out;
}

function aud(cents) {
  return `A$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------
// 1. The product

async function product() {
  console.log("\nProduct");
  const products = await all(stripe.products.list({ active: true, limit: 100 }));
  const ours = products.filter((p) => p.metadata?.ethos === TAG.ethos);
  if (ours.length > 1) {
    warn(`${ours.length} active products tagged ethos=ladder; using the oldest, ${ours.at(-1).id}`);
  }
  const found = ours.at(-1);
  if (found) {
    done(`${found.name} (${found.id})`);
    return found.id;
  }
  if (CHECK_ONLY) {
    change(`product "${PRODUCT_NAME}"`);
    return null;
  }
  const made = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "One plan, billed monthly. The price drops every month you stay, down to A$6.99.",
    metadata: TAG,
  });
  change(`product "${PRODUCT_NAME}" (${made.id})`);
  return made.id;
}

// ---------------------------------------------------------------------
// 2. The seven prices

/** What is wrong with `price` as month `month`'s rung, or null. Mirrors lib/billing.ts. */
function priceProblem(price, month, productId) {
  const want = LADDER_CENTS[month - 1];
  if (!price.active) return "archived";
  if (price.currency !== CURRENCY) return `currency ${price.currency}`;
  if (price.type !== "recurring" || !price.recurring) return "not recurring";
  if (price.recurring.interval !== "month") return `interval ${price.recurring.interval}`;
  if (price.recurring.interval_count !== 1) return `interval_count ${price.recurring.interval_count}`;
  if (price.recurring.usage_type !== "licensed") return "metered";
  if (price.billing_scheme !== "per_unit") return "tiered";
  if (price.transform_quantity != null) return "transform_quantity set";
  if (price.unit_amount !== want) return `unit_amount ${price.unit_amount}, ladder says ${want}`;
  if (price.tax_behavior !== "inclusive") return `tax_behavior ${price.tax_behavior}`;
  const owner = typeof price.product === "string" ? price.product : price.product?.id;
  if (productId && owner !== productId) return `on product ${owner}`;
  return null;
}

async function prices(productId) {
  console.log("\nPrices");
  const found = await stripe.prices.list({ lookup_keys: LOOKUP_KEYS, limit: 100 });
  const ids = [];
  for (const [i, key] of LOOKUP_KEYS.entries()) {
    const month = i + 1;
    const label = `${key} ${aud(LADDER_CENTS[i])}${month === LADDER_CENTS.length ? " (month 7 on)" : ""}`;
    const holders = found.data.filter((p) => p.lookup_key === key);
    const holder = holders.find((p) => p.active) ?? holders[0] ?? null;
    const problem = holder ? priceProblem(holder, month, productId) : "missing";
    if (!problem) {
      done(`${label} (${holder.id})`);
      ids.push(holder.id);
      continue;
    }
    if (CHECK_ONLY || !productId) {
      change(`${label}: ${problem}${holder ? ` on ${holder.id}` : ""}, a right one replaces it`);
      ids.push(null);
      continue;
    }
    const made = await stripe.prices.create({
      product: productId,
      currency: CURRENCY,
      unit_amount: LADDER_CENTS[i],
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
      billing_scheme: "per_unit",
      tax_behavior: "inclusive",
      lookup_key: key,
      transfer_lookup_key: true,
      nickname: month === LADDER_CENTS.length ? "Month 7 on" : `Month ${month}`,
      metadata: { ...TAG, month: String(month) },
    });
    change(`${label} (${made.id})${holder ? `, key moved off ${holder.id} (${problem})` : ""}`);
    ids.push(made.id);
  }
  return ids;
}

// ---------------------------------------------------------------------
// 3. The customer portal

function portalSettings() {
  return {
    business_profile: {
      headline: "Ethos Premium",
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/terms`,
    },
    default_return_url: `${SITE}/you`,
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "unused",
            "missing_features",
            "too_complex",
            "switched_service",
            "other",
          ],
        },
      },
      // The ladder moves the price itself; a switch here would break it.
      subscription_update: { enabled: false },
    },
    metadata: TAG,
  };
}

/** Does a configuration already match portalSettings()? */
function portalRight(config) {
  const f = config.features;
  const reasons = f.subscription_cancel?.cancellation_reason;
  return (
    config.active &&
    f.payment_method_update?.enabled === true &&
    f.invoice_history?.enabled === true &&
    f.subscription_cancel?.enabled === true &&
    f.subscription_cancel?.mode === "at_period_end" &&
    reasons?.enabled === true &&
    f.subscription_update?.enabled === false &&
    config.business_profile?.privacy_policy_url === `${SITE}/privacy` &&
    config.business_profile?.terms_of_service_url === `${SITE}/terms`
  );
}

async function portal() {
  console.log("\nCustomer portal");
  const configs = await all(stripe.billingPortal.configurations.list({ active: true, limit: 100 }));
  const found = configs.find((c) => c.metadata?.ethos === TAG.ethos);
  if (found && portalRight(found)) {
    done(`configuration ${found.id}`);
    return found.id;
  }
  if (CHECK_ONLY) {
    change(found ? `configuration ${found.id} brought up to date` : "a portal configuration");
    return found?.id ?? null;
  }
  if (found) {
    const updated = await stripe.billingPortal.configurations.update(found.id, portalSettings());
    change(`configuration ${updated.id} brought up to date`);
    return updated.id;
  }
  const made = await stripe.billingPortal.configurations.create(portalSettings());
  change(`configuration ${made.id}`);
  return made.id;
}

// ---------------------------------------------------------------------
// 4. The webhook endpoint

function sameEvents(a) {
  return a.length === EVENTS.length && EVENTS.every((e) => a.includes(e));
}

async function webhook() {
  console.log("\nWebhook");
  const endpoints = await all(stripe.webhookEndpoints.list({ limit: 100 }));
  const found = endpoints.filter((e) => e.url === WEBHOOK_URL);
  if (found.length > 1) {
    warn(`${found.length} endpoints at ${WEBHOOK_URL}; each one delivers every event, so delete all but one`);
  }
  const endpoint = found[0];
  if (endpoint) {
    if (endpoint.api_version && endpoint.api_version !== Stripe.API_VERSION) {
      warn(
        `${endpoint.id} sends events at API version ${endpoint.api_version}; the server speaks ` +
          `${Stripe.API_VERSION}. It only reads the customer id, so this works, but a fresh ` +
          `endpoint would match.`
      );
    }
    if (sameEvents(endpoint.enabled_events) && endpoint.status === "enabled") {
      done(`${WEBHOOK_URL} (${endpoint.id}), ${EVENTS.length} events`);
      return { id: endpoint.id, secret: null };
    }
    if (CHECK_ONLY) {
      change(`${endpoint.id}: enabled, on exactly the ${EVENTS.length} handled events`);
      return { id: endpoint.id, secret: null };
    }
    await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: EVENTS,
      disabled: false,
    });
    change(`${endpoint.id}: enabled, on exactly the ${EVENTS.length} handled events`);
    return { id: endpoint.id, secret: null };
  }
  if (CHECK_ONLY) {
    change(`endpoint ${WEBHOOK_URL}`);
    return { id: null, secret: null };
  }
  const made = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
    api_version: Stripe.API_VERSION,
    description: "Ethos: the price ladder's sync (lib/billing.ts)",
    metadata: TAG,
  });
  change(`endpoint ${WEBHOOK_URL} (${made.id})`);
  return { id: made.id, secret: made.secret ?? null };
}

// ---------------------------------------------------------------------

console.log(
  `Ethos Stripe setup, ${MODE} mode, site ${SITE}${CHECK_ONLY ? ", check only: nothing changes" : ""}`
);

try {
  const productId = await product();
  await prices(productId);
  const portalId = await portal();
  const hook = await webhook();

  console.log(`\n${changes.length === 0 ? "Nothing to change." : `${changes.length} change(s)${CHECK_ONLY ? " needed" : " made"}.`}`);
  if (warnings.length) console.log(`${warnings.length} warning(s) above.`);

  console.log(`
Environment (Vercel > Project > Settings > Environment Variables, ${MODE} values):
  STRIPE_SECRET_KEY=${MODE === "LIVE" ? "sk_live_..." : "sk_test_..."}   the key you ran this with
  STRIPE_WEBHOOK_SECRET=${hook.secret ?? "whsec_...   Dashboard > Developers > Webhooks > the endpoint > Signing secret"}
  STRIPE_PORTAL_CONFIGURATION=${portalId ?? "(run without --check to make it)"}
  NEXT_PUBLIC_SITE_URL=${SITE}
  NEXT_PUBLIC_CHECKOUT_OPEN=1   last, once everything above is in; it is read at build, so redeploy
${hook.secret ? "\nThe signing secret is shown only this once. Put it in Vercel now.\n" : ""}
Checklist, dashboard only (${MODE} mode; Stripe keeps test and live settings apart):
  [ ] Supabase: migration 0012_price_ladder.sql applied.
  [ ] Billing > Revenue recovery > Retries: Smart Retries over about 2 weeks, and
      "If all retries for a payment fail: cancel the subscription". A declined card
      keeps its place while Stripe retries; this is what ends the plan after.
  [ ] Billing > Revenue recovery > Emails: failed payment emails on, so a declined
      card hears about it while there is time to fix it.
  [ ] Settings > Customer emails: "Successful payments" and "Refunds" on.
  [ ] Billing settings, customer emails: upcoming renewal reminders on (7 days
      is fine). The same days set when invoice.upcoming fires, the sync's
      catch-up before each renewal.
  [ ] Settings > Business > Public details: support email and statement
      descriptor (ETHOS), so a charge is recognisable on a bank statement.
  [ ] Settings > Payments > Payment methods: cards and wallets. A method that
      settles over days (BECS) works, but Premium waits for the money.
  [ ] In test mode, end to end: subscribe with card 4242 4242 4242 4242, then
      check the subscription's item moved to ethos_ladder_m2 (A$11.99).
`);
} catch (e) {
  fail(e instanceof Error ? `${e.message}${e.code ? ` (${e.code})` : ""}` : String(e));
}
