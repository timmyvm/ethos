/**
 * POST /api/say: Say it better's test, one line said out loud (#507).
 *
 * The test asks for your own sentence again, said better, and this is
 * how it hears it: the line goes to Whisper with word timestamps, and the
 * answer is whether the better phrase was said, where, and what Whisper
 * heard. Nothing else happens. This is not /api/analyze: the line is not
 * stored, not scored, not in the Log; it pays no XP, no streak and no
 * stars; it never counts toward "you now say", which only a later real
 * recording moves (lib/say.ts usesOf).
 *
 * In this order:
 *   1. The size: a line is a few seconds, so a megabyte at most.
 *   2. A session, guests' included (resolveAuthHeader): a stranger gets
 *      401 and Whisper is never asked.
 *   3. The form: `audio` (the line), `better` (the phrase listened for)
 *      and `said` (the phrase it replaces, so a miss can say "You said
 *      'the thing is'"), each phrase 120 characters at most (SAY_PHRASE_CHARS).
 *   4. The limiter (lib/rate-limit.ts `say`, per account); a guest also
 *      counts against every guest on its address (`say` again, as the
 *      word sheet does: a new guest session is free to make, and each
 *      would bring its own room), then against every guest's ceiling
 *      (`guestall`), as a recording does, since this pays for Whisper
 *      too. Without the address's room one address minting guests could
 *      spend the ceiling every guest's recordings share.
 *   5. Whisper (lib/transcribe.ts); a failure is 502 and the walk says
 *      it did not hear it, with its retry.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthHeader } from "@/lib/db";
import { GUEST_CEILING, clientIp, consumeRateLimit, noteGuestFull } from "@/lib/rate-limit";
import { SAY_AUDIO_BYTES, SAY_LIMITED, checkLine, cleanPhrase } from "@/lib/say";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";
/*
 * One line of a few seconds: Whisper has its words by 20 seconds or the
 * line is answered as one that did not come through, inside a function
 * of 30, where the default held an instance for Fluid's 300 on a hung
 * call (docs/scale/audit.md M12).
 */
export const maxDuration = 30;
const WHISPER_BY_MS = 20_000;

const json = (body: Record<string, unknown>, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers });

/** The audio types a phone records (MediaRecorder's webm and mp4, Safari's m4a). */
const AUDIO = /^audio\/(webm|mp4|mpeg|ogg|wav|x-m4a|aac)(;.*)?$/;
const EXT: Record<string, string> = { webm: "webm", mp4: "mp4", mpeg: "mp3", ogg: "ogg", wav: "wav", "x-m4a": "m4a", aac: "aac" };

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > SAY_AUDIO_BYTES + 8192) return json({ error: "Too long. Say just the one line." }, 413);

  const auth = await resolveAuthHeader(req.headers.get("authorization")).catch(
    () => ({ kind: "unavailable" }) as const
  );
  if (auth.kind === "unavailable") return json({ error: "Try again." }, 503);
  if (auth.kind !== "user") return json({ error: "Sign in again." }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Say the line again." }, 400);
  }
  const audio = form.get("audio");
  const better = cleanPhrase(form.get("better"));
  const said = cleanPhrase(form.get("said"));
  if (!(audio instanceof Blob) || audio.size === 0 || !better) return json({ error: "Say the line again." }, 400);
  if (audio.size > SAY_AUDIO_BYTES) return json({ error: "Too long. Say just the one line." }, 413);
  const type = AUDIO.exec(audio.type || "audio/webm");
  if (!type) return json({ error: "Say the line again." }, 415);

  const own = await consumeRateLimit(`say:u:${auth.user.id}`, "say");
  const shared =
    own.allowed && auth.user.anonymous ? await consumeRateLimit(`say:guest:ip:${clientIp(req.headers)}`, "say") : own;
  const verdict = shared.allowed && auth.user.anonymous ? await consumeRateLimit(GUEST_CEILING, "guestall") : shared;
  if (!verdict.allowed && verdict !== shared) noteGuestFull("say", verdict);
  if (!verdict.allowed) {
    return json(
      { error: SAY_LIMITED, retryAfterS: verdict.retryAfterS },
      429,
      { "Retry-After": String(verdict.retryAfterS) }
    );
  }

  const heard = await transcribe(audio, `line.${EXT[type[1]] ?? "webm"}`, { deadline: startedAt + WHISPER_BY_MS }).catch((e) => {
    console.error("say: Whisper failed", e instanceof Error ? e.message : e);
    return null;
  });
  if (!heard) return json({ error: "That didn't come through. Say it again." }, 502);
  return json({ ...checkLine({ text: heard.text, words: heard.words }, better, said) });
}
