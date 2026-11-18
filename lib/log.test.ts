import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComparisonCard } from "@/components/ComparisonCard";
import { LESSONS } from "@/content/lessons";
import type { RepRow } from "./client-data";
import { DRILLS } from "./drills";
import { hostileRecord } from "./hostile";
import {
  bestRecording,
  dayWords,
  ethosLine,
  LINE_SPAN,
  linePath,
  logList,
  recordingName,
  recordingTopic,
  recordingTrait,
  sinceDayOne,
} from "./log";

/*
 * The Log's reads (#506): what a recording is called and what it was
 * about, the stage's one line, the all-time best and a row's day.
 */
/** Enough words to score (`measured`): the rows below are real takes. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";

function rep(over: Partial<RepRow>): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: "2026-08-19T09:00:00Z",
    duration_s: 60,
    transcript: SAID,
    wpm: 140,
    filler_count: 4,
    fillers: [],
    pauses: [],
    stars: 1,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 512,
    audio_path: null,
    dimensions: null,
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    delivery_metrics: null,
    presence_score: null,
    delivery_moments: null,
    ...over,
  } as RepRow;
}

describe("recordingName", () => {
  it("names the lesson, or the boss, never the id", () => {
    // The boss's one name (#494 review), filed under its topic or not.
    expect(recordingName({ lesson_id: null, mode: "boss" })).toBe("Weekly boss");
    expect(recordingName({ lesson_id: "boss:great-vowel-shift", mode: "daily" })).toBe("Weekly boss");
    expect(recordingName({ lesson_id: "nope", mode: "daily" })).toBe("Recording");
  });

  /* #493, the morning tour (17 Nov): the Log and the stored recording
     named a road lesson ("Punctuate with silence", lib/drills.ts) that
     the Lessons tab does not list. The road was the day's practice. */
  it("names a road lesson's take Today's practice, never by the road's title", () => {
    expect(recordingName({ lesson_id: "f1", mode: "daily" })).toBe("Today's practice");
    const lessonTitles = new Set(LESSONS.map((l) => l.title));
    for (const d of DRILLS) {
      const name = recordingName({ lesson_id: d.id, mode: "daily" });
      if (!lessonTitles.has(d.title)) expect(name).not.toBe(d.title);
      expect(name).toBe("Today's practice");
    }
  });
});

describe("recordingName, every stored shape", () => {
  it("names a lesson practice, a path item and a game by title", () => {
    expect(recordingName({ lesson_id: "lesson:the-landing:2", mode: "daily" })).toBe("Finish, then go quiet");
    expect(recordingName({ lesson_id: "pause-1-1", mode: "daily" })).not.toBe("Recording");
    expect(recordingName({ lesson_id: "game:qa:x", mode: "daily" })).toBe("Q&A");
  });

  /* The games plan, item 15 and map 2.4: Hostile's take was "Recording",
     and a game round names the rung it was played at. */
  it("names Hostile Q&A's take, and a measured round's level", () => {
    expect(recordingName({ lesson_id: "hostile-take", mode: "daily" })).toBe("Hostile Q&A");
    const level = (game: string, n: unknown) => ({ game, level: n });
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("qa", 2) })).toBe("Q&A, level 2");
    expect(recordingName({ lesson_id: "game:rush:ru1", mode: "daily", round: level("rush", 1) })).toBe("Speed rush, level 1");
    expect(recordingName({ lesson_id: "game:interview:iv3", mode: "daily", round: level("interview", 3) })).toBe("Interview, level 3");
    // Before 0026 there is no round, so no level to name.
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: null })).toBe("Q&A");
    // A round of another game, or a level out of range, names none.
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("rush", 2) })).toBe("Q&A");
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("qa", 7) })).toBe("Q&A");
  });
});

/* Regression review, edges F6: Today's own take (`topic:<id>`) and a
   trait's walk (`practice:trait-<id>`) read "Recording" among named lessons. */
