"use client";

import type { AccuracyResult } from "@/lib/accuracy";
import type { ColdTopic } from "@/lib/cold-topics";

/* Sentence-case pills (principle 4: capitals are for data). A claim
   that holds wears sage, because getting it right is earned; a wrong
   one wears rust, the colour that already means wrong direction, never
   the tap's terracotta. */
const VERDICT: Record<
  AccuracyResult["claims"][number]["verdict"],
  { label: string; className: string }
> = {
  supported: { label: "checks out", className: "bg-sage-100 text-sage-800" },
  contradicted: { label: "wrong", className: "bg-rust/10 text-rust" },
  unverifiable: { label: "unverified", className: "bg-stone-100 text-stone-500" },
};

/**
 * Boss-mode accuracy. Delivery is scored by the normal engine; this is
 * the other half — did the claims hold up.
 *
 * Every line quotes the speaker verbatim, so the verdict is checkable
 * against their own words (no-horoscope rule). The score is arithmetic
 * over coverage and confident errors, and the card shows both inputs
 * rather than just the output.
 */
export function AccuracyCard({
  accuracy,
  topic,
}: {
  accuracy: AccuracyResult;
  topic: ColdTopic | null;
}) {
  const coveredCount = accuracy.covered.length;
  const total = topic?.truth.length ?? coveredCount + accuracy.missed.length;

  return (
    <div className="card p-4">
      <div className="eyebrow">Accuracy</div>

      <div className="mt-3 flex items-baseline gap-3">
        <div className="font-display text-num-l tabular-nums">
          {accuracy.score}
        </div>
        <div className="text-caption text-stone-500">
          <div className="text-row text-stone-700">
            {coveredCount} of {total} points covered
          </div>
          {accuracy.confidentlyWrong > 0 ? (
            <div className="text-rust">
              {accuracy.confidentlyWrong} claim
              {accuracy.confidentlyWrong === 1 ? "" : "s"} stated as fact and
              wrong
            </div>
          ) : (
            <div>Nothing asserted that wasn&apos;t true.</div>
          )}
        </div>
      </div>

      {accuracy.claims.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-t border-hairline pt-4">
          {accuracy.claims.map((c, i) => (
            <li key={i} className="text-body leading-relaxed">
              <span
                className={`mr-2 inline-block rounded-full px-2 py-0.5 text-caption font-semibold ${VERDICT[c.verdict].className}`}
              >
                {VERDICT[c.verdict].label}
              </span>
              <span className="text-stone-700">&ldquo;{c.quote}&rdquo;</span>
              <span className="mt-0.5 block text-stone-500">
                {c.why}
                {c.verdict === "contradicted" && c.hedged && (
                  <span className="text-stone-400">
                    {" "}
                    You flagged the doubt, which cost less.
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {accuracy.missed.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-4">
          <div className="eyebrow">Never mentioned</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-body leading-relaxed text-stone-500 marker:text-stone-400">
            {accuracy.missed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
