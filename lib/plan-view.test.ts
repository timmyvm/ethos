import { describe, expect, it } from "vitest";
import type { BillingRow, ProfileRow } from "./client-data";
import {
  CHECKOUT_COPY,
  CODE_LINE,
  DELETE_ANY_PLAN,
  MANAGE_COPY,
  PAYWALL_COPY,
  addMonths,
  calendarFromBilling,
  calendarFromToday,
  cancelledStatus,
  cardWords,
  checkoutReturnWords,
  confirmBody,
  daysBetween,
  deletePlanLine,
  dropDecision,
  dropWords,
  endingBody,
  endingTitle,
  hasPlan,
  heldPlan,
  ladderSentence,
  longDate,
  manageLine,
  monthStart,
  monthsToFloor,
  parseSeen,
  paywallStep,
  pictureLabel,
  planView,
  resumedStatus,
  settingsLine,
  shortDate,
  stepLabels,
  stepOf,
  type PlanView,
} from "./plan-view";

/**
 * The plan view: the calendar, the state machine and every sentence, on
 * a fixed clock. Today is Sunday 25 October 2026 in local time; the
 * rows say what lib/billing.ts writes (price and next price from the
 * ladder, the period end as an ISO timestamp).
 */
const TODAY = new Date(2026, 9, 25, 9, 30);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const iso = (y: number, m: number, day: number, h = 14) => new Date(y, m - 1, day, h, 12).toISOString();

const FREE_PROFILE: ProfileRow = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: null };
const PAID_PROFILE: ProfileRow = { ...FREE_PROFILE, premium: true, premium_until: iso(2026, 11, 27) };

function row(over: Partial<BillingRow> = {}): BillingRow {
  return {
    status: "active",
    ladder_month: 3,
    price_cents: 1099,
    next_price_cents: 999,
    current_period_end: iso(2026, 11, 24),
    cancel_at_period_end: false,
    ...over,
  };
}

const ROWS = {
  active3: row(),
  floor: row({ ladder_month: 9, price_cents: 699, next_price_cents: 699 }),
  ending: row({ cancel_at_period_end: true, next_price_cents: null }),
  pastDue: row({ status: "past_due" }),
  unpaid: row({ status: "unpaid" }),
  incomplete: row({ status: "incomplete", ladder_month: 0, price_cents: null, next_price_cents: null }),
  ended: row({ status: "canceled", next_price_cents: null }),
} satisfies Record<string, BillingRow>;

const view = (billing: BillingRow | null | undefined, profile: ProfileRow | null | undefined = PAID_PROFILE) =>
  planView(profile, billing, TODAY);

