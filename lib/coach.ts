/**
 * LLM layer — one Claude call per rep, JSON out.
 *
 * Produces the coaching copy (focus / strength / supply / coachLine) AND
 * the four Tier-2 judged Index dimensions (mechanics.md: structure,
 * credibility, engagement, confidence). Every judged score must cite a
 * quoted moment or timestamp — output that fails validation is rejected
 * and re-run with the violations fed back (DECISIONS #19, #23). The
 * deterministic metrics and anchors are handed in as ground truth; the
 * LLM never invents numbers.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Tier1Scores, Tier2Anchors, Tier2Dimension } from "./index-score";
import type { RepMetrics } from "./metrics";

const JudgedDimensionSchema = z.object({
  score: z.number().int().min(0).max(100),
  citedMoment: z.string().min(4).max(240),
  improve: z.string().min(4).max(200),
});

export type JudgedDimension = z.infer<typeof JudgedDimensionSchema>;

export const CoachOutputSchema = z.object({
  focus: z.string().min(4).max(160),
  strength: z.string().min(4).max(160),
  supply: z.object({
    original: z.string().min(1).max(120),
    upgrade: z.string().min(1).max(120),
    note: z.string().max(160),
  }),
  coachLine: z.string().min(4).max(240),
  dimensions: z.object({
    structure: JudgedDimensionSchema,
    credibility: JudgedDimensionSchema,
    engagement: JudgedDimensionSchema,
    confidence: JudgedDimensionSchema,
  }),
});

export type CoachOutput = z.infer<typeof CoachOutputSchema>;

const DIMENSION_JSON = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "0–100 against the dimension's criteria.",
    },
    citedMoment: {
      type: "string",
      description:
        'The evidence: a verbatim quote from the transcript in double quotes, and/or a timestamp like 0:42. No quote or timestamp = rejected.',
    },
    improve: {
      type: "string",
      description: "One concrete way to raise this score. Coach register.",
    },
  },
  required: ["score", "citedMoment", "improve"],
  additionalProperties: false,
};

const JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    focus: {
      type: "string",
      description:
        "ONE thing to work on tomorrow. Must reference a metric by name or number.",
    },
    strength: {
      type: "string",
      description:
        "ONE thing that measurably went well. Must trace to a metric or anchor — true praise is measurement, not flattery.",
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
    dimensions: {
      type: "object",
      properties: {
        structure: DIMENSION_JSON,
        credibility: DIMENSION_JSON,
        engagement: DIMENSION_JSON,
        confidence: DIMENSION_JSON,
      },
      required: ["structure", "credibility", "engagement", "confidence"],
      additionalProperties: false,
    },
  },
  required: ["focus", "strength", "supply", "coachLine", "dimensions"],
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
- Every claim must trace to a number in the metrics JSON or a moment in the transcript. If you can't point to it, don't say it.
- Never tell the user they're inadequate. The gap is theirs; the reps are ours.
- Register example: "11 fillers. Down from 19. Tomorrow: kill 'like.'"

Task A — coaching copy for one rep:
1. focus — ONE thing for tomorrow. Exactly one. It must reference a metric.
2. strength — ONE thing that measurably went well, traced to a metric or anchor. True praise is measurement, not flattery.
3. supply — ONE word/phrase upgrade from the user's OWN transcript: quote a weak word or phrase verbatim in "original", offer a stronger swap in "upgrade". Prefer vague intensifiers ("really good", "very big", "stuff") and repeated words.
4. coachLine — at most 2 sentences in the register above, grounded in the numbers.

Task B — judge the four Tier-2 Index dimensions, 0–100 each. EVERY score must carry citedMoment: a verbatim transcript quote in double quotes and/or a timestamp (like 0:42). A score without evidence is invalid.
- structure: clear opening claim, ordered points, an ending that lands (not a trail-off).
- credibility: sounds like they know what they're talking about — specificity over vagueness, concrete examples, commitment to claims. ANCHOR: the hedge count in ANCHORS is ground truth; a high hedge count caps this score.
- engagement: hook quality, imagery/analogy use, sentence variety, direct address.
- confidence: delivery steadiness. ANCHOR: restart count and hedge count in ANCHORS are ground truth — label the tone, cite the moment, never contradict the counts.

Scoring register: 40s = shaky, 60s = serviceable, 80s = strong, 90+ = rare. Honest scores beat encouraging lies.

Pause vocabulary: a held pause before a sentence is composed — praise it with its count. A held pause mid-sentence means searching for words — name it neutrally.`;
}

function userPrompt(
  transcript: string,
  metrics: RepMetrics,
  tier1: Tier1Scores,
  anchors: Tier2Anchors
): string {
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
  return `TRANSCRIPT:\n${transcript}\n\nMETRICS:\n${JSON.stringify(m, null, 2)}\n\nMEASURED INDEX SCORES (Tier 1, deterministic):\n${JSON.stringify(tier1, null, 2)}\n\nANCHORS (deterministic ground truth for credibility/confidence):\n${JSON.stringify(anchors, null, 2)}`;
}

/** Numbers the coach is allowed to cite in user-facing copy. */
function allowedNumbers(
  metrics: RepMetrics,
  tier1: Tier1Scores,
  anchors: Tier2Anchors
): Set<number> {
  const nums = [
    metrics.wpm,
    metrics.fillerCount,
    metrics.heldPauses,
    metrics.composedPauses,
    metrics.midSentencePauses,
    metrics.stars,
    metrics.durationS,
    metrics.fillersPerMin,
    ...Object.values(metrics.fillerCounts),
    ...Object.values(tier1),
    anchors.hedgeCount,
    anchors.restartCount,
  ];
  // A fractional metric is citable in every honest form: 35.58 seconds
  // may be written 35.58, 35 or 36. Allowing only the rounded value
  // made the coach's own source numbers look invented, which failed
  // validation three times and cost the rep its Ethos Index.
  const allowed = new Set<number>();
  for (const n of nums) {
    allowed.add(n);
    allowed.add(Math.floor(n));
    allowed.add(Math.round(n));
    allowed.add(Math.ceil(n));
  }
  return allowed;
}

