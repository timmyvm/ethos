/**
 * Hostile Q&A — the interrogation boss (mechanics.md mode taxonomy,
 * DECISIONS #183). You give a 60-second take; Demos comes back at your
 * ACTUAL argument with a skeptical question, twice; a verdict scores how
 * the position held up under opposition.
 *
 * Adversarial is not abusive (mechanics.md): Demos challenges the
 * argument, never the person, and every question must quote the speaker
 * verbatim — a question that can't point at something you said is
 * rejected and re-rolled, the same no-horoscope contract the coach call
 * runs under (DECISIONS #19).
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { splitSentences, MAX_COACH_SENTENCES } from "./coach";

export interface HostilePrompt {
  id: string;
  /** The claim to take a side on, out loud. */
  claim: string;
}

/** Takes worth defending: arguable both ways, nothing partisan-hot. */
export const HOSTILE_PROMPTS: HostilePrompt[] = [
  { id: "remote-work", claim: "Remote work makes teams worse" },
  { id: "uni-debt", claim: "University is worth the debt" },
  { id: "social-good", claim: "Social media does more good than harm" },
  { id: "cash-gone", claim: "Cash should disappear" },
  { id: "zoos", claim: "Zoos should exist" },
  { id: "homework", claim: "Homework should be abolished" },
  { id: "ai-jobs", claim: "AI will create more jobs than it destroys" },
  { id: "fast-fashion", claim: "Fast fashion should be taxed like tobacco" },
  { id: "space-money", claim: "Space exploration is worth the money" },
  { id: "forty-hours", claim: "The 40-hour work week is obsolete" },
  { id: "tourists", claim: "Mass tourism does more harm than good" },
  { id: "cars-cities", claim: "Cars should be banned from city centres" },
];

export function promptById(id: string): HostilePrompt | undefined {
  return HOSTILE_PROMPTS.find((p) => p.id === id);
}

/** Questions Demos asks after the take. Two rounds is the boss. */
export const HOSTILE_ROUNDS = 2;
export const TAKE_SECONDS = 60;
export const ANSWER_SECONDS = 45;

/** One completed round of the interrogation. */
export interface HostileRound {
  question: string;
  /** What Demos quoted to justify the question ("" for a fallback). */
  quoted: string;
  answer: string;
  /** Deterministic numbers for the answer, computed server-side. */
  fillersPerMin: number;
  midSentencePauses: number;
}

const QuestionSchema = z.object({
  quoted: z.string().min(4).max(160),
  question: z.string().min(8).max(200),
});

export type HostileQuestion = z.infer<typeof QuestionSchema>;

const QUESTION_JSON = {
  type: "object" as const,
  properties: {
    quoted: {
      type: "string",
      description:
        "A verbatim fragment (4 to 20 words) from the speaker's latest words. This is what the question attacks. No paraphrase.",
    },
    question: {
      type: "string",
      description:
        "ONE skeptical question about that fragment, answerable in 45 seconds, ending with a question mark. Challenge the argument, never the person.",
    },
  },
  required: ["quoted", "question"],
  additionalProperties: false,
};

const VerdictDimensionSchema = z.object({
  score: z.number().int().min(0).max(100),
  citedMoment: z.string().min(4).max(240),
  improve: z.string().min(4).max(200),
});

export const HostileVerdictSchema = z.object({
  held: VerdictDimensionSchema,
  answered: VerdictDimensionSchema,
  composed: VerdictDimensionSchema,
  coachLine: z.string().min(4).max(240),
});

export type HostileVerdict = z.infer<typeof HostileVerdictSchema>;

const VERDICT_DIMENSION_JSON = {
  type: "object" as const,
  properties: {
    score: { type: "integer", description: "0 to 100." },
    citedMoment: {
      type: "string",
      description:
        "The evidence: a verbatim quote from the session in double quotes. No quote = rejected.",
    },
    improve: {
      type: "string",
      description: "One concrete way to raise this score. Coach register.",
    },
  },
  required: ["score", "citedMoment", "improve"],
  additionalProperties: false,
};

const VERDICT_JSON = {
  type: "object" as const,
  properties: {
    held: VERDICT_DIMENSION_JSON,
    answered: VERDICT_DIMENSION_JSON,
    composed: VERDICT_DIMENSION_JSON,
    coachLine: {
      type: "string",
      description:
        "At most 2 sentences. Coach register: short, specific, zero hype.",
    },
  },
  required: ["held", "answered", "composed", "coachLine"],
  additionalProperties: false,
};

const INTERROGATOR_SYSTEM = `You are Demos, the interrogator inside Ethos, a daily speech gym. The user just argued a position out loud; your job is to pressure-test the ARGUMENT.

Rules, non-negotiable:
- Challenge the argument, never the person. No insults, no sarcasm about the speaker, no questions about who they are.
- Quote them. "quoted" is a verbatim fragment of what they actually said; the question attacks that fragment. If you can't quote it, you can't ask it.
- One question, answerable out loud in 45 seconds. End it with a question mark.
- Go for the weakest link: an unsupported claim, a missing mechanism, a cost they ignored, a contradiction between rounds.
- Plain words. Short. NEVER use an em dash.`;

/** Where the interrogation stands, for prompt building. */
export interface HostileContext {
  claim: string;
  take: string;
  rounds: { question: string; answer: string }[];
}

