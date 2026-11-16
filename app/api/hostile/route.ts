/**
 * POST /api/hostile — the interrogation's server half (DECISIONS #183).
 *
 * Two phases, one route:
 *
 *   phase=question  multipart: the newest recording (the take, or an
 *                   answer) + the session so far. Transcribes, measures
 *                   deterministically, and returns Demos's next
 *                   question — which must quote the speaker verbatim
 *                   (lib/hostile.ts) or it doesn't ship.
 *   phase=verdict   JSON: the finished session. Returns the judged
 *                   verdict, every score citing a quote.
 *
 * The take itself banks through /api/analyze like any recording; this
 * route writes no XP and no coins, so nothing here can be forged into
 * currency. Its one write is the verdict it judged itself, filed on the
 * caller's own banked take (`reps.round`, as `{ game: "hostile" }`), so
 * a later screen can read it; never a client's numbers. Rate limits run BEFORE Whisper, same as /api/analyze,
 * on Hostile's own subject: a session is four calls (the take, two
 * answers, the verdict), and on the recording allowance an account with
 * six recordings that hour lost the verdict after both answers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import {
  ANSWER_SECONDS,
  FALLBACK_QUESTIONS,
  HOSTILE_ROUNDS,
  HOSTILE_TAKE_ID,
  hostileRecord,
  isRepId,
  promptById,
  type HostileContext,
  type HostileRecord,
} from "@/lib/hostile";
import { hostileQuestion, hostileVerdict } from "@/lib/hostile-server";
import { isPremium } from "@/lib/db";
import { computeMetrics } from "@/lib/metrics";
import { localDate } from "@/lib/metering";
import {
  GUEST_CEILING,
  GUEST_FULL_COPY,
  analyzeTier,
  clientIp,
  consumeRateLimit,
  limitMessage,
  refundRateLimit,
} from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Under this, there is nothing to interrogate. */
const MIN_WORDS = 10;

interface RoundsPayload {
  claim?: string;
  take?: string;
  rounds?: { question: string; answer: string; quoted?: string }[];
  pendingQuestion?: string;
  pendingQuoted?: string;
  roundNumbers?: { fillersPerMin: number; midSentencePauses: number }[];
  /** The banked take's id (/api/analyze's `repId`): where the verdict is filed. */
  repId?: string;
}

/**
 * The context is the phone's copy of the session, and it goes into the
 * verdict's prompt, so nothing in it is trusted for size or shape
 * (security audit, 11 Nov): a take is a minute of speech and an answer
 * 45 seconds, so each string is cut to a length real speech cannot
 * reach, the rounds to the game's own count, and the numbers to finite
 * ones. Without this one request could carry a book into three Opus
 * calls.
 */
const CONTEXT_MAX_CHARS = 20_000;
const TAKE_MAX_CHARS = 4_000;
const ANSWER_MAX_CHARS = 3_000;
const QUESTION_MAX_CHARS = 400;
const QUOTED_MAX_CHARS = 200;

const text = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : undefined;
const finite = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(v, 1000)) : 0;

function parseContext(raw: unknown): RoundsPayload | null {
  if (typeof raw !== "string" || raw.length > CONTEXT_MAX_CHARS) return null;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const rounds = Array.isArray(o.rounds)
    ? o.rounds.slice(0, HOSTILE_ROUNDS).map((r) => {
        const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return {
          question: text(row.question, QUESTION_MAX_CHARS) ?? "",
          answer: text(row.answer, ANSWER_MAX_CHARS) ?? "",
          quoted: text(row.quoted, QUOTED_MAX_CHARS),
        };
      })
    : undefined;
  const roundNumbers = Array.isArray(o.roundNumbers)
    ? o.roundNumbers.slice(0, HOSTILE_ROUNDS).map((n) => {
        const row = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
        return {
          fillersPerMin: finite(row.fillersPerMin),
          midSentencePauses: finite(row.midSentencePauses),
        };
      })
    : undefined;
  return {
    claim: text(o.claim, QUESTION_MAX_CHARS),
    take: text(o.take, TAKE_MAX_CHARS),
    rounds,
    pendingQuestion: text(o.pendingQuestion, QUESTION_MAX_CHARS),
    pendingQuoted: text(o.pendingQuoted, QUOTED_MAX_CHARS),
    roundNumbers,
    repId: text(o.repId, 64),
  };
}

/**
 * A slot is given back only when nothing paid ran (#409, #416): Whisper
 * down or unreachable, a locked week, a verdict with no key to call.
 * Once Whisper has transcribed, or the verdict model has been called,
 * the slot stays, whatever came of it: giving it back for an answer
 * under ten words, or a verdict that failed, made every such call free,
 * and a script could loop transcriptions and Opus verdicts without end.
 * A file Whisper refuses keeps its slot too.
 */