describe("the calendar", () => {
  it("adds months the way Stripe bills: the anchor day, clamped, then back", () => {
    const jan31 = d(2027, 1, 31);
    expect(addMonths(jan31, 1)).toEqual(d(2027, 2, 28));
    expect(addMonths(jan31, 2)).toEqual(d(2027, 3, 31));
    expect(addMonths(jan31, 3)).toEqual(d(2027, 4, 30));
    // A leap year keeps the 29th.
    expect(addMonths(d(2028, 1, 31), 1)).toEqual(d(2028, 2, 29));
    // Across the year, and backwards.
    expect(addMonths(d(2026, 10, 24), 6)).toEqual(d(2027, 4, 24));
    expect(addMonths(d(2026, 3, 31), -1)).toEqual(d(2026, 2, 28));
  });

  it("starts a free account's month 1 today: 31 Jan, 28 Feb, 31 Mar", () => {
    const cal = calendarFromToday(new Date(2027, 0, 31, 22, 5));
    expect(monthStart(cal, 1)).toEqual(d(2027, 1, 31));
    expect(monthStart(cal, 2)).toEqual(d(2027, 2, 28));
    expect(monthStart(cal, 3)).toEqual(d(2027, 3, 31));
    expect(monthStart(cal, 7)).toEqual(d(2027, 7, 31));
  });

  it("puts a live plan's month m + 1 at the period end, and counts the rest from there", () => {
    const cal = calendarFromBilling(ROWS.active3)!;
    expect(cal.month).toBe(4);
    expect(monthStart(cal, 4)).toEqual(d(2026, 11, 24));
    expect(monthStart(cal, 3)).toEqual(d(2026, 10, 24));
    expect(monthStart(cal, 1)).toEqual(d(2026, 8, 24));
    expect(monthStart(cal, 7)).toEqual(d(2027, 2, 24));
  });

  it("has no calendar for a row with no period end, or a broken one", () => {
    expect(calendarFromBilling(row({ current_period_end: null }))).toBeNull();
    expect(calendarFromBilling(row({ current_period_end: "not a date" }))).toBeNull();
  });

  it("labels each step with its month, the floor with a plus, or counts them with no date", () => {
    expect(stepLabels(calendarFromToday(TODAY))).toEqual(["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr+"]);
    expect(stepLabels(calendarFromBilling(ROWS.active3))).toEqual(["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb+"]);
    expect(stepLabels(null)).toEqual(["1", "2", "3", "4", "5", "6", "7+"]);
    // Never "Sept".
    expect(stepLabels(calendarFromToday(d(2026, 9, 1)))[0]).toBe("Sep");
  });

  it("writes 24 Nov, and adds the year past 300 days either way", () => {
    expect(shortDate(d(2026, 11, 24), TODAY)).toBe("24 Nov");
    expect(longDate(d(2026, 11, 24), TODAY)).toBe("24 November");
    expect(daysBetween(TODAY, d(2027, 8, 21))).toBe(300);
    expect(shortDate(d(2027, 8, 21), TODAY)).toBe("21 Aug");
    expect(shortDate(d(2027, 8, 22), TODAY)).toBe("22 Aug 2027");
    expect(longDate(d(2027, 8, 22), TODAY)).toBe("22 August 2027");
    expect(shortDate(d(2025, 12, 1), TODAY)).toBe("1 Dec 2025");
  });

  it("counts calendar days, not 24-hour blocks, across a daylight-saving change", () => {
    // Melbourne's clocks go forward on 4 Oct 2026; days still count whole.
    expect(daysBetween(new Date(2026, 9, 3, 23, 0), new Date(2026, 9, 5, 0, 30))).toBe(2);
  });
});

