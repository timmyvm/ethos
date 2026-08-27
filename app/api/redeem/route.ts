/**
 * POST /api/redeem — premium by invite code.
 *
 * There is no payment processor yet; `profiles.premium` is the gate
 * every premium check reads, and until Stripe exists this route is the
 * only thing that sets it. The code lives in PREMIUM_UNLOCK_CODE on the
 * server, compared in constant time, and attempts ride the existing
 * rate limiter on the visitor tier (3/hour, 5/day) so the code can't be
 * brute-forced at request speed.
 *
 * Anonymous-first sessions qualify: premium attaches to the same auth
 * user their reps already point at, so saving progress later loses
 * nothing (the same no-migration property lib/auth.ts documents).
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function codesMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);
  if (!auth) {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }

  const expected = process.env.PREMIUM_UNLOCK_CODE?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Codes aren't switched on for this server." },
      { status: 503 }
    );
  }

  const verdict = await consumeRateLimit(`redeem:u:${auth.id}`, "anon");
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Give it an hour." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    code?: string;
  } | null;
  const given = body?.code?.trim();
  if (!given || !codesMatch(given, expected)) {
    return NextResponse.json(
      { error: "That code doesn't match. Check it and try again." },
      { status: 403 }
    );
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this server." },
      { status: 503 }
    );
  }

  const { error } = await db
    .from("profiles")
    .upsert({ user_id: auth.id, premium: true }, { onConflict: "user_id" });
  if (error) {
    console.error("redeem: premium write failed", error.message);
    return NextResponse.json(
      { error: "The unlock didn't save. Try again in a minute." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
