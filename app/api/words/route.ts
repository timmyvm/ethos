/**
 * POST /api/words: the word sheet's answer (#411, #428). JSON in,
 * `{ word, sentence, at }` (`at` is where the word starts in the
 * sentence; an old client leaves it out and the word's first place
 * stands in). JSON out, `{ v: 2, verdict, replaces, alternatives, note,
 * source }`: swap with one to three ways to say `replaces` better, or
 * keep with one line that says why (lib/words.ts).
 *
 * In this order:
 *   1. The body: JSON, 2,000 characters at most, one word or a short
 *      phrase standing in its sentence (lib/words.ts cleanWordAsk).
 *   2. A session, guests' included (resolveAuthHeader): a stranger gets
 *      401 and the model is never asked.
 *   3. This instance's memory, by version, word, place and sentence: an
 *      answer already held costs nothing. No list answers before the
 *      sentence is read (the curated map left in #428).
 *   4. The limiter, per account (lib/rate-limit.ts `words`).
 *   5. Claude Haiku 5.5 (lib/words-server.ts); a failed or refused
 *      answer is 502, never remembered, and the sheet offers its retry.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthHeader } from "@/lib/db";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { WORDS_VERSION, cleanWordAsk, wordCacheKey } from "@/lib/words";
import { recallAnswer, rememberAnswer, suggestAnswer } from "@/lib/words-server";

export const runtime = "nodejs";

const BODY_CHARS = 2000;

const json = (body: Record<string, unknown>, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers });

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > BODY_CHARS) return json({ error: "Too large." }, 413);
  const text = await req.text().catch(() => "");
  if (text.length > BODY_CHARS) return json({ error: "Too large." }, 413);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const ask = cleanWordAsk(parsed);
  if (!ask) return json({ error: "One word and its sentence." }, 400);

  const auth = await resolveAuthHeader(req.headers.get("authorization")).catch(
    () => ({ kind: "unavailable" }) as const
  );
  if (auth.kind === "unavailable") return json({ error: "Try again." }, 503);
  if (auth.kind !== "user") return json({ error: "Sign in again." }, 401);

  const key = wordCacheKey(ask);
  const held = recallAnswer(key);
  if (held) return json({ v: WORDS_VERSION, ...held, source: "memory" });

  // A guest's words also count against their address, together: a new
  // guest session is free to make, and each one would bring its own 300
  // a day (security audit, 11 Nov; #416 did the same for recordings).
  const own = await consumeRateLimit(`words:u:${auth.user.id}`, "words");
  const verdict =
    own.allowed && auth.user.anonymous
      ? await consumeRateLimit(`words:guest:ip:${clientIp(req.headers)}`, "words")
      : own;
  if (!verdict.allowed) {
    return json(
      {
        error: `That's a lot of words for one ${verdict.window === "day" ? "day" : "hour"}. Try again later.`,
        retryAfterS: verdict.retryAfterS,
      },
      429,
      { "Retry-After": String(verdict.retryAfterS) }
    );
  }

  const answer = await suggestAnswer(ask).catch((e) => {
    console.error("words: the model call failed", e);
    return null;
  });
  if (!answer) return json({ error: "The alternatives didn't load." }, 502);
  rememberAnswer(key, answer);
  return json({ v: WORDS_VERSION, ...answer, source: "model" });
}
