/**
 * POST /api/words: the word sheet's thesaurus (#411). JSON in,
 * `{ word, sentence }`; JSON out, `{ alternatives }`, three to six words
 * that fit the sentence the word was said in.
 *
 * In this order:
 *   1. The body: JSON, 2,000 characters at most, one word or a short
 *      phrase and its sentence (lib/words.ts cleanWordAsk).
 *   2. A session, guests' included (resolveAuthHeader): a stranger gets
 *      401 and the model is never asked.
 *   3. The curated map (lib/thesaurus.ts) and this instance's memory,
 *      by word and sentence: an answer already held costs nothing.
 *   4. The limiter, per account (lib/rate-limit.ts `words`).
 *   5. Claude Haiku 5.5 (lib/words-server.ts); a failed or refused
 *      answer is 502, and the sheet offers its retry.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthHeader } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { curatedFor } from "@/lib/thesaurus";
import { cleanWordAsk, wordCacheKey } from "@/lib/words";
import { recallWords, rememberWords, suggestAlternatives } from "@/lib/words-server";

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

  const curated = curatedFor(ask.word);
  if (curated) return json({ alternatives: [...curated], source: "curated" });
  const key = wordCacheKey(ask);
  const held = recallWords(key);
  if (held) return json({ alternatives: held, source: "memory" });

  const verdict = await consumeRateLimit(`words:u:${auth.user.id}`, "words");
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

  const alternatives = await suggestAlternatives(ask).catch((e) => {
    console.error("words: the model call failed", e);
    return null;
  });
  if (!alternatives) return json({ error: "The alternatives didn't load." }, 502);
  rememberWords(key, alternatives);
  return json({ alternatives, source: "model" });
}
