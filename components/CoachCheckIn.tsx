"use client";

import Image from "next/image";
import type { Insight } from "@/lib/insights";

/**
 * The daily check-in. Demos reads back what the last few reps actually
 * show — and it is arithmetic over stored reps, not an LLM call
 * (DECISIONS #30), so nothing here can be invented.
 *
 * Wellspoken's version is a chat with an AI coach. This deliberately
 * isn't: a conversation invites the model to generate encouragement,
 * which is exactly the horoscope feedback vision.md bans. One line, from
 * numbers, is the honest version of the same moment.
 */
export function CoachCheckIn({
  insights,
  onDone,
}: {
  insights: Insight[];
  onDone: () => void;
}) {
  const shown = insights.slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-black/5 bg-white lift p-5">
      <div className="label-data">Check in with Demos</div>

      <div className="mt-3 flex items-start gap-3">
        <Image
          src="/demos-speaking.webp"
          alt=""
          width={52}
          height={52}
          className="w-[52px] shrink-0 rounded-[12px] border border-sand bg-cream"
        />
        <div className="min-w-0 flex-1 space-y-3">
          {shown.map((i) => (
            <div key={i.id}>
              <div className="text-[14px] font-semibold leading-snug">
                {i.headline}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-stone-500">
                {i.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 border-t border-sand pt-3 text-[11.5px] text-stone-400">
        Counted from your stored reps. No opinions, no guessing.
      </p>

      <button
        onClick={onDone}
        className="press mt-3 w-full rounded-[14px] border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold"
      >
        Got it
      </button>
    </div>
  );
}
