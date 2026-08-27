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
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  reminderHour?: number | null;
  tzOffset?: number;
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

  const hour = body?.reminderHour;
  const { error } = await db.from("push_subscriptions").upsert(
    {
      endpoint,
      user_id: auth.id,
      p256dh,
      auth: authKey,
      reminder_hour:
        typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : null,
      tz_offset: Math.trunc(body?.tzOffset ?? 0),
      quiet_from: clampHour(body?.quietFrom, 22),
      quiet_to: clampHour(body?.quietTo, 7),
    },
    { onConflict: "endpoint" }
  );
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

function clampHour(v: number | undefined, fallback: number): number {
  return typeof v === "number" && v >= 0 && v <= 23 ? Math.trunc(v) : fallback;
}
