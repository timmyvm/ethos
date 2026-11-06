import { closingLook } from "@/lib/closing-note";
import type { RewardMoment } from "@/lib/rewards";

/**
 * The last step's closing note (DECISIONS #423): the take's last word.
 * Records broken are earned cards; this is the sentence the walk ends
 * on, so it takes no card at all. A short mark opens it, centred like
 * a sign-off; its number wears the colour of what it measured (the
 * trait's tone, sage when it was earned, the ink for a count), and its
 * line closes the step in the page's own voice. It arrives with the
 * step (the step's arrive-x), so reduced motion shows it already there.
 */
export function ClosingNote({
  moment,
  className = "",
}: {
  moment: RewardMoment;
  className?: string;
}) {
  const look = closingLook(moment);
  return (
    <div
      data-look="closing-note"
      data-trait={look.trait ?? undefined}
      data-ink={look.ink}
      className={`closing-note ${className}`}
    >
      <span aria-hidden className="closing-note-mark" />
      <p className="closing-note-line">
        {look.pre}
        {look.value !== null ? (
          <>
            <span className="closing-note-value">{look.value}</span>
            {look.post}
          </>
        ) : (
          <span className="closing-note-value">{look.post}</span>
        )}
      </p>
      <p className="closing-note-detail text-body text-stone-500">
        {look.lines.map((line, i) => (
          <span key={i} className="block">
            {line}
            {i < look.lines.length - 1 ? " " : null}
          </span>
        ))}
      </p>
    </div>
  );
}