describe("the plan state machine", () => {
  it("reads every state from the profile and the billing row", () => {
    expect(view(undefined).kind).toBe("unknown");
    expect(planView(undefined, null, TODAY).kind).toBe("unknown");
    expect(view(null, FREE_PROFILE).kind).toBe("free");
    expect(view(null, null).kind).toBe("free");
    expect(view(null, PAID_PROFILE).kind).toBe("code");
    expect(view(ROWS.active3).kind).toBe("active");
    expect(view(ROWS.floor).kind).toBe("floor");
    expect(view(ROWS.ending).kind).toBe("ending");
    expect(view(ROWS.pastDue).kind).toBe("pastDue");
    expect(view(ROWS.unpaid, FREE_PROFILE).kind).toBe("unpaid");
    expect(view(ROWS.incomplete, FREE_PROFILE).kind).toBe("incomplete");
    expect(view(ROWS.ended, FREE_PROFILE).kind).toBe("ended");
    expect(view(row({ status: "trialing", ladder_month: 0 })).kind).toBe("active");
  });

  it("lets a live row decide even while the profile read is out", () => {
    expect(planView(undefined, ROWS.active3, TODAY).kind).toBe("active");
    expect(planView(undefined, ROWS.ended, TODAY).kind).toBe("unknown");
  });

  it("says code for an invite code beside an ended plan, and free for a row that never started", () => {
    expect(view(ROWS.ended, PAID_PROFILE).kind).toBe("code");
    expect(view(row({ status: null, ladder_month: 0 }), FREE_PROFILE).kind).toBe("free");
    expect(view(row({ status: "incomplete_expired" }), FREE_PROFILE).kind).toBe("ended");
    expect(view(row({ status: "paused" }), FREE_PROFILE).kind).toBe("ended");
    // A status that happens to name an Object method is not a plan.
    expect(view(row({ status: "constructor" }), FREE_PROFILE).kind).toBe("ended");
  });

  it("puts the floor at month 7, and an ending plan's end before its floor", () => {
    expect(view(row({ ladder_month: 6 })).kind).toBe("active");
    expect(view(row({ ladder_month: 7, price_cents: 699, next_price_cents: 699 })).kind).toBe("floor");
    expect(view(row({ ladder_month: 9, cancel_at_period_end: true })).kind).toBe("ending");
    expect(view(row({ status: "past_due", cancel_at_period_end: true })).kind).toBe("ending");
    expect(view(row({ status: "unpaid", cancel_at_period_end: true }), FREE_PROFILE).kind).toBe("unpaid");
  });

  it("carries the row's prices, and no next price for an ending plan", () => {
    const a = view(ROWS.active3);
    expect([a.month, a.step, a.priceCents, a.nextPriceCents, a.live]).toEqual([3, 3, 1099, 999, true]);
    const e = view(ROWS.ending);
    expect([e.priceCents, e.nextPriceCents]).toEqual([1099, null]);
    const f = view(ROWS.floor);
    expect([f.step, f.priceCents, f.nextPriceCents]).toEqual([7, 699, 699]);
    // What the server says it will charge beats the ladder.
    expect(view(row({ next_price_cents: 1099 })).nextPriceCents).toBe(1099);
    const i = view(ROWS.incomplete, FREE_PROFILE);
    expect([i.month, i.step, i.priceCents, i.nextPriceCents, i.live]).toEqual([0, 1, 1299, null, false]);
    // Pending is month 1 in progress: its period end starts month 2, so month 1 is labelled now.
    expect(stepLabels(i.calendar).slice(0, 2)).toEqual(["Oct", "Nov"]);
  });

  it("never draws unknown as free or as zero", () => {
    const u = view(undefined);
    expect(u.priceCents).toBeGreaterThan(0);
    expect(u.calendar).toBeNull();
    expect(hasPlan(u)).toBe(false);
    expect(cardWords(u, TODAY)).toBeNull();
  });

  it("counts the months to the floor and the step of any month", () => {
    expect([1, 3, 6, 7, 12].map(monthsToFloor)).toEqual([6, 4, 1, 0, 0]);
    expect([0, 1, 3, 7, 40, Number.NaN].map(stepOf)).toEqual([1, 1, 3, 7, 7, 1]);
  });

  it("knows which states draw a plan", () => {
    expect(["active3", "floor", "ending", "pastDue", "unpaid", "incomplete"].every((k) =>
      hasPlan(view(ROWS[k as keyof typeof ROWS], FREE_PROFILE))
    )).toBe(true);
    expect(hasPlan(view(ROWS.ended, FREE_PROFILE))).toBe(false);
    expect(hasPlan(view(null, PAID_PROFILE))).toBe(false);
  });
});

describe("the paywall's words", () => {
  it("reads each step today, with its date and its spoken value", () => {
    expect(paywallStep(1, TODAY)).toMatchObject({
      cents: 1299,
      dateLine: "Today",
      monthLine: "Month 1",
      valueText: "Month 1, today, A$12.99",
    });
    expect(paywallStep(4, TODAY)).toMatchObject({
      cents: 999,
      dateLine: "From 25 Jan",
      monthLine: "Month 4",
      valueText: "Month 4, from 25 January, A$9.99",
    });
    expect(paywallStep(7, TODAY)).toMatchObject({
      cents: 699,
      dateLine: "From 25 Apr",
      monthLine: "Month 7 on",
      valueText: "Month 7 on, from 25 April, A$6.99",
    });
  });

  it("says the whole ladder once", () => {
    expect(ladderSentence()).toBe(
      "Month 1 A$12.99, month 2 A$11.99, month 3 A$10.99, month 4 A$9.99, month 5 A$8.99, month 6 A$7.99, month 7 on A$6.99."
    );
  });

  it("keeps the spec's lines", () => {
    expect(PAYWALL_COPY.start).toBe("Start at A$12.99");
    expect(PAYWALL_COPY.caption).toBe(
      "Renews monthly until you cancel, any time in the app. If a plan ends, the next one starts at A$12.99."
    );
  });
});

