import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/lessons";
import { DRILLS } from "./drills";
import { upNextLesson } from "./lesson-up-next";
import { UNITS } from "./path";
import { DONE_FOR_TODAY, wayOn } from "./way-on";
import { readFileSync } from "node:fs";
import { PAINS } from "@/content/portfolio";
import { TRAIT } from "@/content/traits";
import { traitForSaid } from "./lesson-up-next";
import { recordingName } from "./log";

const none = { game: null, lesson: null, nextInLesson: null, missingPractice: null, upNext: null, lessonBack: null, backTo: null };
const lesson = LESSONS[0];

describe("the results' way on (#493)", () => {
  it("Today's practice, the boss or a topic of your own: done for today, out to Today", () => {
    expect(wayOn(none)).toEqual({ kind: "go", label: DONE_FOR_TODAY, href: "/", leaves: true });
    expect(DONE_FOR_TODAY).toBe("Done for today");
  });

  it("a lesson's ending says the same words when nothing is up next", () => {
    const end = wayOn({ ...none, lesson });
    expect(end).toEqual(wayOn(none));
  });

  it("a lesson's ending names Lessons' Up next and opens its page", () => {
    const up = upNextLesson({ [lesson.id]: lesson.practices.length }, null)!;
    expect(wayOn({ ...none, lesson, upNext: up })).toEqual({
      kind: "go",
      label: `Next lesson: ${up.title}`,
      href: `/lessons/${up.id}`,
      leaves: true,
    });
  });

  it("a lesson's practice goes on to the next, or to the one still without a take, inside the lesson", () => {
    const next = wayOn({ ...none, lesson, nextInLesson: 2, lessonBack: `/lessons/${lesson.id}` });
    expect(next).toMatchObject({ label: "Practice 2 of 3", leaves: false });
    expect(next.kind === "go" && next.href).toContain(`lesson=${lesson.id}`);
    expect(wayOn({ ...none, lesson, missingPractice: 1 })).toMatchObject({ label: "Practice 1 of 3", leaves: false });
  });

  it("a game goes round again; a trait's walk goes back to it", () => {
    expect(wayOn({ ...none, game: { name: "Q&A" } })).toEqual({ kind: "round", label: "Another round: Q&A" });
    expect(wayOn({ ...none, backTo: "/practice/pause" })).toEqual({
      kind: "go",
      label: "Back to the lesson",
      href: "/practice/pause",
      leaves: true,
    });
  });

  /* The morning tour (17 Nov): "Next lesson: The steady state", a practice
     of the retired road the Lessons tab does not list. Whatever this take
     was, the tap never names the road. */
  it("never names the road: every label is a lesson Lessons lists or a fixed phrase", () => {
    const road = new Set([...DRILLS.map((d) => d.title), ...UNITS.flatMap((u) => [u.name, ...u.lessons.map((l) => l.title)])]);
    const titles = new Set(LESSONS.map((l) => l.title));
    const labels = [
      wayOn(none),
      wayOn({ ...none, lesson }),
      ...LESSONS.map((l) => wayOn({ ...none, lesson, upNext: l })),
      wayOn({ ...none, backTo: "/practice/pause" }),
    ].map((w) => w.label);
    for (const label of labels) {
      const named = label.startsWith("Next lesson: ") ? label.slice("Next lesson: ".length) : null;
      if (named) expect(titles.has(named)).toBe(true);
      for (const r of road) expect(label.includes(r)).toBe(false);
    }
  });
});

/* #493: "Check every other place the road's names reach a screen." The
   Log and the stored recording name a road lesson's take Today's
   practice (lib/log.test.ts holds every drill); You's road card names the
   trait Lessons heads a section with, never the road's unit. */
describe("the road's names reach no screen (#493)", () => {
  const road = new Set([...DRILLS.map((d) => d.title), ...UNITS.map((u) => u.name)]);
  const onLessons = new Set(LESSONS.map((l) => TRAIT[l.trait].name));

  it("the road card's caption is a trait Lessons lists, or nothing", () => {
    for (const p of PAINS) {
      const t = traitForSaid(p.said);
      if (t === null) continue;
      expect(onLessons.has(TRAIT[t].name)).toBe(true);
      expect(road.has(TRAIT[t].name)).toBe(false);
    }
    const src = readFileSync("app/you/page.tsx", "utf8");
    expect(src).not.toMatch(/unitName/);
    expect(src).not.toMatch(/one unit at a time/);
  });

  it("a stored road take is Today's practice in the Log", () => {
    for (const d of DRILLS) expect(road.has(recordingName({ lesson_id: d.id, mode: "daily" }))).toBe(false);
  });
});
