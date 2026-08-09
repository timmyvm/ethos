/**
 * LLM layer — BUILD-PLAN step 1, layer 4. One Claude call, JSON out.
 *
 * The deterministic metrics are the product; this layer only phrases them
 * and picks the supply. Output that violates the voice rules (vision.md /
 * brand.md) or invents claims without a metric basis is rejected and
 * retried with the validation error fed back.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RepMetrics } from "./metrics";

export const CoachOutputSchema = z.object({
  focus: z.string().min(4).max(160),
  supply: z.object({
    original: z.string().min(1).max(120),
    upgrade: z.string().min(1).max(120),
    note: z.string().max(160),
  }),
  coachLine: z.string().min(4).max(240),
});

export type CoachOutput = z.infer<typeof CoachOutputSchema>;

const JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    focus: {
      type: "string",
      description:
        "ONE thing to work on tomorrow. Must reference a metric by name or number.",
    },
    supply: {
      type: "object",
      properties: {
        original: {
          type: "string",
          description:
            "A word or short phrase quoted VERBATIM from the transcript.",
        },
        upgrade: {
          type: "string",
          description: "The stronger word or phrase to swap in.",
        },
        note: {
          type: "string",
          description:
            "One short clause on why the upgrade is stronger. Coach register.",
        },
      },
      required: ["original", "upgrade", "note"],
      additionalProperties: false,
    },
    coachLine: {
      type: "string",
      description:
        "At most 2 sentences. Coach register: short, specific numbers, zero hype.",
    },
  },
  required: ["focus", "supply", "coachLine"],
  additionalProperties: false,
};

/** brand.md: banned in all UI/marketing — enforce on generated copy too. */
const BANNED = [
  "alpha",
  "dominate",
  "high-value",
  "unlock your potential",
  "top 1%",
  "level up your life",
];

const HYPE = [
  "amazing",
  "incredible",
  "awesome",
  "fantastic",
  "crushing it",
  "great job",
  "you're on your way",
];

function systemPrompt(): string {
  return `You are Demos, the coach inside Ethos — a daily speech gym.

Voice rules (non-negotiable):
- Gym, not classroom. Coach, not guru. Short sentences. Specific numbers. Zero hype adjectives.
- Every claim must trace to a number in the metrics JSON. If you can't point to a metric, don't say it.
- Never tell the user they're inadequate. The gap is theirs; the reps are ours.
- Register example: "11 fillers. Down from 19. Tomorrow: kill 'like.'"

Task, given one rep's transcript and its deterministic metrics:
1. focus — ONE thing for tomorrow. Exactly one. It must reference a metric.
2. supply — ONE word/phrase upgrade drawn from the user's OWN transcript: quote a weak word or phrase verbatim in "original" and offer a stronger swap in "upgrade". Prefer vague intensifiers ("really good", "very big", "stuff") and repeated words. Measurement removes; supply gives back.
3. coachLine — at most 2 sentences in the register above, grounded in the numbers.

Pause vocabulary: a held pause before a sentence is composed — praise it with its count. A held pause mid-sentence means searching for words — name it neutrally.`;
}

function userPrompt(transcript: string, metrics: RepMetrics): string {
  const m = {
    durationS: metrics.durationS,
    wpm: metrics.wpm,
    fillerCount: metrics.fillerCount,
    fillersPerMin: metrics.fillersPerMin,
    fillerCounts: metrics.fillerCounts,
    topFiller: metrics.topFiller,
    heldPauses: metrics.heldPauses,
    composedPauses: metrics.composedPauses,
    midSentencePauses: metrics.midSentencePauses,
    stars: metrics.stars,
  };
  return `TRANSCRIPT:\n${transcript}\n\nMETRICS:\n${JSON.stringify(m, null, 2)}`;
}

/** Numbers the coach is allowed to cite. */
function allowedNumbers(metrics: RepMetrics): Set<string> {
  const nums = [
    metrics.wpm,
    metrics.fillerCount,
    metrics.heldPauses,
    metrics.composedPauses,
    metrics.midSentencePauses,
    metrics.stars,
    Math.round(metrics.durationS),
    Math.round(metrics.fillersPerMin),
    ...Object.values(metrics.fillerCounts),
  ];
  return new Set(nums.map((n) => String(n)));
}

/**
 * Voice + grounding validation. Returns a list of violations
 * (empty = pass) so retries can quote what went wrong.
 */
export function validateCoachOutput(
  out: CoachOutput,
  transcript: string,
  metrics: RepMetrics
): string[] {
  const problems: string[] = [];
  const all = `${out.focus} ${out.supply.note} ${out.coachLine}`.toLowerCase();

  for (const w of [...BANNED, ...HYPE]) {
    if (all.includes(w)) problems.push(`banned/hype phrase used: "${w}"`);
  }

  // coachLine: ≤ 2 sentences
  const sentences = out.coachLine
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length > 2) {
    problems.push(`coachLine has ${sentences.length} sentences; max is 2`);
  }

  // supply.original must be a verbatim quote from the transcript
  if (!transcript.toLowerCase().includes(out.supply.original.toLowerCase())) {
    problems.push(
      `supply.original "${out.supply.original}" is not a verbatim quote from the transcript`
    );
  }

  // No invented numbers: every number cited must exist in the metrics
  const allowed = allowedNumbers(metrics);
  const cited = all.match(/\d+/g) ?? [];
  for (const n of cited) {
    if (!allowed.has(String(parseInt(n, 10)))) {
      problems.push(`cites number ${n}, which is not in the metrics`);
    }
  }

  // focus must reference a metric (by name or by an allowed number)
  const metricWords = [
    "filler",
    "wpm",
    "pace",
    "pause",
    "silence",
    "star",
    "minute",
    "second",
  ];
  const focusLower = out.focus.toLowerCase();
  const referencesMetric =
    metricWords.some((w) => focusLower.includes(w)) ||
    (out.focus.match(/\d+/g) ?? []).some((n) =>
      allowed.has(String(parseInt(n, 10)))
    ) ||
    (metrics.topFiller !== null &&
      focusLower.includes(metrics.topFiller.toLowerCase()));
  if (!referencesMetric) {
    problems.push("focus does not reference any metric");
  }

  return problems;
}

const MAX_ATTEMPTS = 3;

export async function coachRep(
  transcript: string,
  metrics: RepMetrics
): Promise<CoachOutput | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: userPrompt(transcript, metrics) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: systemPrompt(),
      // Short scoped task inside a ≤5-minute loop — latency matters.
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

    let parsed: CoachOutput;
    try {
      parsed = CoachOutputSchema.parse(JSON.parse(text));
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

    const problems = validateCoachOutput(parsed, transcript, metrics);
    if (problems.length === 0) return parsed;

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Output violates the voice rules:\n- ${problems.join("\n- ")}\nFix every violation and return corrected JSON. Same schema.`,
      }
    );
  }

  return null;
}
