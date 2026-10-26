import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isFinalReject,
  newOutboxId,
  ownedBy,
  replayForm,
  sendWithRetry,
  RETRY_DELAYS_MS,
  type OutboxRep,
} from "./rep-outbox";

function rep(fields: Record<string, string> = {}): OutboxRep {
  return {
    id: newOutboxId("l1-baseline"),
    createdAt: Date.now(),
    audio: new Blob(["a"], { type: "audio/webm" }),
    filename: "rep.webm",
    fields,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("newOutboxId", () => {
  it("carries the timestamp and the prompt id", () => {
    const id = newOutboxId("u2 pause!");
    expect(id).toMatch(/^\d+-u2_pause_-[a-z0-9-]+$/i);
  });

  it("never collides across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newOutboxId("x")));
    expect(ids.size).toBe(50);
  });
});

describe("replayForm", () => {
  it("rebuilds the exact form: audio plus every stored field", () => {
    const form = replayForm(
      rep({ lessonId: "l1", mods: "tight", tzOffset: "-600" })
    );
    expect(form.get("lessonId")).toBe("l1");
    expect(form.get("mods")).toBe("tight");
    expect(form.get("tzOffset")).toBe("-600");
    expect(form.get("audio")).toBeInstanceOf(Blob);
  });

  it("carries the outbox id as the recording's key, so a resend is never stored twice", () => {
    const r = rep({ lessonId: "l1" });
    expect(replayForm(r).get("clientId")).toBe(r.id);
  });

  it("says when the recording was spoken, so a late upload lands on its day", () => {
    const r = rep({ lessonId: "l1" });
    r.createdAt = Date.UTC(2026, 9, 20, 12, 50);
    expect(replayForm(r).get("recordedAt")).toBe(String(r.createdAt));
  });
});

describe("sendWithRetry", () => {
  it("confirms a stored rep on first success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { repId: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendWithRetry(replayForm(rep()), "token");
    expect(out.ok).toBe(true);
    expect(out.settled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 200 without a stored id settles only when nothing could store it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { repId: null }))
    );
    // With a session, an unstored rep is a server-side failure: keep it.
    expect((await sendWithRetry(new FormData(), "token")).settled).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { repId: null }))
    );
    // Local mode (no session): nothing will ever store it, let it go.
    expect((await sendWithRetry(new FormData(), null)).settled).toBe(true);
  });

  it("retries gateway 5xx and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, { error: "bad gateway" }))
      .mockResolvedValueOnce(jsonResponse(200, { repId: "r2" }));
    vi.stubGlobal("fetch", fetchMock);
    const p = sendWithRetry(new FormData(), "t");
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    const out = await p;
    expect(out.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a 4xx as a verdict, not weather: no retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: "limit" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendWithRetry(new FormData(), "t");
    expect(out.ok).toBe(false);
    expect(out.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the ladder is spent", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("net down"));
    vi.stubGlobal("fetch", fetchMock);
    const p = sendWithRetry(new FormData(), "t");
    for (const d of RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(d);
    const out = await p;
    expect(out.ok).toBe(false);
    expect(out.status).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });
});

describe("ownedBy", () => {
  const r = (owner?: string | null): OutboxRep => ({ ...rep(), ...(owner === undefined ? {} : { owner }) });

  it("keeps another account's recordings parked", () => {
    expect(ownedBy([r("a")], "b")).toEqual([]);
    expect(ownedBy([r("a")], null)).toEqual([]);
  });

  it("sends the signed-in account its own", () => {
    expect(ownedBy([r("a")], "a")).toHaveLength(1);
  });

  it("sends a recording from before owners only into a live session", () => {
    expect(ownedBy([r()], null)).toEqual([]);
    expect(ownedBy([r()], "a")).toHaveLength(1);
  });

  it("sends a recording made with no session to whoever this device is", () => {
    expect(ownedBy([r(null)], null)).toHaveLength(1);
    expect(ownedBy([r(null)], "a")).toHaveLength(1);
  });
});

describe("isFinalReject", () => {
  it("names the answers no resend can change", () => {
    expect([400, 413, 422].every(isFinalReject)).toBe(true);
    expect([0, 401, 429, 500, 502, 503].some(isFinalReject)).toBe(false);
  });
});

describe("sendWithRetry with one try", () => {
  it("sends once, and leaves the next try to the next flush", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(502, {}));
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendWithRetry(replayForm(rep()), "token", undefined, 1);
    expect(out.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
