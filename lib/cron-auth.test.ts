import { describe, expect, it, vi } from "vitest";
import { bearerMatches, matchedSecret, namedTickSecrets, tickCaller, tickSecrets } from "./cron-auth";

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
  it("drops a secret under 32 characters, and says so once", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const short = "x".repeat(31);
      expect(tickSecrets({ CRON_SECRET: short, PUSH_TICK_SECRET: B })).toEqual([B]);
      expect(tickSecrets({ CRON_SECRET: short })).toEqual([]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toMatch(/CRON_SECRET is ignored.*openssl rand -hex 32/);
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
