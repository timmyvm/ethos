import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST answers at most this many rows a request (max_rows, 1000 on Supabase). */
export const READ_PAGE = 1000;

export type AccountRecordings = { ok: true; count: number; paths: string[] } | { ok: false; error: string };

/**
 * Every recording an account holds, as its count and its audio paths,
 * read a page at a time (#479 review). One select answers at most
 * max_rows, and the deletes that follow (DELETE /api/recordings, and
 * the cascade under DELETE /api/account) take every row: an unpaged
 * read left the audio of every recording past the thousandth in the
 * bucket, with nothing left pointing at it. Ordered by id so the pages
 * never overlap or skip. A failed page is a failure of the whole read,
 * so nothing is deleted on half a list.
 */
export async function readAccountRecordings(db: SupabaseClient, userId: string): Promise<AccountRecordings> {
  let count = 0;
  const paths: string[] = [];
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await db
      .from("reps")
      .select("id, audio_path")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + READ_PAGE - 1);
    if (error) return { ok: false, error: error.message };
    const page = (data ?? []) as { id: string; audio_path: string | null }[];
    count += page.length;
    for (const r of page) if (typeof r.audio_path === "string" && r.audio_path.length > 0) paths.push(r.audio_path);
    if (page.length < READ_PAGE) return { ok: true, count, paths };
  }
}
