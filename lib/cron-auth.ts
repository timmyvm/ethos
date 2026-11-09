/**
 * Who may tick the reminder sender (#430). Two secrets are accepted, each
 * a bearer token: `CRON_SECRET`, which GitHub's backup schedule holds, and
 * `PUSH_TICK_SECRET`, which the hourly clock carries (the database's
 * pg_cron job reads it from Vault, supabase/migrations/0027_push_tick.sql,
 * or cron-job.org holds it). Two, so either copy can be rotated without the
 * other caller going dark.
 *
 * A secret under 32 characters is ignored, so a short or hand-typed value
 * fails closed rather than guarding the route weakly (#430 review); the
 * server says so once in its log. `openssl rand -hex 32` makes one of 64.
 *
 * Compared in constant time on their digests, so neither the value nor
 * its length leaks through how long a wrong guess takes. Server only.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const TICK_SECRET_NAMES = ["CRON_SECRET", "PUSH_TICK_SECRET"] as const;
export type TickSecretName = (typeof TICK_SECRET_NAMES)[number];

/** The shortest secret the sender takes. */
export const TICK_SECRET_MIN = 32;

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Names already logged as too short, so the log says it once per instance. */
const warned = new Set<string>();

/** The secrets a tick may carry, by name: the ones set and long enough. */
export function namedTickSecrets(
  env: Record<string, string | undefined> = process.env
): { name: TickSecretName; value: string }[] {
  const out: { name: TickSecretName; value: string }[] = [];
  for (const name of TICK_SECRET_NAMES) {
    const value = env[name];
    if (typeof value !== "string" || value.trim().length === 0) continue;
    if (value.trim().length < TICK_SECRET_MIN) {
      if (!warned.has(name)) {
        warned.add(name);
        console.error(
          `push cron: ${name} is ignored, it is shorter than ${TICK_SECRET_MIN} characters. Make one with: openssl rand -hex 32`
        );
      }
      continue;
    }
    out.push({ name, value });
  }
  return out;
}

/** The secrets a tick may carry: the ones that are set and long enough. */
export function tickSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return namedTickSecrets(env).map((s) => s.value);
}

/**
 * Which secret `header` carries (`Bearer <secret>`), or null for none.
 * Every secret is compared, so the time taken says nothing about which.
 */
export function matchedSecret(
  header: string | null,
  secrets: { name: TickSecretName; value: string }[]
): TickSecretName | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const given = digest(header.slice("Bearer ".length));
  let hit: TickSecretName | null = null;
  for (const s of secrets) {
    if (s.value.trim().length > 0 && timingSafeEqual(given, digest(s.value))) hit = s.name;
  }
  return hit;
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

/**
 * Who ticked, from the request's user agent, for the page that shows
 * whether the clock is alive (/active): the database's job sends
 * "pg_net push-tick" (0027), GitHub's step "github-actions push-cron"
 * (push-cron.yml), cron-job.org names itself; anything else, a hand-run
 * curl included, is "other".
 */
export type TickCaller = "database" | "cron-job.org" | "github" | "other";

export function tickCaller(userAgent: string | null): TickCaller {
  const ua = (userAgent ?? "").toLowerCase();
  if (ua.includes("pg_net")) return "database";
  if (ua.includes("cron-job.org")) return "cron-job.org";
  if (ua.includes("github")) return "github";
  return "other";
}
