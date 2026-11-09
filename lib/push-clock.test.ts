import { describe, expect, it } from "vitest";
import { clockView, tickSubject } from "./push-clock";

/*
 * Is the reminder clock alive (#430 review)? /active draws this, so a
 * clock that stopped is seen the same day instead of never.
 */
const now = new Date("2026-11-09T08:30:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

describe("clockView", () => {
  it("an hourly clock: alive, 24 of the last 24 hours", () => {
    const rows = Array.from({ length: 48 }, (_, i) => ({
      subject: tickSubject("PUSH_TICK_SECRET", "database"),
      at: ago(29 + i * 60),
    }));
    const v = clockView(rows, now);
    expect(v.alive).toBe(true);
    expect(v.sources).toEqual([{ secret: "PUSH_TICK_SECRET", caller: "database", last: ago(29), hours: 24 }]);
  });

  it("GitHub alone, every few hours: each source's own count, and dead after 65 minutes", () => {
    const rows = [ago(200), ago(500), ago(900)].map((at) => ({ subject: tickSubject("CRON_SECRET", "github"), at }));
    const v = clockView(rows, now);
    expect(v.alive).toBe(false);
    expect(v.sources[0]).toMatchObject({ caller: "github", hours: 3 });
  });

  it("newest source first", () => {
    const v = clockView(
      [
        { subject: tickSubject("CRON_SECRET", "github"), at: ago(42) },
        { subject: tickSubject("PUSH_TICK_SECRET", "database"), at: ago(29) },
      ],
      now
    );
    expect(v.sources.map((s) => s.caller)).toEqual(["database", "github"]);
    expect(v.alive).toBe(true);
  });

  it("nothing ticked: no sources, not alive", () => {
    expect(clockView([], now)).toEqual({ sources: [], alive: false });
  });

  it("ignores rows that are not tick notes", () => {
    const v = clockView(
      [
        { subject: "u:0b5e7a21", at: ago(1) },
        { subject: "push-tick:SOMETHING:else", at: ago(1) },
      ],
      now
    );
    expect(v).toEqual({ sources: [], alive: false });
  });
});
