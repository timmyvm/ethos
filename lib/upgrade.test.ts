import { describe, expect, it } from "vitest";
import cases from "./__fixtures__/upgrade-cases.json";
import { UPGRADE_LIMITS, UPGRADE_NOTES, cleanUpgrade, saidIn, shownSupply } from "./upgrade";

/*
 * "Say this instead" (DECISIONS #429): what a machine can check of the
 * rule. The fixture is the 24 cases the prompt was judged on (the
 * corrected lists), so the check is held to the same pairs: every honest
 * pair survives it, and what it drops it drops for a reason.
 */
const up = (original: string, upgrade: string, why = "precise") => ({ verdict: "upgrade", original, upgrade, why });
const clean = (original: string, upgrade: string, transcript: string, why = "precise") =>
  cleanUpgrade(up(original, upgrade, why), transcript);

const HABITS = cases.find((c) => c.id === "timothy-habits")!.transcript;
const TIM = "So um, my name is Tim. I build speech apps";

describe("saidIn: the speaker's own words, in one sentence", () => {
  it("finds the words as the transcript spells them, and their sentence", () => {
    expect(saidIn("making the thing small", HABITS)).toEqual({
      said: "making the thing small",
      sentence: "What changed was making the thing small enough that missing it felt stupid.",
    });
  });

  it("ignores case and punctuation, and shows the transcript's own", () => {
    expect(saidIn("really really good", "It was really, really good.")?.said).toBe("really, really good");
    expect(saidIn("really, really good", "It was really really good.")?.said).toBe("really really good");
    expect(saidIn("SO THE THING ABOUT", HABITS)?.said).toBe("So the thing about");
  });

  it("ignores apostrophes, straight or curly, and keeps the speaker's", () => {
    expect(saidIn("dont", "I don’t know.")?.said).toBe("don’t");
    expect(saidIn("don't", "I don’t know.")?.said).toBe("don’t");
    expect(saidIn("don’t", "I don't know.")?.said).toBe("don't");
  });

  it("matches whole words only", () => {
    expect(saidIn("art", "We start at nine.")).toBeNull();
    expect(saidIn("start", "We start at nine.")?.said).toBe("start");
  });

  it("never matches across a sentence end, and a decimal is not one", () => {
    expect(saidIn("end. So", "That was the end. So we left.")).toBeNull();
    expect(saidIn("end so", "That was the end. So we left.")).toBeNull();
    expect(saidIn("1.5 fillers a minute", "I hit 1.5 fillers a minute today.")?.said).toBe("1.5 fillers a minute");
  });

  it("finds nothing in nothing", () => {
    expect(saidIn("", HABITS)).toBeNull();
    expect(saidIn("...", HABITS)).toBeNull();
    expect(saidIn("habits", "")).toBeNull();
  });
});

