import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/words (#411): the word sheet's thesaurus. A stranger is
 * refused before anything is asked, a curated word or one already
 * answered costs neither a limiter slot nor a model call, and whatever
 * the model says is checked before the phone sees it. The Anthropic SDK
 * is mocked, as lib/analyze-route.test.ts mocks the coach.
 */

const h = vi.hoisted(() => ({
  create: vi.fn(),
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: false,
  consumed: [] as string[],
  unavailable: false,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: h.create };
  },
}));
vi.mock("@/lib/db", () => ({
  resolveAuthHeader: vi.fn(async (header: string | null) => {
    if (h.unavailable) return { kind: "unavailable" };
    if (!header?.startsWith("Bearer ")) return { kind: "none" };
    const user = h.sessions.get(header.slice(7));
    return user ? { kind: "user", user } : { kind: "rejected" };
  }),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async (subject: string, tier: string) => {
    h.consumed.push(`${tier}:${subject}`);
    return h.limited
      ? { allowed: false, window: "hour", retryAfterS: 900 }
      : { allowed: true, window: null, retryAfterS: 0 };
  }),
}));

import { POST } from "@/app/api/words/route";
import { LIMITS } from "@/lib/rate-limit";
import { CURATED } from "@/lib/thesaurus";
import { WORDS_MODEL, forgetWordsForTests } from "@/lib/words-server";

const GUEST = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";

function post(body: unknown, token: string | null = "tok_guest"): Promise<Response> {
  const req = new Request("http://test.local/api/words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req as unknown as NextRequest);
}

/** The model answering with `alternatives`, as the SDK returns a JSON-format reply. */
function answers(alternatives: unknown, stop: string = "end_turn") {
  h.create.mockResolvedValueOnce({
    stop_reason: stop,
    content: [{ type: "text", text: JSON.stringify({ alternatives }) }],
  });
}

const ASK = { word: "compound", sentence: "So the thing about habits is, um, they compound." };

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  h.create.mockReset();
  h.sessions.clear();
  h.sessions.set("tok_guest", { id: GUEST, anonymous: true, email: null });
  h.limited = false;
  h.unavailable = false;
  h.consumed.length = 0;
  forgetWordsForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/words", () => {
  it("answers a word with alternatives that fit its sentence", async () => {
    answers(["build on themselves", "snowball", "add up", "multiply"]);
    const res = await post(ASK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      alternatives: ["build on themselves", "snowball", "add up", "multiply"],
      source: "model",
    });
    expect(h.consumed).toEqual([`words:words:u:${GUEST}`]);
    const call = h.create.mock.calls[0][0];
    expect(call.model).toBe(WORDS_MODEL);
    expect(WORDS_MODEL).toBe("claude-haiku-5-5");
    expect(call.output_config.format.type).toBe("json_schema");
    expect(call.messages[0].content).toContain('"compound"');
    expect(call.messages[0].content).toContain("they compound.");
  });

  it("gives a guest the room (60 an hour, 300 a day)", () => {
    expect(LIMITS.words).toEqual({ hour: 60, day: 300 });
  });

  it("refuses a caller with no session, and asks nothing", async () => {
    const res = await post(ASK, null);
    expect(res.status).toBe(401);
    expect((await post(ASK, "tok_forged")).status).toBe(401);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.consumed).toEqual([]);
  });

  it("says try again when the session cannot be checked", async () => {
    h.unavailable = true;
    expect((await post(ASK)).status).toBe(503);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("refuses anything but one word or a short phrase and its sentence", async () => {
    for (const bad of [
      "not json",
      {},
      { word: "compound" },
      { word: "", sentence: "x" },
      { word: "one two three four", sentence: "x" },
      { word: "x".repeat(41), sentence: "x" },
      { word: "<script>", sentence: "x" },
      { word: "thing", sentence: "x".repeat(301) },
    ]) {
      const res = await post(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    const huge = await post({ word: "thing", sentence: "x".repeat(2100) });
    expect(huge.status).toBe(413);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("answers a curated word from the map: no slot, no call", async () => {
    const res = await post({ word: "Thing", sentence: "The thing is." });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alternatives: [...CURATED.thing], source: "curated" });
    expect(h.create).not.toHaveBeenCalled();
    expect(h.consumed).toEqual([]);
  });

  it("remembers an answer by word and sentence, so the second tap costs nothing", async () => {
    answers(["snowball", "add up", "multiply"]);
    await post(ASK);
    const again = await post({ ...ASK, word: "Compound" });
    expect(await again.json()).toEqual({ alternatives: ["snowball", "add up", "multiply"], source: "memory" });
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.consumed).toHaveLength(1);
    // Another sentence is another question.
    answers(["mix", "blend", "combine"]);
    await post({ word: "compound", sentence: "A compound of two metals." });
    expect(h.create).toHaveBeenCalledTimes(2);
  });

  it("checks what the model says before the phone sees it", async () => {
    answers(["Compound", "snowball", "snow—ball", "add up.", "snowball", "multiply", "grow", "stack", "swell", "build"]);
    const res = await post(ASK);
    expect((await res.json()).alternatives).toEqual(["snowball", "add up", "multiply", "grow", "stack", "swell"]);
  });

  it("is a 429 past the limit, before the model is asked", async () => {
    h.limited = true;
    const res = await post(ASK);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("fails soft: a refusal, a short list, junk or a thrown call is a 502", async () => {
    answers(["snowball", "add up", "multiply"], "refusal");
    expect((await post(ASK)).status).toBe(502);
    answers(["snowball"]);
    expect((await post(ASK)).status).toBe(502);
    h.create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] });
    expect((await post(ASK)).status).toBe(502);
    h.create.mockRejectedValueOnce(new Error("overloaded"));
    const res = await post(ASK);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "The alternatives didn't load." });
  });

  it("is a 502 with no key, and never calls out", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post(ASK)).status).toBe(502);
    expect(h.create).not.toHaveBeenCalled();
  });
});
