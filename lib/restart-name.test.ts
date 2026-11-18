import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRAIT, TRAITS as TAUGHT } from "@/content/traits";
import { LESSONS } from "@/content/lessons";
import { PATH } from "@/content/path";
import { DimensionList } from "@/components/DimensionList";
import type { Challenge } from "./challenge";
import { COMMANDS, findCommands } from "./commands";
import type { CoachOutput } from "./coach";
import { DIMENSION_NAME, dimensionRows, rowsHeadline, STRONG_PHRASE } from "./dimension-rows";
import { DRILLS } from "./drills";
import { GAMES } from "./games";
import { glanceLine } from "./glance";
import { LINE_WORDS, lineFigure } from "./home";
import { answerLine, cueEvidence, cueSentence, cueShortSentence, cueTitle, warmupLead } from "./carried-cue";
import { computeMetrics, type RepMetrics } from "./metrics";
import { UNITS } from "./path";
import { tipFace } from "./tip-labels";
import { TOPIC_SHAPES } from "./topics";
import { placeWords, withUnit } from "./trait-readings";
import { practiseLabel } from "./trait-sheet";
import { levelUpLine, TRAITS } from "./traits";

/*
 * One name for restarts (#502, Timothy 18 Nov: "I don't really
 * understand restarts either"). A sentence the speaker began, broke off
 * and started again is a "sentence restart" on every surface: its card,
 * its score row, its level, its count, its tips. Three readers read
 * eight labels cold; "Restarts" read as restarting the recording,
 * "Self-corrections" as grammar fixes, and "Restart control" was a
 * second name for the same count. The stored key stays `repairs`.
 *
 * Every string module the trait's words come from is swept here the way
 * lib/tip-labels.test.ts sweeps the pause words: the lines are built by
 * the code that builds them on screen, not copied.
 */

const OLD_NAMES = /\bRestart control\b|\bself[- ]correct/i;
/* The noun alone: "restart" or "restarts" not after "sentence". The verb
   ("restarted 3 sentences", "restart fewer sentences") is free. */
const BARE_NOUN = /(?<!sentence )\brestarts?\b(?! (?:one|fewer|a|the|your|it|them|every|each) sentences?\b)/i;
const WORDS_OF_489 = /restarted phrases?/i;

const SAID_WELL = { wordCount: 150, distinctRatio: 0.62, repeatShare: 0.05 };
const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const COACH = {
  focus: "",
  strength: "",
  coachLine: "",
  supply: null,
  dimensions: Object.fromEntries(
    (["structure", "credibility", "engagement", "confidence"] as const).map((k) => [
      k,
      { score: 60, citedMoment: '"you do the small version"', improve: "Open with the claim." },
    ])
  ),
} as unknown as CoachOutput;

const challenge = (over: Partial<Challenge>): Challenge => ({
  trait: "repairs",
  line: 1.2,
  direction: "lower",
  value: 0,
  closed: false,
  today: null,
  cleared: { n: 4, of: 5 },
  week: "2026-10-26",
  q: 0.3,
  ...over,
});

function everyTip(): string[] {
  const all = new Set<string>();
  for (const t of Object.values(TRAIT)) for (const x of t.howTo) all.add(x);
  for (const s of Object.values(TOPIC_SHAPES)) for (const x of s.tips) all.add(x);
  for (const d of DRILLS) for (const x of d.tips) all.add(x);
  for (const g of GAMES) for (const x of g.tips) all.add(x);
  for (const p of PATH) for (const x of p.tips) all.add(x);
  for (const l of LESSONS) for (const p of l.practices) for (const x of p.tips) all.add(x);
  for (const u of UNITS) {
    for (const x of u.intro?.howTo ?? []) all.add(x);
    for (const l of u.lessons) for (const x of l.tips) all.add(x);
  }
  return [...all];
}

