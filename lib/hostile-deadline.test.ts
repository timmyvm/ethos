import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Hostile's model calls under a deadline (docs/scale/audit.md M7). With
 * none they ran on the SDK's ten minutes and two retries, three attempts
 * each, under a route killed at two minutes: a stalled question held the
 * person at the mic until the platform's 504, so the written fallback
 * never ran, and a slow verdict ended the same way with nothing said.
 * Now each phase has a deadline, the coach's way (lib/coach.ts): no
 * attempt starts too close to it, and the call in flight is cut off at it.
 */

const sdk = vi.hoisted(() => ({
  calls: [] as { signal?: AbortSignal }[],
  hang: false,
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
          return { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] };
        },
      },
    };
  },
}));

const { HOSTILE_MIN_ATTEMPT_MS, hostileQuestion, hostileVerdict } = await import("./hostile-server");

const CTX = { claim: "Remote work makes teams worse", take: "It does, because people stop talking", rounds: [] };
const DONE = { ...CTX, rounds: [{ question: "Which teams?", answer: "Mine, because nobody asks" }] };

/** The deadline's own timer, run short so a test does not wait it out. */
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
  sdk.fail = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Hostile's deadline", () => {
  it("cuts a question that never comes off at its deadline and answers null, so the route asks a written one", async () => {
    sdk.hang = true;
    const asked = shortTimers();
    expect(await hostileQuestion(CTX, Date.now() + 25_000)).toBeNull();
    expect(sdk.calls).toHaveLength(1);
    expect(sdk.calls[0].signal?.aborted).toBe(true);
    expect(asked[0]).toBeGreaterThan(24_000);
    expect(asked[0]).toBeLessThanOrEqual(25_000);
  });

  it("cuts a verdict that never comes off at its deadline and answers null, never throws", async () => {
    sdk.hang = true;
    shortTimers();
    expect(await hostileVerdict(DONE, [], Date.now() + 60_000)).toBeNull();
    expect(sdk.calls).toHaveLength(1);
  });

  it("starts no attempt with less than its minimum left", async () => {
    expect(await hostileQuestion(CTX, Date.now() + HOSTILE_MIN_ATTEMPT_MS - 1)).toBeNull();
    expect(await hostileVerdict(DONE, [], Date.now() + HOSTILE_MIN_ATTEMPT_MS - 1)).toBeNull();
    expect(sdk.calls).toHaveLength(0);
  });

  it("with no deadline makes every attempt with no signal, as before", async () => {
    expect(await hostileQuestion(CTX)).toBeNull();
    expect(sdk.calls).toHaveLength(3);
    expect(sdk.calls.every((c) => c.signal === undefined)).toBe(true);
  });

  it("still throws what is not the deadline, for the route's catch", async () => {
    sdk.fail = true;
    await expect(hostileVerdict(DONE, [], Date.now() + 60_000)).rejects.toThrow("overloaded");
  });
});
