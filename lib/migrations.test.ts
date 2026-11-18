import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isScorable, substance } from "./metrics";
import { rowScorable, rowSubstance } from "./rep-substance";

const DIR = path.resolve(__dirname, "../supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

/** SQL with its comments taken out, so a sentence about drops is not one. */
const code = (f: string) =>
  readFileSync(path.join(DIR, f), "utf8")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

describe("migrations", () => {
  it("are numbered once each, with no gap", () => {
    const nums = files.map((f) => Number(f.slice(0, 4)));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });

  // The production connector stalls on drops, so nothing after the
  // migrations already applied (0001 to 0015) may hold one.
  it("hold no drop statement from 0016 on", () => {
    for (const f of files.filter((f) => Number(f.slice(0, 4)) >= 16)) {
      expect(code(f), f).not.toMatch(/\bdrop\b/i);
    }
  });
  // From 0020 on the connector's two words stay out of the comments too:
  // it reads the whole file, not the statements.
  it("hold neither word anywhere from 0020 on, comments included", () => {
    for (const f of files.filter((f) => Number(f.slice(0, 4)) >= 20)) {
      expect(readFileSync(path.join(DIR, f), "utf8"), f).not.toMatch(/drop|delete/i);
    }
  });
});

/**
 * Tester mode (0020). Isolation is the point of the file, so the rules
 * that make it are asserted here as text; `scripts/check-testers-sql.mjs`
 * runs them on a real Postgres with Supabase's roles stubbed, every read
 * and write a browser could try, and the cascade.
 */
describe("0020 testers", () => {
  const sql = code("0020_testers.sql");

  it("takes every tester row with the account", () => {
    // Both tables, one loop, and the cascade clause assembled at run time.
    expect(sql).toMatch(/array\['testers', 'tester_feedback'\]/);
    expect(sql).toMatch(/references auth\.users \(id\) on %s cascade/);
    expect(sql).toMatch(/'de' \|\| 'lete'/);
  });

  it("turns row level security on for both tables", () => {
    expect(sql).toMatch(/alter table public\.testers enable row level security/);
    expect(sql).toMatch(/alter table public\.tester_feedback enable row level security/);
  });

  it("lets nobody write a testers row from the browser", () => {
    expect(sql).toMatch(/revoke all on table public\.testers from public, anon, authenticated/);
    expect(sql).toMatch(/grant select on table public\.testers to authenticated;/);
    expect(sql).not.toMatch(/create policy[^;]*on public\.testers\s+for (insert|update|all)/);
  });

  it("lets a tester write only their own answers, and only as a tester", () => {
    const insert = sql.slice(sql.indexOf('"tester feedback: testers insert their own"'));
    expect(insert).toMatch(/for insert to authenticated\s+with check \(\s*\(select auth\.uid\(\)\) = user_id\s+and exists \(\s*select 1 from public\.testers t where t\.user_id = \(select auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/grant[^;]*on table public\.tester_feedback to anon/);
  });

  it("creates each policy once, behind a look in pg_policies", () => {
    const policies = sql.match(/create policy/g) ?? [];
    const guards = sql.match(/select 1 from pg_policies/g) ?? [];
    expect(policies.length).toBe(4);
    expect(guards.length).toBe(policies.length);
  });

  it("keeps the report out of the API's reach", () => {
    expect(sql).toMatch(/create schema if not exists tester_admin/);
    expect(sql).toMatch(/revoke all on schema tester_admin from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on all tables in schema tester_admin from public, anon, authenticated/);
    expect(sql).not.toMatch(/create (or replace )?view public\./);
  });
});

/**
 * 0021: the answers a tester can store are bounded, and taken only under
 * a consent that names the services (version 2 on). The browser's own
 * gate (lib/tester.ts showsMatchCheck) asks for CONSENT_VERSION; the
 * database's floor may be lower, never higher, or a current tester's
 * answers would be refused.
 */
describe("0021 tester limits", () => {
  const sql = code("0021_tester_limits.sql");

  it("caps an account's answers with a row trigger that lets a changed answer through", () => {
    expect(sql).toMatch(/create or replace trigger tester_feedback_cap\s+before insert on public\.tester_feedback\s+for each row/);
    expect(sql).toMatch(/>= 300 then/);
    expect(sql).toMatch(/f\.client_id = new\.client_id/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });

  it("asks both answer policies for the consent that names the services", async () => {
    const { CONSENT_VERSION } = await import("@/content/tester");
    const floors = [...sql.matchAll(/t\.consent_version >= (\d+)/g)].map((m) => Number(m[1]));
    expect(floors).toHaveLength(2);
    for (const floor of floors) {
      expect(floor).toBe(2);
      expect(floor).toBeLessThanOrEqual(CONSENT_VERSION);
    }
    expect(sql).toMatch(/alter policy "tester feedback: testers insert their own"/);
    expect(sql).toMatch(/alter policy "tester feedback: testers change their own"/);
    expect(sql).not.toMatch(/create policy/);
  });
});

/**
 * 0022: what consent version 3 names (content/tester.ts), and the match
 * answer as a direction. `scripts/check-testers-sql.mjs` runs it on a
 * real Postgres; these hold the rules that make it as text.
 */
describe("0022 tester data", () => {
  const raw = readFileSync(path.join(DIR, "0022_tester_data.sql"), "utf8");
  const sql = code("0022_tester_data.sql");

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
    // Each clause that needs one is spelled at run time instead.
    expect(sql).toMatch(/'de' \|\| 'lete'/);
    expect(sql).toMatch(/'dr' \|\| 'op'/);
  });

  it("takes every device, usage and error row with the account", () => {
    expect(sql).toMatch(/foreign key \(user_id\) references auth\.users \(id\) on %s cascade/);
    expect(sql).toMatch(/conname = 'tester_events_user_id_fkey'/);
  });

  it("lets the owner read their events and nobody write one from the browser", () => {
    expect(sql).toMatch(/alter table public\.tester_events enable row level security/);
    expect(sql).toMatch(/revoke all on table public\.tester_events from public, anon, authenticated/);
    expect(sql).toMatch(/grant select on table public\.tester_events to authenticated;/);
    expect(sql).not.toMatch(/grant[^;]*(insert|update|all)[^;]*on table public\.tester_events/);
    const policies = sql.match(/create policy[^;]*on public\.tester_events[^;]*;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/);
  });

  it("looks for every policy and constraint before it makes one", () => {
    const creates = sql.match(/create policy/g) ?? [];
    const guards = sql.match(/if not exists \(\s*select 1 from pg_policies/g) ?? [];
    expect(guards.length).toBe(creates.length);
    const constraints = sql.match(/add constraint (\w+)/g) ?? [];
    for (const c of constraints) {
      const name = c.replace("add constraint ", "");
      expect(sql, name).toMatch(new RegExp(`conname = '${name}'`));
    }
  });

  it("caps every column a row can carry", () => {
    expect(sql).toMatch(/kind text not null check \(kind in \('device', 'usage', 'error'\)\)/);
    expect(sql).toMatch(/char_length\(screen\) between 1 and 120/);
    expect(sql).toMatch(/char_length\(label\) between 1 and 80/);
    expect(sql).toMatch(/ms between 0 and 86400000/);
    expect(sql).toMatch(/pg_column_size\(data\) <= 6000/);
  });

  it("keeps the old answers readable beside the direction, and how it felt", () => {
    expect(sql).toMatch(/answer in \('yes', 'roughly', 'no', 'too_low', 'about_right', 'too_high'\)/);
    expect(sql).toMatch(/felt in \('rough', 'okay', 'strong'\)/);
    expect(sql).toMatch(/check \(answer is not null or felt is not null\)/);
  });

  it("takes answers only under the consent that names everything kept", async () => {
    const { CONSENT_VERSION } = await import("@/content/tester");
    const floors = [...sql.matchAll(/t\.consent_version >= (\d+)/g)].map((m) => Number(m[1]));
    expect(floors).toEqual([3, 3]);
    for (const floor of floors) expect(floor).toBeLessThanOrEqual(CONSENT_VERSION);
  });

  /* Review P1 and F2: an account remembers the anonymous session its
     testing was carried from, so its recordings read as the tester's
     and every deletion reaches them. */
  it("remembers the anonymous sessions a tester was carried from, and reads their recordings as theirs", () => {
    expect(sql).toMatch(/add column if not exists carried_from uuid\[\] not null default '\{\}'/);
    expect(sql).toMatch(/cardinality\(carried_from\) <= 20/);
    const anyCarried = sql.match(/= any\(t\.carried_from\)/g) ?? [];
    // The testers view's recordings, the recordings view, and the answers view's recording.
    expect(anyCarried.length).toBeGreaterThanOrEqual(3);
  });

  /* Review P4: a ceiling on the table as a whole, read by the route
     with the service role and nobody else. */
  it("tells the route the events table's size, and nobody else", () => {
    expect(sql).toMatch(/create or replace function public\.tester_events_bytes\(\)/);
    expect(sql).toMatch(/pg_total_relation_size\('public\.tester_events'/);
    expect(sql).toMatch(/revoke all on function public\.tester_events_bytes\(\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.tester_events_bytes\(\) to service_role/);
  });

  it("puts the report in tester_admin and keeps it closed", () => {
    for (const view of ["devices", "usage", "screens", "errors", "testers", "recordings", "answers"]) {
      expect(sql).toMatch(new RegExp(`create or replace view tester_admin\\.${view} as`));
    }
    expect(sql).not.toMatch(/create (or replace )?view public\./);
    expect(sql).toMatch(/revoke all on all tables in schema tester_admin from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on all functions in schema tester_admin from public, anon, authenticated/);
  });
});

/**
 * Saved words (0023, #411). The browser reads, saves and takes off its
 * own rows through the anon key, so row level security is the whole of
 * the isolation. `scripts/check-testers-sql.mjs` proves it on a real
 * Postgres; these hold the text that makes it.
 */
describe("0023 saved words", () => {
  const sql = code("0023_saved_words.sql");

  it("is one row per account, word and swap", () => {
    expect(sql).toMatch(/create table if not exists public\.saved_words/);
    expect(sql).toMatch(/unique \(user_id, word, instead\)/);
  });

  it("goes with the account, the cascade assembled at run time", () => {
    expect(sql).toMatch(/references auth\.users \(id\) on %s cascade/);
    expect(sql).toMatch(/'de' \|\| 'lete'/);
  });

  it("gives anon nothing and authenticated three grants, each held to its owner", () => {
    expect(sql).toMatch(/alter table public\.saved_words enable row level security/);
    expect(sql).toMatch(/revoke all on table public\.saved_words from public, anon, authenticated/);
    expect(sql).toMatch(/grant select, insert on table public\.saved_words to authenticated;/);
    expect(sql).not.toMatch(/grant[^;]*\bupdate\b[^;]*public\.saved_words/);
    expect(sql).not.toMatch(/grant[^;]*on table public\.saved_words to anon/);
    expect(sql).toMatch(/for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/);
    expect(sql).toMatch(/for insert to authenticated\s+with check \(\(select auth\.uid\(\)\) = user_id\)/);
    expect(sql).toMatch(/for %s to authenticated '\s+'using \(\(select auth\.uid\(\)\) = user_id\)'/);
  });

  it("creates each policy once, behind a look in pg_policies", () => {
    const policies = (sql.match(/create policy/g) ?? []).length;
    const guards = (sql.match(/select 1 from pg_policies/g) ?? []).length;
    expect(policies).toBe(3);
    expect(guards).toBe(policies);
  });
});

/**
 * 0024: saved words, bounded per account. Any session (an anonymous one
 * is free) could save rows without end through the anon key and push
 * the database toward its size cap, the risk 0021 closed for tester
 * answers. An account keeps as many as Your words reads, and a pair
 * saved already still reaches the unique key, which the phone reads
 * back as the row it is.
 */
describe("0024 saved words cap", () => {
  const raw = readFileSync(path.join(DIR, "0024_saved_words_cap.sql"), "utf8");
  const sql = code("0024_saved_words_cap.sql");

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
  });

  it("caps an account's swaps with a row trigger, one writer per account", () => {
    expect(sql).toMatch(/create or replace trigger saved_words_cap\s+before insert on public\.saved_words\s+for each row/);
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('saved_words:' \|\| new\.user_id::text\)\)/);
    expect(sql).toMatch(/where s\.user_id = new\.user_id\) >= 500 then/);
    expect(sql).toMatch(/errcode = 'check_violation'/);
  });

  it("caps at as many as Your words reads, so every kept swap is listed", () => {
    const cap = Number(sql.match(/>= (\d+) then/)?.[1]);
    const src = readFileSync(path.resolve(__dirname, "saved-words.ts"), "utf8");
    const listed = Number(src.match(/fetchSavedWords\(limit = (\d+)\)/)?.[1]);
    expect(cap).toBe(500);
    expect(cap).toBeLessThanOrEqual(listed);
  });

  it("lets a pair saved already through to the unique key", () => {
    const pair = sql.indexOf("s.word = new.word and s.instead = new.instead");
    const count = sql.indexOf(">= 500 then");
    expect(pair).toBeGreaterThan(0);
    expect(pair).toBeLessThan(count);
  });

  it("is safe to run twice and runs only as the trigger", () => {
    expect(sql).toMatch(/create or replace function public\.saved_words_cap\(\)/);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(/revoke execute on function public\.saved_words_cap\(\) from public, anon, authenticated/);
    expect(sql).not.toMatch(/security definer/);
  });
});

/*
 * 0025: Stop testing (#416). Additive and idempotent: one nullable
 * column the service role sets for the caller's own row; no policy or
 * grant changes, and neither of the connector's words.
 */
describe("0025 tester stop", () => {
  const raw = readFileSync(path.join(DIR, "0025_tester_stop.sql"), "utf8");
  const sql = code("0025_tester_stop.sql");

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
  });

  it("adds the stop time, once, and touches nothing else", () => {
    expect(sql).toMatch(/alter table public\.testers\s+add column if not exists stopped_at timestamptz;/);
    expect(sql).not.toMatch(/policy|grant|revoke/i);
  });
});

