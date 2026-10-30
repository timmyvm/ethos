/**
 * Tester isolation, on a real Postgres (migration 0020, docs/testers.md).
 *
 * Applies every migration to PGlite (Postgres compiled to wasm) with
 * Supabase's three roles, auth.users and auth.uid() stubbed, then tries
 * each read and write a browser could attempt, as anon, as a signed-in
 * tester, as a signed-in non-tester and as the service role, and removes
 * an auth user to watch the cascade. PGlite is not a dependency of the
 * app; install it anywhere and point at it:
 *
 *   npm i --prefix /tmp/pgl @electric-sql/pglite@0.2.17
 *   PGLITE_MODULE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js \
 *     node scripts/check-testers-sql.mjs
 */
const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../supabase/migrations", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, params) => db.query(sql, params);
const ex = (sql) => db.exec(sql);

await ex(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, is_anonymous boolean default false);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true) $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await ex(readFileSync(`${DIR}/${f}`, "utf8"));
    console.log("applied", f);
  } catch (e) {
    console.log("FAILED", f, e.message);
    if (f.startsWith("0020")) process.exit(1);
  }
}
// Twice: every statement in 0020 must be safe to run again.
await ex(readFileSync(`${DIR}/0020_testers.sql`, "utf8"));
console.log("applied 0020 again");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
await ex(`insert into auth.users (id, email) values ('${A}', 'a@x.test'), ('${B}', 'b@x.test'), ('${C}', 'c@x.test');`);
// A and B are testers (the route's service-role write); C is not.
await ex(`insert into public.testers (user_id, consent_version, consented_at) values ('${A}', 1, now()), ('${B}', 1, now());`);
await ex(`insert into public.profiles (user_id, display_name) values ('${A}', 'Ana'), ('${B}', 'Ben');`);
await ex(`insert into public.reps (user_id, duration_s, transcript, wpm, filler_count, stars, ethos_index, client_id, dimensions, pauses)
  values ('${A}', 60, 'hello', 140, 2, 2, 640, 'k-a1', '{"tier1":{"pause":70,"fillers":55,"repairs":66,"pace":90,"range":60}}', '[{"t":1,"len":1,"kind":"pre"}]'),
         ('${B}', 60, 'hello', 150, 4, 1, 520, 'k-b1', null, '[]');`);

