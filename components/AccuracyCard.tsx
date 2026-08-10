"use client";

import type { AccuracyResult } from "@/lib/accuracy";
import type { ColdTopic } from "@/lib/cold-topics";

const VERDICT: Record<
  AccuracyResult["claims"][number]["verdict"],
  { label: string; className: string }
> = {
  supported: { label: "checks out", className: "bg-amber-50 text-amber-600" },
  contradicted: {
    label: "wrong",
    className: "bg-terracotta-50 text-terracotta-600",
  },
  unverifiable: { label: "unverified", className: "bg-sand text-stone-500" },
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
    <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-5">
      <div className="label-data">Accuracy · the other half of the boss</div>

      <div className="mt-2.5 flex items-baseline gap-3">
        <div className="font-display text-[40px] font-bold leading-none">
          {accuracy.score}
        </div>
        <div className="text-[13px] text-stone-500">
          <div className="font-semibold text-stone-700">
            {coveredCount} of {total} points covered
          </div>
          {accuracy.confidentlyWrong > 0 ? (
            <div className="text-terracotta-600">
              {accuracy.confidentlyWrong} claim
              {accuracy.confidentlyWrong === 1 ? "" : "s"} stated confidently
              and wrong
            </div>
          ) : (
            <div>Nothing asserted that wasn&apos;t true.</div>
          )}
        </div>
      </div>

      {accuracy.claims.length > 0 && (
        <ul className="mt-3.5 space-y-2.5 border-t border-sand pt-3.5">
          {accuracy.claims.map((c, i) => (
            <li key={i} className="text-[13px] leading-relaxed">
              <span
                className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT[c.verdict].className}`}
              >
                {VERDICT[c.verdict].label}
              </span>
              <span className="text-stone-700">&ldquo;{c.quote}&rdquo;</span>
              <span className="mt-0.5 block text-stone-500">
                {c.why}
                {c.verdict === "contradicted" && c.hedged && (
                  <span className="text-stone-400">
                    {" "}
                    — you flagged the doubt, which cost less.
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {accuracy.missed.length > 0 && (
        <div className="mt-3.5 border-t border-sand pt-3.5">
          <div className="label-data">Never mentioned</div>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-stone-500">
            {accuracy.missed.map((m, i) => (
              <li key={i}>· {m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
