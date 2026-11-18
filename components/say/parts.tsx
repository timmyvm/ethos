"use client";

import { SwapFrom, SwapTo } from "@/components/ui/TrendMark";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { markIn, saidBetter } from "@/lib/say";

/**
 * Say it better's object (#507): the Variety lesson's glass boomerang,
 * "Same idea, new words" (public/lessons/large/second-pass.webp), the
 * one Variety render whose meaning is the feature's. Never the price tag
 * the first design borrowed, which read as shopping in an app where money
 * buys only cosmetics. A plain img, as every lesson object is (#274).
 */
export function SayArt({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/lessons/large/second-pass.webp"
      alt=""
      aria-hidden
      width={560}
      height={560}
      loading="eager"
      decoding="async"
      className={`block object-contain ${className}`}
    />
  );
}

/**
 * One swap as a pair: what you said, struck, an arrow, and the better way
 * as the neutral word label (`.you-word`), the arrow travelling with what
 * it points at so a narrow phone wraps the pair whole (#496).
 */
export function SwapPair({ said, better, className = "" }: { said: string; better: string; className?: string }) {
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      <span className="text-stone-400 line-through">
        <SwapFrom />
        {said}
      </span>
      <span className="flex min-w-0 max-w-full items-center gap-2.5">
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-400">
          <path d="M2.5 8h10.5M9.5 4.5 13 8l-3.5 3.5" />
        </svg>
        <span className="you-word min-w-0 break-words">
          <SwapTo />
          {better}
        </span>
      </span>
    </span>
  );
}

/**
 * A sentence with one phrase marked: the weak one you said (Variety's
 * wave, the transcript's own mark for a vague phrase, #453), the better
 * one where it goes (a solid line in the tone), or the better one said
 * (sage: earned, with a solid sage line).
 */
export function MarkedSentence({
  sentence,
  said,
  better,
  mode,
}: {
  sentence: string;
  said: string;
  better: string;
  /** "weak": as you said it. "answer": said better, the new phrase marked. "said": said better, and you said it. */
  mode: "weak" | "answer" | "said";
}) {
  const parts = mode === "weak" ? markIn(sentence, said) : saidBetter(sentence, said, better);
  if (!parts) {
    /* The sentence does not hold the phrase (an old row): the phrase alone. */
    const phrase = mode === "weak" ? said : better;
    return <span className={mode === "weak" ? "say-weak" : mode === "said" ? "say-said" : "say-answer"}>{phrase}</span>;
  }
  return (
    <>
      {parts.before}
      <span className={mode === "weak" ? "say-weak" : mode === "said" ? "say-said" : "say-answer"}>
        {mode !== "weak" && <span className="sr-only">{mode === "said" ? "You said: " : "Say: "}</span>}
        {parts.match}
      </span>
      {parts.after}
    </>
  );
}

/**
 * N of M as slots that fill in sage (earned): the house segments while
 * each can stand at 12px, one continuous bar past sixteen, so a long list
 * never runs off a 320 screen. Decorative: the number beside it is the
 * accessible text.
 */
export function SaySlots({ n, m, className = "" }: { n: number; m: number; className?: string }) {
  if (m <= 0) return null;
  if (m <= 16) return <SegmentBar total={m} done={n} className={className} />;
  return (
    <div aria-hidden className={`h-1 w-full bg-sand ${className}`}>
      <div className="h-full bg-sage-600" style={{ width: `${(n / m) * 100}%` }} />
    </div>
  );
}
