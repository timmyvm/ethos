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
 *   { agree: n }           No code: a tester on an older consent agreeing
 *                          to the one on screen (consent version 3 named
 *                          everything kept; the app asks a tester on 1 or
 *                          2 once, on their next open). Their testers
 *                          row is the proof, so an account without one is
 *                          refused as a wrong code would be, and spends a
 *                          guess.
 *   { carry: token }       Signing in from an anonymous session that was
 *                          testing (lib/auth.ts): the token is that
 *                          session's, the Authorization the account's.
 *                          The consent the person gave on this phone
 *                          moves to the account, version, time and the
 *                          day they first joined as given, and the
 *                          anonymous row goes. Their answers and notes
 *                          and the device, usage and error rows it had
 *                          sent move with it (0022), and the account
 *                          remembers the session (`carried_from`), whose
 *                          recordings stay under its id as every
 *                          sign-in leaves them: the report reads them
 *                          as this tester's, and deleting the account
 *                          or the tester's data reaches them. No code:
 *                          both sessions are proof enough.
 *
 * At most TESTER_LIMIT testers (60 when unset) at once: a right code
 * from someone new past that is told the test is full (423), and a
 * tester already on the list is never refused (review P4: 1234 is the
 * first code anyone guesses, so the list needs its own ceiling).
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
  if (!given && body?.agree !== undefined && user) {
    // Agreeing again, with no code: only an account that is a tester.
    const found = await testerRow(user.id);
    if (found === "unavailable") {
      return NextResponse.json({ error: JOINED_COPY.saveFailed }, { status: 502 });
    }
    if (!found) return NextResponse.json({ error: CODE_COPY.wrong }, { status: 403 });
  } else if (!given || !codesMatch(given, expected)) {
    return NextResponse.json({ error: CODE_COPY.wrong }, { status: 403 });
  } else if (await full(user?.id ?? null)) {
    await giveBack();
    return NextResponse.json({ error: CODE_COPY.full }, { status: 423 });
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

/** The most testers at once: TESTER_LIMIT, or 60 (about twenty friends, some on two phones). */
function testerLimit(): number {
  const n = Number(process.env.TESTER_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 60;
}

/**
 * Whether a new tester would be one too many. Never for an account
 * already on the list. A count that cannot be read lets them in: the
 * collect route's own ceilings still hold.
 */
async function full(userId: string | null): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  if (userId) {
    const had = await testerRow(userId);
    if (had && had !== "unavailable") return false;
  }
  const { count, error } = await db.from("testers").select("user_id", { count: "exact", head: true });
  if (error || count == null) return false;
  return count >= testerLimit();
}

/** The account's testers row, null for none, or "unavailable" when it could not be read. */
async function testerRow(
  userId: string
): Promise<{ consent_version: number; consented_at: string } | null | "unavailable"> {
  const db = supabaseAdmin();
  if (!db) return "unavailable";
  const { data, error } = await db
    .from("testers")
    .select("consent_version, consented_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return "unavailable";
  return (data as { consent_version: number; consented_at: string } | null) ?? null;
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
  /* Read whole ("*"): `carried_from` is 0022's, and the code ships
     before the migration does. */
  type Row = {
    consent_version: number;
    consented_at: string;
    created_at?: string | null;
    carried_from?: string[] | null;
  };
  const read = async (id: string) => {
    const { data, error } = await db.from("testers").select("*").eq("user_id", id).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  };
  try {
    const given = await read(from.user.id);
    if (from.user.id === user.id) {
      return given
        ? NextResponse.json({
            ok: true,
            tester: { consent_version: given.consent_version, consented_at: given.consented_at },
          })
        : NextResponse.json({ error: "Nothing to carry." }, { status: 404 });
    }
    if (!given) return NextResponse.json({ error: "Nothing to carry." }, { status: 404 });
    const own = await read(user.id);
    const tester = own && own.consent_version >= given.consent_version ? own : given;
    // The day they first joined, whichever session that was on: days
    // spoken count from it (tester_admin.testers), and so does paying.
    const joined = [own?.created_at, given.created_at]
      .filter((d): d is string => typeof d === "string" && !!d)
      .sort()[0];
    {
      const { error } = await db.from("testers").upsert(
        {
          user_id: user.id,
          consent_version: tester.consent_version,
          consented_at: tester.consented_at,
          ...(joined ? { created_at: joined } : {}),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    }
    // The session it came from, and any that one came from: the report
    // reads their recordings as this tester's, and a deletion reaches them.
    const carried = [...new Set([...(own?.carried_from ?? []), ...(given.carried_from ?? []), from.user.id])];
    {
      const { error } = await db.from("testers").update({ carried_from: carried }).eq("user_id", user.id);
      if (error) console.error("tester: carried session not remembered", error.message);
    }
    // Answers, notes and how it felt about the anonymous session's
    // recordings are the same person's: they move first, so the
    // report reads one tester and a deletion by their number finds them.
    await carryAnswers(db, from.user.id, user.id);
    // What the phone sent while it was the anonymous session moves too.
    const moved = await db
      .from("tester_events")
      .update({ user_id: user.id })
      .eq("user_id", from.user.id);
    if (moved.error) console.error("tester: carried events left behind", moved.error.message);
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

type Answer = {
  client_id: string;
  rep_id: string | null;
  answer: string | null;
  note: string | null;
  scores: Record<string, unknown> | null;
  felt: string | null;
  updated_at: string;
};

/**
 * The anonymous session's answers, moved to the account. Two answers
 * about one recording (the phone saved under both) become one, the
 * newer's over the older's, as the phone merges its own waiting saves
 * (lib/tester.ts withPending): an answer keeps its note and numbers,
 * and how it felt survives a later answer that did not say.
 */
async function carryAnswers(db: NonNullable<ReturnType<typeof supabaseAdmin>>, from: string, to: string): Promise<void> {
  const theirs = await db.from("tester_feedback").select("*").eq("user_id", from);
  if (theirs.error) {
    console.error("tester: carried answers left behind", theirs.error.message);
    return;
  }
  const rows = (theirs.data ?? []) as Answer[];
  if (rows.length === 0) return;
  const mine = await db.from("tester_feedback").select("*").eq("user_id", to);
  const had = new Map(((mine.data ?? []) as Answer[]).map((r) => [r.client_id, r]));
  for (const row of rows) {
    const clash = had.get(row.client_id);
    if (!clash) continue;
    const [older, newer] = row.updated_at > clash.updated_at ? [clash, row] : [row, clash];
    const said = newer.answer !== null ? newer : older;
    const merged = {
      answer: said.answer,
      note: said.note,
      scores: said.scores,
      felt: newer.felt ?? older.felt,
      rep_id: newer.rep_id ?? older.rep_id,
      updated_at: newer.updated_at,
    };
    const kept = await db.from("tester_feedback").update(merged).eq("user_id", to).eq("client_id", row.client_id);
    if (kept.error) {
      console.error("tester: carried answer not merged", kept.error.message);
      continue;
    }
    const gone = await db.from("tester_feedback").delete().eq("user_id", from).eq("client_id", row.client_id);
    if (gone.error) console.error("tester: merged answer left behind", gone.error.message);
  }
  const moved = await db.from("tester_feedback").update({ user_id: to }).eq("user_id", from);
  if (moved.error) console.error("tester: carried answers left behind", moved.error.message);
}
