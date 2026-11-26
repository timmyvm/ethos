/**
 * POST /api/analyze — the engine.
 * multipart/form-data: `audio` (webm/opus blob), optional `lessonId`.
 * Optional `Authorization: Bearer <supabase access token>` ties the rep
 * to the (anonymous-first) user; without it the rep still scores.
 *
 * Pipeline: Whisper (word timestamps) → deterministic metrics + Tier-1
 * Index scores + anchors → one Claude call (coaching copy + Tier-2
 * judged dimensions, citation-required) → Ethos Index /1000 → persist.
 * The numbers never depend on the LLM; if the coach layer fails, the
 * rep still returns real metrics and Tier-1 scores.
 *
 * #472, the wait after Stop. What does not wait on the words (the plan
 * and meter reads, the delta's reads, a game's count, the audio going
 * into the bucket) starts beside Whisper rather than before or after
 * it, so after Demos's read only the rows are left to write. And a
 * caller that asks (`Accept: application/x-ndjson`, the recorder) gets
 * the answer in parts: a line per stage, the transcript and its counts
 * the moment they exist, then the whole answer as its last line
 * (lib/analyze-stream.ts). Nothing scored changes: the same calls, the
 * same order of what feeds what, the same Index.
 */

import { NextRequest, NextResponse } from "next/server";
import { judgeAccuracy, type AccuracyResult } from "@/lib/accuracy";
import {
  STREAM_TYPE,
  earlyRead,
  encodeLine,
  wantsStream,
  type AnalyzeEvent,
  type AnalyzeLine,
} from "@/lib/analyze-stream";
import { coachRep, tier2Scores, type CoachOutput } from "@/lib/coach";
import { StageClock, providerError, stageLine } from "@/lib/analyze-timing";
import { tokenSubject } from "@/lib/token-subject";
import { COLD_TOPICS } from "@/lib/cold-topics";
import { bossXpMultiplier, lastBossWeek, parseBossWeek } from "@/lib/boss";
import {
  bossIndexBetween,
  findRepByClientId,
  gameRoundsBetween,
  resolveAuthHeader,
  isPremium,
  previousEthosIndex,
  previousPresence,
  readMeterState,
  removeRepAudio,
  saveRep,
  swapMeterState,
  uploadRepAudio,
} from "@/lib/db";
import { neutralAudioName } from "@/lib/audio-name";
import {
  claimRead,
  giveBackRead,
  localDate,
  meter,
  type MeterDecision,
  type MeterState,
  type MeterStore,
} from "@/lib/metering";
import {
  GUEST_CEILING,
  GUEST_FULL_COPY,
  clientIp,
  consumeRateLimit,
  limitMessage,
  noteGuestFull,
  refundRateLimit,
  analyzeTier,
} from "@/lib/rate-limit";
import type { DeliveryMetrics, DeliveryMoment } from "@/lib/presence";
import type { CaptureMode } from "@/lib/prefs";
import {
  ethosIndex,
  tier1Scores,
  tier2Anchors,
  type Tier1Scores,
  type Tier2Anchors,
} from "@/lib/index-score";
import { computeMetrics, isScorable, type RepMetrics, type Word } from "@/lib/metrics";
import { fitEnvelopeRate, parseEnvelope, pauseEnvelope } from "@/lib/envelope";
import {
  gameDayWindow,
  gameMods,
  gameOfLessonId,
  gameXpMultiplier,
  needsPremium,
  roundEntitled,
} from "@/lib/games";
import { pauseReport } from "@/lib/pause-quality";
import { PAUSE_RULES } from "@/lib/pause-rules";
import {
  cutInFired,
  measureRound,
  parseRoundField,
  type GameRound,
} from "@/lib/round";
import { modIds, parseMods, xpMultiplier } from "@/lib/stress-mods";
import { spokenAt } from "@/lib/spoken-at";
import { transcribe } from "@/lib/transcribe";
import { isFileFault } from "@/lib/whisper-fault";
import { UNHEARD_COPY, unheard } from "@/lib/unheard";

export const runtime = "nodejs";
/*
 * The route's own minute, not the plan's ceiling: hostile deploys at 120,
 * so Fluid compute allows more (docs/scale/audit.md M12). A minute is
 * Whisper plus the coach with room to store.
 */
export const maxDuration = 60;
/**
 * The coach is done this long after the request came in, or gives up:
 * the rest of the minute stores the recording. A function killed at the
 * cap stores nothing and keeps the slot, and the phone sends it again.
 */
const COACH_BUDGET_MS = 45_000;
/**
 * Whisper has its words in by this long after the request came in, or is
 * cut off and answered as Whisper being down: a 502, the slot given back
 * and the audio taken back out of the bucket, with ten seconds left to do
 * it. Killed at the minute instead, the take kept its slot, left its
 * audio in the bucket with no row, and was sent again whole
 * (docs/scale/audit.md M7, FAIL-1). Upload's longest file is a few
 * seconds of Whisper; only an OpenAI slowdown reaches this.
 */