describe("recordingName, Today's take and a trait's walk", () => {
  it("names Today's take by its card and a walk by its trait", () => {
    expect(recordingName({ lesson_id: "topic:t4", mode: "daily" })).toBe("Today's practice");
    expect(recordingName({ lesson_id: "practice:trait-pause", mode: "daily" })).toBe("Pausing");
    expect(recordingName({ lesson_id: "practice:trait-range", mode: "daily" })).toBe("Variety");
    // An id that names nothing stays a recording.
    expect(recordingName({ lesson_id: "topic:nope", mode: "daily" })).toBe("Recording");
    expect(recordingName({ lesson_id: "practice:trait-nope", mode: "daily" })).toBe("Recording");
  });

  it("gives a trait's walk its trait's tone, and Today's take none", () => {
    expect(recordingTrait({ lesson_id: "practice:trait-pause" })).toBe("pause");
    expect(recordingTrait({ lesson_id: "practice:trait-nope" })).toBeNull();
    expect(recordingTrait({ lesson_id: "topic:t4" })).toBeNull();
  });
});

/* Regression review, edges F5: a take too short to score is stored with
   no fillers, 73 wpm and no pauses, and Day 1 vs now read it as "now". */
describe("sinceDayOne", () => {
  it("reads the first and the latest recordings that measured something", () => {
    const first = rep({ id: "a", filler_count: 9, wpm: 128 });
    const scored = rep({ id: "b", filler_count: 3, wpm: 141 });
    const unscored = rep({ id: "c", transcript: "um so yeah", filler_count: 0, wpm: 73, ethos_index: null });
    const ends = sinceDayOne([first, scored, unscored])!;
    expect(ends.first.id).toBe("a");
    expect(ends.last.id).toBe("b");
    // A meter-capped take is measured but carries no Index: it is still "now".
    const capped = rep({ id: "d", ethos_index: null });
    expect(sinceDayOne([first, scored, capped])!.last.id).toBe("d");
    expect(sinceDayOne([first, unscored])).toBeNull();
  });

  it("keeps the progress moment's card on the last measured recording", () => {
    const reps = [
      rep({ id: "a", filler_count: 9, wpm: 128, duration_s: 60, created_at: "2026-10-10T09:00:00Z" }),
      rep({ id: "b", filler_count: 3, wpm: 141, duration_s: 60, created_at: "2026-11-05T09:00:00Z" }),
      rep({ id: "c", transcript: "um so yeah", filler_count: 0, wpm: 73, duration_s: 4.1, ethos_index: null, created_at: "2026-11-06T09:00:00Z" }),
    ];
    const html = renderToStaticMarkup(createElement(ComparisonCard, { reps }));
    expect(html).toContain("Day 1 to day 27");
    expect(html).toContain(">3.0<");
    expect(html).not.toContain(">0.0<");
    expect(html).toContain(">141<");
    expect(html).not.toContain(">73<");
    expect(html).toContain("3 recordings.");
  });
});

/*
 * The log's rows wear their trait's tone (the colour pass), so the
 * mapping has to say the same trait the lesson or the path item says,
 * and say nothing for a recording that practised no one trait.
 */
describe("recordingTrait", () => {
  it("reads the trait from a lesson, a path item or a road unit", () => {
    expect(recordingTrait({ lesson_id: "lesson:the-cold-open:1" })).toBe("fillers");
    expect(recordingTrait({ lesson_id: "lesson:change-gear:3" })).toBe("pace");
    expect(recordingTrait({ lesson_id: "range-2-4" })).toBe("range");
    expect(recordingTrait({ lesson_id: "h1" })).toBe("pause");
    expect(recordingTrait({ lesson_id: "f2" })).toBe("fillers");
    expect(recordingTrait({ lesson_id: "p3" })).toBe("pace");
  });

  it("is null where no single trait was practised", () => {
    expect(recordingTrait({ lesson_id: null })).toBeNull();
    expect(recordingTrait({ lesson_id: "s1" })).toBeNull();
    expect(recordingTrait({ lesson_id: "boss:jevons" })).toBeNull();
    expect(recordingTrait({ lesson_id: "game:qa:x" })).toBeNull();
    expect(recordingTrait({ lesson_id: "lesson:nope:1" })).toBeNull();
  });
});


