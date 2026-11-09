import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import {
  aboutSeconds,
  cardFace,
  costLine,
  dayOf,
  FALLBACK_TOPIC_ID,
  greeting,
  lastSpokeOn,
  onWall,
  practiceHref,
  todayHref,
  todayHrefOn,
  todaysPractice,
  usedModsLately,
} from "./home";
import { buildChallenge } from "./challenge";
import { choosePractice } from "./next-practice";
import { recordingText, repHref, repKey, resolveRepConfig } from "./rep-config";
import { readTraitsFromRow } from "./trait-readings";

/*
 * Open straight into speaking (#431). Testers who did not record opened
 * Today, stayed a median 6.7 seconds and left without tapping Start. The
 * card on a day not yet spoken is one decision with its cost stated;
 * Start opens the recording screen ready; a return after a break is
 * welcomed without a count; a day already spoken is as it was; and the
 * reminder opens the same practice Start does.
 */

const words = (distinct: number) =>
  Array.from({ length: 150 }, (_, i) => `word${i % distinct}`).join(" ");

/** A measured recording at a local moment. */
function take(at: Date, over: Partial<RepRow> = {}): RepRow {
  return {
    id: `r-${at.getTime()}-${Math.random()}`,
    lesson_id: null,
    created_at: at.toISOString(),
    duration_s: 60,
    transcript: words(90),
    wpm: 145,
    filler_count: 2,
    fillers: [
      { word: "um", t: 3 },
      { word: "like", t: 9 },
    ],
    pauses: [{ t: 2, len: 1.2, kind: "pre" }],
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    audio_path: null,
    dimensions: { tier1: { repairs: 80 }, anchors: {}, tier2: null },
    mode: "daily",
    mods: [],
    ...over,
  } as unknown as RepRow;
}

/** A day in November 2026, at the hour given (local). Monday is the 9th. */
const nov = (d: number, h = 18) => new Date(2026, 10, d, h, 12);
const NOW = nov(9, 8);
const params = (href: string) => new URL(href, "http://ethos.local").searchParams;

describe("the day, from the newest recording", () => {
  it("is spoken today, open after yesterday, and back after a missed day or more", () => {
    expect(dayOf(null, NOW)).toBe("none");
    expect(dayOf("2026-11-09", NOW)).toBe("spoken");
    expect(dayOf("2026-11-08", NOW)).toBe("open");
    // One missed day: the flame falls to 0, the welcome is needed most.
    expect(dayOf("2026-11-07", NOW)).toBe("back");
    expect(dayOf("2026-11-05", NOW)).toBe("back");
    expect(dayOf("2026-10-01", NOW)).toBe("back");
  });

  it("reads the newest recording's local day, whatever order the rows come in", () => {
    expect(lastSpokeOn([])).toBeNull();
    const rows = [take(nov(4)), take(nov(8, 23)), take(nov(6))];
    expect(lastSpokeOn(rows)).toBe("2026-11-08");
  });

  it("turns over at local midnight, not at UTC's", () => {
    expect(dayOf("2026-11-08", new Date(2026, 10, 9, 0, 5))).toBe("open");
    expect(dayOf("2026-11-09", new Date(2026, 10, 9, 23, 55))).toBe("spoken");
  });
});

describe("the card's face", () => {
  it("on a day not yet spoken is one decision: the topic, its cost, Start and Another topic", () => {
    const f = cardFace({ dayOne: false, spokeToday: false, usedMods: false });
    expect(f).toEqual({
      lead: "Today's practice",
      tactic: false,
      cost: true,
      spin: "link",
      mods: false,
      ready: true,
    });
  });

  it("keeps the difficulty glyph on an open day for someone who turned one up this week", () => {
    const f = cardFace({ dayOne: false, spokeToday: false, usedMods: true });
    expect(f.mods).toBe(true);
    expect(f.spin).toBe("link");
    expect(f.tactic).toBe(false);
  });

  it("is unchanged once today is spoken: One more, the tactic, spin and difficulty, the full recording screen", () => {
    for (const usedMods of [false, true]) {
      expect(cardFace({ dayOne: false, spokeToday: true, usedMods })).toEqual({
        lead: "One more",
        tactic: true,
        cost: false,
        spin: "glyph",
        mods: true,
        ready: false,
      });
    }
  });

  it("is unchanged on day one", () => {
    expect(cardFace({ dayOne: true, spokeToday: false, usedMods: false })).toEqual({
      lead: "Your first recording",
      tactic: false,
      cost: false,
      spin: "glyph",
      mods: true,
      ready: false,
    });
  });

  it("knows a turned-up difficulty only inside the last seven days", () => {
    expect(usedModsLately([take(nov(8), { mods: ["no-notes"] })], NOW)).toBe(true);
    expect(usedModsLately([take(nov(1), { mods: ["no-notes"] })], NOW)).toBe(false);
    expect(usedModsLately([take(nov(8))], NOW)).toBe(false);
  });
});

