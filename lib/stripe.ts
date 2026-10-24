/**
 * The Stripe client, server only (DECISIONS #377).
 *
 * The SDK pins its own API version (stripe@22.6.2 speaks
 * 2026-08-26.dahlia), so every field lib/billing.ts reads is the shape
 * that version's types describe: a subscription's period lives on its
 * items, an invoice's subscription on `parent.subscription_details`.
 *
 * Billing is optional the way persistence is: with no keys the billing
 * routes answer 503 and the paywall keeps its invite-code path.
 */

import Stripe from "stripe";

let cached: { key: string; client: Stripe } | null = null;

/** The client, or null when STRIPE_SECRET_KEY is unset. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (cached?.key !== key) {
    cached = {
      key,
      client: new Stripe(key, {
        // 409s (a concurrent request on the same idempotency key) and
        // 5xx retry; two is the SDK's default, said here on purpose.
        maxNetworkRetries: 2,
        timeout: 20_000,
        appInfo: { name: "Ethos" },
      }),
    };
  }
  return cached.client;
}

/** The webhook's signing secret, or null when unset. */
export function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/**
 * Both halves are in: the key that charges and the secret that lets the
 * webhook tell Stripe from anyone else. Checkout stays shut until both
 * are, so a plan can never start that the server would not hear about.
 */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && webhookSecret());
}
