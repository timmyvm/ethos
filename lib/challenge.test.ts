import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildChallenge,
  closesByWeek,
  challengeFoot,
  challengeLine,
  closeRate,
  MIN_HISTORY,
  openQuantile,
  practiceRow,
  Q_MAX,
  Q_MIN,
  Q_START,
  Q_STEP,
  readingToday,
} from "./challenge";
import type { RepRow } from "./client-data";
import { fmtRaw, readTraitsFromRow } from "./trait-readings";
import { TRAIT } from "@/content/traits";

/**
 * The daily challenge (DECISIONS #281).
 *
 * The tests that matter here are the ones guarding the two things
 * `docs/closure.md` says can make the product worse: a target most
 * people miss, and a target that only ever tightens.
 */

/** 150 words with a vocabulary we choose, so Variety moves too. */
const words = (distinct: number) =>
  Array.from({ length: 150 }, (_, i) => `word${i % distinct}`).join(" ");

/**
 * A recording whose filler rate and held-pause count we choose.
 *
 * Which trait the challenge lands on is `choosePractice`'s call, not the
 * test's, and these fixtures deliberately do not fight it: the
 * assertions below read `c.trait` rather than assuming one, because a
 * test that pinned the trait would be testing the fixture.
 */
function rep(
  daysAgo: number,
  fillers: number,
  id = `r${daysAgo}-${fillers}`,
  held = 1,
  distinct = 90
): RepRow {
  const at = new Date(2026, 8, 14, 12, 0, 0);
  at.setDate(at.getDate() - daysAgo);
  return {
    id,
    lesson_id: null,
    created_at: at.toISOString(),
    duration_s: 60,
    transcript: words(distinct),
    wpm: 145,
    filler_count: fillers,
    fillers: Array.from({ length: fillers }, (_, i) => ({ word: "um", t: i })),
    pauses: Array.from({ length: held }, (_, i) => ({
      t: 2 + i * 7,
      len: 1.2,
      kind: "pre",
    })),
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    audio_path: null,
    dimensions: { tier1: { repairs: 80 }, anchors: {}, tier2: null },
    mode: "daily",
    mods: [],
  } as unknown as RepRow;
}

const NOW = new Date(2026, 8, 14, 20, 0, 0); // a Monday evening

/** A recording at a local moment, built on `rep`, with what the case needs changed. */
function take(
  when: Date,
  over: { fillers?: number; held?: number; wpm?: number; transcript?: string; duration_s?: number } = {}
): RepRow {
  const r = rep(0, over.fillers ?? 0, `take-${when.getTime()}-${Math.random()}`, over.held ?? 3);
  return {
    ...r,
    created_at: when.toISOString(),
    wpm: over.wpm ?? r.wpm,
    transcript: over.transcript ?? r.transcript,
    duration_s: over.duration_s ?? r.duration_s,
  };
}
/** A day in November 2026, at noon unless said. Mondays are the 2nd, 9th and 16th. */
const nov = (d: number, h = 12) => new Date(2026, 10, d, h);

describe("there is no line until there is a distribution", () => {
  it("gives nothing on day one", () => {
    expect(buildChallenge([], NOW)).toBeNull();
  });

  it("gives nothing on day two", () => {
    expect(buildChallenge([rep(2, 6)], NOW)).toBeNull();
  });

  it(`gives nothing under ${MIN_HISTORY} readings in the window`, () => {
    expect(buildChallenge([rep(2, 6), rep(3, 7)], NOW)).toBeNull();
  });

  it("gives a line at three", () => {
    const c = buildChallenge([rep(2, 6), rep(3, 7), rep(1, 5)], NOW);
    expect(c).not.toBeNull();
  });
});

