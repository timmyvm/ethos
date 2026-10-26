/**
 * GET /api/push/cron — the hourly send (DECISIONS #186).
 *
 * Called by a scheduler (GitHub Actions; Vercel Hobby crons are
 * daily-only) with `Authorization: Bearer ${CRON_SECRET}`. Each tick:
 * pick the subscriptions whose LOCAL hour is their chosen hour, drop
 * anyone inside quiet hours, drop anyone whose local day already has
 * practice in it (#143 — answered by the reps table, not a guess), send
 * one push each, stamp their local date so a rerun is a no-op. A 404 or
 * 410 from the push service means the browser revoked the endpoint;
 * the row is deleted rather than retried forever.
 */

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/db";
import {
  localDayKey,
  localDayStartUtc,
  localStreak,
  shouldSend,
} from "@/lib/push";
import { reminderBody } from "@/lib/reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

/** At most the server's max_rows, so a full page reliably means "maybe more". */
const SUB_PAGE = 1000;

interface SubRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  reminder_hour: number | null;
  tz_offset: number;
  quiet_from: number;
  quiet_to: number;
  last_sent_on: string | null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return NextResponse.json(
      { error: "VAPID keys aren't configured." },
      { status: 503 }
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@speakethos.com",
    pub,
    priv
  );

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "No database." }, { status: 503 });
  }

  /*
   * Every subscription, paged. One read answered at most PostgREST's
   * max_rows (1000) with no error, so past 1000 devices the rest were
   * never considered. Keyset on the primary key, not offsets: the loop
   * below deletes and updates rows, which would shift an offset.
   */
  const subs: SubRow[] = [];
  for (let after: string | null = null; ; ) {
    let q = db
      .from("push_subscriptions")
      .select("*")
      .not("reminder_hour", "is", null)
      .order("endpoint", { ascending: true })
      .limit(SUB_PAGE);
    if (after !== null) q = q.gt("endpoint", after);
    const { data, error } = await q;
    if (error) {
      console.error("push cron: read failed", error.message);
      return NextResponse.json({ error: "Read failed." }, { status: 502 });
    }
    const page = (data ?? []) as SubRow[];
    subs.push(...page);
    if (page.length < SUB_PAGE) break;
    after = page[page.length - 1].endpoint;
  }

  const now = new Date();
  let sent = 0;
  let dropped = 0;

  for (const sub of subs) {
    if (sub.reminder_hour === null) continue;
    const win = {
      reminderHour: sub.reminder_hour,
      tzOffset: sub.tz_offset,
      quietFrom: sub.quiet_from,
      quietTo: sub.quiet_to,
      lastSentOn: sub.last_sent_on,
    };

    // Cheap gates first; the DB check only runs for real candidates.
    if (!shouldSend(win, false, now)) continue;

    const dayStart = localDayStartUtc(now, sub.tz_offset).toISOString();
    const { count, error: doneErr } = await db
      .from("reps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sub.user_id)
      .gte("created_at", dayStart);
    // A check that could not answer is not "not done": postgrest hands a
    // failure back as count null, which read as zero and rang on a day
    // already practised. Skip; a wrong reminder costs more than a missed
    // one (#143).
    if (doneErr) {
      console.error("push cron: done-today check failed", doneErr.message);
      continue;
    }
    if ((count ?? 0) > 0) continue; // #143: today is already done.

    // The streak for the body text, in their local calendar.
    const { data: repRows } = await db
      .from("reps")
      .select("created_at")
      .eq("user_id", sub.user_id)
      .order("created_at", { ascending: false })
      .limit(120);
    const streak = localStreak(
      (repRows ?? []).map((r) => new Date(r.created_at as string)),
      sub.tz_offset,
      now
    );

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: "Ethos",
          body: reminderBody({ streak, didToday: false }),
          url: "/rep",
        })
      );
      sent++;
      await db
        .from("push_subscriptions")
        .update({ last_sent_on: localDayKey(now, sub.tz_offset) })
        .eq("endpoint", sub.endpoint);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
        dropped++;
      } else {
        console.error("push cron: send failed", status, sub.endpoint.slice(0, 40));
      }
    }
  }

  return NextResponse.json({ ok: true, sent, dropped });
}
