import { afterEach, describe, expect, it, vi } from "vitest";
import {
  newOutboxId,
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
