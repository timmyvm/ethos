"use client";

import { IconTrophy } from "@/components/Icon";
import type { RewardMoment } from "@/lib/rewards";

/**
 * One reward moment. Deliberately one component for every surface —
 * anticipation before a rep, near-miss on the path, fresh start on
 * Monday, the closing note after a rep — so the reward layer looks like
 * a system rather than a pile of one-off cards.
 *
 * Amber is used here because every moment this renders is earned or
 * true (DECISIONS #4): a held-pause count, a streak, a date.
 */
export function Moment({
  moment,
  emphasis = false,
}: {
  moment: RewardMoment | null;
  emphasis?: boolean;
}) {
  if (!moment) return null;
  const earned = moment.tone === "earned";
  const headline = (
    <div
      className={`font-display font-bold leading-tight ${
        emphasis ? "text-lead" : "text-body"
      } ${earned ? "text-sage-700" : ""}`}
    >
      {moment.headline}
    </div>
  );
  return (
    /* The one card recipe (PRINCIPLES 1); an earned moment wears the
       sage wash over it, since sage is what was earned. */
    <div
      className={`card p-4 ${
        earned ? "border-sage-300 bg-sage-100 dark:bg-none" : ""
      }`}
    >
      {moment.record ? (
        /* A game's best broken, in the plaque's grammar (BestPlaque,
           #421): the cup gold in its well, the new best large in sage,
           its words over the best it beat beside it. A screen reader
           hears the headline and the one sentence. */
        <>
          <p className="sr-only">
            {moment.headline}. {moment.detail}.
          </p>
          <div aria-hidden className="best-moment">
            <span className="best-moment-mark earned-lit">
              <IconTrophy size={22} />
            </span>
            <div className="min-w-0 flex-1">
              {headline}
              <div className="best-moment-line">
                <span className="best-moment-value">{moment.record.value}</span>
                <span className="best-moment-words">
                  {moment.record.rest}
                  <span className="best-moment-past">{moment.record.past}</span>
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {headline}
          <div className="mt-1 text-caption leading-relaxed text-stone-500">
            {moment.detail}
          </div>
        </>
      )}
    </div>
  );
}