describe("what the take costs", () => {
  it("is 60 seconds until there are three takes to read", () => {
    expect(aboutSeconds([])).toBe(60);
    expect(aboutSeconds([take(nov(7), { duration_s: 84 }), take(nov(8), { duration_s: 84 })])).toBe(60);
    expect(costLine(60)).toBe("About 60 seconds");
  });

  it("is the median of the last seven practice takes, to ten seconds, 30 to 90", () => {
    const at = (s: number, d: number) => take(nov(d), { duration_s: s });
    expect(aboutSeconds([at(42, 1), at(47, 2), at(55, 3)])).toBe(50);
    expect(aboutSeconds([at(74, 1), at(77, 2), at(76, 3), at(81, 4)])).toBe(80);
    // Only the last seven count: three old long takes drop out.
    const old = [at(90, 1), at(90, 2), at(90, 3)];
    const recent = [40, 41, 39, 42, 38, 40, 44].map((s, i) => at(s, 4 + i));
    expect(aboutSeconds([...old, ...recent])).toBe(40);
    expect(aboutSeconds([at(9, 1), at(12, 2), at(14, 3)].map((r) => ({ ...r, transcript: words(90) })))).toBe(30);
  });

  it("leaves out games, the boss and takes too short to score", () => {
    const daily = [55, 58, 61].map((s, i) => take(nov(1 + i), { duration_s: s }));
    const noise = [
      take(nov(5), { duration_s: 90, lesson_id: "game:qa:3" }),
      take(nov(6), { duration_s: 90, mode: "boss" }),
      take(nov(7), { duration_s: 3, transcript: "Hello." }),
    ];
    expect(aboutSeconds([...daily, ...noise])).toBe(60);
  });

  it("says its number in the copy rules' plain form", () => {
    for (const s of [30, 40, 60, 90]) {
      const line = costLine(s);
      expect(line).toMatch(/^About \d+ seconds$/);
      expect(line).not.toMatch(/[—–]/);
    }
  });
});

describe("the greeting", () => {
  it("says hi on a day like any other, and welcomes back after a break", () => {
    expect(greeting("Timothy", false)).toEqual({ full: "Hi, Timothy", short: "Timothy" });
    expect(greeting("Timothy", true)).toEqual({ full: "Welcome back, Timothy", short: "Welcome back" });
    expect(greeting(null, false)).toEqual({ full: "Today", short: null });
    expect(greeting(null, true)).toEqual({ full: "Welcome back", short: null });
  });

  it("never counts the days away or names the streak", () => {
    for (const back of [false, true]) {
      const g = greeting("Timothy", back);
      for (const line of [g.full, g.short ?? ""]) {
        expect(line).not.toMatch(/\d|streak|broke|lost|again|miss/i);
      }
    }
  });
});

