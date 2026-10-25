/**
 * The price ladder as the app shows it (docs/ladder-spec.md): the plan's
 * state, its calendar, and every sentence a surface says about it.
 *
 * lib/pricing.ts counts months of an unbroken plan; the server's row
 * (lib/client-data.ts `BillingRow`) says where a plan stands. This file
 * turns the two into what a person reads: real dates ("From 24 Nov"),
 * the step the Paw stands on, and the words for the paywall, You's plan
 * card, the manage sheet, Settings, the checkout return and the monthly
 * drop. Pure, so it is tested whole (lib/plan-view.test.ts), and every
 * date is computed from a `today` the caller passes after mount, never
 * on the server (the React #418 guard).
 *
 * The spec's strings are here verbatim, as functions of the data. A
 * surface never writes its own copy of one.
 */
import type { BillingRow, ProfileRow } from "./client-data";
import {
  FIRST_PRICE_CENTS,
  FLOOR_MONTH,
  FLOOR_PRICE_CENTS,
  LADDER_CENTS,
  formatAud,
  priceForMonth,
} from "./pricing";

// ---------------------------------------------------------------------
// The calendar

/** Three letters, always: en-AU's Intl writes "Sept", which breaks a
    row of seven three-letter months by one glyph. */
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Past this many days away, a date carries its year. */
export const YEAR_AFTER_DAYS = 300;

/**
 * `n` months after `from`, the way Stripe bills a monthly plan: keep the
 * anchor day and clamp it to the month's last day, then return to the
 * anchor day the month after. A plan anchored on 31 Jan renews on
 * 28 Feb, then 31 Mar. `day` is the anchor day (`from`'s own by
 * default); the result is a local calendar date at midnight.
 */
