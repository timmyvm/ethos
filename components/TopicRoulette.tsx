"use client";

import { useState } from "react";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { spin, TOPIC_SHAPES, type Topic } from "@/lib/topics";

/**
 * The roulette. Spin, get a topic you didn't choose, speak on it cold.
 *
 * The point isn't novelty — it's that picking your own topic quietly
 * lets you rehearse while you decide, which is the one thing a cold-open
 * drill can't allow. It also kills the "what do I even talk about"
 * stall that ends a session before it starts.
 */
export function TopicRoulette({
  topic,
  onSpin,
  onTake,
}: {
  topic: Topic;
  onSpin: (t: Topic) => void;
  onTake: (t: Topic) => void;
}) {
  const [rolling, setRolling] = useState(false);

  function doSpin() {
    buzz(20);
    if (prefersReducedMotion()) {
      onSpin(spin(topic.id));
      return;
    }
    setRolling(true);
    // A few flickers so it reads as a draw, not a swap. Short enough
    // that it never becomes a thing you wait through.
    let n = 0;
    const t = setInterval(() => {
      onSpin(spin(null));
      if (++n >= 6) {
        clearInterval(t);
        setRolling(false);
        onSpin(spin(topic.id));
        buzz([10, 30, 10]);
      }
    }, 70);
  }

  const shape = TOPIC_SHAPES[topic.shape];

  return (
    <div className="rounded-[14px] border border-edge bg-raised p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">Roulette · you don&apos;t pick</div>
        <div className="label-data !text-sage-700">{shape.label}</div>
      </div>

      <div
        className={`font-display mt-3 min-h-[5rem] text-[24px] font-bold leading-[1.15] tracking-[-0.01em] transition-opacity ${
          rolling ? "opacity-40" : "opacity-100"
        }`}
      >
        {topic.prompt}
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          onClick={doSpin}
          disabled={rolling}
          className="press font-display shrink-0 rounded-[10px] border border-stone-200 px-5 py-3.5 text-[14px] font-bold disabled:opacity-60"
        >
          Spin
        </button>
        <button
          onClick={() => onTake(topic)}
          disabled={rolling}
          className="press font-display flex-1 rounded-xl bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-stage transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          Take this one
        </button>
      </div>
    </div>
  );
}
