import { describe, expect, it, vi } from "vitest";
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

describe("refundRateLimit", () => {
  it("gives back the subject's newest slot through the server's function", async () => {
    vi.resetModules();
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    vi.doMock("./db", () => ({ supabaseAdmin: () => ({ rpc }) }));
    const { refundRateLimit } = await import("./rate-limit");
    await refundRateLimit("u:abc");
    expect(rpc).toHaveBeenCalledWith("refund_rate_limit", { p_subject: "u:abc" });
    vi.doUnmock("./db");
  });

  /*
   * 0017 is not on production yet (STATE.md: the connector stalls on its
   * delete), so the function can be missing. The refund is then made by
   * hand with the service role: the subject's newest row, by id.
   */
  it("gives the slot back by hand when the server's function is missing", async () => {
    vi.resetModules();
    const rows = [
      { id: 7, subject: "tester:ip:203.0.113.7", at: "2026-10-30T09:00:00Z" },
      { id: 9, subject: "tester:ip:203.0.113.7", at: "2026-10-30T09:05:00Z" },
      { id: 8, subject: "u:other", at: "2026-10-30T09:06:00Z" },
    ];
    const calls: string[] = [];
    const from = (table: string) => {
      const filters: [string, unknown][] = [];
      let op = "select";
      const chain = {
        select: () => chain,
        delete: () => ((op = "delete"), chain),
        eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          const found = rows
            .filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v))
            .sort((a, b) => (a.at < b.at ? 1 : -1));
          return { data: found[0] ? { id: found[0].id } : null, error: null };
        },
        then: (ok: (r: unknown) => unknown) => {
          calls.push(`${op} ${table} ${JSON.stringify(filters)}`);
          if (op === "delete") {
            for (const [c, v] of filters) {
              const i = rows.findIndex((r) => (r as Record<string, unknown>)[c] === v);
              if (i >= 0) rows.splice(i, 1);
            }
          }
          return Promise.resolve({ data: null, error: null }).then(ok);
        },
      };
      return chain;
    };
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.refund_rate_limit(p_subject)" },
    }));
    vi.doMock("./db", () => ({ supabaseAdmin: () => ({ rpc, from }) }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { refundRateLimit } = await import("./rate-limit");
    await refundRateLimit("tester:ip:203.0.113.7");
    expect(rows.map((r) => r.id)).toEqual([7, 8]);
    expect(calls).toEqual([`delete rate_limits [["id",9]]`]);
    vi.doUnmock("./db");
    vi.restoreAllMocks();
  });

  it("never throws, like the check it undoes", async () => {
    vi.resetModules();
    vi.doMock("./db", () => ({
      supabaseAdmin: () => ({
        rpc: async () => {
          throw new Error("down");
        },
      }),
    }));
    const { refundRateLimit } = await import("./rate-limit");
    await expect(refundRateLimit("u:abc")).resolves.toBeUndefined();
    vi.doUnmock("./db");
  });
});
