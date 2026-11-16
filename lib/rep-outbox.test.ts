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

  it("a send that lands drops what the visit held about recordings; one that fails keeps it (#433)", async () => {
    const { held, hold, resetHeld, PROFILE_KEY } = await import("./held");
    resetHeld();
    hold("spine", [1]);
    hold(PROFILE_KEY, { premium: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { error: "slow down" })));
    await sendWithRetry(replayForm(rep()), "token");
    expect(held("spine")).toEqual([1]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { repId: "r1" })));
    await sendWithRetry(replayForm(rep()), "token");
    expect(held("spine")).toBeUndefined();
    expect(held(PROFILE_KEY)).toEqual({ premium: false });
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

/*
 * #472: the recorder reads the answer in parts. The stages reach the
 * wait as they land; the status and body the ladder decides on are the
 * route's own, carried in the last line.
 */
describe("sendWithRetry reading the answer in parts", () => {
  const enc = new TextEncoder();
  const early = {
    durationS: 60,
    transcript: "So, um, hello",
    words: [],
    wordCount: 3,
    wpm: 3,
    fillerCount: 1,
    fillers: [{ word: "um", t: 0.4 }],
    scorable: true,
    reads: true,
  };
  function inParts(lines: unknown[], { cut = false } = {}): Response {
    /* One line a pull, then the end: a cut errors only on the pull after
       the last line, so the lines before it really reach the reader (an
       error raised beside queued lines drops them unread). */
    const queue = lines.map((l) => enc.encode(JSON.stringify(l) + "\n"));
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        const next = queue.shift();
        if (next) c.enqueue(next);
        else if (cut) c.error(new Error("reset"));
        else c.close();
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
  }

  it("asks for the parts only when someone is watching them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { repId: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendWithRetry(replayForm(rep()), "token");
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Accept).toBeUndefined();
    await sendWithRetry(replayForm(rep()), "token", undefined, undefined, () => {});
    expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Accept).toContain("application/x-ndjson");
  });

  it("hands the stages over in order and settles on the last line's answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        inParts([
          { stage: "received" },
          { stage: "transcribing" },
          { stage: "measured", early },
          { stage: "saving" },
          { stage: "done", status: 200, body: { repId: "r1", ethosIndex: 612 } },
        ])
      )
    );
    const seen: string[] = [];
    const out = await sendWithRetry(replayForm(rep()), "token", undefined, undefined, (e) => seen.push(e.stage));
    expect(seen).toEqual(["received", "transcribing", "measured", "saving"]);
    expect(out).toMatchObject({ ok: true, status: 200, settled: true, data: { repId: "r1", ethosIndex: 612 } });
  });

  it("sends again when the words came and the answer did not", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(inParts([{ stage: "received" }, { stage: "measured", early }], { cut: true }))
      .mockResolvedValueOnce(inParts([{ stage: "done", status: 200, body: { repId: "r1", duplicate: true } }]));
    vi.stubGlobal("fetch", fetchMock);
    const seen: string[] = [];
    const out = sendWithRetry(
      replayForm(rep()),
      "token",
      (n) => seen.push(`try ${n}`),
      undefined,
      (e) => seen.push(e.stage)
    );
    await vi.runAllTimersAsync();
    expect((await out).data).toEqual({ repId: "r1", duplicate: true });
    // The words reached the wait before the line went, and the resend followed.
    expect(seen).toEqual(["try 0", "received", "measured", "try 1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads a 5xx in the last line as weather, and a 422 as a verdict", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(inParts([{ stage: "received" }, { stage: "done", status: 502, body: { error: "x" } }]))
      .mockResolvedValueOnce(inParts([{ stage: "received" }, { stage: "done", status: 422, body: { unheard: true } }]));
    vi.stubGlobal("fetch", fetchMock);
    const out = sendWithRetry(replayForm(rep()), "token", undefined, undefined, () => {});
    await vi.runAllTimersAsync();
    expect(await out).toMatchObject({ ok: false, status: 422, data: { unheard: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes a lapsed sign-in said in the last line", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(inParts([{ stage: "received" }, { stage: "done", status: 401, body: { authExpired: true } }]))
      .mockResolvedValueOnce(inParts([{ stage: "done", status: 200, body: { repId: "r1" } }]));
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendWithRetry(replayForm(rep()), async (force) => (force ? "fresh" : "stale"), undefined, undefined, () => {});
    expect(out.settled).toBe(true);
    const auth = fetchMock.mock.calls.map((c) => (c[1].headers as Record<string, string>).Authorization);
    expect(auth).toEqual(["Bearer stale", "Bearer fresh"]);
  });
});

describe("sendWithRetry and a lapsed sign-in", () => {
  it("asks for a token on every try, so a long ladder never sends a stale one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, {}))
      .mockResolvedValueOnce(jsonResponse(200, { repId: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    let n = 0;
    const tokens = async () => `t${++n}`;
    const out = sendWithRetry(replayForm(rep()), tokens);
    await vi.runAllTimersAsync();
    expect((await out).settled).toBe(true);
    const auth = fetchMock.mock.calls.map((c) => (c[1].headers as Record<string, string>).Authorization);
    expect(auth).toEqual(["Bearer t1", "Bearer t2"]);
  });

  it("refreshes once on a 401 and sends again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { authExpired: true }))
      .mockResolvedValueOnce(jsonResponse(200, { repId: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    const forced: boolean[] = [];
    const tokens = async (force?: boolean) => {
      forced.push(!!force);
      return force ? "fresh" : "stale";
    };
    const out = await sendWithRetry(replayForm(rep()), tokens);
    expect(out.ok && out.settled).toBe(true);
    expect(forced).toEqual([false, true]);
  });

  it("keeps the recording when the sign-in stays lapsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { authExpired: true })));
    const out = await sendWithRetry(replayForm(rep()), async () => "stale");
    expect(out.settled).toBe(false);
    expect(out.status).toBe(401);
  });
});
