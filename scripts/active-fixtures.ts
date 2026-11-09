/**
 * Fixtures for the who-is-active page's shots (#431): a test shaped like
 * the one measured on 9 Nov (docs/look/comeback-active/README.md), run
 * through the page's own aggregation (lib/active.ts), printed as the
 * route's answer. Invented ids and times; no tester's data.
 *
 *   npx vite-node --config vitest.config.ts scripts/active-fixtures.ts > view.json
 */
import { activeView, type ActiveInput } from "@/lib/active";

const NOW = new Date("2026-11-09T09:30:00Z"); // 20:30 in Melbourne, Monday 9 Nov
const VIEWER = "c0a013e2-5a1b-4c2d-8e3f-4a5b6c7d8e9f";
/** h:mm on day d of November 2026, Melbourne's clock (UTC+11). */
const at = (d: number, h = 19, m = 12) => new Date(Date.UTC(2026, 10, d, h - 11, m)).toISOString();
const hex = (n: number) => (n * 2654435761 >>> 0).toString(16).padStart(8, "0").toUpperCase();
const idOf = (n: number) => `${hex(n).toLowerCase()}-6c3d-4f8e-8a1b-${String(n).padStart(12, "0")}`;

/** Each tester: the November days recorded, the days only opened, a reminder hour. */
const PEOPLE: { rec: number[]; open?: number[]; hour?: number; joined?: number }[] = [
  /* Four nearly every day. */
  { rec: [2, 3, 4, 5, 6, 7, 8, 9], hour: 18 },
  { rec: [2, 3, 5, 6, 7, 8, 9], open: [4], hour: 18 },
  { rec: [3, 4, 5, 6, 7, 8], open: [9] },
  { rec: [2, 3, 4, 6, 7, 8], open: [5, 9], hour: 21 },
  /* Three more on the 8th. */
  { rec: [2, 5, 8], open: [3, 6, 9] },
  { rec: [3, 4, 8], open: [7] },
  { rec: [6, 8, 9] },
  /* Two the day before. */
  { rec: [2, 4, 7], open: [8] },
  { rec: [5, 7], open: [3, 9] },
  /* Six who recorded one to three days, then stopped. */
  { rec: [2, 3, 4], open: [6] },
  { rec: [3, 4], open: [5, 8] },
  { rec: [3], open: [4, 9] },
  { rec: [4, 5], open: [7] },
  { rec: [2, 3, 5] },
  { rec: [4], open: [6, 8] },
  /* Six who joined and never recorded. */
  { rec: [], open: [2, 3], joined: 1 },
  { rec: [], open: [3], joined: 2 },
  { rec: [], open: [2, 4, 8], joined: 1 },
  { rec: [], joined: 3 },
  { rec: [], open: [5], joined: 4 },
  { rec: [], open: [9], joined: 5 },
];

const testers: ActiveInput["testers"] = [
  { user_id: VIEWER, created_at: "2026-10-29T03:00:00Z", stopped_at: null },
  ...PEOPLE.map((p, i) => ({
    user_id: idOf(i + 1),
    created_at: new Date(Date.UTC(2026, 9, 30 + (p.joined ?? i % 3), 3 + i)).toISOString(),
    stopped_at: null,
  })),
  /* One who stopped testing keeps the numbers after them where they were. */
  { user_id: idOf(99), created_at: "2026-10-31T09:00:00Z", stopped_at: "2026-11-04T00:00:00Z" },
];
const reps: ActiveInput["reps"] = [];
const events: ActiveInput["events"] = [];
const pushes: ActiveInput["pushes"] = [];
PEOPLE.forEach((p, i) => {
  const id = idOf(i + 1);
  for (const d of p.rec) {
    reps.push({ user_id: id, created_at: at(d, 8 + (i % 12)) });
    events.push({ user_id: id, at: at(d, 8 + (i % 12), 0) });
  }
  for (const d of p.open ?? []) events.push({ user_id: id, at: at(d, 12 + (i % 9)) });
  if (p.hour !== undefined) {
    pushes.push({ user_id: id, reminder_hour: p.hour, tz: "Australia/Melbourne", created_at: "2026-11-03T08:00:00Z" });
  }
});
/* Timothy's own days. */
for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) reps.push({ user_id: VIEWER, created_at: at(d, 7) });
pushes.push({ user_id: VIEWER, reminder_hour: 8, tz: "Australia/Melbourne", created_at: "2026-10-30T08:00:00Z" });

const view = activeView({ testers, reps, events, pushes, freezes: [], viewerId: VIEWER, now: NOW });
process.stdout.write(JSON.stringify({ view }));
