import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/say (#507): the test's one line, said out loud and checked by
 * Whisper. A stranger is refused before Whisper is asked, the limiter
 * counts every line, and nothing is ever stored: no recording, no XP, no
 * streak, no stars, nothing the Log or "you now say" could read. Whisper
 * is mocked; the database module is mocked so any write would be caught.
 */

const h = vi.hoisted(() => ({
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: false,
  consumed: [] as string[],
  heard: { text: "So the point is, habits compound.", words: [] as { word: string; start: number; end: number }[] },
  whisperFails: false,
  transcribed: 0,
  writes: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  resolveAuthHeader: vi.fn(async (header: string | null) => {
    if (!header?.startsWith("Bearer ")) return { kind: "none" };
    const user = h.sessions.get(header.slice(7));
    return user ? { kind: "user", user } : { kind: "rejected" };
  }),
  /* Anything that stores goes through these: none may be called. */
  supabaseAdmin: vi.fn(() => {
    h.writes.push("supabaseAdmin");
    return null;
  }),
  saveRep: vi.fn(async () => {
    h.writes.push("saveRep");
    return null;
  }),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async (subject: string, tier: string) => {
    h.consumed.push(`${tier}:${subject}`);
    return h.limited ? { allowed: false, window: "hour", retryAfterS: 900 } : { allowed: true, window: null, retryAfterS: 0 };
  }),
}));
vi.mock("@/lib/transcribe", () => ({
  transcribe: vi.fn(async () => {
    h.transcribed++;
    if (h.whisperFails) throw new Error("Whisper API 500");
    return { ...h.heard, durationS: 3, segments: [], raw: {} };
  }),
}));

import { POST } from "@/app/api/say/route";
import { LIMITS } from "@/lib/rate-limit";
import { SAY_AUDIO_BYTES } from "@/lib/say";

const ME = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";

function line(opts: { token?: string | null; better?: string | null; said?: string | null; bytes?: number; type?: string } = {}) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(opts.bytes ?? 2400)], { type: opts.type ?? "audio/webm;codecs=opus" }), "line.webm");
  if (opts.better !== null) form.append("better", opts.better ?? "the point is");
  if (opts.said !== null) form.append("said", opts.said ?? "the thing is");
  const token = opts.token === undefined ? "tok" : opts.token;
  const req = new Request("http://test.local/api/say", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return POST(req as unknown as NextRequest);
}

const timed = (text: string) => text.split(/\s+/).map((word, i) => ({ word, start: 0.2 + i * 0.4, end: 0.5 + i * 0.4 }));

beforeEach(() => {
  h.sessions.clear();
  h.sessions.set("tok", { id: ME, anonymous: false, email: "a@b.c" });
  h.sessions.set("guest", { id: "g1", anonymous: true, email: null });
  h.limited = false;
  h.consumed = [];
  h.whisperFails = false;
  h.transcribed = 0;
  h.writes = [];
  h.heard = { text: "So the point is, habits compound.", words: timed("So the point is habits compound") };
});

describe("POST /api/say", () => {
  it("hears the better phrase, says where, and what was heard", async () => {
    const res = await line();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ heard: true, old: false, text: "So the point is, habits compound." });
    expect(body.at).toBeCloseTo(0.6);
  });

  it("says when the old phrase was said instead", async () => {
    h.heard = { text: "So the thing is, habits compound.", words: timed("So the thing is habits compound") };
    expect(await (await line()).json()).toMatchObject({ heard: false, old: true, at: null });
  });

  it("refuses a stranger before Whisper is asked, and a bad session too", async () => {
    expect((await line({ token: null })).status).toBe(401);
    expect((await line({ token: "nope" })).status).toBe(401);
    expect(h.transcribed).toBe(0);
    expect(h.consumed).toEqual([]);
  });

  it("counts every line against the account's own room, and a guest's against every guest's too", async () => {
    await line();
    expect(h.consumed).toEqual([`say:say:u:${ME}`]);
    h.consumed = [];
    await line({ token: "guest" });
    expect(h.consumed).toEqual(["say:say:u:g1", "guestall:guest:all"]);
    expect(LIMITS.say.hour).toBeGreaterThanOrEqual(9);
  });

  it("answers 429 with its wait when the room is spent, and asks Whisper nothing", async () => {
    h.limited = true;
    const res = await line();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(h.transcribed).toBe(0);
  });

  it("takes a short line only, and only with a phrase to listen for", async () => {
    expect((await line({ bytes: SAY_AUDIO_BYTES + 1 })).status).toBe(413);
    expect((await line({ better: null })).status).toBe(400);
    expect((await line({ better: "x".repeat(61) })).status).toBe(400);
    expect((await line({ type: "text/html" })).status).toBe(415);
    expect(h.transcribed).toBe(0);
  });

  it("says Whisper did not answer as a 502, never as a miss", async () => {
    h.whisperFails = true;
    const res = await line();
    expect(res.status).toBe(502);
  });

  it("stores nothing: no recording, no XP, no streak, nothing the count could read", async () => {
    await line();
    await line({ token: "guest" });
    h.whisperFails = true;
    await line();
    expect(h.writes).toEqual([]);
  });
});
