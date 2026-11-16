import { describe, expect, it } from "vitest";
import { PATH, type PathItem } from "@/content/path";
import { LESSONS } from "@/content/lessons";
import { TRAITS, type TraitId } from "@/content/traits";
import { topicsFor } from "./portfolio";
import { BANNED_PHRASES, HYPE_PHRASES, gymWord } from "./register";
import { LONG_TOPIC, LONGER_TOPIC, TOPICS, TOPIC_SHAPES, topicById, type Topic } from "./topics";

/**
 * The topic pool: 365 since #481 ("add 365 please"), one for every day
 * of the year; sixty since #473, when the roulette "kept cycling over
 * the same ones"; twenty before. Each claim the change rests on, held.
 */

/* The first sixty as they shipped: stored recordings (`topic:t12`) and
   the fifteen lessons point at them by id, so neither the id nor a word
   may move. */
const SHIPPED: [string, string, string, string[]?][] = [
  ["t1", "The most overrated piece of advice you've been given", "opinion"],
  ["t2", "Something you changed your mind about this year", "opinion"],
  ["t3", "A rule you think everyone should break", "opinion"],
  ["t4", "Whether being busy is a choice", "opinion"],
  ["t5", "The best thing you own under $50", "opinion"],
  ["t6", "A time you were completely wrong in public", "story"],
  ["t7", "The last time you were genuinely nervous", "story"],
  ["t8", "How you met someone who matters to you", "story"],
  ["t9", "A decision you nearly didn't make", "story"],
  ["t10", "The worst job you've ever done", "story", ["school"]],
  ["t11", "Explain your work to a ten-year-old", "explain", ["school"]],
  ["t12", "Explain how interest works to someone who's never had a bank account", "explain"],
  ["t13", "Explain why the sky changes colour at sunset", "explain"],
  ["t14", "Explain a hobby of yours to someone who finds it boring", "explain"],
  ["t15", "Explain what makes a good friend", "explain"],
  ["t16", "Pitch your city to someone deciding where to move", "pitch"],
  ["t17", "Pitch a book or film you love, without spoiling it", "pitch"],
  ["t18", "Pitch yourself for a job you're not qualified for", "pitch", ["school"]],
  ["t19", "Pitch a change your workplace or school should make", "pitch"],
  ["t20", "Pitch the last thing you spent real money on", "pitch"],
  ["t21", "Whether phones belong in classrooms", "opinion"],
  ["t22", "A time you stood up for someone", "story"],
  ["t23", "Explain how to make your favourite meal", "explain"],
  ["t24", "Pitch a new public holiday", "pitch"],
  ["t25", "Whether talent or effort matters more", "opinion"],
  ["t26", "A time you were properly lost", "story"],
  ["t27", "Explain the rules of a game you know well", "explain"],
  ["t28", "Pitch a club you'd want to start", "pitch"],
  ["t29", "The skill school should teach and doesn't", "opinion"],
  ["t30", "Something you taught yourself", "story"],
  ["t31", "Explain how you'd pack for a week away", "explain"],
  ["t32", "Pitch a habit you swear by", "pitch"],
  ["t33", "Whether you need a five-year plan", "opinion"],
  ["t34", "The hardest thing you've ever finished", "story"],
  ["t35", "Explain how a group chat falls apart", "explain"],
  ["t36", "Pitch an app that doesn't exist yet", "pitch"],
  ["t37", "The most underrated app on your phone", "opinion"],
  ["t38", "The kindest thing a stranger did for you", "story"],
  ["t39", "Explain how you decide what to watch next", "explain"],
  ["t40", "Pitch a fix for something that annoys everyone", "pitch"],
  ["t41", "A trend you hope disappears", "opinion"],
  ["t42", "Your first day somewhere new", "story"],
  ["t43", "Explain how to start talking to a stranger", "explain"],
  ["t44", "Pitch a game to someone who doesn't play games", "pitch"],
  ["t45", "Whether morning people really get more done", "opinion"],
  ["t46", "A day that didn't go to plan", "story"],
  ["t47", "Explain how you learn something new fast", "explain"],
  ["t48", "Pitch someone you know for an award", "pitch"],
  ["t49", "A food everyone loves that you don't", "opinion"],
  ["t50", "The last time you laughed until it hurt", "story"],
  ["t51", "Explain how you'd teach someone to ride a bike", "explain"],
  ["t52", "Pitch a four-day week", "pitch"],
  ["t53", "The best way to spend a free Sunday", "opinion"],
  ["t54", "A time you changed someone's mind", "story"],
  ["t55", "Explain how to tell if a news story is true", "explain"],
  ["t56", "Pitch your favourite season", "pitch"],
  ["t57", "Whether to be great at one thing or good at many", "opinion"],
  ["t58", "Something you made or fixed with your hands", "story"],
  ["t59", "Explain what makes a good teacher", "explain"],
  ["t60", "Pitch a song everyone should hear once", "pitch"],
];

