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
 *                          session (anonymous-first ones count). An
 *                          account already on this consent keeps the
 *                          time it first agreed.
 *   { carry: token }       Signing in from an anonymous session that was
 *                          testing (lib/auth.ts): the token is that
 *                          session's, the Authorization the account's.
 *                          The consent the person gave on this phone
 *                          moves to the account, version and time as
 *                          given, and the anonymous row goes. No code:
 *                          both sessions are proof enough.
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
 * day). The slot is taken before the code is looked at, so an address
 * over its limit learns nothing, and given back (0017) once the code
 * matched: only wrong guesses spend the allowance, and a room of friends
 * on one school's Wi-Fi can all join in the same hour.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CODE_COPY, CONSENT_VERSION, JOINED_COPY } from "@/content/tester";
import { resolveAuthHeader, supabaseAdmin } from "@/lib/db";
import { clientIp, consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";

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

  const spent: string[] = [];
  for (const subject of [`tester:ip:${clientIp(req.headers)}`, ...(user ? [`tester:u:${user.id}`] : [])]) {
    if (!(await consumeRateLimit(subject, "user")).allowed) {
      return NextResponse.json({ error: CODE_COPY.tooMany }, { status: 429 });
    }
    spent.push(subject);
  }
  /** A call that was not a guess gives its slots back. */
  const giveBack = () => Promise.all(spent.map((s) => refundRateLimit(s)));

  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    agree?: unknown;
    carry?: unknown;
  } | null;

  if (body && "carry" in body) {
    const answer = await carry(user, body.carry);
    if (answer.status === 200) await giveBack();
    return answer;
  }

  const given = typeof body?.code === "string" ? body.code.trim() : "";
  const expected = process.env.TESTER_CODE?.trim() || "1234";
  if (!given || !codesMatch(given, expected)) {
    return NextResponse.json({ error: CODE_COPY.wrong }, { status: 403 });
  }
  await giveBack();

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

  /* Agreeing again to the consent already on record changes nothing:
     the record keeps the time it was first given. A newer consent
     replaces an older one, time and all. */
  const { data: had } = await db
    .from("testers")
    .select("consent_version, consented_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const kept = had as { consent_version: number; consented_at: string } | null;
  if (kept && kept.consent_version >= CONSENT_VERSION) {
    return NextResponse.json({
      ok: true,
      tester: { consent_version: kept.consent_version, consented_at: kept.consented_at },
    });
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

/**
 * The testing a person agreed to on an anonymous session, moved to the
 * account they then signed in to. Only from an anonymous session: a
 * real account's consent is that account's own. The account keeps its
 * own row when that one is at least as new.
 */
async function carry(
  user: { id: string } | null,
  token: unknown
): Promise<NextResponse> {
  if (!user) {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }
  const from =
    typeof token === "string" && token
      ? await resolveAuthHeader(`Bearer ${token}`).catch(() => ({ kind: "unavailable" }) as const)
      : ({ kind: "none" } as const);
  if (from.kind !== "user" || !from.user.anonymous) {
    return NextResponse.json({ error: "Nothing to carry." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this server." },
      { status: 503 }
    );
  }
  type Row = { consent_version: number; consented_at: string };
  const read = async (id: string) => {
    const { data, error } = await db
      .from("testers")
      .select("consent_version, consented_at")
      .eq("user_id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  };
  try {
    const given = await read(from.user.id);
    if (from.user.id === user.id) {
      return given
        ? NextResponse.json({ ok: true, tester: given })
        : NextResponse.json({ error: "Nothing to carry." }, { status: 404 });
    }
    if (!given) return NextResponse.json({ error: "Nothing to carry." }, { status: 404 });
    const own = await read(user.id);
    const tester = own && own.consent_version >= given.consent_version ? own : given;
    if (tester === given) {
      const { error } = await db
        .from("testers")
        .upsert({ user_id: user.id, ...given }, { onConflict: "user_id" });
      if (error) throw error;
    }
    // The anonymous account is left behind on this phone; its row would
    // read as a second tester in the report.
    const { error } = await db.from("testers").delete().eq("user_id", from.user.id);
    if (error) console.error("tester: carried row left behind", error.message);
    return NextResponse.json({
      ok: true,
      tester: { consent_version: tester.consent_version, consented_at: tester.consented_at },
    });
  } catch (e) {
    console.error("tester: carry failed", (e as { message?: string }).message);
    return NextResponse.json({ error: JOINED_COPY.saveFailed }, { status: 502 });
  }
}
