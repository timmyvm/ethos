import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gymWord } from "./register";

/*
 * Every string Ethos sends to a model, read as it is sent (DECISIONS
 * #429). CLAUDE.md bans the gym register everywhere, the prompts
 * included, and "the reps are ours" sat in the coach's system prompt
 * for months because lib/copy.test.ts reads source, not requests: its
 * "rep" scan skips any string holding a bracket (the coach prompt says
 * "(non-negotiable)" in its second line), and its prompt scan pairs
 * backticks across code and comments and never sees a schema's
 * descriptions or Whisper's prompt.
 *
 * So this drives every caller with the SDK and fetch mocked, makes each
 * one take every turn it can send (the first ask, the schema retry, the
 * rules retry), and checks the whole request: system text, messages and
 * the JSON schema with its descriptions. The fixtures say no banned word,
 * so anything found came from Ethos. Prompts that ask for words a person
 * reads are also held to COPY-RULES' zero em dashes. A new model caller
 * fails the coverage check until it is driven here.
 */
const sent = vi.hoisted(() => ({
  bodies: [] as { via: string; body: unknown }[],
  replies: [] as string[],
}));

vi.mock("@anthropic-ai/sdk", () => {
  const create = (via: string) => async (body: unknown) => {
    sent.bodies.push({ via, body: JSON.parse(JSON.stringify(body)) });
    const text = sent.replies.shift() ?? "not json";
    return { stop_reason: "end_turn", content: [{ type: "text", text }] };
  };
  return {
    default: class {
      messages = { create: create("messages") };
      beta = { messages: { create: create("beta.messages") } };
    },
  };
});

const { coachRep, COACH_SYSTEM } = await import("./coach");
const { judgeAccuracy } = await import("./accuracy");
const { COLD_TOPICS } = await import("./cold-topics");
const { hostileQuestion, hostileVerdict } = await import("./hostile-server");
const { FALLBACK_QUESTIONS, HOSTILE_PROMPTS } = await import("./hostile");
const { suggestAnswer } = await import("./words-server");
const { transcribe, DISFLUENCY_PROMPT } = await import("./transcribe");
const { tier1Scores, tier2Anchors } = await import("./index-score");
const { computeMetrics } = await import("./metrics");

/* ---- what a request says ------------------------------------------------ */

/** Every string in a request, however deep: system, messages, schema descriptions and enums. */
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const v of x) strings(v, out);
  else if (x && typeof x === "object") for (const v of Object.values(x)) strings(v, out);
  return out;
}

/** What Ethos wrote in a request, as opposed to the speaker's words: the system text, the schema, and the retry turns. */
function ethosText(body: Record<string, unknown>): string[] {
  const out = strings(body.system);
  const config = body.output_config as { format?: { schema?: unknown } } | undefined;
  strings(config?.format?.schema, out);
  const messages = (body.messages ?? []) as { role: string; content: unknown }[];
  messages.slice(1).forEach((m) => m.role === "user" && strings(m.content, out));
  return out;
}

const EM = "—";
/** A prose en dash, spaced; "0–100" is a range and stays. */
const SPACED_EN = / – /;

function banned(texts: string[]): string[] {
  return texts.map(gymWord).filter((w): w is string => w !== null);
}

/* ---- the fixtures: no banned word in any of them ------------------------ */

const TAKE =
  "So the thing about habits is they compound. I used to plan a week that no person could actually do. What changed was making the thing small enough that missing it felt stupid.";

function coachFixture() {
  const tokens = TAKE.split(" ");
  const step = 60 / tokens.length;
  const words = tokens.map((t, i) => ({ word: (i ? " " : "") + t, start: i * step, end: i * step + step * 0.8 }));
  const metrics = computeMetrics(words, 60);
  return { metrics, tier1: tier1Scores(metrics, words, []), anchors: tier2Anchors(words, TAKE) };
}

const dim = { score: 62, citedMoment: "Lands the claim at 0:12.", improve: "Open with the claim, then one example." };
const coachReply = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    focus: "Hold a pause before your next sentence.",
    strength: "0 fillers in 60 seconds.",
    supply: { verdict: "upgrade", original: "making the thing small", upgrade: "making the habit small", why: "precise" },
    coachLine: "0 fillers in 60 seconds. Keep it there.",
    dimensions: { structure: dim, credibility: dim, engagement: dim, confidence: dim },
    ...extra,
  });

const ANSWER = "Teams that never meet lose the small talk that builds trust over a year.";
const hostileCtx = (claim: string) => ({
  claim,
  take: TAKE,
  rounds: [{ question: FALLBACK_QUESTIONS[0], answer: ANSWER }],
});
const verdictDim = (quote: string) => ({ score: 60, citedMoment: `"${quote}"`, improve: "Answer the question first, then the reason." });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  sent.bodies = [];
  sent.replies = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Each caller, driven through every turn it can send. */
