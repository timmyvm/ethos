/**
 * GET /api/push/cron — the hourly send (DECISIONS #186, #430).
 *
 * Called by two schedulers with a bearer secret (lib/cron-auth.ts): the
 * database's pg_cron job at minute 1 of every hour (PUSH_TICK_SECRET,
 * supabase/migrations/0027_push_tick.sql), and GitHub's best-effort
 * backup (CRON_SECRET; Vercel Hobby crons are daily-only). Each tick:
 * pick the subscriptions whose local day has reached their chosen hour
 * and not yet quiet hours (lib/push.ts shouldSend), drop anyone whose
 * local day already has practice in it (#143, answered by the reps
 * table, not a guess), claim the day on the row before sending so two
 * callers in the same minute cannot both ring, send one push each, and
 * hand the claim back if the push service failed. A 404 or 410 means
 * the browser revoked the endpoint: the row is deleted, not retried.
 *
 * The answer says why nothing went, not only that nothing did: how many
 * rows were read, how many were due, how many had already practised, how
 * many another tick had claimed, and what was sent, failed or dropped.
 *
 * Each tick that passes the gate is noted (when, which secret, who
 * called: lib/cron-auth.ts `tickCaller`) so /active shows whether the
 * hourly clock is alive; a dead clock used to be silent (#430 review).
 * Each push carries a TTL that runs out at quiet hours or midnight, so a
 * phone that was off never gets yesterday's reminder at 2 am.
 */

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/db";
import { PUSH_SEND_TIMEOUT_MS, pushEndpointOk } from "@/lib/push-endpoint";
import { dbTickMatches, matchedSecret, namedTickSecrets, tickCaller, type TickCaller, type TickSecretName } from "@/lib/cron-auth";
import { TICK_KEEP_HOURS, tickSubject } from "@/lib/push-clock";
import {
  localDayKey,
  localDayStartIn,
  onTime,
  PUSH_TOPIC,
  sendTtl,
  shouldSend,
  tzOffsetAt,
} from "@/lib/push";
import { lastTake, reminderCopy } from "@/lib/reminder-copy";
import { todayHrefOn, type PracticeRow } from "@/lib/home";

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
  /** The device's IANA zone (0019); null on rows armed before it. */
  tz?: string | null;
  quiet_from: number;
  quiet_to: number;
  last_sent_on: string | null;
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  let secret: TickSecretName | null = matchedSecret(authorization, namedTickSecrets());
  /* The database clock's secret lives only in the database (0028): ask it. */
  if (!secret) {
    const admin = supabaseAdmin();
    if (admin && (await dbTickMatches(admin, authorization))) secret = "PUSH_TICK_SECRET";
  }
  if (!secret) {
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
  await noteTick(db, secret, tickCaller(req.headers.get("user-agent")), new Date());

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
  /* Why a tick sent what it sent (#430): GitHub's log and pg_net's
     net._http_response both keep this body. */
  const report = {
    subs: subs.length,
    /** At or past their hour today, before quiet hours, not yet sent. */
    due: 0,
    /** Due, but today already has practice in it (#143). */
    done: 0,
    /** Due, but the done-today check could not answer: skipped. */
    unsure: 0,
    /** Due, but another tick claimed the day first. */
    taken: 0,
    sent: 0,
    failed: 0,
    dropped: 0,
  };

  for (const sub of subs) {
    if (sub.reminder_hour === null) continue;
    // The zone's offset at this tick, so a daylight-saving change since
    // the device armed moves nothing; the stored offset only for rows
    // that never sent a zone.
    const off = (sub.tz ? tzOffsetAt(now, sub.tz) : null) ?? sub.tz_offset;
    const win = {
      reminderHour: sub.reminder_hour,
      tzOffset: off,
      quietFrom: sub.quiet_from,
      quietTo: sub.quiet_to,
      lastSentOn: sub.last_sent_on,
    };

    // Cheap gates first; the DB check only runs for real candidates.
    // A row saved before the endpoint list (lib/push-endpoint.ts) that is
    // not a push service's is never called.
    if (!pushEndpointOk(sub.endpoint)) continue;
    if (!shouldSend(win, false, now)) continue;
    report.due++;

    // Midnight at the offset in force then, not at this tick: on a day the
    // clocks change the two differ by an hour (#430 review).
    const dayStart = localDayStartIn(now, off, sub.tz).toISOString();
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
      report.unsure++;
      continue;
    }
    if ((count ?? 0) > 0) {
      report.done++; // #143: today is already done.
      continue;
    }

    /* Claim the day before sending (#430): the update only lands on a row
       not already stamped today, so of two ticks in the same minute (the
       database's and GitHub's) exactly one gets the row back. */
    const today = localDayKey(now, off);
    const { data: claimed, error: claimErr } = await db
      .from("push_subscriptions")
      .update({ last_sent_on: today })
      .eq("endpoint", sub.endpoint)
      .or(`last_sent_on.is.null,last_sent_on.neq.${today}`)
      .select("endpoint");
    if (claimErr) {
      console.error("push cron: claim failed", claimErr.message);
      report.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      report.taken++;
      continue;
    }

    // One number from their own last take for the body (lib/reminder-copy.ts).
    const { data: recent } = await db
      .from("reps")
      .select("filler_count, duration_s")
      .eq("user_id", sub.user_id)
      .order("created_at", { ascending: false })
      .limit(5);
    const copy = reminderCopy({
      hour: sub.reminder_hour,
      onTime: onTime(win, now),
      last: lastTake((recent ?? []) as { filler_count?: number | null; duration_s?: number | string | null }[]),
    });

    // Today's own topic, ready to record (#431).
    const url = await practiceUrl(db, sub.user_id, now, off);

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ ...copy, url }),
        // Held for a phone that is off only until quiet hours or midnight,
        // whichever is first; one topic, so a newer reminder replaces it.
        { TTL: sendTtl(win, now), urgency: "normal", topic: PUSH_TOPIC, timeout: PUSH_SEND_TIMEOUT_MS }
      );
      report.sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
        report.dropped++;
      } else {
        console.error("push cron: send failed", status, sub.endpoint.slice(0, 40));
        report.failed++;
        // Hand the day back, so a later tick before quiet hours retries.
        // Only this tick's own claim: a row stamped otherwise is left be.
        await db
          .from("push_subscriptions")
          .update({ last_sent_on: sub.last_sent_on })
          .eq("endpoint", sub.endpoint)
          .eq("last_sent_on", today);
      }
    }
  }

  return NextResponse.json({ ok: true, ...report });
}

