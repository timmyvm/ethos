import type { PracticeFamily } from "@/lib/practice-family";

/**
 * What you are about to talk about, as the hero (feedback round, 25 Sep).
 *
 * The topic is the biggest thing on the screen, in display type on the
 * practice's own colour (D50): the trait family Today's card wore when
 * Start was pressed (`.family-fill`, the same layer and tokens as
 * `.home-hero`), white words at radius 28, so the day's colour carries
 * through the app's most important transition. A practice that
 * measures no one trait (the boss, a game) stands on the sky stage.
 *
 * Demos is not on it: he arrives as the listener when Record is
 * pressed (D51), so the prompt is the one thing to read while idle.
 */
export function TopicCard({
  eyebrow,
  topic,
  family,
  compact = false,
}: {
  eyebrow: string;
  topic: string;
  family: PracticeFamily;
  /** While the clock runs: the same card, a size down, at the top. */
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Your topic"
      data-family={family}
      /* Idle, it stands as tall as the room allows (Today's card is
         376): the eyebrow at the top, the topic at the foot, and the
         idle screen's free height in the card rather than over it. The
         recording screen's column gives it that height, 168 to 300. */
      className={`family-fill flex flex-col p-5 ${
        compact ? "" : "min-h-[168px] flex-1 justify-between pb-6"
      }`}
    >
      {/* PRINCIPLES 4: an eyebrow inside a card is sentence case, here
          in the card's own ink rather than the old amber. */}
      <div className="eyebrow text-[var(--stage-ink)]">{eyebrow}</div>
      {/* recording-14: balanced in both sizes, so the last word never
          stands alone ("next / sentence."). recording-16: the padding is
          the same in both states, so on Record only the type steps down
          while the card glides up. */}
      <h1
        className={`font-display text-balance ${
          compact
            ? "mt-1.5 text-lead font-bold leading-snug"
            : "mt-2 text-title font-extrabold leading-[1.18]"
        }`}
      >
        {topic}
      </h1>
    </section>
  );
}
