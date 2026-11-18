import type { CSSProperties } from "react";
import { IconStar } from "@/components/Icon";

/**
 * The results' three stars, each with its goal under it (DECISIONS #504).
 * Timothy, 18 Nov: "in every game, the stars are always measured. Like,
 * oh, this is how you get 1 star ... But it just doesn't really explain
 * that, does it? It doesn't need to explain it. Like, there's too much
 * text." So no paragraph: one to three words under each star, the goal
 * itself ("20+ words", "Under 12 slips", "Under 4 slips"), gold star and
 * sage words where it was met, the outline and grey words where it was
 * not. The goals come from `starGoals` (lib/metrics.ts), held to the same
 * numbers as the stars, so a lit star and its words never disagree.
 *
 * The stars are the `Stars` glyphs: earned gold through `.earned-lit`,
 * the rest the stone-400 outline, a shallow arch (the middle star 4px
 * down, its words 4px closer so the three goals share a line), and with
 * `land` each earned star scales in after `landAfterMs`, 120ms apart,
 * its words turning sage as it lands (`.goal-land`).
 *
 * A screen reader hears "2 of 3 stars", then each goal and whether it was
 * earned: the colour and the fill are never the whole message.
 */
export function StarGoals({
  n,
  goals,
  size = 40,
  land = false,
  landAfterMs = 0,
}: {
  n: number;
  goals: readonly string[];
  size?: number;
  land?: boolean;
  landAfterMs?: number;
}) {
  return (
    <ul data-star-goals aria-label={`${n} of ${goals.length} stars`} className="flex justify-center">
      {goals.map((goal, k) => {
        const earned = k < n;
        const landing = land && earned;
        const timing = landing
          ? ({ "--i": k, "--land-after": `${landAfterMs}ms` } as CSSProperties)
          : undefined;
        const middle = k === (goals.length - 1) / 2;
        return (
          <li key={k} className="flex w-[6.5rem] flex-col items-center">
            <span
              aria-hidden
              className={`inline-flex ${earned ? "earned-lit" : "text-stone-400"} ${landing ? "star-land" : ""}`}
              style={{ ...(middle ? { marginTop: 4 } : null), ...timing }}
            >
              <IconStar size={size} filled={earned} />
            </span>
            <span
              data-star-goal={earned ? "met" : "open"}
              className={`${middle ? "mt-0.5" : "mt-1.5"} whitespace-nowrap text-caption font-semibold ${
                earned ? "text-sage-700" : "text-stone-500"
              } ${landing ? "goal-land" : ""}`}
              style={timing}
            >
              {goal}
              <span className="sr-only">{earned ? ", earned" : ", not earned"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
