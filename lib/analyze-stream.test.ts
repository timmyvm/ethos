import { describe, expect, it, vi } from "vitest";
import {
  STREAM_TYPE,
  StreamCut,
  earlyRead,
  encodeLine,
  parseLine,
  readAnalyze,
  wantsStream,
  type AnalyzeEvent,
  type AnalyzeLine,
} from "./analyze-stream";

const EARLY = earlyRead({
  transcript: "So, um, the thing is",
  words: [
    { word: "So", start: 0.2, end: 0.4 },
    { word: "um", start: 0.6, end: 0.8 },
    { word: "the", start: 1.1, end: 1.2 },
  ],
  metrics: {
    durationS: 4,
    wordCount: 3,
    wpm: 45,
    fillerCount: 1,
    fillers: [{ word: "um", t: 0.6 }],
  },
  scorable: true,
  reads: true,
});

/** A response the way the route streams it, cut into `chunks` wherever they fall. */
function streamed(chunks: string[], { close = true } = {}): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      if (close) c.close();
      else c.error(new Error("connection reset"));
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": `${STREAM_TYPE}; charset=utf-8` } });
}

const lines = (...ls: AnalyzeLine[]) => ls.map(encodeLine).join("");

describe("the early read", () => {
  it("carries the words and their counts, and nothing the coach decides", () => {
    expect(Object.keys(EARLY).sort()).toEqual(
      ["durationS", "fillerCount", "fillers", "reads", "scorable", "transcript", "wordCount", "words", "wpm"].sort()
    );
    expect(EARLY).not.toHaveProperty("ethosIndex");
    expect(EARLY).not.toHaveProperty("coach");
    expect(EARLY).not.toHaveProperty("tier1");
    expect(EARLY.fillers).toEqual([{ word: "um", t: 0.6 }]);
  });

  it("never says Demos reads a take too short to score", () => {
    const e = earlyRead({ transcript: "", words: [], metrics: { durationS: 2, wordCount: 0, wpm: 0, fillerCount: 0, fillers: [] }, scorable: false, reads: true });
    expect(e.reads).toBe(false);
  });

  it("copies only a word's text and times", () => {
    const e = earlyRead({
      transcript: "Hi",
      words: [{ word: "Hi", start: 0, end: 0.3, extra: 1 } as never],
      metrics: { durationS: 1, wordCount: 1, wpm: 60, fillerCount: 0, fillers: [] },
      scorable: true,
      reads: true,
    });
    expect(e.words).toEqual([{ word: "Hi", start: 0, end: 0.3 }]);
  });
});

describe("a line on the wire", () => {
  it("reads back what was written", () => {
    const all: AnalyzeLine[] = [
      { stage: "received" },
      { stage: "transcribing" },
      { stage: "measured", early: EARLY },
      { stage: "saving" },
      { stage: "done", status: 200, body: { repId: "r1" } },
    ];
    for (const l of all) expect(parseLine(encodeLine(l))).toEqual(l);
  });

  it("is one line each", () => {
    expect(encodeLine({ stage: "measured", early: { ...EARLY, transcript: "a\nb" } }).split("\n")).toHaveLength(2);
  });

  it("is nothing when it is not one of ours", () => {
    for (const t of ["", "  ", "not json", "[]", "null", '{"stage":"later"}', '{"stage":"done"}', '{"stage":"measured","early":{}}']) {
      expect(parseLine(t)).toBeNull();
    }
  });

  it("is asked for by Accept", () => {
    expect(wantsStream("application/x-ndjson, application/json")).toBe(true);
    expect(wantsStream("application/json")).toBe(false);
    expect(wantsStream(null)).toBe(false);
  });
});

describe("readAnalyze", () => {
  it("hands each stage over in order, then the answer's own status and body", async () => {
    const seen: AnalyzeEvent["stage"][] = [];
    const out = await readAnalyze(
      streamed([
        lines({ stage: "received" }, { stage: "transcribing" }, { stage: "measured", early: EARLY }, { stage: "saving" }),
        lines({ stage: "done", status: 200, body: { repId: "r1", ethosIndex: 640 } }),
      ]),
      (e) => seen.push(e.stage)
    );
    expect(seen).toEqual(["received", "transcribing", "measured", "saving"]);
    expect(out).toEqual({ status: 200, data: { repId: "r1", ethosIndex: 640 } });
  });

  it("puts a line back together across chunks", async () => {
    const text = lines({ stage: "measured", early: EARLY }, { stage: "done", status: 200, body: { ok: 1 } });
    const chunks = [text.slice(0, 7), text.slice(7, 60), text.slice(60)];
    const onEvent = vi.fn();
    const out = await readAnalyze(streamed(chunks), onEvent);
    expect(onEvent).toHaveBeenCalledWith({ stage: "measured", early: EARLY });
    expect(out.data).toEqual({ ok: 1 });
  });

  it("reads a last line with no newline after it", async () => {
    const out = await readAnalyze(streamed([JSON.stringify({ stage: "done", status: 429, body: { error: "slow" } })]));
    expect(out).toEqual({ status: 429, data: { error: "slow" } });
  });

  it("keeps the status the route meant, inside a 200 stream", async () => {
    const out = await readAnalyze(
      streamed([lines({ stage: "received" }, { stage: "done", status: 502, body: { error: "Transcription failed." } })])
    );
    expect(out.status).toBe(502);
  });

  it("throws StreamCut when the words came and the answer never did", async () => {
    const onEvent = vi.fn();
    await expect(
      readAnalyze(streamed([lines({ stage: "received" }, { stage: "measured", early: EARLY })]), onEvent)
    ).rejects.toBeInstanceOf(StreamCut);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("throws StreamCut when the connection drops mid-way", async () => {
    await expect(readAnalyze(streamed([lines({ stage: "received" })], { close: false }))).rejects.toBeInstanceOf(StreamCut);
  });

  it("reads one JSON body as it always was, a stand-in's included", async () => {
    const res = new Response(JSON.stringify({ repId: "r9" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const onEvent = vi.fn();
    expect(await readAnalyze(res, onEvent)).toEqual({ status: 200, data: { repId: "r9" } });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("reads a gateway's HTML as no body, with its status", async () => {
    const res = new Response("<html>Bad gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } });
    expect(await readAnalyze(res)).toEqual({ status: 502, data: null });
  });

  it("never loses the answer to a wait that failed to draw", async () => {
    const out = await readAnalyze(
      streamed([lines({ stage: "measured", early: EARLY }, { stage: "done", status: 200, body: { repId: "r1" } })]),
      () => {
        throw new Error("render failed");
      }
    );
    expect(out.data).toEqual({ repId: "r1" });
  });
});