describe("Start's address and the reminder's are one", () => {
  const history = [take(nov(5)), take(nov(6)), take(nov(8))];

  it("is Today's own practice, the one selector's (#268)", () => {
    const chosen = todaysPractice(history, NOW)!;
    expect(chosen).not.toBeNull();
    expect(chosen).toEqual(choosePractice(readTraitsFromRow(history[2]), NOW));
    // The card, today's line and the reminder name one trait.
    expect(buildChallenge(history, NOW)?.trait).toBe(chosen.trait);
    const q = params(practiceHref(chosen, { ready: true }));
    expect(q.get("topic")).toBe(chosen.item.topicId);
    expect(q.get("item")).toBe(chosen.item.id);
    expect(q.get("trait")).toBe(chosen.trait);
    expect(q.get("ready")).toBe("1");
  });

  it("opens ready on a day not yet spoken, and as it was on a day already spoken", () => {
    const open = todayHref(history, NOW);
    expect(open).toBe(practiceHref(todaysPractice(history, NOW), { ready: true }));
    const spoken = [...history, take(nov(9, 7))];
    const again = todayHref(spoken, NOW);
    expect(params(again).get("ready")).toBeNull();
    // A take earlier today does not move today's practice (#268).
    expect(params(again).get("item")).toBe(params(open).get("item"));
  });

  it("opens Today with no recording yet, which knows day one's lesson", () => {
    expect(todayHref([], NOW)).toBe("/");
  });

  it("falls back to the fallback topic when nothing measured", () => {
    const short = [take(nov(8), { transcript: "Okay.", duration_s: 4 })];
    const q = params(todayHref(short, NOW));
    expect(q.get("topic")).toBe(FALLBACK_TOPIC_ID);
    expect(q.get("item")).toBeNull();
    expect(q.get("trait")).toBe("pause");
    expect(q.get("ready")).toBe("1");
  });

  it("files the take as Today's topic, never the road's rotation", () => {
    const q = params(todayHref(history, NOW));
    const c = resolveRepConfig({ topic: q.get("topic"), item: q.get("item") });
    const chosen = todaysPractice(history, NOW)!;
    expect(c.unit).toBe("Today's practice");
    expect(c.lessonId).toBe(`topic:${chosen.item.topicId}`);
    expect(recordingText(c).topic).toBe(chosen.item.prompt);
    // Bare /rep was the road's prompt.
    expect(recordingText(resolveRepConfig({})).topic).not.toBe(chosen.item.prompt);
  });

  it("does not make ready part of the take: the same recording either way", () => {
    const item = todaysPractice(history, NOW)!.item;
    const plain = params(repHref({ topic: item.topicId, item: item.id }));
    const ready = params(repHref({ topic: item.topicId, item: item.id, ready: true }));
    expect(repKey(ready)).toBe(repKey(plain));
    expect(repHref({ topic: item.topicId, ready: false })).toBe(`/rep?topic=${item.topicId}`);
  });
});

describe("the reminder on the subscriber's calendar", () => {
  /* push_subscriptions.tz_offset is getTimezoneOffset's sign: Melbourne in
     November is UTC+11, stored as -660. */
  const MEL = -660;

  it("reads an instant on the subscriber's wall clock wherever the server runs", () => {
    // 21:30 UTC on 8 Nov is 08:30 on 9 Nov in Melbourne.
    const w = onWall(new Date(Date.UTC(2026, 10, 8, 21, 30)), MEL);
    expect([w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getMinutes()]).toEqual([2026, 10, 9, 8, 30]);
    const ny = onWall(new Date(Date.UTC(2026, 10, 9, 3, 0)), 300);
    expect([ny.getDate(), ny.getHours()]).toEqual([8, 22]);
  });

  it("chooses the practice Today's card shows that subscriber on their day", () => {
    /* Recordings at 18:12 Melbourne on the 5th, 6th and 8th; the reminder
       fires at 08:30 Melbourne on the 9th (21:30 UTC on the 8th). */
    const mel = (d: number, h: number, m = 12) => new Date(Date.UTC(2026, 10, d, h - 11, m));
    const stored = [5, 6, 8].map((d) => take(mel(d, 18)));
    const tick = mel(9, 8, 30);
    const href = todayHrefOn(stored, tick, MEL);
    // The phone in Melbourne, reading the same rows on its own clock.
    const onPhone = stored.map((r) => ({ ...r, created_at: onWall(new Date(r.created_at), MEL).toISOString() }));
    expect(href).toBe(todayHref(onPhone, onWall(tick, MEL)));
    expect(params(href).get("ready")).toBe("1");
    // And once they have spoken that morning, it is not ready, on any server clock.
    const spoke = [...stored, take(mel(9, 7))];
    expect(params(todayHrefOn(spoke, tick, MEL)).get("ready")).toBeNull();
  });
});
