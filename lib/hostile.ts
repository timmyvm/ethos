/**
 * Hostile Q&A — the shared half (DECISIONS #183). You give a 60-second
 * take; Demos comes back at your ACTUAL argument with a skeptical
 * question, twice; a verdict scores how the position held up under
 * opposition.
 *
 * This module is imported by the CLIENT page as well as the server, so
 * it holds only prompts, shapes and pure validation. The Claude calls
 * live in lib/hostile-server.ts — importing the SDK from here would
 * bundle node built-ins into the browser build.
 *
 * Adversarial is not abusive (mechanics.md): Demos challenges the
 * argument, never the person, and every question must quote the speaker
 * verbatim — the same no-horoscope contract the coach call runs under
 * (DECISIONS #19).
 */

import { z } from "zod";

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

export const QuestionSchema = z.object({
  quoted: z.string().min(4).max(160),
  question: z.string().min(8).max(200),
});

export type HostileQuestion = z.infer<typeof QuestionSchema>;

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

/** Where the interrogation stands, for prompt building. */
export interface HostileContext {
  claim: string;
  take: string;
  rounds: { question: string; answer: string }[];
}

/** Is `quoted` a verbatim fragment of any of these texts? */
export function quoteAppears(quoted: string, texts: string[]): boolean {
  const clean = quoted.replace(/["“”']/g, "").toLowerCase().trim();
  if (clean.length < 4) return false;
  return texts.some((t) => t.toLowerCase().includes(clean));
}

/** The question when generation fails: generic but honest, quotes nothing. */
export const FALLBACK_QUESTIONS = [
  "If you had to defend only one of your points, which one survives?",
  "What would change your mind on this?",
];

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
