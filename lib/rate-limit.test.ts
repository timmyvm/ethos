import { describe, expect, it } from "vitest";
import { clientIp, limitMessage } from "./rate-limit";

describe("clientIp", () => {
  it("takes the first forwarded hop", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a named unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2"
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("limitMessage", () => {
  it("speaks minutes for the hourly window", () => {
    expect(
      limitMessage({ allowed: false, window: "hour", retryAfterS: 1200 })
    ).toBe("That's a lot of practice in one hour. The floor reopens in about 20 minutes.");
  });

  it("speaks hours for the daily window", () => {
    expect(
      limitMessage({ allowed: false, window: "day", retryAfterS: 6 * 3600 })
    ).toBe("That's the practice limit for today. It resets in about 6 hours.");
  });

  it("never promises less than a minute", () => {
    expect(
      limitMessage({ allowed: false, window: "hour", retryAfterS: 5 })
    ).toContain("a minute");
  });
});
