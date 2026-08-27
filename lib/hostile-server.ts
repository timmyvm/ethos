/**
 * Hostile Q&A — the Claude half (DECISIONS #183). Server-only: this
 * imports the Anthropic SDK, which must never reach the browser bundle
 * (the client page imports lib/hostile.ts instead).
 */

import Anthropic from "@anthropic-ai/sdk";
import { MAX_COACH_SENTENCES, splitSentences } from "./coach";
import {
  FALLBACK_QUESTIONS as FALLBACKS,
  HostileVerdictSchema,
  QuestionSchema,
  quoteAppears,
  validateHostileVerdict,
  type HostileContext,
  type HostileQuestion,
  type HostileVerdict,
} from "./hostile";

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

const MAX_ATTEMPTS = 3;

/**
 * The next skeptical question. Null only when the key is absent or all
 * attempts failed — the route falls back rather than stalling the boss.
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

/** Re-exported so the route has one server import. */
export const FALLBACK_QUESTIONS = FALLBACKS;

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

/** House style is repaired, never fatal (the #23 lesson). */
function trimCoachLine(v: HostileVerdict): HostileVerdict {
  const sentences = splitSentences(v.coachLine);
  if (sentences.length <= MAX_COACH_SENTENCES) return v;
  return {
    ...v,
    coachLine: `${sentences.slice(0, MAX_COACH_SENTENCES).join(". ")}.`,
  };
}
