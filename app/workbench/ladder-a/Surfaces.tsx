"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { IconBoss, IconBubble, IconMic, IconSpark, IconTrend } from "@/components/Icon";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Disclosure } from "@/components/ui/Disclosure";
import { FIRST_PRICE_CENTS, FLOOR_MONTH, formatAud, formatBare, priceForMonth } from "@/lib/pricing";
import { buzz } from "@/lib/prefs";
import { ACTION_CLASS } from "@/lib/ui";
import { Timeline } from "./Timeline";
import { dayMonth, monthStarts, monthsToFloor, rungOf, type PlanState } from "./ladder";

/**
 * Direction A's surfaces, each the piece a real screen would mount:
 * the paywall sheet, You's plan card, the manage sheet, Settings' row
 * and the two moments. The workbench page frames them; nothing here
 * knows it is on a workbench.
 */

/* ------------------------------------------------------------------ */
/* Shared bits. */

/** A price with its currency said small: "A$" at 0.55em, then the digits. */
export function Price({ cents, className = "" }: { cents: number; className?: string }) {
  return (
    <span className={`font-display whitespace-nowrap tabular-nums ${className}`}>
      <span className="la-cur">A$</span>
      {formatBare(cents)}
    </span>
  );
}

const SHEET_NEUTRAL =
  "la-sheet-neutral elev-3 w-full max-w-[430px] rounded-t-sheet px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7";
const GRABBER_NEUTRAL = "mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-stone-300";
const SECONDARY_CLASS =
  "la-fill-2 press font-display flex min-h-12 w-full items-center justify-center rounded-control bg-surface text-body font-bold";

/** A card that a renewal could not charge: the card, and a small cross. */
function IconDeclined({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="m14.5 13.5 3 3m0-3-3 3" />
    </svg>
  );
}

/** Leaves the app for Stripe's page: an arrow up and out, iOS's mark. */
function IconOut() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-400">
      <path d="M4 1.5h6.5V8" />
      <path d="M10.5 1.5 1.5 10.5" />
    </svg>
  );
}

/** The same five lines the paywall has always carried (#199). */
const keep = (s: string) => <span className="whitespace-nowrap">{s}</span>;
const BENEFITS = [
  { Glyph: IconBubble, text: <>Demos&apos;s full read on every recording {keep("(free: 1 a day)")}</> },
  { Glyph: IconMic, text: "Presence on video, with its moments" },
  { Glyph: IconTrend, text: "Your whole history, all nine skills" },
  { Glyph: IconSpark, text: "Every word you've earned, kept" },
  { Glyph: IconBoss, text: <>Speed rush, Interview and Hostile Q&amp;A, {keep("any boss topic, any week")}</> },
];

/* ------------------------------------------------------------------ */
/* 1, 2. The paywall sheet. */

export type PaywallState = "offer" | "needs-account";