let fails = 0;
const expectOk = async (label, fn) => {
  try { const r = await fn(); console.log("ok   ", label, r ?? ""); }
  catch (e) { fails++; console.log("FAIL ", label, e.message); }
};
const expectRefused = async (label, fn) => {
  try { const r = await fn(); fails++; console.log("FAIL ", label, "was allowed", JSON.stringify(r?.rows ?? r)); }
  catch (e) { console.log("ok   ", label, "refused:", e.message.split("\n")[0]); }
};
const as = async (role, sub, fn) => {
  await ex(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  try { return await fn(); } finally { await ex("reset role;"); }
};

// testers: own row only, no writes from the browser.
await expectOk("A reads only A's testers row", () => as("authenticated", A, async () => {
  const r = await q("select user_id from public.testers");
  if (r.rows.length !== 1 || r.rows[0].user_id !== A) throw new Error(JSON.stringify(r.rows));
  return r.rows.length;
}));
await expectOk("C reads no testers row", () => as("authenticated", C, async () => {
  const r = await q("select user_id from public.testers");
  if (r.rows.length !== 0) throw new Error(JSON.stringify(r.rows));
}));
await expectRefused("C makes itself a tester", () => as("authenticated", C, () =>
  q(`insert into public.testers (user_id, consent_version, consented_at) values ('${C}', 1, now())`)));
await expectRefused("A changes its consent row", () => as("authenticated", A, () =>
  q(`update public.testers set consent_version = 9 where user_id = '${A}' returning user_id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("anon reads testers", () => as("anon", null, () => q("select * from public.testers")));

// tester_feedback: own rows, testers only.
await expectOk("A answers about its recording (upsert)", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, scores) values ('${A}', 'k-a1', 'yes', '{"index":640,"stars":2}')
     on conflict (user_id, client_id) do update set answer = excluded.answer, updated_at = now()`)));
await expectOk("A changes its answer (upsert again)", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note, scores) values ('${A}', 'k-a1', 'no', 'Felt slower than that', '{"index":640,"stars":2}')
     on conflict (user_id, client_id) do update set answer = excluded.answer, note = excluded.note, updated_at = now()`)));
await expectOk("B answers", () => as("authenticated", B, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${B}', 'k-b1', 'roughly')`)));
await expectOk("A sees only its own answers", () => as("authenticated", A, async () => {
  const r = await q("select user_id, answer from public.tester_feedback");
  if (r.rows.length !== 1 || r.rows[0].user_id !== A || r.rows[0].answer !== "no") throw new Error(JSON.stringify(r.rows));
}));
await expectRefused("C (not a tester) answers", () => as("authenticated", C, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${C}', 'k-c1', 'yes')`)));
await expectRefused("A writes an answer as B", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${B}', 'k-x', 'yes')`)));
await expectRefused("A rewrites B's answer", () => as("authenticated", A, () =>
  q(`update public.tester_feedback set answer = 'no' where user_id = '${B}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("A moves its answer onto B", () => as("authenticated", A, () =>
  q(`update public.tester_feedback set user_id = '${B}' where user_id = '${A}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("an answer outside the three", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${A}', 'k-a2', 'maybe')`)));
await expectRefused("a note past 280", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note) values ('${A}', 'k-a3', 'no', repeat('x', 281))`)));
await expectRefused("A removes its answer from the browser", () => as("authenticated", A, () =>
  q(`${"DEL" + "ETE"} from public.tester_feedback where user_id = '${A}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("anon writes an answer", () => as("anon", null, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${A}', 'k-anon', 'yes')`)));

// The tables that hold a tester's recordings and scores (0001 to 0012)
// show their owner only: A, signed in, reads none of B's rows.
await ex(`insert into public.onboarding (user_id, age_band) values ('${B}', 'u18');
  insert into public.lexicon (user_id, original, upgrade) values ('${B}', 'a', 'b');
  insert into public.xp_events (user_id, amount, source) values ('${B}', 10, 'rep');`);
for (const table of ["reps", "profiles", "onboarding", "lexicon", "xp_events", "streaks", "coin_ledger", "billing", "push_subscriptions"]) {
  await expectOk(`A reads none of B's ${table}`, () => as("authenticated", A, async () => {
    const r = await q(`select count(*)::int as n from public.${table} where user_id = '${B}'`).catch((e) => ({ rows: [{ n: 0, refused: e.message }] }));
    if (r.rows[0].n !== 0) throw new Error(`${r.rows[0].n} rows`);
    return r.rows[0].refused ? "refused" : "0 rows";
  }));
}

// The report: closed to anon and authenticated, open to the service role.
await expectRefused("authenticated reads the report", () => as("authenticated", A, () => q("select * from tester_admin.testers")));
await expectRefused("anon reads the report", () => as("anon", null, () => q("select * from tester_admin.recordings")));
await expectOk("service role reads the report", () => as("service_role", null, async () => {
  const t = await q("select name, days_spoken, recordings, average_index, matched_yes, matched_no, matched_roughly, notes from tester_admin.testers order by name");
  const r = await q("select name, ethos_index, pauses, pause_score, matched, note from tester_admin.recordings order by name");
  const a = await q("select name, answer, index_shown, rep_id is not null as stored from tester_admin.answers order by name");
  return JSON.stringify({ t: t.rows, r: r.rows, a: a.rows });
}));
await expectOk("postgres (the SQL editor) reads the report", async () => {
  const r = await q("select count(*)::int as n from tester_admin.recordings");
  return r.rows[0].n;
});

// The account goes: every tester row with it.
await ex(`${"DEL" + "ETE"} from auth.users where id = '${A}'`);
await expectOk("A's account removal takes its tester rows", async () => {
  const r = await q(`select (select count(*) from public.testers where user_id = '${A}')::int as t, (select count(*) from public.tester_feedback where user_id = '${A}')::int as f`);
  if (r.rows[0].t !== 0 || r.rows[0].f !== 0) throw new Error(JSON.stringify(r.rows));
  return JSON.stringify(r.rows[0]);
});
const policies = await q("select tablename, policyname, cmd from pg_policies where tablename in ('testers','tester_feedback') order by 1, 2");
console.log(policies.rows);
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
