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
 *
 * Free for everyone since #478 (docs/plan-next.md section 4): the free
 * plan's once a week is gone, and a free account starts three rounds in
 * any 24 hours instead (`hostileRound`, claimed by the take), with every
 * call it makes under `hostileFree`. Premium claims no rounds, and its
 * calls count under `hostilePremium`: the account's day with the free
 * plan's hour, so it is never held sooner than a free account.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import {
  ANSWER_SECONDS,
  FALLBACK_QUESTIONS,
  HOSTILE_ROUNDS,
  HOSTILE_TAKE_ID,
  hostileCapLine,
  hostileRecord,
  isRepId,
  promptById,
  type HostileContext,
  type HostileRecord,
} from "@/lib/hostile";
import { hostileQuestion, hostileVerdict } from "@/lib/hostile-server";
import { isPremium } from "@/lib/db";
import { computeMetrics } from "@/lib/metrics";
import {
  GUEST_CEILING,
  GUEST_FULL_COPY,
  analyzeTier,
  clientIp,
  consumeRateLimit,
  limitMessage,
  refundRateLimit,
  type LimitTier,
} from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";
import { isFileFault } from "@/lib/whisper-fault";

export const runtime = "nodejs";
export const maxDuration = 120;
/** Whisper has the words in by 60 seconds of the request (docs/scale/audit.md M7). */
const WHISPER_BY_MS = 60_000;

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
  /** A free account's round, claimed by its take (#478). */
  round?: string | null;
  /**
   * The round never started, though something paid ran: a take too
   * short to interrogate, or a file Whisper refused (#478 review). Its
   * round comes back; the call's own slot stays spent under the rule
   * above, so a loop of them is still bounded by the call's room.
   */
  roundBack?: boolean;
  /**
   * Whisper heard under ten words (a take or an answer) from a caller
   * with a session (#478 review). Its slot comes back at most `refund`
   * times (6 an hour, 12 a day), as /api/analyze gives back a take that
   * stores nothing: a muted mic or two short answers no longer spend
   * the room a free account's third round needs to reach its verdict,
   * and a loop of short audio still costs at most twelve Whisper calls
   * a day more. Nothing past Whisper runs on one.
   */
  short?: boolean;
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
    if (spend.round && (!spend.keep || spend.roundBack)) await refundRateLimit(spend.round);
    if (spend.subject && spend.keep && spend.short) {
      const room = await consumeRateLimit(`refund:${spend.subject}`, "refund");
      if (room.allowed) {
        await refundRateLimit(spend.subject);
        if (spend.guestIp) await refundRateLimit(spend.guestIp);
      }
    }
  }
}

async function handle(req: NextRequest, spend: Spend) {
  const startedAt = Date.now();
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

  /* The plan, once (#478): Premium has its own room and claims no
     rounds; every other session, a guest's included, is the free plan.
     A read that fails is the free plan, which costs a paying account at
     most the cap for as long as the read is down. */
  const premium = auth ? await isPremium(auth.id).catch(() => false) : false;

  // Its own subject, never the recording allowance (#408, #409): the
  // free plan's calls, a guest's included, count under its own room, and
  // Premium's under a room never smaller than it in any window (#478).
  const subject = `hostile:${auth ? `u:${auth.id}` : `ip:${clientIp(req.headers)}`}`;
  const tier: LimitTier = !auth ? analyzeTier(auth) : premium ? "hostilePremium" : "hostileFree";
  const verdict = await consumeRateLimit(subject, tier);
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
   * The free plan's rounds (#478), where the weekly lock was (#464): a
   * take claims one of the account's three in any 24 hours, before
   * Whisper, and a refusal says when the next opens. The answers and the
   * verdict claim none, so a session under way is never cut off by it;
   * a caller that says it is mid-session to dodge the claim is still
   * held by `hostileFree`'s sixteen calls a day. A visitor with no
   * session has the visitor's five calls a day, about one round.
   */
  if (phase !== "verdict" && isTake && auth && !premium) {
    const round = `hostile:round:u:${auth.id}`;
    const rounds = await consumeRateLimit(round, "hostileRound");
    if (!rounds.allowed) {
      return NextResponse.json(
        { capped: true, error: hostileCapLine(rounds.retryAfterS), retryAfterS: rounds.retryAfterS },
        { status: 429, headers: { "Retry-After": String(rounds.retryAfterS) } }
      );
    }
    spend.round = round;
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
    t = await transcribe(audio, "hostile.webm", { deadline: startedAt + WHISPER_BY_MS });
  } catch (e) {
    console.error("hostile transcription failed", e);
    const message = e instanceof Error ? e.message : "";
    spend.keep = isFileFault(message);
    // A file Whisper refused starts no round: the screen says nothing was lost.
    spend.roundBack = true;
    return NextResponse.json(
      { error: "Transcription failed. Nothing was lost; try again." },
      { status: 502 }
    );
  }

  // Whisper ran: the slot is spent, a short answer included, and given
  // back only within `refund`'s room (`short`, above).
  spend.keep = true;
  const metrics = computeMetrics(t.words, t.durationS, t.segments);
  if (metrics.wordCount < MIN_WORDS) {
    // Nothing to interrogate: a take this short starts no round (#478).
    spend.roundBack = true;
    spend.short = !!auth;
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
