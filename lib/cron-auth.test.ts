import { describe, expect, it, vi } from "vitest";
import { bearerMatches, dbTickMatches, matchedSecret, namedTickSecrets, tickCaller, tickSecrets } from "./cron-auth";

/* Who may tick the sender (#430): GitHub's secret or the database's. */
const A = "a".repeat(64);
const B = "b".repeat(32);

describe("the tick's secrets", () => {
  it("takes either secret that is set, and no blank one", () => {
    // Values long enough to clear the floor below (#430 review).
    expect(tickSecrets({ CRON_SECRET: A, PUSH_TICK_SECRET: B })).toEqual([A, B]);
    expect(tickSecrets({ CRON_SECRET: A, PUSH_TICK_SECRET: "  " })).toEqual([A]);
    expect(tickSecrets({})).toEqual([]);
  });

  it("matches a bearer to any of them, and nothing to none", () => {
    expect(bearerMatches("Bearer b", ["a", "b"])).toBe(true);
    expect(bearerMatches("Bearer a", ["a", "b"])).toBe(true);
    expect(bearerMatches("Bearer c", ["a", "b"])).toBe(false);
    expect(bearerMatches("Bearer ", [""])).toBe(false);
    expect(bearerMatches("Bearer a", [])).toBe(false);
    expect(bearerMatches(null, ["a"])).toBe(false);
    expect(bearerMatches("a", ["a"])).toBe(false);
    expect(bearerMatches("bearer a", ["a"])).toBe(false);
  });
});

/* #430 review: a weak secret fails closed, and the sender knows which one ticked. */
describe("the secrets' floor", () => {
  it("drops a PUSH_TICK_SECRET under 32 characters and says so once; CRON_SECRET keeps its old rule", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const short = "x".repeat(31);
      // GitHub's backup holds CRON_SECRET; its length cannot be read, so no floor on deploy.
      expect(tickSecrets({ CRON_SECRET: short, PUSH_TICK_SECRET: B })).toEqual([short, B]);
      expect(tickSecrets({ PUSH_TICK_SECRET: short })).toEqual([]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toMatch(/PUSH_TICK_SECRET is ignored.*openssl rand -hex 32/);
      // Padding is not length.
      expect(tickSecrets({ PUSH_TICK_SECRET: `  ${"y".repeat(20)}            ` })).toEqual([]);
    } finally {
      log.mockRestore();
    }
  });

  it("names the secret a bearer carries, and none for a wrong or weak one", () => {
    const named = namedTickSecrets({ CRON_SECRET: A, PUSH_TICK_SECRET: B });
    expect(matchedSecret(`Bearer ${A}`, named)).toBe("CRON_SECRET");
    expect(matchedSecret(`Bearer ${B}`, named)).toBe("PUSH_TICK_SECRET");
    expect(matchedSecret(`Bearer ${B.slice(1)}`, named)).toBeNull();
    expect(matchedSecret(`bearer ${A}`, named)).toBeNull();
    expect(matchedSecret(null, named)).toBeNull();
    const weak = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(matchedSecret("Bearer short", namedTickSecrets({ PUSH_TICK_SECRET: "short" }))).toBeNull();
    } finally {
      weak.mockRestore();
    }
  });

  it("tells the callers apart by their user agent", () => {
    expect(tickCaller("pg_net push-tick")).toBe("database");
    expect(tickCaller("pg_net/v0.14.0")).toBe("database");
    expect(tickCaller("Mozilla/4.0 (compatible; cron-job.org; http://cron-job.org/abuse/)")).toBe("cron-job.org");
    expect(tickCaller("github-actions push-cron")).toBe("github");
    expect(tickCaller("curl/8.5.0")).toBe("other");
    expect(tickCaller(null)).toBe("other");
  });
});

/* 0028: the database clock's secret never leaves the database; the sender asks it. */
describe("dbTickMatches", () => {
  const LONG = "d".repeat(64);
  const db = (answer: { data: unknown; error: unknown } | Error) => {
    const calls: unknown[] = [];
    return {
      calls,
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push([fn, args]);
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
      },
    };
  };

  it("asks push_tick_ok with the bearer, and takes only a true", async () => {
    const yes = db({ data: true, error: null });
    expect(await dbTickMatches(yes, `Bearer ${LONG}`)).toBe(true);
    expect(yes.calls).toEqual([["push_tick_ok", { token: LONG }]]);
    expect(await dbTickMatches(db({ data: false, error: null }), `Bearer ${LONG}`)).toBe(false);
    expect(await dbTickMatches(db({ data: "true", error: null }), `Bearer ${LONG}`)).toBe(false);
  });

  it("refuses on any failure, a short bearer, or no bearer, without asking", async () => {
    expect(await dbTickMatches(db({ data: true, error: { message: "no function" } }), `Bearer ${LONG}`)).toBe(false);
    expect(await dbTickMatches(db(new Error("down")), `Bearer ${LONG}`)).toBe(false);
    const short = db({ data: true, error: null });
    expect(await dbTickMatches(short, "Bearer short")).toBe(false);
    expect(await dbTickMatches(short, null)).toBe(false);
    expect(await dbTickMatches(short, LONG)).toBe(false);
    expect(short.calls).toEqual([]);
  });
});