const WHISPER_BUDGET_MS = 50_000;
/**
 * However late the take arrived, Whisper is never given past this: the
 * minute counts from the request, the upload included, and a slow upload
 * that reached Whisper after 55 s used to get "now + 5 s", past the kill
 * at 60, which is the ending the budget above exists to prevent.
 */
const WHISPER_LAST_MS = 55_000;

export interface AnalyzeResponse {
  transcript: string;
  /**
   * Whisper's words with their times (#411): the transcript on the words
   * step taps each word to when it was said. Optional because a reply
   * kept on the phone from before #411 has none.
   */
  words?: Word[];
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  previousIndex: number | null;
  repId: string | null;
  /** False when there wasn't enough real speech to score. */
  scorable: boolean;
  /** One line on what the silences actually did. */
  pauseHeadline: string | null;
  accuracy: AccuracyResult | null;
  mode: "daily" | "boss";
  mods: string[];
  xpMultiplier: number;
  /**
   * The account XP this take paid (#510, lib/xp.ts `xpForTake`): 0 for a
   * take that earned no star, and for one stored nowhere (no session, a
   * failed save). The round card says this number, never one of its own.
   * Optional because a reply kept on the phone from before has none.
   */
  xp?: number;
  captureMode: CaptureMode;
  /** Null for Voice reps, and for a Voice + Video rep with no body in it. */
  delivery: DeliveryMetrics | null;
  deliveryMoments: DeliveryMoment[];
  previousPresence: number | null;
  /**
   * A game round, measured (lib/round.ts): null on anything that is not a
   * game, and on a game whose phone sent no round. Optional because a
   * reply kept on the phone from before it has none.
   */
  round?: GameRound | null;
  /**
   * The pause rules that scored this take (#491, lib/pause-rules.ts), so
   * the glance can tell when its delta stands beside a take scored before
   * #476. Optional because a reply kept on the phone from before has none.
   */
  pauseRules?: number;
  /** What the judged tier did, and what's left of it (§3). */
  judged: {
    ran: boolean;
    unlimited: boolean;
    remaining: number;
    /** True when the rep was measured but not judged, because of the cap. */
    capped: boolean;
    /**
     * This take's read came off the account's stored allowance and stayed
     * spent, so `remaining` is the stored count (the reel's honest wins,
     * build 5, lib/scored-left.ts). False for Premium, no session, a meter
     * that could not be read or written, and a read handed back. Absent on
     * a reply from before it.
     */
    counted?: boolean;
  };
}

/**
 * Only a saved recording keeps its slot (#409, Timothy: "don't treat it
 * as a saved recording that sets the limit again"). Once a slot is
 * taken, anything that ends without a new stored recording gives it
 * back: Whisper down, a take the mic barely heard, a resend of one
 * already stored, a failed save, a crash. A file Whisper refuses keeps
 * its slot, so junk uploads still cost one each.
 */
interface Spend {
  /** The throttle's subject once a slot was taken. */
  subject: string | null;
  /** A guest's address-wide slot (#416), given back or kept with the first. */
  guestIp?: string | null;
  /** The slot stays spent. */
  keep: boolean;
  /**
   * Whisper answered, so the call cost money (security audit, 11 Nov).
   * A paid call that ends with nothing stored still gets its slot back,
   * as #409 asks, but only `refund` times an hour: without that ceiling
   * a script could send takes built to be thrown away (sped-up speech,
   * a save made to fail, one clientId sent twenty times at once) and
   * transcribe without end.
   */
  paid?: boolean;
  /**
   * A guest's or a visitor's slot under the ceiling they all share
   * (`guestall`, lib/rate-limit.ts). It comes back only when nothing
   * paid ran: the ceiling is the one count a thousand addresses cannot
   * get round, so a paid call stays counted whatever came of it.
   */
  ceiling?: string | null;
  /**
   * The take's audio, going into the bucket beside Whisper (#472): the
   * path it went in at, or null when it did not.
   */
  audio?: Promise<string | null>;
  /**
   * The save took the audio over: stored with its row, taken back by
   * the save itself (a race lost to an earlier send), or in a state
   * nobody can know (the save threw). Anything else ends with the audio
   * stored nowhere, so it is taken back out of the bucket.
   */
  audioOwned?: boolean;
}

/**
 * Give the slot back, unless this subject's paid give-backs are used up,
 * and take back audio that went into the bucket for a take stored
 * nowhere.
 */
