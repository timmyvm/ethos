import { describe, expect, it } from "vitest";
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
