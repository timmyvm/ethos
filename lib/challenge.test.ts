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
  Q_MAX,
  Q_MIN,
  Q_START,
  readingToday,
} from "./challenge";
import type { RepRow } from "./client-data";
import { readTraitsFromRow } from "./trait-readings";
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