function contextBlock(ctx: HostileContext): string {
  const lines = [
    `THE CLAIM THEY ARGUED: ${ctx.claim}`,
    ``,
    `THEIR TAKE (verbatim transcript):`,
    ctx.take,
  ];
  ctx.rounds.forEach((r, i) => {
    lines.push(``, `YOUR QUESTION ${i + 1}: ${r.question}`);
    lines.push(`THEIR ANSWER ${i + 1} (verbatim transcript):`, r.answer);
  });
  return lines.join("\n");
}

function quoteAppears(quoted: string, texts: string[]): boolean {
  const clean = quoted.replace(/["“”']/g, "").toLowerCase().trim();
  if (clean.length < 4) return false;
  return texts.some((t) => t.toLowerCase().includes(clean));
}

/** The question when generation fails: generic but honest, quotes nothing. */
export const FALLBACK_QUESTIONS = [
  "If you had to defend only one of your points, which one survives?",
  "What would change your mind on this?",
];

const MAX_ATTEMPTS = 3;

/**
 * The next skeptical question. Null only when the API key is absent —
 * a failed generation falls back rather than stalling the boss.
 */
export async function hostileQuestion(
  ctx: HostileContext
): Promise<HostileQuestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();

  // The latest thing they said is what the next question must attack.
  const latest =
    ctx.rounds.length > 0
      ? ctx.rounds[ctx.rounds.length - 1].answer
      : ctx.take;

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `${contextBlock(ctx)}\n\nAsk your next question. Attack their LATEST words.`,
    },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 600,
      system: INTERROGATOR_SYSTEM,
      // The user is standing at a mic waiting for this.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: QUESTION_JSON },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: HostileQuestion;
    try {
      parsed = QuestionSchema.parse(JSON.parse(text));
    } catch {
      continue;
    }

    const problems: string[] = [];
    if (!quoteAppears(parsed.quoted, [latest])) {
      problems.push(
        `"quoted" is not a verbatim fragment of their latest words`
      );
    }
    if (!parsed.question.trimEnd().endsWith("?")) {
      problems.push("question does not end with a question mark");
    }
    if (parsed.question.includes("—")) {
      problems.push("question contains an em dash");
    }
    if (problems.length === 0) return parsed;

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Rejected:\n- ${problems.join("\n- ")}\nReturn corrected JSON. Same schema.`,
      }
    );
  }
  return null;
}

/**
 * The verdict on the whole interrogation. The per-round numbers are
 * deterministic ground truth: composed may not contradict them.
 */
export async function hostileVerdict(
  ctx: HostileContext,
  roundNumbers: { fillersPerMin: number; midSentencePauses: number }[]
): Promise<HostileVerdict | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();

  const sessionTexts = [ctx.take, ...ctx.rounds.map((r) => r.answer)];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `${contextBlock(ctx)}\n\nMEASURED, per answer (deterministic ground truth):\n${JSON.stringify(roundNumbers, null, 2)}\n\nScore the interrogation. Dimensions:\n- held: did the position stay consistent from take to final answer? Conceding a point honestly is fine; collapsing or quietly switching sides costs.\n- answered: did each answer address the question asked, or deflect and repeat the take?\n- composed: steadiness under pressure. The measured numbers are ground truth; label the tone, cite the moment, never contradict the counts.\nEvery score cites a verbatim quote from the session in double quotes. coachLine: at most 2 sentences, coach register.`,
    },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 1500,
      system: INTERROGATOR_SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: VERDICT_JSON },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: HostileVerdict;
    try {
      parsed = HostileVerdictSchema.parse(JSON.parse(text));
    } catch {
      continue;
    }

    const problems = validateHostileVerdict(parsed, sessionTexts);
    if (problems.length === 0) return trimCoachLine(parsed);

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Rejected:\n- ${problems.join("\n- ")}\nFix every violation and return corrected JSON. Same schema.`,
      }
    );
  }
  return null;
}

/** Pure, so it's testable: the no-horoscope contract for the verdict. */
export function validateHostileVerdict(
  v: HostileVerdict,
  sessionTexts: string[]
): string[] {
  const problems: string[] = [];
  for (const [name, dim] of Object.entries({
    held: v.held,
    answered: v.answered,
    composed: v.composed,
  })) {
    const quotes = dim.citedMoment.match(/["“”']([^"“”']{4,})["“”']/g) ?? [];
    const cited = quotes.some((q) => quoteAppears(q, sessionTexts));
    if (!cited) {
      problems.push(
        `${name}.citedMoment has no verbatim quote from the session`
      );
    }
  }
  const copy = [
    v.held.improve,
    v.answered.improve,
    v.composed.improve,
    v.coachLine,
  ].join(" ");
  if (copy.includes("—")) problems.push("copy contains an em dash");
  return problems;
}

/** House style is repaired, never fatal (the #23 lesson). */
function trimCoachLine(v: HostileVerdict): HostileVerdict {
  const sentences = splitSentences(v.coachLine);
  if (sentences.length <= MAX_COACH_SENTENCES) return v;
  return {
    ...v,
    coachLine: `${sentences.slice(0, MAX_COACH_SENTENCES).join(". ")}.`,
  };
}
