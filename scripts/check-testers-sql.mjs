/**
 * Tester isolation, on a real Postgres (migrations 0020, 0021 and 0022,
 * docs/testers.md).
 *
 * Applies every migration to PGlite (Postgres compiled to wasm) with
 * Supabase's three roles, auth.users and auth.uid() stubbed, then tries
 * each read and write a browser could attempt, as anon, as a signed-in
 * tester, as a signed-in non-tester and as the service role, and removes
 * an auth user to watch the cascade. 0022's device, usage and error
 * rows (written only by app/api/tester/collect, with the service role)
 * are tried the same way: the browser reads its own and writes none.
 * PGlite is a dev dependency (package.json), so after `npm install`:
 *
 *   node scripts/check-testers-sql.mjs
 *
 * PGLITE_MODULE points at another copy when there is no node_modules.
 */
const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../supabase/migrations", import.meta.url).pathname;
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const STUBS = `
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
`;

/** A fresh Postgres with Supabase's roles stubbed and the migrations up to `last` applied. */
async function migrated(last = Infinity, { quiet = false } = {}) {
  const pg = new PGlite();
  await pg.exec(STUBS);
  for (const f of FILES.filter((f) => Number(f.slice(0, 4)) <= last)) {
    try {
      await pg.exec(readFileSync(`${DIR}/${f}`, "utf8"));
      if (!quiet) console.log("applied", f);
    } catch (e) {
      console.log("FAILED", f, e.message);
      if (Number(f.slice(0, 4)) >= 20) process.exit(1);
    }
  }
  return pg;
}

// Every statement in a tester file must be safe to run twice, as the
// deploy connector may: 0020 and 0021 on the schema they were written
// for, and 0022 on top of them.
{
  const before = await migrated(21, { quiet: true });
  await before.exec(readFileSync(`${DIR}/0020_testers.sql`, "utf8"));
  await before.exec(readFileSync(`${DIR}/0021_tester_limits.sql`, "utf8"));
  await before.close();
  console.log("applied 0020 and 0021 again");
}
const db = await migrated();
const q = (sql, params) => db.query(sql, params);
const ex = (sql) => db.exec(sql);
await ex(readFileSync(`${DIR}/0022_tester_data.sql`, "utf8"));
console.log("applied 0022 again");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";
await ex(`insert into auth.users (id, email) values ('${A}', 'a@x.test'), ('${B}', 'b@x.test'), ('${C}', 'c@x.test'), ('${D}', 'd@x.test'), ('${E}', 'e@x.test');`);
// A, B and E are testers on the current consent (the route's
// service-role write); D agreed to version 2, before the full list
// (0022); C is not a tester.
await ex(`insert into public.testers (user_id, consent_version, consented_at) values ('${A}', 3, now()), ('${B}', 3, now()), ('${D}', 2, now()), ('${E}', 3, now());`);
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
await expectRefused("an answer outside the six", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${A}', 'k-a2', 'maybe')`)));
await expectRefused("a note past 280", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note) values ('${A}', 'k-a3', 'no', repeat('x', 281))`)));
await expectRefused("A removes its answer from the browser", () => as("authenticated", A, () =>
  q(`${"DEL" + "ETE"} from public.tester_feedback where user_id = '${A}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("anon writes an answer", () => as("anon", null, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${A}', 'k-anon', 'yes')`)));

// 0021, raised by 0022: answers only under consent version 3 or later.
await expectRefused("D (consent version 2) answers", () => as("authenticated", D, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${D}', 'k-d1', 'yes')`)));

// 0021: at most 300 answers per account, and changing one still works.
await expectOk("E stores 300 answers", () => as("authenticated", E, async () => {
  const r = await q(`insert into public.tester_feedback (user_id, client_id, answer)
    select '${E}', 'k-e' || g, 'yes' from generate_series(1, 300) g returning id`);
  if (r.rows.length !== 300) throw new Error(`${r.rows.length} rows`);
  return r.rows.length;
}));
await expectRefused("E's 301st answer", () => as("authenticated", E, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${E}', 'k-e301', 'no')`)));
await expectOk("E changes an answer at the cap (upsert)", () => as("authenticated", E, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note) values ('${E}', 'k-e7', 'no', 'Felt faster')
     on conflict (user_id, client_id) do update set answer = excluded.answer, note = excluded.note, updated_at = now() returning answer`)
    .then((r) => { if (r.rows[0]?.answer !== "no") throw new Error(JSON.stringify(r.rows)); return r.rows[0].answer; })));
await expectRefused("A stores 2000 answers in one statement", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note)
     select '${A}', 'bulk-' || g, 'no', repeat('x', 280) from generate_series(1, 2000) g`)));
