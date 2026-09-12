"use client";

import { useState } from "react";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { DISABLED_CLASS } from "@/lib/ui";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { spinForAnswers as spin } from "@/lib/portfolio";
import { TOPIC_SHAPES, type Topic } from "@/lib/topics";

/**
 * The roulette. Spin, get a topic you didn't choose, speak on it cold.
 *
 * The point isn't novelty — it's that picking your own topic quietly
 * lets you rehearse while you decide, which is the one thing a cold-open
 * lesson can't allow. It also kills the "what do I even talk about"
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

  /* In roulette mode this IS the floor, so it wears the floor's lift:
     the one raised card on the screen (#234), at the sheet radius the
     floor card takes.
     The ARRIVAL moved up to the block on Today (#242): the eyebrow and
     the way back are part of what replaces the floor, and a card that
     rose under a label already sitting at full opacity was two
     entrances for one tap. The card keeps the elevation; the block
     does the rising. */
  return (
    <div className="elev-2 rounded-sheet border border-card-edge bg-raised p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">Roulette · you don&apos;t pick</div>
        <div className="label-micro !text-sage-700">{shape.label}</div>
      </div>

      <div
        className={`font-display mt-3 min-h-[5.75rem] text-title transition-opacity ${
          rolling ? "opacity-40" : "opacity-100"
        }`}
      >
        {/* Keyed on the topic so every draw mounts fresh and rolls in
            from below at the press step (#230): a reel, not a swap. */}
        <span key={topic.id} className="arrive dur-fast block">
          {topic.prompt}
        </span>
      </div>

      <div className="mt-4 flex gap-2.5">
        {/* Secondary: surface, a rule edge, no shadow (#234). */}
        <button
          onClick={doSpin}
          disabled={rolling}
          className="press font-display min-h-12 shrink-0 rounded-control border border-edge bg-surface px-5 text-[14px] font-bold disabled:opacity-40"
        >
          Spin
        </button>
        {/* The same one tap the floor and every lesson screen declare. */}
        <button
          onClick={() => onTake(topic)}
          disabled={rolling}
          className={`${ACTION_CLASS} ${DISABLED_CLASS} flex-1`}
        >
          Take this one
        </button>
      </div>
    </div>
  );
}
