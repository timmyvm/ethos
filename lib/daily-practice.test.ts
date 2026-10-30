import { describe, expect, it } from "vitest";
import { PATH } from "@/content/path";
import { LESSONS } from "@/content/lessons";
import { TOPICS } from "@/lib/topics";
import { dayOneFamily, recordingObject } from "@/lib/practice-family";
import { heroObject } from "@/lib/home";
import { nextLesson } from "@/lib/path";
import { recordingText, repHref, repKey, resolveRepConfig } from "@/lib/rep-config";
import { tipFace } from "@/lib/tip-labels";

/*
 * Today's Start carries its practice (E52). The card prints a practice
 * (content/path.ts): "Today's practice", its trait, its tactic and its
 * topic. Start used to open the topic alone, so the recording screen
 * said "You didn't pick this one." over the topic's shape tips, and the
 * tactic the card had just named was nowhere on it.
 */
const daily = (item: (typeof PATH)[number]) =>
  resolveRepConfig({ topic: item.topicId, item: item.id });

describe("Today's practice on the recording screen", () => {
  it("leads every path item with the tactic Today's card printed", () => {
    for (const item of PATH) {
      const c = daily(item);
      // Today's heroTip is the item's first tip (app/page.tsx).
      expect(c.tips[0], item.id).toBe(item.tips[0]);
      // Tile 1's face is the line Today's tactic row printed (TipLine).
      expect(tipFace(c.tips[0]).label, item.id).toBe(tipFace(item.tips[0]).label);
      expect(c.tips, item.id).toEqual(item.tips);
    }
  });

  it("heads with the practice's angle under Today's eyebrow, and files the take as the topic's", () => {
    for (const item of PATH) {
      const c = daily(item);
      expect(c.unit, item.id).toBe("Today's practice");
      expect(recordingText(c), item.id).toEqual({ topic: item.prompt, heading: item.title });
      expect(c.lessonId, item.id).toBe(`topic:${item.topicId}`);
      expect(c.maxSeconds).toBe(90);
    }
  });

  it("ignores an item whose topic is not the one on screen", () => {
    const item = PATH[0];
    const other = TOPICS.find((t) => t.id !== item.topicId)!;
    const c = resolveRepConfig({ topic: other.id, item: item.id });
    expect(c.unit).not.toBe("Today's practice");
    expect(c.tips).not.toEqual(item.tips);
  });

  it("is carried on Start's address, and a new item resets the screen", () => {
    const item = PATH[0];
    const href = repHref({ topic: item.topicId, item: item.id, trait: item.trait });
    const u = new URL(href, "http://ethos.local");
    expect(u.searchParams.get("item")).toBe(item.id);
    expect(u.searchParams.get("topic")).toBe(item.topicId);
    const bare = new URL(repHref({ topic: item.topicId }), "http://ethos.local");
    expect(repKey(u.searchParams)).not.toBe(repKey(bare.searchParams));
    // An item never rides without its topic.
    expect(repHref({ lesson: "f1", item: item.id })).toBe("/rep?lesson=f1");
  });
});

/*
 * E50's guard: the heading over the tiles never repeats a tile. "Name
 * it once" over a tile reading "Name it once" says one thing twice and
 * leaves the screen a line short.
 */
describe("the heading over the tiles", () => {
  const faces = (tips: string[]) => tips.map((t) => tipFace(t).label.toLowerCase());

  it("is never a tile's face on a lesson's recording", () => {
    for (const lesson of LESSONS) {
      lesson.practices.forEach((_, i) => {
        const c = resolveRepConfig({ lesson: lesson.id, q: String(i + 1) });
        const { heading } = recordingText(c);
        expect(faces(c.tips), `${lesson.id}:${i + 1} "${heading}"`).not.toContain(heading.toLowerCase());
      });
    }
  });

  it("is never a tile's face on Today's practice", () => {
    for (const item of PATH) {
      const c = daily(item);
      const { heading } = recordingText(c);
      expect(faces(c.tips), `${item.id} "${heading}"`).not.toContain(heading.toLowerCase());
    }
  });
});

describe("a spun topic", () => {
  it("never says 'You didn't pick', and gives the length as its heading", () => {
    for (const t of TOPICS) {
      const c = resolveRepConfig({ topic: t.id });
      const { heading } = recordingText(c);
      expect(heading).toBe("Sixty to ninety seconds.");
      expect(`${c.unit} ${c.title} ${c.prompt}`).not.toMatch(/didn.t pick/i);
      // The shape the roulette's chip named, and its tips.
      expect(c.unit).toMatch(/^Roulette · /);
    }
  });
});

describe("day one's colour", () => {
  it("is the family of the lesson day one's Start opens: Fillers, The baseline's", () => {
    const next = nextLesson({});
    expect(next?.lesson.title).toBe("The baseline");
    expect(dayOneFamily(next)).toBe("fillers");
    // The recording that lesson opens wears the same family.
    const c = resolveRepConfig({ lesson: next!.lesson.id });
    expect(c.lessonId).toBe(next!.lesson.id);
  });

  it("falls back to Pausing's blue with no lesson to name", () => {
    expect(dayOneFamily(null)).toBe("pause");
    expect(dayOneFamily({ lesson: { id: "nope" } })).toBe("pause");
  });
});

/*
 * The recording card's object (E51): the one Today's card held for
 * Today's practice, the lesson's own for a lesson, none on the sky or
 * for a spun topic.
 */
describe("the recording card's object", () => {
  it("is Today's object for every path item", () => {
    for (const item of PATH) {
      expect(recordingObject(daily(item)), item.id).toBe(heroObject(item.trait, item.tips[0]));
    }
  });

  it("is the lesson's own object on each of its practices", () => {
    for (const lesson of LESSONS) {
      lesson.practices.forEach((_, i) => {
        expect(recordingObject(resolveRepConfig({ lesson: lesson.id, q: String(i + 1) }))).toBe(lesson.id);
      });
    }
  });

  it("is the trait's object on the road's lessons and the trait walks", () => {
    expect(recordingObject(resolveRepConfig({ lesson: "h4" }))).toBe(heroObject("pause", resolveRepConfig({ lesson: "h4" }).tips[0]));
    expect(recordingObject(resolveRepConfig({ lesson: "trait-pace" }))).not.toBeNull();
  });

  it("is none on the sky and for a spun topic", () => {
    expect(recordingObject(resolveRepConfig({ boss: "1" }))).toBeNull();
    expect(recordingObject(resolveRepConfig({ game: "interview", q: "iv1" }))).toBeNull();
    expect(recordingObject(resolveRepConfig({ topic: "t6" }))).toBeNull();
  });
});
