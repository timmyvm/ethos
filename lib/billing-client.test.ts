import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The browser's billing calls against the routes' contract
 * (lib/billing-routes.test.ts): what each answer becomes, that nothing
 * throws, and that the token rides every call.
 */
const h = vi.hoisted(() => ({ token: "tok_user" as string | null, throws: false }));

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: {
      getSession: async () => {
        if (h.throws) throw new Error("storage blocked");
        return { data: { session: h.token ? { access_token: h.token } : null } };
      },
    },
  }),
}));

import {
  NEEDS_ACCOUNT,
  NO_SESSION,
  OFFLINE,
  cancelPlan,
  openPortal,
  resumePlan,
  startCheckout,
  syncPlan,
} from "./billing-client";

const ROW = {
  status: "active",
  ladder_month: 1,
  price_cents: 1299,
  next_price_cents: 1199,
  current_period_end: "2026-11-25T03:12:00.000Z",
  cancel_at_period_end: false,
};

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );

beforeEach(() => {
  h.token = "tok_user";
  h.throws = false;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("startCheckout", () => {
  it("posts the return path with the session's token and answers Checkout's url", async () => {
    answer(200, { url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(await startCheckout({ returnTo: "/games?paywall=1" })).toEqual({
      ok: true,
      kind: "checkout",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/billing/checkout");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok_user");
    expect(JSON.parse(init.body)).toEqual({ returnTo: "/games?paywall=1" });
  });

  it("answers manage for an account already on a plan", async () => {
    answer(200, { manage: true });
    expect(await startCheckout()).toEqual({ ok: true, kind: "manage" });
  });

  it("says a plan needs an account on the 403, and without any session at all", async () => {
    answer(403, { error: NEEDS_ACCOUNT, needsAccount: true });
    expect(await startCheckout()).toEqual({ ok: false, status: 403, error: NEEDS_ACCOUNT, needsAccount: true });
    h.token = null;
    expect(await startCheckout()).toMatchObject({ ok: false, needsAccount: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the server's own sentence on 429, 502 and 503, with the wait", async () => {
    answer(429, { error: "Too many tries. Give it an hour.", retryAfterS: 1200 });
    expect(await startCheckout()).toEqual({
      ok: false,
      status: 429,
      error: "Too many tries. Give it an hour.",
      retryAfterS: 1200,
    });
    answer(503, { error: "Checkout isn't switched on for this server." });
    expect(await startCheckout()).toMatchObject({ status: 503, error: "Checkout isn't switched on for this server." });
  });

  it("refuses an answer it cannot send anyone to", async () => {
    answer(200, { url: "javascript:alert(1)" });
    expect(await startCheckout()).toMatchObject({ ok: false, status: 200 });
    answer(200, { url: 42 });
    expect(await startCheckout()).toMatchObject({ ok: false });
    answer(200, "<html>proxy page</html>");
    expect(await startCheckout()).toMatchObject({
      ok: false,
      error: "Checkout didn't open, and nothing was charged. Try again in a minute.",
    });
  });

  it("never throws: an error page, a network failure and a hang are all calm sentences", async () => {
    answer(500, "Internal Server Error");
    expect(await startCheckout()).toMatchObject({ ok: false, status: 500 });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await startCheckout()).toEqual({ ok: false, status: 0, error: OFFLINE });
    h.throws = true;
    expect(await startCheckout()).toMatchObject({ ok: false, needsAccount: true });
  });

  it("gives up on a request that hangs", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))
    );
    const pending = startCheckout();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toEqual({ ok: false, status: 0, error: OFFLINE });
  });
});

describe("openPortal", () => {
  it("answers the portal's url, and 404 with the server's sentence", async () => {
    answer(200, { url: "https://billing.stripe.com/p/session/x" });
    expect(await openPortal({ returnTo: "/settings" })).toEqual({ ok: true, url: "https://billing.stripe.com/p/session/x" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ returnTo: "/settings" });
    answer(404, { error: "There's no plan on this account." });
    expect(await openPortal()).toEqual({ ok: false, status: 404, error: "There's no plan on this account." });
  });

  it("says the session expired without asking the server", async () => {
    h.token = null;
    expect(await openPortal()).toEqual({ ok: false, status: 401, error: NO_SESSION });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sync, cancel and resume", () => {
  it("answer the plan and premium", async () => {
    answer(200, { billing: ROW, premium: true });
    expect(await syncPlan()).toEqual({ ok: true, billing: ROW, premium: true });
    answer(200, { billing: null, premium: false });
    expect(await syncPlan()).toEqual({ ok: true, billing: null, premium: false });
    answer(200, { billing: { ...ROW, cancel_at_period_end: true, next_price_cents: null }, premium: true });
    expect(await cancelPlan()).toMatchObject({ ok: true, billing: { cancel_at_period_end: true } });
    answer(200, { billing: ROW, premium: true });
    expect(await resumePlan()).toMatchObject({ ok: true, billing: { cancel_at_period_end: false } });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/billing/sync",
      "/api/billing/sync",
      "/api/billing/cancel",
      "/api/billing/resume",
    ]);
  });

  it("pass the 409's sentence through, so the sheet can sync and show the fresh state", async () => {
    answer(409, { error: "This plan has ended. A new one starts at month 1." });
    expect(await resumePlan()).toEqual({
      ok: false,
      status: 409,
      error: "This plan has ended. A new one starts at month 1.",
    });
    answer(409, {});
    expect(await cancelPlan()).toEqual({ ok: false, status: 409, error: "Your plan didn't cancel. Try again in a minute." });
  });

  it("refuse a 200 that is not a plan", async () => {
    answer(200, { billing: "yes" , premium: true });
    expect(await syncPlan()).toMatchObject({ ok: false, error: "Your plan didn't load. Try again in a minute." });
    answer(200, { premium: true });
    expect(await syncPlan()).toMatchObject({ ok: false });
  });
});
