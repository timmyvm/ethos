/**
 * POST /api/push/test — send this phone's reminder now (#430).
 *
 * Settings' "Send a test" row: the whole path at once, the row on the
 * server, VAPID, Apple's or Google's push service, the service worker and
 * the phone's notification settings, so a person (Timothy first) can see
 * a reminder arrive in seconds instead of waiting a day for the hour. It
 * sends only to an endpoint the caller owns, at most once a minute per
 * endpoint on this instance, and never touches `last_sent_on`: the day's
 * real reminder still comes.
 */

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { PUSH_SEND_TIMEOUT_MS, pushEndpointOk } from "@/lib/push-endpoint";
import { TEST_COPY, TEST_EVERY_MS } from "@/lib/reminder-copy";

export const runtime = "nodejs";

/** When each endpoint was last sent a test, on this instance. */
const lastTest = new Map<string, number>();

export async function POST(req: NextRequest) {
  const auth = await getUserFromAuthHeader(req.headers.get("authorization")).catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: "That session has expired." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  }
  const now = Date.now();
  const last = lastTest.get(endpoint);
  if (last !== undefined && now - last < TEST_EVERY_MS) {
    return NextResponse.json({ error: "One test a minute." }, { status: 429 });
  }

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const db = supabaseAdmin();
  if (!pub || !priv || !db) {
    return NextResponse.json({ error: "Push isn't configured on this server." }, { status: 503 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@speakethos.com", pub, priv);

  const { data: row, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .eq("user_id", auth.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }
  if (!row || !pushEndpointOk(row.endpoint)) {
    return NextResponse.json({ error: "The server holds no reminder for this phone." }, { status: 404 });
  }

  lastTest.set(endpoint, now);
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint as string, keys: { p256dh: row.p256dh as string, auth: row.auth as string } },
      JSON.stringify({ ...TEST_COPY, url: "/" }),
      // A test proves the path now or not at all: a phone that is off
      // never gets it later (#430 review). Its own topic, so it never
      // replaces a real reminder waiting at the push service.
      { TTL: 60, urgency: "high", topic: "ethos-test", timeout: PUSH_SEND_TIMEOUT_MS }
    );
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // The phone let this subscription go: the row is no reminder.
      await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", auth.id);
      return NextResponse.json({ error: "This phone's subscription expired.", gone: true }, { status: 410 });
    }
    console.error("push test: send failed", status);
    return NextResponse.json({ error: "The push service refused it." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
