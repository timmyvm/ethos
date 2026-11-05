import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The scoring function is killed at 60 seconds, and a killed function
 * stores nothing, keeps the person's slot and is sent again whole. Three
 * sequential coach attempts after Whisper can reach that, so the coach
 * takes a deadline: no attempt starts too close to it, and the one in
 * flight is cut off at it. Either way the recording is stored measured.
 */

const sdk = vi.hoisted(() => ({
  calls: [] as { signal?: AbortSignal }[],
  /** How long each answer takes, on the clock the coach reads. */
  takesMs: 0,
  /** Never answer: wait for the signal. */
  hang: false,
  /** Fail the way the API does when it is down. */
  fail: false,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        create: async (_body: unknown, opts?: { signal?: AbortSignal }) => {
          sdk.calls.push({ signal: opts?.signal });
          if (sdk.fail) throw new Error("overloaded");
          if (sdk.hang) {
            return new Promise((_, reject) => {
              opts?.signal?.addEventListener("abort", () => reject(new Error("Request was aborted.")));
            });
          }
          vi.setSystemTime(Date.now() + sdk.takesMs);
          // Never valid JSON: every attempt is retried while time allows.
          return { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] };
        },
      },
    };
  },
}));

const { coachRep, MIN_ATTEMPT_MS } = await import("./coach");
const { tier1Scores, tier2Anchors } = await import("./index-score");
const { computeMetrics } = await import("./metrics");

function fixture() {
  const words = [
    { word: "So", start: 0, end: 0.2 },
    { word: " I", start: 0.3, end: 0.4 },
    { word: " build", start: 0.5, end: 0.8 },
    { word: " speech", start: 0.9, end: 1.2 },
    { word: " apps", start: 1.3, end: 58 },
  ];
  const transcript = "So I build speech apps";
  const metrics = computeMetrics(words, 60);
  return { transcript, metrics, tier1: tier1Scores(metrics, words, []), anchors: tier2Anchors(words, transcript) };
}

const run = (deadline?: number) => {
  const f = fixture();
  return coachRep(f.transcript, f.metrics, f.tier1, f.anchors, deadline);
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  vi.useFakeTimers({ toFake: ["Date"] });
  sdk.calls = [];
  sdk.takesMs = 0;
  sdk.hang = false;
  sdk.fail = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the coach's deadline", () => {
  it("makes all three attempts when nobody gives it one", async () => {
    sdk.takesMs = 20_000;
    expect(await run()).toBeNull();
    expect(sdk.calls).toHaveLength(3);
    expect(sdk.calls[0].signal).toBeUndefined();
  });

  it("starts no attempt it has no time to finish", async () => {
    sdk.takesMs = 20_000;
    // 45 seconds: the first two fit, the third would start with 5 left.
    expect(await run(Date.now() + 45_000)).toBeNull();
    expect(sdk.calls).toHaveLength(2);
  });

  it("makes no call at all once the time is gone", async () => {
    expect(await run(Date.now() + MIN_ATTEMPT_MS - 1)).toBeNull();
    expect(sdk.calls).toHaveLength(0);
  });

  it("cuts the call in flight off at the deadline and answers null, never throws", async () => {
    vi.useRealTimers();
    sdk.hang = true;
    // The deadline's own timer, run short so the test does not wait it out.
    const asked: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      asked.push(ms);
      const c = new AbortController();
      setTimeout(() => c.abort(), 5);
      return c.signal;
    });
    const got = await run(Date.now() + 30_000);
    expect(got).toBeNull();
    expect(sdk.calls).toHaveLength(1);
    expect(sdk.calls[0].signal?.aborted).toBe(true);
    expect(asked[0]).toBeGreaterThan(29_000);
    expect(asked[0]).toBeLessThanOrEqual(30_000);
  });

  it("still throws what is not the deadline, as before", async () => {
    sdk.fail = true;
    await expect(run(Date.now() + 30_000)).rejects.toThrow("overloaded");
  });
});