describe("You, the manage sheet and Settings, per state", () => {
  it("active, month 3", () => {
    const v = view(ROWS.active3);
    expect(cardWords(v, TODAY)).toEqual({
      month: "Month 3",
      left: { caption: "This month", cents: 1099 },
      right: { caption: "From 24 Nov", cents: 999 },
      foot: "4 months to your lowest price, A$6.99 from 24 Feb.",
      declined: false,
      ghostAfter: false,
    });
    expect(manageLine(v, TODAY)).toBe("Month 3. A$9.99 from 24 Nov.");
    expect(confirmBody(v, TODAY)).toBe("Premium runs to 24 Nov. If the plan ends, the next one starts at A$12.99.");
    expect(cancelledStatus(v, TODAY)).toBe("Cancelled. Premium runs to 24 Nov.");
    expect(settingsLine(v, TODAY)).toBe("Month 3, A$9.99 from 24 Nov");
    expect(pictureLabel(v, TODAY)).toBe(
      "Month 3 of the price ladder. A$10.99 now, A$9.99 from 24 November, A$6.99 from 24 February."
    );
  });

  it("month 6 says one month, and its picture names the floor once", () => {
    const v = view(row({ ladder_month: 6, price_cents: 799, next_price_cents: 699 }));
    expect(cardWords(v, TODAY)!.foot).toBe("1 month to your lowest price, A$6.99 from 24 Nov.");
    expect(pictureLabel(v, TODAY)).toBe("Month 6 of the price ladder. A$7.99 now, A$6.99 from 24 November.");
  });

  it("the floor", () => {
    const v = view(ROWS.floor);
    expect(cardWords(v, TODAY)).toMatchObject({
      month: "Month 9",
      left: { caption: "This month", cents: 699 },
      right: null,
      foot: "Your lowest price, every month from here.",
    });
    expect(settingsLine(v, TODAY)).toBe("Month 9, A$6.99");
    expect(manageLine(v, TODAY)).toBe("Month 9. Your lowest price, every month from here.");
    expect(pictureLabel(v, TODAY)).toBe("Month 9 of the price ladder. A$6.99 now, your lowest price.");
  });

  it("ending", () => {
    const v = view(ROWS.ending);
    expect(cardWords(v, TODAY)).toMatchObject({
      left: { title: "Premium until 24 Nov" },
      right: null,
      foot: "Keep your plan and month 4 is A$9.99.",
      ghostAfter: true,
    });
    expect(endingTitle(v, TODAY)).toBe("Premium until 24 Nov");
    expect(endingBody(v, TODAY)).toBe("Then the plan ends. Keep it and month 4 is A$9.99.");
    expect(settingsLine(v, TODAY)).toBe("Ends 24 Nov");
    expect(pictureLabel(v, TODAY)).toBe("Month 3 of the price ladder. A$10.99 now. The plan ends on 24 November.");
    // After resume the row has its next price back.
    expect(resumedStatus(view(ROWS.active3), TODAY)).toBe("You're staying. Month 4 is A$9.99 from 24 Nov.");
  });

  it("past due", () => {
    const v = view(ROWS.pastDue);
    expect([v.declined, v.cancelling]).toEqual([true, false]);
    // The declined renewal is month 4's, and that is the amount being retried.
    expect(cardWords(v, TODAY)).toMatchObject({
      left: { title: "Card declined" },
      right: null,
      foot: "Premium stays on while month 4's A$9.99 is retried.",
      declined: true,
      ghostAfter: false,
    });
    expect(settingsLine(v, TODAY)).toBe("Card declined");
    expect(pictureLabel(v, TODAY)).toBe("Month 3 of the price ladder. Month 4's A$9.99 is being retried.");
    expect(MANAGE_COPY.updateCard).toBe("Update card");
  });

  it("past due says, before the confirm, that a cancel ends the plan now and the declined charge with it", () => {
    // lib/billing.ts cancelPlan cancels a declined plan at once and voids
    // the renewal Stripe was retrying, so Premium ends now too: it was
    // only on while the retries ran.
    const v = view(ROWS.pastDue);
    expect(confirmBody(v, TODAY)).toBe(
      "Your plan ends now, and the declined charge is cancelled. The next one starts at A$12.99."
    );
    // The cancel answers the ended row.
    const after = view(row({ status: "canceled", next_price_cents: null }), FREE_PROFILE);
    expect(after.kind).toBe("ended");
    expect(cancelledStatus(after, TODAY)).toBe("Cancelled. The declined charge won't be taken.");
    expect(cancelledStatus(after, TODAY)).not.toMatch(/Premium runs to/);
  });

  it("past due set to end elsewhere keeps the decline in sight", () => {
    // Set to end at the period's end in Stripe's portal, or by the app
    // before a declined plan's cancel ended it at once.
    const after = view(row({ status: "past_due", cancel_at_period_end: true, next_price_cents: null }));
    expect([after.kind, after.declined, after.cancelling]).toEqual(["ending", true, true]);
    expect(cardWords(after, TODAY)).toMatchObject({
      left: { title: "Card declined" },
      foot: "The plan is set to end. Premium runs to 24 Nov if month 4's A$9.99 goes through.",
      declined: true,
      ghostAfter: true,
    });
    expect(endingBody(after, TODAY)).toBe("The plan is set to end. Premium runs to 24 Nov if month 4's A$9.99 goes through.");
    expect(settingsLine(after, TODAY)).toBe("Card declined, set to end");
    expect(pictureLabel(after, TODAY)).toBe(
      "Month 3 of the price ladder. Month 4's A$9.99 is being retried, and the plan is set to end."
    );
    // Kept: the row goes back to past due, and the retry is still the news.
    expect(resumedStatus(view(ROWS.pastDue), TODAY)).toBe("You're staying. Month 4's A$9.99 is still being retried.");
  });

  it("past due counts its months from the renewal Stripe already rolled into", () => {
    // Stripe opens the next period when it invoices, paid or not: on a
    // declined renewal the period end is where month m + 2 starts.
    const v = view(ROWS.pastDue);
    expect(stepLabels(v.calendar)).toEqual(["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan+"]);
    expect(monthStart(v.calendar!, 4)).toEqual(d(2026, 10, 24));
    // The same subscription once the retry lands: month 4 paid, same period end, same labels.
    expect(stepLabels(view(row({ ladder_month: 4, price_cents: 999, next_price_cents: 899 })).calendar)).toEqual(
      stepLabels(v.calendar)
    );
    // Cancelled while declined: the same calendar.
    expect(stepLabels(view(row({ status: "past_due", cancel_at_period_end: true, next_price_cents: null })).calendar)).toEqual(
      stepLabels(v.calendar)
    );
    // Unpaid: Stripe keeps rolling periods nobody pays for, so no date is
    // sure. The steps are counted instead.
    expect(stepLabels(view(ROWS.unpaid, FREE_PROFILE).calendar)).toEqual(["1", "2", "3", "4", "5", "6", "7+"]);
  });

  it("unpaid never says Premium runs on, and its cancel ends the plan now with the declined charge", () => {
    const u = view(ROWS.unpaid, FREE_PROFILE);
    expect([u.declined, u.cancelling]).toEqual([true, false]);
    expect(confirmBody(u, TODAY)).toBe(
      "Your plan ends now, and the declined charge is cancelled. The next one starts at A$12.99."
    );
    const ended = view(row({ status: "canceled", next_price_cents: null }), FREE_PROFILE);
    expect(cancelledStatus(ended, TODAY)).toBe("Cancelled. The declined charge won't be taken.");
    // One set to end elsewhere (the portal) is drawn with no cancel offered again.
    const after = view(row({ status: "unpaid", cancel_at_period_end: true, next_price_cents: null }), FREE_PROFILE);
    expect([after.kind, after.declined, after.cancelling]).toEqual(["unpaid", true, true]);
    expect(cancelledStatus(after, TODAY)).toBe("Cancelled. The plan ends on 24 Nov.");
    expect(cardWords(after, TODAY)).toMatchObject({
      left: { title: "Card declined" },
      foot: "Premium is off until month 4's A$9.99 goes through, and the plan ends on 24 Nov.",
      declined: true,
      ghostAfter: true,
    });
    expect(settingsLine(after, TODAY)).toBe("Card declined, ends 24 Nov");
    expect(pictureLabel(after, TODAY)).toBe(
      "Month 3 of the price ladder. Premium is off until month 4's A$9.99 goes through. The plan ends on 24 November."
    );
    expect(resumedStatus(u, TODAY)).toBe("You're staying. Premium switches back on once month 4's A$9.99 goes through.");
    for (const s of [confirmBody(u, TODAY), cancelledStatus(ended, TODAY), cancelledStatus(after, TODAY), resumedStatus(u, TODAY)]) {
      expect(s).not.toMatch(/Premium runs to/);
    }
  });

  it("unpaid and incomplete have words of their own", () => {
    const u = view(ROWS.unpaid, FREE_PROFILE);
    expect(cardWords(u, TODAY)!.foot).toBe("Premium is off until month 4's A$9.99 goes through.");
    const i = view(ROWS.incomplete, FREE_PROFILE);
    expect(cardWords(i, TODAY)).toMatchObject({ month: "Month 1", left: { title: "Payment pending" } });
    expect(settingsLine(i, TODAY)).toBe("Payment pending");
  });

  it("free, code, ended and unknown draw no card and no Settings row", () => {
    for (const v of [view(null, FREE_PROFILE), view(null, PAID_PROFILE), view(ROWS.ended, FREE_PROFILE), view(undefined)]) {
      expect(cardWords(v, TODAY)).toBeNull();
      expect(settingsLine(v, TODAY)).toBeNull();
    }
    expect(CODE_LINE).toBe("Premium is on this account.");
  });

  it("a null period end still says something true", () => {
    const active = view(row({ current_period_end: null }));
    expect(active.calendar).toBeNull();
    expect(cardWords(active, TODAY)).toMatchObject({
      right: { caption: "Next month", cents: 999 },
      foot: "4 months to your lowest price, A$6.99.",
    });
    expect(manageLine(active, TODAY)).toBe("Month 3. A$9.99 next month.");
    expect(settingsLine(active, TODAY)).toBe("Month 3, A$9.99 next month");
    expect(pictureLabel(active, TODAY)).toBe(
      "Month 3 of the price ladder. A$10.99 now, A$9.99 next month, A$6.99 from month 7."
    );
    const ending = view(row({ current_period_end: null, cancel_at_period_end: true, next_price_cents: null }));
    expect(endingTitle(ending, TODAY)).toBe("Premium until this month ends");
    expect(confirmBody(ending, TODAY)).toBe(
      "Premium runs to the end of this month. If the plan ends, the next one starts at A$12.99."
    );
    expect(settingsLine(ending, TODAY)).toBe("Ends this month");
    expect(resumedStatus(view(row({ current_period_end: null })), TODAY)).toBe("You're staying. Month 4 is A$9.99.");
  });
});

