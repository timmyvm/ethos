import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LESSONS, lessonById, lessonFor, settledPrompt } from "@/content/lessons";
import { AGE_BANDS, CONTEXTS, type Pool } from "@/content/portfolio";
import { cleanAnswers, EMPTY_ANSWERS } from "./answers";
import type { RepRow } from "./client-data";
import { lessonProgress } from "./lesson-progress";
import { recordingName } from "./log";
import { nextLesson } from "./path";
import { poolFor, UNKNOWN_POOL } from "./pool";
import { recordingText, resolveRepConfig } from "./rep-config";
import { fitsPool, topicById, TOPICS } from "./topics";

/*
 * The lessons follow the school pool (#492), as Today's card, the command
 * menu's Today and the reminder do since #489. Six lesson practices named
 * a topic that needs a job; for someone in the school pool each speaks on
 * the lesson's own stand-in of the same shape, on the lesson page and on
 * the recorder its Start opens. Every other pool sees exactly what it saw.
 */

const POOLS: Pool[] = ["all", "school", "work", "social", "online"];
const OTHERS = POOLS.filter((p) => p !== "school");

/** Every topic the school pool drops, read from the topics, not listed by hand. */
const DROPPED = TOPICS.filter((t) => !fitsPool(t, "school"));
const DROPPED_IDS = new Set(DROPPED.map((t) => t.id));
const DROPPED_PROMPTS = new Set(DROPPED.map((t) => t.prompt));

/** Every way a link can open a lesson practice: the free mod, a premium one, entitled or not. */
const LINKS = [
  { mods: null, premium: false },
  { mods: "no-notes", premium: false },
  { mods: "interrupt", premium: true },
  { mods: "interrupt", premium: false },
];

const each = (fn: (lesson: (typeof LESSONS)[number], n: number) => void) => {
  for (const l of LESSONS) l.practices.forEach((_, i) => fn(l, i + 1));
};

/** The six that change, in the lessons' own order. */
const SIX = [
  ["closed-mouth", 3, "t10", "t262"],
  ["finish-it", 2, "t11", "t83"],
  ["or-rather", 2, "t18", "t332"],
  ["change-gear", 2, "t10", "t46"],
  ["short-and-concrete", 1, "t11", "t31"],
  ["second-pass", 1, "t18", "t216"],
] as const;

describe("someone in the school pool (#492)", () => {
  it("is never shown a topic the pool drops, on the lesson page or on the recorder", () => {
    each((l, n) => {
      const shown = lessonFor(l, "school").practices[n - 1];
      expect(DROPPED_IDS.has(shown.topicId), `${l.id} ${n}`).toBe(false);
      expect(DROPPED_PROMPTS.has(shown.prompt), `${l.id} ${n}`).toBe(false);
      expect(shown.prompt).toBe(topicById(shown.topicId)?.prompt);
      for (const link of LINKS) {
        const c = resolveRepConfig({ lesson: l.id, q: String(n), pool: "school", ...link });
        expect(DROPPED_PROMPTS.has(c.prompt), `${l.id} ${n} ${link.mods}`).toBe(false);
        expect(recordingText(c).topic).toBe(shown.prompt);
      }
      /* The server's page, before anyone's answers are read: a held line
         or a topic every pool shares, never one the school pool drops. */
      const settled = settledPrompt(l, n - 1);
      expect(settled === null || !DROPPED_PROMPTS.has(settled), `${l.id} ${n}`).toBe(true);
    });
  });

  it("is everyone whose answers say school, by age, by place, or by an age never given", () => {
    const ages = [null, ...AGE_BANDS.map((b) => b.id)];
    const places = [null, ...CONTEXTS.map((c) => c.id)];
    let schools = 0;
    for (const ageBand of ages) {
      for (const context of places) {
        const pool = poolFor(cleanAnswers({ ...EMPTY_ANSWERS, ageBand, context } as never));
        if (pool !== "school") continue;
        schools++;
        each((l, n) => {
          const c = resolveRepConfig({ lesson: l.id, q: String(n), pool });
          expect(DROPPED_PROMPTS.has(c.prompt), `${ageBand} ${context} ${l.id} ${n}`).toBe(false);
        });
      }
    }
    expect(schools).toBeGreaterThan(1);
  });

  it("is who a caller that forgets the pool is answered for: an age never given", () => {
    expect(UNKNOWN_POOL).toBe("school");
    each((l, n) => {
      expect(resolveRepConfig({ lesson: l.id, q: String(n) })).toEqual(
        resolveRepConfig({ lesson: l.id, q: String(n), pool: "school" })
      );
    });
  });
});

describe("every other pool (#492)", () => {
  it("is shown each lesson itself, the very object LESSONS holds", () => {
    for (const pool of OTHERS) for (const l of LESSONS) expect(lessonFor(l, pool)).toBe(l);
  });

  it("resolves every practice exactly as the lesson's own, whatever the link carries", () => {
    for (const pool of OTHERS) {
      each((l, n) => {
        for (const link of LINKS) {
          const c = resolveRepConfig({ lesson: l.id, q: String(n), pool, ...link });
          expect(JSON.stringify(c)).toBe(JSON.stringify(resolveRepConfig({ lesson: l.id, q: String(n), pool: "all", ...link })));
          expect(c.prompt).toBe(l.practices[n - 1].prompt);
          expect(c.tips).toEqual(l.practices[n - 1].tips);
        }
      });
    }
  });

  it("still gets the six job prompts the lessons were written with", () => {
    for (const [id, n, asked] of SIX) {
      const p = lessonById(id)!.practices[n - 1];
      expect(p.topicId).toBe(asked);
      expect(p.prompt).toBe(topicById(asked)?.prompt);
    }
  });
});

