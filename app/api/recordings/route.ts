/**
 * DELETE /api/recordings: every recording on the account, gone, and the
 * account kept (#479, Settings' Privacy and data).
 *
 * The same order as DELETE /api/account, for the same reason: a partial
 * failure never strands a file nobody can reach.
 *
 *   1. The recordings' audio paths are read, a page at a time
 *      (lib/recordings-read.ts: one select answers at most 1000 rows,
 *      and the rows all go in step 3); a failed read changes nothing
 *      and says so.
 *   2. The audio files go, a hundred at a time, while the rows still
 *      hold their paths. Storage objects are not rows and no cascade
 *      reaches them. A failure stops here with every row in place, and
 *      the route is safe to run again (a path already gone is no error).
 *   3. The rows go. XP, coins and the lexicon keep their own rows
 *      (their `rep_id` is `on delete set null`, 0001 to 0004) and saved
 *      words keep theirs (0023 holds the id with no key): what was
 *      earned stays earned. Anything worked out from the
 *      recordings themselves (the streak, the stars, the Index) has
 *      nothing left to count, as the confirm says before the tap.
 *
 * Any session may run it, a guest's included: the token deletes exactly
 * its own rows, and the service role is used only once the caller is
 * known.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { readAccountRecordings } from "@/lib/recordings-read";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromAuthHeader(req.headers.get("authorization")).catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: "That session has expired. Sign in and try again." }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Recordings aren't configured on this server." }, { status: 503 });
  }

  const read = await readAccountRecordings(db, auth.id);
  if (!read.ok) {
    console.error("recordings delete: read failed", read.error);
    return NextResponse.json({ error: "Couldn't list your recordings. Nothing was deleted." }, { status: 502 });
  }
  const { paths } = read;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from("audio").remove(paths.slice(i, i + 100));
    if (error) {
      console.error("recordings delete: audio removal failed", error.message);
      // Every row is still here either way, so a second try finds every path.
      return NextResponse.json(
        {
          error:
            i === 0
              ? "Your audio didn't delete, so your recordings are all still here. Try again."
              : "Part of your audio deleted and the rest didn't, so your recordings are still listed. Try again.",
        },
        { status: 502 }
      );
    }
  }

  const { error: deleteError } = await db.from("reps").delete().eq("user_id", auth.id);
  if (deleteError) {
    console.error("recordings delete: rows failed", deleteError.message);
    return NextResponse.json(
      {
        error: paths.length
          ? "Your audio is deleted, but the recordings' words and scores didn't. Try again."
          : "Your recordings didn't delete. Try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, deleted: read.count });
}
