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

  /* practice-detail-23: "inside" had nothing to be inside of. */
  it("says whose silence feels longer", () => {
    expect(
      tipFace("The silence always feels longer to you than it does to anyone listening.").label
    ).toBe("Silence feels longer to you");
  });

  /* recording-15: a length of silence wears the stopwatch, so two
     Pausing tiles side by side ("Pause after the full stop", "Hold one
     to two seconds") no longer show one glyph twice, and never Pace's
     gauge. */
  it("gives every hold-a-silence tactic the stopwatch, never the gauge", () => {
    const holds = tips.filter((t) => /^(Hold one to two seconds|Count one second)$/.test(tipFace(t).label));
    expect(holds.length).toBeGreaterThanOrEqual(4);
    for (const t of holds) expect(tipFace(t).glyph, t).toBe("hold");
    expect(tips.filter((t) => tipFace(t).glyph === "hold").every((t) => holds.includes(t))).toBe(true);
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
      expect(line, t.id).toBe(`Explain ${t.title} from memory.`);
      expect(rule, t.id).not.toBeNull();
      expect(hasTipFace(rule!), rule!).toBe(true);
    }
  });

  it("splits a one-sentence prompt into a line and no rule", () => {
    expect(splitPrompt("Argue one thing.")).toEqual({ line: "Argue one thing.", rule: null });
  });
});
