"use client";

import { useState } from "react";
import { IconPremium } from "@/components/Icon";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { Disclosure } from "@/components/ui/Disclosure";
import { Overlay } from "@/components/ui/Overlay";
import { ACTION_CLASS } from "@/lib/ui";
import { FIRST_PRICE_CENTS, FLOOR_PRICE_CENTS, formatAud, formatBare } from "@/lib/pricing";
import { dayMonth, dayMonthLong, readPlan, type PlanState } from "./data";
import { Stair } from "./Stair";

/**
 * The subscriber's plan, direction B: on You a card that is a door
 * (the mark, the month, a departure-board pair of prices with their
 * dates, the stair with your token on it), and the manage sheet it
 * opens. The stair here is neutral: the answer rows' surface, edge and
 * lip, the month you are in in ink, the months paid pressed flat. The
 * only plum is the mark and the token, the tier's two signs.
 */

/** You's secondary door (app/you/page.tsx), for the free account. */
const DOOR_CLASS =
  "press font-display flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-3 text-left text-row";

/** A rust ring with a bar and a dot: the declined card's one sign. */
export function IconDeclined({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0 text-rust">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.1" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** A price at board size: "A$" small and quiet, the figure tabular. */
function Price({ cents, className = "" }: { cents: number; className?: string }) {
  return (
    <span className={`font-display tabular-nums ${className}`}>
      <span className="lb-cur text-stone-500">A$</span>
      {formatBare(cents)}
    </span>
  );
}

/** One column of the board: what it is over its number. */
function Cell({ head, children, end = false }: { head: string; children: React.ReactNode; end?: boolean }) {
  return (
    <div className={end ? "text-right" : ""}>
      <p className="text-caption text-stone-500">{head}</p>
      <p className="mt-0.5 text-num-m">{children}</p>
    </div>
  );
}

function stairLabel(p: PlanState): string {
  const v = readPlan(p);
  if (v.atFloor) return `Month ${p.month}, at the lowest price, ${formatAud(FLOOR_PRICE_CENTS)}.`;
  return `Month ${p.month} of the price ladder: ${formatAud(v.now)} now, ${formatAud(v.next)} from ${dayMonthLong(v.renews)}, the lowest price ${formatAud(FLOOR_PRICE_CENTS)} from ${dayMonthLong(v.floorDate)}.`;
}

export function PlanCard({ plan, onOpen }: { plan: PlanState; onOpen?: () => void }) {
  const v = readPlan(plan);
  const status =
    plan.kind === "ending" ? (
      <span className="text-caption text-stone-500">Ends {dayMonth(v.renews)}</span>
    ) : plan.kind === "pastDue" ? (
      <span className="flex items-center gap-1.5 text-caption text-stone-500">
        <IconDeclined size={14} />
        Card declined
      </span>
    ) : (
      <span className="text-caption tabular-nums text-stone-500">Month {plan.month}</span>
    );

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Premium plan. ${stairLabel(plan)} Manage plan.`}
      className="card press block w-full overflow-hidden p-4 text-left"
    >
      <div className="flex min-h-6 items-center gap-2">
        <PremiumMark variant="chip" />
        <span className="ml-auto">{status}</span>
        <Disclosure />
      </div>

      {plan.kind === "pastDue" ? (
        <div className="mt-3">
          <p className="font-display text-row">Your card was declined.</p>
          <p className="mt-0.5 text-caption text-pretty text-stone-500">
            Premium stays on while it&apos;s retried, and month {plan.month} holds at {formatAud(v.now)}.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Cell head="This month">
            <Price cents={v.now} />
          </Cell>
          {plan.kind === "ending" ? (
            <Cell head="Premium until" end>
              <span className="font-display tabular-nums">{dayMonth(v.renews)}</span>
            </Cell>
          ) : (
            <Cell head={`From ${dayMonth(v.renews)}`} end>
              <Price cents={v.next} />
            </Cell>
          )}
        </div>
      )}

      <Stair
        tone="neutral"
        size="sm"
        at={v.rung}
        ghostAfter={plan.kind === "ending"}
        bleed={16}
        className="mt-3"
        label={stairLabel(plan)}
      />

      <p className="mt-2.5 text-caption text-pretty text-stone-500">
        {plan.kind === "ending"
          ? `Keep your plan and next month is ${formatAud(v.next)}.`
          : plan.kind === "pastDue"
            ? "Update your card to keep your place."
            : v.atFloor
              ? "You're at your lowest price."
              : `Your lowest price, ${formatAud(FLOOR_PRICE_CENTS)}, starts ${dayMonth(v.floorDate)}.`}
      </p>
    </button>
  );
}

/** (e) Premium from an invite code: no plan to manage, one quiet line. */
export function CodeLine() {
  return (
    <p className="flex items-center gap-2 text-caption text-stone-500">
      <span className="text-plum-700">
        <IconPremium size={16} />
      </span>
      Premium is on this account.
    </p>
  );
}

/** (f) The free account's door, unchanged, for continuity. */
export function FreeDoor({ onOpen }: { onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={DOOR_CLASS}>
      <PremiumDoor className="text-plum-700">Premium</PremiumDoor>
      <Disclosure />
    </button>
  );
}

/** A row in the sheet's group: a label, an optional note, the chevron. */
function Row({ label, note, onClick }: { label: string; note?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group-row press-row flex w-full items-center gap-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && <span className="mt-0.5 block text-caption text-stone-500">{note}</span>}
      </span>
      <Disclosure />
    </button>
  );
}

export type ManageMode = "rows" | "confirm";

/**
 * The manage sheet. Read top down like a recipe card (Crouton): the
 * mark and Done, the price this month at 36, the next price with its
 * date, the stair, then what you can do. Cancel is a row like any
 * other, one tap away, in ink, never greyed or hidden; that tap turns
 * the foot of the sheet into the confirm, which says the two facts and
 * offers both answers at the same size. Two taps out, as two taps in.
 */
export function ManageBody({
  plan,
  initialMode = "rows",
  onClose,
  className = "",
}: {
  plan: PlanState;
  initialMode?: ManageMode;
  onClose: () => void;
  className?: string;
}) {
  const [mode, setMode] = useState<ManageMode>(initialMode);
  const [kind, setKind] = useState(plan.kind);
  const v = readPlan(plan);
  const ends = dayMonth(v.renews);

  return (
    <div
      className={`lb-sheet-neutral w-full max-w-[430px] rounded-t-sheet px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 text-ink ${className}`}
    >
      <div aria-hidden className="mx-auto -mt-3 mb-3 h-1 w-10 rounded-full bg-stone-300" />
      <div className="flex items-center justify-between">
        <PremiumMark variant="chip" />
        <button type="button" onClick={onClose} className="text-link -mr-2 min-h-11 px-2 text-ink">
          Done
        </button>
      </div>

      {/* The state, then the next charge with its date. */}
      {kind === "pastDue" ? (
        <>
          <h2 className="font-display mt-1 flex items-center gap-2 text-title">
            <IconDeclined size={22} />
            Card declined
          </h2>
          <p className="mt-1.5 text-body text-pretty text-stone-500">
            Premium stays on while it&apos;s retried, and month {plan.month} holds at {formatAud(v.now)}.
          </p>
        </>
      ) : kind === "ending" ? (
        <>
          <h2 className="font-display mt-1 text-title">Premium until {ends}</h2>
          <p className="mt-1.5 text-body text-pretty text-stone-500">
            Then the plan ends. Keep it and month {plan.month + 1} is {formatAud(v.next)}.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 flex items-baseline gap-2">
            <Price cents={v.now} className="text-num-l" />
            <span className="font-display text-row text-stone-500">this month</span>
          </p>
          <p className="mt-1.5 text-body text-stone-500">
            {v.atFloor ? (
              <>Month {plan.month}. Your lowest price, every month you stay.</>
            ) : (
              <>
                Month {plan.month}. <span className="font-semibold text-ink">{formatAud(v.next)}</span> from {ends}.
              </>
            )}
          </p>
        </>
      )}

      <Stair
        tone="neutral"
        size="md"
        faces="price"
        at={v.rung}
        ghostAfter={kind === "ending"}
        bleed={24}
        className="mt-5"
        label={stairLabel({ ...plan, kind })}
      />

      {mode === "confirm" ? (
        <div className="reveal mt-6" role="group" aria-labelledby="lb-confirm-head">
          <h3 id="lb-confirm-head" className="detail-head">
            Cancel your plan?
          </h3>
          <p className="mt-1 text-body text-pretty text-stone-500">
            Premium runs to {ends}. If the plan ends, the next one starts at {formatAud(FIRST_PRICE_CENTS)}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode("rows")}
              className="press font-display min-h-12 rounded-control border-2 border-edge bg-raised px-4 text-body font-bold"
            >
              Keep my plan
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("ending");
                setMode("rows");
              }}
              className={`${ACTION_CLASS} px-4!`}
            >
              Cancel plan
            </button>
          </div>
        </div>
      ) : kind === "ending" ? (
        <div className="mt-6">
          <button type="button" onClick={() => setKind("active")} className={ACTION_CLASS}>
            Keep my plan
          </button>
          <div className="inset-group mt-4">
            <Row label="Update card and receipts" note="Opens Stripe, then brings you back." />
          </div>
        </div>
      ) : kind === "pastDue" ? (
        <div className="mt-6">
          <button type="button" className={ACTION_CLASS}>
            Update card
          </button>
          <div className="inset-group mt-4">
            <Row label="Receipts" />
            <Row label="Cancel plan" onClick={() => setMode("confirm")} />
          </div>
        </div>
      ) : (
        <div className="inset-group mt-6">
          <Row label="Update card and receipts" note="Opens Stripe, then brings you back." />
          <Row label="Cancel plan" onClick={() => setMode("confirm")} />
        </div>
      )}
    </div>
  );
}

export function ManageSheet({ plan, onClose }: { plan: PlanState; onClose: () => void }) {
  return (
    <Overlay label="Manage plan" onClose={onClose}>
      <ManageBody plan={plan} onClose={onClose} className="max-h-[92dvh] overflow-y-auto overscroll-contain" />
    </Overlay>
  );
}

/** Settings' Account group with the Manage plan row in it. */
export function SettingsAccount({ plan, onOpen }: { plan: PlanState; onOpen?: () => void }) {
  const v = readPlan(plan);
  const note =
    plan.kind === "ending"
      ? `Premium until ${dayMonth(v.renews)}`
      : plan.kind === "pastDue"
        ? "Card declined"
        : v.atFloor
          ? `Month ${plan.month}, ${formatAud(v.now)}`
          : `Month ${plan.month}, ${formatAud(v.next)} from ${dayMonth(v.renews)}`;
  return (
    <section>
      <h2 className="group-head">Account</h2>
      <div className="inset-group">
        <div className="group-row">
          <span className="font-display block text-row">tim@example.com</span>
          <span className="mt-0.5 block text-caption text-stone-500">Your recordings follow this email anywhere.</span>
        </div>
        <button type="button" onClick={onOpen} className="group-row press-row flex w-full items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="font-display block text-row">Manage plan</span>
            <span className="mt-0.5 block text-caption tabular-nums text-stone-500">{note}</span>
          </span>
          <PremiumMark variant="chip" />
          <Disclosure />
        </button>
        <button type="button" className="group-row press-row font-display w-full text-left text-row">
          Sign out
        </button>
      </div>
    </section>
  );
}
