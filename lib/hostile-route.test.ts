import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const week = vi.hoisted(() => ({ since: null as string | null, count: 0 }));

vi.mock("@/lib/transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@/lib/hostile-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hostile-server")>()),
  hostileQuestion: vi.fn(async () => ({ quoted: "teams", question: "Which teams?" })),
  hostileVerdict: vi.fn(async () => ({ overall: 60 })),
}));
vi.mock("@/lib/db", () => {
  // The free week's count: reps of the hostile take since the week began.
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: async (_col: string, since: string) => {
      week.since = since;
      return { count: week.count };
    },
  };
  return {
    getUserFromAuthHeader: vi.fn(async (): Promise<unknown> => null),
    isPremium: vi.fn(async () => false),
    supabaseAdmin: vi.fn(() => ({ from: () => chain })),
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () => ({ allowed: true, window: null, retryAfterS: 0 })),
  refundRateLimit: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/hostile/route";
import { getUserFromAuthHeader } from "@/lib/db";
import { hostileVerdict } from "@/lib/hostile-server";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";

const SAID =
  "Remote work makes teams worse because people stop talking to each other and the small questions never get asked";
const HEARD = {
  text: SAID,
  durationS: 30,
  words: SAID.split(" ").map((word, i) => ({ word: ` ${word}`, start: i * 0.5, end: i * 0.5 + 0.4 })),
  segments: [],
  raw: {},
};

function post(fields: Record<string, string>, audio = true): Promise<Response> {
  const form = new FormData();
  form.append("promptId", "remote-work");
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (audio) form.append("audio", new Blob(["fake-opus"], { type: "audio/webm" }), "hostile.webm");
  const req = new Request("http://test.local/api/hostile", { method: "POST", body: form });
  return POST(req as unknown as NextRequest);
}

const take = (extra: Record<string, string> = {}) => post({ phase: "question", ...extra });
const answer = () =>
  post({ phase: "question", context: JSON.stringify({ take: SAID, rounds: [], pendingQuestion: "Which teams?" }) });
const judge = () =>
  post(
    {
      phase: "verdict",
      context: JSON.stringify({ take: SAID, rounds: [{ question: "Which teams?", answer: SAID }] }),
    },
    false
  );

beforeEach(() => {
  vi.mocked(transcribe).mockReset();
  vi.mocked(transcribe).mockResolvedValue(HEARD);
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(refundRateLimit).mockClear();
  vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-1", anonymous: false });
  week.since = null;
  week.count = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(console.error).mockRestore();
});

/*
 * A session is four calls: the take, two answers and the verdict, with
 * the take also banked through /api/analyze. On the recording subject
 * an account with six recordings that hour lost the verdict after both
 * answers, a guest was cut off at the second answer, and every session
 * took four recordings out of the day's room.
 */
describe("Hostile's allowance", () => {
  it("is its own, never the recording allowance", async () => {
    await take();
    expect(consumeRateLimit).toHaveBeenLastCalledWith("hostile:u:u-1", "user");
  });

  it("gives a guest the account's room, as recording does, and a visitor the visitor's", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    await answer();
    expect(consumeRateLimit).toHaveBeenCalledWith("hostile:u:anon-1", "user");
    // And every guest on the address shares one room (#416).
    expect(vi.mocked(consumeRateLimit).mock.calls.some(([s, t]) => /^guest:ip:/.test(s) && t === "guestip")).toBe(true);

    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    await answer();
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[0]).toMatch(/^hostile:ip:/);
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[1]).toBe("anon");
  });

  it("keeps the slot of a question asked and a verdict given", async () => {
    expect((await take()).status).toBe(200);
    expect((await answer()).status).toBe(200);
    expect((await judge()).status).toBe(200);
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("gives the slot back when Whisper is down, so the retry costs nothing", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 500: boom"));
    expect((await answer()).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
  });

  it("keeps the slot of a file Whisper refuses, so junk cannot loop for free", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 400: Invalid file format"));
    await answer();
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  /* #416: once Whisper has run, the slot is spent. Giving it back for a
     short answer made every such call free, and a script could loop
     transcriptions without end. */
  it("keeps the slot for an answer too short to read, since Whisper ran", async () => {
    vi.mocked(transcribe).mockResolvedValue({ ...HEARD, text: "I", words: [{ word: "I", start: 0, end: 0.2 }] });
    const body = await (await answer()).json();
    expect(body.tooShort).toBe(true);
    expect(refundRateLimit).not.toHaveBeenCalledWith("hostile:u:u-1");
  });

  it("keeps the slot when the verdict model was called and failed (#416)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.mocked(hostileVerdict).mockRejectedValueOnce(new Error("api down"));
    expect((await judge()).status).toBe(502);
    expect(refundRateLimit).not.toHaveBeenCalledWith("hostile:u:u-1");
    vi.unstubAllEnvs();
  });

  it("gives the slot back when there is no key to call the verdict with", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.mocked(hostileVerdict).mockRejectedValueOnce(new Error("no key"));
    expect((await judge()).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
    vi.unstubAllEnvs();
  });

  it("gives the slot back for a week already used", async () => {
    week.count = 1;
    expect((await take()).status).toBe(403);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
    expect(transcribe).not.toHaveBeenCalled();
  });
});

/*
 * The screen counts the free week from Monday 00:00 on the phone; the
 * server's clock is UTC. Monday 08:00 in Melbourne is Sunday 21:00 UTC,
 * so the server's week still held last Saturday's session and locked
 * the free one the screen offered, after the 60-second take.
 */
describe("the free week", () => {
  it("is counted on the person's own calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T21:00:00.000Z")); // Mon 9 Nov, 08:00 in Melbourne
    await take({ tzOffset: "-660" });
    expect(week.since).toBe("2026-11-08T13:00:00.000Z"); // Mon 9 Nov, 00:00 in Melbourne
  });

  it("is counted west of Greenwich too", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T03:00:00.000Z")); // Sun 8 Nov, 19:00 in Los Angeles
    await take({ tzOffset: "480" });
    expect(week.since).toBe("2026-11-02T08:00:00.000Z"); // Mon 2 Nov, 00:00 in Los Angeles
  });

  it("is UTC's week when the phone does not say", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T21:00:00.000Z"));
    await take();
    expect(week.since).toBe("2026-11-02T00:00:00.000Z");
  });
});
