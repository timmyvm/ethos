import { describe, expect, it } from "vitest";
import { bearerMatches, tickSecrets } from "./cron-auth";

/* Who may tick the sender (#430): GitHub's secret or the database's. */
describe("the tick's secrets", () => {
  it("takes either secret that is set, and no blank one", () => {
    expect(tickSecrets({ CRON_SECRET: "a", PUSH_TICK_SECRET: "b" })).toEqual(["a", "b"]);
    expect(tickSecrets({ CRON_SECRET: "a", PUSH_TICK_SECRET: "  " })).toEqual(["a"]);
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
