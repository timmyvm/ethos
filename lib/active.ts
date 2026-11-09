/**
 * Who is active (#431): the page Timothy opens to watch whether testers
 * come back, and whether the reminders and the ready recorder help.
 * One row per current tester (public.testers, stopped_at null): a short
 * label, the last fourteen days as recorded, opened only, or nothing,
 * their streak, and whether reminders are on; above them, each day's
 * totals. No transcripts, no audio, no scores: this module never sees
 * them, because the route reads none (app/api/active/route.ts).
 *
 * Pure, so the route and the tests share one aggregation. Days are day
 * keys ("YYYY-MM-DD"). Each tester's activity is counted on their own
 * calendar, the zone the report counts their days spoken in
 * (tester_admin.zones, 0020: the zone their reminders follow, Melbourne
 * without), and the page's fourteen columns are Melbourne's, the test's
 * own calendar (content/tester.ts TEST.zone).
 */

import { TEST } from "@/content/tester";
import { computeStreak } from "./streak";
import { testerNumber } from "./tester";
import { addDays, testZone, zoneDayKey } from "./tester-days";

export const ACTIVE_DAYS = 14;

/** A day on the strip: a recording landed, the app opened without one, or neither. */
export type DayMark = "recorded" | "opened" | "none";

export interface ActiveInput {
  /** Every testers row, stopped ones included: they keep the numbering stable. */
  testers: { user_id: string; created_at: string; stopped_at: string | null; carried_from?: string[] | null }[];
  /** reps: who and when, nothing else. */
  reps: { user_id: string; created_at: string }[];
  /** tester_events that mean the app was open (a device open, a return to it). */
  events: { user_id: string; at: string }[];
  /** push_subscriptions: whose reminders are on, at what hour, in which zone. */
  pushes: { user_id: string; reminder_hour: number | null; tz: string | null; created_at: string }[];
  /** streak_freezes: the days a freeze held, so the streak is the one their flame shows. */
  freezes: { user_id: string; used_on: string }[];
  /** The founder reading the page: their own row says "You" and stays out of the totals. */
  viewerId: string | null;
  now: Date;
}

export interface ActiveRow {
  /** The tester number, "0B5E 7A21": how a friend says who they are. */
  number: string;
  /** "Tester 3", by when they joined, or "You". */
  label: string;
  you: boolean;
  /** Oldest first, today last. */
  days: DayMark[];
  streak: number;
  /** Their reminder's hour (0 to 23), or null when reminders are off. */
  reminder: number | null;
}

export interface ActiveView {
  /** The fourteen day keys, oldest first, today last (Melbourne's). */
  days: string[];
  /** Each day's testers who recorded, and who opened without recording. The viewer is not counted. */
  totals: { recorded: number; opened: number }[];
  rows: ActiveRow[];
}

/** A day key as a local noon, for `computeStreak`, which reads local days. */
function noon(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
}

export function activeView(input: ActiveInput): ActiveView {
  const today = zoneDayKey(input.now, TEST.zone);
  const days = Array.from({ length: ACTIVE_DAYS }, (_, i) => addDays(today, i - (ACTIVE_DAYS - 1)));

  /* Numbered by when they joined, every row counted, so a tester who
     stops never renumbers the ones after them; the founder's own row is
     not one of them. */
  const joined = [...input.testers].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.user_id.localeCompare(b.user_id)
  );
  const nth = new Map(
    joined.filter((t) => t.user_id !== input.viewerId).map((t, i) => [t.user_id, i + 1])
  );

  /* A tester's recordings include those of the anonymous sessions their
     testing was carried from (0022 §5), as the report reads them. */
  const owner = new Map<string, string>();
  for (const t of joined) {
    owner.set(t.user_id, t.user_id);
    for (const c of t.carried_from ?? []) if (!owner.has(c)) owner.set(c, t.user_id);
  }

  /* The zone their reminders follow, newest subscription first, as
     tester_admin.zones picks it. */
  const zone = new Map<string, string>();
  const reminder = new Map<string, number>();
  const pushes = [...input.pushes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const p of pushes) {
    if (p.tz && !zone.has(p.user_id)) zone.set(p.user_id, testZone(p.tz));
    if (p.reminder_hour !== null && !reminder.has(p.user_id)) reminder.set(p.user_id, p.reminder_hour);
  }
  const zoneOf = (id: string) => zone.get(id) ?? TEST.zone;

  const spoken = new Map<string, Set<string>>();
  for (const r of input.reps) {
    const id = owner.get(r.user_id);
    if (!id) continue;
    const set = spoken.get(id) ?? new Set<string>();
    set.add(zoneDayKey(r.created_at, zoneOf(id)));
    spoken.set(id, set);
  }
  const opened = new Map<string, Set<string>>();
  for (const e of input.events) {
    const id = owner.get(e.user_id);
    if (!id) continue;
    const set = opened.get(id) ?? new Set<string>();
    set.add(zoneDayKey(e.at, zoneOf(id)));
    opened.set(id, set);
  }
  const frozen = new Map<string, string[]>();
  for (const f of input.freezes) {
    const id = owner.get(f.user_id);
    if (!id) continue;
    frozen.set(id, [...(frozen.get(id) ?? []), f.used_on]);
  }

  const current = joined.filter((t) => t.stopped_at === null);
  const rows: ActiveRow[] = current.map((t) => {
    const id = t.user_id;
    const you = id === input.viewerId;
    const rec = spoken.get(id) ?? new Set<string>();
    const open = opened.get(id) ?? new Set<string>();
    const mine = zoneDayKey(input.now, zoneOf(id));
    return {
      number: testerNumber(id) ?? id.slice(0, 8).toUpperCase(),
      label: you ? "You" : `Tester ${nth.get(id)}`,
      you,
      days: days.map((d) => (rec.has(d) ? "recorded" : open.has(d) ? "opened" : "none")),
      streak: computeStreak([...rec].map(noon), noon(mine), (frozen.get(id) ?? []).map(noon)).current,
      reminder: reminder.get(id) ?? null,
    };
  });

  const totals = days.map((_, i) => {
    let recorded = 0;
    let open = 0;
    for (const r of rows) {
      if (r.you) continue;
      if (r.days[i] === "recorded") recorded++;
      else if (r.days[i] === "opened") open++;
    }
    return { recorded, opened: open };
  });

  /* The viewer's own row last: it is not one of the people being watched. */
  rows.sort((a, b) => Number(a.you) - Number(b.you));
  return { days, totals, rows };
}

/**
 * The founder's allowlist (ADMIN_EMAILS): addresses separated by commas
 * or spaces, compared without case. Unset or empty lets nobody in.
 */
export function founderEmails(env: string | undefined): string[] {
  return (env ?? "")
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+$/.test(e));
}

/**
 * Whether this account may open the page: a confirmed email on the
 * allowlist. An anonymous session has no email, and an address that
 * was never confirmed proves nothing about who holds it.
 */
export function isFounder(
  user: { email: string | null; anonymous: boolean; confirmed: boolean },
  env: string | undefined
): boolean {
  if (user.anonymous || !user.confirmed || !user.email) return false;
  return founderEmails(env).includes(user.email.trim().toLowerCase());
}