describe("the paywall over a plan that is held", () => {
  it("knows the accounts whose Start would only open the portal: unpaid, or a first payment pending", () => {
    expect(heldPlan(view(ROWS.unpaid, FREE_PROFILE))).toBe(true);
    expect(heldPlan(view(ROWS.incomplete, FREE_PROFILE))).toBe(true);
    for (const r of [ROWS.active3, ROWS.floor, ROWS.ending, ROWS.pastDue, ROWS.ended]) {
      expect(heldPlan(view(r, FREE_PROFILE))).toBe(false);
    }
    expect(heldPlan(view(null, FREE_PROFILE))).toBe(false);
    expect(heldPlan(view(undefined))).toBe(false);
  });

  it("says why the tap opens Stripe's card page, never a second plan", () => {
    expect(PAYWALL_COPY.heldOpening).toBe("You already have a plan. Opening its card and receipts…");
    expect(PAYWALL_COPY.updateCard).toBe("Update card");
  });
});

describe("deleting the account", () => {
  it("says, before the confirm, that a live plan ends now with no refund for the rest of the month", () => {
    expect(deletePlanLine(view(ROWS.active3), TODAY)).toBe("Your plan ends now too, with no refund for the days left to 24 Nov.");
    expect(deletePlanLine(view(ROWS.floor), TODAY)).toBe("Your plan ends now too, with no refund for the days left to 24 Nov.");
    // Already set to end: it ends sooner, and those days are not refunded either.
    expect(deletePlanLine(view(ROWS.ending), TODAY)).toBe("Your plan ends now too, with no refund for the days left to 24 Nov.");
    expect(deletePlanLine(view(row({ current_period_end: null })), TODAY)).toBe(
      "Your plan ends now too, with no refund for the rest of this month."
    );
  });

  it("has no paid days to speak of on a declined or pending plan: the charge left open is closed", () => {
    expect(deletePlanLine(view(ROWS.pastDue), TODAY)).toBe("Your plan ends now too, and the declined A$9.99 is never charged.");
    expect(deletePlanLine(view(ROWS.unpaid, FREE_PROFILE), TODAY)).toBe(
      "Your plan ends now too, and the declined A$9.99 is never charged."
    );
    expect(deletePlanLine(view(row({ status: "past_due", cancel_at_period_end: true, next_price_cents: null })), TODAY)).toBe(
      "Your plan ends now too, and the declined A$9.99 is never charged."
    );
    expect(deletePlanLine(view(ROWS.incomplete, FREE_PROFILE), TODAY)).toBe(
      "Your plan ends now too, and its first payment is never taken."
    );
  });

  it("says nothing about a plan there is not", () => {
    for (const v of [view(null, FREE_PROFILE), view(null, PAID_PROFILE), view(ROWS.ended, FREE_PROFILE), view(undefined)]) {
      expect(deletePlanLine(v, TODAY)).toBeNull();
    }
  });
});

