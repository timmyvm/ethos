import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/words (#411, rebuilt in #428): the word sheet's answer, swap
 * or keep for a word in its sentence. A stranger is refused before
 * anything is asked, an answer already given costs neither a limiter
 * slot nor a model call, no list answers before the sentence is read
 * (the curated map is gone), and whatever the model says is checked
 * before the phone sees it. The Anthropic SDK is mocked, as
 * lib/analyze-route.test.ts mocks the coach; nothing here calls out.
 *
 * Expectations #428 changed, and why: "answers a curated word from the
 * map" became "asks the model for a vague word too" (the map answered
 * "things" with "points" without reading "switch things up"); the
 * replies are the v2 shape; the memory files by place as well as word
 * and sentence; a single option is an answer now (a short list was a
 * 502 when three were required).
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
import { KEEP_NOTES } from "@/lib/words";
import { WORDS_EFFORT, WORDS_MODEL, WORDS_SYSTEM, forgetWordsForTests } from "@/lib/words-server";

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

/** The model answering with `reply`, as the SDK returns a JSON-format reply (thinking first, as adaptive thinking may). */
function answers(reply: unknown, stop: string = "end_turn") {
  h.create.mockResolvedValueOnce({
    stop_reason: stop,
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: JSON.stringify(reply) },
    ],
  });
}

const swap = (replaces: string, alternatives: unknown) => ({ verdict: "swap", replaces, alternatives, note: "" });

const ASK = { word: "compound", sentence: "So the thing about habits is, um, they compound.", at: 39 };
const THINGS = { word: "things", sentence: "I think today's the day I switch things up.", at: 33 };
const DOLLAR_SENTENCE =
  "You know, I love to contribute to the billion dollar corporations that pay one dollar per hour for child labor.";