export function addMonths(from: Date, n: number, day = from.getDate()): Date {
  const y = from.getFullYear();
  const m = from.getMonth() + Math.trunc(n);
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

/**
 * Where a plan's months fall: month `month` starts on `date`, and every
 * other month is counted from there on Stripe's anchor `day`.
 */
export interface LadderCalendar {
  month: number;
  date: Date;
  day: number;
}

/** A free account's calendar: month 1 starts today. */
export function calendarFromToday(today: Date): LadderCalendar {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { month: 1, date, day: date.getDate() };
}

/**
 * A live plan's calendar: month `m + 1` starts at `current_period_end`
 * (m = `ladder_month`), so month n starts `n - m - 1` months from there.
 * Null when the row has no period end to count from.
 *
 * The row carries no billing anchor, so the anchor day is the period
 * end's own. A plan anchored on the 31st whose period ends on 28 Feb
 * projects its later months on the 28th; the next sync, on 31 Mar,
 * puts them back.
 */
export function calendarFromBilling(row: Pick<BillingRow, "ladder_month" | "current_period_end">): LadderCalendar | null {
  const end = parseDate(row.current_period_end);
  if (!end) return null;
  const date = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const paid = Math.max(0, Math.floor(Number(row.ladder_month) || 0));
  return { month: paid + 1, date, day: date.getDate() };
}

/** The day month `n` of the plan starts. */
export function monthStart(cal: LadderCalendar, n: number): Date {
  return addMonths(cal.date, n - cal.month, cal.day);
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from `today` to `d` (negative in the past). */
export function daysBetween(today: Date, d: Date): number {
  return Math.round((midnight(d) - midnight(today)) / 86_400_000);
}

const withYear = (d: Date, today: Date) => Math.abs(daysBetween(today, d)) > YEAR_AFTER_DAYS;

/** "24 Nov", or "24 Nov 2027" more than 300 days from today. */
export function shortDate(d: Date, today: Date): string {
  const s = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return withYear(d, today) ? `${s} ${d.getFullYear()}` : s;
}

/** "24 November", for a screen reader, which reads "Nov" as a word. */
export function longDate(d: Date, today: Date): string {
  const s = `${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
  return withYear(d, today) ? `${s} ${d.getFullYear()}` : s;
}

/** "Oct": the label under a step. */
export const monthName = (d: Date) => SHORT_MONTHS[d.getMonth()];

/**
 * The seven labels under the stair: each step's month ("Oct", "Nov",
 * ...), the floor's with a plus ("Apr+"). With no calendar (a plan whose
 * row has no date) the steps are counted instead: "1" to "7+".
 */
export function stepLabels(cal: LadderCalendar | null): string[] {
  return LADDER_CENTS.map((_, i) => {
    const n = i + 1;
    const base = cal ? monthName(monthStart(cal, n)) : String(n);
    return n === FLOOR_MONTH ? `${base}+` : base;
  });
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------
// The plan's state

/**
 * Every state a plan surface draws:
 * - `unknown`: a read failed or is still loading. A skeleton, never the
 *   free door and never A$0.00.
 * - `free`: no plan and no code. `ended`: a plan that ended (cancelled,
 *   or its retries ran out); it draws as free, and a new plan starts at
 *   month 1.
 * - `code`: Premium from an invite code, with no live plan.
 * - `active`: renewing, months 1 to 6. `floor`: renewing at the floor,
 *   month 7 on.
 * - `ending`: cancelled at period end. Premium runs to the end of the
 *   paid month.
 * - `pastDue`: a renewal was declined and Stripe is retrying it. Premium
 *   stays on and the month holds.
 * - `unpaid`: the retries ran out on a plan Stripe keeps open. The plan
 *   holds its month, but Premium is off.
 * - `incomplete`: the first payment is pending.
 */
export type PlanKind =
  | "unknown"
  | "free"
  | "code"
  | "active"
  | "floor"
  | "ending"
  | "pastDue"
  | "unpaid"
  | "incomplete"
  | "ended";

export interface PlanView {
  kind: PlanKind;
  /** Months paid in a row on this plan (the row's `ladder_month`); 0 with no plan. */
  month: number;
  /** The step the Paw stands on, 1 to 7. */
  step: number;
  /** This month's price. A free account's is month 1's. */
  priceCents: number;
  /** What the next renewal charges; null when the plan is ending, has ended, or there is none. */
  nextPriceCents: number | null;
  /** The end of the paid month: the next renewal, or the day Premium stops when ending. */
  periodEnd: Date | null;
  /** Null for `unknown`, and for a plan whose row has no period end. */
  calendar: LadderCalendar | null;
  /** A plan is running: it renews or is being retried (Stripe's live statuses). */
  live: boolean;
}

/** Stripe's statuses a plan surface draws as a plan; any other ends it. */
const STATUS_KIND = new Map<string, PlanKind>([
  ["active", "active"],
  ["trialing", "active"],
  ["past_due", "pastDue"],
  ["unpaid", "unpaid"],
  ["incomplete", "incomplete"],
]);

/**
 * The plan state machine, from the two reads every plan surface makes.
 * `undefined` is a read that has not landed or failed; `null` is a read
 * that answered "none". A billing row with a live status decides alone;
 * otherwise the profile says code or free, and an ended row says ended.
 * `today` places a free account's month 1.
 */
export function planView(
  profile: ProfileRow | null | undefined,
  billing: BillingRow | null | undefined,
  today: Date
): PlanView {
  if (billing === undefined) return unknownView();
  const status = billing?.status ?? null;
  const drawn = status != null ? STATUS_KIND.get(status) : undefined;

  if (billing && drawn) {
    const month = Math.max(0, Math.floor(Number(billing.ladder_month) || 0));
    // Cancelled at period end: Premium runs to the end of the paid month.
    // A plan whose card is being retried can be cancelled too, and the
    // end is the bigger fact; one Stripe has stopped retrying cannot.
    const ending = billing.cancel_at_period_end && (drawn === "active" || drawn === "pastDue");
    const kind: PlanKind = ending ? "ending" : drawn === "active" && month >= FLOOR_MONTH ? "floor" : drawn;
    const priceCents = billing.price_cents ?? priceForMonth(Math.max(1, month));
    const next =
      kind === "ending"
        ? null
        : (billing.next_price_cents ?? (kind === "incomplete" ? null : priceForMonth(month + 1)));
    return {
      kind,
      month,
      step: stepOf(month),
      priceCents,
      nextPriceCents: next,
      periodEnd: parseDate(billing.current_period_end),
      // A first payment still pending is month 1 in progress: its period
      // end is where month 2 starts, not month 1.
      calendar: calendarFromBilling(kind === "incomplete" ? { ...billing, ladder_month: Math.max(1, month) } : billing),
      live: kind !== "incomplete",
    };
  }

  if (profile === undefined) return unknownView();
  const ended = Boolean(billing && status != null);
  const kind: PlanKind = profile?.premium ? "code" : ended ? "ended" : "free";
  return {
    kind,
    month: 0,
    step: 1,
    priceCents: FIRST_PRICE_CENTS,
    nextPriceCents: null,
    periodEnd: null,
    calendar: calendarFromToday(today),
    live: false,
  };
}

function unknownView(): PlanView {
  return {
    kind: "unknown",
    month: 0,
    step: 1,
    priceCents: FIRST_PRICE_CENTS,
    nextPriceCents: null,
    periodEnd: null,
    calendar: null,
    live: false,
  };
}

/** Month n of a plan to the step it stands on, 1 to 7 (0 is step 1). */
export function stepOf(month: number): number {
  if (!Number.isFinite(month) || month < 1) return 1;
  return Math.min(Math.floor(month), FLOOR_MONTH);
}

/** The months still to go before the floor: 4 in month 3, 0 from month 7. */
export function monthsToFloor(month: number): number {
  return Math.max(0, FLOOR_MONTH - Math.max(1, Math.floor(month)));
}

/** A plan surface that draws a card (You) or a row (Settings) rather than the Premium door. */
export function hasPlan(view: PlanView): boolean {
  return ["active", "floor", "ending", "pastDue", "unpaid", "incomplete"].includes(view.kind);
}

// ---------------------------------------------------------------------
// The words. Every date is "24 Nov" on screen and "24 November" spoken;
// a plan whose row has no date falls back to words that need none.

const aud = formatAud;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The day month `n` starts, short, or null when the plan has no calendar. */
function dayOf(view: PlanView, n: number, today: Date): string | null {
  return view.calendar ? shortDate(monthStart(view.calendar, n), today) : null;
}
function spokenDayOf(view: PlanView, n: number, today: Date): string | null {
  return view.calendar ? longDate(monthStart(view.calendar, n), today) : null;
}
/** When the paid month ends: the next renewal, or the last day of Premium. */
function endOf(view: PlanView, today: Date): string | null {
  return view.periodEnd ? shortDate(view.periodEnd, today) : null;
}
function spokenEndOf(view: PlanView, today: Date): string | null {
  return view.periodEnd ? longDate(view.periodEnd, today) : null;
}
const nextCents = (view: PlanView) => view.nextPriceCents ?? priceForMonth(view.month + 1);

/** The month a plan is in, as a label: "Month 3". */
export const monthWord = (month: number) => `Month ${Math.max(1, Math.floor(month))}`;

// The paywall ----------------------------------------------------------

export const PAYWALL_COPY = {
  head: "Your price drops every month you stay",
  caption: `Renews monthly until you cancel, any time in the app. If a plan ends, the next one starts at ${aud(FIRST_PRICE_CENTS)}.`,
  start: `Start at ${aud(FIRST_PRICE_CENTS)}`,
  busy: "One moment…",
  notYet: "Not yet",
  closing: "Money never buys stars, streaks, or scores.",
  needsAccount: "A plan needs an account. Make one and you'll come straight back here.",
  createAccount: "Create an account",
  haveAccount: "I already have one",
  haveCode: "I have a code",
  codeSoon: "Checkout opens soon. Right now Premium is by invite code.",
  sliderLabel: "Your price by month",
  unlock: "Unlock",
  unlockBusy: "One moment…",
  unlockedTitle: "Unlocked.",
  unlockedLine: "Premium is on this account now.",
  codeFirst: "Do one recording first, then the code has somewhere to land.",
  codeFailed: "That didn't go through. Try again.",
} as const;

/** What the paywall's readout and slider say for step `n` of a plan starting today. */
export function paywallStep(n: number, today: Date) {
  const step = stepOf(n);
  const cal = calendarFromToday(today);
  const starts = monthStart(cal, step);
  const cents = LADDER_CENTS[step - 1];
  const floor = step === FLOOR_MONTH;
  const monthLine = floor ? `Month ${FLOOR_MONTH} on` : `Month ${step}`;
  return {
    step,
    cents,
    /** "Today", or "From 24 Jan". */
    dateLine: step === 1 ? "Today" : `From ${shortDate(starts, today)}`,
    /** "Month 1", or "Month 7 on". */
    monthLine,
    /** The slider's aria-valuetext: "Month 4, from 24 January, A$9.99". */
    valueText:
      step === 1
        ? `Month 1, today, ${aud(cents)}`
        : `${monthLine}, from ${longDate(starts, today)}, ${aud(cents)}`,
  };
}

/** The whole ladder in one sentence, read once by a screen reader. */
export function ladderSentence(): string {
  const parts = LADDER_CENTS.map((cents, i) =>
    i + 1 === FLOOR_MONTH ? `month ${FLOOR_MONTH} on ${aud(cents)}` : `month ${i + 1} ${aud(cents)}`
  );
  const s = parts.join(", ");
  return `${s[0].toUpperCase()}${s.slice(1)}.`;
}

// The stair as a picture -------------------------------------------------

/**
 * The picture's aria-label: "Month 3 of the price ladder. A$10.99 now,
 * A$9.99 from 24 November, A$6.99 from 24 February."
 */
export function pictureLabel(view: PlanView, today: Date): string {
  const head = `${monthWord(view.month)} of the price ladder.`;
  const now = aud(view.priceCents);
  switch (view.kind) {
    case "floor":
      return `${head} ${now} now, your lowest price.`;
    case "ending": {
      const end = spokenEndOf(view, today);
      return end ? `${head} ${now} now. The plan ends on ${end}.` : `${head} ${now} now. The plan ends this month.`;
    }
    case "pastDue":
      return `${head} ${now}, held while the card is retried.`;
    case "unpaid":
      return `${head} Held at ${now} until the card goes through.`;
    case "incomplete":
      return `Month 1 of the price ladder. ${aud(FIRST_PRICE_CENTS)} once the first payment goes through.`;
    case "active": {
      const nextDay = spokenDayOf(view, view.month + 1, today);
      const next = `${aud(nextCents(view))} ${nextDay ? `from ${nextDay}` : "next month"}`;
      if (view.month + 1 >= FLOOR_MONTH) return `${head} ${now} now, ${next}.`;
      const floorDay = spokenDayOf(view, FLOOR_MONTH, today);
      return `${head} ${now} now, ${next}, ${aud(FLOOR_PRICE_CENTS)} ${floorDay ? `from ${floorDay}` : `from month ${FLOOR_MONTH}`}.`;
    }
    default:
      return `The price ladder. ${aud(FIRST_PRICE_CENTS)} in month 1, down to ${aud(FLOOR_PRICE_CENTS)} from month ${FLOOR_MONTH}.`;
  }
}

// You's plan card --------------------------------------------------------

export interface CardWords {
  /** The top row's right side: "Month 3". */
  month: string;
  /** The middle row's left: a price under a caption, or a title at `detail`. */
  left: { caption: string; cents: number } | { title: string };
  /** The middle row's right, right-aligned; null at the floor and when ending or declined. */
  right: { caption: string; cents: number } | null;
  /** The caption under the stair. */
  foot: string;
  /** Draw the declined glyph (stone-500, never red) beside the title. */
  declined: boolean;
  /** The stair's future steps as dashed outlines. */
  ghostAfter: boolean;
}

/** The invite-code line, unchanged. */
export const CODE_LINE = "Premium is on this account.";

/** The checkout return's status while sync runs. */
export const SWITCHING_ON = "Switching Premium on…";

/** You's plan card, per state; null for the states that draw no card (free, ended, code, unknown). */
export function cardWords(view: PlanView, today: Date): CardWords | null {
  const month = monthWord(view.month);
  const now = { caption: "This month", cents: view.priceCents };
  switch (view.kind) {
    case "active": {
      const nextDay = dayOf(view, view.month + 1, today);
      const floorDay = dayOf(view, FLOOR_MONTH, today);
      const left = monthsToFloor(view.month);
      return {
        month,
        left: now,
        right: { caption: nextDay ? `From ${nextDay}` : "Next month", cents: nextCents(view) },
        foot: `${plural(left, "month", "months")} to your lowest price, ${aud(FLOOR_PRICE_CENTS)}${floorDay ? ` from ${floorDay}` : ""}.`,
        declined: false,
        ghostAfter: false,
      };
    }
    case "floor":
      return { month, left: now, right: null, foot: FLOOR_LINE, declined: false, ghostAfter: false };
    case "ending":
      return {
        month,
        left: { title: premiumUntil(view, today) },
        right: null,
        foot: `Keep your plan and month ${view.month + 1} is ${aud(priceForMonth(view.month + 1))}.`,
        declined: false,
        ghostAfter: true,
      };
    case "pastDue":
      return { month, left: { title: DECLINED }, right: null, foot: retriedLine(view), declined: true, ghostAfter: false };
    case "unpaid":
      return { month, left: { title: DECLINED }, right: null, foot: unpaidLine(view), declined: true, ghostAfter: false };
    case "incomplete":
      return {
        month: monthWord(1),
        left: { title: PENDING },
        right: null,
        foot: PENDING_LINE,
        declined: false,
        ghostAfter: false,
      };
    default:
      return null;
  }
}

/** "Your lowest price, every month from here." */
export const FLOOR_LINE = "Your lowest price, every month from here.";
export const DECLINED = "Card declined";
export const PENDING = "Payment pending";
export const PENDING_LINE = "Premium switches on once your first payment goes through.";

/** "Premium until 24 Nov". */
export function premiumUntil(view: PlanView, today: Date): string {
  const end = endOf(view, today);
  return end ? `Premium until ${end}` : "Premium until this month ends";
}

/** "Premium stays on while it's retried, and month 3 holds at A$10.99." */
export function retriedLine(view: PlanView): string {
  return `Premium stays on while it's retried, and month ${Math.max(1, view.month)} holds at ${aud(view.priceCents)}.`;
}

/** The retries ran out on a plan Stripe keeps open. */
export function unpaidLine(view: PlanView): string {
  return `Premium is off until the card goes through, and month ${Math.max(1, view.month)} holds at ${aud(view.priceCents)}.`;
}

// The manage sheet ------------------------------------------------------

export const MANAGE_COPY = {
  done: "Done",
  thisMonth: "this month",
  update: "Update card and receipts",
  updateCaption: "Opens Stripe, then brings you back.",
  cancel: "Cancel plan",
  confirmTitle: "Cancel your plan?",
  keep: "Keep my plan",
  busy: "One moment…",
  updateCard: "Update card",
  receipts: "Receipts",
  declined: DECLINED,
  pending: PENDING,
  manage: "Manage plan",
} as const;

/** "Month 3. A$9.99 from 24 Nov." under the amount; the floor says so. */
export function manageLine(view: PlanView, today: Date): string {
  const month = monthWord(view.month);
  if (view.kind === "floor") return `${month}. ${FLOOR_LINE}`;
  const nextDay = dayOf(view, view.month + 1, today);
  return `${month}. ${aud(nextCents(view))} ${nextDay ? `from ${nextDay}` : "next month"}.`;
}

/** The confirm's body: "Premium runs to 24 Nov. If the plan ends, the next one starts at A$12.99." */
export function confirmBody(view: PlanView, today: Date): string {
  return `${runsTo(view, today)} If the plan ends, the next one starts at ${aud(FIRST_PRICE_CENTS)}.`;
}

/** "Cancelled. Premium runs to 24 Nov." */
export function cancelledStatus(view: PlanView, today: Date): string {
  return `Cancelled. ${runsTo(view, today)}`;
}

function runsTo(view: PlanView, today: Date): string {
  const end = endOf(view, today);
  return end ? `Premium runs to ${end}.` : "Premium runs to the end of this month.";
}

/** The ending sheet's title: "Premium until 24 Nov". */
export const endingTitle = premiumUntil;

/** "Then the plan ends. Keep it and month 4 is A$9.99." */
export function endingBody(view: PlanView): string {
  return `Then the plan ends. Keep it and month ${view.month + 1} is ${aud(priceForMonth(view.month + 1))}.`;
}

/** After resume: "You're staying. Month 4 is A$9.99 from 24 Nov." */
export function resumedStatus(view: PlanView, today: Date): string {
  const next = view.month + 1;
  const day = view.periodEnd ? shortDate(view.periodEnd, today) : dayOf(view, next, today);
  return `You're staying. Month ${next} is ${aud(view.nextPriceCents ?? priceForMonth(next))}${day ? ` from ${day}` : ""}.`;
}

// Settings ---------------------------------------------------------------

/** The secondary line on Settings' "Manage plan" row; null when there is no row. */
export function settingsLine(view: PlanView, today: Date): string | null {
  const month = monthWord(view.month);
  switch (view.kind) {
    case "active": {
      const day = dayOf(view, view.month + 1, today);
      return `${month}, ${aud(nextCents(view))} ${day ? `from ${day}` : "next month"}`;
    }
    case "floor":
      return `${month}, ${aud(view.priceCents)}`;
    case "ending": {
      const end = endOf(view, today);
      return end ? `Ends ${end}` : "Ends this month";
    }
    case "pastDue":
    case "unpaid":
      return DECLINED;
    case "incomplete":
      return PENDING;
    default:
      return null;
  }
}

// The checkout return ------------------------------------------------------

export const CHECKOUT_COPY = {
  switching: SWITCHING_ON,
  on: "Premium is on. This is your first step.",
  slow: "Your payment went through. Premium can take a minute to show here.",
} as const;

/** Under the sm stair: "Month 1 A$12.99" left, "From 24 Nov A$11.99" right. */
export function checkoutReturnWords(view: PlanView, today: Date) {
  const month = Math.max(1, view.month);
  const day = dayOf(view, month + 1, today);
  return {
    left: { caption: monthWord(month), cents: view.priceCents },
    right:
      view.kind === "floor" || view.kind === "ending"
        ? null
        : { caption: day ? `From ${day}` : "Next month", cents: nextCents(view) },
  };
}

// The price-drop moment -----------------------------------------------------

/** Where this device keeps the last ladder month it celebrated. */
export const LADDER_SEEN_KEY = "ethos.ladder.seen";

/** The checkout return stores this, so month 1 is never a drop. */
export const CHECKOUT_SEEN_MONTH = 1;

/**
 * Whether the drop sheet shows, and what to store (null: leave the key).
 * It shows once, when a live plan's month is past the last one this
 * device saw and its price really fell (month 2 to 7; past the floor the
 * price holds, so the month is stored silently). First sight stores
 * silently, and so does a month that went down (a new plan).
 */
export function dropDecision(view: PlanView, seen: number | null): { show: boolean; store: number | null } {
  if (!view.live || view.month < 1) return { show: false, store: null };
  const month = view.month;
  if (seen === null || !Number.isFinite(seen)) return { show: false, store: month };
  if (month < seen) return { show: false, store: month };
  if (month === seen) return { show: false, store: null };
  const fell = month >= 2 && priceForMonth(month) < priceForMonth(seen);
  return { show: fell, store: month };
}

/** Reads the stored month; any junk or a blocked storage reads as first sight. */
export function parseSeen(raw: string | null): number | null {
  // Blank is not zero: Number("") is 0, which would celebrate any month.
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** The drop sheet's words: the bubble, the caption under the readout, and the roll. */
export function dropWords(view: PlanView, today: Date) {
  const month = Math.max(1, view.month);
  const started = view.calendar ? monthStart(view.calendar, month) : null;
  const bubble =
    !started || daysBetween(today, started) >= 0
      ? `Your price dropped. Month ${month} starts today.`
      : `Your price dropped. Month ${month} started on ${shortDate(started, today)}.`;
  let caption: string;
  if (view.kind === "ending") caption = `${runsTo(view, today)}`;
  else if (month >= FLOOR_MONTH) caption = FLOOR_LINE;
  else {
    const day = dayOf(view, month + 1, today);
    caption = `${aud(nextCents(view))} ${day ? `from ${day}` : "next month"}.`;
  }
  return {
    bubble,
    caption,
    fromCents: priceForMonth(Math.max(1, month - 1)),
    toCents: view.priceCents,
    /** The stage's hop: from the step before to this one. */
    hop: { from: stepOf(month - 1), to: stepOf(month) },
  };
}