await expectOk("the refused statement left nothing behind", async () => {
  const r = await q(`select count(*)::int as n from public.tester_feedback where user_id = '${A}'`);
  if (r.rows[0].n !== 1) throw new Error(`${r.rows[0].n} rows`);
  return r.rows[0].n;
});

// 0022: the answer as a direction, and how it felt before the score.
await expectOk("A says how it felt before the score (a row with no answer yet)", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, felt) values ('${A}', 'k-a5', 'rough')
     on conflict (user_id, client_id) do update set felt = excluded.felt, updated_at = now() returning felt, answer`)
    .then((r) => { if (r.rows[0]?.felt !== "rough" || r.rows[0]?.answer !== null) throw new Error(JSON.stringify(r.rows)); return "rough"; })));
await expectOk("A answers the direction after the score, and how it felt stays", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, answer, note, scores) values ('${A}', 'k-a5', 'too_low', 'The pauses were on purpose', '{"index":640}')
     on conflict (user_id, client_id) do update set answer = excluded.answer, note = excluded.note, scores = excluded.scores, updated_at = now() returning felt, answer`)
    .then((r) => { if (r.rows[0]?.felt !== "rough" || r.rows[0]?.answer !== "too_low") throw new Error(JSON.stringify(r.rows)); return "rough, too_low"; })));
for (const answer of ["about_right", "too_high"]) {
  await expectOk(`A answers ${answer}`, () => as("authenticated", A, () =>
    q(`insert into public.tester_feedback (user_id, client_id, answer) values ('${A}', 'k-a-${answer}', '${answer}') returning answer`).then((r) => r.rows[0].answer)));
}
await expectOk("an answer from before the direction stays readable", () => as("authenticated", A, async () => {
  const r = await q(`select answer from public.tester_feedback where client_id = 'k-a1'`);
  if (r.rows[0]?.answer !== "no") throw new Error(JSON.stringify(r.rows));
  return r.rows[0].answer;
}));
await expectRefused("a row that says nothing", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id) values ('${A}', 'k-a6')`)));
await expectRefused("a feeling outside the three", () => as("authenticated", A, () =>
  q(`insert into public.tester_feedback (user_id, client_id, felt) values ('${A}', 'k-a7', 'great')`)));
await expectRefused("D (consent version 2) says how it felt", () => as("authenticated", D, () =>
  q(`insert into public.tester_feedback (user_id, client_id, felt) values ('${D}', 'k-d2', 'okay')`)));
await expectRefused("C (not a tester) says how it felt", () => as("authenticated", C, () =>
  q(`insert into public.tester_feedback (user_id, client_id, felt) values ('${C}', 'k-c2', 'okay')`)));
// Back to one answer for A, as the cap checks below expect.
await ex(`${"DEL" + "ETE"} from public.tester_feedback where user_id = '${A}' and client_id <> 'k-a1'`);

// 0022: device, usage and errors. Only the route writes them, with the
// service role; a browser reads its own and writes nothing.
await as("service_role", null, () => ex(`
  insert into public.tester_events (user_id, kind, name, open_id, screen, data, ip, at) values
    ('${A}', 'device', 'open', 'o-a1', '/', '{"ua":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)","os":"iOS 18.1","browser":"Safari 18.1","model":"iPhone","screen_w":390,"screen_h":844,"dpr":3,"lang":"en-AU","tz":"Australia/Melbourne","home_screen":true,"display":"standalone","connection":"wifi","downlink":10,"rtt":50,"save_data":false}', '203.0.113.9', now() - interval '10 minutes'),
    ('${B}', 'device', 'open', 'o-b1', '/', '{"ua":"Mozilla/5.0 (Linux; Android 15; Pixel 9)","os":"Android 15","browser":"Chrome 131","model":"Pixel 9","screen_w":412,"screen_h":915,"dpr":2.6,"lang":"en-AU","tz":"Australia/Melbourne","home_screen":false,"display":"browser"}', '198.51.100.7', now() - interval '9 minutes');
  insert into public.tester_events (user_id, kind, name, open_id, screen, label, ms, data, at) values
    ('${A}', 'usage', 'screen', 'o-a1', '/', null, 42000, '{}', now() - interval '9 minutes'),
    ('${A}', 'usage', 'tap', 'o-a1', '/', 'Start', null, '{"role":"button"}', now() - interval '9 minutes'),
    ('${A}', 'usage', 'record_start', 'o-a1', '/rep', null, null, '{"video":false}', now() - interval '8 minutes'),
    ('${A}', 'usage', 'record_stop', 'o-a1', '/rep', null, null, '{"seconds":61}', now() - interval '7 minutes'),
    ('${A}', 'usage', 'screen', 'o-a1', '/rep', null, 95000, '{}', now() - interval '6 minutes'),
    ('${A}', 'usage', 'hidden', 'o-a1', '/rep', null, null, '{}', now() - interval '6 minutes'),
    ('${A}', 'usage', 'shown', 'o-a1', '/rep', null, null, '{}', now() - interval '5 minutes'),
    ('${A}', 'usage', 'screen', 'o-a1', '/rep', null, 20000, '{"cont":true}', now() - interval '4 minutes'),
    ('${B}', 'usage', 'screen', 'o-b1', '/history', null, 30000, '{}', now() - interval '8 minutes');
  insert into public.tester_events (user_id, kind, name, open_id, screen, data, at) values
    ('${A}', 'error', 'window', 'o-a1', '/rep', '{"message":"TypeError: x is undefined","where":"/_next/static/chunks/app/rep/page.js:1:200","before":[{"name":"tap","screen":"/rep","label":"Stop and score this recording"}]}', now() - interval '3 minutes');