describe("cleanUpgrade: the drop rules, in order", () => {
  it("0. none is an answer, not a drop", () => {
    expect(cleanUpgrade({ verdict: "none", original: "", upgrade: "", why: "none" }, HABITS)).toEqual({ supply: null });
  });

  it("1. shape: a verdict, and two non-empty strings", () => {
    for (const raw of [null, undefined, "the thing", 3, [], {}, { verdict: "swap", original: "a", upgrade: "b" }]) {
      expect(cleanUpgrade(raw, HABITS)).toEqual({ supply: null, dropped: "shape" });
    }
    expect(cleanUpgrade(up("", "the habit"), HABITS).dropped).toBe("shape");
    expect(cleanUpgrade(up("the thing", "  "), HABITS).dropped).toBe("shape");
    expect(cleanUpgrade({ verdict: "upgrade", original: 4, upgrade: "x" }, HABITS).dropped).toBe("shape");
    expect(cleanUpgrade(up('"..."', "the habit"), HABITS).dropped).toBe("shape");
  });

  it("2. long: the from 1 to 8 words, the to 1 to 6 and inside saved_words' 40", () => {
    expect(UPGRADE_LIMITS.toChars).toBe(40);
    expect(clean("I used to plan a week that no person", "x", HABITS).dropped).toBe("long");
    expect(clean("the thing", "one two three four five six seven", HABITS).dropped).toBe("long");
    expect(clean("the thing", "an extraordinarily overcomplicated routine", HABITS).dropped).toBe("long");
  });

  it("3. not-said: the from is in one sentence of the take", () => {
    expect(clean("constructing applications", "building", TIM).dropped).toBe("not-said");
    expect(clean("art", "craft", "We start at nine.").dropped).toBe("not-said");
    expect(clean("end. So", "end so", "That was the end. So we left.").dropped).toBe("not-said");
    expect(clean("making the thing smaller", "making the habit smaller", HABITS).dropped).toBe("not-said");
  });

  it("4. filler-only: a filler is counted elsewhere, and a pause is not a word", () => {
    expect(clean("um", "(pause)", TIM).dropped).toBe("filler-only");
    expect(clean("you know", "(pause)", "you know I think you know it works").dropped).toBe("filler-only");
    expect(clean("um, like, you know", "so", "Um, like, you know, it works.").dropped).toBe("filler-only");
    expect(clean("so yeah", "and that's it", "It was fine, so yeah.").dropped).toBe("filler-only");
    // A filler beside a real word is not only fillers.
    expect(clean("like a lot", "plenty", "I like a lot of it.").dropped).not.toBe("filler-only");
  });

  it("5. dash: dropped, not repaired", () => {
    expect(clean("the thing", "the habit — the small one", HABITS).dropped).toBe("dash");
    expect(clean("the thing", "the habit–loop", HABITS).dropped).toBe("dash");
  });

  it("6. shape: the to is words, never brackets or symbols", () => {
    expect(clean("making the thing small", "(pause)", HABITS).dropped).toBe("shape");
    expect(clean("making the thing small", "making the habit small!", HABITS).supply).not.toBeNull();
    expect(clean("making the thing small", "making the #habit small", HABITS).dropped).toBe("shape");
    expect(clean("making the thing small", "making the habit/routine small", HABITS).dropped).toBe("shape");
  });

  it("7. same: other words, not the same ones", () => {
    expect(clean("the thing about", "The thing about", HABITS).dropped).toBe("same");
    expect(clean("really good", "really, good", "It was really good.").dropped).toBe("same");
  });

  it("8. register: never the gym, unless the speaker said it", () => {
    expect(clean("build speech apps", "train speech under pressure", TIM).dropped).toBe("register");
    expect(clean("practise", "do reps", "I practise every day.").dropped).toBe("register");
    expect(clean("my workout plan", "my workout schedule", "I wrote my workout plan down.").supply).not.toBeNull();
  });

  it("9. hype: no hype or manosphere word the from did not hold", () => {
    expect(clean("really good", "phenomenal", "It was really good.").dropped).toBe("hype");
    expect(clean("really good", "amazing", "It was really good.").dropped).toBe("hype");
    expect(clean("good at it", "high-value at it", "He is good at it.").dropped).toBe("hype");
    expect(clean("pretty amazing view", "amazing view", "It was a pretty amazing view.").supply).not.toBeNull();
  });

  it("10. vague: no vague word the from did not hold", () => {
    expect(clean("a lot of", "loads of", "We had a lot of rain.").dropped).toBe("vague");
    expect(clean("the thing", "the big thing", HABITS).dropped).toBe("vague");
    expect(clean("really good", "great", "It was really good.").dropped).toBe("vague");
  });

  it("11. filler: no filler the from did not hold", () => {
    expect(clean("really cold", "like ice", "It was really cold.").dropped).toBe("filler");
    expect(clean("really cold", "basically freezing", "It was really cold.").dropped).toBe("filler");
  });

  it("12. intensifier: no more of them than the speaker used", () => {
    expect(clean("cold", "so cold", "It was cold.").dropped).toBe("intensifier");
    expect(clean("tired", "completely exhausted", "I was tired.").dropped).toBe("intensifier");
    expect(clean("really good", "so moving", "It was really good.").supply).not.toBeNull();
  });

  it("13. bookish: no written word for a spoken one", () => {
    expect(clean("a lot of", "a plethora of", "We had a lot of rain.").dropped).toBe("bookish");
    expect(clean("use", "utilise", "We use it daily.").dropped).toBe("bookish");
    expect(clean("start", "commence", "We start at nine.").dropped).toBe("bookish");
  });

  it("14. number: no number the take did not say", () => {
    expect(clean("a lot of people", "hundreds of people", "A lot of people came.").dropped).toBe("number");
    expect(clean("a lot of people", "200 people", "A lot of people came.").dropped).toBe("number");
    expect(clean("fourteen minutes to three", "fourteen minutes to three", "It went from fourteen minutes to three.").dropped).toBe("same");
  });

  it("15. new-name: no name the speaker never said", () => {
    expect(clean("big queue", "long Sydney queue", "There was a big queue.").dropped).toBe("new-name");
    expect(clean("the store", "the Apple store", "There was a queue outside the store. Apple had a launch.").supply).not.toBeNull();
    expect(clean("the thing", "Habits", HABITS).supply).not.toBeNull(); // the first word may be capitalised by position
  });
});