const num = (t: Topic) => Number(t.id.slice(1));
/** Everything written since the first twenty (#473, #481). */
const added = TOPICS.filter((t) => num(t) > 20);
/** The rest of the year (#481). */
const year = TOPICS.filter((t) => num(t) > 60);

/** The most a new topic may run. A proxy: "Explain how to start a conversation with a stranger" (51) ran four lines at 375 and was cut; the camera (scripts/look-topics.mjs fit) is the real check. */
const NEW_MAX = 48;

describe("the pool", () => {
  it("is one for every day of the year", () => {
    expect(TOPICS.length).toBe(365);
    expect(added.length).toBe(345);
    expect(year.length).toBe(305);
  });

  it("gives every topic its own id, t1 upward with none skipped", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(365);
    expect(TOPICS.map((t) => t.id)).toEqual(TOPICS.map((_, i) => `t${i + 1}`));
  });

  it("keeps the first sixty's ids and words as they shipped", () => {
    for (const [id, prompt, shape, not] of SHIPPED) {
      const t = topicById(id);
      expect([id, t?.prompt, t?.shape, t?.not]).toEqual([id, prompt, shape, not]);
    }
    expect(TOPICS.slice(0, 60).map((t) => t.id)).toEqual(SHIPPED.map(([id]) => id));
  });

  it("still finds every lesson's topics", () => {
    for (const l of LESSONS) {
      for (const p of l.practices) expect([l.id, topicById(p.topicId)?.prompt]).toEqual([l.id, p.prompt]);
    }
  });

  /* 365 is one more than four times 91, and the extra is an opinion. */
  it("asks for each shape a quarter of the time", () => {
    const want: Record<string, number> = { opinion: 92, story: 91, explain: 91, pitch: 91 };
    for (const shape of Object.keys(TOPIC_SHAPES)) {
      expect([shape, TOPICS.filter((t) => t.shape === shape).length]).toEqual([shape, want[shape]]);
    }
  });

  /* The shapes take turns, so a day's topic changes shape day to day
     at either tier of the path (content/path.ts). */
  it("lets the new shapes take turns", () => {
    const order = ["opinion", "story", "explain", "pitch"];
    added.forEach((t, i) => expect([t.id, t.shape]).toEqual([t.id, order[i % 4]]));
  });

  /* None written since the first twenty needs a job or money to answer,
     so none drops out of a pool; the school pool loses only t10, t11
     and t18. */
  it("leaves every new topic in every pool", () => {
    for (const t of added) expect([t.id, t.not]).toEqual([t.id, undefined]);
    expect(topicsFor("school").length).toBe(362);
    expect(TOPICS.filter((t) => t.not).map((t) => t.id)).toEqual(["t10", "t11", "t18"]);
  });

  it("says each shape the way the shape asks", () => {
    for (const t of TOPICS) {
      const lead = t.shape === "explain" ? /^Explain / : t.shape === "pitch" ? /^Pitch / : null;
      if (lead) expect([t.id, lead.test(t.prompt)]).toEqual([t.id, true]);
      else expect([t.id, /^(Explain|Pitch) /.test(t.prompt)]).toEqual([t.id, false]);
    }
  });
});