interface Spend {
  subject: string | null;
  /** A guest's address-wide slot (#416), as /api/analyze takes. */
  guestIp?: string | null;
  /** A guest's or visitor's slot under the shared ceiling (`guestall`). */
  ceiling?: string | null;
  keep: boolean;
}

export async function POST(req: NextRequest) {
  const spend: Spend = { subject: null, keep: false };
  try {
    return await handle(req, spend);
  } finally {
    if (spend.subject && !spend.keep) await refundRateLimit(spend.subject);
    if (spend.guestIp && !spend.keep) await refundRateLimit(spend.guestIp);
    if (spend.ceiling && !spend.keep) await refundRateLimit(spend.ceiling);
  }
}

async function handle(req: NextRequest, spend: Spend) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);

  // Its own subject, never the recording allowance, and a guest gets the
  // account's room, as /api/analyze gives them (#408, #409).
  const subject = `hostile:${auth ? `u:${auth.id}` : `ip:${clientIp(req.headers)}`}`;
  const verdict = await consumeRateLimit(subject, analyzeTier(auth));
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: limitMessage(verdict), retryAfterS: verdict.retryAfterS },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterS) } }
    );
  }
  spend.subject = subject;

  /* Every guest on one address shares one room (#416), here as on
     /api/analyze, so minting sessions buys no more transcriptions. */
  if (auth?.anonymous) {
    const guestIp = `guest:ip:${clientIp(req.headers)}`;
    const shared = await consumeRateLimit(guestIp, "guestip");
    if (!shared.allowed) {
      return NextResponse.json(
        { error: limitMessage(shared), retryAfterS: shared.retryAfterS },
        { status: 429, headers: { "Retry-After": String(shared.retryAfterS) } }
      );
    }
    spend.guestIp = guestIp;
  }

  /* And every guest and visitor shares one ceiling, as on /api/analyze
     (11 Nov): the count a script with many addresses cannot get round. */
  if (!auth || auth.anonymous) {
    const all = await consumeRateLimit(GUEST_CEILING, "guestall");
    if (!all.allowed) {
      return NextResponse.json(
        { error: GUEST_FULL_COPY, guestFull: true, retryAfterS: all.retryAfterS },
        { status: 429, headers: { "Retry-After": String(all.retryAfterS) } }
      );
    }
    spend.ceiling = GUEST_CEILING;
  }

  const phase = form.get("phase");
  const prompt = promptById((form.get("promptId") as string) ?? "");
  if (!prompt) {
    return NextResponse.json({ error: "Unknown prompt." }, { status: 400 });
  }
  const ctx = parseContext(form.get("context")) ?? {};
  const isTake = !ctx.take;

  /*
   * Free gets one interrogation a week, premium runs them at will: the
   * cold-topic pattern (#36) applied to this boss. Checked on every call
   * (#464), not only the take: whether a call was the take was the
   * phone's word (a `take` in its context), so a free account could skip
   * the check by saying it had one. A take is refused once the week holds
   * one; a round or a verdict is let through while this week's one take
   * is under an hour old (a session mid-flight is never cut off) or still
   * on its way to being banked. A stopgap: a caller that never banks is
   * still never locked, which a week held on the server closes (STATE).
   * Only when there's a database to ask: degrade open, like everything else.
   */
  if (await weekLocked(auth, isTake, numberOrNull(form.get("tzOffset")))) {
    return NextResponse.json(
      { locked: true, error: "You've faced Demos this week. Premium reopens him now; otherwise it's Monday." },
      { status: 403 }
    );
  }

  if (phase === "verdict") {
    if (!ctx.take || (ctx.rounds?.length ?? 0) === 0) {
      return NextResponse.json(
        { error: "Nothing to judge yet." },
        { status: 400 }
      );
    }
    const full: HostileContext = {
      claim: prompt.claim,
      take: ctx.take,
      rounds: ctx.rounds ?? [],
    };
    // The model is called from here on: the slot is spent unless there
    // is no key to call it with.
    spend.keep = !!process.env.ANTHROPIC_API_KEY;
    const v = await hostileVerdict(full, ctx.roundNumbers ?? []).catch((e) => {
      console.error("hostile verdict failed", e);
      return null;
    });
    if (!v) {
      return NextResponse.json(
        { error: "The verdict didn't come back. The answers were still real practice." },
        { status: 502 }
      );
    }
    spend.keep = true;
    // Filed on the caller's own take, never a client's numbers: the
    // record is built here from the verdict the model just gave.
    const stored =
      auth && isRepId(ctx.repId)
        ? await storeVerdict(
            auth.id,
            ctx.repId,
            hostileRecord(prompt.id, v, (ctx.rounds ?? []).map((r) => ({ question: r.question, quoted: r.quoted ?? "" })))
          )
        : false;
    return NextResponse.json({ verdict: v, stored });
  }

  // phase=question — the default: transcribe the newest recording,
  // return the next question.
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty `audio` field." },
      { status: 400 }
    );
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Audio exceeds 25MB limit." },
      { status: 413 }
    );
  }

  let t;
  try {
    t = await transcribe(audio, "hostile.webm");
  } catch (e) {
    console.error("hostile transcription failed", e);
    const message = e instanceof Error ? e.message : "";
    spend.keep = /^Whisper API (400|413|415):/.test(message);
    return NextResponse.json(
      { error: "Transcription failed. Nothing was lost; try again." },
      { status: 502 }
    );
  }

  // Whisper ran: the slot is spent, a short answer included.
  spend.keep = true;
  const metrics = computeMetrics(t.words, t.durationS, t.segments);
  if (metrics.wordCount < MIN_WORDS) {
    return NextResponse.json({
      tooShort: true,
      transcript: t.text,
      wordCount: metrics.wordCount,
    });
  }

  const rounds = ctx.rounds ?? [];
  const nextCtx: HostileContext = isTake
    ? { claim: prompt.claim, take: t.text, rounds: [] }
    : {
        claim: prompt.claim,
        take: ctx.take ?? "",
        rounds: [
          ...rounds,
          { question: ctx.pendingQuestion ?? "", answer: t.text },
        ],
      };

  const finished = nextCtx.rounds.length >= HOSTILE_ROUNDS;
  let question = null;
  if (!finished) {
    question = await hostileQuestion(nextCtx).catch((e) => {
      console.error("hostile question failed", e);
      return null;
    });
    if (!question) {
      // Demos never stalls the boss: a generic question is worse than a
      // quoted one and better than a spinner that never ends.
      question = {
        quoted: "",
        question:
          FALLBACK_QUESTIONS[nextCtx.rounds.length % FALLBACK_QUESTIONS.length],
      };
    }
  }

  spend.keep = true;
  return NextResponse.json({
    transcript: t.text,
    fillersPerMin: metrics.fillersPerMin,
    midSentencePauses: metrics.midSentencePauses,
    wordCount: metrics.wordCount,
    answerSeconds: ANSWER_SECONDS,
    question,
    finished,
  });
}

