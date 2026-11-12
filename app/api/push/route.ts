/**
 * POST /api/push — register or update this browser's push subscription.
 * DELETE /api/push — remove it (reminder switched off, or permission
 * revoked).
 *
 * A subscription belongs to an auth user (anonymous-first sessions
 * count), so the bearer token is required — an endpoint nobody owns
 * could never be cleaned up or updated. The row is upserted by
 * endpoint: re-registering on every app open is how hour and timezone
 * changes propagate, so it has to be a no-op when nothing changed.
 *
 * A new hour that has already passed today rings first tomorrow, as
 * Settings and the glance both promise (#430 review): the sender serves
 * from the chosen hour until quiet hours, so a 12 pm picked at 3:30 pm
 * rang at 4:01 pm. The row is read first, so the re-arm on every open,
 * with the same hour, never touches the day's stamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { MAX_SUBSCRIPTIONS, pushEndpointAllowed, pushKeyOk } from "@/lib/push-endpoint";
import { localClock, localDayKey, tzOffsetAt, validZone } from "@/lib/push";

export const runtime = "nodejs";

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  reminderHour?: number | null;
  tzOffset?: number;
  /** The device's IANA zone, so the cron follows its DST changes (0019). */
  tz?: string;
  quietFrom?: number;
  quietTo?: number;
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);
  if (!auth) {
    return NextResponse.json(
      { error: "That session has expired." },
      { status: 401 }
    );
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Push isn't configured on this server." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.subscription?.endpoint;
  const p256dh = body?.subscription?.keys?.p256dh;
  const authKey = body?.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { error: "Missing subscription fields." },
      { status: 400 }
    );
  }
  // A push service's address and its keys, or nothing is stored (#457).
  if (!pushEndpointAllowed(endpoint) || !pushKeyOk(p256dh, 200) || !pushKeyOk(authKey, 100)) {
    return NextResponse.json(
      { error: "That isn't a browser's push subscription." },
      { status: 400 }
    );
  }
  // A handful of browsers an account; a new one past that is refused,
  // and the ones already there keep ringing (#457).
  const { count: held } = await db
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("user_id", auth.id)
    .neq("endpoint", endpoint);
  if ((held ?? 0) >= MAX_SUBSCRIPTIONS) {
    return NextResponse.json(
      { error: "Reminders are on in too many browsers. Turn one off first." },
      { status: 429 }
    );
  }

  const hour = body?.reminderHour;
  const row = {
    endpoint,
    user_id: auth.id,
    p256dh,
    auth: authKey,
    reminder_hour:
      typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : null,
    tz_offset: Math.trunc(body?.tzOffset ?? 0),
    quiet_from: clampHour(body?.quietFrom, 22),
    quiet_to: clampHour(body?.quietTo, 7),
  };
  const tz = validZone(body?.tz);
  const stamp = await firstRingTomorrow(db, endpoint, row.reminder_hour, tz, row.tz_offset, new Date());
  const saved = stamp ? { ...row, last_sent_on: stamp } : row;
  const table = db.from("push_subscriptions");
  let { error } = await table.upsert({ ...saved, tz }, { onConflict: "endpoint" });
  // Until migration 0019 adds the column, the zone is refused by name:
  // save the reminder without it rather than not at all.
  if (error && /\btz\b/.test(error.message)) {
    ({ error } = await db
      .from("push_subscriptions")
      .upsert(saved, { onConflict: "endpoint" }));
  }
  if (error) {
    console.error("push subscribe failed", error.message);
    return NextResponse.json(
      { error: "The subscription didn't save. Try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);
  if (!auth) {
    return NextResponse.json(
      { error: "That session has expired." },
      { status: 401 }
    );
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Push isn't configured on this server." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  }
  await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", auth.id);
  return NextResponse.json({ ok: true });
}

/**
 * Today's local day key when this save sets an hour that has already
 * passed today (a new row, or a changed hour), so the sender's first ring
 * is tomorrow; null when the stamp should be left as it is. A row read
 * that fails stamps nothing: the reminder still saves.
 */
async function firstRingTomorrow(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  endpoint: string,
  hour: number | null,
  tz: string | null,
  storedOffset: number,
  now: Date
): Promise<string | null> {
  if (hour === null) return null;
  let data: unknown;
  try {
    const read = await db
      .from("push_subscriptions")
      .select("reminder_hour")
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (read.error) return null;
    data = read.data;
  } catch {
    return null;
  }
  const before = (data as { reminder_hour: number | null } | null)?.reminder_hour;
  if (data && before === hour) return null;
  const off = (tz ? tzOffsetAt(now, tz) : null) ?? storedOffset;
  // Settings' nextFireTime: an hour whose :00 has gone is tomorrow's.
  if (localClock(now, off).getUTCHours() < hour) return null;
  return localDayKey(now, off);
}

function clampHour(v: number | undefined, fallback: number): number {
  return typeof v === "number" && v >= 0 && v <= 23 ? Math.trunc(v) : fallback;
}
