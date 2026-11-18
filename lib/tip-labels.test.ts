import { describe, expect, it } from "vitest";
import { TRAIT } from "@/content/traits";
import { TOPIC_SHAPES } from "@/lib/topics";
import { DRILLS } from "@/lib/drills";
import { GAMES } from "@/lib/games";
import { PATH } from "@/content/path";
import { LESSONS } from "@/content/lessons";
import { UNITS } from "@/lib/path";
import { hasTipFace, splitPrompt, tipFace } from "@/lib/tip-labels";
import { COLD_TOPICS } from "@/lib/cold-topics";
import { resolveRepConfig } from "@/lib/rep-config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AudioScrubber } from "@/components/AudioScrubber";
import { DimensionList } from "@/components/DimensionList";
import { PauseBar } from "@/components/PauseBar";
import type { TakeAudio } from "@/components/TakeAudio";
import { PAINS } from "@/content/portfolio";
import { EMPTY_ANSWERS } from "@/lib/answers";
import { answerLine, cueEvidence, cueSentence, cueShortSentence, cueTitle, warmupLead } from "@/lib/carried-cue";
import type { RepRow } from "@/lib/client-data";
import type { CoachOutput } from "@/lib/coach";
import { DIMENSION_NAME, dimensionRows, rowsHeadline, STRONG_PHRASE } from "@/lib/dimension-rows";
import { glanceLine, lessonDone } from "@/lib/glance";
import { computeMetrics, type Pause, type RepMetrics } from "@/lib/metrics";
import { otherKey, PAUSE_MARK_WORDS, PAUSE_WHY_WORDS } from "@/lib/pause-mark";
import { filledMoments, reportJudged, type JudgedPause, type PauseVerdict } from "@/lib/pause-quality";
import { buildPortfolio } from "@/lib/portfolio";
import { endNote, personalBests } from "@/lib/rewards";
import type { StreakState } from "@/lib/streak";
import { placeWords } from "@/lib/trait-readings";

/*
 * Every tactic the recording screen, a lesson or a practice can show
 * has a glanceable face: at most five words (feedback round, 25 Sep:
 * "wouldn't read the instructions"). The sentence itself opens on tap.
 */
function everyTip(): string[] {
  const all = new Set<string>();
  for (const t of Object.values(TRAIT)) for (const x of t.howTo) all.add(x);
  for (const s of Object.values(TOPIC_SHAPES)) for (const x of s.tips) all.add(x);
  for (const d of DRILLS) for (const x of d.tips) all.add(x);
  for (const g of GAMES) for (const x of g.tips) all.add(x);
  for (const p of PATH) for (const x of p.tips) all.add(x);
  for (const l of LESSONS) for (const p of l.practices) for (const x of p.tips) all.add(x);
  for (const u of UNITS) for (const x of u.intro?.howTo ?? []) all.add(x);
  return [...all];
}