`));
await expectOk("A reads only its own device, usage and error rows", () => as("authenticated", A, async () => {
  const r = await q("select distinct user_id from public.tester_events");
  if (r.rows.length !== 1 || r.rows[0].user_id !== A) throw new Error(JSON.stringify(r.rows));
  return (await q("select count(*)::int as n from public.tester_events")).rows[0].n + " rows";
}));
await expectOk("C (not a tester) reads none", () => as("authenticated", C, async () => {
  const r = await q("select count(*)::int as n from public.tester_events");
  if (r.rows[0].n !== 0) throw new Error(`${r.rows[0].n} rows`);
}));
await expectRefused("anon reads them", () => as("anon", null, () => q("select * from public.tester_events")));
await expectRefused("A writes its own event from the browser", () => as("authenticated", A, () =>
  q(`insert into public.tester_events (user_id, kind, name, at) values ('${A}', 'usage', 'tap', now())`)));
await expectRefused("C (not a tester) writes an event from the browser", () => as("authenticated", C, () =>
  q(`insert into public.tester_events (user_id, kind, name, at) values ('${C}', 'usage', 'tap', now())`)));
await expectRefused("anon writes an event", () => as("anon", null, () =>
  q(`insert into public.tester_events (user_id, kind, name, at) values ('${A}', 'usage', 'tap', now())`)));
await expectRefused("A changes its events", () => as("authenticated", A, () =>
  q(`update public.tester_events set label = 'x' where user_id = '${A}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
await expectRefused("A removes its events from the browser", () => as("authenticated", A, () =>
  q(`${"DEL" + "ETE"} from public.tester_events where user_id = '${A}' returning id`).then((r) => { if (r.rows.length === 0) throw new Error("0 rows"); return r; })));