/**
 * The verdict onto the take it judged: the caller's own row, banked as
 * Hostile's take, once (a take with a verdict already keeps it). With
 * the service client, so the filter IS the policy: id, owner, kind and
 * an empty `round`. Never throws; false when nothing was written (no
 * database, migration 0026 not applied yet, or no such take).
 */
async function storeVerdict(userId: string, repId: string, record: HostileRecord): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  try {
    const { data, error } = await db
      .from("reps")
      .update({ round: record })
      .eq("id", repId)
      .eq("user_id", userId)
      .eq("lesson_id", HOSTILE_TAKE_ID)
      .is("round", null)
      .select("id");
    if (error) {
      console.error("hostile verdict not stored", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error("hostile verdict not stored", e);
    return false;
  }
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return typeof v === "string" && v !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Monday 00:00 on the person's own calendar, from the offset the phone
 * sends (getTimezoneOffset minutes): the week the screen counts with
 * weekStart() on the phone. The server's clock is UTC, so its Monday
 * began up to 14 hours off the phone's: a Melbourne Monday morning still
 * held last Saturday's session, and the free one the screen offered was
 * locked after the take. With no offset the week is UTC's, as before.
 */
function weekStartFor(now: Date, tzOffset: number | null): Date {
  // Its UTC fields read the person's own clock (lib/metering.ts).
  const wall = localDate(now, tzOffset);
  const midnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const sinceMonday = (wall.getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * 86_400_000 + (now.getTime() - wall.getTime()));
}

/** How long a round or a verdict may follow the week's take (#464). */
const SESSION_WINDOW_MS = 60 * 60 * 1000;

/** Whether this call is past a free account's one Hostile session a week (#464). */
async function weekLocked(
  auth: { id: string } | null,
  isTake: boolean,
  tzOffset: number | null
): Promise<boolean> {
  if (!auth) return false;
  const premium = await isPremium(auth.id).catch(() => false);
  if (premium) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const since = weekStartFor(new Date(), tzOffset).toISOString();
  try {
    const { count } = await db
      .from("reps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.id)
      .eq("lesson_id", HOSTILE_TAKE_ID)
      .gte("created_at", since);
    const n = count ?? 0;
    if (isTake) return n >= 1;
    if (n === 0) return false; // the take is still on its way to being banked
    if (n > 1) return true;
    const { data } = await db
      .from("reps")
      .select("created_at")
      .eq("user_id", auth.id)
      .eq("lesson_id", HOSTILE_TAKE_ID)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    const at = Date.parse((data as { created_at?: string }[] | null)?.[0]?.created_at ?? "");
    return Number.isFinite(at) && Date.now() - at > SESSION_WINDOW_MS;
  } catch {
    return false;
  }
}