describe("the line is one of their own numbers", () => {
  const reps = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];

  it("never interpolates", () => {
    const c = buildChallenge(reps, NOW)!;
    const theirs = reps.map(
      (r) => readTraitsFromRow(r).find((x) => x.id === c.trait)!.raw
    );
    expect(theirs).toContain(c.line);
  });

  it("counts how many of their own recordings cleared it", () => {
    const c = buildChallenge(reps, NOW)!;
    expect(c.cleared.of).toBe(reps.length);
    expect(c.cleared.n).toBeGreaterThan(0);
    expect(c.cleared.n).toBeLessThanOrEqual(c.cleared.of);
  });

  /**
   * The one that answers Wang et al. At the default quantile the line
   * sits where most of their own week already clears it, which is §5
   * row 8's "ordinary day, ordinary user" and the opposite of §6's
   * rejected stretch target.
   */
  it("is sized so most of their own week already clears it", () => {
    const ten = Array.from({ length: 7 }, (_, i) => rep(i + 1, i + 1));
    const c = buildChallenge(ten, NOW)!;
    expect(c.cleared.n / c.cleared.of).toBeGreaterThanOrEqual(1 - Q_START);
  });
});

describe("it moves in both directions", () => {
  it("draws a looser line after a worse week", () => {
    const good = [rep(1, 1), rep(2, 2), rep(3, 1), rep(4, 3), rep(5, 2)];
    const bad = [rep(1, 9), rep(2, 11), rep(3, 8), rep(4, 12), rep(5, 10)];
    const a = buildChallenge(good, NOW)!;
    const b = buildChallenge(bad, NOW)!;
    /* Fillers are lower-is-better, so a looser line is a HIGHER number. */
    expect(b.line).toBeGreaterThan(a.line);
  });

  it("has no ratchet in it", () => {
    const src = readFileSync("lib/challenge.ts", "utf8");
    expect(src).not.toMatch(/Math\.max\(\s*prev|previousLine|lastLine/);
  });
});

describe("the line is frozen inside a week", () => {
  const base = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];

  it("does not move when today's recording lands", () => {
    const monday = buildChallenge(base, NOW)!;
    const later = buildChallenge([...base, rep(0, 1)], NOW)!;
    expect(later.line).toBe(monday.line);
  });

  it("does not move on a later day of the same week", () => {
    const friday = new Date(2026, 8, 18, 20, 0, 0);
    const a = buildChallenge(base, NOW)!;
    const b = buildChallenge(base, friday)!;
    expect(b.week).toBe(a.week);
    expect(b.line).toBe(a.line);
  });
});

describe("closing it", () => {
  const base = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];

  it("is open with nothing recorded today", () => {
    const c = buildChallenge(base, NOW)!;
    expect(c.today).toBeNull();
    expect(c.closed).toBe(false);
    expect(c.value).toBe(0);
  });

  it("closes on a recording that clears the line", () => {
    const c = buildChallenge([...base, rep(0, 0, "today", 9, 140)], NOW)!;
    expect(c.closed).toBe(true);
  });

  it("does not close on one that misses it", () => {
    const c = buildChallenge([...base, rep(0, 40, "today", 0)], NOW)!;
    expect(c.closed).toBe(false);
  });

  it("takes the best of the day, so speaking again is never a risk", () => {
    /* One bad recording and one good one, same day, bad one first. */
    const bad = rep(0, 40, "bad", 0, 20);
    const good = rep(0, 0, "good", 9, 140);
    const c = buildChallenge([...base, bad, good], NOW)!;
    expect(c.closed).toBe(true);
    expect(readingToday([...base, bad, good], c.trait, NOW)).not.toBe(
      readingToday([...base, bad], c.trait, NOW)
    );
  });
});

