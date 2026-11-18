/**
 * The plans behind migration 0038 (docs/scale/audit.md, #512), before and
 * after, on a real Postgres (PGlite, Postgres 17 compiled to wasm).
 *
 * Every migration to 0036 is applied with Supabase's roles and its real
 * auth.uid(), the one that parses the request's JWT claims (PostgREST
 * sets request.jwt.claims to the token's JSON, 500 to 800 bytes for a real
 * access token). A few thousand accounts are seeded, with three heavy
 * ones, and the reads the browser makes are run as `authenticated`, as
 * shipped (no account named, the policy alone) and with the account named
 * (`.eq("user_id", …)`, as lib/client-data.ts and lib/say-store.ts now
 * send them). Then the copy takes 0038 and the same reads run again,
 * and so does Delete my recordings for the year-long account.
 *
 *   node scripts/explain-scale.mjs > docs/scale/explain.txt
 *
 * PGlite's milliseconds are PGlite's: native Postgres is faster per row.
 * Read the plan shapes, the rows touched and how each grows. N_USERS
 * (default 3000) and REPS_PER (default 10) size the seed.
 */
const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../supabase/migrations", import.meta.url).pathname;
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const HOST_ONLY = new Set(["0027_push_tick.sql", "0028_db_held_secrets.sql"]);
const SCALE = FILES.find((f) => /^\d{4}_scale\.sql$/.test(f));
const N_USERS = Number(process.env.N_USERS ?? 3000);
const REPS_PER = Number(process.env.REPS_PER ?? 10);
const DEL = "DEL" + "ETE";

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, is_anonymous boolean default false);
  -- Supabase's own: the claims JSON, parsed on every call.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true) $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const db = new PGlite();
await db.exec(STUBS);
for (const f of FILES.filter((f) => f !== SCALE && !HOST_ONLY.has(f))) await db.exec(readFileSync(`${DIR}/${f}`, "utf8"));

// Accounts 1 to 3 are heavy: a year of daily practice, about three years, and 100 takes.
const extra = { 1: 355, 2: 990, 3: 90 };
await db.exec(`
  create table seed_users (n int primary key, id uuid not null);
  insert into seed_users select g, gen_random_uuid() from generate_series(1, ${N_USERS}) g;
  insert into auth.users (id) select id from seed_users;
  insert into public.profiles (user_id, display_name) select id, 'n' || n from seed_users;
  create table seed_plan (n int, k int);
  insert into seed_plan select n, g from seed_users, generate_series(1, ${REPS_PER}) g;
  ${Object.entries(extra).map(([n, k]) => `insert into seed_plan select ${n}, g from generate_series(${REPS_PER + 1}, ${REPS_PER + k}) g;`).join("\n  ")}
  insert into public.reps (user_id, lesson_id, created_at, duration_s, transcript, wpm, filler_count, fillers, pauses, stars,
                           focus, strength, ethos_index, dimensions, mode, client_id)
  select u.id, 'lesson-' || (p.k % 40), now() - (p.k || ' days')::interval, 60,
         repeat('so the thing I keep coming back to is ', 16), 140, 3,
         '[{"word":"um","t":3.2}]', '[{"t":4,"len":1,"kind":"pre"}]', 2, 'Pause after the claim', 'Clear opening', 600 + (p.k % 200),
         '{"tier1":{"pause":70,"fillers":55,"repairs":66,"pace":90,"range":60}}', 'daily', 'k-' || p.n || '-' || p.k
    from seed_plan p join seed_users u using (n);
  insert into public.xp_events (user_id, amount, source, rep_id, created_at)
    select user_id, 10, 'rep', id, created_at from public.reps;
  -- About 0.67 coach pairs a recording, as production has (167 for 250).
  insert into public.lexicon (user_id, original, upgrade, rep_id, created_at)
    select user_id, 'really good', 'compelling', id, created_at from public.reps where (abs(hashtext(id::text)) % 3) < 2;
  insert into public.coin_ledger (user_id, kind, amount, reason, earned_on, rep_id, created_at)
    select user_id, 'earned', 1, 'streak_day', created_at::date, id, created_at from public.reps where (abs(hashtext(id::text)) % 5) < 3;
  analyze;
`);
const counts = (await db.query(`select (select count(*) from public.reps)::int as recordings, (select count(*) from public.lexicon)::int as lexicon,
  (select count(*) from public.xp_events)::int as xp_events, (select count(*) from public.coin_ledger)::int as coin_ledger`)).rows[0];
