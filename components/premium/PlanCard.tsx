"use client";

import { PremiumMark } from "@/components/PremiumMark";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
import { cardWords, DECLINED, pictureLabel, settingsLine, MANAGE_COPY, type PlanView } from "@/lib/plan-view";
import { LADDER_CENTS, formatBare } from "@/lib/pricing";
import { RollNumber } from "./RollNumber";
import { Stair, stepHeight } from "./Stair";

/**
 * The plan where a subscriber manages it (docs/ladder-spec.md, surfaces
 * 2 and 4): You's plan card and Settings' "Manage plan" row. Both are
 * neutral, because managing a plan is a utility; the only plum is the
 * mark. Both open the same manage sheet.
 *
 * The card is a departure board (Flighty): the mark and the month on
 * top, this month's price on the left and the next one with its date on
 * the right, the stair under them with the Paw on your month, and one
 * caption that says how far the floor is. Every state keeps that
 * grammar and changes only what the spec says it changes.
 */

/**
 * Every price the ladder prints: "A$" one number-step down, then the
 * figure. The one place the pair is set, on every surface, neutral or
 * plum, so the gap between them is one rule: about 0.08 of the figure
 * (2px at 24, 3px at 36, 4px at 56), as both design directions set it.
 * `roll` turns the figure with RollNumber (the paywall's readout, the
 * drop's).
 */
export function Price({
  cents,
  size,
  tone = "neutral",
  roll = false,
  className = "",
}: {
  cents: number;
  /** m: 24 over a 17 currency; l: 36 over 24; hero: 56 over 36. */
  size: "m" | "l" | "hero";
  tone?: "neutral" | "plum";
  roll?: boolean;
  className?: string;
}) {
  const [cur, fig, gap] =
    size === "hero"
      ? ["text-num-l", "text-num-hero", "mr-1"]
      : size === "l"
        ? ["text-num-m", "text-num-l", "mr-0.75"]
        : ["text-num-s", "text-num-m", "mr-0.5"];
  return (
    <span className={`font-display inline-flex items-baseline whitespace-nowrap tabular-nums ${className}`}>
      <span className={`${cur} ${gap} ${tone === "plum" ? "text-cream/70" : "text-stone-500"}`}>A$</span>
      {roll ? (
        <RollNumber className={fig} text={formatBare(cents)} value={cents} />
      ) : (
        <span className={fig}>{formatBare(cents)}</span>
      )}
    </span>
  );
}

/**
 * One column of the board: what it is, over its price. The price stands
 * on its own flex line, exactly one figure tall: an inline-flex price on
 * the button's text strut made the line 3px taller than the skeleton's.
 */
export function PriceCell({ caption, cents, end = false }: { caption: string; cents: number; end?: boolean }) {
  return (
    <span className={`block min-w-0 ${end ? "text-right" : ""}`}>
      <span className="block text-caption text-stone-500">{caption}</span>
      <span className={`mt-0.5 flex ${end ? "justify-end" : ""}`}>
        <Price cents={cents} size="m" />
      </span>
    </span>
  );
}

/**
 * A declined card's one sign: a ring with a bar and a dot (direction
 * B's), in stone. A retried card is a fact to fix, never an alarm, so it
 * is never red.
 */
