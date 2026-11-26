import { describe, expect, it } from "vitest";
import { FIRST_BODY, hourWords, LATE_TITLE, lastTake, PUSH_BODY_MAX, reminderCopy, takeLine } from "./reminder-copy";
import { BANNED_PHRASES, HYPE_PHRASES, saysGym } from "./register";
import { cueTitle, warmupLead, WORD_MAX, type Cue, type CueKind } from "./carried-cue";

/* The reminder's words (#430): the hour they chose and a number they spoke. */
describe("reminderCopy", () => {
  it("names the chosen hour on time and quotes the last take", () => {
    expect(reminderCopy({ hour: 18, onTime: true, last: { fillers: 4, seconds: 62 } })).toEqual({
      title: "Your 6 pm practice",
      body: "Last time: 4 fillers in 62 seconds.",
    });
  });

  it("does not name an hour that has passed, and says one filler as one", () => {
    expect(reminderCopy({ hour: 12, onTime: false, last: { fillers: 1, seconds: 75 } })).toEqual({
      title: LATE_TITLE,
      body: "Last time: 1 filler in 75 seconds.",
    });
  });

  it("before a first take, says how long it takes", () => {
    expect(reminderCopy({ hour: 7, onTime: true, last: null })).toEqual({ title: "Your 7 am practice", body: FIRST_BODY });
  });

  it("says the hour the way the testers' phones do", () => {
    expect([0, 7, 12, 18, 21, 23].map(hourWords)).toEqual(["12 am", "7 am", "12 pm", "6 pm", "9 pm", "11 pm"]);
  });

  it("never names a streak, a deadline, guilt, the banned register or hype, and has no dash", () => {
    const lines = [
      ...[null, { fillers: 0, seconds: 30 }, { fillers: 12, seconds: 240 }].flatMap((last) =>
        [7, 12, 18, 21].flatMap((hour) =>
          [true, false].flatMap((onTime) => Object.values(reminderCopy({ hour, onTime, last })))
        )
      ),
      takeLine(null),
    ];
    for (const s of lines) {
      expect(s).not.toMatch(/streak|\bdays?\b|habit|keep|lose|tonight|midnight|before it|fail|lazy|shame|missed|broke/i);
      expect(saysGym(s)).toBe(false);
      for (const p of [...BANNED_PHRASES, ...HYPE_PHRASES]) expect(s.toLowerCase()).not.toContain(p);
      expect(s).not.toMatch(/—|–/);
    }
  });
});

describe("lastTake", () => {
  it("quotes the newest take long enough to be a real one", () => {
    expect(
      lastTake([
        { filler_count: 0, duration_s: 6 },
        { filler_count: 3, duration_s: "64.4" },
        { filler_count: 9, duration_s: 90 },
      ])
    ).toEqual({ fillers: 3, seconds: 64 });
  });

  it("is null with no takes, or only false starts", () => {
    expect(lastTake([])).toBeNull();
    expect(lastTake([{ filler_count: 2, duration_s: 12 }])).toBeNull();
    expect(lastTake([{ filler_count: null, duration_s: 70 }])).toBeNull();
  });
});

describe("the service worker's fallback", () => {
  it("says what the server says with no take to quote", async () => {
    const { readFileSync } = await import("node:fs");
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain(`title: ${JSON.stringify(LATE_TITLE)}`);
    expect(sw).toContain(`body: ${JSON.stringify(FIRST_BODY)}`);
  });
});

/*
 * The reel's build 3 (26 Nov): with a cue carried into today, the body is
 * the warm-up's own two lines, word for word (components/rep/CueWarmup.tsx
 * draws warmupLead as its eyebrow and cueTitle as its title), so the push
 * and the screen it opens say one thing. The title never changes.
 */