describe("the dial", () => {
  it("stays put without enough of their own days to read", () => {
    expect(openQuantile([rep(1, 4), rep(2, 6), rep(3, 9)], NOW)).toBe(Q_START);
  });

  it("is clamped at both ends", () => {
    const many = Array.from({ length: 26 }, (_, i) => rep(i + 1, 3));
    const q = openQuantile(many, NOW);
    expect(q).toBeGreaterThanOrEqual(Q_MIN);
    expect(q).toBeLessThanOrEqual(Q_MAX);
  });

  it("counts only days they recorded", () => {
    const { active } = closeRate([rep(1, 4), rep(1, 5), rep(3, 6)], NOW);
    expect(active).toBe(2);
  });

  /*
   * The window is worst first, so a lower quantile is a looser line. The
   * two steps ran backwards: a month of misses drew a harder line, and
   * a month of closes an easier one.
   */
  it("loosens after a month of misses and tightens after a month of closes", () => {
    const days = (fillers: (i: number) => number) =>
      Array.from({ length: 36 }, (_, i) => take(new Date(2026, 9, 11 + i), { fillers: fillers(i), held: 7 }));
    const missing = days((i) => 5 + i);
    const closing = days((i) => 40 - i);
    expect(closeRate(missing, nov(16, 0)).rate).toBe(0);
    expect(closeRate(closing, nov(16, 0)).rate).toBe(1);
    expect(openQuantile(missing, nov(16, 0))).toBeCloseTo(Q_START - Q_STEP);
    expect(openQuantile(closing, nov(16, 0))).toBeCloseTo(Q_START + Q_STEP);
  });

  /*
   * "Evaluated at the same Monday boundary as the line": three missed
   * days after Monday moved the dial read up to now, and Thursday's line
   * came from another quantile than Monday's.
   */
  it("reads the days before this Monday, so the line holds all week", () => {
    const month = Array.from({ length: 36 }, (_, i) =>
      take(new Date(2026, 9, 11 + i), { fillers: 40 - i, held: 7 })
    );
    const missed = [16, 17, 18].map((d) => take(nov(d), { fillers: 60, held: 7 }));
    const reps = [...month, ...missed];
    // The precondition: read up to now, the dial would move mid-week.
    expect(openQuantile(reps, nov(19, 9))).not.toBe(openQuantile(reps, nov(16, 9)));
    const monday = buildChallenge(reps, nov(16, 9))!;
    const thursday = buildChallenge(reps, nov(19, 9))!;
    expect(thursday.week).toBe(monday.week);
    expect(thursday.q).toBe(monday.q);
    expect(thursday.line).toBe(monday.line);
  });
});

describe("the two channels never merge", () => {
  /**
   * §5 row 2, executable. Absurd outcome-channel values must change
   * nothing, because this file cannot see them.
   */
  it("ignores the Index, the stars and the multiplier", () => {
    const base = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];
    const loud = base.map((r) => ({
      ...r,
      ethos_index: 999,
      stars: 3,
      xp_multiplier: 9,
      presence_score: 1000,
    })) as RepRow[];
    expect(buildChallenge(loud, NOW)).toEqual(buildChallenge(base, NOW));
  });

  it("never reads a percentile out of the module", () => {
    const src = readFileSync("lib/challenge.ts", "utf8");
    expect(src).not.toMatch(/\.percentile|ordinal\(/);
  });
});