const callers: Record<string, () => Promise<void>> = {
  "lib/coach.ts": async () => {
    const f = coachFixture();
    // Not JSON (the schema retry), then an invented number (the rules retry), then clean.
    sent.replies = ["not json", coachReply({ coachLine: "You said 19 fillers last week." }), coachReply()];
    const got = await coachRep(TAKE, f.metrics, f.tier1, f.anchors);
    expect(got?.supply?.upgrade).toBe("making the habit small");
    expect(sent.bodies).toHaveLength(3);
  },
  "lib/accuracy.ts": async () => {
    for (const topic of COLD_TOPICS) {
      // A quote that is not the speaker's (the re-extract turn), then clean.
      sent.replies = [
        JSON.stringify({ claims: [{ quote: "nothing like this was said", verdict: "supported", hedged: false, why: "Point 0." }], covered: [0] }),
        JSON.stringify({ claims: [{ quote: "the thing about habits", verdict: "unverifiable", hedged: false, why: "Not covered." }], covered: [] }),
      ];
      expect(await judgeAccuracy(TAKE, topic)).not.toBeNull();
    }
    sent.replies = ["not json", JSON.stringify({ claims: [], covered: [] })];
    expect(await judgeAccuracy(TAKE, COLD_TOPICS[0])).not.toBeNull();
    expect(sent.bodies).toHaveLength(COLD_TOPICS.length * 2 + 2);
  },
  "lib/hostile-server.ts": async () => {
    for (const p of HOSTILE_PROMPTS) {
      // Not JSON, then no question mark (the "Rejected:" turn), then clean.
      sent.replies = [
        "not json",
        JSON.stringify({ quoted: "lose the small talk", question: "Tell me more about that" }),
        JSON.stringify({ quoted: "lose the small talk", question: "Which small talk, exactly?" }),
      ];
      expect(await hostileQuestion(hostileCtx(p.claim))).not.toBeNull();
    }
    const quote = "lose the small talk that builds trust";
    sent.replies = [
      "not json",
      JSON.stringify({ held: verdictDim("never said"), answered: verdictDim(quote), composed: verdictDim(quote), coachLine: "Held the line twice." }),
      JSON.stringify({ held: verdictDim(quote), answered: verdictDim(quote), composed: verdictDim(quote), coachLine: "Held the line twice." }),
    ];
    expect(await hostileVerdict(hostileCtx(HOSTILE_PROMPTS[0].claim), [{ fillersPerMin: 2, midSentencePauses: 1 }])).not.toBeNull();
  },
  "lib/words-server.ts": async () => {
    sent.replies = [JSON.stringify({ replaces: "thing", verdict: "swap", alternatives: ["habit"], note: "" })];
    const sentence = "What changed was making the thing small enough that missing it felt stupid.";
    expect(await suggestAnswer({ word: "thing", sentence, at: sentence.indexOf("thing") })).not.toBeNull();
  },
  "lib/transcribe.ts": async () => {
    const forms: FormData[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: FormData }) => {
      forms.push(init.body);
      return new Response(JSON.stringify({ text: "Hello.", duration: 1, words: [], segments: [] }), { status: 200 });
    });
    await transcribe(new Blob(["a"], { type: "audio/webm" }), "take.webm");
    expect(forms).toHaveLength(1);
    const prompt = forms[0].get("prompt");
    expect(prompt).toBe(DISFLUENCY_PROMPT);
    sent.bodies.push({ via: "whisper", body: { prompt } });
  },
};

describe("every string sent to a model", () => {
  for (const [file, drive] of Object.entries(callers)) {
    it(`never says the gym, in anything ${file} sends`, async () => {
      await drive();
      expect(sent.bodies.length).toBeGreaterThan(0);
      const found = sent.bodies.flatMap(({ body }) => banned(strings(body)));
      expect([file, found]).toEqual([file, []]);
    });
  }

  it("never puts a prose dash in what Ethos writes to a model that writes for a person", async () => {
    for (const file of ["lib/coach.ts", "lib/accuracy.ts", "lib/hostile-server.ts", "lib/words-server.ts"]) {
      sent.bodies = [];
      await callers[file]();
      const texts = sent.bodies.flatMap(({ body }) => ethosText(body as Record<string, unknown>));
      expect(texts.length).toBeGreaterThan(0);
      const dashed = texts.filter((t) => t.includes(EM) || SPACED_EN.test(t)).map((t) => t.slice(0, 80));
      expect([file, dashed]).toEqual([file, []]);
    }
  });

  it("would have caught the coach's old line, and its prompt now says the numbers measure the gap", () => {
    expect(gymWord("Never tell the user they're inadequate. The gap is theirs; the reps are ours.")).toBe("reps");
    expect(gymWord(COACH_SYSTEM)).toBeNull();
    expect(COACH_SYSTEM).not.toContain("reps");
    expect(COACH_SYSTEM).toContain("They already know the gap; the numbers measure it.");
  });
});

/* ---- coverage: every model caller is driven above ------------------------- */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "node_modules" ? [] : sourceFiles(full);
    if (/\.test\.tsx?$/.test(full)) return [];
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

describe("which files call a model", () => {
  it("are exactly the ones this test drives", () => {
    const callersFound = ["lib", "app", "components"]
      .flatMap(sourceFiles)
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return /from ["']@anthropic-ai\/sdk["']/.test(src) || src.includes("api.openai.com");
      })
      .sort();
    expect(callersFound).toEqual(Object.keys(callers).sort());
  });
});