describe("the checkout return and the price drop", () => {
  it("says month 1 and the next step", () => {
    const v = view(row({ ladder_month: 1, price_cents: 1299, next_price_cents: 1199 }));
    expect(checkoutReturnWords(v, TODAY)).toEqual({
      left: { caption: "Month 1", cents: 1299 },
      right: { caption: "From 24 Nov", cents: 1199 },
    });
    expect(CHECKOUT_COPY.on).toBe("Premium is on. This is your first step.");
  });

  it("celebrates once per new month, never on first sight, never for month 1, never past the floor", () => {
    const at = (m: number) => view(row({ ladder_month: m, price_cents: null, next_price_cents: null }));
    expect(dropDecision(at(4), null)).toEqual({ show: false, store: 4, from: null });
    expect(dropDecision(at(4), 3)).toEqual({ show: true, store: 4, from: 3 });
    expect(dropDecision(at(4), 4)).toEqual({ show: false, store: null, from: null });
    expect(dropDecision(at(1), 1)).toEqual({ show: false, store: null, from: null });
    expect(dropDecision(at(2), 1)).toEqual({ show: true, store: 2, from: 1 });
    // A new plan went back down: stored, not celebrated.
    expect(dropDecision(at(1), 5)).toEqual({ show: false, store: 1, from: null });
    // Past the floor the price holds.
    expect(dropDecision(at(8), 7)).toEqual({ show: false, store: 8, from: null });
    expect(dropDecision(at(7), 6)).toEqual({ show: true, store: 7, from: 6 });
    // Months this device never saw: the drop is from the last one it did.
    expect(dropDecision(at(9), 5)).toEqual({ show: true, store: 9, from: 5 });
    // Nothing for a plan that is not live, or a free account.
    expect(dropDecision(view(ROWS.incomplete, FREE_PROFILE), 0)).toEqual({ show: false, store: null, from: null });
    expect(dropDecision(view(null, FREE_PROFILE), null)).toEqual({ show: false, store: null, from: null });
  });

  it("reads the stored month defensively", () => {
    expect([parseSeen(null), parseSeen("3"), parseSeen("x"), parseSeen("-1"), parseSeen("2.5")]).toEqual([
      null, 3, null, null, null,
    ]);
    // Blank storage is first sight, never month 0 (which any month would beat).
    expect([parseSeen(""), parseSeen("  ")]).toEqual([null, null]);
  });

  it("says the drop on the day it lands, and the day it started after that", () => {
    // Month 4 started today, 25 Oct: the period end is 25 Nov.
    const today = view(row({ ladder_month: 4, price_cents: 999, next_price_cents: 899, current_period_end: iso(2026, 11, 25) }));
    expect(dropWords(today, TODAY)).toEqual({
      bubble: "Your price dropped. Month 4 starts today.",
      caption: "A$8.99 from 25 Nov.",
      fromCents: 1099,
      toCents: 999,
      hop: { from: 3, to: 4 },
    });
    const late = view(row({ ladder_month: 4, price_cents: 999, next_price_cents: 899 }));
    expect(dropWords(late, TODAY).bubble).toBe("Your price dropped. Month 4 started on 24 Oct.");
    const floor = view(row({ ladder_month: 7, price_cents: 699, next_price_cents: 699, current_period_end: iso(2026, 11, 25) }));
    expect(dropWords(floor, TODAY)).toMatchObject({
      caption: "Your lowest price, every month from here.",
      hop: { from: 6, to: 7 },
    });
  });

  it("rolls from the price this device last saw, so a skipped month still shows its drop", () => {
    const at = (m: number) =>
      view(row({ ladder_month: m, price_cents: null, next_price_cents: null, current_period_end: iso(2026, 11, 25) }));
    // Last seen in month 5, back in month 9: A$8.99 down to the floor, step 5 to 7.
    expect(dropWords(at(9), TODAY, 5)).toMatchObject({ fromCents: 899, toCents: 699, hop: { from: 5, to: 7 } });
    expect(dropWords(at(8), TODAY, 6)).toMatchObject({ fromCents: 799, toCents: 699, hop: { from: 6, to: 7 } });
    expect(dropWords(at(5), TODAY, 3)).toMatchObject({ fromCents: 1099, toCents: 899, hop: { from: 3, to: 5 } });
    // No baseline, or a nonsense one: the month before.
    expect(dropWords(at(5), TODAY)).toMatchObject({ fromCents: 999, hop: { from: 4, to: 5 } });
    expect(dropWords(at(5), TODAY, 9)).toMatchObject({ fromCents: 999, hop: { from: 4, to: 5 } });
  });
});

