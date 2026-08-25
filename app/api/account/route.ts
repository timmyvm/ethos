/**
 * DELETE /api/account — the whole account, gone.
 *
 * Ordered so a partial failure can never strand data:
 *
 *   1. Audio files first. They're the only thing a cascade can't reach
 *      (storage objects aren't rows), so they go while the reps rows
 *      still hold their paths. Any failure here aborts with everything
 *      else untouched, and the route is safe to retry.
 *   2. Rate-limit rows, which key on a subject string, not a foreign key.
 *   3. The auth user, last. Every table references auth.users with
 *      on delete cascade (migrations 0001 to 0004), so this one call
 *      removes reps, lexicon, streaks, freezes, profiles, XP and coins
 *      atomically, and a failure before it leaves the account whole.
 *
 * Works identically for anonymous-first accounts: they are real auth
 * users, and their token authorises deleting exactly themselves.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);
  if (!auth) {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this server." },
      { status: 503 }
    );
  }

  const { data: rows, error: readError } = await db
    .from("reps")
    .select("audio_path")
    .eq("user_id", auth.id)
    .not("audio_path", "is", null);
  if (readError) {
    return NextResponse.json(
      { error: "Couldn't list your recordings. Nothing was deleted." },
      { status: 502 }
    );
  }

  const paths = (rows ?? [])
    .map((r) => r.audio_path as string)
    .filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage
      .from("audio")
      .remove(paths.slice(i, i + 100));
    if (error) {
      console.error("account delete: audio removal failed", error.message);
      return NextResponse.json(
        { error: "Couldn't delete your audio. Nothing else was touched; try again." },
        { status: 502 }
      );
    }
  }

  await db.from("rate_limits").delete().eq("subject", `u:${auth.id}`);

  const del = await db.auth.admin.deleteUser(auth.id);
  if (del.error) {
    console.error("account delete: auth deletion failed", del.error.message);
    return NextResponse.json(
      { error: "The account didn't delete. Try again in a minute." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
