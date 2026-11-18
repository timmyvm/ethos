import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The boss's fact-check and the word sheet's lookup on the clock (docs/
 * scale/audit.md M7, M12). The fact-check runs beside the coach and the
 * route waits on both, so with no deadline of its own a stalled check held
 * a boss take past the minute and the function was killed with nothing
 * stored; it now takes the coach's deadline. A lookup was the SDK's ten
 * minutes and two retries; it is cut off at 20 seconds.
 */

const sdk = vi.hoisted(() => ({ calls: [] as { signal?: AbortSignal }[], hang: false }));

vi.mock("@anthropic-ai/sdk", () => {
  const create = async (_body: unknown, opts?: { signal?: AbortSignal }) => {
    sdk.calls.push({ signal: opts?.signal });
    if (sdk.hang) {
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener("abort", () => reject(new Error("Request was aborted.")));
      });
    }
    return { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] };
  };
  return {
    default: class {
      messages = { create };
      beta = { messages: { create } };
    },
  };
});

const { ACCURACY_MIN_ATTEMPT_MS, judgeAccuracy } = await import("./accuracy");
const { WORDS_TIMEOUT_MS, suggestAnswer } = await import("./words-server");
const { COLD_TOPICS } = await import("./cold-topics");

const TAKE = "The thing about the Treaty of Versailles is that it ended the war and punished Germany hard.";

function shortTimers() {
  const asked: number[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    asked.push(ms);
    const c = new AbortController();
    setTimeout(() => c.abort(), 5);
    return c.signal;
  });
  return asked;
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  sdk.calls = [];
  sdk.hang = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("the boss's fact-check under the coach's deadline", () => {
  it("cuts a check that never answers off at the deadline and answers null, so the take is stored", async () => {
    sdk.hang = true;
    const asked = shortTimers();
    expect(await judgeAccuracy(TAKE, COLD_TOPICS[0], Date.now() + 40_000)).toBeNull();
    expect(sdk.calls).toHaveLength(1);
    expect(sdk.calls[0].signal?.aborted).toBe(true);
    expect(asked[0]).toBeGreaterThan(39_000);
  });

  it("starts no attempt with less than its minimum left, and none without a deadline is cut", async () => {
    expect(await judgeAccuracy(TAKE, COLD_TOPICS[0], Date.now() + ACCURACY_MIN_ATTEMPT_MS - 1)).toBeNull();
    expect(sdk.calls).toHaveLength(0);
    expect(await judgeAccuracy(TAKE, COLD_TOPICS[0])).toBeNull();
    expect(sdk.calls.length).toBeGreaterThan(0);
    expect(sdk.calls.every((c) => c.signal === undefined)).toBe(true);
  });
});

describe("the word sheet's lookup", () => {
  it("is cut off at 20 seconds, and the route answers that as a failed lookup", async () => {
    sdk.hang = true;
    const asked = shortTimers();
    await expect(suggestAnswer({ word: "thing", sentence: "the thing is", at: 4 })).rejects.toThrow(/aborted/);
    expect(asked).toEqual([WORDS_TIMEOUT_MS]);
    expect(WORDS_TIMEOUT_MS).toBe(20_000);
    const route = await import("@/app/api/words/route");
    expect(route.maxDuration).toBe(30);
  });
});