/*
 * #506: a row is titled by what was talked about, and a tap lands on a
 * page that names the same thing. Read from the stored id alone.
 */
describe("recordingTopic", () => {
  it("names a lesson practice by the topic its pool was shown (#492)", () => {
    // Pause between sentences: t6, t12, t4.
    expect(recordingTopic({ lesson_id: "lesson:inside-or-after:3", mode: "daily" })).toBe("Whether being busy is a choice");
    expect(recordingTopic({ lesson_id: "lesson:inside-or-after:1", mode: "daily" }, "work")).toBe(
      "A time you were completely wrong in public"
    );
    // The closed mouth's third (t10) needs a job: school gets its stand-in,
    // a grown-up the topic itself, and no pool means school.
    expect(recordingTopic({ lesson_id: "lesson:closed-mouth:3", mode: "daily" }, "school")).toBe("A deadline you only just made");
    expect(recordingTopic({ lesson_id: "lesson:closed-mouth:3", mode: "daily" }, "work")).toBe("The worst job you've ever done");
    expect(recordingTopic({ lesson_id: "lesson:closed-mouth:3", mode: "daily" })).toBe("A deadline you only just made");
  });

  it("names Today's practice, a road lesson, the boss and a game by their topic", () => {
    expect(recordingTopic({ lesson_id: "topic:t4", mode: "daily" })).toBe("Whether being busy is a choice");
    // A road lesson's prompt says the topic, then how: the first sentence, no full stop.
    expect(recordingTopic({ lesson_id: "h4", mode: "daily" })).toBe("Argue that one everyday habit is underrated");
    expect(recordingTopic({ lesson_id: "f1", mode: "daily" })).toBe("Introduce yourself and what you're building");
    expect(recordingTopic({ lesson_id: "t2", mode: "daily" })).toBe("What should more people be doing?");
    // The two that open on how to speak name their topic outright.
    expect(recordingTopic({ lesson_id: "h3", mode: "daily" })).toBe("A rule you live by");
    expect(recordingTopic({ lesson_id: "t3", mode: "daily" })).toBe("The last object you touched");
    expect(recordingTopic({ lesson_id: "boss:great-vowel-shift", mode: "boss" })).toBe("The Great Vowel Shift");
    expect(recordingTopic({ lesson_id: "game:qa:qa2", mode: "daily" })).toBe("Would you rather be respected or liked?");
  });

  it("names Hostile Q&A by its claim, from the stored verdict", () => {
    const verdict = {
      held: { score: 72, citedMoment: "kept the claim", improve: "Name the cost." },
      answered: { score: 64, citedMoment: "answered it", improve: "Shorter." },
      composed: { score: 70, citedMoment: "steady", improve: "Slow down." },
      coachLine: "You held it.",
    };
    const round = hostileRecord("zoos", verdict, []);
    expect(recordingTopic({ lesson_id: "hostile-take", mode: "daily", round })).toBe("Zoos should exist");
    expect(recordingTopic({ lesson_id: "hostile-take", mode: "daily", round: null })).toBe("Hostile Q&A");
  });

  it("falls back to the recording's name, never an empty or raw id", () => {
    expect(recordingTopic({ lesson_id: "practice:trait-pause", mode: "daily" })).toBe("Pausing");
    expect(recordingTopic({ lesson_id: "lesson:nope:1", mode: "daily" })).toBe("Recording");
    expect(recordingTopic({ lesson_id: "topic:nope", mode: "daily" })).toBe("Recording");
    expect(recordingTopic({ lesson_id: "game:qa:nope", mode: "daily" })).toBe("Q&A");
    expect(recordingTopic({ lesson_id: null, mode: "boss" })).toBe("Weekly boss");
  });

  it("gives every road lesson a topic with no full stop and no instruction's opening", () => {
    for (const id of ["f1", "f2", "f3", "f4", "p1", "p2", "p3", "p4", "h1", "h2", "h3", "h4", "s1", "s2", "s3", "s4", "s5", "c1", "c2", "c3", "c4", "c5", "t1", "t2", "t3", "t4", "t5"]) {
      const t = recordingTopic({ lesson_id: id, mode: "daily" });
      expect(t, id).not.toBe(recordingName({ lesson_id: id, mode: "daily" }));
      expect(t, id).not.toMatch(/\.$/);
      expect(t, id).not.toMatch(/^(No think time|Hold one full second)/);
      expect(t.length, id).toBeGreaterThan(8);
    }
  });
});

