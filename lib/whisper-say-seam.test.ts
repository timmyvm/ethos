import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/*
 * #512's Whisper deadline and one retry, with /api/say and the 32 kbps
 * recorder, and the outbox on a 502 (the final pass of 19 Nov). Each was
 * built and reviewed on its own branch, the route's tests with Whisper
 * mocked and Whisper's own with no route. Here the route runs the real
 * lib/transcribe.ts (only the network is a stand-in), so the 20 seconds
 * /api/say gives Whisper and the 15 seconds a retry needs are tried
 * together, and the analyze route's answer to a Whisper cut off at its
 * deadline goes through the outbox as the recorder reads it, in lines.
 */

vi.mock("@/lib/db", () => ({
  resolveAuthHeader: vi.fn(async (header: string | null) =>
    header === "Bearer tok" ? { kind: "user", user: { id: "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40", anonymous: false, email: null } } : { kind: "none" }
  ),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () => ({ allowed: true, window: null, retryAfterS: 0 })),
}));

const { POST, maxDuration } = await import("@/app/api/say/route");
const { WHISPER_RETRY_MIN_MS } = await import("./transcribe");
const { SAY_AUDIO_BYTES } = await import("./say");
const { SPEECH_BITS_PER_SECOND } = await import("./speech-recorder");
const { isFinalReject, sendWithRetry, RETRY_DELAYS_MS } = await import("./rep-outbox");
const { STREAM_TYPE, encodeLine } = await import("./analyze-stream");

const WORDS = { text: "So the point is, habits compound.", duration: 3, words: [
  { word: "So", start: 0.2, end: 0.4 }, { word: "the", start: 0.5, end: 0.6 }, { word: "point", start: 0.7, end: 0.9 },
  { word: "is", start: 1.0, end: 1.1 }, { word: "habits", start: 1.2, end: 1.5 }, { word: "compound", start: 1.6, end: 2.1 },
], segments: [] };
const whisper = (status: number, body: unknown = WORDS) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Whisper's side of the wire: each answer in turn, "hang" for one that never comes. */
let asked: { signal?: AbortSignal | null; at: number }[] = [];
function whisperAnswers(...answers: (Response | "hang" | { after: number; answer: Response })[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (!String(url).includes("api.openai.com")) throw new Error(`unexpected fetch ${url}`);
      asked.push({ signal: init.signal, at: Date.now() });
      const next = answers.shift() ?? whisper(200);
      if (next === "hang") {
        return new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "TimeoutError")))
        );
      }
      if ("after" in next) {
        vi.setSystemTime(Date.now() + next.after);
        return next.answer;
      }
      return next;
    })
  );
}

function line(bytes = 57_828, type = "audio/webm;codecs=opus") {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(bytes)], { type }), "line.webm");
  form.append("better", "the point is");
  form.append("said", "the thing is");
  const req = new Request("http://test.local/api/say", { method: "POST", headers: { Authorization: "Bearer tok" }, body: form });
  return POST(req as unknown as NextRequest);
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  asked = [];
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/say with Whisper's deadline and its one retry (#507 with #512)", () => {
  it("asks a busy Whisper once more inside the line's 20 seconds, and hears the line", async () => {
    whisperAnswers(whisper(503, "overloaded"), whisper(200));
    const res = await line();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { heard: boolean }).heard).toBe(true);
    expect(asked).toHaveLength(2);
    // Both tries carry the line's deadline: neither can run past 20 s.
    expect(asked.every((a) => a.signal)).toBe(true);
  });

  it("does not ask again once fewer than 15 of the 20 seconds are left, and says the line did not come through", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Whisper answers 503 six seconds in: 14 s left, under the retry's 15.
    whisperAnswers({ after: 6_000, answer: whisper(503, "overloaded") });
    const res = await line();
    expect(res.status).toBe(502);
    expect(asked).toHaveLength(1);
    expect(20_000 - 6_000).toBeLessThan(WHISPER_RETRY_MIN_MS);
    // The walk reads a 502 as "not heard", with its retry: never as a miss.
    const page = readFileSync(path.resolve(__dirname, "../app/say/test/page.tsx"), "utf8");
    expect(page).toMatch(/res\.status === 502\) return setPhase\("unheard"\)/);
  });

  it("cuts a Whisper that never answers off at 20 seconds from the request, inside the route's 30", async () => {
    whisperAnswers("hang");
    const timeouts: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      timeouts.push(ms);
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), 5);
      return c.signal;
    });
    const res = await line();
    expect(res.status).toBe(502);
    expect(asked).toHaveLength(1);
    expect(timeouts[0]).toBeGreaterThan(19_000);
    expect(timeouts[0]).toBeLessThanOrEqual(20_000);
    expect(maxDuration).toBe(30);
    expect(maxDuration * 1000 - timeouts[0]).toBeGreaterThanOrEqual(10_000);
  });

  it("takes the longest line the walk records at 32 kbps with room to spare, and at a browser's default rate too", () => {
    const page = readFileSync(path.resolve(__dirname, "../app/say/test/page.tsx"), "utf8");
    const longest = Number(/const LINE_MAX_S = (\d+);/.exec(page)?.[1]);
    expect(longest).toBeGreaterThan(0);
    // 15 s at 32 kbps is about 60 KB: up in a breath on mobile data, a
    // small share of the 20 s; a browser that ignores the rate (128 kbps)
    // still sends under the megabyte.
    expect((SPEECH_BITS_PER_SECOND * longest) / 8).toBeLessThan(SAY_AUDIO_BYTES / 10);
    expect((128_000 * longest) / 8).toBeLessThan(SAY_AUDIO_BYTES);
  });
});

describe("the outbox keeps a take Whisper's deadline cut off (#512 with the recorder's lines, #472)", () => {
  /** The analyze route's answer to a Whisper cut off at its deadline, as lines (Accept: STREAM_TYPE). */
  const cutOff = () =>
    new Response(
      [
        encodeLine({ stage: "received" }),
        encodeLine({ stage: "transcribing" }),
        encodeLine({ stage: "done", status: 502, body: { error: "Transcription failed. Nothing was lost; try again." } }),
      ].join(""),
      { status: 200, headers: { "content-type": STREAM_TYPE } }
    );

  it("reads the 502 inside the lines, sends it again up the ladder, and never lets it go", async () => {
    vi.useFakeTimers();
    let sends = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        sends++;
        return cutOff();
      })
    );
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(170_000)], { type: "audio/webm" }), "rep.webm");
    const stages: string[] = [];
    const out = sendWithRetry(form, "tok", undefined, undefined, (e) => stages.push(e.stage));
    await vi.runAllTimersAsync();
    const outcome = await out;
    expect(outcome).toMatchObject({ ok: false, status: 502, settled: false });
    expect(sends).toBe(RETRY_DELAYS_MS.length + 1);
    expect(stages.filter((s) => s === "transcribing")).toHaveLength(sends);
    // A 502 is weather: the outbox holds the take for the next open.
    expect(isFinalReject(outcome.status)).toBe(false);
  });
});