describe("the stand-ins (#492)", () => {
  const changed = LESSONS.flatMap((l) =>
    l.practices.flatMap((p, i) => {
      const s = lessonFor(l, "school").practices[i];
      return s.topicId === p.topicId ? [] : [[l.id, i + 1, p.topicId, s.topicId] as const];
    })
  );

  it("are exactly the six practices that named a topic the school pool drops", () => {
    expect(changed).toEqual(SIX);
    const named = LESSONS.flatMap((l) => l.practices.map((p, i) => [l.id, i + 1, p.topicId] as const)).filter(([, , t]) =>
      DROPPED_IDS.has(t)
    );
    expect(named).toEqual(SIX.map(([id, n, t]) => [id, n, t]));
  });

  it("keep the dropped topic's shape, so the practice's tips and mod are the same words", () => {
    for (const [id, n, asked, stand] of SIX) {
      expect(topicById(stand)?.shape, `${id} ${n}`).toBe(topicById(asked)?.shape);
      const own = lessonById(id)!.practices[n - 1];
      const school = lessonFor(lessonById(id)!, "school").practices[n - 1];
      expect(school.tips).toEqual(own.tips);
      expect(school.mods).toEqual(own.mods);
      expect(school.prompt).toBe(topicById(stand)?.prompt);
    }
  });

  it("fit the pool, are none of the three, name no topic any lesson names, and are six different topics", () => {
    const lessonTopics = new Set(LESSONS.flatMap((l) => l.practices.map((p) => p.topicId)));
    for (const [, , , stand] of SIX) {
      expect(fitsPool(topicById(stand)!, "school")).toBe(true);
      expect(DROPPED_IDS.has(stand)).toBe(false);
      expect(lessonTopics.has(stand)).toBe(false);
    }
    expect(new Set(SIX.map(([, , , s]) => s)).size).toBe(SIX.length);
  });

  it("leave every lesson its three practices, its title, its blurb and its art", () => {
    for (const l of LESSONS) {
      const s = lessonFor(l, "school");
      expect(s.practices).toHaveLength(l.practices.length);
      expect({ ...s, practices: null }).toEqual({ ...l, practices: null });
    }
  });
});

describe("nothing stored moves (#492)", () => {
  it("files a school take under the same lesson practice, at the same XP and conditions", () => {
    each((l, n) => {
      for (const link of LINKS) {
        const school = resolveRepConfig({ lesson: l.id, q: String(n), pool: "school", ...link });
        const all = resolveRepConfig({ lesson: l.id, q: String(n), pool: "all", ...link });
        expect(school.lessonId).toBe(`lesson:${l.id}:${n}`);
        expect({ ...school, prompt: null }).toEqual({ ...all, prompt: null });
      }
    });
  });

  it("counts the same progress and names the same lesson in the Log", () => {
    const rows = (pool: Pool) =>
      LESSONS.flatMap((l) =>
        l.practices.map((_, i) => ({ lesson_id: resolveRepConfig({ lesson: l.id, q: String(i + 1), pool }).lessonId }))
      );
    expect(lessonProgress(rows("school"))).toEqual(lessonProgress(rows("all")));
    for (const r of rows("school")) {
      const name = recordingName({ lesson_id: r.lesson_id, mode: "daily" } as Pick<RepRow, "lesson_id" | "mode">);
      expect(LESSONS.some((l) => l.title === name)).toBe(true);
    }
  });
});

describe("the lesson page before the pool is read (#492)", () => {
  it("holds the line of exactly the six, and prints every other practice's topic", () => {
    each((l, n) => {
      const six = SIX.some(([id, m]) => id === l.id && m === n);
      expect(settledPrompt(l, n - 1), `${l.id} ${n}`).toBe(six ? null : l.practices[n - 1].prompt);
    });
  });
});

describe("where a lesson's topic is read (#492)", () => {
  it("day one and the introduction open the road's first entry, which is no lesson and no dropped topic", () => {
    const first = nextLesson({})!;
    expect(lessonById(first.lesson.id)).toBeNull();
    expect(DROPPED_PROMPTS.has(first.lesson.prompt)).toBe(false);
    expect(resolveRepConfig({ lesson: first.lesson.id, pool: "school" }).prompt).toBe(first.lesson.prompt);
  });

  it("every file that reads a lesson practice's topic reads it through lessonFor", () => {
    const root = join(__dirname, "..");
    const files = ["app", "components", "lib"].flatMap((d) =>
      (readdirSync(join(root, d), { recursive: true }) as string[])
        .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
        .map((f) => join(root, d, f))
    );
    const readers = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        src.includes("@/content/lessons") &&
        /practices\[[^\]]*\]\.(prompt|topicId)|\bpractice\.(prompt|topicId)\b|\bp\.(prompt|topicId)\b/.test(src)
      );
    });
    expect(readers.length).toBeGreaterThan(0);
    for (const f of readers) expect(readFileSync(f, "utf8"), f).toMatch(/lessonFor\(/);
  });

  it("the recorder hands its resolver the phone's pool", () => {
    const src = readFileSync(join(__dirname, "..", "app", "rep", "page.tsx"), "utf8");
    const call = src.slice(src.indexOf("resolveRepConfig({"), src.indexOf("})", src.indexOf("resolveRepConfig({")));
    expect(call).toMatch(/\bpool\b/);
    expect(src).toMatch(/useState\(poolHere\)/);
  });
});
