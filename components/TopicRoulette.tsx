"use client";

import { ACTION_CLASS } from "@/components/LessonScreen";
import { Reel, useReel } from "@/components/Reel";
import { DISABLED_CLASS } from "@/lib/ui";
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
  /* The wheel is components/Reel.tsx (#278), shared with the boss's,
     which used to be a near-verbatim copy of the flicker this replaced. */
  const reel = useReel<Topic>({
    current: topic,
    draw: (exclude) => spin(exclude),
    onLand: onSpin,
  });

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

      <Reel
        state={reel}
        current={topic}
        className="font-display mt-3 text-title"
        render={(t) => <span className="block">{t.prompt}</span>}
      />

      <div className="mt-4 flex gap-2.5">
        {/* Secondary: surface, a rule edge, no shadow (#234). */}
        <button
          onClick={reel.spin}
          disabled={reel.rolling}
          className="press font-display min-h-12 shrink-0 rounded-control border border-edge bg-surface px-5 text-[14px] font-bold disabled:opacity-40"
        >
          Spin
        </button>
        {/* The same one tap the floor and every lesson screen declare. */}
        <button
          onClick={() => onTake(topic)}
          disabled={reel.rolling}
          className={`${ACTION_CLASS} ${DISABLED_CLASS} flex-1`}
        >
          Take this one
        </button>
      </div>
    </div>
  );
}
