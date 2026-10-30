/**
 * POST /api/tester: tester mode, by code and consent (migration 0020,
 * docs/testers.md).
 *
 * Two calls, one route, the code checked on both:
 *
 *   { code }               Is this the code? Nothing is stored either
 *                          way, so backing out of the consent screen
 *                          after it leaves nothing behind. No session
 *                          needed.
 *   { code, agree: n }     The code again, and the consent version the
 *                          screen showed. One upsert writes the testers
 *                          row with that version and the time, so a
 *                          tester without consent cannot exist. Needs a
 *                          session (anonymous-first ones count).
 *
 * The code is TESTER_CODE on the server, "1234" when unset (Timothy's
 * pick, 30 Oct). It is compared in constant time and appears in no
 * client file: lib/tester-route.test.ts holds that to account.
 *
 * It grants nothing paid. 1234 is the first code anyone guesses, and
 * Premium is what Ethos sells, so this writes `testers` and never
 * `profiles`; a tester Timothy wants on Premium gets the invite code
 * (/api/redeem) as well.
 *
 * Every call rides the existing limiter twice, as /api/redeem does: per
 * address, because anonymous sign-in mints account ids for free, and per
 * account when there is one. Both at the account tier (10 an hour, 30 a
 * day), not the visitor tier redeem uses for its account, because one
 * enrolment is two calls and a back-out from consent makes three; the
 * address limit is what slows a guesser either way.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CODE_COPY, CONSENT_VERSION, JOINED_COPY } from "@/content/tester";
import { resolveAuthHeader, supabaseAdmin } from "@/lib/db";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Equal digests, compared in constant time: neither the code nor its length leaks. */
function codesMatch(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export async function POST(req: NextRequest) {
  const resolved = await resolveAuthHeader(req.headers.get("authorization")).catch(
    () => ({ kind: "unavailable" }) as const
  );
  // A token sent and refused is a lapsed session, never a stranger: say so.
  if (resolved.kind === "rejected" || resolved.kind === "unavailable") {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }
  const user = resolved.kind === "user" ? resolved.user : null;

  const byAddress = await consumeRateLimit(`tester:ip:${clientIp(req.headers)}`, "user");
  const verdict =
    byAddress.allowed && user ? await consumeRateLimit(`tester:u:${user.id}`, "user") : byAddress;
  if (!verdict.allowed) {
    return NextResponse.json({ error: CODE_COPY.tooMany }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    agree?: unknown;
  } | null;
  const given = typeof body?.code === "string" ? body.code.trim() : "";
  const expected = process.env.TESTER_CODE?.trim() || "1234";
  if (!given || !codesMatch(given, expected)) {
    return NextResponse.json({ error: CODE_COPY.wrong }, { status: 403 });
  }

  // The check alone: right code, nothing stored.
  if (body?.agree === undefined) {
    return NextResponse.json({ ok: true, consentVersion: CONSENT_VERSION });
  }

  if (body.agree !== CONSENT_VERSION) {
    return NextResponse.json(
      { error: JOINED_COPY.changed, consentVersion: CONSENT_VERSION },
      { status: 409 }
    );
  }
  if (!user) {
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

  const consentedAt = new Date().toISOString();
  const { error } = await db
    .from("testers")
    .upsert(
      { user_id: user.id, consent_version: CONSENT_VERSION, consented_at: consentedAt },
      { onConflict: "user_id" }
    );
  if (error) {
    console.error("tester: consent write failed", error.message);
    return NextResponse.json({ error: JOINED_COPY.saveFailed }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    tester: { consent_version: CONSENT_VERSION, consented_at: consentedAt },
  });
}
