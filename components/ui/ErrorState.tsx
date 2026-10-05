"use client";

/**
 * The only way a failure reaches the user.
 *
 * Checkpoint 1 found the opposite everywhere: pages caught their fetch
 * failures and said nothing, so a dead connection looked like an empty
 * log — the one lie vision.md doesn't allow, since it reads as
 * "you have done nothing" to someone who has done plenty.
 *
 * Rules: name what didn't load, say what it means for their data, always
 * offer the retry. Never the raw error string — `Failed to fetch` is the
 * network's words, not ours.
 *
 * The retry is deliberately NOT terracotta. brand.md keeps orange for the
 * one thing a screen wants you to do, and a failed fetch is not that
 * thing; the button is alone in its block, so it doesn't need colour to
 * be found (DECISIONS #146).
 */
export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`card p-4 ${className}`}
    >
      <p className="font-display text-row">{title}</p>
      <p className="mt-1 text-caption leading-relaxed text-stone-500">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="press font-display mt-3 min-h-11 w-full rounded-control border border-edge bg-surface px-4 py-2.5 text-row"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The same failure, one line, for a section inside an otherwise working
 * screen — the home score card, a single sparkline. A whole alert card
 * over one missing number is louder than the number.
 *
 * The retry's hit area reaches 13px above and below and 8px to each
 * side (lessons-17), a 44px target on an 18px line, so the line keeps
 * its height where it stands in for a 48px button.
 */
export function ErrorLine({
  children,
  onRetry,
  className = "",
}: {
  children: React.ReactNode;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <p role="alert" className={`text-caption text-stone-500 ${className}`}>
      {children}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="relative font-semibold text-stone-600 underline underline-offset-2 after:absolute after:-inset-x-2 after:-inset-y-[13px] after:content-['']"
      >
        Try again
      </button>
    </p>
  );
}