describe("reminderCopy with a carried cue", () => {
  const cue = (kind: CueKind, word: string | null, last: number): Cue => ({
    kind,
    word,
    from: last,
    last,
    givenOn: "2026-11-25",
    answeredOn: null,
    tries: 0,
    line: null,
  });
  /* One of each kind, with the plan's own numbers. */
  const EACH: Cue[] = [
    cue("filler", "like", 9),
    cue("searching", null, 3),
    cue("filled", null, 2),
    cue("unheld", null, 0),
    cue("restarts", null, 4),
    cue("fast", null, 184),
    cue("slow", null, 104),
    cue("repeat", "really", 5),
  ];
  const last = { fillers: 4, seconds: 62 };

  it("says the warm-up's eyebrow and title, word for word, for every kind", () => {
    for (const c of EACH) {
      expect(reminderCopy({ hour: 18, onTime: true, last, cue: c }).body).toBe(`${warmupLead(c)}. ${cueTitle(c)}.`);
    }
    expect(EACH.map((c) => reminderCopy({ hour: 18, onTime: true, last, cue: c }).body)).toEqual([
      "Last time, “like” 9 times. Pause where “like” was.",
      "Last time, 3 misplaced pauses. Pause between sentences.",
      "Last time, 2 pauses had an um. Keep each pause silent.",
      "Last time, no pauses between sentences. Pause once after a full sentence.",
      "Last time, 4 sentence restarts. Pause, then finish the sentence.",
      "Last time, 184 words a minute. Pause at every full stop.",
      "Last time, 104 words a minute. Keep each sentence moving.",
      "Last time, “really” 5 times. Find another word for “really”.",
    ]);
  });

  it("keeps the title: the hour on time, Today's practice late", () => {
    for (const c of [...EACH, null]) {
      expect(reminderCopy({ hour: 18, onTime: true, last, cue: c }).title).toBe("Your 6 pm practice");
      expect(reminderCopy({ hour: 18, onTime: false, last, cue: c }).title).toBe(LATE_TITLE);
    }
  });

  it("carries a number for every kind but the one whose number is none, and stays short", () => {
    for (const c of EACH) {
      const { body } = reminderCopy({ hour: 18, onTime: true, last, cue: c });
      expect(body.length).toBeLessThan(PUSH_BODY_MAX);
      if (c.kind === "unheld") expect(body).toMatch(/\bno pauses\b/);
      else expect(body).toMatch(/\d/);
    }
  });

  it("names no streak, deadline or loss, no banned register or hype, and has no dash", () => {
    for (const c of EACH) {
      for (const n of [0, 1, 2, 12, 240]) {
        const { title, body } = reminderCopy({ hour: 21, onTime: true, last, cue: { ...c, last: n } });
        for (const s of [title, body]) {
          /* "keep" is allowed here, unlike the take's line above: "Keep
             each pause silent" is the warm-up's instruction, never "keeps
             it", the loss frame that rule was written against. */
          expect(s).not.toMatch(/streak|\bdays?\b|habit|\bends?\b|\blose\b|\blost\b|tonight|midnight|before it|fail|lazy|shame|missed|broke|hurry|last chance/i);
          expect(saysGym(s)).toBe(false);
          for (const p of [...BANNED_PHRASES, ...HYPE_PHRASES]) expect(s.toLowerCase()).not.toContain(p);
          expect(s).not.toMatch(/—|–/);
        }
      }
    }
  });

  it("counts one as one", () => {
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: cue("filler", "um", 1) }).body).toBe(
      "Last time, “um” once. Pause where “um” was."
    );
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: cue("restarts", null, 1) }).body).toBe(
      "Last time, 1 sentence restart. Pause, then finish the sentence."
    );
  });

  it("with no cue, says the last take's line, or the first-time line", () => {
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: null }).body).toBe(takeLine(last));
    expect(reminderCopy({ hour: 18, onTime: true, last }).body).toBe("Last time: 4 fillers in 62 seconds.");
    expect(reminderCopy({ hour: 18, onTime: true, last: null, cue: null }).body).toBe(FIRST_BODY);
  });

  it("a cue too long for a push body says today's words, never a cut one", () => {
    /* The account's column holds a word up to WORD_MAX (40); twice that,
       with the count, runs past what a lock screen shows. */
    const long = cue("repeat", "x".repeat(WORD_MAX), 9999);
    expect(`${warmupLead(long)}. ${cueTitle(long)}.`.length).toBeGreaterThan(PUSH_BODY_MAX);
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: long })).toEqual({
      title: "Your 6 pm practice",
      body: "Last time: 4 fillers in 62 seconds.",
    });
    expect(reminderCopy({ hour: 18, onTime: true, last: null, cue: long }).body).toBe(FIRST_BODY);
    // The longest word that still fits, with a two-digit count, is said whole.
    const fits = cue("repeat", "y".repeat(30), 99);
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: fits }).body).toBe(`${warmupLead(fits)}. ${cueTitle(fits)}.`);
    expect(reminderCopy({ hour: 18, onTime: true, last, cue: cue("repeat", "y".repeat(31), 99) }).body).toBe(takeLine(last));
  });
});