describe("the copy", () => {
  const base = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];

  it("names the number and the unit before anything is recorded", () => {
    const c = buildChallenge(base, NOW)!;
    /* The verb comes from the trait's direction, which is the whole
       reason it is generated rather than written. */
    expect(challengeLine(c)).toMatch(/^(Under|Over|Inside) \S+ .+\.$/);
    /* `withUnit` says "1 held pause a minute" and "2 held pauses a
       minute", so either spelling is correct here. */
    const t = TRAIT[c.trait];
    expect(
      challengeLine(c).includes(t.unit) || challengeLine(c).includes(t.unitOne)
    ).toBe(true);
  });

  it("prints both numbers once it closes", () => {
    const c = buildChallenge([...base, rep(0, 0, "today", 9, 140)], NOW)!;
    const line = challengeLine(c);
    expect(c.closed).toBe(true);
    expect(line).toContain("today");
    expect(line).toMatch(/(under|over|inside)/);
  });

  /*
   * today-7: the card's ring lost its number, so the sentence is the one
   * place today's value is printed, and it says what it counts in every
   * branch: open, closed, and closed on the line.
   */
  it("prints today's value with its unit, in every branch", () => {
    const open = buildChallenge(base, NOW)!;
    const shut = buildChallenge([...base, rep(0, 0, "today", 9, 140)], NOW)!;
    const cases = [
      { ...open, today: open.line + 5, closed: false },
      shut,
      { ...shut, today: shut.line, closed: true },
    ];
    for (const c of cases) {
      const t = TRAIT[c.trait];
      const shown = fmtRaw(c.today!);
      const unit = shown === "1" ? t.unitOne : t.unit;
      const line = challengeLine(c);
      expect(line).toMatch(new RegExp(`^${shown.replace(".", "\\.")} ${unit} today[,.]`));
      // The unit is said once: the line's own number shares it.
      expect(line.split(unit).length - 1).toBe(1);
    }
  });

  it("says on the line when today prints the same as the line", () => {
    const c = buildChallenge([...base, rep(0, 0, "today", 9, 140)], NOW)!;
    /* The rounded strings are what the card prints, so a today that
       formats the same as the line is the case, whatever the floats. */
    const line = challengeLine({ ...c, today: c.line, closed: true });
    expect(line).toMatch(/ today, on the line\.$/);
    expect(line).not.toMatch(/(under|over|inside)/);
  });

  it("says the same thing about their week whether or not it closed", () => {
    const open = buildChallenge(base, NOW)!;
    const shut = buildChallenge([...base, rep(0, 0, "today", 9, 140)], NOW)!;
    expect(challengeFoot(shut)).toBe(challengeFoot(open));
  });

  it("carries no em dash and never says the word", () => {
    const c = buildChallenge(base, NOW)!;
    for (const s of [challengeLine(c), challengeFoot(c)]) {
      expect(s).not.toContain("—");
      expect(s.toLowerCase()).not.toContain("challenge");
      expect(s.toLowerCase()).not.toMatch(/keep it up|don't|you should/);
    }
  });
});

describe("the ring does not buzz on arrival", () => {
  /**
   * The comment in components/Ring.tsx said this and the code did the
   * opposite: the ref started at `false`, which is a claim about a ring
   * nobody had seen, so a ring mounting full read as an edge. The
   * challenge ring mounts full on every evening it was closed.
   */
  it("seeds the closed ref from the first value it sees", () => {
    const src = readFileSync("components/Ring.tsx", "utf8");
    expect(src).toContain("useRef<boolean | null>(null)");
    expect(src).toMatch(/closed\.current === null/);
  });
});