describe("every string", () => {
  const states: PlanView[] = [
    ...Object.values(ROWS).map((r) => view(r, FREE_PROFILE)),
    ...Object.values(ROWS).map((r) => view({ ...r, current_period_end: null }, FREE_PROFILE)),
    view(row({ ladder_month: 6, price_cents: 799, next_price_cents: 699 })),
    view(null, FREE_PROFILE),
    view(null, PAID_PROFILE),
    view(undefined),
  ];
  const strings: string[] = [
    ...Object.values(PAYWALL_COPY),
    ...Object.values(MANAGE_COPY),
    ...Object.values(CHECKOUT_COPY),
    CODE_LINE,
    DELETE_ANY_PLAN,
    ladderSentence(),
    ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => Object.values(paywallStep(n, TODAY)).filter((s): s is string => typeof s === "string")),
  ];
  for (const v of states) {
    const card = cardWords(v, TODAY);
    if (card) {
      strings.push(card.month, card.foot);
      if ("title" in card.left) strings.push(card.left.title);
      else strings.push(card.left.caption);
      if (card.right) strings.push(card.right.caption);
    }
    strings.push(
      pictureLabel(v, TODAY),
      manageLine(v, TODAY),
      confirmBody(v, TODAY),
      cancelledStatus(v, TODAY),
      endingTitle(v, TODAY),
      endingBody(v, TODAY),
      resumedStatus(v, TODAY),
      settingsLine(v, TODAY) ?? "",
      deletePlanLine(v, TODAY) ?? "",
      dropWords(v, TODAY).bubble,
      dropWords(v, TODAY).caption,
      checkoutReturnWords(v, TODAY).left.caption,
      checkoutReturnWords(v, TODAY).right?.caption ?? ""
    );
  }

  it("has no em dash", () => {
    expect(strings.filter((s) => s.includes("—"))).toEqual([]);
  });

  it("has none of the banned words", () => {
    const banned = /\b(gyms?|workouts?|drills?|training|train(?:s|ed)?|reps?)\b/i;
    expect(strings.filter((s) => banned.test(s))).toEqual([]);
  });

  it("never prints NaN, undefined, null or a zero price", () => {
    expect(strings.filter((s) => /NaN|undefined|null|A\$0\.00/.test(s))).toEqual([]);
  });
});
