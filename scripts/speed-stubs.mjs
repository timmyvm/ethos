/**
 * Stubs for timing the wait after Stop (#499): loaded into a production
 * server with `--import`, they answer Whisper, Claude and the Supabase
 * project in place of the real ones, each after a set delay, and write a
 * line per call so the route's own waiting can be read call by call.
 * Nothing here runs in the app; it exists for scripts/measure-speed.mjs.
 *
 *   SPEED_WHISPER_MS=6000 SPEED_CLAUDE_MS=12000 SPEED_SUPA_MS=20 \
 *   SPEED_STUB_LOG=/tmp/stubs.jsonl OPENAI_API_KEY=stub ANTHROPIC_API_KEY=stub \
 *   SUPABASE_SERVICE_ROLE_KEY=stub NODE_OPTIONS="--import ./scripts/speed-stubs.mjs" \
 *   NEXT_DIST_DIR=.next-build npx next start -p 3952
 *   STOP_BASE=http://localhost:3952 ONLY=upload,stop node scripts/measure-speed.mjs stop
 *
 * Claude answers a refusal, so the coach returns nothing after its delay:
 * the timing is the call's, the take is stored measured. Whisper answers
 * a 60 second take of the look loop's transcript.
 */
import { appendFileSync } from "node:fs";

const WHISPER_MS = Number(process.env.SPEED_WHISPER_MS ?? 6000);
const CLAUDE_MS = Number(process.env.SPEED_CLAUDE_MS ?? 12000);
const SUPA_MS = Number(process.env.SPEED_SUPA_MS ?? 20);
const LOG = process.env.SPEED_STUB_LOG ?? null;
const realFetch = globalThis.fetch;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TEXT =
  "So the thing about habits is they compound. You do the small version every day and the big version arrives on its own. The mistake people make is waiting to feel ready. Ready is a feeling that shows up after you start, not before. I used to think discipline was the whole answer, and I would plan a week that no person could actually do, and then I would miss a day and quit the plan instead of the day. What changed was making the thing small enough that missing it felt stupid. Five minutes. Not an hour, not a session I have to clear an evening for, just five minutes I can do standing in a kitchen. And the odd part is that the five minutes usually turns into more, but it only does that because it was allowed to be five.";
const WORDS = TEXT.split(/\s+/);
const whisper = () => {
  const step = 58 / WORDS.length;
  const words = WORDS.map((w, i) => ({ word: w.replace(/[.,]/g, ""), start: +(1 + i * step).toFixed(2), end: +(1 + i * step + step * 0.8).toFixed(2) }));
  const segments = TEXT.split(/(?<=\.)\s+/).reduce((acc, s) => {
    const start = acc.length ? acc[acc.length - 1].end : 1;
    const n = s.split(/\s+/).length;
    acc.push({ start, end: +(start + n * step).toFixed(2), text: " " + s });
    return acc;
  }, []);
  return { text: TEXT, duration: 60, words, segments };
};

const json = (body, status = 200, headers = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function supabase(url, init, accept) {
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const single = /vnd\.pgrst\.object/.test(accept);
  if (path.startsWith("/auth/v1/user")) return json({ id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "speed@example.invalid", is_anonymous: false });
  if (path === "/rest/v1/rpc/consume_rate_limit") return json({ allowed: true, window: null, retry_after_s: 0 });
  if (path.startsWith("/rest/v1/rpc/")) return json(null);
  if (path.startsWith("/storage/v1/object")) return method === "DELETE" ? json([]) : json({ Key: path.replace("/storage/v1/object/", ""), Id: "speed" });
  if (method === "GET" || method === "HEAD") return single ? json({ code: "PGRST116", message: "0 rows" }, 406) : json([]);
  if (path.startsWith("/rest/v1/reps") && method === "POST") return single ? json({ id: "speed-rep" }, 201) : json([{ id: "speed-rep" }], 201);
  return method === "POST" ? json([], 201) : new Response(null, { status: 204 });
}

globalThis.fetch = async function stubbedFetch(input, init) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
  let kind = null, delay = 0;
  if (url.hostname === "api.openai.com") (kind = "whisper"), (delay = WHISPER_MS);
  else if (url.hostname === "api.anthropic.com") (kind = "claude"), (delay = CLAUDE_MS);
  else if (url.hostname === "supabase.local") (kind = "supabase"), (delay = SUPA_MS);
  if (!kind) return realFetch(input, init);
  const start = Date.now();
  // A body is read before the answer, as the real services do.
  if (init?.body && typeof init.body !== "string") {
    try {
      await new Response(init.body).arrayBuffer();
    } catch {}
  }
  await sleep(delay);
  let res;
  if (kind === "whisper") res = json(whisper());
  else if (kind === "claude")
    res = json({
      id: "msg_speed", type: "message", role: "assistant", model: "stub",
      content: [{ type: "text", text: "{}" }], stop_reason: "refusal", stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    }, 200, { "request-id": "speed" });
  else res = supabase(url, init, headers.get("accept") ?? "");
  if (LOG) {
    try {
      appendFileSync(LOG, JSON.stringify({ kind, method: (init?.method ?? "GET").toUpperCase(), path: url.pathname, start, end: Date.now() }) + "\n");
    } catch {}
  }
  return res;
};
