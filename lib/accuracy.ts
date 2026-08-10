/**
 * Boss-mode accuracy judging (mechanics.md Cold Topic): the rep is
 * scored on delivery by the normal engine AND on whether the claims are
 * actually true.
 *
 * The LLM's job here is narrow — extract the factual claims the speaker
 * made, quote each one verbatim, and mark it against the topic's ground
 * truth. The score itself is arithmetic over those verdicts, so the
 * number is reproducible from the report (DECISIONS #19, #30: no
 * horoscope, cross-claim maths stays checkable).
 *
 * A confidently stated wrong claim costs more than an admitted unknown.
 * That's the whole point of the boss.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ColdTopic } from "./cold-topics";

export const AccuracyClaimSchema = z.object({
  quote: z.string().min(4).max(300),
  verdict: z.enum(["supported", "contradicted", "unverifiable"]),
  hedged: z.boolean(),
  why: z.string().min(4).max(200),
});

export type AccuracyClaim = z.infer<typeof AccuracyClaimSchema>;

export const AccuracyReportSchema = z.object({
  claims: z.array(AccuracyClaimSchema).max(12),
  /** Indices into topic.truth the speaker actually covered. */
  covered: z.array(z.number().int().min(0)).max(12),
});

export type AccuracyReport = z.infer<typeof AccuracyReportSchema>;

export interface AccuracyResult extends AccuracyReport {
  /** 0–100. Coverage of the ground truth, minus confident wrong claims. */
  score: number;
  coverage: number;
  /** Ground-truth points the speaker never touched. */
  missed: string[];
  confidentlyWrong: number;
}

const JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    claims: {
      type: "array",
      description:
        "Every factual claim the speaker made about the topic, in order. Max 12.",
      items: {
        type: "object",
        properties: {
          quote: {
            type: "string",
            description:
              "The claim quoted VERBATIM from the transcript. Copy the words exactly; do not paraphrase or clean it up.",
          },
          verdict: {
            type: "string",
            enum: ["supported", "contradicted", "unverifiable"],
            description:
              "supported = matches the ground truth. contradicted = the ground truth says otherwise. unverifiable = plausible but not covered by the ground truth.",
          },
          hedged: {
            type: "boolean",
            description:
              "True when the speaker flagged uncertainty on this claim (\"I think\", \"I'm not sure\", \"maybe\").",
          },
          why: {
            type: "string",
            description:
              "One short clause: which ground-truth point settles it. Coach register, no hype.",
          },
        },
        required: ["quote", "verdict", "hedged", "why"],
        additionalProperties: false,
      },
    },
    covered: {
      type: "array",
      description:
        "Zero-based indices of the GROUND TRUTH points the speaker actually conveyed.",
      items: { type: "integer" },
    },
  },
  required: ["claims", "covered"],
  additionalProperties: false,
};

const SYSTEM = `You are the fact-checker inside Ethos' weekly boss mode.

You are given a topic's ground truth and a transcript of someone explaining that topic from memory, under time pressure, after a short research window.

Rules:
- Quote every claim VERBATIM from the transcript. Speech is messy — keep the mess. A cleaned-up quote is a failed extraction.
- Judge only against the ground truth provided. If the ground truth doesn't settle it, the verdict is "unverifiable", not "contradicted".
- "hedged" is about the speaker's own framing, not your confidence.
- Do not score, praise or coach. Extract and mark. The score is computed elsewhere.`;

/** Loose containment check — speech transcripts vary in punctuation. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteIsVerbatim(quote: string, transcript: string): boolean {
  const q = normalize(quote);
  if (q.length < 4) return false;
  return normalize(transcript).includes(q);
}

/**
 * Score = coverage of the ground truth, penalised for confident errors.
 * Pure arithmetic over the verdicts so the number is re-derivable from
 * the stored report.
 */
export function scoreAccuracy(
  report: AccuracyReport,
  topic: ColdTopic
): AccuracyResult {
  const truthCount = Math.max(1, topic.truth.length);
  const covered = [...new Set(report.covered)].filter(
    (i) => i >= 0 && i < topic.truth.length
  );
  const coverage = covered.length / truthCount;

  const contradicted = report.claims.filter((c) => c.verdict === "contradicted");
  const confidentlyWrong = contradicted.filter((c) => !c.hedged).length;
  const hedgedWrong = contradicted.length - confidentlyWrong;

  // 18 points for a confident error, 6 for one the speaker flagged as
  // uncertain: saying "I think" when you're wrong is a smaller failure
  // of credibility than asserting it.
  const penalty = confidentlyWrong * 18 + hedgedWrong * 6;
  const score = Math.max(0, Math.min(100, Math.round(coverage * 100 - penalty)));

  return {
    ...report,
    covered,
    score,
    coverage: Math.round(coverage * 100) / 100,
    confidentlyWrong,
    missed: topic.truth.filter((_, i) => !covered.includes(i)),
  };
}

const MAX_ATTEMPTS = 2;

/**
 * Best-effort, exactly like the coach layer: a boss rep that can't be
 * fact-checked still returns its delivery numbers.
 */
export async function judgeAccuracy(
  transcript: string,
  topic: ColdTopic
): Promise<AccuracyResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `TOPIC: ${topic.title}\n\nGROUND TRUTH (indices are zero-based):\n${topic.truth
        .map((t, i) => `${i}. ${t}`)
        .join("\n")}\n\nTRANSCRIPT:\n${transcript}`,
    },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 3000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: JSON_SCHEMA },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });

    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: AccuracyReport;
    try {
      parsed = AccuracyReportSchema.parse(JSON.parse(text));
    } catch (e) {
      messages.push(
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: `Output failed schema validation: ${String(e).slice(0, 200)}. Return corrected JSON.`,
        }
      );
      continue;
    }

    const fabricated = parsed.claims.filter(
      (c) => !quoteIsVerbatim(c.quote, transcript)
    );
    if (fabricated.length === 0) return scoreAccuracy(parsed, topic);

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `These quotes are not verbatim in the transcript:\n- ${fabricated
          .map((c) => c.quote.slice(0, 80))
          .join("\n- ")}\nRe-extract using the speaker's exact words and return corrected JSON.`,
      }
    );
  }

  return null;
}