async function settle(spend: Spend) {
  if (spend.audio && !spend.audioOwned) {
    const path = await spend.audio;
    if (path) await removeRepAudio(path).catch(() => {});
  }
  if (!spend.subject || spend.keep) return;
  if (spend.paid) {
    const room = await consumeRateLimit(`refund:${spend.subject}`, "refund");
    if (!room.allowed) return;
  } else if (spend.ceiling) {
    await refundRateLimit(spend.ceiling);
  }
  await refundRateLimit(spend.subject);
  if (spend.guestIp) await refundRateLimit(spend.guestIp);
}

/** A form field as text: a File sent under a text field's name is nothing. */
const field = (form: FormData, name: string): string | null => {
  const v = form.get(name);
  return typeof v === "string" ? v : null;
};

export async function POST(req: NextRequest) {
  const spend: Spend = { subject: null, keep: false };
  // Each stage's time, written as one line when the take is answered (#508).
  const clock = new StageClock();
  const startedAt = clock.startedAt;
  let form: FormData;
  try {
    form = await req.formData();
    clock.mark("uploadEnd");
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an `audio` field." },
      { status: 400 }
    );
  }
  if (!wantsStream(req.headers.get("accept"))) {
    try {
      return await handle(form, req, spend, startedAt, () => {}, clock);
    } finally {
      await settle(spend);
    }
  }
  return new Response(answerInParts(form, req, spend, startedAt, clock), {
    headers: {
      "Content-Type": `${STREAM_TYPE}; charset=utf-8`,
      // no-transform: nothing between here and the phone may hold the
      // lines back to compress them whole.
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * The same handling, its stages written as lines as they are reached
 * (lib/analyze-stream.ts). The last line is the answer `handle` returns,
 * its status and body unchanged, so a 429 or a 422 means what it always
 * meant. The phone leaving mid-way stops the writing, never the work:
 * the take is still scored and stored, and its resend gets the stored
 * recording back by its key. The slot and the audio are settled before
 * the stream closes, so nothing is left for after the function returns.
 */
function answerInParts(
  form: FormData,
  req: NextRequest,
  spend: Spend,
  startedAt: number,
  clock: StageClock
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let open = true;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (line: AnalyzeLine) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeLine(line)));
        } catch {
          open = false;
        }
      };
      void (async () => {
        write({ stage: "received" });
        let status = 500;
        let body: unknown = { error: "The scoring server didn't answer." };
        try {
          const res = await handle(form, req, spend, startedAt, write, clock);
          status = res.status;
          body = await res.json().catch(() => null);
        } catch (e) {
          console.error("analyze failed", e instanceof Error ? e.message : e);
        }
        write({ stage: "done", status, body });
        await settle(spend).catch(() => {});
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // Already gone with the phone.
          }
        }
      })();
    },
    cancel() {
      open = false;
    },
  });
}

/**
 * The take, answered, and its stages' times written as one line
 * (lib/analyze-timing.ts, #508): the status, the stage times, the region
 * and the take's size and length, never a word of it or whose it was.
 */
async function handle(
  form: FormData,
  req: NextRequest,
  spend: Spend,
  startedAt: number,
  emit: (event: AnalyzeEvent) => void,
  clock: StageClock
): Promise<NextResponse> {
  let status = 500;
  try {
    const res = await handleTake(form, req, spend, startedAt, emit, clock);
    status = res.status;
    return res;
  } finally {
    console.info(stageLine(clock.report(status)));
  }
}

