/**
 * Settings' "Delete my recordings" (#479), from the phone: the server
 * deletes every recording and its audio (app/api/recordings), then this
 * phone forgets what it held of them, so no screen draws a recording
 * that is gone. The account, its XP, coins and saved words stay.
 *
 * A take of this account still waiting in the outbox (sent offline, or
 * never confirmed) goes too (#479 review): it was recorded before the
 * delete, and sent later it would put a recording back on an account
 * that was just told it has none. Another account's held takes stay.
 */

import { forgetRecordings } from "./held";
import { outboxAll, outboxDelete, ownedBy } from "./rep-outbox";
import { writeSpokeHint } from "./spoke-hint";
import { supabaseBrowser } from "./supabase-browser";

export interface DeleteRecordingsResult {
  ok: boolean;
  /** How many went, when the server said. */
  deleted?: number;
  /** Shown verbatim. */
  error?: string;
}

export async function deleteAllRecordings(): Promise<DeleteRecordingsResult> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, error: "Recordings aren't configured yet." };
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  const me = data.session?.user?.id ?? null;
  if (!token) return { ok: false, error: "There's no signed-in session, so nothing was deleted." };
  let res: Response;
  try {
    res = await fetch("/api/recordings", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // It may have answered after all: never told it did nothing.
    return { ok: false, error: "The server didn't answer. Try again." };
  }
  const body = (await res.json().catch(() => null)) as { error?: string; deleted?: number } | null;
  if (!res.ok) return { ok: false, error: body?.error ?? "That didn't go through. Try again." };
  forgetRecordings();
  writeSpokeHint(null);
  if (me) {
    const waiting = ownedBy(await outboxAll().catch(() => []), me);
    for (const take of waiting) await outboxDelete(take.id).catch(() => {});
  }
  return { ok: true, deleted: typeof body?.deleted === "number" ? body.deleted : undefined };
}
