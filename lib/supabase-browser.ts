/**
 * Anonymous-first auth (DECISIONS #15): rep 1 happens BEFORE any signup.
 * On first use we mint an anonymous Supabase session so reps persist and
 * the streak/history have an owner; the "save your progress" gate
 * (email OTP / OAuth) upgrades the same user later.
 *
 * Degrades gracefully: no env, or anonymous sign-ins disabled in the
 * project, and the rep simply scores unattributed.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

/**
 * The session this device holds right now, read without ever creating
 * one. A background job that only has a recording to send (the outbox
 * flush) uses this: minting a user to carry someone else's recording is
 * how a signed-out account's audio ended up in a stranger's Log.
 */
export async function currentSession(): Promise<{
  userId: string;
  token: string;
} | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  try {
    const { data } = await db.auth.getSession();
    return data.session
      ? { userId: data.session.user.id, token: data.session.access_token }
      : null;
  } catch {
    return null;
  }
}

/** Access token for the current (anonymous or real) session, if any. */
export async function ensureSession(): Promise<string | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  try {
    const { data } = await db.auth.getSession();
    if (data.session) return data.session.access_token;
    const { data: anon, error } = await db.auth.signInAnonymously();
    if (error) return null; // provider disabled — score unattributed
    return anon.session?.access_token ?? null;
  } catch {
    return null;
  }
}