/** Numbers in coaching copy, including decimals — "18.55" is one number. */
const NUMBER_RE = /\d+(?:\.\d+)?/g;

function isCitable(token: string, allowed: Set<number>): boolean {
  const n = Number(token);
  return Number.isFinite(n) && allowed.has(n);
}

const METRIC_WORDS = [
  "filler",
  "wpm",
  "pace",
  "pause",
  "silence",
  "star",
  "minute",
  "second",
  "hedge",
  "restart",
  "range",
  "word",
];

function referencesMetric(
  text: string,
  metrics: RepMetrics,
  allowed: Set<number>
): boolean {
  const lower = text.toLowerCase();
  return (
    METRIC_WORDS.some((w) => lower.includes(w)) ||
    (text.match(NUMBER_RE) ?? []).some((n) => isCitable(n, allowed)) ||
    (metrics.topFiller !== null &&
      lower.includes(metrics.topFiller.toLowerCase()))
  );
}

/** Does citedMoment carry real evidence — a transcript quote or timestamp? */
function citesEvidence(citedMoment: string, transcript: string): boolean {
  if (/\b\d{1,2}:\d{2}\b|\b\d{1,3}\s?s(?:ec(?:onds)?)?\b/i.test(citedMoment)) {
    return true;
  }
  const t = transcript.toLowerCase();
  const quotes = citedMoment.match(/["“”']([^"“”']{4,})["“”']/g) ?? [];
  return quotes.some((q) =>
    t.includes(q.replace(/["“”']/g, "").toLowerCase().trim())
  );
}

/**
 * Voice + grounding validation. Returns a list of violations
 * (empty = pass) so retries can quote what went wrong.
 */
export function validateCoachOutput(
  out: CoachOutput,
  transcript: string,
  metrics: RepMetrics,
  tier1: Tier1Scores,
  anchors: Tier2Anchors
): string[] {
  const problems: string[] = [];
  const dims = out.dimensions;
  const copy = [
    out.focus,
    out.strength,
    out.supply.note,
    out.coachLine,
    ...Object.values(dims).map((d) => d.improve),
  ]
    .join(" ")
    .toLowerCase();

  for (const w of [...BANNED, ...HYPE]) {
    if (copy.includes(w)) problems.push(`banned/hype phrase used: "${w}"`);
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

  // No invented numbers in the coaching copy (dimension scores excluded —
  // they ARE the judgment, and the schema bounds them).
  const allowed = allowedNumbers(metrics, tier1, anchors);
  const numberCopy = [out.focus, out.strength, out.supply.note, out.coachLine]
    .join(" ")
    .toLowerCase();
  for (const n of numberCopy.match(NUMBER_RE) ?? []) {
    if (!isCitable(n, allowed)) {
      problems.push(`cites number ${n}, which is not in the metrics`);
    }
  }

  if (!referencesMetric(out.focus, metrics, allowed)) {
    problems.push("focus does not reference any metric");
  }
  if (!referencesMetric(out.strength, metrics, allowed)) {
    problems.push("strength does not trace to any metric or anchor");
  }

  // DECISIONS #19: every judged score cites a quoted moment or timestamp.
  for (const [name, dim] of Object.entries(dims) as [
    Tier2Dimension,
    JudgedDimension,
  ][]) {
    if (!citesEvidence(dim.citedMoment, transcript)) {
      problems.push(
        `${name}.citedMoment has no verbatim transcript quote or timestamp: "${dim.citedMoment.slice(0, 80)}"`
      );
    }
  }

  return problems;
}

export function tier2Scores(
  coach: CoachOutput
): Record<Tier2Dimension, number> {
  return {
    structure: coach.dimensions.structure.score,
    credibility: coach.dimensions.credibility.score,
    engagement: coach.dimensions.engagement.score,
    confidence: coach.dimensions.confidence.score,
  };
}

const MAX_ATTEMPTS = 3;

export async function coachRep(
  transcript: string,
  metrics: RepMetrics,
  tier1: Tier1Scores,
  anchors: Tier2Anchors
): Promise<CoachOutput | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: userPrompt(transcript, metrics, tier1, anchors) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 3000,
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

    const problems = validateCoachOutput(
      parsed,
      transcript,
      metrics,
      tier1,
      anchors
    );
    if (problems.length === 0) return parsed;

    if (attempt === MAX_ATTEMPTS) {
      // Giving up costs the rep its Ethos Index, so say why. Without
      // this the failure is invisible in production and the only
      // symptom is a missing number.
      console.warn(
        `[coach] gave up after ${MAX_ATTEMPTS} attempts: ${problems.join("; ")}`
      );
    }

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Output violates the rules:\n- ${problems.join("\n- ")}\nFix every violation and return corrected JSON. Same schema.`,
      }
    );
  }

  return null;
}
