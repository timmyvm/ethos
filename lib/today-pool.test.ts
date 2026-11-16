import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATH } from "@/content/path";
import { TRAITS, type TraitId } from "@/content/traits";
import type { RepRow } from "./client-data";
import { EMPTY_ANSWERS, writeOnboarding } from "./answers";
import { buildChallenge } from "./challenge";
import { practiceHref, todayHref, todayHrefOn, todaysPractice } from "./home";
import { poolFor, poolForRow, poolHere } from "./pool";
import { resolveRepConfig } from "./rep-config";
import { TOPICS } from "./topics";

/*
 * The school pool on every surface that names Today's practice (#489,
 * review). lib/next-practice.test.ts holds the selector; this holds what
 * a person meets: Today's card (`todaysPractice` in the pool Today reads),
 * its Start, the command menu's Today (`todayHref` with `poolHere`, the
 * phone's own answers) and the reminder (`todayHrefOn` with the pool the
 * server reads off the account's row), built from stored rows the way the
 * phone and the server build them, for a year of days, for every trait
 * the rows can make weakest at both tiers.
 */

/** Every topic the school pool drops, read from the topics, not listed by hand. */
const NOT_SCHOOL = new Set(TOPICS.filter((t) => t.not?.includes("school")).map((t) => t.id));

const words = (n: number, distinct: number) =>
  Array.from({ length: n }, (_, i) => `word${i % distinct}`).join(" ");

interface Shape {
  length: number;
  distinct: number;
  duration_s: number;
  wpm: number;
  ums: number;
  pre: number;
  repairs: number;
}

function row(s: Shape, at: Date, id: string): RepRow {
  return {
    id,
    lesson_id: null,
    created_at: at.toISOString(),
    duration_s: s.duration_s,
    transcript: words(s.length, Math.min(s.distinct, s.length)),
    wpm: s.wpm,
    filler_count: s.ums,
    fillers: Array.from({ length: s.ums }, (_, i) => ({ word: "um", t: i })),
    pauses: Array.from({ length: s.pre }, (_, i) => ({ t: i * 4, len: 1, kind: "pre" })),
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    audio_path: null,
    dimensions: { tier1: { repairs: s.repairs }, anchors: {}, tier2: null },
    mode: "daily",
    mods: [],
  } as unknown as RepRow;
}

/* One stored take's shape for each weakest trait at each tier, found the
   way a person's numbers fall, not written to the selector's insides. */
const SHAPES = new Map<string, Shape>();
const PROBE = new Date(2026, 10, 16, 12);
for (const length of [150, 40])
  for (const distinct of [150, 60])
    for (const duration_s of [60, 120])
      for (const wpm of [145, 200, 175])
        for (const ums of [0, 3, 10])
          for (const pre of [12, 4, 1])
            for (const repairs of [100, 40, 0]) {
              const s = { length, distinct, duration_s, wpm, ums, pre, repairs };
              const c = todaysPractice([row(s, new Date(2026, 10, 15, 12), "p")], PROBE, "all");
              if (c && !SHAPES.has(`${c.trait}|${c.item.tier}`)) SHAPES.set(`${c.trait}|${c.item.tier}`, s);
            }

const DAY = 86_400_000;
/** Three takes before `now`, the newest yesterday: an open day. */
const takesBefore = (s: Shape, now: Date) =>
  [3, 2, 1].map((d, i) => row(s, new Date(now.getTime() - d * DAY), `r${i}`));
const params = (href: string) => new URL(href, "https://speakethos.com").searchParams;

/** The card's item before #489: the trait's walk at the day's place, with no pool. */
function before(trait: TraitId, tier: 1 | 2, now: Date): string {
  const walk = PATH.filter((p) => p.trait === trait && p.tier === tier);
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);
  return walk[day % walk.length].id;
}

