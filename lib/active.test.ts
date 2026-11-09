import { describe, expect, it } from "vitest";
import { ACTIVE_DAYS, activeView, founderEmails, isFounder, type ActiveInput } from "./active";

/*
 * Who is active (#431): the pure aggregation behind Timothy's page. Each
 * tester's day is recorded, opened only, or nothing, on their own
 * calendar; the totals count testers, not recordings; the streak is the
 * one their flame shows; and only a confirmed address on the allowlist
 * opens the page.
 */

const id = (n: number) => `${String(n).padStart(8, "0")}-6c3d-4f8e-8a1b-2d9c4e6f7a10`;
const VIEWER = "c0a013e2-0000-4000-8000-000000000000";
/* 9 Nov 2026, 20:00 in Melbourne (UTC+11). */
const NOW = new Date("2026-11-09T09:00:00Z");
/** h:00 on 2026-11-d, Melbourne's clock, as an instant. */
const mel = (d: number, h = 18) => new Date(Date.UTC(2026, 10, d, h - 11)).toISOString();

function input(over: Partial<ActiveInput> = {}): ActiveInput {
  return {
    testers: [
      { user_id: id(1), created_at: "2026-10-30T03:00:00Z", stopped_at: null },
      { user_id: id(2), created_at: "2026-10-31T03:00:00Z", stopped_at: null },
      { user_id: id(3), created_at: "2026-11-01T03:00:00Z", stopped_at: null },
    ],
    reps: [],
    events: [],
    pushes: [],
    freezes: [],
    viewerId: null,
    now: NOW,
    ...over,
  };
}

describe("the fourteen days", () => {
  it("end today on Melbourne's calendar, oldest first", () => {
    const v = activeView(input());
    expect(v.days).toHaveLength(ACTIVE_DAYS);
    expect(v.days[0]).toBe("2026-10-27");
    expect(v.days[13]).toBe("2026-11-09");
    expect(v.totals).toHaveLength(ACTIVE_DAYS);
  });

  it("marks a recording's day recorded, an open without one opened, and the rest nothing", () => {
    const v = activeView(
      input({
        reps: [{ user_id: id(1), created_at: mel(8) }],
        events: [
          { user_id: id(1), at: mel(8, 9) },
          { user_id: id(1), at: mel(9, 7) },
          { user_id: id(2), at: mel(9, 12) },
        ],
      })
    );
    const one = v.rows.find((r) => r.label === "Tester 1")!;
    expect(one.days[12]).toBe("recorded");
    expect(one.days[13]).toBe("opened");
    expect(one.days[11]).toBe("none");
    const two = v.rows.find((r) => r.label === "Tester 2")!;
    expect(two.days[13]).toBe("opened");
    expect(v.rows.find((r) => r.label === "Tester 3")!.days.every((d) => d === "none")).toBe(true);
  });

  it("counts testers, not recordings or opens, in each day's totals", () => {
    const v = activeView(
      input({
        reps: [
          { user_id: id(1), created_at: mel(9, 8) },
          { user_id: id(1), created_at: mel(9, 19) },
          { user_id: id(3), created_at: mel(9, 10) },
        ],
        events: [
          { user_id: id(1), at: mel(9, 8) },
          { user_id: id(2), at: mel(9, 8) },
          { user_id: id(2), at: mel(9, 20) },
        ],
      })
    );
    expect(v.totals[13]).toEqual({ recorded: 2, opened: 1 });
    expect(v.totals[12]).toEqual({ recorded: 0, opened: 0 });
  });

  it("reads each tester's day on their own calendar", () => {
    /* 23:30 on the 8th in Perth is 02:30 on the 9th in Melbourne: a
       tester whose reminders follow Perth recorded on the 8th. */
    const late = new Date(Date.UTC(2026, 10, 8, 15, 30)).toISOString();
    const v = activeView(
      input({
        reps: [
          { user_id: id(1), created_at: late },
          { user_id: id(2), created_at: late },
        ],
        pushes: [{ user_id: id(1), reminder_hour: 18, tz: "Australia/Perth", created_at: "2026-11-01T00:00:00Z" }],
      })
    );
    expect(v.rows[0].days[12]).toBe("recorded");
    expect(v.rows[1].days[13]).toBe("recorded");
  });

  it("leaves out anything older than the strip, and anyone who is not a tester", () => {
    const v = activeView(
      input({
        reps: [
          { user_id: id(1), created_at: "2026-10-20T07:00:00Z" },
          { user_id: "ffffffff-0000-4000-8000-000000000000", created_at: mel(9) },
        ],
        events: [{ user_id: "ffffffff-0000-4000-8000-000000000000", at: mel(9) }],
      })
    );
    expect(v.rows.flatMap((r) => r.days).every((d) => d === "none")).toBe(true);
    expect(v.totals[13]).toEqual({ recorded: 0, opened: 0 });
  });
});