export function PaywallSheet({
  today,
  state,
  reason = "Full history",
  headline = "Premium opens everything",
  lead = 0,
  initialSel = 1,
  onStart,
  onClose,
}: {
  today: Date;
  state: PaywallState;
  /** Where the selection starts: month 1, today, unless a frame shows a scrub. */
  initialSel?: number;
  reason?: string;
  headline?: string;
  /** Holds the chart's entrance until the sheet has landed. */
  lead?: number;
  onStart?: () => void;
  onClose?: () => void;
}) {
  const [sel, setSel] = useState(initialSel);
  return (
    <div className="card-premium la-sheet-plum max-h-[92dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-sheet px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-7 text-cream">
      <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-cream/30" />
      <PremiumMark variant="chip" />
      {reason && <p className="eyebrow mt-2.5 text-cream/70">{reason}</p>}
      <h2 className="font-display mt-1 text-title text-cream">{headline}</h2>
      <ul className="mt-3.5 space-y-2 text-body leading-snug text-cream/85">
        {BENEFITS.map(({ Glyph, text }, i) => (
          <li key={i} className="flex items-start gap-3">
            <span aria-hidden className="mt-px shrink-0 text-cream/60">
              <Glyph size={18} />
            </span>
            <span className="min-w-0">{text}</span>
          </li>
        ))}
      </ul>

      {/* The ladder: the rule in words, then the picture of it. A hairline
          parts it from the list, the way Weather parts its modules. */}
      <section aria-labelledby="la-ladder-head" className="mt-5 border-t border-cream/14 pt-4">
        <h3 id="la-ladder-head" className="font-display text-detail text-cream">
          Your price drops every month you stay
        </h3>
        <Timeline
          className="mt-3"
          tone="plum"
          start={today}
          today={today}
          mode={{ kind: "offer" }}
          selected={sel}
          onSelect={setSel}
          lead={lead}
        />
      </section>

      {state === "offer" ? (
        /* Australian consumer law: the ladder, the renewal and the reset
           are said before the purchase, as real text at reading contrast
           (cream/70 on plum, 7:1), above the tap, never under it. */
        <p className="mt-4 text-caption text-cream/70">
          It renews monthly at these prices until you cancel, in two taps, any time. If a plan
          ends, the next one starts at {formatAud(FIRST_PRICE_CENTS)}.
        </p>
      ) : (
        <p role="status" className="reveal mt-4 flex items-start gap-2.5 text-body leading-snug text-cream">
          <span aria-hidden className="mt-0.5 shrink-0 text-cream/70">
            <IconPerson />
          </span>
          <span>Your plan needs an account. Make one and you&apos;ll come straight back here.</span>
        </p>
      )}

      {state === "offer" ? (
        <button type="button" onClick={onStart} className={`${ACTION_CLASS} mt-3.5`}>
          Start at {formatAud(FIRST_PRICE_CENTS)}
        </button>
      ) : (
        <a href="/signup?next=%2Fyou%3Fpaywall%3Dladder" className={`${ACTION_CLASS} mt-3.5`}>
          Make an account
        </a>
      )}

      {state === "offer" ? (
        <button
          type="button"
          onClick={onClose}
          className="font-display mt-1 min-h-11 w-full text-link text-cream/70"
        >
          Not yet
        </button>
      ) : (
        <div className="mt-1 grid grid-cols-2">
          <a
            href="/signin?next=%2Fyou%3Fpaywall%3Dladder"
            className="font-display flex min-h-11 items-center justify-center text-link text-cream/70"
          >
            I have an account
          </a>
          <button
            type="button"
            onClick={onClose}
            className="font-display flex min-h-11 items-center justify-center text-link text-cream/70"
          >
            Not yet
          </button>
        </div>
      )}
      <p className="mt-0.5 text-center text-caption text-cream/60">
        Money never buys stars, streaks, or scores.
      </p>
    </div>
  );
}

function IconPerson() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. The plan on You. */

/**
 * The plan card: a departure board (Flighty). Money on the left, the
 * next date that matters on the right, the timeline under both with
 * this month lit. A neutral `.card`: plum stays the mark, so You keeps
 * one tier colour and no plum surface (principle 2). The whole card is
 * the door to the manage sheet.
 */
export function PlanCard({
  plan,
  today,
  onOpen,
}: {
  plan: Extract<PlanState, { kind: "active" | "ending" | "past_due" }>;
  today: Date;
  onOpen?: () => void;
}) {
  const now = priceForMonth(plan.month);
  const next = priceForMonth(plan.month + 1);
  const renews = monthStarts(plan.start, plan.month + 1);
  const floorFrom = monthStarts(plan.start, FLOOR_MONTH);
  const atFloor = plan.month >= FLOOR_MONTH;

  const head =
    plan.kind === "ending" ? `Ends ${dayMonth(plan.endsOn)}` : `Month ${plan.month}`;

  let right: { big: React.ReactNode; small: string };
  if (plan.kind === "ending") right = { big: dayMonth(plan.endsOn), small: "Premium ends" };
  else if (plan.kind === "past_due") right = { big: dayMonth(plan.retryOn), small: "Stripe tries again" };
  else if (atFloor) right = { big: dayMonth(renews), small: "Renews" };
  else right = { big: <Price cents={next} />, small: `From ${dayMonth(renews)}` };

  const label =
    plan.kind === "past_due"
      ? `Premium, month ${plan.month}. Your card was declined; Stripe tries again on ${dayMonth(plan.retryOn)}, and your ${formatAud(now)} holds. Manage plan`
      : plan.kind === "ending"
        ? `Premium ends ${dayMonth(plan.endsOn)}. Keep your plan and it drops to ${formatAud(next)}. Manage plan`
        : atFloor
          ? `Premium, month ${plan.month}, ${formatAud(now)}, your lowest price. Renews ${dayMonth(renews)}. Manage plan`
          : `Premium, month ${plan.month}, ${formatAud(now)} this month, ${formatAud(next)} from ${dayMonth(renews)}. Manage plan`;

  return (
    <button type="button" onClick={onOpen} aria-label={label} className="card press block w-full p-4 text-left">
      <span className="flex items-center gap-2">
        <PremiumMark variant="chip" />
        <span className="flex-1" />
        <span className="font-display text-row tabular-nums text-stone-500">{head}</span>
        <Disclosure />
      </span>

      {plan.kind === "past_due" && (
        <span className="mt-3.5 flex items-start gap-2 text-row text-ink">
          <span className="mt-px shrink-0 text-rust">
            <IconDeclined />
          </span>
          <span className="font-display">Your card was declined. Your place and price hold.</span>
        </span>
      )}

      {/* The board: two fixed columns on one baseline. */}
      <span className="mt-3.5 flex items-end justify-between gap-4">
        <span className="block">
          <Price cents={now} className="block text-num-l la-neutral la-fg" />
          <span className="mt-1 block text-caption text-stone-500">
            {atFloor ? "Your lowest price" : plan.kind === "past_due" ? "Held for this month" : "This month"}
          </span>
        </span>
        <span className="block text-right">
          <span className="font-display la-neutral block text-num-m tabular-nums text-ink">{right.big}</span>
          <span className="mt-1 block text-caption text-stone-500">{right.small}</span>
        </span>
      </span>

      <Timeline
        className="mt-4"
        tone="neutral"
        readout="none"
        prices={false}
        plot={40}
        bleed="1rem"
        start={plan.start}
        today={today}
        mode={{
          kind: "plan",
          current: plan.month,
          ending: plan.kind === "ending",
        }}
        selected={rungOf(plan.month)}
      />

      {plan.kind === "ending" && (
        <span className="mt-3 block text-caption text-stone-500">
          Keep your plan and it drops to {formatAud(next)} on {dayMonth(renews)}.
        </span>
      )}
      {plan.kind === "active" && !atFloor && (
        <span className="mt-3 block text-caption tabular-nums text-stone-500">
          {monthsToFloor(plan.month)} months to your lowest price, {formatAud(priceForMonth(FLOOR_MONTH))} from{" "}
          {dayMonth(floorFrom)}.
        </span>
      )}
    </button>
  );
}

