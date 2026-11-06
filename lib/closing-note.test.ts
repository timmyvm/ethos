import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClosingNote } from "@/components/rep/ClosingNote";
import { closingLook, sentences } from "./closing-note";
import { gameById, type Game } from "./games";
import type { LadderState } from "./ladder";
import { computeMetrics, substance, type RepMetrics } from "./metrics";
import { takeRewards } from "./rep-screen";
import { endNote, type RewardMoment } from "./rewards";
import { ladderView } from "./round-copy";
import type { StreakState } from "./streak";

/*
 * The last step's closing note (Timothy, 6 Nov, #423): the take's last
 * word, never one more card under "Records broken". Every closing the
 * walk can end on, read the way the note sets it.
 */
const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});
/** Enough words to score (`isScorable`), as lib/rewards.test.ts says them. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
const metrics = (over: Partial<RepMetrics> = {}): RepMetrics => ({
  ...computeMetrics([], 60),
  substance: substance(SAID),
  durationS: 60,
  wpm: 200,
  fillerCount: 3,
  fillersPerMin: 3,
  heldPauses: 2,
  composedPauses: 0,
  midSentencePauses: 2,
  stars: 2,
  ...over,
});
const base = { gains: [], repCount: 22 };
const QA = gameById("qa") as Game;
const ladder = (over: Partial<LadderState> = {}): LadderState => ({
  open: 1,
  counted: 1,
  of: 2,
  countedToday: true,
  mastered: false,
  best: { 1: null, 2: null, 3: null },
  chain: 0,
  ...over,
});

describe("closingLook, every closing the walk ends on", () => {
  it("sets a composed-pause close's number in Pausing's tone, a sentence to a line", () => {
    const m = endNote({ ...base, metrics: metrics({ composedPauses: 3 }), streak: streak({ current: 5 }) });
    expect(closingLook(m)).toEqual({
      pre: "",
      value: "3",
      post: " composed pauses",
      ink: "trait",
      trait: "pause",
      lines: ["Silence you chose, before a new point.", "That's the hard one."],
    });
  });

  it("reads Fillers for a clean take and Pace for one in the zone", () => {
    const clean = closingLook(endNote({ ...base, metrics: metrics({ fillerCount: 0 }), streak: streak() }));
    expect([clean.value, clean.post, clean.ink, clean.trait]).toEqual(["Zero", " fillers", "trait", "fillers"]);
    expect(clean.lines).toEqual(["60 seconds, clean."]);
    const zone = closingLook(endNote({ ...base, metrics: metrics({ wpm: 145 }), streak: streak() }));
    expect([zone.value, zone.post, zone.ink, zone.trait]).toEqual(["145", " words a minute", "trait", "pace"]);
  });

  it("sets a streak close in sage, since a streak is earned and no trait's", () => {
    const run = closingLook(endNote({ ...base, metrics: metrics(), streak: streak({ current: 4 }) }));
    expect([run.value, run.post, run.ink, run.trait]).toEqual(["4", " days running", "earned", null]);
    expect(run.lines).toEqual(["You showed up again.", "That's the whole mechanism."]);
  });

  it("leaves a plain count in the ink, its number mid-line", () => {
    const count = closingLook(endNote({ ...base, metrics: metrics(), streak: streak({ current: 1 }) }));
    expect([count.pre, count.value, count.post, count.ink]).toEqual(["Recording ", "22", " logged", "plain"]);
    expect(count.lines).toEqual(["Recorded, measured, kept.", "Same time tomorrow."]);
  });

  it("closes an unscored take on its streak or its count, never in a trait's tone", () => {
    const twoWords = metrics({ durationS: 5, wordCount: 2, wpm: 24, fillerCount: 0, composedPauses: 1 });
    const p = { prior: [], metrics: twoWords, ethosIndex: null, gains: [], repCount: 9, scorable: false };
    const run = closingLook(takeRewards({ ...p, streak: streak({ current: 7, didToday: true }) }).closing);
    expect([run.value, run.ink, run.trait]).toEqual(["7", "earned", null]);
    const count = closingLook(takeRewards({ ...p, streak: streak({ current: 1, didToday: true }) }).closing);
    expect([count.value, count.ink, count.trait]).toEqual(["9", "plain", null]);
    expect(count.lines).toEqual(["Kept.", "Give the next one 60 to 90 seconds."]);
  });

  it("keeps a level opened and a game mastered earned, the level whole", () => {
    const open = ladderView(QA, ladder({ open: 2 }), ladder({ open: 3, of: 3, counted: 0 }), true).moment;
    expect(open).not.toBeNull();
    const o = closingLook(open as RewardMoment);
    expect([o.pre, o.value, o.post, o.ink]).toEqual(["", "Level 3", " is open", "earned"]);
    const done = ladderView(
      QA,
      ladder({ open: 3, of: 3, counted: 2 }),
      ladder({ open: 3, of: 3, counted: 3, mastered: true }),
      true
    ).moment;
    const d = closingLook(done as RewardMoment);
    // No number in "Q&A mastered": the whole line wears the sage.
    expect([d.value, d.post, d.ink]).toEqual([null, "Q&A mastered", "earned"]);
    expect(d.lines).toEqual(["Three days at level 3, three stars each."]);
  });
});

describe("sentences", () => {
  it("splits on a sentence's end and nowhere else", () => {
    expect(sentences("Silence you chose, before a new point. That's the hard one.")).toEqual([
      "Silence you chose, before a new point.",
      "That's the hard one.",
    ]);
    expect(sentences("Three days at level 3, three stars each.")).toEqual(["Three days at level 3, three stars each."]);
    expect(sentences("849, past your 690")).toEqual(["849, past your 690"]);
    expect(sentences("")).toEqual([]);
  });
});

describe("ClosingNote", () => {
  const render = (m: RewardMoment) => renderToStaticMarkup(createElement(ClosingNote, { moment: m }));

  it("is no card: no fill, no edge, its number in the trait's tone", () => {
    const html = render(endNote({ ...base, metrics: metrics({ composedPauses: 3 }), streak: streak() }));
    expect(html).not.toMatch(/\bcard\b|bg-sage|border-sage/);
    expect(html).toContain('data-look="closing-note"');
    expect(html).toContain('data-trait="pause"');
    expect(html).toContain('data-ink="trait"');
    expect(html).toContain('<span class="closing-note-value">3</span> composed pauses');
    expect(html).toContain('<span class="block">Silence you chose, before a new point. </span>');
  });

  it("carries no trait on an earned close", () => {
    const html = render({ headline: "Level 3 is open", detail: "Demos cuts in twice.", tone: "earned" });
    expect(html).not.toContain("data-trait");
    expect(html).toContain('data-ink="earned"');
    expect(html).toContain('<span class="closing-note-value">Level 3</span> is open');
  });
});

describe("the last step's closing on app/rep/page.tsx", () => {
  const page = readFileSync("app/rep/page.tsx", "utf8");

  it("ends on the closing note at a section's distance, and keeps the records as cards", () => {
    expect(page).toContain('{last && closingNow && <ClosingNote moment={closingNow} className="mt-7" />}');
    expect(page).not.toMatch(/<Moment moment=\{closingNow\}/);
    expect(page).toContain("<Moment key={i} moment={b} />");
    expect(page).toMatch(/const closingNow = ladder\?\.moment \?\? closing;/);
  });
});
