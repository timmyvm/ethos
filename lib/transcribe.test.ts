import { describe, expect, it } from "vitest";
import { DISFLUENCY_PROMPT } from "./transcribe";

/**
 * A guard, not a unit test. Measured against generated speech carrying a
 * known 3 "um" and 2 "uh" on 11 Aug:
 *
 *   no prompt   → um 0, uh 0
 *   this prompt → um 3, uh 2
 *
 * Whisper deletes non-lexical fillers unless primed. The filler count is
 * the product's core number, so this string is load-bearing and a tidy-up
 * that "cleaned" it would silently gut the engine.
 */
describe("the disfluency prompt", () => {
  it("primes Whisper with the fillers it most wants to drop", () => {
    for (const filler of ["um", "uh", "like", "you know", "kind of"]) {
      expect(DISFLUENCY_PROMPT.toLowerCase()).toContain(filler);
    }
  });

  /**
   * A longer prompt recovered no more fillers and hallucinated "Thank you
   * for watching." onto six seconds of near-silence, where this one
   * returned nothing. More priming gives Whisper more to fall back on
   * when there is no signal, and an invented sentence would pass the
   * substance gate as a real rep.
   */
  it("stays short enough not to hallucinate over silence", () => {
    expect(DISFLUENCY_PROMPT.length).toBeLessThan(120);
  });
});

/*
 * Whisper as it grows (docs/scale/audit.md M1, M7, M10, FAIL-1): a call
 * with a deadline is cut off at it, a busy or failing Whisper is asked
 * once more when the deadline leaves room, and a 400 about the model is
 * ours, never the file's.
 */
describe("Whisper's deadline, its one retry and the file's own faults", async () => {
  const { afterEach, beforeEach, vi } = await import("vitest");
  const { transcribe, WHISPER_RETRY_MIN_MS } = await import("./transcribe");
  const { isFileFault } = await import("./whisper-fault");
  const OK = { text: "hello there", duration: 2, words: [{ word: "hello", start: 0, end: 0.5 }], segments: [] };
  const answer = (status: number, body: unknown = OK) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const audio = () => new Blob(["opus"], { type: "audio/webm" });
  let calls: { signal?: AbortSignal | null }[] = [];

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test";
    calls = [];
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const fetchAnswers = (...answers: (Response | Error | "hang")[]) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push({ signal: init.signal });
        const next = answers.shift() ?? answer(200);
        if (next === "hang") {
          return new Promise((_, reject) =>
            init.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "TimeoutError")))
          );
        }
        if (next instanceof Error) throw next;
        return next;
      })
    );

  it("asks once more after a 503 and hands back the words", async () => {
    fetchAnswers(answer(503, "overloaded"), answer(200));
    const t = await transcribe(audio(), "a.webm", { deadline: Date.now() + 50_000 });
    expect(t.text).toBe("hello there");
    expect(calls).toHaveLength(2);
  });

  it("asks once more after a 429 or a dropped connection, never a third time", async () => {
    fetchAnswers(answer(429, "slow down"), answer(429, "slow down"));
    await expect(transcribe(audio(), "a.webm", { deadline: Date.now() + 50_000 })).rejects.toThrow(/^Whisper API 429:/);
    expect(calls).toHaveLength(2);
    calls = [];
    fetchAnswers(new TypeError("fetch failed"), answer(200));
    expect((await transcribe(audio(), "a.webm", { deadline: Date.now() + 50_000 })).text).toBe("hello there");
    expect(calls).toHaveLength(2);
  });

  it("does not ask again with too little of the deadline left, or when the file is at fault", async () => {
    fetchAnswers(answer(503, "overloaded"));
    await expect(transcribe(audio(), "a.webm", { deadline: Date.now() + WHISPER_RETRY_MIN_MS - 1_000 })).rejects.toThrow(/^Whisper API 503:/);
    expect(calls).toHaveLength(1);
    calls = [];
    fetchAnswers(answer(400, '{"error":{"message":"Invalid file format.","param":"file"}}'));
    await expect(transcribe(audio(), "a.webm", { deadline: Date.now() + 50_000 })).rejects.toThrow(/^Whisper API 400:/);
    expect(calls).toHaveLength(1);
  });

  it("cuts a Whisper that never answers off at the deadline, and says it timed out", async () => {
    fetchAnswers("hang");
    const asked: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      asked.push(ms);
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), 5);
      return c.signal;
    });
    await expect(transcribe(audio(), "a.webm", { deadline: Date.now() + 40_000 })).rejects.toThrow(/^Whisper timed out/);
    expect(calls).toHaveLength(1);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(asked[0]).toBeGreaterThan(39_000);
    expect(asked[0]).toBeLessThanOrEqual(40_000);
  });

  it("with no deadline sends no signal, as before", async () => {
    fetchAnswers(answer(200));
    await transcribe(audio(), "a.webm");
    expect(calls[0].signal ?? undefined).toBeUndefined();
  });

  it("reads a 400, 413 or 415 about the file as the file's, and one about the model as ours", () => {
    expect(isFileFault('Whisper API 400: {"error":{"message":"Invalid file format. Supported formats: [flac, m4a, mp3, webm]","type":"invalid_request_error","param":null}}')).toBe(true);
    expect(isFileFault("Whisper API 413: Maximum content size limit (26214400) exceeded")).toBe(true);
    expect(isFileFault("Whisper API 415: unsupported")).toBe(true);
    // whisper-1 retired, however OpenAI words it.
    expect(isFileFault('Whisper API 400: {"error":{"message":"The model `whisper-1` has been deprecated.","type":"invalid_request_error","param":"model","code":"model_not_found"}}')).toBe(false);
    expect(isFileFault('Whisper API 400: {"error":{"message":"The model `whisper-1` does not exist or you do not have access to it."}}')).toBe(false);
    // Not the file's at all: down, busy, our key, cut off.
    for (const m of ["Whisper API 500: boom", "Whisper API 429: slow", "Whisper API 401: key", "Whisper timed out after 40000 ms.", "fetch failed"]) {
      expect(isFileFault(m), m).toBe(false);
    }
  });
});