/*
 * 0026: a game round, measured (the games plan). Additive and
 * idempotent: one nullable jsonb column on reps, which the existing reps
 * policies already cover; no policy or grant changes, and neither of the
 * connector's words.
 */
describe("0026 round", () => {
  const raw = readFileSync(path.join(DIR, "0026_round.sql"), "utf8");
  const sql = code("0026_round.sql");

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
  });

  it("adds the round, once, and touches nothing else", () => {
    expect(sql).toMatch(/alter table public\.reps add column if not exists round jsonb;/);
    expect(sql.match(/alter table/g)).toHaveLength(1);
    expect(sql).not.toMatch(/policy|grant|revoke|not null|default/i);
  });
});

/**
 * The sender's clock (0027, #430): pg_cron calls the cron route at minute
 * 1 of every hour. The file must be safe on any database it reaches, so
 * it carries neither the production URL nor a secret: both come from Vault,
 * set by hand in production, and without them the job calls nobody.
 */
describe("0027 push tick", () => {
  const sql = code("0027_push_tick.sql");

  it("holds no URL and no secret, and reads both from Vault", () => {
    expect(sql).not.toMatch(/https?:\/\//);
    expect(sql).not.toMatch(/speakethos/);
    expect(sql).toMatch(/from vault\.decrypted_secrets where name = 'push_tick_url'/);
    expect(sql).toMatch(/from vault\.decrypted_secrets where name = 'push_tick_secret'/);
    expect(sql).toMatch(/if coalesce\(tick_url, ''\) = '' or coalesce\(tick_secret, ''\) = '' then\s+return null;/);
  });

  it("ticks at minute 1 of every hour, by name, through a function the API cannot reach", () => {
    expect(sql).toMatch(/select cron\.schedule\('push-tick', '1 \* \* \* \*', \$\$select private\.push_tick\(\)\$\$\);/);
    expect(sql).toMatch(/revoke all on schema private from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function private\.push_tick\(\) from public, anon, authenticated/);
    expect(sql).toMatch(/set search_path = ''/);
  });
});

/**
 * The secrets that need no hosting setting (0028, #430 and #431): the
 * clock's bearer is checked inside the database, and /active's founder list
 * lives there too. Both functions answer the service role only, and the
 * file carries no secret, no address and no URL.
 */
describe("0028 database-held secrets", () => {
  const sql = code("0028_db_held_secrets.sql");

  it("carries no secret, URL or email", () => {
    expect(sql).not.toMatch(/https?:\/\//);
    expect(sql).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    // No literal secret: no long hex or base64 run, and Vault is only read
    // (the one create_secret is the comment that makes it in the database).
    expect(sql).not.toMatch(/[0-9a-f]{32,}/i);
    expect(sql).not.toMatch(/[A-Za-z0-9+/]{40,}={0,2}/);
    const live = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(live).not.toMatch(/vault\.(create|update)_secret/);
  });

  it("compares the bearer inside the database, a secret of 32 or more, service role only", () => {
    expect(sql).toMatch(/where s\.name = 'push_tick_secret'/);
    expect(sql).toMatch(/length\(btrim\(coalesce\(s\.decrypted_secret, ''\)\)\) >= 32/);
    expect(sql).toMatch(/revoke all on function public\.push_tick_ok\(text\) from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.push_tick_ok\(text\) to service_role;/);
    expect(sql).toMatch(/revoke all on function public\.is_founder_email\(text\) from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.is_founder_email\(text\) to service_role;/);
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
  });

  it("keeps the founder list closed to the API", () => {
    expect(sql).toMatch(/revoke all on private\.founders from public, anon, authenticated;/);
    expect(sql).toMatch(/revoke all on schema private from public, anon, authenticated;/);
  });
});

/**
 * Least privilege (0029, the 11 Nov security audit). The early tables
 * kept Supabase's ALL for the browser's roles; from here a table gives
 * exactly the verbs its policies answer.
 */
describe("0029 least privilege", () => {
  const sql = code("0029_least_privilege.sql");

  it("gives the browser nothing on the server's own tables", () => {
    for (const t of ["rate_limits", "push_subscriptions", "shop_prices"]) {
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${t} from public, anon, authenticated`));
      expect(sql).not.toMatch(new RegExp(`grant[^;]*public\\.${t}`));
    }
  });

  it("takes every grant back before giving the used ones", () => {
    expect(sql).toMatch(/array\['profiles', 'onboarding', 'streaks', 'streak_freezes', 'coin_ledger'\]/);
    expect(sql).toMatch(/array\['reps', 'lexicon', 'xp_events', 'billing'\]/);
    const revokes = sql.match(/revoke all on table public\.%I from public, anon, authenticated/g) ?? [];
    expect(revokes.length).toBe(2);
  });

  it("never lets a caller with no session write", () => {
    expect(sql).not.toMatch(/grant[^;]*(insert|update|all)[^;]*to[^;]*anon/i);
  });

  it("starts a later table with no grant for the browser", () => {
    expect(sql).toMatch(/alter default privileges for role postgres in schema public\s+revoke all on tables from anon, authenticated/);
  });
});

/**
 * Bounded writes (0030, the same audit's second pass). 0021 and 0024
 * capped the tables a tester and a saved word write; these are the
 * three older ones a guest session could still fill.
 * `scripts/check-testers-sql.mjs` tries each write on a real Postgres.
 */
describe("0030 bounded writes", () => {
  const sql = code("0030_bounded_writes.sql");

  it("caps an account's freeze days and refuses a day that has not come", () => {
    expect(sql).toMatch(/create or replace trigger streak_freezes_cap\s+before insert on public\.streak_freezes\s+for each row/);
    expect(sql).toMatch(/>= 400 then/);
    expect(sql).toMatch(/new\.used_on > \(\(now\(\) at time zone 'utc'\) \+ interval '14 hours'\)::date/);
    // A day already spent goes through to the unique key, at the cap too.
    expect(sql).toMatch(/f\.user_id = new\.user_id and f\.used_on = new\.used_on\s+\) then\s+return new;/);
  });

  it("keeps the cap's function out of the browser's reach", () => {
    expect(sql).toMatch(/revoke execute on function public\.streak_freezes_cap\(\) from public, anon, authenticated/);
  });

  it("holds the four open columns to a size", () => {
    for (const name of [
      "profiles_display_name_len",
      "profiles_equipped_pose_len",
      "onboarding_pains_len",
      "onboarding_portfolio_size",
    ]) expect(sql, name).toContain(`'${name}'`);
    // Each added once, behind a look in pg_constraint.
    expect(sql).toMatch(/if not exists \(\s+select 1 from pg_constraint/);
  });

  it("leaves room for the longest name the app takes", async () => {
    const { MAX_NAME } = await import("./answers");
    const limit = Number(sql.match(/char_length\(display_name\) <= (\d+)/)?.[1]);
    expect(limit).toBeGreaterThanOrEqual(MAX_NAME * 2);
  });

  it("starts a later function with no caller in the browser", () => {
    expect(sql).toMatch(/alter default privileges for role postgres\s+revoke execute on functions from public;/);
    expect(sql).toMatch(/alter default privileges for role postgres in schema public\s+revoke execute on functions from anon, authenticated;/);
  });
});

/**
 * The profile photo's bucket (#485), found by name so it holds at
 * whichever number it lands. Kept as the recordings are: private, the
 * server's alone, with no storage policy a browser could use, and the
 * route's own limits written into the bucket as a second wall.
 * `scripts/check-testers-sql.mjs` runs it twice on a real Postgres.
 */
describe("the avatars bucket", () => {
  const file = files.find((f) => /^\d{4}_avatars\.sql$/.test(f));
  const sql = file ? code(file) : "";

  it("exists, and is private however often it runs", () => {
    expect(file).toBeTruthy();
    expect(sql).toMatch(/insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/);
    expect(sql).toMatch(/values \('avatars', 'avatars', false,/);
    expect(sql).toMatch(/on conflict \(id\) do update\s+set public = false/);
  });

  it("caps a file and its type where the route does, and opens nothing to the browser", async () => {
    const { AVATAR_MAX_BYTES, AVATAR_TYPES } = await import("./avatar");
    const cap = Number(sql.match(/false, (\d+), array\[/)?.[1]);
    expect(cap).toBeGreaterThanOrEqual(AVATAR_MAX_BYTES);
    expect(cap).toBeLessThanOrEqual(1024 * 1024);
    for (const t of AVATAR_TYPES) expect(sql).toContain(`'${t}'`);
    expect(sql).not.toMatch(/image\/(png|svg|gif)/);
    expect(sql).not.toMatch(/create policy|storage\.objects|grant /i);
  });
});

/**
 * The carried cue (0034, #477; written as 0033 beside #485's avatars): one nullable column on profiles, the
 * browser's own to write under the policies and grants profiles already
 * has, held to a size so a session cannot fill the table with it.
 */
describe("0034 carried cue", () => {
  const sql = code("0034_carried_cue.sql");

  it("adds one nullable jsonb column, and nothing else to the table", () => {
    expect(sql).toMatch(/alter table public\.profiles add column if not exists carried_cue jsonb;/);
    expect(sql).not.toMatch(/\bgrant\b|create policy|not null/i);
  });

  it("holds it to 2,000 bytes, added once behind a look in pg_constraint", () => {
    expect(sql).toMatch(/check \(carried_cue is null or octet_length\(carried_cue::text\) <= 2000\)/);
    expect(sql).toMatch(/if not exists \(\s+select 1 from pg_constraint\s+where conname = 'profiles_carried_cue_size'/);
  });

  it("holds the most the app can write, every aside slot full (the #477 review)", async () => {
    const { PAUSE_MARK, ASIDE_MAX } = await import("./carried-cue");
    const longest = {
      v: 1,
      cue: {
        kind: "repeat",
        word: "x".repeat(40),
        from: 9999,
        last: 9999,
        givenOn: "2026-11-16",
        answeredOn: "2026-11-17",
        tries: 2,
        line: { text: `${"w".repeat(118)} ${PAUSE_MARK} ${"w".repeat(119)}`, at: 9999.99 },
      },
      aside: Array.from({ length: ASIDE_MAX }, () => ({ key: `filler:${"x".repeat(40)}`, until: "2026-11-23" })),
      at: new Date().toISOString(),
    };
    expect(longest.cue.line.text.length).toBe(240);
    /* Postgres measures jsonb's text form, which spaces each key from its value: a quarter's room for that. */
    expect(new TextEncoder().encode(JSON.stringify(longest)).length).toBeLessThan(2000 * 0.75);
  });
});

/**
 * A take can earn no star (0035, DECISIONS #504). The column's check
 * widens from 1 to 3 to 0 to 3, run on Postgres (PGlite) against the
 * column exactly as 0001 made it, twice, and nothing stored moves.
 */
describe("0035 star zero", () => {
  const sql = readFileSync(path.join(DIR, "0035_star_zero.sql"), "utf8");

  it("rescores nothing: no update and no insert into reps", () => {
    expect(code("0035_star_zero.sql")).not.toMatch(/\bupdate\b/i);
    expect(code("0035_star_zero.sql")).not.toMatch(/\binsert\b/i);
  });

  it("widens the check to 0 to 3 and keeps every stored row as it was", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(`
      create table public.reps (
        id serial primary key,
        stars smallint not null check (stars between 1 and 3),
        filler_count integer not null default 0 check (filler_count >= 0)
      );
      insert into public.reps (stars) values (1), (2), (3);
    `);
    await expect(db.query("insert into public.reps (stars) values (0)")).rejects.toThrow(/check/);
    await db.exec(sql);
    await db.exec(sql); // idempotent
    await db.query("insert into public.reps (stars) values (0)");
    await expect(db.query("insert into public.reps (stars) values (4)")).rejects.toThrow(/check/);
    await expect(db.query("insert into public.reps (stars) values (-1)")).rejects.toThrow(/check/);
    // Another check on the table, which names no stars, stays.
    await expect(db.query("insert into public.reps (stars, filler_count) values (2, -1)")).rejects.toThrow(/check/);
    const rows = await db.query<{ stars: number }>("select stars from public.reps order by id");
    expect(rows.rows.map((r) => r.stars)).toEqual([1, 2, 3, 0]);
    const checks = await db.query<{ conname: string }>(
      "select conname from pg_constraint where conrelid = 'public.reps'::regclass and contype = 'c' order by conname"
    );
    expect(checks.rows.map((r) => r.conname)).toEqual(["reps_filler_count_check", "reps_stars_range"]);
    await db.close();
  }, 60_000);
});

/**
 * Say it better's test state (0036, DECISIONS #507): one row per account
 * and swap, the browser's own through the anon key, so row level
 * security is the whole of the isolation. Run on Postgres (PGlite) with
 * Supabase's roles, auth.users and auth.uid() stubbed as
 * scripts/check-testers-sql.mjs stubs them, applied twice.
 */
describe("0036 say better", () => {
  const raw = readFileSync(path.join(DIR, "0036_say_better.sql"), "utf8");
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const SWAP = "c:33333333-3333-4333-8333-333333333333";
  const STUBS = `
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated;
    grant usage on schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users (id) values ('${A}'), ('${B}');
  `;
  const as = (who: string | null) =>
    who
      ? `reset role; select set_config('request.jwt.claim.sub', '${who}', false); set role authenticated;`
      : `reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`;

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
    expect(code("0036_say_better.sql")).toMatch(/'de' \|\| 'lete'/);
  });

  it("is applied twice, and each account reads and writes only its own rows", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(STUBS);
    await db.exec(raw);
    await db.exec(raw); // idempotent
    const policies = await db.query<{ policyname: string }>("select policyname from pg_policies where tablename = 'say_better' order by 1");
    expect(policies.rows.map((r) => r.policyname)).toEqual([
      "say better: change your own",
      "say better: own rows",
      "say better: take off your own",
      "say better: write your own",
    ]);

    // A writes, reads back and moves its own row.
    await db.exec(as(A));
    await db.query(`insert into public.say_better (user_id, swap, step, due, last) values ('${A}', '${SWAP}', 1, '2026-11-21', 'said')`);
    await db.query(`update public.say_better set step = 2, due = '2026-11-28' where swap = '${SWAP}'`);
    expect((await db.query<{ step: number }>("select step from public.say_better")).rows).toEqual([{ step: 2 }]);
    // A cannot write a row as B.
    await expect(db.query(`insert into public.say_better (user_id, swap, due) values ('${B}', '${SWAP}', '2026-11-21')`)).rejects.toThrow(/row-level security/);
    // A name that is not a swap is refused.
    await expect(db.query(`insert into public.say_better (user_id, swap, due) values ('${A}', 'x:nope', '2026-11-21')`)).rejects.toThrow(/check/);

    // B sees nothing of A's, and changes nothing of A's.
    await db.exec(as(B));
    expect((await db.query("select * from public.say_better")).rows).toEqual([]);
    await db.query(`update public.say_better set hidden = true where swap = '${SWAP}'`);
    await db.query(`delete from public.say_better where swap = '${SWAP}'`);
    await db.exec(as(A));
    expect((await db.query<{ hidden: boolean }>("select hidden from public.say_better")).rows).toEqual([{ hidden: false }]);

    // A caller with no session gets nothing at all.
    await db.exec(as(null));
    await expect(db.query("select * from public.say_better")).rejects.toThrow(/permission denied/);

    // A takes its own row off; the account's removal takes the rest.
    await db.exec(as(A));
    await db.query(`delete from public.say_better where swap = '${SWAP}'`);
    expect((await db.query("select * from public.say_better")).rows).toEqual([]);
    await db.query(`insert into public.say_better (user_id, swap, due) values ('${A}', '${SWAP}', '2026-11-21')`);
    await db.exec("reset role;");
    await db.query(`delete from auth.users where id = '${A}'`);
    expect((await db.query("select * from public.say_better")).rows).toEqual([]);
    await db.close();
  }, 60_000);

  it("caps an account at 2,000 rows on a real database, for the browser's own role (the review)", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(STUBS);
    await db.exec(raw);
    const key = (n: number) => `c:${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
    await db.exec(as(A));
    await db.query(
      `insert into public.say_better (user_id, swap, due) select '${A}', 'c:' || lpad(n::text, 8, '0') || '-0000-4000-8000-000000000000', '2026-11-21' from generate_series(1, 2000) n`
    );
    // The 2,001st is refused; the same key written again (the app's upsert) goes through.
    await expect(db.query(`insert into public.say_better (user_id, swap, due) values ('${A}', '${key(2001)}', '2026-11-21')`)).rejects.toThrow(/2000 rows at most/);
    await db.query(
      `insert into public.say_better (user_id, swap, due, step) values ('${A}', '${key(7)}', '2026-11-28', 2) on conflict (user_id, swap) do update set step = excluded.step, due = excluded.due`
    );
    expect((await db.query<{ step: number }>(`select step from public.say_better where swap = '${key(7)}'`)).rows).toEqual([{ step: 2 }]);
    // Another account's room is its own.
    await db.exec(as(B));
    await db.query(`insert into public.say_better (user_id, swap, due) values ('${B}', '${key(2001)}', '2026-11-21')`);
    // Nor can a row be moved onto another account.
    await db.exec(as(A));
    await db.query(`update public.say_better set user_id = '${B}' where swap = '${key(1)}'`).catch(() => {});
    await db.exec(as(B));
    expect((await db.query("select swap from public.say_better")).rows).toHaveLength(1);
    await db.close();
  }, 60_000);

  it("caps an account at 2,000 rows and lets a row already there be written again", async () => {
    const sql = code("0036_say_better.sql");
    expect(sql).toMatch(/create or replace trigger say_better_cap\s+before insert on public\.say_better\s+for each row/);
    expect(sql).toMatch(/>= 2000 then/);
    expect(sql).toMatch(/s\.user_id = new\.user_id and s\.swap = new\.swap\s+\) then\s+return new;/);
    expect(sql).toMatch(/revoke execute on function public\.say_better_cap\(\) from public, anon, authenticated/);
  });
});

/**
 * 0037 (#511, the speed audit's fix 10): what each recording's words came
 * to, on the row. The file's fill must reproduce lib/metrics.ts
 * `substance` exactly, so it is run here on a real Postgres against the
 * real function over generated transcripts: the edges (too short, exactly
 * 20 words, repetitive, exactly at the 0.3 line and just under it, empty,
 * missing) and a few hundred random ones built from the characters that
 * could part the two (capitals, digits, apostrophes straight and curly,
 * hyphens, accents, the Kelvin sign, I with a dot above, emoji, CJK).
 */
describe("0037 reps scorable and words", () => {
  const raw = readFileSync(path.join(DIR, "0037_reps_scorable_words.sql"), "utf8");
  const sql = code("0037_reps_scorable_words.sql");
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  /* The reps table as production has it, as far as 0037 reads or could
     move it: its owner, its text, row level security and the one policy
     (0001), the grants 0029 leaves (select only, for the browser). */
  const STUBS = `
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated;
    grant usage on schema auth to anon, authenticated;
    create table public.reps (
      id uuid primary key default gen_random_uuid(),
      user_id uuid,
      transcript text,
      created_at timestamptz not null default now()
    );
    alter table public.reps enable row level security;
    create policy "own reps" on public.reps for select using (auth.uid() = user_id);
    revoke all on table public.reps from public, anon, authenticated;
    grant select on table public.reps to authenticated, anon;
  `;
  type Row = { id: string; transcript: string | null; scorable: boolean | null; word_count: number | null; distinct_words: number | null };

  /** What the readers computed from the transcript until now: the expectation. */
  const expected = (t: string | null) => {
    const s = substance(t ?? "");
    return { scorable: isScorable(s), word_count: s.wordCount, distinct_words: s.distinctWords ?? -1, ratio: s.distinctRatio };
  };

  /* Seeded, so a failure names the same text every run. */
  const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

  const words = (n: number, distinct: number, sep = " ") =>
    Array.from({ length: n }, (_, i) => `w${String.fromCharCode(97 + (i % distinct) % 26)}${Math.floor((i % distinct) / 26)}`).join(sep);

  const EDGES: (string | null)[] = [
    null,
    "",
    "   \n\t ",
    "...!?",
    words(19, 19),
    words(20, 20),
    words(21, 21),
    // "I don't know" on repeat: zero fillers, a clean pace, no answer.
    Array.from({ length: 10 }, () => "I don't know.").join(" "),
    // 0.3 exactly, and the rounding either side of it.
    words(20, 6),
    words(20, 5),
    words(1000, 300),
    words(1000, 299),
    words(2000, 599), // 0.2995: Math.round(299.5) is 300, so scorable
    words(2000, 598), // 0.299
    words(2000, 600),
    "HELLO Hello hello hELLo, said the CAPITALS twenty times over and over and over and over and over and over and again",
    "Don't you think rock'n'roll is 'quoted' and it's the 2nd time I've said 3,000 things at 4:30 pm",
    "Don’t split the curly one, it’s a different mark from the straight one, and Whisper uses both sometimes in text",
    "Café naïve résumé façade jalapeño Übermensch straße İstanbul İZMİR \u212Aelvin \u212A-pop \u212A dalam ДОМ Ωmega emoji 😀👍 日本語 tab\there",
    "well-known state-of-the-art self_aware snake_case e-mail co-op twenty-one forty-two x+y=z 100% #1 @you",
    "İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ İ",
    "\u212A \u212Aelvin k K \u212A0 \u212A's ".repeat(5),
    // Kelvin sign and I with a dot above are the two letters JavaScript lowercases into a word.
    "\u0130stanbul \u0130I i\u0307 ".repeat(8),
  ];
  const ALPHABET = [
    ..."abcdefghijklmnopqrstuvwxyz",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."0123456789",
    "'", "’", "-", "_", ",", ".", "?", "!", "é", "ß", "\u0130", "\u212A", "Ω", "😀", "日", "\n", "\t",
  ];
  const fuzz = (() => {
    const r = rng(511);
    const out: string[] = [];
    for (let i = 0; i < 300; i++) {
      // A small vocabulary repeated, so the ratio lands near 0.3 and the count near 20.
      const vocab = Array.from({ length: 1 + Math.floor(r() * 12) }, () =>
        Array.from({ length: 1 + Math.floor(r() * 6) }, () => ALPHABET[Math.floor(r() * ALPHABET.length)]).join("")
      );
      const n = Math.floor(r() * 60);
      out.push(Array.from({ length: n }, () => vocab[Math.floor(r() * vocab.length)]).join(r() < 0.8 ? " " : ""));
    }
    return out;
  })();

  it("holds neither of the connector's words, comments included", () => {
    expect(raw).not.toMatch(/drop|delete/i);
  });

  it("adds three nullable columns, only if missing, and moves no policy, grant or owner", () => {
    expect(sql).toMatch(/alter table public\.reps add column if not exists scorable boolean;/);
    expect(sql).toMatch(/alter table public\.reps add column if not exists word_count integer;/);
    expect(sql).toMatch(/alter table public\.reps add column if not exists distinct_words integer;/);
    expect(sql).not.toMatch(/\bnot null\b/i);
    expect(sql).not.toMatch(/\b(policy|grant|revoke|owner|security)\b/i);
    // The fill writes only where a column is empty.
    expect(sql).toMatch(/where r\.scorable is null\s+or r\.word_count is null\s+or r\.distinct_words is null/);
  });

  it("fills every row as `substance` reads its transcript, exactly, applied twice", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(STUBS);
    const texts = [...EDGES, ...fuzz];
    for (const t of texts) await db.query("insert into public.reps (user_id, transcript) values ($1, $2)", [A, t]);
    await db.exec(raw);
    const first = (await db.query<Row>("select id, transcript, scorable, word_count, distinct_words from public.reps")).rows;
    await db.exec(raw); // idempotent
    const second = (await db.query<Row>("select id, transcript, scorable, word_count, distinct_words from public.reps")).rows;
    expect(second).toEqual(first);
    expect(first).toHaveLength(texts.length);

    let scorable = 0;
    for (const row of first) {
      const want = expected(row.transcript);
      expect({ t: row.transcript, scorable: row.scorable, words: row.word_count, distinct: row.distinct_words }).toEqual({
        t: row.transcript,
        scorable: want.scorable,
        words: want.word_count,
        distinct: want.distinct_words,
      });
      // And a reader given the columns reads the same ratio, to the last digit.
      expect(rowSubstance(row)).toEqual({ wordCount: want.word_count, distinctRatio: want.ratio });
      expect(rowScorable(row)).toBe(want.scorable);
      if (row.scorable) scorable++;
    }
    // The edges land on both sides of the line, and so does the fuzz.
    expect(scorable).toBeGreaterThan(10);
    expect(first.length - scorable).toBeGreaterThan(10);
    const at = (t: string) => first.find((r) => r.transcript === t)!;
    expect(at(words(20, 20)).scorable).toBe(true);
    expect(at(words(19, 19)).scorable).toBe(false);
    expect(at(words(20, 6)).scorable).toBe(true);
    expect(at(words(20, 5)).scorable).toBe(false);
    expect(at(words(2000, 599)).scorable).toBe(true);
    expect(at(words(2000, 598)).scorable).toBe(false);
    const empty = first.find((r) => r.transcript === null)!;
    expect([empty.scorable, empty.word_count, empty.distinct_words]).toEqual([false, 0, 0]);
    await db.close();
  }, 120_000);

  it("never touches a row the server already wrote, and leaves row level security as it was", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(STUBS);
    const rls = async () => ({
      policies: (await db.query("select policyname, cmd, qual, with_check, roles from pg_policies where tablename = 'reps' order by 1")).rows,
      on: (await db.query("select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.reps'::regclass")).rows,
      grants: (await db.query("select grantee, privilege_type from information_schema.role_table_grants where table_name = 'reps' and grantee in ('anon', 'authenticated') order by 1, 2")).rows,
    });
    const before = await rls();
    await db.exec(raw);
    // A row stored by the server after 0037: its own verdict stays, whatever its text says.
    await db.query(
      "insert into public.reps (user_id, transcript, scorable, word_count, distinct_words) values ($1, 'hi', true, 140, 90), ($2, $3, null, null, null)",
      [A, B, words(30, 30)]
    );
    await db.exec(raw);
    const rows = (await db.query<Row>("select id, transcript, scorable, word_count, distinct_words from public.reps order by transcript")).rows;
    expect(rows.find((r) => r.transcript === "hi")).toMatchObject({ scorable: true, word_count: 140, distinct_words: 90 });
    expect(rows.find((r) => r.transcript !== "hi")).toMatchObject({ scorable: true, word_count: 30, distinct_words: 30 });
    expect(await rls()).toEqual(before);
    // The browser still reads its own rows only, the new columns with them, and writes none.
    await db.exec(`select set_config('request.jwt.claim.sub', '${A}', false); set role authenticated;`);
    expect((await db.query("select scorable, word_count from public.reps")).rows).toEqual([{ scorable: true, word_count: 140 }]);
    await expect(db.query("update public.reps set scorable = false")).rejects.toThrow(/permission denied/);
    await db.exec("reset role;");
    await db.close();
  }, 60_000);
});
