/**
 * DELETE /api/account: the whole account, gone.
 *
 * Ordered so a partial failure can never strand data or a charge:
 *
 *   0. The recordings' audio paths are read first; it changes nothing,
 *      so a failure here really does leave everything as it was.
 *   1. The plan, before anything is deleted. Every Checkout still open
 *      for the account's Stripe customer is closed, then every
 *      subscription that has not ended is cancelled now (lib/billing.ts
 *      endEveryPlan), so a deleted account is never charged again, and
 *      an ended plan's unpaid invoice is voided so nobody can pay it. If
 *      Stripe isn't configured while the billing row may hold a plan, or
 *      a cancel fails, the route stops here with nothing deleted, and is
 *      safe to retry. A cancel can't be undone: once a plan is cancelled,
 *      every later failure says so, and a retry finishes the rest.
 *   2. Audio files. They're the only thing a cascade can't reach
 *      (storage objects aren't rows), so they go while the reps rows
 *      still hold their paths. Any failure here aborts with every other
 *      row untouched, and the route is safe to retry.
 *   3. Rate-limit rows, which key on a subject string, not a foreign key:
 *      `u:<id>` and every route's `<route>:u:<id>`.
 *   4. The auth user, last. Every table references auth.users with
 *      on delete cascade (migrations 0001 to 0004, and billing in 0012),
 *      so this one call removes reps, lexicon, streaks, freezes,
 *      profiles, XP, coins and the billing row atomically.
 *
 * Works identically for anonymous-first accounts: they are real auth
 * users, and their token authorises deleting exactly themselves.
 */

import { NextRequest, NextResponse } from "next/server";
import { endEveryPlan, hasEnded, voidEndedInvoices } from "@/lib/billing";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

const PLAN_NOT_CANCELLED =
  "Your plan didn't cancel, so nothing was deleted. Try again in a minute.";

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);
  if (!auth) {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this server." },
      { status: 503 }
    );
  }

  const { data: rows, error: readError } = await db
    .from("reps")
    .select("audio_path")
    .eq("user_id", auth.id)
    .not("audio_path", "is", null);
  if (readError) {
    return NextResponse.json(
      { error: "Couldn't list your recordings. Nothing was deleted." },
      { status: 502 }
    );
  }

  const { data: plan, error: planError } = await db
    .from("billing")
    .select("stripe_customer_id, status")
    .eq("user_id", auth.id)
    .maybeSingle();
  if (planError) {
    console.error("account delete: billing read failed", planError.message);
    return NextResponse.json({ error: PLAN_NOT_CANCELLED }, { status: 502 });
  }
  // Plans this request cancelled. From here on, a failure says so.
  let cancelled = 0;
  if (plan) {
    const stripe = stripeClient();
    const customerId = plan.stripe_customer_id as string;
    if (stripe) {
      try {
        cancelled = await endEveryPlan(stripe, customerId);
      } catch (e) {
        console.error(
          "account delete: plan cancel failed",
          e instanceof Error ? e.message : e
        );
        return NextResponse.json({ error: PLAN_NOT_CANCELLED }, { status: 502 });
      }
      // A cancelled plan's declined renewal stays payable from its email;
      // nothing on an account that is gone should be.
      try {
        await voidEndedInvoices(stripe, customerId);
      } catch (e) {
        console.error(
          "account delete: unpaid invoice void failed",
          e instanceof Error ? e.message : e
        );
        return NextResponse.json(
          {
            error:
              cancelled > 0
                ? "Your plan is cancelled, but its unpaid invoice didn't close, so nothing else was deleted. Try again in a minute."
                : "Your plan's unpaid invoice didn't close, so nothing was deleted. Try again in a minute.",
          },
          { status: 502 }
        );
      }
    } else if (!hasEnded(plan.status as string | null)) {
      // Without a key nothing can be checked against Stripe, and a row that
      // never synced may hold a Checkout someone paid: fail closed.
      console.error("account delete: a plan that may be live and no Stripe key to cancel it");
      return NextResponse.json({ error: PLAN_NOT_CANCELLED }, { status: 502 });
    }
  }

  const paths = (rows ?? [])
    .map((r) => r.audio_path as string)
    .filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage
      .from("audio")
      .remove(paths.slice(i, i + 100));
    if (error) {
      console.error("account delete: audio removal failed", error.message);
      return NextResponse.json(
        {
          error:
            cancelled > 0
              ? "Your plan is cancelled, but your audio didn't delete. Nothing else was touched; try again."
              : "Couldn't delete your audio. Nothing else was touched; try again.",
        },
        { status: 502 }
      );
    }
  }

  // `u:<id>` and `checkout:u:<id>` alike; a uuid holds no LIKE wildcard.
  await db.from("rate_limits").delete().like("subject", `%u:${auth.id}`);

  const del = await db.auth.admin.deleteUser(auth.id);
  if (del.error) {
    console.error("account delete: auth deletion failed", del.error.message);
    return NextResponse.json(
      {
        error:
          cancelled > 0
            ? "Your plan is cancelled, but the account didn't delete. Try again in a minute."
            : "The account didn't delete. Try again in a minute.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
