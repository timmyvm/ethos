import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The word sheet's answer on the phone (#428). Timothy's first
 * screenshot was the curated map answering "things" in "switch things
 * up" with points, ideas and parts, on the phone, before the sentence
 * was read. These hold that it no longer can: every tap asks the server
 * with its sentence and place, the v1 answers kept on a phone are never
 * read (and are deleted), and with no connection the sheet gets the
 * labelled offline failure, never a list from anywhere.
 */

const h = vi.hoisted(() => ({ token: "tok_guest" as string | null }));
vi.mock("./supabase-browser", () => ({ sessionToken: vi.fn(async () => h.token) }));

import { WordsUnavailable, answerFor, askFor, heldAnswer, resetWordsClientForTests } from "./words-client";
import { wordCacheKey } from "./words";

function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const THINGS_SENTENCE = "I think today's the day I switch things up.";
const things = () => askFor("things", THINGS_SENTENCE, THINGS_SENTENCE.indexOf("things"));
const PHRASE = { v: 2, verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new"], note: "", source: "model" };

beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  h.token = "tok_guest";
  resetWordsClientForTests();
});

describe("the ask", () => {
  it("carries the tapped word's place, so the second of two is the one asked about", () => {
    const s = "That  was   that.";
    expect(askFor("that", s, s.lastIndexOf("that"))).toEqual({ word: "that", sentence: "That was that.", at: 9 });
    expect(things()).toEqual({ word: "things", sentence: THINGS_SENTENCE, at: 33 });
  });
});

describe("answerFor", () => {
  it("asks the server for a vague word: the curated map no longer answers before it", async () => {
    // v1 answered "things" from the map without a call: points, ideas, parts, details, steps.
    expect(heldAnswer(things())).toBeNull();
    reply(PHRASE);
    const answer = await answerFor(things());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/words");
    expect(JSON.parse(init.body)).toEqual({ word: "things", sentence: THINGS_SENTENCE, at: 33 });
    expect(init.headers.Authorization).toBe("Bearer tok_guest");
    expect(answer).toEqual({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new"], note: "" });
    expect(answer.alternatives).not.toContain("points");
  });

  it("keeps the answer under the v2 key, so the second tap is instant", async () => {
    reply(PHRASE);
    await answerFor(things());
    expect(heldAnswer(things())).toMatchObject({ replaces: "switch things up" });
    await answerFor(things());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const kept = JSON.parse(localStorage.getItem("ethos.words.v2") ?? "{}");
    expect(Object.keys(kept)).toEqual([wordCacheKey(things())]);
    expect(wordCacheKey(things()).startsWith("v2|")).toBe(true);
  });

  it("ignores and deletes the answers v1 kept on the phone", async () => {
    // As v1 kept "things": a list under `word|hash`, in `ethos.words`.
    localStorage.setItem("ethos.words", JSON.stringify({ "things|f0e1cc59": ["points", "ideas", "parts", "details", "steps"] }));
    // And a v1-shaped list somehow under a v2 key is not an answer either.
    localStorage.setItem("ethos.words.v2", JSON.stringify({ [wordCacheKey(things())]: ["points", "ideas", "parts"] }));
    expect(heldAnswer(things())).toBeNull();
    expect(localStorage.getItem("ethos.words")).toBeNull();
    reply(PHRASE);
    await answerFor(things());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says keep for a word that is already right, with nothing to list", async () => {
    const s = "You know, I love to contribute to the billion dollar corporations that pay one dollar per hour for child labor.";
    reply({ v: 2, verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly.", source: "model" });
    expect(await answerFor(askFor("dollar", s, s.indexOf("dollar")))).toEqual({
      verdict: "keep",
      replaces: "dollar",
      alternatives: [],
      note: "A currency says it exactly.",
    });
  });

  it("keeps a number as a number without a call", async () => {
    expect(await answerFor(askFor("200", "It cost 200 a month.", 8))).toEqual({
      verdict: "keep",
      replaces: "200",
      alternatives: [],
      note: "A number says it exactly.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offline, throws the labelled offline failure and lists nothing", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const failed = await answerFor(things()).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(WordsUnavailable);
    expect((failed as WordsUnavailable).offline).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("labels a dropped connection offline only when the phone says so", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const flaky = (await answerFor(things()).catch((e: unknown) => e)) as WordsUnavailable;
    expect(flaky.offline).toBe(false);
    fetchMock.mockImplementationOnce(async () => {
      vi.stubGlobal("navigator", { onLine: false });
      throw new TypeError("Failed to fetch");
    });
    const dropped = (await answerFor(things()).catch((e: unknown) => e)) as WordsUnavailable;
    expect(dropped.offline).toBe(true);
  });

  it("treats a failed, old-version or malformed reply as a failure, never a list", async () => {
    reply({ error: "The alternatives didn't load." }, 502);
    expect(((await answerFor(things()).catch((e: unknown) => e)) as WordsUnavailable).status).toBe(502);
    // An instance mid-deploy still answering v1.
    reply({ alternatives: ["points", "ideas", "parts"], source: "model" });
    expect(await answerFor(things()).catch((e: unknown) => e)).toBeInstanceOf(WordsUnavailable);
    reply({ v: 2, verdict: "swap", replaces: "switch things up", alternatives: [], note: "" });
    expect(await answerFor(things()).catch((e: unknown) => e)).toBeInstanceOf(WordsUnavailable);
    // None of them was kept.
    expect(heldAnswer(things())).toBeNull();
  });
});