describe("cleanUpgrade: what it keeps", () => {
  it("shows the transcript's own words for the from, and the to as given", () => {
    expect(clean("really really good", "brilliant", "It was really, really good.").supply?.original).toBe("really, really good");
    expect(clean("dont", "do not", "I don’t know.").supply?.original).toBe("don’t");
    expect(clean("'making the thing small.'", '"making the habit small."', HABITS).supply).toEqual({
      original: "making the thing small",
      upgrade: "making the habit small",
      note: UPGRADE_NOTES.precise,
    });
  });

  it("writes the note from why, as one of three fixed lines", () => {
    expect(clean("making the thing small", "making the habit small", HABITS, "vivid").supply?.note).toBe("It lets them picture it.");
    expect(clean("making the thing small", "making the habit small", HABITS, "shorter").supply?.note).toBe("It says the same in fewer words.");
    for (const why of ["none", "", "toString", "because"]) {
      expect(clean("making the thing small", "making the habit small", HABITS, why).supply?.note).toBe("It says exactly what you meant.");
    }
    expect(cleanUpgrade({ verdict: "upgrade", original: "making the thing small", upgrade: "making the habit small" }, HABITS).supply?.note).toBe(
      UPGRADE_NOTES.precise
    );
  });

  it("keeps the pair Timothy saw only because the check cannot read meaning (the prompt's job)", () => {
    // "the thing about" to "what matters about" is on timothy-habits' bad list:
    // every structural check passes it, which is why the prompt carries the rule.
    expect(clean("the thing about", "what matters about", HABITS).supply).not.toBeNull();
    expect(cases.find((c) => c.id === "timothy-habits")!.bad).toContainEqual({ from: "the thing about", to: "what matters about" });
  });

  it("never throws, whatever comes back", () => {
    const weird = [{ verdict: "upgrade", original: {}, upgrade: [] }, { verdict: "upgrade", original: "\u0000", upgrade: "￿" }, Object.create(null)];
    for (const raw of weird) expect(() => cleanUpgrade(raw, HABITS)).not.toThrow();
  });
});

/*
 * Review of #429: the check must never drop an honest upgrade over how
 * a model or Whisper writes an apostrophe, a quote or a capital, and the
 * shapes it counts as a stronger claim or a name must be the ones it
 * means.
 */
describe("cleanUpgrade: apostrophes, quotes and capitals never cost an honest upgrade", () => {
  it("reads the modifier-letter apostrophe as an apostrophe", () => {
    expect(saidIn("didnʼt go up", "The pay didn't go up in three years.")?.said).toBe("didn't go up");
    expect(saidIn("didn't go up", "The pay didnʼt go up in three years.")?.said).toBe("didnʼt go up");
    expect(clean("didnʼt go up", "stalled", "The pay didn't go up in three years.").supply?.original).toBe("didn't go up");
  });

  it("takes I and its contractions as words, never as a name the speaker did not say", () => {
    const take = "Honestly the thing that I would do is call him. Then I will wash up.";
    expect(clean("the thing that I would do is", "what I'd do is", take).supply?.upgrade).toBe("what I'd do is");
    expect(clean("the thing that I would do is", "what I’d do is", take).supply?.upgrade).toBe("what I’d do is");
    expect(clean("Then I will wash up", "then I'll wash up", take).supply).not.toBeNull();
    expect(clean("the thing that I would do is", "what I’ve done is", take).supply).not.toBeNull();
    // A capital that is a name still is.
    expect(clean("call him", "call Dave", take).dropped).toBe("new-name");
    expect(clean("call him", "call Ivy", take).dropped).toBe("new-name");
  });

  it("keeps an apostrophe that ends the upgrade, and still takes off quotes that wrap it", () => {
    const take = "We stayed at my mum and dad's place.";
    expect(clean("my mum and dad's", "my parents'", take).supply?.upgrade).toBe("my parents'");
    expect(clean("my mum and dad's", "my parents’", take).supply?.upgrade).toBe("my parents’");
    expect(clean("really dirty", "‘filthy’", "The hostel was really dirty.").supply?.upgrade).toBe("filthy");
    expect(clean("really dirty", "'filthy.'", "The hostel was really dirty.").supply?.upgrade).toBe("filthy");
    expect(clean("“really dirty,”", "“filthy.”", "The hostel was really dirty.").supply).toEqual({
      original: "really dirty",
      upgrade: "filthy",
      note: UPGRADE_NOTES.precise,
    });
  });

  it("counts so as a stronger claim only where it modifies a word, not where it joins two", () => {
    const take = "We missed the bus and because of that we were late.";
    expect(clean("and because of that we", "so we", take).supply?.upgrade).toBe("so we");
    expect(clean("and because of that", "so that", take).supply).not.toBeNull();
    expect(clean("cold", "so cold", "It was cold.").dropped).toBe("intensifier");
    expect(clean("busy", "so so busy", "I was busy.").dropped).toBe("intensifier");
  });
});