describe("every topic's words", () => {
  it("are a title: a capital, no full stop, no question mark, no dash", () => {
    for (const t of TOPICS) {
      expect([t.id, /^[A-Z]/.test(t.prompt)]).toEqual([t.id, true]);
      expect([t.id, /[.?!]$/.test(t.prompt)]).toEqual([t.id, false]);
      expect([t.id, /[—–]/.test(t.prompt)]).toEqual([t.id, false]);
      expect([t.id, t.prompt.trim()]).toEqual([t.id, t.prompt]);
      expect([t.id, /\s{2}|"/.test(t.prompt)]).toEqual([t.id, false]);
    }
  });

  it("fit: every one at most 68 characters, a new one at most 48", () => {
    for (const t of TOPICS) expect([t.id, t.prompt.length <= 68]).toEqual([t.id, true]);
    for (const t of added) expect([t.id, t.prompt.length <= NEW_MAX]).toEqual([t.id, true]);
  });

  it("never say the gym, the banned register or hype", () => {
    for (const t of TOPICS) {
      const s = t.prompt.toLowerCase();
      expect([t.id, gymWord(t.prompt)]).toEqual([t.id, null]);
      expect([t.id, BANNED_PHRASES.filter((p) => s.includes(p))]).toEqual([t.id, []]);
      expect([t.id, HYPE_PHRASES.filter((p) => s.includes(p))]).toEqual([t.id, []]);
      expect([t.id, /confiden/i.test(s)]).toEqual([t.id, false]);
    }
  });

  /* CLAUDE.md: nothing that needs money, a job title or a partner to
     answer, and nothing that manufactures insecurity. */
  it("never ask a new topic for money, a job, a partner or a flaw", () => {
    const off =
      /\$|money|salary|paid|price|boss|manager|job|career|workplace|partner|boyfriend|girlfriend|dating|crush|insecur|flaw|weakness|regret|ashamed|embarrass|fail(ure)?s?\b|ugly|weight|attractive|alpha|grind|hustle/i;
    for (const t of added) expect([t.id, off.exec(t.prompt)?.[0] ?? null]).toEqual([t.id, null]);
  });

  it("are never said twice", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
    expect(new Set(TOPICS.map((t) => norm(t.prompt))).size).toBe(TOPICS.length);
  });
});

/** One trait's walk at one tier, in the order the days take it. */
const walkOf = (trait: TraitId, tier: 1 | 2): PathItem[] =>
  PATH.filter((p) => p.trait === trait && p.tier === tier);

/** The tier's topics: opinion and story, or explain and pitch. */
const tierTopics = (tier: 1 | 2) =>
  TOPICS.filter((t) => (tier === 1 ? ["opinion", "story"] : ["explain", "pitch"]).includes(t.shape));

/* The path as it shipped (#473): each trait's first twelve at each tier,
   by topic number. A link or stored take that names `pace-2-4` still
   means the topic it meant. */
const SHIPPED_PATH: Record<string, number[]> = {
  "pause-1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22],
  "pause-2": [14, 15, 16, 17, 18, 19, 20, 23, 24, 27, 28, 31],
  "fillers-1": [25, 26, 29, 30, 33, 34, 37, 38, 41, 42, 45, 46],
  "fillers-2": [32, 35, 36, 39, 40, 43, 44, 47, 48, 51, 52, 55],
  "repairs-1": [49, 50, 53, 54, 57, 58, 1, 2, 3, 4, 5, 6],
  "repairs-2": [56, 59, 60, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  "pace-1": [7, 8, 9, 10, 21, 22, 25, 26, 29, 30, 33, 34],
  "pace-2": [20, 23, 24, 27, 28, 31, 32, 35, 36, 39, 40, 43],
  "range-1": [37, 38, 41, 42, 45, 46, 49, 50, 53, 54, 57, 58],
  "range-2": [44, 47, 48, 51, 52, 55, 56, 59, 60, 11, 12, 13],
};

/** A seeded generator, so a failing walk can be replayed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("every trait, covered", () => {
  /* Today's card is the weakest trait's practice for the day, its walk
     taken a day at a time (lib/next-practice.ts). A trait whose number
     holds meets every topic in its walk before one comes round again. */
  it("puts 165 different topics behind each trait at tier 1 and 164 at tier 2", () => {
    for (const trait of TRAITS) {
      for (const [tier, n] of [[1, 165], [2, 164]] as const) {
        const items = walkOf(trait.id, tier);
        expect([trait.id, tier, items.length]).toEqual([trait.id, tier, n]);
        expect([trait.id, tier, new Set(items.map((p) => p.topicId)).size]).toEqual([trait.id, tier, n]);
      }
    }
  });

  it("numbers each walk from 1, the day's order", () => {
    for (const trait of TRAITS) {
      for (const tier of [1, 2] as const) {
        walkOf(trait.id, tier).forEach((p, i) => expect(p.id).toBe(`${trait.id}-${tier}-${i + 1}`));
      }
    }
  });

  it("keeps the 120 practices that shipped: id, angle and topic", () => {
    for (const [key, ids] of Object.entries(SHIPPED_PATH)) {
      const [trait, tier] = key.split("-") as [TraitId, string];
      const walk = walkOf(trait, Number(tier) as 1 | 2);
      expect([key, walk.slice(0, 12).map((p) => p.topicId)]).toEqual([key, ids.map((n) => `t${n}`)]);
    }
    /* The angles are the twelve they always were, in their order. */
    expect(walkOf("pause", 1).slice(0, 3).map((p) => p.title)).toEqual([
      "The full stop",
      "Land the first point",
      "One beat, then the next idea",
    ]);
    expect(walkOf("range", 2)[11].title).toBe("Reach further");
  });

  it("draws a tier from that tier's shapes, as the path always has", () => {
    for (const p of PATH) {
      const shape = topicById(p.topicId)!.shape;
      const want = p.tier === 1 ? ["opinion", "story"] : ["explain", "pitch"];
      expect([p.id, want.includes(shape)]).toEqual([p.id, true]);
    }
  });

  it("gives every trait both of its tier's shapes, taking turns past its first twelve", () => {
    for (const trait of TRAITS) {
      for (const tier of [1, 2] as const) {
        const shapes = walkOf(trait.id, tier).map((p) => topicById(p.topicId)!.shape);
        expect([trait.id, tier, new Set(shapes).size]).toEqual([trait.id, tier, 2]);
        const rest = shapes.slice(12);
        rest.forEach((s, i) => i > 0 && expect([trait.id, tier, i, s === rest[i - 1]]).toEqual([trait.id, tier, i, false]));
      }
    }
  });

  /* Every topic is on the path: the first sixty behind the two traits
     that shipped with them, every one since behind all five. */
  it("puts every topic on the path, the first sixty behind two traits and the rest behind five", () => {
    const uses = new Map<string, Set<string>>();
    for (const p of PATH) uses.set(p.topicId, (uses.get(p.topicId) ?? new Set()).add(p.trait));
    for (const t of TOPICS) expect([t.id, uses.get(t.id)?.size]).toEqual([t.id, num(t) <= 60 ? 2 : 5]);
  });

  it("walks a tier's topics from t61 in the pool's order, the same place for every trait", () => {
    for (const tier of [1, 2] as const) {
      const want = tierTopics(tier).filter((t) => num(t) > 60).map((t) => t.id);
      for (const trait of TRAITS) {
        expect([trait.id, tier, walkOf(trait.id, tier).slice(12).map((p) => p.topicId)]).toEqual([trait.id, tier, want]);
      }
    }
  });

  it("keeps the twelve angles taking turns, the thirteenth the first again", () => {
    for (const trait of TRAITS) {
      for (const tier of [1, 2] as const) {
        const walk = walkOf(trait.id, tier);
        walk.forEach((p, i) => expect([p.id, p.title]).toEqual([p.id, walk[i % 12].title]));
        expect(new Set(walk.slice(0, 12).map((p) => p.title)).size).toBe(12);
      }
    }
  });

  /*
   * The person's side of it. The card takes the weakest trait's walk at
   * the day's place, so a change of weakest trait jumps to another walk
   * at the same place. From the thirteenth place on every walk holds the
   * same topic, so no topic written since the sixty can come back before
   * its tier is walked whole, however often the trait changes. A topic
   * from the sixty can come back sooner only across a change between
   * the two traits that shipped with it, six days apart at the closest,
   * as it could before #481.
   */
  it("brings no topic back early when the weakest trait changes", () => {
    const traits = TRAITS.map((t) => t.id);
    for (const tier of [1, 2] as const) {
      const walks = new Map(traits.map((id) => [id, walkOf(id, tier)]));
      const n = walks.get("pause")!.length;
      for (let seed = 1; seed <= 100; seed++) {
        const rand = seeded(seed);
        const start = Math.floor(rand() * 1000);
        let trait = traits[0];
        const last = new Map<string, number>();
        for (let day = start; day < start + n * 2; day++) {
          if (rand() < 0.15) trait = traits[Math.floor(rand() * traits.length)];
          const walk = walks.get(trait)!;
          const id = walk[day % walk.length].topicId;
          const before = last.get(id);
          if (before !== undefined) {
            const gap = day - before;
            const floor = num(topicById(id)!) > 60 ? n : 6;
            expect([tier, seed, id, gap >= floor]).toEqual([tier, seed, id, true]);
          }
          last.set(id, day);
        }
      }
    }
  });
});

describe("the display steps", () => {
  it("steps down past 40 characters and again past 60, where only t12 stands", () => {
    expect(LONG_TOPIC).toBe(40);
    expect(LONGER_TOPIC).toBe(60);
    expect(TOPICS.filter((t) => t.prompt.length > LONGER_TOPIC).map((t) => t.id)).toEqual(["t12"]);
  });
});