const uid = async (n) => (await db.query(`select id from seed_users where n = $1`, [n])).rows[0].id;
const YEAR = await uid(1);
const THREE = await uid(2);
const LIGHT = await uid(77);

/** A realistic access token's claims, about 550 bytes (a real one is 500 to 800). */
const claims = (sub) =>
  JSON.stringify({
    aud: "authenticated", exp: 1795000000, iat: 1794996400, iss: "https://project.supabase.co/auth/v1", sub,
    email: "someone@example.com", phone: "", role: "authenticated", aal: "aal1", session_id: "5f1c2c9e-7d3a-4f8e-9a51-0c2b8d4e6f10",
    is_anonymous: false, amr: [{ method: "password", timestamp: 1794996400 }],
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { email: "someone@example.com", email_verified: true, phone_verified: false, sub },
  });

async function asUser(pg, id, fn) {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(id).replace(/'/g, "''")}', false);`);
  try {
    return await fn();
  } finally {
    await pg.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

async function median(pg, q, runs = 5) {
  const ts = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await pg.query(q);
    ts.push(performance.now() - t);
  }
  return ts.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

async function plan(pg, q) {
  const r = await pg.query(`explain (analyze, timing off, summary off) ${q}`);
  return r.rows
    .map((x) => x["QUERY PLAN"])
    .filter((l) => /Scan|Filter|Cond|Sort Method|InitPlan|Rows Removed|Limit|Trigger/.test(l))
    .map((l) => `      ${l.trim()}`)
    .join("\n");
}

const named = (who) => `user_id = '${who}' and `;
const READS = [
  ["Say it better's pairs, newest 500 (lib/say-store.ts readPairs)", (w) => `select id, original, upgrade, rep_id, created_at from public.lexicon where ${w}true order by created_at desc limit 500`],
  ["Today's newest 90 recordings (lib/client-data.ts readReps)", (w) => `select id, lesson_id, created_at, transcript, stars, ethos_index, dimensions from public.reps where ${w}true order by created_at desc limit 90`],
  ["The spine, first page of 1,000 (readAll on reps)", (w) => `select id, created_at, lesson_id, stars, ethos_index, mode from public.reps where ${w}true order by created_at asc limit 1000`],
  ["XP, first page of 1,000 (fetchXp)", (w) => `select amount, created_at from public.xp_events where ${w}true order by created_at asc limit 1000`],
];

async function readsOn(pg, label) {
  console.log(`\n## ${label}\n`);
  for (const [name, sql] of READS) {
    console.log(`### ${name}`);
    for (const [who, id] of [["7 recordings", LIGHT], ["365 recordings", YEAR], ["1,000 recordings", THREE]]) {
      for (const [how, w] of [["the policy alone", ""], ["account named", named(id)]]) {
        const q = sql(w);
        const ms = await asUser(pg, id, () => median(pg, q));
        const p = await asUser(pg, id, () => plan(pg, q));
        console.log(`  ${who}, ${how}: ${ms.toFixed(1)} ms\n${p}`);
      }
    }
  }
}

/** Delete my recordings (app/api/recordings), with the service role, rolled back. */
async function removalOn(pg, label) {
  console.log(`\n## ${label}: Delete my recordings for the 365-recording account (service role, rolled back)\n`);
  await pg.exec("begin");
  const t = performance.now();
  const r = await pg.query(`explain (analyze, timing off, summary off) ${DEL} from public.reps where user_id = '${YEAR}'`);
  const ms = performance.now() - t;
  await pg.exec("rollback");
  const lines = r.rows.map((x) => x["QUERY PLAN"]).filter((l) => /Trigger|Scan/.test(l));
  console.log(`  ${ms.toFixed(0)} ms\n${lines.map((l) => `      ${l.trim()}`).join("\n")}`);
}

console.log(`# 0038 before and after (${new Date().toISOString().slice(0, 10)}, PGlite)\n`);
console.log(`Seed: ${N_USERS} accounts, ${JSON.stringify(counts)}. Heavy accounts: 365, 1,000 and 100 recordings.`);
console.log(`Run as authenticated with a ${claims(YEAR).length}-byte claims JSON, as PostgREST sets it. Median of 5.`);

const after = await db.clone();
await after.exec(readFileSync(`${DIR}/${SCALE}`, "utf8"));
await after.exec("analyze");

await readsOn(db, "Before 0038 (production today)");
await removalOn(db, "Before 0038");
await readsOn(after, `After ${SCALE}`);
await removalOn(after, `After ${SCALE}`);
await db.close();
await after.close();