async function handleTake(
  form: FormData,
  req: NextRequest,
  spend: Spend,
  startedAt: number,
  /** Each stage as it is reached (#472); a no-op for a caller that asked for one body. */
  emit: (event: AnalyzeEvent) => void,
  clock: StageClock
): Promise<NextResponse> {
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

  // "rep" and the extension, never an upload's own name (review P3).
  const filename = neutralAudioName(audio instanceof File ? audio.name : null);
  clock.audioBytes = audio.size;

  /*
   * The key a resend carries (the outbox id, lib/rep-outbox.ts). Read
   * first, so the lookup below can leave beside the sign-in check (#508).
   */
  const rawKey = form.get("clientId");
  const clientId =
    typeof rawKey === "string" && /^[\w-]{1,200}$/.test(rawKey) ? rawKey : null;

  // Anonymous-first: a valid token attributes the rep; absence never
  // blocks. A token that was SENT but does not resolve is different: the
  // recording has an owner we cannot name right now, so nothing is stored
  // (it would be stored with no owner, and the client would drop its only
  // copy). Checked before the limiter and Whisper, so it costs nothing.
  const header = req.headers.get("authorization");
  /*
   * The resend lookup leaves beside the sign-in check, not after it
   * (#508: one round trip, not two). It is asked for the account the
   * token NAMES, which is not yet the account it proves, so its answer
   * is used only once the check below has proved that same account;
   * for any other answer it is thrown away and asked again.
   */
  const named = clientId ? tokenSubject(header) : null;
  const early = named && clientId ? findRepByClientId(named, clientId).catch(() => null) : null;
  const resolved = await resolveAuthHeader(header).catch(
    () => ({ kind: "unavailable" }) as const
  );
  if (resolved.kind === "rejected") {
    return NextResponse.json(
      { error: "Your sign-in lapsed. Sending it again.", authExpired: true },
      { status: 401 }
    );
  }
  if (resolved.kind === "unavailable") {
    return NextResponse.json(
      { error: "Sign-in didn't answer. Sending it again." },
      { status: 503 }
    );
  }
  const auth = resolved.kind === "user" ? resolved.user : null;
  const userId = auth?.id ?? null;

  /*
   * A resend of a recording this account already stored (the response
   * was lost on the way back, or a second tab sent it too) gets that
   * recording back: no rate-limit slot, no Whisper, no judged read, no
   * second row. The key is the outbox id (lib/rep-outbox.ts).
   */
  if (userId && clientId) {
    const stored = await (early && named === userId
      ? early
      : findRepByClientId(userId, clientId).catch(() => null));
    if (stored) {
      clock.duplicate = true;
      return NextResponse.json({ repId: stored, duplicate: true });
    }
  }

  /*
   * The throttle, BEFORE anything that costs money (Whisper runs on
   * every upload). Any session, a guest or an account, gets the
   * account's allowance; a caller with no session gets the visitor's
   * (lib/rate-limit.ts). Only a saved recording keeps its slot (#409).
   */
  const subject = auth ? `u:${auth.id}` : `ip:${clientIp(req.headers)}`;
  /* A guest also counts against every guest on its address (#416), so
     minting sessions buys no more scoring. Accounts never do. */
  const guestIp = auth?.anonymous ? `guest:ip:${clientIp(req.headers)}` : null;
  /* And every guest and visitor, wherever they come from, shares one
     ceiling (11 Nov): an address is cheap to change, so the rooms above
     put no end on what scripted guests could spend. Accounts never
     count, and a full ceiling says how to go on. */
  const ceiling = !auth || auth.anonymous ? GUEST_CEILING : null;
  /*
   * The slots are claimed together (#508: one round trip, not up to
   * three), all of them before Whisper. When any is refused, the ones
   * taken are given back before the answer goes, so a refused take
   * costs nothing, as when they were claimed one after another.
   */
  const [verdict, shared, all] = await Promise.all([
    // A session, guest or account, gets an account's room (#408, #409).
    consumeRateLimit(subject, analyzeTier(auth)),
    guestIp ? consumeRateLimit(guestIp, "guestip") : null,
    ceiling ? consumeRateLimit(ceiling, "guestall") : null,
  ]);
  const refused = !verdict.allowed || shared?.allowed === false || all?.allowed === false;
  if (refused) {
    await Promise.all([
      verdict.allowed ? refundRateLimit(subject) : null,
      guestIp && shared?.allowed ? refundRateLimit(guestIp) : null,
      ceiling && all?.allowed ? refundRateLimit(ceiling) : null,
    ]);
  }
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        error: limitMessage(verdict),
        rateLimited: true,
        retryAfterS: verdict.retryAfterS,
      },
      {
        status: 429,
        headers: { "Retry-After": String(verdict.retryAfterS) },
      }
    );
  }
  if (shared && !shared.allowed) {
    return NextResponse.json(
      { error: limitMessage(shared), rateLimited: true, retryAfterS: shared.retryAfterS },
      { status: 429, headers: { "Retry-After": String(shared.retryAfterS) } }
    );
  }
  if (all && !all.allowed) {
    noteGuestFull("analyze", all);
    return NextResponse.json(
      { error: GUEST_FULL_COPY, rateLimited: true, guestFull: true, retryAfterS: all.retryAfterS },
      { status: 429, headers: { "Retry-After": String(all.retryAfterS) } }
    );
  }
  spend.subject = subject;
  if (guestIp) spend.guestIp = guestIp;
  if (ceiling) spend.ceiling = ceiling;

  const bossTopic =
    COLD_TOPICS.find((t) => t.id === field(form, "bossTopicId")) ??
    null;
  const mode: "daily" | "boss" = bossTopic ? "boss" : "daily";
  clock.mode = mode;
  // Stored as it arrives, so it is held to an id's shape: a control
  // character here made the save fail after Whisper had been paid for.
  const rawLesson = field(form, "lessonId");
  const lessonId =
    rawLesson && /^[\w:./-]{1,120}$/.test(rawLesson) ? rawLesson : undefined;
  /*
   * A game round (the games plan, items 3 and 10). The phone says what it
   * ran (`round`: the level, when Demos cut in, who stopped it); the round
   * is measured below against the words. A game's staged mods are paid
   * as entitled on any plan (#194: premium gates the picker, never the
   * games), Interruption only when he actually cut in, times the level's
   * multiplier. Extras the player stacked still follow the plan above.
   * A Premium game on a free plan is a round only as today's free game,
   * once (checked below, against the stored rounds).
   */
  const game = bossTopic ? null : gameOfLessonId(lessonId);
  const claim = game ? parseRoundField(form.get("round")) : null;

  const captureMode: CaptureMode =
    form.get("captureMode") === "voice_video" ? "voice_video" : "voice";
  // Presence is computed on the device from landmarks that never leave
  // it, so unlike the mods (DECISIONS #41) the server cannot recompute
  // it and does not try. That is safe precisely because Presence feeds
  // nothing else: not the Ethos Index, not stars, not XP, not the
  // league. A forged Presence lies only to the person who forged it.
  const { delivery, deliveryMoments } = parseDelivery(
    field(form, "delivery")
  );
  // When it was spoken, if the client says (the outbox's replay does).
  const recordedAt = spokenAt(form.get("recordedAt"));
  const tzOffset = numberOrNull(form.get("tzOffset"));

  /*
   * Everything the answer needs that does not wait on the words starts
   * here, beside Whisper (#472), where it used to run one read at a time
   * before it or after Demos's read. Each is the same call it was, read
   * where it was read; only the waiting moved.
   *
   * The client sends what it *ran*; the multiplier is recomputed below
   * from the mods this account is actually entitled to. A hand-edited
   * URL or a forged form field can change the difficulty of your rep,
   * never the XP it pays. A plan read that failed is unknown (null):
   * extras pay as free, and a Premium game's round is not refused on it.
   */
  const premiumRead$ = isPremium(userId).catch(() => null);
  const meterState$ = readMeterState(userId).catch(() => null);
  /*
   * The delta's other number. A boss compares like with like (the games
   * plan, item 16): last week's first scored boss, the slot beside this
   * one on the lobby's record, in the speaker's own week. No boss last
   * week, no delta: never one against a daily take, or against a week
   * the label would misname. The phone's own Mondays (`bossWeek`,
   * lib/boss.ts), so the week is the lobby's across a clock change; the
   * offset's week for a take without.
   */
  const lastWeek = bossTopic
    ? (parseBossWeek(form.get("bossWeek"), recordedAt ?? new Date()) ??
      lastBossWeek(recordedAt ?? new Date(), tzOffset))
    : null;
  const previous$: Promise<[number | null, number | null]> = userId
    ? Promise.all([
        (lastWeek
          ? bossIndexBetween(userId, lastWeek.from, lastWeek.to)
          : previousEthosIndex(userId)
        ).catch(() => null),
        previousPresence(userId).catch(() => null),
      ])
    : Promise.resolve([null, null]);
  /*
   * The game of the day's count (below), for a Premium game only, and
   * only once the plan read says the account is not on Premium. A count
   * that fails degrades open, as it did.
   */
  const day = game && needsPremium(game) ? gameDayWindow(recordedAt ?? new Date(), tzOffset) : null;
  const storedToday$: Promise<number> =
    game && day && userId
      ? premiumRead$.then((p) =>
          p === true ? 0 : gameRoundsBetween(userId, game.id, day.from, day.to).catch(() => 0)
        )
      : Promise.resolve(0);
  /*
   * The audio goes into the bucket now, for an owner only: a take sent
   * with no session is never stored. A take that ends up stored nowhere
   * (Whisper down, the mic barely heard, a failed save) has it taken
   * back out when the slot is settled.
   */
  if (userId) spend.audio = uploadRepAudio(audio, filename).catch(() => null);

  emit({ stage: "transcribing" });
  clock.mark("gateEnd");
  clock.mark("whisperStart");
  let transcription;
  try {
    transcription = await transcribe(audio, filename, {
      deadline: Math.min(
        Math.max(startedAt + WHISPER_BUDGET_MS, Date.now() + 5_000),
        startedAt + WHISPER_LAST_MS
      ),
    });
    clock.mark("whisperEnd");
    clock.takeS = transcription.durationS;
  } catch (e) {
    clock.mark("whisperEnd");
    const message = e instanceof Error ? e.message : "Transcription failed.";
    console.error("analyze transcription failed", message);
    const unconfigured = message.includes("OPENAI_API_KEY");
    // Whisper's own verdict on the FILE (it can't decode it, it's too
    // big, the type is wrong) is final: a resend gets the same answer,
    // so it is 422, which the outbox lets go of. Its 401 or 429, a 400
    // about the model (whisper-1 retired, lib/whisper-fault.ts)
    // and a Whisper cut off at its deadline are faults on our side and
    // stay a 502 to retry.
    const undecodable = isFileFault(message);
    // The slot was spent on our outage, not on the person's upload: give
    // it back, or each retry of one recording costs another. Only the
    // file's own fault (the 422 above) keeps its slot: a 401, 403 or 404
    // is our key or our model, answers 502, and is sent again up to four
    // times, so keeping those locked every tester out for the hour.
    spend.keep = undecodable;
    return NextResponse.json(
      // The upstream's own words stay in the log, never in the answer.
      // Upload shows this line as it is (lib/upload.ts uploadFailure).
      { error: undecodable ? "The audio couldn't be read." : "Transcription failed. Nothing was lost; try again." },
      { status: unconfigured ? 503 : undecodable ? 422 : 502 }
    );
  }

  /*
   * A take the mic barely heard (#406): under a second and a half of
   * audio, or more words than its length can hold (Whisper invents
   * speech over silence). Nothing is stored, the slot goes back, and the
   * phone says to check the mic. 422, so the outbox lets it go.
   */
  spend.paid = true;
  if (unheard(transcription.durationS, transcription.words.length)) {
    return NextResponse.json({ error: UNHEARD_COPY, unheard: true }, { status: 422 });
  }

  const metrics = computeMetrics(
    transcription.words,
    transcription.durationS,
    transcription.segments
  );

  // Judge every silence by where it landed, and keep the verdicts on the
  // pause list itself — `JudgedPause` is a `Pause` with a verdict and a
  // note, so the stored column, the pause bar and the results screen all
  // read the same rows.
  // The mic's own account of the gaps. Independent of Whisper, which
  // deletes non-lexical fillers — so a gap the transcript shows as empty
  // can still have had a sound in it.
  // The round reads it at the rate it was really taken at: phones before
  // the review sampled about 17 a second under a label of 20
  // (lib/envelope.ts). The pauses are judged only on one the phone
  // sampled on the take's clock (`pauseEnvelope`): an unmarked one,
  // refitted or not, judges none. And since #476 not even that one fills
  // a pause (`MIC_FILLS_PAUSE`, off): it is passed so that turning the
  // trace back on is one line, and judges nothing until then.
  const sent = parseEnvelope(field(form, "envelope"));
  const envelope = fitEnvelopeRate(sent, transcription.durationS);
  const pauses = pauseReport({
    pauses: metrics.pauses,
    words: transcription.words,
    fillers: metrics.fillers,
    durationS: metrics.durationS,
    segments: transcription.segments,
    envelope: pauseEnvelope(sent),
  });
  metrics.pauses = pauses.pauses;
  // Judged once: the Pause dimension scores the verdicts the take stores
  // and shows, so a gap with a sound in it is never a landing (#121, #422).
  const tier1 = tier1Scores(metrics, transcription.words, transcription.segments, pauses.pauses);
  const anchors = tier2Anchors(transcription.words, transcription.text);

  // Coach layer is best-effort — never blocks the numbers. A near-silent
  // rep has nothing to coach or judge; skip the call instead of burning it.
  // Boss reps additionally get fact-checked; the two calls are
  // independent so a failed check still returns full coaching.
  // A rep with nothing in it gets no Index and no coaching. Saying "I
  // don't know" eight times has zero fillers and a clean pace, and used
  // to come back three stars and a mid-500s Index — every number true in
  // isolation and the whole screen a lie. If there is no speech to
  // measure we say so instead of scoring the silence around it.
  const scorable = isScorable(metrics.substance);

  const premiumRead = await premiumRead$;
  const premium = premiumRead === true;
  const extras = parseMods(field(form, "mods"), { premium });
  /* The boss runs no mods (the games plan, item 16): the week's
     benchmark keeps its conditions, whatever a form says it ran. Its
     multiplier waits for the words: only a scored take pays the boss's. */
  let mods = bossTopic ? [] : extras;
  let multiplier = xpMultiplier(mods);
  // A boss take too short to score is filed at ×1, and pays nothing, as
  // no take with no star does anywhere (#510, lib/xp.ts `xpForTake`).
  if (bossTopic) multiplier = bossXpMultiplier(scorable);

  /*
   * Judged-tier metering (§3). The measured tier above has already run
   * and is free forever; what's rationed is the Claude call below.
   *
   * Two things this deliberately does NOT do: it does not block the rep
   * (the rep is stored either way, so the streak is untouched — streaks
   * count reps, not analyses), and it does not spend an analysis on a
   * rep with nothing in it. A near-silent rep has nothing to judge, so
   * burning one of the day's 3 (#514) on it would be theft.
   */
  const meterState = await meterState$;
  // The judged read of the day it was spoken, on the user's own
  // calendar. accrue never grants for an earlier day, so a backdated
  // take can only cost that day's read, never mint one.
  const spokenDay = localDate(recordedAt ?? new Date(), tzOffset);
  /*
   * A free account's read is claimed in the store before Demos reads
   * (#514 review, the scale audit's M6): a compare-and-swap, so takes
   * sent at once can never share one (lib/metering.ts `claimRead`). One
   * he never delivers is handed back below. Premium is never metered,
   * and a take with no session has no row to spend from.
   */
  const meterStore: MeterStore | null = userId
    ? {
        read: () => readMeterState(userId),
        swap: (from, to) => swapMeterState(userId, from, to),
      }
    : null;
  let decision: MeterDecision | null = null;
  let claimed: MeterState | null = null;
  if (scorable && meterState) {
    if (meterStore && !premium) {
      const claim = await claimRead({ state: meterState, now: spokenDay, store: meterStore });
      decision = claim.decision;
      if (claim.claimed) claimed = claim.decision.state;
    } else {
      decision = meter({ state: meterState, now: spokenDay, premium });
    }
  }
  const judgedAllowed = decision?.allowed ?? scorable;

  /* The words are in and measured: the wait shows them while Demos reads
     (#472). Only what the measured tier already holds; no score. */
  emit({
    stage: "measured",
    early: earlyRead({
      transcript: transcription.text,
      words: transcription.words,
      metrics,
      scorable,
      reads: scorable && judgedAllowed,
    }),
  });

  let coach: CoachOutput | null = null;
  let accuracy: AccuracyResult | null = null;
  if (scorable && judgedAllowed) {
    clock.mark("coachStart");
    const [coachResult, accuracyResult] = await Promise.allSettled([
      coachRep(
        transcription.text,
        metrics,
        tier1,
        anchors,
        startedAt + COACH_BUDGET_MS,
        (n) => {
          clock.coachAttempts = n;
        },
        (u) => clock.addUsage(u)
      ),
      bossTopic
        ? judgeAccuracy(transcription.text, bossTopic, startedAt + COACH_BUDGET_MS)
        : Promise.resolve(null),
    ]);
    clock.mark("coachEnd");
    coach = coachResult.status === "fulfilled" ? coachResult.value : null;
    /* A coach that threw used to vanish into allSettled: a spend cap or an
       outage at Anthropic read in the logs as nothing at all (docs/scale/
       audit.md M2, M9). Its status and error type go on the take's line;
       the take is stored measured, the read not spent, as before. */
    if (coachResult.status === "rejected") {
      clock.coachError = providerError(coachResult.reason);
      console.error("analyze coach failed", clock.coachError);
    }
    accuracy =
      accuracyResult.status === "fulfilled" ? accuracyResult.value : null;
  }
  emit({ stage: "saving" });
  clock.mark("saveStart");

  // An analysis the user never received must not cost them one: a read
  // claimed for a coach that failed goes back, beside the save, and is
  // back before the answer goes.
  const meterBack: Promise<unknown> =
    meterStore && claimed && !coach
      ? giveBackRead({ spent: claimed, store: meterStore }).catch(() => false)
      : Promise.resolve();

  // No substance, no Index — not a partial score, no score.
  const index = scorable
    ? ethosIndex(tier1, coach ? tier2Scores(coach) : null)
    : null;

  /*
   * The game of the day, held where it cannot be forged (the games plan,
   * item 12; games review, finding 3). A free account's Premium round is
   * measured, stored and paid as the game only on the speaker's own day
   * that game is free, and only while no round of it is stored that day,
   * as /api/hostile counts its weekly take. Any other is a recording like
   * any other: no round, and only the mods its plan pays. A count that
   * fails degrades open, like the plan read.
   */
  let roundOpen = true;
  if (game && day && premiumRead !== true) {
    const storedToday = await storedToday$;
    roundOpen = roundEntitled(game, { premium: premiumRead, dayKey: day.dayKey, storedToday });
  }

  let round: GameRound | null = null;
  if (game && roundOpen) {
    if (claim) {
      round = measureRound({
        game: game.id,
        level: claim.level,
        cutIns: claim.cutIns,
        stoppedBy: claim.stoppedBy,
        words: transcription.words,
        fillers: metrics.fillers,
        durationS: metrics.durationS,
        stars: metrics.stars,
        scorable,
        index,
        envelope,
      });
    }
    // The level the round is filed at, after the server's checks.
    const level = round?.level ?? claim?.level ?? 1;
    const fired = cutInFired(claim, metrics.durationS);
    mods = gameMods(game, level, { cutInFired: fired, extras });
    multiplier = gameXpMultiplier(game, level, fired, extras);
  }

  const [previousIndex, prevPresence] = await previous$;

  let repId: string | null = null;
  /* What the save paid (#510): nothing until a row is stored. */
  let xpPaidNow = 0;
  /*
   * A take sent with no session has no owner. No screen could show it
   * again, no account removal could reach it, and the phone already
   * counts it as never stored (lib/rep-outbox.ts, `settled`), so a voice
   * kept here was kept for nobody: five from August were, the only ones
   * ever (security audit, 11 Nov). It is scored, answered and let go,
   * and its slot stays spent, since nothing will be stored to keep it.
   */
  if (!userId) spend.keep = true;
  else try {
    const audioPath = (await spend.audio) ?? null;
    // From here the save answers for the audio (`Spend.audioOwned`).
    spend.audioOwned = true;
    const saved = await saveRep({
      audio,
      filename,
      audioPath,
      transcript: transcription.text,
      metrics,
      tier1,
      anchors,
      coach,
      ethosIndex: index,
      whisperRaw: transcription.raw,
      userId,
      lessonId,
      mode,
      mods: modIds(mods),
      xpMultiplier: multiplier,
      bossTopicId: bossTopic?.id ?? null,
      accuracy,
      captureMode,
      delivery,
      deliveryMoments,
      createdAt: recordedAt?.toISOString(),
      clientId,
      round,
      pauseRules: PAUSE_RULES,
    });
    // Nothing stored and nothing thrown: the audio is stored nowhere.
    if (!saved) spend.audioOwned = false;
    if (saved?.duplicate) {
      await meterBack;
      // An earlier send of this take was stored first and keeps its read;
      // this send's goes back (one take, one read).
      if (meterStore && claimed && coach) {
        await giveBackRead({ spent: claimed, store: meterStore }).catch(() => false);
      }
      clock.mark("saveEnd");
      clock.duplicate = true;
      return NextResponse.json({ repId: saved.id, duplicate: true });
    }
    repId = saved?.id ?? null;
    xpPaidNow = repId ? (saved?.xp ?? 0) : 0;
    spend.keep = repId !== null;
  } catch {
    repId = null;
  }
  await meterBack;
  clock.mark("saveEnd");

  const body: AnalyzeResponse = {
    transcript: transcription.text,
    words: transcription.words.map((w) => ({ word: w.word, start: w.start, end: w.end })),
    metrics,
    tier1,
    anchors,
    coach,
    ethosIndex: index,
    previousIndex,
    repId,
    scorable,
    pauseHeadline: pauses.headline,
    accuracy,
    mode,
    mods: modIds(mods),
    xpMultiplier: multiplier,
    xp: xpPaidNow,
    captureMode,
    delivery,
    deliveryMoments,
    previousPresence: prevPresence,
    round,
    pauseRules: PAUSE_RULES,
    judged: {
      ran: coach !== null,
      unlimited: decision?.unlimited ?? false,
      remaining: decision && !decision.unlimited ? decision.remaining : 0,
      capped: scorable && decision !== null && !decision.allowed,
      counted: claimed !== null && coach !== null,
    },
  };
  return NextResponse.json(body);
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return typeof v === "string" && v !== "" && Number.isFinite(n) ? n : null;
}

