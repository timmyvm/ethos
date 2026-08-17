"use client";

/**
 * The only way a failure reaches the user.
 *
 * Checkpoint 1 found the opposite everywhere: pages caught their fetch
 * failures and said nothing, so a dead connection looked like an empty
 * training log — the one lie vision.md doesn't allow, since it reads as
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
      className={`rounded-[18px] border border-hairline bg-surface lift p-5 ${className}`}
    >
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="press mt-3 min-h-11 w-full rounded-[13px] border border-black/10 px-4 py-3 text-[14px] font-semibold hover:bg-sand"
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
    <p role="alert" className={`text-[13px] text-stone-500 ${className}`}>
      {children}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="font-semibold text-stone-600 underline underline-offset-2"
      >
        Try again
      </button>
    </p>
  );
}