describe("the week's coin", () => {
  /**
   * The prize is weekly, not daily, and that is an economy decision:
   * the streak-day coin already fires for the recording that closes a
   * challenge, so a daily one would be two ledger rows for one act and
   * would double the rate the shop's prices were set backwards from.
   */
  it("counts the closed days of each week", () => {
    /*
     * Two weeks, because a day can only close against a line drawn from
     * the week BEFORE its own: the first week here is what the second
     * week's line comes from, which is also why `closesByWeek` is
     * silent about somebody's first week.
     */
    const week = [
      ...Array.from({ length: 7 }, (_, i) => rep(8 + i, 6)),
      ...Array.from({ length: 6 }, (_, i) => rep(i + 1, 1)),
    ];
    const weeks = closesByWeek(week, NOW);
    expect(weeks.length).toBeGreaterThan(0);
    for (const w of weeks) {
      expect(w.closed).toBeGreaterThanOrEqual(0);
      expect(w.week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("pays nothing for a week nobody spoke in", () => {
    expect(closesByWeek([], NOW)).toEqual([]);
  });
});

/*
 * The trait is chosen once a day, from the last recording before the
 * day began. It used to come from the newest recording overall, so a
 * recording made today switched today's card to another trait, and every
 * past week was judged again by whatever the newest recording picked.
 */
describe("the day's trait", () => {
  /** A recording at a local moment, filler rate and held pauses chosen. */
  function at(when: Date, fillers: number, held: number): RepRow {
    const r = rep(0, fillers, `at-${when.getTime()}-${fillers}-${held}`, held);
    return { ...r, created_at: when.toISOString() };
  }

  it("stays the same after today's recording", () => {
    const week: RepRow[] = [];
    for (let i = 0; i < 7; i++) week.push(at(new Date(2026, 9, 19 + i, 12), 8 + (i % 3), 1));
    const morning = buildChallenge(week, new Date(2026, 9, 26, 8));
    // Today: few fillers, no held pause, so the newest row's weakest
    // trait is a different one.
    const today = at(new Date(2026, 9, 26, 9), 2, 0);
    const after = buildChallenge([...week, today], new Date(2026, 9, 26, 10));
    expect(morning).not.toBeNull();
    expect(after?.trait).toBe(morning?.trait);
    expect(after?.line).toBe(morning?.line);
  });

  it("judges a past week the same whatever is recorded later", () => {
    const reps: RepRow[] = [];
    for (let i = 0; i < 7; i++) reps.push(at(new Date(2026, 9, 5 + i, 12), 8, 1));
    for (let i = 0; i < 5; i++) reps.push(at(new Date(2026, 9, 12 + i, 12), 2, 0));
    const now = new Date(2026, 9, 26, 20);
    const before = closesByWeek(reps, now).find((w) => w.week === "2026-10-12");
    const later = at(new Date(2026, 9, 26, 12), 8, 4);
    const after = closesByWeek([...reps, later], now).find((w) => w.week === "2026-10-12");
    expect(after?.closed).toBe(before?.closed);
  });

  it("reads the last recording before today began", () => {
    const yesterday = at(new Date(2026, 9, 25, 20), 8, 1);
    const today = at(new Date(2026, 9, 26, 9), 2, 0);
    expect(practiceRow([yesterday, today], new Date(2026, 9, 26, 10))).toBe(yesterday);
    // Only today's: nothing earlier to choose from, so the newest stands in.
    expect(practiceRow([today], new Date(2026, 9, 26, 10))).toBe(today);
  });
});

/*
 * A take too short to score (under twenty words) says "Not enough to
 * score" on its results. A one-word 8s take at 7 wpm the night before
 * switched the next day's card to pace, and a short take today closed
 * the line on numbers nothing measured.
 */
describe("a take too short to score is no reading", () => {
  const week = [2, 3, 4, 5].map((d) => take(nov(d), { held: 2, wpm: 128 }));
  const word = (when: Date, over: Parameters<typeof take>[1] = {}) =>
    take(when, { transcript: "Hello.", duration_s: 8.3, wpm: 7, held: 0, ...over });

  it("does not choose the day's trait", () => {
    const night = word(nov(5, 22));
    const morning = nov(6, 9);
    expect(practiceRow([...week, night], morning)).toBe(week[week.length - 1]);
    expect(buildChallenge([...week, night], nov(12, 9))?.trait).toBe(
      buildChallenge(week, nov(12, 9))?.trait
    );
    expect(practiceRow([night], morning)).toBeUndefined();
  });

  it("clears nothing today and counts for nothing in the week", () => {
    const base = [rep(1, 4), rep(2, 6), rep(3, 9), rep(4, 2), rep(5, 7)];
    const short = { ...rep(0, 0, "short", 9, 140), transcript: "Okay, fine then." };
    const c = buildChallenge([...base, short], NOW)!;
    expect(c.today).toBeNull();
    expect(c.closed).toBe(false);
    const inWeek = [1, 2, 3].map((d) => ({ ...rep(d, 0, `short-${d}`, 9), transcript: "Okay." }));
    expect(buildChallenge([...base, ...inWeek], NOW)!.cleared).toEqual(
      buildChallenge(base, NOW)!.cleared
    );
  });
});

/*
 * Pace has a zone, 130 to 160, where the others have a direction. Its
 * line said "Inside 104 words a minute", and a 178 day "178 today,
 * inside 104".
 */
describe("a pace line names the zone", () => {
  const slow = [110, 120, 104, 100].map((wpm, i) => take(nov(3 + i), { wpm }));
  const now = nov(12, 20);
  const on = (wpm: number) => buildChallenge([...slow, take(nov(12, 9), { wpm })], now)!;

  it("says nearer the zone than the line, open and closed", () => {
    const open = buildChallenge(slow, now)!;
    expect(open).toMatchObject({ trait: "pace", line: 104, direction: "band" });
    expect(challengeLine(open)).toBe("Nearer 130 to 160 than 104 words a minute.");
    expect(challengeFoot(open)).toBe("You cleared it on 3 of your last 4.");
    expect(challengeLine(on(178))).toBe("178 words a minute today, nearer 130 to 160 than 104.");
    expect(challengeLine(on(145))).toBe("145 words a minute today, inside 130 to 160.");
    expect(on(210).closed).toBe(false);
    expect(challengeLine(on(210))).toBe("210 words a minute today, further from 130 to 160 than 104.");
  });

  it("says inside the zone when the line is in it, and never inside one number", () => {
    const inside = { ...buildChallenge(slow, now)!, line: 140 };
    expect(challengeLine(inside)).toBe("Inside 130 to 160 words a minute.");
    expect(challengeLine({ ...inside, today: 175, closed: false })).toBe(
      "175 words a minute today, outside 130 to 160."
    );
    for (const c of [buildChallenge(slow, now)!, on(178), on(145), on(210), on(104), inside]) {
      for (const s of [challengeLine(c), challengeFoot(c)]) {
        expect(s).not.toMatch(/inside (?!130 to 160)\d/i);
        expect(s).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});

/*
 * Standing clamps, so readings at the floor tie: a week of 0, 0, 1, 2,
 * 3 held pauses drew "Over 0" and a take with none closed it, and 16 um
 * or uh per hundred words closed a line of 8 as "under 8".
 */
describe("a line something can miss", () => {
  const now = nov(12, 20);

  it("never draws a more-is-better line at 0", () => {
    const week = [0, 0, 1, 2, 3].map((held, i) => take(nov(3 + i), { held }));
    const c = buildChallenge(week, now)!;
    expect(c).toMatchObject({ trait: "pause", line: 1, cleared: { n: 3, of: 5 } });
    const none = buildChallenge([...week, take(nov(12, 9), { held: 0 })], now)!;
    expect(none.closed).toBe(false);
    // Nothing but 0 all week: no line at all, rather than one nobody can miss.
    expect(buildChallenge([0, 0, 0, 0].map((held, i) => take(nov(3 + i), { held })), now)).toBeNull();
  });

  it("orders readings the clamp ties by their own value", () => {
    // 150 words with 10, 12, 15, 18 ums: 6.7, 8, 10 and 12 per hundred.
    const week = [10, 12, 15, 18].map((fillers, i) => take(nov(3 + i), { fillers }));
    const worse = buildChallenge([...week, take(nov(12, 9), { fillers: 24 })], now)!;
    expect(worse).toMatchObject({ trait: "fillers", line: 10, closed: false, cleared: { n: 3, of: 4 } });
    expect(challengeLine(worse)).toBe("16 um or uh per hundred words today. The line is 10.");
    // A close at the floor fills the ring.
    const better = buildChallenge([...week, take(nov(12, 9), { fillers: 13 })], now)!;
    expect(better).toMatchObject({ closed: true, value: 1 });
    // A week of 20 per hundred pays no coin.
    const heavy = [9, 10, 11, 12, 13].map((d) => take(nov(d), { fillers: 30 }));
    expect(closesByWeek([...week, ...heavy], nov(15, 20))).toEqual([{ week: "2026-11-09", closed: 0 }]);
  });
});
