/**
 * POST /api/tester/collect: what a tester's phone collected about the
 * app (consent version 3, migration 0022, lib/tester-events.ts).
 *
 * The only writer of public.tester_events: the browser has no grant on
 * that table, so every row passes through here, in this order:
 *
 *   1. The body: 32,000 characters at most, JSON, `{ events, token? }`.
 *      The token rides in the body only for the batch sent as the page
 *      hides (navigator.sendBeacon carries no headers); otherwise it is
 *      the Authorization header, as every route takes it.
 *   2. The session: a real one, anonymous-first ones included.
 *   3. The testers row, on consent version 3 or later. Anyone else,
 *      tester on an older consent included, is refused before a field
 *      is read and stores nothing, not even a rate-limit slot: the phone
 *      is told to stop (`stop: true`).
 *   4. The limiter, per account (lib/rate-limit.ts `collect`).
 *   5. Every field validated and capped (cleanEvents): unknown kinds and
 *      names go, paths lose their query, labels and errors are cut,
 *      device fields are picked by name, and an error read against this
 *      page's own host keeps only Ethos's stack lines (one that names
 *      only other sites, an extension's say, goes whole).
 *   6. The ceilings, past which the batch is taken and kept by nobody, so
 *      the phone does not send it again: the table's own size
 *      (lib/tester-room.ts, 150 MB), the account's rows (15,000), and
 *      twenty errors per open of the app, as the phone counts them.
 *   7. The address (the first x-forwarded-for hop, as every limiter
 *      reads it) on device rows only, then one insert with the service
 *      role.
 *
 * Answers with what the phone needs to know: 200 kept (the batch is
 * done, whatever was kept), 401 (a fresh token next time), 403 with
 * `stop` (collecting ends on this phone), 413 and 400 (the batch is
 * dropped), 429 and 5xx (the batch waits for the next send).
 */

import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { resolveAuthHeader, supabaseAdmin } from "@/lib/db";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { cleanEvents, COLLECTS_FROM_VERSION, EVENT_CAPS, type EventRow } from "@/lib/tester-events";
import { eventsTableFull } from "@/lib/tester-room";

export const runtime = "nodejs";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > EVENT_CAPS.body) return json({ error: "Too large." }, 413);
  const text = await req.text().catch(() => "");
  if (text.length > EVENT_CAPS.body) return json({ error: "Too large." }, 413);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object") return json({ error: "Not a batch." }, 400);
  const body = parsed as { events?: unknown; token?: unknown };

  const header =
    req.headers.get("authorization") ??
    (typeof body.token === "string" && body.token ? `Bearer ${body.token}` : null);
  const resolved = await resolveAuthHeader(header).catch(() => ({ kind: "unavailable" }) as const);
  if (resolved.kind === "unavailable") return json({ error: "Try again." }, 503);
  if (resolved.kind !== "user") return json({ error: "Sign in again." }, 401);
  const user = resolved.user;

  const db = supabaseAdmin();
  if (!db) return json({ error: "Not configured." }, 503);

  const { data: tester, error: readError } = await db
    .from("testers")
    .select("consent_version")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return json({ error: "Try again." }, 502);
  const version = (tester as { consent_version?: number } | null)?.consent_version ?? 0;
  if (version < COLLECTS_FROM_VERSION) return json({ error: "Not testing.", stop: true }, 403);

  if (!(await consumeRateLimit(`tester-collect:u:${user.id}`, "collect")).allowed) {
    return json({ error: "Too many." }, 429);
  }

  // The page's own host, as the phone reached it: an error is read
  // against it, so another site's lines never land.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  let rows = cleanEvents(body.events, new Date(), host);
  if (rows.length === 0) return json({ ok: true, kept: 0 });

  if (await eventsTableFull(db)) return json({ ok: true, kept: 0, full: true });

  const { count, error: countError } = await db
    .from("tester_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return json({ error: "Try again." }, 502);
  const room = Math.max(0, EVENT_CAPS.perAccount - (count ?? 0));
  if (room === 0) return json({ ok: true, kept: 0, full: true });
  rows = rows.slice(0, room);

  // Twenty errors an open at most, counting the ones already kept: the
  // phone holds to it, and a phone that does not is held to it here.
  const opens = [...new Set(rows.filter((r) => r.kind === "error").map((r) => r.open_id))];
  if (opens.length) {
    const left = new Map<string | null, number>();
    for (const open of opens) {
      let had = 0;
      if (open !== null) {
        const counted = await db
          .from("tester_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("kind", "error")
          .eq("open_id", open);
        if (counted.error) return json({ error: "Try again." }, 502);
        had = counted.count ?? 0;
      }
      left.set(open, Math.max(0, EVENT_CAPS.errorsPerOpen - had));
    }
    rows = rows.filter((r) => {
      if (r.kind !== "error") return true;
      const n = left.get(r.open_id) ?? 0;
      left.set(r.open_id, n - 1);
      return n > 0;
    });
    if (rows.length === 0) return json({ ok: true, kept: 0 });
  }

  const address = clientIp(req.headers);
  const ip = isIP(address) ? address : null;
  const owned = rows.map((r: EventRow) => ({ ...r, user_id: user.id, ip: r.kind === "device" ? ip : null }));

  const { error } = await db.from("tester_events").insert(owned);
  if (!error) return json({ ok: true, kept: owned.length });

  // A row the table refuses (its own checks) never holds the batch
  // hostage: the rest go one by one, and the refused one is let go.
  if (/^(22|23)/.test((error as { code?: string }).code ?? "")) {
    let kept = 0;
    for (const row of owned) {
      const one = await db.from("tester_events").insert(row);
      if (!one.error) kept++;
    }
    return json({ ok: true, kept });
  }
  console.error("tester collect: write failed", error.message);
  return json({ error: "Try again." }, 502);
}