describe("the rows", () => {
  it("show current testers only, numbered by when they joined, so a stop never renumbers anyone", () => {
    const v = activeView(
      input({
        testers: [
          { user_id: id(3), created_at: "2026-11-01T03:00:00Z", stopped_at: null },
          { user_id: id(1), created_at: "2026-10-30T03:00:00Z", stopped_at: null },
          { user_id: id(2), created_at: "2026-10-31T03:00:00Z", stopped_at: "2026-11-05T00:00:00Z" },
        ],
      })
    );
    expect(v.rows.map((r) => r.label)).toEqual(["Tester 1", "Tester 3"]);
    expect(v.rows[0].number).toBe("0000 0001");
  });

  it("say You for the founder, last, and leave them out of the totals", () => {
    const v = activeView(
      input({
        testers: [
          { user_id: VIEWER, created_at: "2026-10-29T03:00:00Z", stopped_at: null },
          { user_id: id(1), created_at: "2026-10-30T03:00:00Z", stopped_at: null },
        ],
        reps: [{ user_id: VIEWER, created_at: mel(9) }],
        viewerId: VIEWER,
      })
    );
    expect(v.rows.map((r) => r.label)).toEqual(["Tester 1", "You"]);
    expect(v.rows[1].days[13]).toBe("recorded");
    expect(v.totals[13]).toEqual({ recorded: 0, opened: 0 });
  });

  it("count the recordings of the sessions a tester was carried from", () => {
    const anon = "aaaaaaaa-0000-4000-8000-000000000000";
    const v = activeView(
      input({
        testers: [{ user_id: id(1), created_at: "2026-10-30T03:00:00Z", stopped_at: null, carried_from: [anon] }],
        reps: [{ user_id: anon, created_at: mel(7) }],
      })
    );
    expect(v.rows[0].days[11]).toBe("recorded");
  });

  it("say whether reminders are on, and at what hour", () => {
    const v = activeView(
      input({
        pushes: [
          { user_id: id(1), reminder_hour: 18, tz: "Australia/Melbourne", created_at: "2026-11-01T00:00:00Z" },
          { user_id: id(2), reminder_hour: null, tz: "Australia/Melbourne", created_at: "2026-11-01T00:00:00Z" },
        ],
      })
    );
    expect(v.rows.map((r) => r.reminder)).toEqual([18, null, null]);
  });

  it("take the newest subscription's hour when a tester has two phones", () => {
    const v = activeView(
      input({
        pushes: [
          { user_id: id(1), reminder_hour: 8, tz: "Australia/Melbourne", created_at: "2026-11-01T00:00:00Z" },
          { user_id: id(1), reminder_hour: 21, tz: "Australia/Melbourne", created_at: "2026-11-06T00:00:00Z" },
        ],
      })
    );
    expect(v.rows[0].reminder).toBe(21);
  });
});

describe("the streak", () => {
  const days = (...ds: number[]) => ds.map((d) => ({ user_id: id(1), created_at: mel(d) }));

  it("counts the days in a row up to today, or up to yesterday while today is open", () => {
    expect(activeView(input({ reps: days(7, 8, 9) })).rows[0].streak).toBe(3);
    expect(activeView(input({ reps: days(6, 7, 8) })).rows[0].streak).toBe(3);
  });

  it("is 0 once a day is missed, whatever came before", () => {
    expect(activeView(input({ reps: days(3, 4, 5, 6, 7) })).rows[0].streak).toBe(0);
    expect(activeView(input()).rows[0].streak).toBe(0);
  });

  it("is the one their flame shows: a freeze holds the run and never counts", () => {
    const v = activeView(
      input({ reps: days(5, 6, 8), freezes: [{ user_id: id(1), used_on: "2026-11-07" }] })
    );
    expect(v.rows[0].streak).toBe(3);
  });

  it("counts two recordings on one day once", () => {
    const v = activeView(input({ reps: [...days(8, 9), { user_id: id(1), created_at: mel(9, 7) }] }));
    expect(v.rows[0].streak).toBe(2);
  });
});

describe("who may open the page", () => {
  const timothy = { email: "Timothy@Example.com", anonymous: false, confirmed: true };

  it("is a confirmed address on the allowlist, without case", () => {
    expect(isFounder(timothy, "timothy@example.com")).toBe(true);
    expect(isFounder(timothy, "a@b.co, timothy@example.com")).toBe(true);
    expect(isFounder(timothy, " timothy@example.com\nother@x.io ")).toBe(true);
  });

  it("is nobody when the allowlist is unset or empty", () => {
    expect(isFounder(timothy, undefined)).toBe(false);
    expect(isFounder(timothy, "")).toBe(false);
    expect(founderEmails(" , ,")).toEqual([]);
  });

  it("is never an anonymous session, an unconfirmed address or another address", () => {
    expect(isFounder({ ...timothy, anonymous: true }, "timothy@example.com")).toBe(false);
    expect(isFounder({ ...timothy, confirmed: false }, "timothy@example.com")).toBe(false);
    expect(isFounder({ ...timothy, email: null }, "timothy@example.com")).toBe(false);
    expect(isFounder({ ...timothy, email: "timothy@example.com.evil" }, "timothy@example.com")).toBe(false);
    expect(isFounder(timothy, "imothy@example.com")).toBe(false);
  });
});