/**
 * The client sends five numbers and a list of timestamped moments —
 * never frames, never pixels. Anything malformed is dropped rather than
 * stored half-parsed.
 */
function parseDelivery(raw: string | null): {
  delivery: DeliveryMetrics | null;
  deliveryMoments: DeliveryMoment[];
} {
  // Five numbers and at most forty moments fit in far less than this, and
  // a NUL (plain or escaped) would make the save fail after Whisper ran.
  if (!raw || raw.length > 20_000 || raw.includes("\u0000") || raw.includes("\\u0000")) {
    return { delivery: null, deliveryMoments: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      metrics?: Partial<DeliveryMetrics>;
      moments?: DeliveryMoment[];
    };
    const m = parsed.metrics;
    if (!m || typeof m.presenceScore !== "number") {
      return { delivery: null, deliveryMoments: [] };
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return {
      delivery: {
        gestureRate: num(m.gestureRate),
        postureDrift: num(m.postureDrift),
        headStability: num(m.headStability),
        eyeLinePct: Math.max(0, Math.min(100, num(m.eyeLinePct))),
        // Nullable on purpose (#188): "the nose never tracked" is a
        // different claim from "carried at zero height".
        headLift:
          typeof m.headLift === "number" && Number.isFinite(m.headLift)
            ? m.headLift
            : null,
        neckGap:
          typeof m.neckGap === "number" && Number.isFinite(m.neckGap)
            ? m.neckGap
            : null,
        presenceScore: Math.max(0, Math.min(1000, Math.round(m.presenceScore))),
      },
      deliveryMoments: Array.isArray(parsed.moments)
        ? parsed.moments.slice(0, 40)
        : [],
    };
  } catch {
    return { delivery: null, deliveryMoments: [] };
  }
}