describe("the 24 cases the prompt was judged on", () => {
  it("are the eval's: 11 upgrades, 13 none", () => {
    expect(cases).toHaveLength(24);
    expect(cases.filter((c) => c.expect === "upgrade")).toHaveLength(11);
  });

  it("keep every honest pair", () => {
    const dropped = cases.flatMap((c) =>
      c.good.map((g) => ({ id: c.id, ...g, r: clean(g.from, g.to, c.transcript) })).filter((g) => !g.r.supply)
    );
    expect(dropped).toEqual([]);
  });

  it("quote every bad from from its take, so the bad lists measure the prompt", () => {
    const missing = cases.flatMap((c) => c.bad.filter((b) => b.from !== "*" && !saidIn(b.from, c.transcript)).map((b) => `${c.id}: ${b.from}`));
    expect(missing).toEqual([]);
  });

  it("drop 22 of the 139 bad pairs on structure alone; the rest is the prompt's job", () => {
    const counted = cases.flatMap((c) => c.bad.filter((b) => b.from !== "*" && b.to !== "*").map((b) => ({ ...b, t: c.transcript })));
    const by: Record<string, number> = {};
    for (const b of counted) {
      const r = clean(b.from, b.to, b.t);
      if (!r.supply) by[r.dropped!] = (by[r.dropped!] ?? 0) + 1;
    }
    expect(counted).toHaveLength(139);
    expect(by).toEqual({ vague: 10, hype: 6, bookish: 3, number: 3 });
  });
});

describe("shownSupply: a stored pair, read back on the Log", () => {
  it("keeps a pair that still passes, note and all", () => {
    const stored = { original: "making the thing small", upgrade: "making the habit small", note: "Names it." };
    expect(shownSupply(stored, HABITS)).toBe(stored);
  });

  it("hides the old shapes: a pause for a filler, a gym verb, a quote across sentences", () => {
    expect(shownSupply({ original: "um", upgrade: "(pause)", note: "Silence reads as thought." }, TIM)).toBeNull();
    expect(shownSupply({ original: "build speech apps", upgrade: "train speech under pressure", note: "" }, TIM)).toBeNull();
    expect(shownSupply({ original: "Tim. I", upgrade: "Tim, I", note: "" }, TIM)).toBeNull();
  });

  it("keeps an old row longer than today's limits: they are for new answers, and old rows had 120 characters", () => {
    const take = "The reason why I decided to leave the company was because the pay stayed flat for three years.";
    const stored = {
      original: "The reason why I decided to leave the company was because",
      upgrade: "I left the company because the pay stalled",
      note: "Gets to the point faster.",
    };
    expect(clean(stored.original, stored.upgrade, take).dropped).toBe("long");
    expect(shownSupply(stored, take)).toBe(stored);
  });

  it("is nothing for nothing", () => {
    expect(shownSupply(null, HABITS)).toBeNull();
    expect(shownSupply(undefined, HABITS)).toBeNull();
  });
});