export function IconDeclined({ size = 16, className = "text-stone-500" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.1" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** What a screen reader hears for the card: the state, the ladder, the door. */
function cardLabel(view: PlanView, today: Date): string {
  const declined = view.declined ? `${DECLINED}. ` : "";
  return `Premium plan. ${declined}${pictureLabel(view, today)} ${MANAGE_COPY.manage}.`;
}

/**
 * You's plan card. A `.card` that presses (0.985) and opens the manage
 * sheet. Its states: active, the floor, ending (the months it will not
 * reach drawn as outlines), past due and unpaid (the declined sign in
 * stone), and a first payment still pending (the ladder with nobody on
 * it yet). Free, code and ended draw no card; unknown is the skeleton.
 */
export function PlanCard({ view, today, onOpen }: { view: PlanView; today: Date; onOpen: () => void }) {
  const w = cardWords(view, today);
  if (!w) return null;
  return (
    <button
      type="button"
      data-look="plan-card"
      aria-haspopup="dialog"
      aria-label={cardLabel(view, today)}
      onClick={onOpen}
      className="card press block w-full overflow-hidden p-4 text-left"
    >
      <span className="flex min-h-6 items-center gap-2">
        <PremiumMark variant="chip" />
        {/* No chevron after the month (D44): the whole card is the
            door, and a chevron beside "Month 3" read as a link on it. */}
        <span className="font-display ml-auto text-row tabular-nums text-stone-500">{w.month}</span>
      </span>

      {"title" in w.left ? (
        <span className="font-display mt-3 flex items-center gap-2 text-detail">
          {w.declined && <IconDeclined size={18} />}
          {w.left.title}
        </span>
      ) : (
        <span className="mt-3 flex items-end justify-between gap-4">
          <PriceCell caption={w.left.caption} cents={w.left.cents} />
          {w.right && <PriceCell caption={w.right.caption} cents={w.right.cents} end />}
        </span>
      )}

      <Stair
        tone="neutral"
        size="sm"
        at={view.kind === "incomplete" ? null : view.step}
        ghostAfter={w.ghostAfter}
        bleed={16}
        riseDelay={120}
        label={pictureLabel(view, today)}
        className="mt-2"
      />

      <span className="mt-3 block text-caption text-pretty text-stone-500">{w.foot}</span>
    </button>
  );
}

/**
 * The card while the plan is unknown (loading, or a checkout return's
 * sync still out): the active card's own lines with their words hidden,
 * and the stair drawn in skeleton at its real step heights, so nothing
 * shifts when the card lands. Never the free door, never A$0.00.
 * `status` takes the foot's place, said aloud by the slot's live region.
 */
export function PlanCardSkeleton({ status }: { status?: string }) {
  return (
    <div aria-hidden className="card overflow-hidden p-4">
      <div className="flex min-h-6 items-center gap-2">
        <Bar className="label-micro rounded-full border border-transparent px-2 py-0.5" text="Premium" />
        <Bar className="font-display ml-auto text-row" text="Month 3" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <span className="block">
          <Bar className="block text-caption" text="This month" />
          <Bar className="font-display mt-0.5 block text-num-m" text="A$10.99" />
        </span>
        <span className="block">
          <Bar className="block text-caption" text="From 24 Nov" right />
          <Bar className="font-display mt-0.5 block text-num-m" text="A$9.99" right />
        </span>
      </div>
      <div className="stair-wrap mt-2" style={{ ["--stair-bleed" as string]: "16px" }}>
        <div className="stair" data-size="sm" data-bleed>
          <div className="stair-steps">
            {LADDER_CENTS.map((cents, i) => (
              <div
                key={i}
                className="stair-col"
                data-floor={i === LADDER_CENTS.length - 1 || undefined}
                style={{ ["--h" as string]: `${stepHeight("sm", cents)}px` }}
              >
                <Skeleton className="h-full" rounded="rounded-[8px_8px_4px_4px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* The active card's own foot sentence, so it wraps where the
          card's does (two lines below about 375), a bar per line. */}
      {status ? (
        <p className="mt-3 text-caption text-stone-500">{status}</p>
      ) : (
        <span className="mt-3 block text-caption text-pretty">
          <SkeletonText text="4 months to your lowest price, A$6.99 from 24 Feb." />
        </span>
      )}
    </div>
  );
}

/** Words hidden under a bar on each line they take, so a wrapped line keeps its place line for line. */
function SkeletonText({ text }: { text: string }) {
  return <span className="skeleton skeleton-text">{text}</span>;
}

/** A line of type at its own height, its words hidden under a bar. */
function Bar({ className, text, right = false }: { className: string; text: string; right?: boolean }) {
  return (
    <span className={`relative ${className}`}>
      <span className="invisible">{text}</span>
      <Skeleton className={`absolute inset-y-[18%] ${right ? "right-0" : "left-0"} w-full`} />
    </span>
  );
}

/** A date's day and month never part across lines: "24 Nov" stays whole. */
const keepDate = (line: string) => line.replace(/(\d) (?=[A-Z][a-z]{2}$)/, "$1\u00a0");

/**
 * Settings' row in the account group: "Manage plan" over the plan's
 * state, then the mark and the chevron. It opens the same manage sheet
 * as You's card. On a narrow phone the state takes two balanced lines
 * ("Month 3, A$9.99" over "from 24 Nov"), never a date split in two.
 *
 * `arrive`: how it lands after the billing read. `row` fades the whole
 * row in where nothing held its place; `line` fades only the state in,
 * over the skeleton that held it (SettingsPlanRowSkeleton).
 */
export function SettingsPlanRow({
  view,
  today,
  onOpen,
  arrive,
}: {
  view: PlanView;
  today: Date;
  onOpen: () => void;
  arrive?: "row" | "line";
}) {
  const line = settingsLine(view, today);
  if (line === null) return null;
  const declined = view.declined;
  return (
    <button
      type="button"
      data-look="manage-plan"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={`group-row press-row flex w-full items-center gap-3 text-left ${arrive === "row" ? "arrive" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{MANAGE_COPY.manage}</span>
        {/* The glyph stands on the first line when the state takes two. */}
        <span
          className={`mt-0.5 flex items-start gap-1.5 text-caption tabular-nums text-stone-500 ${arrive === "line" ? "fade-in" : ""}`}
        >
          {declined && <IconDeclined size={14} className="mt-0.5 text-stone-500" />}
          <span className="min-w-0 text-balance">{keepDate(line)}</span>
        </span>
      </span>
      <PremiumMark variant="chip" />
      <Disclosure />
    </button>
  );
}

/**
 * The row's place while the plan is unknown, on a device that last saw
 * one (lib/plan-hint.ts): the row itself, its state line a bar, so the
 * rows under it never move when it lands.
 */
export function SettingsPlanRowSkeleton() {
  return (
    <div aria-hidden data-look="manage-plan-skeleton" className="group-row flex w-full items-center gap-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{MANAGE_COPY.manage}</span>
        <span className="mt-0.5 flex items-start gap-1.5 text-caption tabular-nums">
          <span className="min-w-0 text-balance">
            <SkeletonText text={keepDate("Month 3, A$9.99 from 24 Nov")} />
          </span>
        </span>
      </span>
      <PremiumMark variant="chip" />
      <Disclosure />
    </div>
  );
}
