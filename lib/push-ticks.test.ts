import { describe, expect, it } from "vitest";
import { localDayKey, onTime, shouldSend, tzOffsetAt } from "./push";

/*
 * The sender over the ticks it really got (#430). GitHub's "17 * * * *"
 * ran the push cron at these instants (gh run list, read only), every 3 to
 * 7 hours instead of every hour. Replayed for a Melbourne subscriber with
 * the default quiet hours (22 to 7), nobody practising, and the day
 * claimed by the send the way the route claims it.
 */
const TZ = "Australia/Melbourne";
const GITHUB_TICKS = [
  "2026-10-29T16:55:43Z", "2026-10-29T21:48:21Z", "2026-10-30T01:57:11Z", "2026-10-30T08:37:17Z",
  "2026-10-30T15:55:19Z", "2026-10-30T20:46:41Z", "2026-10-31T00:46:47Z", "2026-10-31T06:58:52Z",
  "2026-10-31T13:38:32Z", "2026-10-31T18:32:23Z", "2026-10-31T22:27:59Z", "2026-11-01T02:12:54Z",
  "2026-11-01T09:15:09Z", "2026-11-01T16:03:38Z", "2026-11-01T20:29:22Z", "2026-11-02T00:42:48Z",
  "2026-11-02T07:39:34Z", "2026-11-02T18:19:47Z", "2026-11-03T01:33:58Z", "2026-11-03T09:30:41Z",
  "2026-11-03T17:49:50Z", "2026-11-03T23:20:08Z", "2026-11-04T06:15:13Z", "2026-11-04T14:35:56Z",
  "2026-11-04T21:19:10Z", "2026-11-05T02:25:34Z", "2026-11-05T10:50:09Z", "2026-11-05T18:44:01Z",
  "2026-11-06T00:13:53Z", "2026-11-06T06:45:58Z", "2026-11-06T15:00:06Z", "2026-11-06T20:52:25Z",
  "2026-11-07T00:54:52Z", "2026-11-07T07:07:00Z", "2026-11-07T13:59:06Z", "2026-11-07T18:45:16Z",
  "2026-11-07T22:43:25Z", "2026-11-08T02:27:57Z", "2026-11-08T10:16:26Z", "2026-11-08T16:41:47Z",
  "2026-11-08T21:08:35Z", "2026-11-09T00:51:58Z",
].map((s) => new Date(s));

/** pg_cron's "1 * * * *": minute 1 of every UTC hour, which is HH:01 in Melbourne. */
function hourlyTicks(fromUtc: number, toUtc: number): Date[] {
  const out: Date[] = [];
  for (let t = fromUtc; t < toUtc; t += 3_600_000) out.push(new Date(t + 60_000));
  return out;
}

const localTime = (d: Date) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/**
 * Which local day each hour was served on, and when: the route's order
 * (shouldSend, then the #143 check, then the claim). `practisedAt` is when
 * the person recorded on a day, as a local "HH:MM", if they did.
 */
function replay(ticks: Date[], hour: number, practisedAt: Record<string, string> = {}) {
  const sentOn = new Map<string, string>();
  let lastSentOn: string | null = null;
  for (const now of [...ticks].sort((a, b) => a.getTime() - b.getTime())) {
    const off = tzOffsetAt(now, TZ)!;
    const day = localDayKey(now, off);
    const did = practisedAt[day] !== undefined && practisedAt[day] <= localTime(now);
    const w = { reminderHour: hour, tzOffset: off, quietFrom: 22, quietTo: 7, lastSentOn };
    if (!shouldSend(w, did, now)) continue;
    // The claim: one row, one day.
    if (lastSentOn === day) continue;
    lastSentOn = day;
    sentOn.set(day, localTime(now));
  }
  return sentOn;
}

const HOURS_7_TO_21 = Array.from({ length: 15 }, (_, i) => i + 7);

