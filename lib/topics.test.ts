import { describe, expect, it } from "vitest";
import { PATH } from "@/content/path";
import { LESSONS } from "@/content/lessons";
import { TRAITS } from "@/content/traits";
import { topicsFor } from "./portfolio";
import { BANNED_PHRASES, HYPE_PHRASES, gymWord } from "./register";
import { LONG_TOPIC, LONGER_TOPIC, TOPICS, TOPIC_SHAPES, topicById } from "./topics";

/**
 * The topic pool (#473): sixty since the test, when the roulette "kept
 * cycling over the same ones". Each claim the change rests on, held.
 */

/* The first twenty as they shipped: stored recordings (`topic:t12`) and
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
];

const added = TOPICS.filter((t) => Number(t.id.slice(1)) > 20);

/** The most a new topic may run. A proxy: "Explain how to start a conversation with a stranger" (51) ran four lines at 375 and was cut; the camera (scripts/look-topics.mjs fit) is the real check. */
const NEW_MAX = 48;
/** At least this many topics behind every trait at each tier of the path. */
const PER_TRAIT_TIER = 12;

describe("the pool", () => {
  it("is about sixty", () => {
    expect(TOPICS.length).toBe(60);
    expect(added.length).toBe(40);
  });

  it("gives every topic its own id, t1 upward with none skipped", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    expect(TOPICS.map((t) => t.id)).toEqual(TOPICS.map((_, i) => `t${i + 1}`));
  });

  it("keeps the first twenty's ids and words as they shipped", () => {
    for (const [id, prompt, shape, not] of SHIPPED) {
      const t = topicById(id);
      expect([id, t?.prompt, t?.shape, t?.not]).toEqual([id, prompt, shape, not]);
    }
  });

  it("still finds every lesson's topics", () => {
    for (const l of LESSONS) {
      for (const p of l.practices) expect([l.id, topicById(p.topicId)?.prompt]).toEqual([l.id, p.prompt]);
    }
  });

  it("asks for each shape a quarter of the time", () => {
    for (const shape of Object.keys(TOPIC_SHAPES)) {
      expect([shape, TOPICS.filter((t) => t.shape === shape).length]).toEqual([shape, 15]);
    }
  });

  /* The shapes take turns, so a trait's slice of a tier gets both of
     that tier's shapes (content/path.ts). */
  it("lets the new shapes take turns", () => {
    const order = ["opinion", "story", "explain", "pitch"];
    added.forEach((t, i) => expect([t.id, t.shape]).toEqual([t.id, order[i % 4]]));
  });

  /* None of the new forty needs a job or money to answer, so none drops
     out of a pool; the school pool keeps 57. */
  it("leaves every new topic in every pool", () => {
    for (const t of added) expect([t.id, t.not]).toEqual([t.id, undefined]);
    expect(topicsFor("school").length).toBe(57);
  });
});

describe("every topic's words", () => {
  it("are a title: a capital, no full stop, no question mark, no dash", () => {
    for (const t of TOPICS) {
      expect([t.id, /^[A-Z]/.test(t.prompt)]).toEqual([t.id, true]);
      expect([t.id, /[.?!]$/.test(t.prompt)]).toEqual([t.id, false]);
      expect([t.id, /[—–]/.test(t.prompt)]).toEqual([t.id, false]);
      expect([t.id, t.prompt.trim()]).toEqual([t.id, t.prompt]);
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

  /* CLAUDE.md: nothing that needs money or a job title to answer, and
     nothing that manufactures insecurity. */
  it("never ask a new topic for money, a job or a flaw", () => {
    const off =
      /\$|money|salary|paid|price|boss|manager|job|career|workplace|insecur|flaw|weakness|ashamed|embarrass|fail(ure)?s?\b|ugly|weight|attractive/i;
    for (const t of added) expect([t.id, off.exec(t.prompt)?.[0] ?? null]).toEqual([t.id, null]);
  });

  it("are never said twice", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
    expect(new Set(TOPICS.map((t) => norm(t.prompt))).size).toBe(TOPICS.length);
  });
});

describe("every trait, covered", () => {
  /* Today's card is the weakest trait's practice for the day, twelve to
     a trait at each tier, rotating by day (lib/next-practice.ts). A
     trait whose number holds for a fortnight meets twelve different
     topics before one comes round again. */
  it(`puts ${PER_TRAIT_TIER} different topics behind each trait at each tier`, () => {
    for (const trait of TRAITS) {
      for (const tier of [1, 2] as const) {
        const items = PATH.filter((p) => p.trait === trait.id && p.tier === tier);
        const topics = new Set(items.map((p) => p.topicId));
        expect([trait.id, tier, topics.size]).toEqual([trait.id, tier, PER_TRAIT_TIER]);
      }
    }
  });

  it("draws a tier from that tier's shapes, as the path always has", () => {
    for (const p of PATH) {
      const shape = topicById(p.topicId)!.shape;
      const want = p.tier === 1 ? ["opinion", "story"] : ["explain", "pitch"];
      expect([p.id, want.includes(shape)]).toEqual([p.id, true]);
    }
  });

  it("gives every trait both of its tier's shapes", () => {
    for (const trait of TRAITS) {
      for (const tier of [1, 2] as const) {
        const shapes = new Set(
          PATH.filter((p) => p.trait === trait.id && p.tier === tier).map((p) => topicById(p.topicId)!.shape)
        );
        expect([trait.id, tier, shapes.size]).toEqual([trait.id, tier, 2]);
      }
    }
  });

  it("puts every topic on the path, each behind two traits", () => {
    const uses = new Map<string, Set<string>>();
    for (const p of PATH) uses.set(p.topicId, (uses.get(p.topicId) ?? new Set()).add(p.trait));
    for (const t of TOPICS) expect([t.id, uses.get(t.id)?.size]).toEqual([t.id, 2]);
  });

  /* Only these: the ten-topic tier wrapped, so Pausing's last two at
     tier 1 and last five at tier 2 drew topics that now sit further up
     a thirty-topic tier, and those now meet new ones. */
  it("keeps Pausing's first ten at tier 1 and first seven at tier 2 where they shipped", () => {
    const tier1 = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"];
    const tier2 = ["t14", "t15", "t16", "t17", "t18", "t19", "t20"];
    tier1.forEach((id, i) => expect(PATH.find((p) => p.id === `pause-1-${i + 1}`)?.topicId).toBe(id));
    tier2.forEach((id, i) => expect(PATH.find((p) => p.id === `pause-2-${i + 1}`)?.topicId).toBe(id));
  });
});

describe("the display steps", () => {
  it("steps down past 40 characters and again past 60, where only t12 stands", () => {
    expect(LONG_TOPIC).toBe(40);
    expect(LONGER_TOPIC).toBe(60);
    expect(TOPICS.filter((t) => t.prompt.length > LONGER_TOPIC).map((t) => t.id)).toEqual(["t12"]);
  });
});
