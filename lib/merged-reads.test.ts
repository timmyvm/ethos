import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rowScorable, rowSubstance } from "./rep-substance";

/*
 * The seams between #511 and #512, on a real Postgres (the final pass of
 * 19 Nov). #511 made the lists read 0037's three columns instead of every
 * transcript (lib/client-data.ts readListed, with its 42703 fallback and a
 * per-row transcript read); #512 made every browser read name its account
 * (lib/own-rows.ts own()) and wrapped fifteen policies (0038). The lead
 * merged both into lib/client-data.ts by hand. Here the app's own reads
 * (client-data, say-store, saved-words) run unchanged against PGlite, as
 * the browser's role under row level security, through a stand-in for
 * supabase-js that turns each query into SQL and hands back Postgres's
 * own answer, its 42703 included. They run before 0037 and 0038, after
 * either one alone, and after both, each file applied twice, in both
 * orders. At every stage:
 *   a. every read of a table names the account, or reads one recording
 *      by its id (the per-row transcript read, the stored page);
 *   b. Say it better's count reads transcripts with a select that names
 *      them, never the lists, which after 0037 carry none;
 *   e. every read answers, and answers the same thing.
 */

const DIR = path.resolve(__dirname, "../supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const HOST_ONLY = new Set(["0027_push_tick.sql", "0028_db_held_secrets.sql"]);
const F0037 = readFileSync(path.join(DIR, "0037_reps_scorable_words.sql"), "utf8");
const F0038 = readFileSync(path.join(DIR, "0038_scale.sql"), "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

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
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

type PG = import("@electric-sql/pglite").PGlite;

interface Read {
  table: string;
  select: string;
  /** "eq:user_id", "in:id", "like:lesson_id", … in the order the query named them. */
  filters: string[];
  /** Postgres's code when it refused the read. */
  error: string | null;
}

const h = vi.hoisted(() => {
  const state = {
    db: null as null | {
      exec: (sql: string) => Promise<unknown>;
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    },
    me: "",
    reads: [] as Read[],
    /** What the reads wrote back (a swap marked heard), by table. */
    writes: [] as { table: string; rows: unknown }[],
  };
  /* "words:whisper_raw->words" is supabase-js for a json field under an alias. */
  const col = (c: string) => {
    const m = /^(\w+):(\w+)->(\w+)$/.exec(c.trim());
    return m ? `${m[2]}->'${m[3]}' as ${m[1]}` : c.trim();
  };
  function from(table: string) {
    const q = { select: "*", where: [] as string[], params: [] as unknown[], order: [] as string[], limit: null as number | null, offset: 0, filters: [] as string[] };
    const p = (v: unknown) => {
      q.params.push(v);
      return `$${q.params.length}`;
    };
    async function run(): Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> {
      const sql =
        `select ${q.select.split(",").map(col).join(", ")} from public.${table}` +
        (q.where.length ? ` where ${q.where.join(" and ")}` : "") +
        (q.order.length ? ` order by ${q.order.join(", ")}` : "") +
        (q.limit !== null ? ` limit ${q.limit}` : "") +
        (q.offset ? ` offset ${q.offset}` : "");
      const read: Read = { table, select: q.select, filters: q.filters, error: null };
      state.reads.push(read);
      const db = state.db!;
      try {
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${state.me}', false); set role authenticated;`);
        const r = await db.query(sql, q.params);
        return { data: r.rows, error: null };
      } catch (e) {
        const err = e as { code?: string; message?: string };
        read.error = err.code ?? "error";
        return { data: null, error: { code: err.code, message: err.message } };
      } finally {
        await db.exec("reset role;");
      }
    }
    const api: Record<string, unknown> = {
      select(cols: string) {
        q.select = cols;
        return api;
      },
      eq(c: string, v: unknown) {
        q.where.push(`${c} = ${p(v)}`);
        q.filters.push(`eq:${c}`);
        return api;
      },
      in(c: string, vs: unknown[]) {
        q.where.push(`${c}::text = any(${p(vs.map(String))}::text[])`);
        q.filters.push(`in:${c}`);
        return api;
      },
      like(c: string, v: unknown) {
        q.where.push(`${c} like ${p(v)}`);
        q.filters.push(`like:${c}`);
        return api;
      },
      gte(c: string, v: unknown) {
        q.where.push(`${c} >= ${p(v)}`);
        q.filters.push(`gte:${c}`);
        return api;
      },
      lt(c: string, v: unknown) {
        q.where.push(`${c} < ${p(v)}`);
        q.filters.push(`lt:${c}`);
        return api;
      },
      order(c: string, o?: { ascending?: boolean }) {
        q.order.push(`${c} ${o?.ascending === false ? "desc" : "asc"}`);
        return api;
      },
      limit(n: number) {
        q.limit = n;
        return api;
      },
      range(a: number, b: number) {
        q.offset = a;
        q.limit = b - a + 1;
        return api;
      },
      maybeSingle() {
        return run().then((r) => (r.error ? r : { data: r.data?.[0] ?? null, error: null }));
      },
      /* Writes (a swap marked heard, a phone's newer copy) are not what is measured here. */
      upsert(rows: unknown) {
        state.writes.push({ table, rows });
        return Promise.resolve({ data: null, error: null });
      },
      then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
        return run().then(ok, bad);
      },
    };
    return api;
  }
  const client = {
    from,
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: "t", user: { id: state.me } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
  return { state, client };
});

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => h.client,
  currentSession: async () => ({ userId: h.state.me, token: "t" }),
  sessionToken: async () => "t",
  ensureSession: async () => "t",
}));

