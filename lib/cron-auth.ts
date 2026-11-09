/**
 * Who may tick the reminder sender (#430). Two secrets are accepted, each
 * a bearer token: `CRON_SECRET`, which GitHub's backup schedule holds, and
 * `PUSH_TICK_SECRET`, which the database's pg_cron job reads from Vault
 * (supabase/migrations/0027_push_tick.sql). Two, so either copy can be
 * rotated without the other caller going dark.
 *
 * Compared in constant time on their digests, so neither the value nor
 * its length leaks through how long a wrong guess takes. Server only.
 */

import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** The secrets a tick may carry: the ones that are set, and not blank. */
export function tickSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return [env.CRON_SECRET, env.PUSH_TICK_SECRET].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
}

/** True when `header` is `Bearer <one of secrets>`. No secrets set: nobody. */
export function bearerMatches(header: string | null, secrets: string[]): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const given = digest(header.slice("Bearer ".length));
  let ok = false;
  // Every secret is compared, so the time taken says nothing about which.
  for (const s of secrets) {
    if (s.trim().length > 0 && timingSafeEqual(given, digest(s))) ok = true;
  }
  return ok;
}
