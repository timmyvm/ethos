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
 * route never writes reps, XP or coins, so nothing here can be forged
 * into currency. Rate limits run BEFORE Whisper, same as /api/analyze,
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
  promptById,
  type HostileContext,
} from "@/lib/hostile";
import { hostileQuestion, hostileVerdict } from "@/lib/hostile-server";
import { isPremium } from "@/lib/db";
import { computeMetrics } from "@/lib/metrics";
import { localDate } from "@/lib/metering";
import {
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
  rounds?: { question: string; answer: string }[];
  pendingQuestion?: string;
  pendingQuoted?: string;
  roundNumbers?: { fillersPerMin: number; midSentencePauses: number }[];
}

function parseContext(raw: unknown): RoundsPayload | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as RoundsPayload;
  } catch {
    return null;
  }
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
  keep: boolean;
}

export async function POST(req: NextRequest) {
  const spend: Spend = { subject: null, keep: false };
  try {
    return await handle(req, spend);
  } finally {
    if (spend.subject && !spend.keep) await refundRateLimit(spend.subject);
    if (spend.guestIp && !spend.keep) await refundRateLimit(spend.guestIp);
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

  const phase = form.get("phase");
  const prompt = promptById((form.get("promptId") as string) ?? "");
  if (!prompt) {
    return NextResponse.json({ error: "Unknown prompt." }, { status: 400 });
  }
  const ctx = parseContext(form.get("context")) ?? {};

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
    return NextResponse.json({ verdict: v });
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

  const isTake = !ctx.take;

  /*
   * Free gets one interrogation a week, premium runs them at will —
   * the cold-topic pattern (#36) applied to this boss. Checked only at
   * the take (a session mid-flight is never cut off), and only when
   * there's a database to ask: degrade open, like everything else.
   */
  if (isTake && auth) {
    const premium = await isPremium(auth.id).catch(() => false);
    if (!premium) {
      const db = supabaseAdmin();
      if (db) {
        const { count } = await db
          .from("reps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", auth.id)
          .eq("lesson_id", "hostile-take")
          .gte(
            "created_at",
            weekStartFor(new Date(), numberOrNull(form.get("tzOffset"))).toISOString()
          );
        if ((count ?? 0) >= 1) {
          return NextResponse.json(
            { locked: true, error: "You've faced Demos this week. Premium reopens him now; otherwise it's Monday." },
            { status: 403 }
          );
        }
      }
    }
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