/** Every line the trait's name or count can reach the screen in. */
function sweep(): string[] {
  const out: string[] = [];
  const add = (...s: (string | null | undefined)[]) => s.forEach((x) => x && out.push(x));

  /* The trait itself: card, score, level, unit, teaching. */
  for (const t of Object.values(TRAIT)) {
    add(t.name, t.skill, t.unit, t.unitOne, t.what, t.why, t.distinction, t.walkthrough?.note, t.move(1, true), t.move(3, false));
    add(placeWords({ id: t.id, percentile: 40 }), withUnit(t.id, 1), withUnit(t.id, 2.4));
  }
  for (const t of TRAITS) add(t.name, practiseLabel(t.key));
  add(...Object.values(DIMENSION_NAME), ...Object.values(STRONG_PHRASE));
  add(...Object.values(LINE_WORDS).map((w) => `${w.noun} ${w.rate}`));
  add(levelUpLine([{ key: "repairs", from: 2, to: 3, paid: 66 }], (k) => DIMENSION_NAME[k])?.forms.map((f) => f.text).join(" | "));

  /* Every tip and its face. */
  for (const tip of everyTip()) add(tip, tipFace(tip).label);
  for (const l of LESSONS) add(l.title, l.blurb);
  for (const p of PATH) add(p.title);

  /* Today's line for the trait, open, closed and unset. */
  for (const c of [challenge({}), challenge({ closed: true, today: 0.8 }), null]) {
    const f = lineFigure(c);
    add(f.label, f.said, f.rate);
  }

  /* The glance, the cue carried to tomorrow and its answer. */
  for (const n of [0, 1, 3]) {
    const metrics = { ...computeMetrics([], 62), repairCount: n, repairsPerMin: n, substance: SAID_WELL } as RepMetrics;
    for (const lead of ["Practice 2:", "Next time:", null]) {
      const g = glanceLine({ trait: "repairs", metrics, lead });
      add(g.sentence, g.cue);
    }
    const ev = cueEvidence({ kind: "restarts", word: null }, { metrics, tier1: { repairs: 40 } });
    add(ev.line.sentence, ev.short.sentence, warmupLead({ kind: "restarts", word: null, last: n }));
    for (const before of [0, 2, 5]) {
      const a = answerLine({ kind: "restarts", word: null, now: n, before, held: n < before, rested: false });
      add(a.line.sentence, a.short.sentence);
    }
    /* Every number, live and in the Log, every row open. */
    for (const brief of [true, false]) {
      const html = renderToStaticMarkup(
        createElement(DimensionList, {
          tier1: { pause: 72, fillers: 55, repairs: 33, pace: 93, range: 66 },
          anchors: { hedgeCount: 2, restartCount: n },
          metrics,
          coach: COACH,
          brief,
          open: "repairs",
        })
      );
      add(visibleText(html.replace(/<details(?![^>]*open)/g, "<details open")));
      /* What a screen reader is given: every aria-label on the rows. */
      for (const m of html.matchAll(/aria-label="([^"]*)"/g)) add(m[1]);
    }
  }
  add(cueTitle({ kind: "restarts", word: null }), cueSentence({ kind: "restarts", word: null }), cueShortSentence({ kind: "restarts", word: null }));

  /* The rows' headline with the trait lowest, at both bands. */
  add(rowsHeadline(dimensionRows({ pause: 90, fillers: 80, repairs: 30, pace: 85, range: 88 }, null)));
  add(rowsHeadline(dimensionRows({ pause: 90, fillers: 80, repairs: 60, pace: 85, range: 88 }, null)));

  /* The command menu as it is drawn: titles only, the aliases are hidden. */
  for (const c of COMMANDS) add(c.title);
  return out;
}