/*
 * #506: the stage's one line. Its ends are the two numbers the stage's
 * change subtracts, and it is drawn on at least 100 points of Ethos.
 */
describe("ethosLine", () => {
  /* The tour's account, oldest first: 611 to 662, its best 690. */
  const TOUR = [611, 627, 643, 644, 660, 631, 632, 648, 664, 665, 636, 652, 653, 669, 685, 641, 657, 673, 674, 690, 661, 662];
  const value = (pts: [number, number][], span: number, mid: number, i: number) => mid + (0.5 - pts[i][1]) * span;

  it("is null under two scored recordings", () => {
    expect(ethosLine([])).toBeNull();
    expect(ethosLine([604])).toBeNull();
  });

  it("starts at the first Ethos and ends at today's, whatever the smoothing does between", () => {
    const pts = ethosLine(TOUR)!;
    expect(pts).toHaveLength(TOUR.length);
    expect(pts[0][0]).toBe(0);
    expect(pts[pts.length - 1][0]).toBe(1);
    // The end is lower on the stage than the 674 to 690 run before it: the
    // line ends where 662 is, not where a trailing mean would (672).
    const smoothHi = Math.max(...pts.map((p) => 1 - p[1]));
    expect(1 - pts[pts.length - 1][1]).toBeLessThan(smoothHi);
    // The rise from the ring to the dot is 51 points on the line's scale.
    const span = Math.max(LINE_SPAN, 0);
    const rise = (pts[0][1] - pts[pts.length - 1][1]) * span;
    expect(Math.round(rise)).toBe(51);
  });

  it("draws on at least 100 points, so 51 is a climb and not a cliff", () => {
    const pts = ethosLine([611, 662])!;
    const rise = pts[0][1] - pts[1][1];
    expect(rise).toBeCloseTo(0.51, 5);
    // Centred on its own range.
    expect(pts[0][1]).toBeCloseTo(0.755, 5);
    expect(pts[1][1]).toBeCloseTo(0.245, 5);
    // A flat history is a flat line through the middle.
    expect(ethosLine([650, 650, 650])!.every(([, y]) => y === 0.5)).toBe(true);
    // A small dip is small.
    const dip = ethosLine([650, 640, 650])!;
    expect(Math.max(...dip.map(([, y]) => y)) - Math.min(...dip.map(([, y]) => y))).toBeLessThanOrEqual(0.1);
  });

  it("fits a range wider than 100 to the box, end to end", () => {
    const pts = ethosLine([500, 520, 560, 640, 700])!;
    expect(Math.min(...pts.map(([, y]) => y))).toBeCloseTo(0, 5);
    expect(Math.max(...pts.map(([, y]) => y))).toBeCloseTo(1, 5);
    expect(value(pts, 200, 600, 0)).toBeCloseTo(500, 5);
    expect(value(pts, 200, 600, 4)).toBeCloseTo(700, 5);
  });

  it("draws a fall as a fall", () => {
    const pts = ethosLine([690, 684, 677, 681, 669, 662, 655, 648, 641])!;
    expect(pts[0][1]).toBeLessThan(pts[pts.length - 1][1]);
  });
});

