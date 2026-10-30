import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
