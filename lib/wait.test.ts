import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoringStage } from "@/components/rep/ScoringStage";
import { earlyRead, type AnalyzeEvent } from "./analyze-stream";
import {
  WAIT_START,
  fillerValue,
  nextWait,
  resendWait,
  waitRows,
  type WaitState,
} from "./wait";

const early = (over: Partial<Parameters<typeof earlyRead>[0]> = {}) =>
  earlyRead({
    transcript: "So, um, the thing about habits is, like, they compound.",
    words: [],
    metrics: {
      durationS: 62,
      wordCount: 150,
      wpm: 145.4,
      fillerCount: 4,
      fillers: [
        { word: "like", t: 7.3 },
        { word: "um", t: 2.1 },
      ],
    },
    scorable: true,
    reads: true,
    ...over,
  });

const run = (...events: AnalyzeEvent[]): WaitState => events.reduce(nextWait, WAIT_START);
const states = (s: WaitState, boss = false) =>
  Object.fromEntries(waitRows(s, { boss }).map((r) => [r.key, r.state]));

describe("the wait's stages", () => {
  it("go in the route's order", () => {
    expect(run().stage).toBe("sending");
    expect(run({ stage: "received" }).stage).toBe("received");
    expect(run({ stage: "received" }, { stage: "transcribing" }).stage).toBe("transcribing");
    expect(run({ stage: "received" }, { stage: "transcribing" }, { stage: "measured", early: early() }).stage).toBe("reading");
    expect(
      run({ stage: "received" }, { stage: "transcribing" }, { stage: "measured", early: early() }, { stage: "saving" }).stage
    ).toBe("saving");
  });

  it("never go back", () => {
    const s = run({ stage: "measured", early: early() }, { stage: "received" }, { stage: "transcribing" });
    expect(s.stage).toBe("reading");
    expect(s.early).not.toBeNull();
  });

  it("go straight to the save when Demos does not read the take", () => {
    expect(run({ stage: "measured", early: early({ scorable: false }) }).stage).toBe("saving");
    expect(run({ stage: "measured", early: early({ reads: false }) }).stage).toBe("saving");
  });

  it("start again on a resend, keeping the words", () => {
    const s = resendWait(run({ stage: "measured", early: early() }));
    expect(s.stage).toBe("sending");
    expect(s.early?.wordCount).toBe(150);
  });
});

describe("the wait's rows", () => {
  it("show nothing done and no number before the route says anything", () => {
    const rows = waitRows(WAIT_START);
    expect(rows.map((r) => r.key)).toEqual(["send", "words", "fillers", "pace", "read", "save"]);
    expect(rows[0]).toMatchObject({ label: "Sending", state: "now" });
    expect(rows.slice(1).every((r) => r.state === "next" && r.value === null)).toBe(true);
  });

  it("tick Sent once the server has the whole recording, and transcribe next", () => {
    const s = states(run({ stage: "received" }));
    expect(s).toMatchObject({ send: "past", words: "now", fillers: "next", pace: "next", read: "next", save: "next" });
    expect(waitRows(run({ stage: "received" }))[0].label).toBe("Sent");
  });

  it("land the counts with the words, and hold on Demos's read", () => {
    const s = run({ stage: "received" }, { stage: "transcribing" }, { stage: "measured", early: early() });
    const rows = waitRows(s);
    expect(states(s)).toMatchObject({ send: "past", words: "past", fillers: "past", pace: "past", read: "now", save: "next" });
    expect(rows.find((r) => r.key === "words")).toMatchObject({ label: "Transcribed", value: "150 words" });
    expect(rows.find((r) => r.key === "fillers")?.value).toBe("4, first at 0:02");
    expect(rows.find((r) => r.key === "pace")?.value).toBe("145 words a minute");
  });

  it("mark Demos's read skipped, never done, on a take he does not read", () => {
    const s = run({ stage: "measured", early: early({ reads: false }) });
    expect(states(s)).toMatchObject({ read: "skip", save: "now" });
  });

  it("say in words why a skipped read is skipped, never 'Demos reads it' beside a dash", () => {
    const label = (s: WaitState, key: string, boss = false) =>
      waitRows(s, { boss }).find((r) => r.key === key)?.label;
    // No read left: the Log's own words for it.
    const capped = run({ stage: "measured", early: early({ reads: false }) });
    expect(label(capped, "read")).toBe("Demos's read is back tomorrow");
    // Too little speech to judge (too short, or mostly repeats).
    const thin = run({ stage: "measured", early: early({ scorable: false }) });
    expect(label(thin, "read")).toBe("Not enough for Demos to read");
    // A boss whose read is skipped has its claims skipped with it.
    expect(label(capped, "claims", true)).toBe("Claims not checked");
    // A read that is coming says so, before and while it runs.
    expect(label(WAIT_START, "read")).toBe("Demos reads it");
    expect(label(run({ stage: "measured", early: early() }), "read")).toBe("Demos reads it");
    expect(label(run({ stage: "measured", early: early() }), "claims", true)).toBe("Checking your claims");
  });

  it("save last", () => {
    const s = run({ stage: "measured", early: early() }, { stage: "saving" });
    expect(states(s)).toMatchObject({ read: "past", save: "now" });
  });

  it("check a boss's claims beside the read", () => {
    const s = run({ stage: "measured", early: early() });
    expect(waitRows(s, { boss: true }).map((r) => r.key)).toEqual(["send", "words", "fillers", "pace", "read", "claims", "save"]);
    expect(states(s, true)).toMatchObject({ read: "now", claims: "now" });
  });
});

describe("the wait's numbers", () => {
  it("name the first filler said, whatever order they came in", () => {
    expect(fillerValue({ fillerCount: 4, fillers: [{ word: "like", t: 61 }, { word: "um", t: 14.9 }] })).toBe("4, first at 0:14");
  });

  it("say None for no fillers, and the count alone without their times", () => {
    expect(fillerValue({ fillerCount: 0, fillers: [] })).toBe("None");
    expect(fillerValue({ fillerCount: 3, fillers: [] })).toBe("3");
  });

  it("say one word as a word", () => {
    const s = run({ stage: "measured", early: early({ metrics: { durationS: 2, wordCount: 1, wpm: 30, fillerCount: 0, fillers: [] } }) });
    expect(waitRows(s).find((r) => r.key === "words")?.value).toBe("1 word");
  });
});

describe("the wait on screen (#472 review)", () => {
  const html = (wait: WaitState, attempt = 0) =>
    renderToStaticMarkup(createElement(ScoringStage, { levels: [0.2, 0.5, 0.1], seconds: 62, wait, attempt }));
  const landed = run({ stage: "received" }, { stage: "transcribing" }, { stage: "measured", early: early() });

  it("keeps the words out of the live region, so a screen reader is not read the whole take when it lands", () => {
    const out = html(landed);
    expect(out.match(/role="status"/g)).toHaveLength(1);
    const text = (h: string) => h.replace(/<[^>]*>/g, "");
    const [before, status] = out.split('role="status"').map(text);
    // The words stand before the live region and never inside it.
    expect(before).toContain("the thing about habits is");
    expect(status).not.toContain("the thing about habits is");
    // The stages, and the numbers the words gave, are its news.
    expect(status).toContain("Transcribed");
    expect(status).toContain("150 words");
    expect(status).toContain("Demos reads it");
  });

  it("keeps a resend's one sentence in the live region", () => {
    const [, status] = html(landed, 1).split('role="status"').map((h) => h.replace(/<[^>]*>/g, ""));
    expect(status).toContain("Still sending. The recording is safe on this device.");
  });
});