describe("linePath", () => {
  it("passes through every point and never overshoots between two", () => {
    const pts: [number, number][] = [[0, 50], [10, 10], [20, 10], [30, 40]];
    const d = linePath(pts);
    expect(d.startsWith("M0.0 50.0")).toBe(true);
    for (const [x, y] of pts.slice(1)) expect(d).toContain(` ${x.toFixed(1)} ${y.toFixed(1)}`);
    // The flat stretch between 10 and 20 stays at 10: its handles are flat.
    expect(d).toContain("C13.3 10.0 16.7 10.0 20.0 10.0");
  });

  it("is a move for one point and nothing for none", () => {
    expect(linePath([[4, 5]])).toBe("M4.0 5.0");
    expect(linePath([])).toBe("");
  });
});

/* #506, the house's best grammar (#421) on the one row to beat. */
describe("bestRecording", () => {
  const at = (d: number, ethos_index: number | null) => ({ created_at: `2026-11-${String(d).padStart(2, "0")}T09:00:00Z`, ethos_index });

  it("is the highest Ethos over every recording, the first to reach it", () => {
    expect(bestRecording([at(1, 611), at(2, 690), at(3, 662)])?.created_at).toBe(at(2, 0).created_at);
    expect(bestRecording([at(1, 690), at(2, null), at(3, 690)])?.created_at).toBe(at(1, 0).created_at);
  });

  it("is none under two scored recordings", () => {
    expect(bestRecording([at(1, 604)])).toBeNull();
    expect(bestRecording([at(1, 604), at(2, null)])).toBeNull();
    expect(bestRecording([])).toBeNull();
  });
});

describe("logList", () => {
  const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString();
  /* A hundred recordings, a day apart, oldest first, as the spine reads them. */
  const spine = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, created_at: at(i), lesson_id: "f1", ethos_index: 600 + i }));
  /* The newest 90 whole reads, each with something the spine does not hold. */
  const whole = spine.slice(10).map((r) => ({ ...r, round: { game: "qa", level: 2 } }));

  it("lists every recording, past the newest 90 whole reads (#506 review)", () => {
    const { rows, total, hidden } = logList(spine, whole);
    expect(total).toBe(100);
    expect(rows).toHaveLength(100);
    expect(hidden).toBe(0);
    expect(rows[0].id).toBe("r99");
    expect(rows[rows.length - 1].id).toBe("r0");
    // Every row is a door: one id each, none twice.
    expect(new Set(rows.map((r) => r.id)).size).toBe(100);
  });

  it("draws a recording from its whole read where the newest 90 hold it", () => {
    const { rows } = logList<{ id: string; created_at: string; round?: unknown }>(spine, whole);
    expect(rows.find((r) => r.id === "r50")?.round).toEqual({ game: "qa", level: 2 });
    expect(rows.find((r) => r.id === "r5")?.round).toBeUndefined();
  });

  it("holds back what the cutoff holds back, and counts it", () => {
    const { rows, hidden, total } = logList(spine, whole, new Date(at(93)).getTime());
    expect(rows.map((r) => r.id)).toEqual(["r99", "r98", "r97", "r96", "r95", "r94", "r93"]);
    expect(hidden).toBe(93);
    expect(total).toBe(100);
  });

  it("lists the whole reads when no spine has landed", () => {
    expect(logList([], whole.slice(-3)).rows.map((r) => r.id)).toEqual(["r99", "r98", "r97"]);
    expect(logList([], []).total).toBe(0);
  });
});

describe("dayWords", () => {
  const now = new Date(2026, 10, 18, 10, 0);
  it("says Today and Yesterday, then the weekday and the date", () => {
    expect(dayWords(new Date(2026, 10, 18, 8, 0).toISOString(), now)).toBe("Today");
    expect(dayWords(new Date(2026, 10, 17, 23, 30).toISOString(), now)).toBe("Yesterday");
    const older = dayWords(new Date(2026, 10, 15, 18, 0).toISOString(), now);
    expect(older).toMatch(/Sun/);
    expect(older).toMatch(/15/);
    expect(older).not.toMatch(/2026/);
    expect(older).not.toMatch(/,/);
    expect(dayWords(new Date(2025, 10, 15, 18, 0).toISOString(), now)).toMatch(/2025/);
  });
});
