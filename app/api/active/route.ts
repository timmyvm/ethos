/**
 * GET /api/active: who is active (#431), for Timothy alone.
 *
 * The one place another person's activity leaves the database, so the
 * gate comes before any read and says nothing to anyone else:
 *
 *   1. A session (the Authorization header, as every route takes it).
 *      None, or one that does not resolve: 401.
 *   2. The account is the founder's: a confirmed email on ADMIN_EMAILS,
 *      read here on the server (lib/active.ts `isFounder`). Anyone else,
 *      and everyone while the variable is unset: 404, as if there were
 *      no such route.
 *   3. Then, with the service role, only what the page draws: the
 *      testers rows, each recording's owner and time, the times the app
 *      was opened (a device open or a return to it, tester_events), the
 *      reminder rows' hour and zone, and the freeze days. Never a
 *      transcript, a file, a score, a name or an address. Read only.
 *
 * The answer is the aggregate (lib/active.ts `activeView`) and is never
 * cached.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { ACTIVE_DAYS, activeView, isFounder, type ActiveInput } from "@/lib/active";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/** PostgREST answers at most 1000 rows a request; every read pages. */
const PAGE = 1000;
/** Far enough back for a streak that began before the test. */
const STREAK_DAYS = 120;

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

async function paged<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return json({ error: "Sign in." }, 401);
  const db = supabaseAdmin();
  if (!db) return json({ error: "Not configured." }, 503);

  const { data: auth, error: authError } = await db.auth.getUser(header.slice(7)).catch(() => ({
    data: { user: null },
    error: { status: 503 },
  }));
  const user = auth?.user;
  if (!user) {
    const status = (authError as { status?: number } | null)?.status ?? 0;
    return status >= 500 ? json({ error: "Try again." }, 503) : json({ error: "Sign in." }, 401);
  }
  const founder = isFounder(
    {
      email: user.email ?? null,
      anonymous: user.is_anonymous ?? false,
      confirmed: Boolean(user.email_confirmed_at),
    },
    process.env.ADMIN_EMAILS
  );
  if (!founder) return json({ error: "Not found." }, 404);

  try {
    const view = await read(db, user.id, new Date());
    return json({ view });
  } catch (e) {
    console.error("active: read failed", (e as { message?: string })?.message);
    return json({ error: "Read failed." }, 502);
  }
}

async function read(db: Db, viewerId: string, now: Date) {
  const testers = await paged<ActiveInput["testers"][number]>((from, to) =>
    db
      .from("testers")
      .select("user_id, created_at, stopped_at, carried_from")
      .order("created_at", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, to)
  );
  const current = testers.filter((t) => t.stopped_at === null).map((t) => t.user_id);
  const owners = [
    ...new Set(testers.filter((t) => t.stopped_at === null).flatMap((t) => [t.user_id, ...(t.carried_from ?? [])])),
  ];
  if (current.length === 0) {
    return activeView({ testers, reps: [], events: [], pushes: [], freezes: [], viewerId, now });
  }

  /* A day either side of the strip, for the zones east and west of the
     page's own calendar. */
  const stripFrom = new Date(now.getTime() - (ACTIVE_DAYS + 1) * 86_400_000).toISOString();
  const streakFrom = new Date(now.getTime() - STREAK_DAYS * 86_400_000);

  const [reps, events, pushes, freezes] = await Promise.all([
    paged<ActiveInput["reps"][number]>((from, to) =>
      db
        .from("reps")
        .select("user_id, created_at")
        .in("user_id", owners)
        .gte("created_at", streakFrom.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    /* An open of the app: the device snapshot each load sends, or the
       return to an app already loaded. Taps and screens say nothing more
       about whether it was opened, and there are far more of them. */
    paged<ActiveInput["events"][number]>((from, to) =>
      db
        .from("tester_events")
        .select("user_id, at")
        .in("user_id", current)
        .gte("at", stripFrom)
        .or("kind.eq.device,name.eq.shown")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    paged<ActiveInput["pushes"][number]>((from, to) =>
      db
        .from("push_subscriptions")
        .select("user_id, reminder_hour, tz, created_at")
        .in("user_id", current)
        .order("endpoint", { ascending: true })
        .range(from, to)
    ),
    paged<ActiveInput["freezes"][number]>((from, to) =>
      db
        .from("streak_freezes")
        .select("user_id, used_on")
        .in("user_id", owners)
        .gte("used_on", streakFrom.toISOString().slice(0, 10))
        .order("used_on", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to)
    ),
  ]);

  return activeView({ testers, reps, events, pushes, freezes, viewerId, now });
}