describe("the real GitHub ticks of 7 and 8 November, Melbourne", () => {
  it("8 Nov (ticks 00:59, 05:45, 09:43, 13:27, 21:16): every hour 7 to 21 is served before quiet hours", () => {
    const want: Record<number, string> = {
      7: "09:43", 8: "09:43", 9: "09:43",
      10: "13:27", 11: "13:27", 12: "13:27", 13: "13:27",
      14: "21:16", 15: "21:16", 16: "21:16", 17: "21:16", 18: "21:16", 19: "21:16", 20: "21:16", 21: "21:16",
    };
    for (const h of HOURS_7_TO_21) expect([h, replay(GITHUB_TICKS, h).get("2026-11-08")]).toEqual([h, want[h]]);
  });

  it("7 Nov (ticks 02:00, 07:52, 11:54, 18:07): 7 to 18 are served; 19, 20 and 21 had no tick before 22:00", () => {
    const want: Record<number, string> = {
      7: "07:52", 8: "11:54", 9: "11:54", 10: "11:54", 11: "11:54",
      12: "18:07", 13: "18:07", 14: "18:07", 15: "18:07", 16: "18:07", 17: "18:07", 18: "18:07",
    };
    for (const h of HOURS_7_TO_21) expect([h, replay(GITHUB_TICKS, h).get("2026-11-07")]).toEqual([h, want[h]]);
    // Why not 19 to 21: after 18:07 the next tick came at 00:59 on the 8th,
    // inside quiet hours and a new day. No window serves an hour that has
    // no tick between it and quiet hours; only a scheduler that ticks every
    // hour does (pg_cron, below). Ringing early, at 18:07 for a 9 pm plan,
    // would not be the plan the person made.
  });

  it("the six offered hours over 30 Oct to 8 Nov: 43 of 60 served, up from 28", () => {
    const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03",
      "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
    let served = 0;
    for (const h of [7, 8, 12, 18, 20, 21]) {
      const on = replay(GITHUB_TICKS, h);
      served += days.filter((d) => on.has(d)).length;
    }
    expect(served).toBe(43);
  });

  it("a late tick does not name the hour it missed", () => {
    // 21:16 on 8 Nov for a 12 pm pick: sent, but titled without "12 pm".
    const now = new Date("2026-11-08T10:16:26Z");
    const off = tzOffsetAt(now, TZ)!;
    expect(onTime({ reminderHour: 12, tzOffset: off }, now)).toBe(false);
    expect(onTime({ reminderHour: 21, tzOffset: off }, now)).toBe(true);
    expect(onTime({ reminderHour: 20, tzOffset: off }, now)).toBe(true);
    expect(onTime({ reminderHour: 19, tzOffset: off }, now)).toBe(false);
  });
});

describe("hourly at minute 1 (pg_cron), with GitHub's ticks still running", () => {
  // 29 Oct 13:00 UTC is 30 Oct 00:00 in Melbourne; to 9 Nov 01:00 UTC.
  const hourly = hourlyTicks(Date.UTC(2026, 9, 29, 13), Date.UTC(2026, 10, 9, 1));
  const both = [...hourly, ...GITHUB_TICKS];

  it("serves every hour 7 to 21 on every day at HH:01, once", () => {
    for (const h of HOURS_7_TO_21) {
      const on = replay(both, h);
      for (const day of ["2026-10-30", "2026-11-02", "2026-11-06", "2026-11-07", "2026-11-08"]) {
        expect([h, day, on.get(day)]).toEqual([h, day, `${String(h).padStart(2, "0")}:01`]);
      }
    }
  });

  it("never rings on a day after the person practised, and never twice", () => {
    // Practised at 17:40 on 7 Nov: the 18 pm pick stays silent that day,
    // and rings the next day at 18:01 as usual.
    const on = replay(both, 18, { "2026-11-07": "17:40" });
    expect(on.has("2026-11-07")).toBe(false);
    expect(on.get("2026-11-08")).toBe("18:01");
    // On GitHub's ticks alone, a 12 pm pick whose 11:54 tick came early
    // would catch up at 18:07; practised at 12:30, it stays silent.
    const late = replay(GITHUB_TICKS, 12, { "2026-11-07": "12:30" });
    expect(late.has("2026-11-07")).toBe(false);
  });
});
