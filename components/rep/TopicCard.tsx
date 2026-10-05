import { DemosFigure } from "@/components/DemosClip";

/**
 * What you are about to talk about, as the hero (feedback round, 25 Sep).
 *
 * The recording screen used to open on an eyebrow, a bold name and a
 * grey paragraph, and the thing you would actually speak about was the
 * grey paragraph. Now the topic is the biggest thing on the screen, in
 * display type on a warm colour ground, with Demos standing on its top
 * edge: he is the coach, and this is the moment he coaches.
 *
 * The ground is the mascot's amber running into a terracotta WASH, not
 * the terracotta fill: the fill is the Record button's and nothing
 * else's. In dark the same two hues drop to dark washes of themselves.
 */
export function TopicCard({
  eyebrow,
  topic,
  compact = false,
  demos = true,
}: {
  eyebrow: string;
  topic: string;
  /** While the clock runs: same card, a size down, no mascot. */
  compact?: boolean;
  demos?: boolean;
}) {
  return (
    <section
      aria-label="Your topic"
      className={`topic-card relative rounded-sheet p-5 ${compact ? "" : "pb-6"}`}
    >
      {/* He stands ON the card's top edge, full body, with a contact
          shadow where his feet meet it (review, 25 Sep: the half-body
          render floated as a sticker showed its cut across his torso).
          The card keeps its full width for the topic. */}
      {demos && !compact && (
        <div aria-hidden className="topic-demos pointer-events-none absolute bottom-[calc(100%-12px)] right-3 w-[112px]">
          <span className="rep-ground" />
          <DemosFigure
            pose="speaking"
            src="/demos-onboard-speaking.webp"
            width={224}
            height={224}
            delayMs={900}
            className="demos relative block h-auto w-full"
          />
        </div>
      )}
      {/* PRINCIPLES 4: an eyebrow inside a card is sentence case. */}
      <div className="eyebrow topic-eyebrow">{eyebrow}</div>
      {/* recording-14: balanced in both sizes, so the last word never
          stands alone ("next / sentence."). recording-16: the padding is
          the same in both states, so on Record only the type steps down
          while the card glides up. */}
      <h1
        className={`font-display text-balance text-ink ${
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