describe("tip faces", () => {
  const tips = everyTip();

  it("finds the tactics", () => {
    expect(tips.length).toBeGreaterThan(100);
  });

  it("gives every shipped tactic a hand-written face", () => {
    expect(tips.filter((t) => !hasTipFace(t))).toEqual([]);
  });

  it("keeps every face to five words, with no dash and no banned word", () => {
    for (const t of tips) {
      const { label } = tipFace(t);
      expect(label.split(/\s+/).length, label).toBeLessThanOrEqual(5);
      expect(label, label).not.toMatch(/—|–/);
      expect(label, label).not.toMatch(/\b(gym|workout|drill|reps?|training)\b/i);
    }
  });

  /* practice-detail-23: "inside" had nothing to be inside of. The
     two-second test (#483): "Silence feels longer to you" was a fact,
     and a reader still did not know what to do, so the face is the move. */
  it("tells the unit intro's reader what to do with the silence", () => {
    expect(
      tipFace("Pause longer than feels right. It sounds shorter to everyone else.").label
    ).toBe("Pause a bit longer");
  });

  /* recording-15: a length of silence wears the stopwatch, so two
     Pausing tiles side by side ("Pause when a sentence ends", "Pause,
     count to two") no longer show one glyph twice, and never Pace's
     gauge. */
  it("gives every hold-a-silence tactic the stopwatch, never the gauge", () => {
    const holds = tips.filter((t) =>
      /^(Pause, count to two|Pause 1 to 2 seconds|Pause one full second|Count one second|Pause a bit longer)$/.test(tipFace(t).label)
    );
    expect(holds.length).toBeGreaterThanOrEqual(5);
    for (const t of holds) expect(tipFace(t).glyph, t).toBe("hold");
    expect(tips.filter((t) => tipFace(t).glyph === "hold").every((t) => holds.includes(t))).toBe(true);
  });

  /* The two-second test (#483, Timothy on 16 Nov: "Concrete nouns" and
     "A short concrete noun beats a long abstract one every time" could
     not be understood in two seconds). A tactic is read by someone who
     never studied grammar, so no grammar word reaches one: an example
     says it instead ("exams", not "stuff"). The headings over the
     tactics (a lesson's title and blurb, a practice's angle) are held to
     the same words. */
  it("says every tactic without a grammar word", () => {
    const GRAMMAR = /\b(nouns?|pronouns?|clauses?|abstract|concrete|connectives?|register|cadence|emphasis|fillers?|crutch)\b/i;
    for (const t of tips) {
      expect(t, t).not.toMatch(GRAMMAR);
      expect(tipFace(t).label, t).not.toMatch(GRAMMAR);
    }
    for (const l of LESSONS) {
      expect(l.title, l.id).not.toMatch(GRAMMAR);
      expect(l.blurb, l.id).not.toMatch(GRAMMAR);
    }
    for (const p of PATH) expect(p.title, p.id).not.toMatch(GRAMMAR);
  });

  /* A practice's three tiles are two of its trait's tactics side by
     side (howTo[i], howTo[i + 1]) and then its shape's (shape tip i,
     content/path.ts and content/lessons.ts), so a trait whose faces
     share a glyph shows one mark twice in a row: Restarts' three flags
     after the two-second rewrite, Variety's three speech bubbles before
     it. The recording-15 rule for Pausing, held for every trait (#483
     review). The shapes open on the start mark, keep the target second
     and mostly close on the flag, so a trait's second tactic is never
     the start, its third never the target, and its first never the
     speech bubble. Of 165 practices 55 showed a mark twice in a row
     before the rewrite and 77 after it; the one repeat left is Restarts'
     "Finish every sentence" beside a shape's closing flag, which is
     the same promise twice. */
  it("gives each of a trait's three tactics its own glyph", () => {
    for (const t of Object.values(TRAIT)) {
      const glyphs = t.howTo.map((x) => tipFace(x).glyph);
      expect(new Set(glyphs).size, `${t.id}: ${glyphs.join(", ")}`).toBe(t.howTo.length);
    }
  });

  it("never sets one mark twice in a row on a practice, but the closing flag", () => {
    const practices = [
      ...PATH.map((p) => [p.id, p.tips] as const),
      ...LESSONS.flatMap((l) => l.practices.map((p, i) => [`${l.id}:${i + 1}`, p.tips] as const)),
    ];
    expect(practices.length).toBeGreaterThan(150);
    for (const [id, tips] of practices) {
      const g = tips.map((t) => tipFace(t).glyph);
      for (let i = 1; i < g.length; i++) {
        if (g[i] === g[i - 1]) expect(g[i], `${id}: ${tips[i - 1]} / ${tips[i]}`).toBe("end");
      }
    }
  });

  it("falls back to a short clause for an unlabelled sentence", () => {
    expect(tipFace("Say one true thing about the weather, then stop.").label).toBe(
      "Say one true thing about…"
    );
  });

  /* The boss's scoring rule used to be cut off with the rest of the
     prompt (review, 25 Sep): the screen may not drop a sentence that
     changes the score. Every boss keeps it, as a face. */
  it("keeps every boss's scoring rule on screen as a tactic face", () => {
    for (const t of COLD_TOPICS) {
      const c = resolveRepConfig({ boss: t.id });
      const { line, rule } = splitPrompt(c.prompt);
      // The games plan, item 16: the reading is over when this screen
      // opens, and the line says so; the topic is on the card above it.
      expect(line.replace(/ /g, " "), t.id).toBe("Notes are gone. 90 seconds, from memory.");
      expect(rule, t.id).not.toBeNull();
      expect(hasTipFace(rule!), rule!).toBe(true);
    }
  });

  /* The two-second sweep (#490): the app's own words for a pause and its
     scoring never reach these surfaces. A pause is "between sentences" or
     "mid-sentence", a filled one has "an um" next to it; nothing "lands",
     "searches" or is "composed" or "held"; no "wpm", "crutch", "hedge",
     "dead air", "cold open" or "gear"; a rule is said with its number
     ("0 a minute scores 100"), never "None scores 100" or "earns a bonus";
     the plan names no count of stars (#486). */
  it("says the pause surfaces in plain words (#490)", () => {
    const APP_WORDS =
      /\b(landed|landing|land(s)? (a|the|your) points?|let your points land|searching|composed|held pauses?|hold 1|silence you've held|crutch|wpm|hedges?|counted rather than judged|dead air|none scores|earns a bonus|cold open|gear|distinct words?|follow-through|reads as)\b/i;
    const lines = plainSweepLines();
    expect(lines.length).toBeGreaterThan(150);
    for (const s of lines) expect(s, s).not.toMatch(APP_WORDS);
    for (const s of lines) expect(s, s).not.toMatch(/—|\bINSTEAD\b/);
    /* The plan's later unit says where it stands, never the stars it opens at. */
    for (const p of PAINS) {
      const plan = buildPortfolio({ ...EMPTY_ANSWERS, pains: [p.id] });
      for (const s of [...plan.lines, ...plan.stepParts.map((x) => x.detail)]) expect(s, s).not.toMatch(/\bopens at \d+ stars?\b/i);
    }
  });

  it("splits a one-sentence prompt into a line and no rule", () => {
    expect(splitPrompt("Argue one thing.")).toEqual({ line: "Argue one thing.", rule: null });
  });

  it("takes the last sentence as the rule and keeps the rest as the line", () => {
    expect(splitPrompt("Argue one thing. Cite it.")).toEqual({ line: "Argue one thing.", rule: "Cite it." });
    expect(splitPrompt("Notes are gone. 90 seconds, from memory. Unsure beats wrong.")).toEqual({
      line: "Notes are gone. 90 seconds, from memory.",
      rule: "Unsure beats wrong.",
    });
    expect(splitPrompt("No stop at the end")).toEqual({ line: "No stop at the end", rule: null });
  });
});

/* ---- #490: every line the pause surfaces can say, gathered for the sweep ---- */

const P = (t: number, kind: Pause["kind"], verdict?: PauseVerdict, len = 1.1, note = ""): JudgedPause =>
  ({ t, len, kind, ...(verdict ? { verdict } : {}), note }) as JudgedPause;
const MIC = "0:15 · 1.0s with a sound in it. The mic heard it, the transcript didn't.";
const PAUSE_SETS: JudgedPause[][] = [
  [P(2, "pre", "landing"), P(20, "mid", "hesitation"), P(33, "mid", "hesitation"), P(41, "pre", "landing")],
  [P(2, "pre", "landing"), P(15, "pre", "filled")],
  [P(2, "pre", "landing"), P(15, "pre", "filled", 1, MIC), P(30, "mid", "filled")],
  [P(2, "pre", "hesitation"), P(20, "mid", "hesitation"), P(50, "pre", "dead", 4)],
  [P(2, "pre", "opening"), P(41, "pre", "landing"), P(58, "pre", "landing")],
  [P(9, "beat", "beat", 0.4)],
  [P(20, "mid", "hesitation")],
  [P(20, "pre", "hesitation"), P(30, "pre", "hesitation"), P(44, "pre", "landing")],
  [P(2, "pre"), P(17, "mid"), P(30, "pre")],
];
const SAID_WELL = { wordCount: 150, distinctRatio: 0.62, repeatShare: 0.05 };
const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const SWEEP_COACH = {
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

function sweepTake(over: Partial<RepRow>): RepRow {
  return {
    id: Math.random().toString(36),
    lesson_id: null,
    created_at: new Date(2026, 7, 9, 12).toISOString(),
    duration_s: 60,
    transcript:
      "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.",
    wpm: 145,
    filler_count: 3,
    fillers: [],
    pauses: [],
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    audio_path: null,
    dimensions: null,
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    ...over,
  } as RepRow;
}

function plainSweepLines(): string[] {
  const out: string[] = [];
  const add = (...s: (string | null | undefined)[]) => s.forEach((x) => x && out.push(x));
  const streak = { current: 3 } as StreakState;

  add(...Object.values(PAUSE_MARK_WORDS), ...Object.values(PAUSE_WHY_WORDS), ...Object.values(STRONG_PHRASE), ...Object.values(DIMENSION_NAME));
  for (const set of PAUSE_SETS) {
    const metrics = {
      ...computeMetrics([], 62),
      pauses: set,
      heldPauses: set.filter((p) => p.kind !== "beat").length,
      composedPauses: set.filter((p) => p.kind === "pre").length,
      midSentencePauses: set.filter((p) => p.kind === "mid").length,
      unvoicedHesitations: 4,
      substance: SAID_WELL,
    } as RepMetrics;
    /* The Pause row's live line, its moments and the keys. */
    const headline = reportJudged(set, 62).headline;
    const moments = filledMoments(set);
    add(headline, otherKey(set), moments?.sentence, ...(moments?.moments.map((m) => m.label) ?? []));
    /* The glance, a lesson's ending, the closing note. */
    for (const lead of ["Practice 2:", "Next time:", null]) {
      const g = glanceLine({ trait: "pause", metrics, lead });
      add(g.sentence, g.cue, g.moment?.label);
    }
    add(lessonDone("pause", [{ fillers: 2, pauses: set, wpm: 150, index: 600 }])?.text);
    const e = endNote({ metrics, streak, repCount: 4 });
    add(e.headline, e.detail);
    /* Hear it back and the pause map, drawn. */
    const take = { element: null, ref: { current: null }, playable: true, span: null, play: () => {}, pause: () => {} } as unknown as TakeAudio;
    add(
      visibleText(
        renderToStaticMarkup(
          createElement(AudioScrubber, { take, durationS: 62, fillers: [{ word: "um", t: 10 }], pauses: set, marks: [{ t: 24, label: "Says who?" }] })
        )
      ),
      visibleText(renderToStaticMarkup(createElement(PauseBar, { pauses: set, durationS: 62 })))
    );
    /* Every number, live (brief) and in the Log's ledger, every row open. */
    for (const brief of [true, false]) {
      for (const pauseDetail of [headline ?? undefined, undefined]) {
        const html = renderToStaticMarkup(
          createElement(DimensionList, {
            tier1: { pause: 72, fillers: 55, repairs: 33, pace: 93, range: 66 },
            anchors: { hedgeCount: 2, restartCount: 1 },
            metrics,
            coach: SWEEP_COACH,
            pauseDetail,
            brief,
            open: "pause",
          })
        );
        add(visibleText(html.replace(/<details(?![^>]*open)/g, "<details open")));
      }
    }
    /* The cue carried to tomorrow, about pauses. */
    for (const kind of ["searching", "filled", "unheld"] as const) {
      const cueTake = { metrics, tier1: { pause: 40 } };
      const ev = cueEvidence({ kind, word: null }, cueTake);
      add(ev.line.sentence, ev.short.sentence, warmupLead({ kind, word: null, last: 2 }), cueTitle({ kind, word: null }));
      add(cueSentence({ kind, word: null }), cueSentence({ kind, word: null }, true), cueShortSentence({ kind, word: null }));
      for (const [now, before] of [[0, 3], [1, 3], [2, 2], [3, 1]]) {
        const a = answerLine({ kind, word: null, now, before, held: now < before, rested: false });
        add(a.line.sentence, a.short.sentence);
      }
    }
  }
  add(rowsHeadline(dimensionRows({ pause: 90, fillers: 40, repairs: 80, pace: 60, range: 66 }, null)));

  /* The closing note's other wins and the sheet's records. */
  const clean = { ...computeMetrics([], 62), fillerCount: 0, wpm: 145, substance: SAID_WELL } as RepMetrics;
  for (const m of [clean, { ...clean, fillerCount: 3 } as RepMetrics]) {
    const e = endNote({ metrics: m, streak, repCount: 4 });
    add(e.headline, e.detail);
  }
  const prior = [sweepTake({ filler_count: 5, pauses: [P(2, "pre", "landing")] })];
  for (const b of personalBests(prior, { ...clean, fillersPerMin: 1, heldPauses: 6 } as RepMetrics, 900)) add(b.headline, b.detail);

  /* A lesson's page, the practice titles and each trait's own words. */
  for (const l of LESSONS) add(l.title, l.blurb);
  for (const p of PATH) add(p.title);
  for (const t of Object.values(TRAIT)) {
    add(t.unit, t.unitOne, t.what, t.why, t.distinction, t.walkthrough?.note, t.skill, t.move(1, true), t.move(3, false));
    add(placeWords({ id: t.id, percentile: 40 }));
  }

  /* The introduction's plan and Demos's replies. */
  for (const p of PAINS) {
    add(p.line, p.reply);
    const plan = buildPortfolio({ ...EMPTY_ANSWERS, pains: [p.id] });
    add(...plan.lines, ...plan.stepParts.flatMap((s) => [s.lead, s.detail]));
  }
  return out;
}