/* ---- the database --------------------------------------------------------- */

const DAY = 86_400_000;
const NOW = Date.now();
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
/** A real answer: 30 words, every one different but the better phrase's. */
const answer = (said: string) =>
  `${said} ${Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ")}`;

/** Every migration production had before this batch (0036), and A's and B's practice. */
async function base(): Promise<PG> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(STUBS);
  for (const f of files.filter((f) => Number(f.slice(0, 4)) <= 36 && !HOST_ONLY.has(f))) {
    await db.exec(readFileSync(path.join(DIR, f), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id) values ('${A}'), ('${B}');
    -- A: the take a coach's pair came from, a later one that says the better
    -- phrase, a short one that is not an answer, a game round and a boss take.
    insert into public.reps (id, user_id, created_at, duration_s, transcript, wpm, filler_count, stars, ethos_index, whisper_raw, lesson_id)
      values ('a0000000-0000-4000-8000-000000000001', '${A}', '${at(5)}', 60, '${answer("the thing is")}', 140, 2, 2, 610, '{"words": []}', null),
             ('a0000000-0000-4000-8000-000000000002', '${A}', '${at(2)}', 60, '${answer("the point is")}', 140, 1, 3, 640, '{"words": []}', null),
             ('a0000000-0000-4000-8000-000000000003', '${A}', '${at(1)}', 8, 'um hello', 90, 1, 0, null, null, null),
             ('a0000000-0000-4000-8000-000000000004', '${A}', '${at(1)}', 45, '${answer("a round")}', 150, 0, 2, 620, null, 'game:qa:1'),
             ('a0000000-0000-4000-8000-000000000005', '${A}', '${at(3)}', 60, '${answer("a boss")}', 130, 3, 1, 590, null, 'boss:2026-W46');
    insert into public.reps (id, user_id, created_at, duration_s, transcript, wpm, filler_count, stars, ethos_index)
      values ('b0000000-0000-4000-8000-000000000001', '${B}', '${at(1)}', 60, '${answer("the point is")}', 150, 4, 1, 600);
    insert into public.lexicon (user_id, original, upgrade, rep_id, created_at)
      values ('${A}', 'the thing is', 'the point is', 'a0000000-0000-4000-8000-000000000001', '${at(5)}'),
             ('${B}', 'the thing is', 'the point is', 'b0000000-0000-4000-8000-000000000001', '${at(1)}');
    insert into public.xp_events (user_id, amount, source, rep_id)
      select user_id, 10, 'rep', id from public.reps where stars > 0;
  `);
  return db;
}

/** What each stage answers: the reads the app makes, run fresh (no visit's cache, no page load's flags). */
async function readAll(db: PG) {
  h.state.db = db as never;
  h.state.me = A;
  h.state.reads = [];
  h.state.writes = [];
  vi.resetModules();
  const cd = await import("./client-data");
  const say = await import("./say-store");
  const { fetchSavedWords } = await import("./saved-words");
  const reps = await cd.fetchReps(90);
  const answers = {
    reps,
    spine: await cd.fetchRepSpine(),
    rounds: await cd.fetchGameRounds(),
    practice: await cd.fetchPracticeTakes(),
    lexicon: await cd.fetchLexicon(100),
    xp: await cd.fetchXp(),
    one: await cd.fetchRep("a0000000-0000-4000-8000-000000000002"),
    words: await say.fetchTakeWords(["a0000000-0000-4000-8000-000000000002"]),
    saved: await fetchSavedWords(),
    say: await say.fetchSay(),
    proofA: await say.fetchSwapsForProof(),
    proofB: await say.fetchSwapsForProof(),
  };
  /* A second list read in the same page load: the fallback is paid once. */
  const second = await cd.fetchReps(200);
  return { answers, second, reads: h.state.reads.slice(), writes: h.state.writes.slice() };
}

/** What a stage's answers come to, in the terms every screen reads them in. */
function summary(r: Awaited<ReturnType<typeof readAll>>) {
  const a = r.answers;
  return {
    reps: a.reps.map((x) => ({ id: x.id, stars: x.stars, ...rowSubstance(x), scorable: rowScorable(x) })),
    second: r.second.map((x) => ({ id: x.id, ...rowSubstance(x), scorable: rowScorable(x) })),
    spine: a.spine.map((x) => x.id),
    rounds: a.rounds.map((x) => x.id),
    practice: a.practice.map((x) => x.id),
    lexicon: a.lexicon.map((x) => x.original),
    one: a.one && { id: a.one.id, transcript: a.one.transcript },
    words: [...a.words.keys()],
    say: a.say.items.map((i) => ({ better: i.swap.better, uses: i.uses.map((u) => u.repId) })),
    proof: a.proofA.swaps.map((s) => s.better),
  };
}

/** A read names the account, or reads recordings by their id. */
const named = (r: Read) => r.filters.includes("eq:user_id");
const byId = (r: Read) => r.table === "reps" && r.filters.length === 1 && (r.filters[0] === "in:id" || r.filters[0] === "eq:id");
const LIST = (r: Read) => r.table === "reps" && /\bscorable\b/.test(r.select);

describe("the merged reads on Postgres, 0037 and 0038 in either order (final pass, 19 Nov)", () => {
  let start: PG;
  let reference: ReturnType<typeof summary>;
  beforeAll(async () => {
    start = await base();
  }, 120_000);
  afterAll(async () => {
    await start?.close();
  });

  it("before both: every read answers; the list falls back once a load, and the fallback names the account", async () => {
    const db = (await start.clone()) as PG;
    const r = await readAll(db);
    reference = summary(r);
    // The lists' first select names 0037's columns and Postgres refuses it,
    // once; the select from before it (the transcript and all) follows.
    const lists = r.reads.filter((x) => x.table === "reps" && /\btranscript\b|\bscorable\b/.test(x.select) && x.filters.includes("eq:user_id"));
    expect(lists.filter(LIST).map((x) => x.error)).toEqual(["42703"]);
    expect(r.reads.filter((x) => x.error && !LIST(x))).toEqual([]);
    // The second list read in the same load goes straight to the older select.
    expect(r.reads.filter(LIST)).toHaveLength(1);
    // A's rows, and only A's.
    expect(r.answers.reps.map((x) => x.id).sort()).toEqual(
      ["1", "2", "3", "4", "5"].map((n) => `a0000000-0000-4000-8000-00000000000${n}`)
    );
    expect(r.answers.reps.every((x) => typeof x.transcript === "string")).toBe(true);
    // No row needed its transcript read on its own: each came with it.
    expect(r.reads.filter((x) => x.select === "id, transcript")).toEqual([]);
    await db.close();
  }, 120_000);

  const ORDERS: [string, [string, string][]][] = [
    ["0037 then 0038", [["0037", F0037], ["0038", F0038]]],
    ["0038 then 0037", [["0038", F0038], ["0037", F0037]]],
  ];
  for (const [name, order] of ORDERS) {
    it(`${name}, each twice: every read answers the same after one and after both, and names the account`, async () => {
      const db = (await start.clone()) as PG;
      for (const [k, [file, sql]] of order.entries()) {
        await db.exec(sql);
        await db.exec(sql);
        const r = await readAll(db);
        const has0037 = order.slice(0, k + 1).some(([f]) => f === "0037");
        // Every read answers (the one refused list select before 0037 aside).
        expect(r.reads.filter((x) => x.error && !(LIST(x) && !has0037)), `${name} after ${file}`).toEqual([]);
        // a. Every read names the account or reads recordings by their id.
        expect(r.reads.filter((x) => !named(x) && !byId(x)).map((x) => `${x.table} ${x.select}`), `${name} after ${file}`).toEqual([]);
        // e. The same answers as before either file, by every screen's terms.
        expect(summary(r), `${name} after ${file}`).toEqual(reference);
        if (has0037) {
          // 0037 filled every row: the lists carry no transcript and read none.
          expect(r.answers.reps.every((x) => x.transcript === undefined)).toBe(true);
          expect(r.reads.filter((x) => x.select === "id, transcript")).toEqual([]);
        }
      }
      await db.close();
    }, 120_000);
  }

  it("after both, a row an older server stored reads its transcript by its id alone", async () => {
    const db = (await start.clone()) as PG;
    await db.exec(F0038);
    await db.exec(F0037);
    await db.exec(`insert into public.reps (id, user_id, created_at, duration_s, transcript, wpm, filler_count, stars, ethos_index)
      values ('a0000000-0000-4000-8000-000000000006', '${A}', '${at(0.5)}', 60, '${answer("the point is")}', 140, 0, 2, 655)`);
    const r = await readAll(db);
    const fallback = r.reads.filter((x) => x.select === "id, transcript");
    // Once for each of the two list reads (90 and 200), each for that row only.
    expect(fallback.map((x) => x.filters)).toEqual([["in:id"], ["in:id"]]);
    expect(fallback.every(byId)).toBe(true);
    const row = r.answers.reps.find((x) => x.id === "a0000000-0000-4000-8000-000000000006")!;
    expect(row.scorable).toBeNull();
    expect(typeof row.transcript).toBe("string");
    expect(rowScorable(row)).toBe(true);
    expect(rowSubstance(row).wordCount).toBe(33);
    // b. Say it better counts it: the later take that said "the point is".
    const item = r.answers.say.items.find((i) => i.swap.better === "the point is")!;
    expect(item.uses.map((u) => u.repId).sort()).toEqual([
      "a0000000-0000-4000-8000-000000000002",
      "a0000000-0000-4000-8000-000000000006",
    ]);
    await db.close();
  }, 120_000);

  it("b. Say it better's count reads transcripts by name, and never from a list read", async () => {
    const db = (await start.clone()) as PG;
    await db.exec(F0037);
    await db.exec(F0038);
    const r = await readAll(db);
    // The count's reads name the transcript; the lists' (after 0037) do not.
    const sayReads = r.reads.filter((x) => x.table === "reps" && /^id, created_at, transcript\b/.test(x.select));
    expect(sayReads.length).toBeGreaterThan(0);
    expect(r.reads.filter(LIST).every((x) => !/\btranscript\b/.test(x.select))).toBe(true);
    // A's later take said the better phrase; B's take, which said it too, is not A's.
    const item = r.answers.say.items.find((i) => i.swap.better === "the point is")!;
    expect(item.uses.map((u) => u.repId)).toEqual(["a0000000-0000-4000-8000-000000000002"]);
    // The swaps are read again for every take the recorder opens to (#509 review).
    expect(r.reads.filter((x) => x.table === "lexicon" && /rep_id/.test(x.select))).toHaveLength(3);
    // The stored page reads its transcript whole, by its id.
    expect(r.answers.one?.transcript).toBe(answer("the point is"));
    await db.close();
  }, 120_000);

  it("c. a take with no star that says the better phrase is no use: no token, no XP, no count, and the swap stays unheard for the scored take", async () => {
    const db = (await start.clone()) as PG;
    await db.exec(F0037);
    await db.exec(F0038);
    // A second pair, from the first take; its better phrase said only in a
    // take with no star (three words: not scored, no Ethos number, #504).
    await db.exec(`
      insert into public.lexicon (id, user_id, original, upgrade, rep_id, created_at)
        values ('c0000000-0000-4000-8000-000000000001', '${A}', 'a lot of', 'many', 'a0000000-0000-4000-8000-000000000001', '${at(5)}');
      insert into public.reps (id, user_id, created_at, duration_s, transcript, wpm, filler_count, stars, ethos_index)
        values ('a0000000-0000-4000-8000-000000000007', '${A}', '${at(0.5)}', 4, 'many many um', 60, 1, 0, null);
    `);
    const r = await readAll(db);
    const item = r.answers.say.items.find((i) => i.swap.better === "many")!;
    expect(item.uses).toEqual([]);
    expect(item.state.heardAt).toBeNull();
    // Nothing marks it heard, so the next scored take that says "many" proves it.
    const heardWrites = r.writes
      .filter((w) => w.table === "say_better")
      .flatMap((w) => (Array.isArray(w.rows) ? w.rows : [w.rows]) as { swap: string; heard_at: string | null }[])
      .filter((row) => row.swap === "c:c0000000-0000-4000-8000-000000000001" && row.heard_at);
    expect(heardWrites).toEqual([]);
    // The scored pair still counts its scored take.
    expect(r.answers.say.items.find((i) => i.swap.better === "the point is")!.uses.map((u) => u.repId)).toEqual([
      "a0000000-0000-4000-8000-000000000002",
    ]);
    await db.close();
  }, 120_000);
});