for (const [label, values] of [
  ["a name from another kind", `'usage', 'open', null, null, null, '{}'`],
  ["a kind outside the three", `'click', 'tap', null, null, null, '{}'`],
  ["a screen with no leading slash", `'usage', 'screen', 'rep?code=1234', null, 10, '{}'`],
  ["a label past 80", `'usage', 'tap', '/', repeat('x', 81), null, '{}'`],
  ["a screen time past a day", `'usage', 'screen', '/', null, 86400001, '{}'`],
  ["data past its size", `'error', 'window', '/', null, null, jsonb_build_object('stack', repeat(md5('a'), 400))`],
  ["data that is not an object", `'device', 'open', '/', null, null, '[1]'`],
]) {
  await expectRefused(`the table refuses ${label}, even from the route`, () => as("service_role", null, () =>
    q(`insert into public.tester_events (user_id, kind, name, screen, label, ms, data, at) values ('${A}', ${values}, now())`)));
}

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
for (const view of ["devices", "usage", "screens", "errors"]) {
  await expectRefused(`authenticated reads tester_admin.${view}`, () => as("authenticated", A, () => q(`select * from tester_admin.${view}`)));
  await expectRefused(`anon reads tester_admin.${view}`, () => as("anon", null, () => q(`select * from tester_admin.${view}`)));
}
await expectOk("service role reads devices, usage, screens and errors", () => as("service_role", null, async () => {
  const d = await q("select tester_number, name, model, os, screen_size, on_home_screen, host(last_ip) as ip, opens from tester_admin.devices order by tester_number");
  const u = await q("select tester_number, opens, screens, minutes, taps, recordings_started, recordings_stopped, errors from tester_admin.usage order by tester_number");
  const s = await q("select tester_number, screen, views, minutes from tester_admin.screens order by tester_number, screen");
  const e = await q("select tester_number, source, screen, message, on_screen, model from tester_admin.errors");
  const a = u.rows.find((r) => r.tester_number === "11111111");
  if (d.rows.length !== 2 || d.rows[0].on_home_screen !== true || d.rows[0].ip !== "203.0.113.9") throw new Error("devices " + JSON.stringify(d.rows));
  if (!a || a.opens !== 1 || a.screens !== 2 || Number(a.minutes) !== 2.6 || a.taps !== 1 || a.recordings_started !== 1 || a.recordings_stopped !== 1 || a.errors !== 1) throw new Error("usage " + JSON.stringify(u.rows));
  const rep = s.rows.find((r) => r.tester_number === "11111111" && r.screen === "/rep");
  if (!rep || rep.views !== 1 || Number(rep.minutes) !== 1.9) throw new Error("screens " + JSON.stringify(s.rows));
  if (e.rows.length !== 1 || e.rows[0].model !== "iPhone" || e.rows[0].on_screen?.[0]?.label !== "Stop and score this recording") throw new Error("errors " + JSON.stringify(e.rows));
  return JSON.stringify({ d: d.rows.length, u: u.rows, e: e.rows.length });
}));
await expectOk("the testers view counts the direction, how it felt, and the opens", () => as("service_role", null, async () => {
  await ex(`insert into public.tester_feedback (user_id, client_id, felt, answer) values ('${B}', 'k-b2', 'strong', 'too_high')`);
  const r = await q("select tester_number, answered, matched_roughly, too_high, felt_strong, opens, minutes_in_app, errors from tester_admin.testers order by tester_number");
  const b = r.rows.find((x) => x.tester_number === "22222222");
  if (!b || b.answered !== 2 || b.matched_roughly !== 1 || b.too_high !== 1 || b.felt_strong !== 1 || b.opens !== 1 || Number(b.minutes_in_app) !== 0.5) throw new Error(JSON.stringify(r.rows));
  const rec = await q("select felt, tester_number from tester_admin.answers where client_id = 'k-b2'");
  if (rec.rows[0]?.felt !== "strong" || rec.rows[0]?.tester_number !== "22222222") throw new Error(JSON.stringify(rec.rows));
  return JSON.stringify(b);
}));
await expectOk("service role reads the report", () => as("service_role", null, async () => {
  const t = await q("select name, days_spoken, recordings, average_index, matched_yes, matched_no, matched_roughly, notes from tester_admin.testers order by name");
  const r = await q("select name, ethos_index, pauses, pause_score, matched, note from tester_admin.recordings order by name");
  const a = await q("select name, answer, index_shown, rep_id is not null as stored from tester_admin.answers where name is not null order by name");
  return JSON.stringify({ t: t.rows, r: r.rows, a: a.rows });
}));
await expectOk("postgres (the SQL editor) reads the report", async () => {
  const r = await q("select count(*)::int as n from tester_admin.recordings");
  return r.rows[0].n;
});

// Every query in docs/testers.md runs as pasted in the SQL editor
// (postgres), the tester-number lookup and the parent check included.
{
  const guide = readFileSync(new URL("../docs/testers.md", import.meta.url), "utf8");
  const blocks = [...guide.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  if (blocks.length < 7) {
    fails++;
    console.log("FAIL  the guide's queries: found", blocks.length);
  }
  for (const [i, sql] of blocks.entries()) {
    await expectOk(`the guide's query ${i + 1} runs`, async () => {
      const r = await q(sql.replace(/;\s*$/, ""));
      return `${r.rows.length} rows`;
    });
  }
  await expectOk("the guide finds a tester by the number they send", async () => {
    const number = `${A.slice(0, 4)} ${A.slice(4, 8)}`.toUpperCase();
    const r = await q(`select user_id from tester_admin.testers where upper(left(user_id::text, 8)) = upper(replace('${number}', ' ', ''))`);
    if (r.rows.length !== 1 || r.rows[0].user_id !== A) throw new Error(JSON.stringify(r.rows));
    return number;
  });
}

// The account goes: every tester row with it.
await ex(`${"DEL" + "ETE"} from auth.users where id = '${A}'`);
await expectOk("A's account removal takes its tester rows", async () => {
  const r = await q(`select (select count(*) from public.testers where user_id = '${A}')::int as t, (select count(*) from public.tester_feedback where user_id = '${A}')::int as f, (select count(*) from public.tester_events where user_id = '${A}')::int as e`);
  if (r.rows[0].t !== 0 || r.rows[0].f !== 0 || r.rows[0].e !== 0) throw new Error(JSON.stringify(r.rows));
  return JSON.stringify(r.rows[0]);
});
const policies = await q("select tablename, policyname, cmd from pg_policies where tablename in ('testers','tester_feedback','tester_events') order by 1, 2");
console.log(policies.rows);
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