describe("one name for restarts (#502)", () => {
  const lines = sweep();

  it("finds the lines", () => {
    expect(lines.length).toBeGreaterThan(200);
    expect(lines.filter((s) => /sentence restarts?/i.test(s)).length).toBeGreaterThan(20);
  });

  it("never says Restart control or Self-corrections", () => {
    for (const s of lines) expect(s, s).not.toMatch(OLD_NAMES);
  });

  it("never says a bare restart: the noun is always sentence restarts", () => {
    for (const s of lines) expect(s, s).not.toMatch(BARE_NOUN);
    for (const s of lines) expect(s, s).not.toMatch(WORDS_OF_489);
  });

  it("never says a sentence is started over in a tip, where it reads as the recording", () => {
    for (const tip of everyTip()) {
      expect(tip, tip).not.toMatch(/\bstart(s|ed|ing)? over\b/i);
      expect(tipFace(tip).label, tip).not.toMatch(/\bstart(s|ed|ing)? over\b/i);
    }
  });

  it("names the trait the same on its card, its score, its level and the menu", () => {
    expect(TRAIT.repairs.name).toBe("Sentence restarts");
    expect(TRAIT.repairs.skill).toBe("Sentence restarts");
    expect(DIMENSION_NAME.repairs).toBe("Sentence restarts");
    expect(TRAITS.find((t) => t.key === "repairs")?.name).toBe("Sentence restarts");
    expect(TAUGHT.find((t) => t.id === "repairs")?.name).toBe("Sentence restarts");
    expect(COMMANDS.find((c) => c.id === "trait:repairs")?.title).toBe("Sentence restarts");
  });

  it("counts it as 1 sentence restart, 3 sentence restarts, in 100 words", () => {
    expect(withUnit("repairs", 1)).toBe("1 sentence restart in 100 words");
    expect(withUnit("repairs", 3)).toBe("3 sentence restarts in 100 words");
    const m = (n: number) => ({ ...computeMetrics([], 62), repairCount: n, substance: SAID_WELL }) as RepMetrics;
    expect(glanceLine({ trait: "repairs", metrics: m(1), lead: null }).sentence).toBe("1 sentence restart in 62s.");
    expect(glanceLine({ trait: "repairs", metrics: m(3), lead: null }).sentence).toBe("3 sentence restarts in 62s.");
  });

  it("takes a plural verb in the rows' headline", () => {
    expect(rowsHeadline(dimensionRows({ pause: 90, fillers: 80, repairs: 30, pace: 85, range: 88 }, null))).toMatch(
      /Sentence restarts are the one to work on\.$/
    );
    expect(rowsHeadline(dimensionRows({ pause: 90, fillers: 80, repairs: 60, pace: 85, range: 88 }, null))).toMatch(
      /Sentence restarts have the most room to grow\.$/
    );
    expect(rowsHeadline(dimensionRows({ pause: 30, fillers: 80, repairs: 90, pace: 85, range: 88 }, null))).toMatch(
      /Pausing is the one to work on\.$/
    );
  });

  it("says the skill on You's Practise tap, so it never reads as practising restarts", () => {
    expect(practiseLabel("repairs")).toBe("Practise finishing sentences");
    expect(practiseLabel("fillers")).toBe("Practise Filler control");
    expect(practiseLabel("pause")).toBe("Practise Pausing");
  });

  it("still finds the trait by its old words in the command menu", () => {
    for (const q of ["restart", "restart control", "self corrections", "false starts", "sentence"]) {
      expect(
        findCommands(q).some((c) => c.id === "trait:repairs"),
        q
      ).toBe(true);
    }
  });
});

/*
 * The review of #502. One name made two counts that disagreed read as a
 * contradiction, and two lines read the wrong way round.
 */
describe("one name, one number (the review of #502)", () => {
  const take = (repairCount: number, extra: Partial<RepMetrics> = {}) =>
    ({ ...computeMetrics([], 65), repairCount, repairsPerMin: repairCount, substance: SAID_WELL, ...extra }) as RepMetrics;
  const rows = (metrics: RepMetrics, restartCount: number, brief = false) =>
    visibleText(
      renderToStaticMarkup(
        createElement(DimensionList, {
          tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 },
          anchors: { hedgeCount: 2, restartCount },
          metrics,
          coach: COACH,
          brief,
        })
      ).replace(/<details(?![^>]*open)/g, "<details open")
    );

  it("Steadiness counts the Sentence restarts row's restarts, not the judge's wider count", () => {
    /* countRestarts adds every "I mean", "wait no" and "sorry" to the
       row's count; the take below had 1 restart and 2 of those. */
    for (const brief of [true, false]) {
      const text = rows(take(1), 3, brief);
      expect(text).toContain("1 sentence restart in 65 seconds");
      expect(text).toContain("2 phrases like “maybe” or “I guess”, 1 sentence restart.)");
      expect(text).not.toMatch(/3 sentence restarts/);
    }
    expect(rows(take(0), 2)).toContain("“I guess”, no sentence restarts.)");
    expect(rows(take(0), 2)).toContain("No sentence restarts in 65 seconds.");
  });

  it("keeps the judge's count where no Sentence restarts row is drawn", () => {
    const html = renderToStaticMarkup(
      createElement(DimensionList, {
        tier1: { pause: 72, fillers: 55, pace: 93, range: 66 },
        anchors: { hedgeCount: 2, restartCount: 3 },
        metrics: take(0),
        coach: COACH,
      })
    );
    expect(visibleText(html.replace(/<details(?![^>]*open)/g, "<details open"))).toContain(", 3 sentence restarts.)");
  });

  it("never says how many where a stored score of 0 cannot say", () => {
    const text = rows(take(4, { repairsAtLeast: true }), 6);
    expect(text).toContain("3 or more sentence restarts a minute.");
    expect(text).not.toMatch(/No sentence restarts|4 sentence restarts in/);
    expect(text).toContain(", 6 sentence restarts.)");
  });

  it("opens no tip with an order to restart, and never calls a restart not an error", () => {
    for (const tip of everyTip()) expect(tip, tip).not.toMatch(/^Restart\b/);
    expect(TRAIT.repairs.distinction).not.toMatch(/restarts? is not/i);
    expect(TRAIT.repairs.distinction).toMatch(/restart the sentence/);
  });
});