/**
 * Where the reminder opens (#431): the address Today's Start opens on a
 * day not yet spoken, the same topic on the same day, ready to record
 * (lib/home.ts `todayHref`, read on the subscriber's calendar). It used
 * to be bare /rep, the demoted road's rotation, so every reminder opened
 * a different topic from Today's. The practice is chosen from the newest
 * measured recording, so the newest thirty are read; a read that fails
 * opens Today, which chooses for itself.
 */
async function practiceUrl(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  userId: string,
  now: Date,
  tzOffset: number
): Promise<string> {
  const { data, error } = await db
    .from("reps")
    .select("created_at, duration_s, transcript, wpm, filler_count, fillers, pauses, dimensions")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return "/";
  const rows = (data as PracticeRow[]).slice().reverse();
  // The day is already claimed (#430): an address that cannot be worked
  // out opens Today rather than costing the person their reminder.
  try {
    return todayHrefOn(rows, now, tzOffset);
  } catch (e) {
    console.error("push cron: practice address failed", (e as Error).message);
    return "/";
  }
}

/**
 * The tick's note (#430 review): one row in rate_limits (0006, already on
 * production, closed to the API) under `push-tick:<secret>:<caller>`, and
 * anything older than two days swept. A note that fails is logged and the
 * tick goes on: the reminders matter more than the record of them.
 *
 * Since the 11 Nov audit the sweep takes every subject's old rows, not
 * only the ticks'. The limiter clears a subject's rows only when that
 * subject comes back (0006), so an address or a guest seen once left
 * its rows for good and the table could only grow. No limit looks back
 * further than a day, so a row two days old counts for nothing.
 */
async function noteTick(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  secret: TickSecretName,
  caller: TickCaller,
  now: Date
): Promise<void> {
  try {
    const { error } = await db.from("rate_limits").insert({ subject: tickSubject(secret, caller), at: now.toISOString() });
    if (error) console.error("push cron: tick note failed", error.message);
    await db
      .from("rate_limits")
      .delete()
      .lt("at", new Date(now.getTime() - TICK_KEEP_HOURS * 3_600_000).toISOString());
  } catch (e) {
    console.error("push cron: tick note failed", (e as Error).message);
  }
}