/* The phone's answers, for `poolHere` (the command menu's Today). */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Today's practice in the person's pool, on every surface (#489)", () => {
  it("finds a stored take that makes each trait the weakest at each tier", () => {
    expect([...SHAPES.keys()].sort()).toEqual(
      TRAITS.flatMap((t) => [`${t.id}|1`, `${t.id}|2`]).sort()
    );
  });

  /* Under 18 on the phone, under 18 on the account; and the same for an
     age never given, on both sides. */
  for (const [who, ageBand] of [
    ["someone under 18", "u18"],
    ["someone who never gave an age", null],
  ] as const) {
    it(`never shows ${who} a topic the school pool drops, and the card, Start, the command menu and the reminder name one practice, every day of a year`, () => {
      writeOnboarding({ answers: { ...EMPTY_ANSWERS, ageBand }, done: true, synced: true });
      const phone = poolHere();
      const account = poolForRow({ age_band: ageBand, context: null });
      expect([phone, account]).toEqual(["school", "school"]);
      let standIns = 0;
      for (const [key, shape] of SHAPES) {
        for (let d = 0; d < 366; d++) {
          const now = new Date(2026, 10, 16 + d, 12);
          const history = takesBefore(shape, now);
          const card = todaysPractice(history, now, phone)!;
          const start = practiceHref(card, { ready: true });
          const menu = todayHref(history, now, phone);
          /* The server reads the stored rows on the subscriber's calendar. */
          const reminder = todayHrefOn(history, now, now.getTimezoneOffset(), account);
          const named = [card.item.topicId, params(start).get("topic"), params(menu).get("topic"), params(reminder).get("topic")];
          expect([key, d, named.filter((t) => NOT_SCHOOL.has(t!))]).toEqual([key, d, []]);
          expect([key, d, menu, reminder]).toEqual([key, d, start, start]);
          if (card.item.id.endsWith("-school")) {
            standIns++;
            /* The recorder opens it as the day's practice, under the trait's own angle. */
            const c = resolveRepConfig({ topic: params(reminder).get("topic"), item: params(reminder).get("item") });
            expect([c.unit, c.practice?.id, c.lessonId]).toEqual(["Today's practice", card.item.id, `topic:${card.item.topicId}`]);
          }
        }
      }
      // Six places of the shipped walks hold a job prompt; a year meets each twice or three times.
      expect(standIns).toBeGreaterThanOrEqual(12);
    });
  }

  it("gives a grown-up exactly what the card gave before, on the card, the command menu and the reminder", () => {
    writeOnboarding({ answers: { ...EMPTY_ANSWERS, ageBand: "18_24" }, done: true, synced: true });
    const phone = poolHere();
    const account = poolForRow({ age_band: "18_24", context: null });
    expect([phone, account]).toEqual(["all", "all"]);
    let jobDays = 0;
    for (const [key, shape] of SHAPES) {
      const [trait, tier] = key.split("|") as [TraitId, string];
      for (let d = 0; d < 400; d++) {
        const now = new Date(2026, 10, 16 + d, 12);
        const history = takesBefore(shape, now);
        const card = todaysPractice(history, now, phone)!;
        expect([key, d, card.item.id]).toEqual([key, d, before(trait, Number(tier) as 1 | 2, now)]);
        const start = practiceHref(card, { ready: true });
        expect(todayHref(history, now, phone)).toBe(start);
        expect(todayHrefOn(history, now, now.getTimezoneOffset(), account)).toBe(start);
        if (NOT_SCHOOL.has(card.item.topicId)) jobDays++;
      }
    }
    // The grown-up's walk still holds the job prompts on their days.
    expect(jobDays).toBeGreaterThan(0);
  });

  it("never moves today's line with the pool: it reads the trait, which no pool changes", () => {
    let lines = 0;
    for (const [, shape] of SHAPES) {
      for (let d = 0; d < 40; d++) {
        const now = new Date(2026, 10, 16 + d, 12);
        const history = takesBefore(shape, now);
        const school = todaysPractice(history, now, "school")!;
        const all = todaysPractice(history, now, "all")!;
        expect(school.trait).toBe(all.trait);
        const line = buildChallenge(history, now);
        if (line) {
          lines++;
          expect(line.trait).toBe(school.trait);
        }
      }
    }
    expect(lines).toBeGreaterThan(0);
  });

  it("reads one pool from the phone's answers and from the account's row", () => {
    for (const ageBand of [null, "u18", "18_24", "25_34", "35_plus"] as const) {
      for (const context of [null, "class", "work", "social", "online"] as const) {
        writeOnboarding({ answers: { ...EMPTY_ANSWERS, ageBand, context }, done: true, synced: true });
        expect([ageBand, context, poolHere()]).toEqual([ageBand, context, poolForRow({ age_band: ageBand, context })]);
        expect(poolHere()).toBe(poolFor({ ...EMPTY_ANSWERS, ageBand, context }));
      }
    }
  });
});