const DOLLAR = { word: "dollar", sentence: DOLLAR_SENTENCE, at: DOLLAR_SENTENCE.indexOf("dollar") };

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
  it("answers a swap for a word in its sentence, as the v2 shape", async () => {
    answers(swap("compound", ["snowball", "build on themselves"]));
    const res = await post(ASK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      v: 2,
      verdict: "swap",
      replaces: "compound",
      alternatives: ["snowball", "build on themselves"],
      note: "",
      source: "model",
    });
    expect(h.consumed).toEqual([`words:words:u:${GUEST}`]);
  });

  it("asks Claude Haiku 5.5 at low effort, the prompt cached, the word marked where it stands", async () => {
    answers(swap("compound", ["snowball"]));
    await post(ASK);
    const call = h.create.mock.calls[0][0];
    expect(call.model).toBe(WORDS_MODEL);
    expect(WORDS_MODEL).toBe("claude-haiku-5-5");
    expect(call.output_config.effort).toBe(WORDS_EFFORT);
    expect(WORDS_EFFORT).toBe("low");
    expect(call.thinking).toBeUndefined();
    expect(call.fallbacks).toBeUndefined();
    expect(call.system).toEqual([{ type: "text", text: WORDS_SYSTEM, cache_control: { type: "ephemeral" } }]);
    expect(call.output_config.format.type).toBe("json_schema");
    const schema = call.output_config.format.schema;
    expect(Object.keys(schema.properties)).toEqual(["replaces", "verdict", "alternatives", "note"]);
    expect(schema.properties.verdict.enum).toEqual(["swap", "keep"]);
    expect(schema.properties.note.enum).toEqual(["", ...KEEP_NOTES]);
    expect(schema.additionalProperties).toBe(false);
    expect(call.messages[0].content).toBe('Tapped: "compound"\nSentence: "So the thing about habits is, um, they ⟦compound⟧."');
  });

  it("marks the tapped one of two, and keeps a transcript's own brackets from moving it", async () => {
    answers({ verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." });
    await post({ ...DOLLAR, at: DOLLAR_SENTENCE.lastIndexOf("dollar") });
    expect(h.create.mock.calls[0][0].messages[0].content).toContain("billion dollar corporations that pay one ⟦dollar⟧ per hour");
    answers(swap("good", ["solid"]));
    await post({ word: "good", sentence: "It was ⟦fine⟧ and good.", at: 18 });
    expect(h.create.mock.calls[1][0].messages[0].content).toContain('"It was (fine) and ⟦good⟧."');
  });

  it("says keep for a word that is already right: no list, one fixed line", async () => {
    answers({ verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." });
    const res = await post(DOLLAR);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      v: 2,
      verdict: "keep",
      replaces: "dollar",
      alternatives: [],
      note: "A currency says it exactly.",
      source: "model",
    });
  });

  it("swaps the phrase a word sits in", async () => {
    answers(swap("switch things up", ["shake things up", "try something new"]));
    const res = await post(THINGS);
    expect(await res.json()).toMatchObject({
      verdict: "swap",
      replaces: "switch things up",
      alternatives: ["shake things up", "try something new"],
    });
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
      { word: "dollar", sentence: "A word that is not in its sentence." },
    ]) {
      const res = await post(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    const huge = await post({ word: "thing", sentence: "x".repeat(2100) });
    expect(huge.status).toBe(413);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("asks the model for a vague word too, with the word marked in its sentence", async () => {
    answers(swap("switch things up", ["shake things up"]));
    const res = await post(THINGS);
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("model");
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0].messages[0].content).toContain("I switch ⟦things⟧ up.");
    expect(h.consumed).toHaveLength(1);
  });

  it("remembers an answer by word, place and sentence, so the second tap costs nothing", async () => {
    answers(swap("compound", ["snowball", "add up"]));
    await post(ASK);
    const again = await post({ ...ASK, word: "Compound" });
    expect(await again.json()).toEqual({
      v: 2,
      verdict: "swap",
      replaces: "compound",
      alternatives: ["snowball", "add up"],
      note: "",
      source: "memory",
    });
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.consumed).toHaveLength(1);
    // Another sentence is another question.
    answers(swap("compound", ["mixture"]));
    await post({ word: "compound", sentence: "A compound of two metals.", at: 2 });
    expect(h.create).toHaveBeenCalledTimes(2);
    // And so is the other place a word stands in the same sentence.
    answers({ verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." });
    await post(DOLLAR);
    answers({ verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." });
    await post({ ...DOLLAR, at: DOLLAR_SENTENCE.lastIndexOf("dollar") });
    expect(h.create).toHaveBeenCalledTimes(4);
  });

  it("checks what the model says before the phone sees it", async () => {
    answers({
      verdict: "swap",
      replaces: "compound",
      alternatives: ["Compound", "snowball", "snow—ball", "add up.", "snowball", "really grow", "multiply", "stack", "swell"],
      note: "Already precise.",
    });
    const res = await post(ASK);
    expect(await res.json()).toMatchObject({ alternatives: ["snowball", "add up", "multiply"], note: "" });
    // A keep's list is emptied and an off-list note becomes the default line.
    answers({ verdict: "keep", replaces: "dollar", alternatives: ["euro", "buck"], note: "Already precise." });
    expect(await (await post(DOLLAR)).json()).toMatchObject({ alternatives: [], note: "It's already the precise word." });
  });

  it("falls back to the word when replaces is not in the sentence", async () => {
    answers({ verdict: "keep", replaces: "per hour wage", alternatives: [], note: "A currency says it exactly." });
    expect(await (await post(DOLLAR)).json()).toMatchObject({ verdict: "keep", replaces: "dollar" });
  });

  it("is a 429 past the limit, before the model is asked", async () => {
    h.limited = true;
    const res = await post(ASK);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("fails soft: a refusal, a malformed reply, a v1 list, junk or a thrown call is a 502, never remembered", async () => {
    answers(swap("compound", ["snowball"]), "refusal");
    expect((await post(ASK)).status).toBe(502);
    // A refusal is never remembered: the retry asks again.
    answers(swap("compound", ["snowball"]));
    expect((await post(ASK)).status).toBe(200);
    expect(h.create).toHaveBeenCalledTimes(2);
    forgetWordsForTests();
    for (const reply of [
      { verdict: "swap", replaces: "compound", alternatives: [], note: "" },
      { verdict: "swap", replaces: "compound", alternatives: ["compound"], note: "" },
      { verdict: "perhaps", replaces: "compound", alternatives: ["snowball"], note: "" },
      { alternatives: ["snowball", "add up", "multiply"] },
      ["snowball"],
    ]) {
      answers(reply);
      expect((await post(ASK)).status, JSON.stringify(reply)).toBe(502);
    }
    h.create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] });
    expect((await post(ASK)).status).toBe(502);
    h.create.mockResolvedValueOnce({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"replaces":"comp' }] });
    expect((await post(ASK)).status).toBe(502);
    h.create.mockRejectedValueOnce(new Error("overloaded"));
    const res = await post(ASK);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "The alternatives didn't load." });
    // None of the failures was remembered.
    answers(swap("compound", ["snowball"]));
    expect((await (await post(ASK)).json()).source).toBe("model");
  });

  it("is a 502 with no key, and never calls out", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post(ASK)).status).toBe(502);
    expect(h.create).not.toHaveBeenCalled();
  });
});