/** (e) Premium from an invite code: no plan, nothing to manage. */
export function CodePremiumLine() {
  return (
    <p className="flex items-center gap-2.5 text-caption text-stone-500">
      <PremiumMark variant="chip" />
      Premium is on this account.
    </p>
  );
}

/** (f) The free account's door, as You draws it today (DOOR_CLASS). */
export function FreeDoor({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      type="button"
      data-open-paywall
      onClick={onOpen}
      className="press font-display flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-3 text-left text-row"
    >
      <PremiumDoor className="text-plum-700">Premium</PremiumDoor>
      <Disclosure />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 4. The manage sheet. */

export type ManageStep = "main" | "confirm";

/**
 * Crouton's order, top-down: the tier, where you are (the timeline,
 * scrubbable), a two-row board for the next drop and the floor, then
 * the doors. Cancel is a row like the others, ink, full size, one tap;
 * the tap turns the doors into the confirm, in place, and the confirm's
 * own "Cancel plan" is the same terracotta button "Start" was. Two taps
 * in, two taps out.
 */
export function ManageSheet({
  plan,
  today,
  initialStep = "main",
  onDone,
}: {
  plan: Extract<PlanState, { kind: "active" | "ending" | "past_due" }>;
  today: Date;
  initialStep?: ManageStep;
  onDone?: () => void;
}) {
  const [kind, setKind] = useState(plan.kind);
  const [step, setStep] = useState<ManageStep>(initialStep);
  const [sel, setSel] = useState(rungOf(plan.month));
  const live = { ...plan, kind } as typeof plan;
  const now = priceForMonth(plan.month);
  const next = priceForMonth(plan.month + 1);
  const renews = monthStarts(plan.start, plan.month + 1);
  const floorFrom = monthStarts(plan.start, FLOOR_MONTH);
  const endsOn = plan.kind === "ending" ? plan.endsOn : renews;
  const atFloor = plan.month >= FLOOR_MONTH;

  // The doors and the confirm share one box whose height springs
  // between them (la-swap), so nothing under it jumps.
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (inner.current) setH(inner.current.offsetHeight);
  }, [step, kind]);

  return (
    <div className={SHEET_NEUTRAL}>
      <div aria-hidden className={GRABBER_NEUTRAL} />
      <div className="flex items-center gap-2">
        <PremiumMark variant="chip" />
        <span className="flex-1" />
        <span className="font-display text-row tabular-nums text-stone-500">
          {kind === "ending" ? `Ends ${dayMonth(endsOn)}` : `Since ${dayMonth(plan.start)}`}
        </span>
      </div>

      {kind === "past_due" && plan.kind === "past_due" && (
        <div role="status" className="mt-4">
          <p className="font-display flex items-center gap-2 text-detail">
            <span className="shrink-0 text-rust">
              <IconDeclined size={20} />
            </span>
            Your card was declined
          </p>
          <p className="mt-1 text-body text-stone-500">
            Stripe tries again on {dayMonth(plan.retryOn)}. Premium stays on and your{" "}
            {formatAud(now)} holds.
          </p>
          <button type="button" className={`${ACTION_CLASS} mt-4`}>
            Update card
          </button>
        </div>
      )}

      <Timeline
        className={kind === "past_due" ? "mt-6" : "mt-4"}
        tone="neutral"
        start={plan.start}
        today={today}
        mode={{
          kind: "plan",
          current: plan.month,
          ending: kind === "ending",
          tag: kind === "past_due" ? "Held" : undefined,
          nowLine: kind === "past_due" ? "This month, held" : undefined,
        }}
        selected={sel}
        onSelect={setSel}
      />

      {kind === "ending" ? (
        <div className="la-swap-in mt-5">
          <p className="text-body text-stone-500">
            Premium stays on until {dayMonth(endsOn)}. Keep your plan and it drops to{" "}
            <span className="font-semibold text-ink tabular-nums">{formatAud(next)}</span> that day.
          </p>
          <button
            type="button"
            onClick={() => {
              buzz(10);
              setKind("active");
              setStep("main");
            }}
            className={`${ACTION_CLASS} mt-4`}
          >
            Keep my plan
          </button>
        </div>
      ) : (
        kind === "active" && (
          /* The board (Flighty): the two dates that matter, label left,
             price and date right, one hairline between. */
          <dl className="inset-group mt-5">
            <div className="group-row flex items-center justify-between gap-3">
              <dt className="text-row font-semibold text-stone-500">{atFloor ? "Renews" : "Next price"}</dt>
              <dd className="font-display text-row tabular-nums">
                {atFloor ? dayMonth(renews) : `${formatAud(next)} from ${dayMonth(renews)}`}
              </dd>
            </div>
            <div className="group-row flex items-center justify-between gap-3">
              <dt className="text-row font-semibold text-stone-500">Lowest price</dt>
              <dd className="font-display text-row tabular-nums">
                {atFloor ? `${formatAud(now)}, yours now` : `${formatAud(priceForMonth(FLOOR_MONTH))} from ${dayMonth(floorFrom)}`}
              </dd>
            </div>
          </dl>
        )
      )}

      <div ref={box} className="la-swap mt-3" style={{ height: h }}>
        <div ref={inner}>
          {step === "confirm" ? (
            <div key="confirm" className="la-swap-in la-fill-2 rounded-card bg-surface p-4" role="group" aria-labelledby="la-cancel-head">
              <p id="la-cancel-head" className="font-display text-detail">
                Cancel your plan?
              </p>
              <p className="mt-1.5 text-body text-stone-600">
                Premium stays on until {dayMonth(endsOn)}, then the plan ends. A new plan would start
                again at {formatAud(FIRST_PRICE_CENTS)}.
              </p>
              <button
                type="button"
                onClick={() => {
                  buzz(10);
                  setKind("ending");
                  setStep("main");
                }}
                className={`${ACTION_CLASS} mt-4`}
              >
                Cancel plan
              </button>
              <button
                type="button"
                onClick={() => setStep("main")}
                className="press font-display mt-2 flex min-h-12 w-full items-center justify-center rounded-control bg-raised text-body font-bold"
              >
                Keep my plan
              </button>
            </div>
          ) : (
            <div key="doors" className="la-swap-in inset-group">
              <button type="button" className="group-row press-row flex w-full items-center gap-3 text-left">
                <span className="font-display flex-1 text-row">
                  {kind === "past_due" ? "Receipts" : "Update card and receipts"}
                </span>
                <IconOut />
              </button>
              {kind !== "ending" && (
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  aria-expanded={false}
                  className="group-row press-row flex w-full items-center gap-3 text-left"
                >
                  <span className="font-display flex-1 text-row">Cancel plan</span>
                  <Disclosure />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {step !== "confirm" && (
        <button type="button" onClick={onDone} className={`${SECONDARY_CLASS} mt-3`}>
          Done
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Settings' row. */

export function SettingsPremiumGroup({
  plan,
  onOpen,
}: {
  plan: Extract<PlanState, { kind: "active" | "ending" | "past_due" }>;
  onOpen?: () => void;
}) {
  const next = priceForMonth(plan.month + 1);
  const renews = monthStarts(plan.start, plan.month + 1);
  const note =
    plan.kind === "ending"
      ? `Premium ends ${dayMonth(plan.endsOn)}`
      : plan.kind === "past_due"
        ? `Card declined, retrying ${dayMonth(plan.retryOn)}`
        : plan.month >= FLOOR_MONTH
          ? `Month ${plan.month}, your lowest price`
          : `Month ${plan.month}, ${formatAud(next)} from ${dayMonth(renews)}`;
  return (
    <section>
      <h2 className="group-head">Premium</h2>
      <div className="inset-group">
        <button type="button" onClick={onOpen} className="group-row press-row flex w-full items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="font-display block text-row">Manage plan</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-caption tabular-nums text-stone-500">
              {plan.kind === "past_due" && (
                <span className="text-rust">
                  <IconDeclined size={14} />
                </span>
              )}
              {note}
            </span>
          </span>
          <span className="shrink-0 text-row font-normal tabular-nums text-stone-500">
            {formatAud(priceForMonth(plan.month))}
          </span>
          <Disclosure />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6, 7. The two moments. */

/**
 * One sheet for both moments: Demos beside one bubble, then the same
 * timeline the paywall showed, with you on it now. The checkout return
 * fills month 1; the monthly drop steps the selection down one rung on
 * the sheet spring while the digits roll and a sheen crosses the new
 * column, all on one frame.
 */
export function MomentSheet({
  kind,
  start,
  today,
  month,
  confirming = false,
  stepFrom,
  stepAfter = 520,
  onDone,
}: {
  kind: "welcome" | "drop";
  start: Date;
  today: Date;
  month: number;
  /** The webhook has not landed: a skeleton, never a guessed price. */
  confirming?: boolean;
  /** The drop: the rung the plan stood on before this renewal. */
  stepFrom?: number;
  stepAfter?: number;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(stepFrom ?? month);
  const [sheen, setSheen] = useState<{ month: number; delay: number; key: number } | undefined>();
  // The step lands once the sheet has: cap, digits, sheen and haptic on
  // one frame. The cleanup cancels the timer, so a development double
  // effect schedules it again rather than losing it.
  useEffect(() => {
    if (stepFrom === undefined) return;
    const t = window.setTimeout(() => {
      setShown(month);
      setSheen({ month: rungOf(month), delay: 0, key: Date.now() });
      buzz([12, 40, 18]);
    }, stepAfter);
    return () => window.clearTimeout(t);
  }, [stepFrom, month, stepAfter]);

  const nextFrom = monthStarts(start, month + 1);
  const next = priceForMonth(month + 1);
  const now = priceForMonth(month);
  const line =
    kind === "welcome"
      ? confirming
        ? "Stripe is confirming your plan. This takes a few seconds."
        : `Premium is on. Your price drops to ${formatAud(next)} on ${dayMonth(nextFrom)}.`
      : `Your price dropped to ${formatAud(now)}. Next, ${formatAud(next)} from ${dayMonth(nextFrom)}.`;

  return (
    <div className={SHEET_NEUTRAL}>
      <div aria-hidden className={GRABBER_NEUTRAL} />
      <div className="flex items-center gap-2">
        <DemosArt
          pose={confirming ? "listening" : "celebrate"}
          size={128}
          className="!mx-0"
        />
        {/* The bubble holds the longer line's height, so the confirm
            landing swaps the words and moves nothing. */}
        <SpeechBubble tail="left" className="min-w-0 flex-1">
          <span role="status" className="grid">
            <span className="col-start-1 row-start-1">{line}</span>
            <span aria-hidden className="invisible col-start-1 row-start-1">
              Premium is on. Your price drops to {formatAud(next)} on {dayMonth(nextFrom)}.
            </span>
          </span>
        </SpeechBubble>
      </div>

      <Timeline
        className="mt-5"
        tone="neutral"
        start={start}
        today={today}
        readout={confirming ? "skeleton" : "full"}
        mode={
          confirming
            ? { kind: "plan", current: 0 }
            : { kind: "plan", current: shown, nowLine: kind === "drop" && shown === month ? "From today" : undefined }
        }
        selected={confirming ? 1 : rungOf(shown)}
        step="sheet"
        rollSlow
        fillFirst={kind === "welcome" && !confirming}
        sheen={sheen}
        lead={200}
        pending="Confirming with Stripe…"
      />

      <button type="button" onClick={onDone} className={`${SECONDARY_CLASS} mt-5`}>
        Done
      </button>
    </div>
  );
}
