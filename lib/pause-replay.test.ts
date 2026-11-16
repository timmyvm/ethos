import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHAPED_TAKE, whisperTake, type SpokenSegment, type WhisperTake } from "./__fixtures__/whisper-take";
import { calibrate, classifyGap, type Envelope } from "./envelope";
import { dimensionPoints } from "./index-score";
import { computeMetrics, type FillerHit, type Pause, type Segment, type Word } from "./metrics";
import { pauseReport, type PauseVerdict } from "./pause-quality";

/*
 * supabase/replay/pause-replay.sql against the TypeScript (#476).
 *
 * The replay recomputes each tester recording's Pause score from what it
 * stored, under #476's rules and under the rules before them, and returns
 * aggregates. Here it runs on Postgres (PGlite, every migration applied,
 * so tester_admin.recordings is the real view) over synthetic recordings
 * stored the way the route stores them, and each recording's numbers from
 * its per-recording core must equal the TypeScript's: #476's scorer for
 * "new", and the scorer before #476 (`legacy` below) for "current". The
 * aggregate must read only aggregates, and the file must write nothing.
 */

const ROOT = path.resolve(__dirname, "..");
const SQL = readFileSync(path.join(ROOT, "supabase/replay/pause-replay.sql"), "utf8");
const MARKER = "-- [per-recording core ends here";
const MIGRATIONS = path.join(ROOT, "supabase/migrations");
/** They need the host's pg_cron and Vault (scripts/check-testers-sql.mjs). */
const HOST_ONLY = new Set(["0027_push_tick.sql", "0028_db_held_secrets.sql"]);

// --- the rules before #476, verbatim from lib/pause-quality.ts and ---
// --- lib/metrics.ts at 483dd25, for the "current" columns -------------

const r2 = (n: number) => Math.round(n * 100) / 100;
const endsSentence = (raw: string) => /[.?!]["')\]]*\s*$/.test(raw);

function legacyPauses(words: Word[], segments: Segment[]): Pause[] {
  const pauses: Pause[] = [];
  const segStarts = new Set(segments.map((s) => Math.round(s.start * 100)));
  const startsSegment = (w: Word) => {
    if (segStarts.size === 0) return false;
    for (let ms = -5; ms <= 5; ms++) if (segStarts.has(Math.round(w.start * 100) + ms)) return true;
    return false;
  };
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap < 0.3) continue;
    const t = r2(words[i].end);
    const len = r2(gap);
    if (gap < 0.8) {
      pauses.push({ t, len, kind: "beat" });
      continue;
    }
    pauses.push({ t, len, kind: endsSentence(words[i].word) || startsSegment(words[i + 1]) ? "pre" : "mid" });
  }
  return pauses;
}

type Judged = Pause & { verdict: PauseVerdict; note: string };
const clockOf = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function legacyJudge(pauses: Pause[], words: Word[], fillers: FillerHit[], envelope: Envelope | null): Judged[] {
  const firstWordAt = words[0]?.start ?? 0;
  const floor = envelope ? calibrate(envelope) : undefined;
  const closedAt = (t: number) => {
    let count = 0;
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i].end > t + 0.05) continue;
      count++;
      if (count > 1 && endsSentence(words[i].word)) return count - 1;
      if (count > 40) break;
    }
    return count;
  };
  return pauses.map((p): Judged => {
    const at = clockOf(p.t);
    if (p.kind === "beat") return { ...p, verdict: "beat", note: `${at} · a beat.` };
    const near = fillers.some((f) => Math.abs(f.t - p.t) <= 1.2 || Math.abs(f.t - (p.t + p.len)) <= 1.2);
    const heard = envelope ? classifyGap(envelope, p.t, p.t + p.len, floor) : "unknown";
    if (p.len > 3.5) return { ...p, verdict: "dead", note: `${at} · ${p.len.toFixed(1)}s of dead air.` };
    if (heard === "voiced") {
      return {
        ...p,
        verdict: "filled",
        note: `${at} · ${p.len.toFixed(1)}s with a sound in it. The mic heard it, the transcript didn't.`,
      };
    }
    if (near) return { ...p, verdict: "filled", note: `${at} · silence with a filler leaning on it.` };
    if (p.kind === "mid") return { ...p, verdict: "hesitation", note: `${at} · mid-sentence.` };
    if (p.len < 0.8) return { ...p, verdict: "beat", note: `${at} · a breath.` };
    if (p.t <= firstWordAt + 0.5) return { ...p, verdict: "opening", note: `${at} · opening.` };
    if (closedAt(p.t) < 6) return { ...p, verdict: "hesitation", note: `${at} · no point yet.` };
    return { ...p, verdict: "landing", note: `${at} · landing.` };
  });
}

function legacyScore(judged: Judged[], durationS: number): number {
  const count = (v: PauseVerdict) => judged.filter((p) => p.verdict === v).length;
  const held = judged.filter((p) => p.verdict !== "beat").length;
  const landings = count("landing");
  const opening = count("opening");
  if (held === 0) return 20;
  const minutes = durationS > 0 ? durationS / 60 : 0;
  const perMin = minutes > 0 ? landings / minutes : 0;
  const zone =
    perMin >= 2 && perMin <= 9 ? 1 : Math.max(0, 1 - (perMin < 2 ? 2 - perMin : perMin - 9) / 3.5);
  const ending = durationS > 0 && judged.some((p) => p.verdict === "landing" && p.t >= durationS * 0.8);
  const score =
    ((landings + opening) / held) * 60 +
    zone * 25 +
    (opening > 0 ? 7 : 0) +
    (ending ? 8 : 0) -
    count("filled") * 10 -
    count("dead") * 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- synthetic recordings ---------------------------------------------

/** A small seeded generator, so every run builds the same recordings. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BANK = [
  "I've been thinking about why most of us rush when we talk.",
  "It's not that we have nothing to say.",
  "In 2019 I timed 3.5 seconds of quiet in a talk, and nobody left.",
  "The hard part is saying it out loud in a room.",
  "Most teams already know what the problem actually is.",
  "Why does a two second gap feel like a whole minute?",
  "My manager noticed it during the quarterly review last month.",
  "She said the update finally sounded like a real decision.",
  "So I started writing the first line before every meeting.",
  "We don't need more slides, we need fewer words!",
  "Here's the thing nobody tells you about public speaking.",
  "The room leans in when you stop for a second.",
  "I used to fill every gap with a little noise.",
  "Now I let the last word land and wait.",
  "It took me about 10 weeks to notice the difference.",
  "Can you say the point in one sentence?",
  "That is the whole skill and nobody practises it.",
  "Start with the claim, then give one reason.",
  "If they remember one thing, make it the ask.",
  "Honestly the pause is louder than anything I could add.",
];
const FILLED = ["um,", "uh,", "erm,"];
const OTHER = ["like,", "you know,", "basically,"];

interface Style {
  sentences: number;
  /** Chance a sentence ends on a held pause (else a beat or nothing). */
  held: number;
  /** Chance of a held pause inside a sentence. */
  mid: number;
  /** Chance a pause inside a sentence is written "..." in the text. */
  dots: number;
  /** Chance a held pause has a filler leaning on it, and that it is an um rather than a "like". */
  filler: number;
  um: number;
  /** Chance a held pause runs into dead air. */
  dead: number;
  /** Chance a segment breaks mid-sentence, with no full stop. */
  breakMid: number;
  /** Chance a segment's text and words disagree. */
  disagree: number;
}

const STYLES: Record<string, Style> = {
  fluent: { sentences: 9, held: 0.8, mid: 0.05, dots: 0, filler: 0.05, um: 0.5, dead: 0, breakMid: 0.05, disagree: 0 },
  halting: { sentences: 8, held: 0.5, mid: 0.6, dots: 0.6, filler: 0.15, um: 0.5, dead: 0.05, breakMid: 0.3, disagree: 0.1 },
  fillers: { sentences: 9, held: 0.7, mid: 0.3, dots: 0.3, filler: 0.6, um: 0.6, dead: 0, breakMid: 0.15, disagree: 0 },
  likes: { sentences: 8, held: 0.7, mid: 0.2, dots: 0.2, filler: 0.6, um: 0.1, dead: 0, breakMid: 0.1, disagree: 0.15 },
  long: { sentences: 22, held: 0.6, mid: 0.25, dots: 0.4, filler: 0.2, um: 0.5, dead: 0.08, breakMid: 0.15, disagree: 0.1 },
  short: { sentences: 3, held: 0.7, mid: 0.2, dots: 0.5, filler: 0.2, um: 0.5, dead: 0, breakMid: 0.1, disagree: 0 },
  deadly: { sentences: 8, held: 0.8, mid: 0.3, dots: 0.3, filler: 0.4, um: 0.7, dead: 0.35, breakMid: 0.1, disagree: 0 },
  rushed: { sentences: 10, held: 0, mid: 0, dots: 0, filler: 0, um: 0.5, dead: 0, breakMid: 0, disagree: 0 },
};

/** A held silence clear of the 0.8s and 3.5s lines, so rounding never decides a kind. */
function holdFor(next: () => number, dead: boolean): number {
  return dead ? r2(3.7 + next() * 1.6) : r2(0.86 + next() * 1.5);
}

function synth(seed: number, style: Style): SpokenSegment[] {
  const next = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)];
  const segments: SpokenSegment[] = [];
  let current: string[] = [];
  const close = () => {
    if (!current.length) return;
    const r = next();
    segments.push({ text: current.join(" "), start: r < 0.6 ? "word" : r < 0.85 ? "previous" : r2(0.1 + next() * 0.6) });
    current = [];
  };
  const leaning = () => {
    if (next() >= style.filler) return null;
    return next() < style.um ? pick(FILLED) : pick(OTHER);
  };
  for (let s = 0; s < style.sentences; s++) {
    const tokens = pick(BANK).split(" ");
    if (next() < style.disagree) tokens.splice(1, 0, "{actually|}");
    const out: string[] = [];
    const midAt = next() < style.mid ? 2 + Math.floor(next() * Math.max(1, tokens.length - 4)) : -1;
    tokens.forEach((tok, k) => {
      if (k === midAt) {
        const filler = leaning();
        const before = next() < 0.5;
        const shown = next() < style.dots ? `${tok.replace(/[,.]$/, "")}...` : tok;
        if (filler && before) out.push(shown, filler, `[${holdFor(next, next() < style.dead)}]`);
        else if (filler) out.push(shown, `[${holdFor(next, next() < style.dead)}]`, filler);
        else out.push(shown, `[${holdFor(next, next() < style.dead)}]`);
        if (next() < style.breakMid) {
          current.push(...out.splice(0));
          close();
        }
        return;
      }
      out.push(tok);
    });
    // The silence after the sentence.
    const r = next();
    if (r < style.held) {
      const filler = leaning();
      const hold = `[${holdFor(next, next() < style.dead)}]`;
      // "...in a room. Um, [1.2]" or "...in a room. [1.2] Like, ..."
      if (filler && next() < 0.5) out.push(filler, hold);
      else if (filler) out.push(hold, filler);
      else out.push(hold);
    } else if (r < style.held + (1 - style.held) / 2) {
      out.push(`[${r2(0.35 + next() * 0.35)}]`);
    }
    current.push(...out);
    if (next() < 0.55 || s === style.sentences - 1) close();
  }
  close();
  return segments;
}

/** The phone's envelope, with these held gaps voiced (a swallowed sound mid-gap). */
function envelopeFor(take: WhisperTake, voiced: number[]): Envelope {
  const rate = 20;
  const levels: number[] = [];
  const gaps: [number, number][] = [];
  for (let i = 0; i < take.words.length - 1; i++) {
    const gap = take.words[i + 1].start - take.words[i].end;
    if (gap >= 0.8) gaps.push([take.words[i].end, take.words[i + 1].start]);
  }
  for (let i = 0; i < Math.ceil(take.durationS * rate); i++) {
    const t = i / rate;
    const k = gaps.findIndex(([a, b]) => t >= a && t < b);
    if (k < 0) levels.push(0.5);
    else levels.push(voiced.includes(k) && Math.abs(t - (gaps[k][0] + gaps[k][1]) / 2) < 0.3 ? 0.3 : 0.03);
  }
  return { levels, rate, clock: true };
}

interface Recording {
  name: string;
  person: number;
  take: WhisperTake;
  envelope: Envelope | null;
  /** Stored before #422 (6 Nov), when the Pause score read the words alone. */
  before422: boolean;
  day: string;
  felt: "rough" | "okay" | "strong" | null;
  index: number | null;
}

const FELT = ["rough", "okay", "strong"] as const;

function recordings(): Recording[] {
  const out: Recording[] = [];
  const next = rng(476);
  const names = Object.keys(STYLES);
  let n = 0;
  const day = () => `2026-11-${String(2 + (n % 14)).padStart(2, "0")}`;
  const add = (name: string, take: WhisperTake, voicedShare: number) => {
    const held = take.words.filter((w, i) => i < take.words.length - 1 && take.words[i + 1].start - w.end >= 0.8).length;
    const voiced = Array.from({ length: held }, (_, k) => k).filter(() => next() < voicedShare);
    const d = day();
    out.push({
      name,
      person: n % 4,
      take,
      envelope: voicedShare > 0 ? envelopeFor(take, voiced) : null,
      before422: d < "2026-11-06",
      day: d,
      felt: next() < 0.8 ? FELT[Math.floor(next() * 3)] : null,
      index: 300 + Math.floor(next() * 300),
    });
    n++;
  };
  add("shaped", whisperTake(SHAPED_TAKE), 0);
  add("shaped, two gaps voiced", whisperTake(SHAPED_TAKE), 0.3);
  for (let k = 0; k < 24; k++) {
    const style = names[k % names.length];
    add(`${style} ${k}`, whisperTake(synth(1000 + k, STYLES[style])), k % 3 === 0 ? 0.25 : 0);
  }
  return out;
}

const RECORDINGS = recordings();

/** The scores the TypeScript gives one recording. */
function scoresOf(r: Recording) {
  const { words, segments, durationS } = r.take;
  const m = computeMetrics(words, durationS, segments);
  const now = (envelope: Envelope | null) =>
    pauseReport({ pauses: m.pauses, words, fillers: m.fillers, durationS: m.durationS, segments, envelope }).score;
  const old = legacyPauses(words, segments);
  const was = (envelope: Envelope | null) => legacyScore(legacyJudge(old, words, m.fillers, envelope), m.durationS);
  const storedPauses = legacyJudge(old, words, m.fillers, r.envelope);
  return {
    metrics: m,
    newScore: now(r.envelope),
    newNoEnv: now(null),
    current: was(r.envelope),
    currentNoEnv: was(null),
    storedPauses,
    // The route stored the words-only score before #422, and the judged one after.
    stored: r.before422 ? was(null) : legacyScore(storedPauses, m.durationS),
  };
}

const EXPECTED = new Map(RECORDINGS.map((r) => [r.name, scoresOf(r)]));

// --- Postgres -----------------------------------------------------------

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
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
`;

const person = (k: number) => `${k + 1}${k + 1}${k + 1}${k + 1}0000-0000-4000-8000-00000000000${k + 1}`;
const repId = (k: number) => `00000000-0000-4000-8000-${String(k + 1).padStart(12, "0")}`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith(".sql")).sort()) {
    if (HOST_ONLY.has(f)) continue;
    await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
  }
  // Four testers who joined before the test, and one person who never did.
  for (let k = 0; k < 5; k++) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [person(k), `p${k}@x.test`]);
    if (k < 4) {
      await db.query(
        `insert into public.testers (user_id, consent_version, consented_at, created_at) values ($1, 3, $2, $2)`,
        [person(k), "2026-10-30T00:00:00Z"]
      );
    }
  }
  const insert = async (k: number, r: Recording, p: number, at: string, index: number | null) => {
    const e = EXPECTED.get(r.name)!;
    const m = e.metrics;
    const tier1 = { pause: e.stored, fillers: 70, repairs: 80, pace: 90, range: 60 };
    await db.query(
      `insert into public.reps (id, user_id, created_at, duration_s, transcript, wpm, filler_count, fillers, pauses,
         stars, ethos_index, dimensions, whisper_raw, client_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14)`,
      [
        repId(k), person(p), at, m.durationS, r.take.text, m.wpm, m.fillerCount, JSON.stringify(m.fillers),
        JSON.stringify(e.storedPauses), m.stars,
        index === null ? null : index + dimensionPoints(e.stored, 150),
        JSON.stringify({ tier1 }), JSON.stringify(r.take.raw), `client-${k}`,
      ]
    );
    if (r.felt && p < 4) {
      await db.query(
        `insert into public.tester_feedback (user_id, client_id, rep_id, felt) values ($1, $2, $3, $4)`,
        [person(p), `client-${k}`, repId(k), r.felt]
      );
    }
  };
  // 01:00 UTC is noon in Melbourne, the day the view files it under.
  for (const [k, r] of RECORDINGS.entries()) await insert(k, r, r.person, `${r.day}T01:00:00Z`, r.index);
  // Three the replay must leave out: after the test, never scored, not a tester's.
  const extra = RECORDINGS[2];
  await insert(900, extra, 0, "2026-11-20T01:00:00Z", 400);
  await insert(901, extra, 1, "2026-11-08T01:00:00Z", null);
  await insert(902, extra, 4, "2026-11-08T01:00:00Z", 400);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function perRecording() {
  const core = SQL.slice(0, SQL.indexOf(MARKER));
  const res = await db.query<{
    rep_id: string;
    stored: number;
    new: number;
    new_noenv: number;
    current: number;
    current_noenv: number;
    stored_held: number;
    stored_held_matched: number;
  }>(`${core}\nselect * from per_recording order by rep_id`);
  return res.rows;
}

describe("the replay's per-recording core", () => {
  it("is built on synthetic recordings of every kind", () => {
    expect(RECORDINGS.length).toBeGreaterThanOrEqual(20);
    // The shaped take (lib/__fixtures__/whisper-take.ts), both ways.
    expect(EXPECTED.get("shaped")).toMatchObject({ newScore: 73, current: 26, stored: 26 });
    const scores = [...EXPECTED.values()];
    // The set spans the floor, the middle and the top, under both rules.
    expect(scores.some((s) => s.currentNoEnv === 20)).toBe(true);
    expect(scores.some((s) => s.newScore >= 70)).toBe(true);
    expect(scores.some((s) => s.newScore !== s.newNoEnv)).toBe(true);
    expect(scores.some((s) => s.newScore > s.current)).toBe(true);
    expect(RECORDINGS.some((r) => r.take.segments.some((g) => g.text.includes("...")))).toBe(true);
    expect(RECORDINGS.some((r) => r.take.segments.some((g) => /[.?!] \S/.test(g.text.trim())))).toBe(true);
    expect(RECORDINGS.some((r) => r.take.durationS > 100)).toBe(true);
    expect(RECORDINGS.some((r) => r.take.durationS < 30)).toBe(true);
  });

  it("scores each recording as the TypeScript does, under both rules", async () => {
    const rows = await perRecording();
    // The three outside the window, unscored or not a tester's are left out.
    expect(rows).toHaveLength(RECORDINGS.length);
    for (const [k, r] of RECORDINGS.entries()) {
      const row = rows.find((x) => x.rep_id === repId(k))!;
      const e = EXPECTED.get(r.name)!;
      const label = `${r.name}: ${JSON.stringify({ sql: row, ts: { ...e, metrics: undefined, storedPauses: undefined } })}`;
      expect(Math.abs(row.new - e.newScore), label).toBeLessThanOrEqual(1);
      expect(Math.abs(row.new_noenv - e.newNoEnv), label).toBeLessThanOrEqual(1);
      expect(Math.abs(row.current - e.current), label).toBeLessThanOrEqual(1);
      expect(Math.abs(row.current_noenv - e.currentNoEnv), label).toBeLessThanOrEqual(1);
      expect(row.stored).toBe(e.stored);
      // Every stored held-pause verdict rebuilt by the rules that made it.
      expect(row.stored_held_matched).toBe(row.stored_held);
    }
    // Not merely within a point: the same doubles, the same numbers.
    expect(rows.map((x) => x.new)).toEqual(RECORDINGS.map((r) => EXPECTED.get(r.name)!.newScore));
  });

  it("reads the envelope back only from the notes it wrote", async () => {
    const rows = await perRecording();
    const voiced = RECORDINGS.flatMap((r, k) =>
      EXPECTED.get(r.name)!.storedPauses.some((p) => p.note.includes("The mic heard it")) ? [k] : []
    );
    expect(voiced.length).toBeGreaterThan(2);
    // A voiced gap that was searching anyway, or a take already at the
    // cap, scores the same; the rest score lower for the sound in them.
    const lower = voiced.filter((k) => {
      const row = rows.find((x) => x.rep_id === repId(k))!;
      return row.new < row.new_noenv;
    });
    expect(lower.length).toBeGreaterThanOrEqual(2);
    // And a take with no voiced note reads the same either way.
    for (const [k] of RECORDINGS.entries()) {
      if (voiced.includes(k)) continue;
      const row = rows.find((x) => x.rep_id === repId(k))!;
      expect(row.new).toBe(row.new_noenv);
      expect(row.current).toBe(row.current_noenv);
    }
  });
});

describe("the replay's answer", () => {
  it("is one read-only SELECT that makes and writes nothing", async () => {
    const code = SQL.replace(/--.*$/gm, "");
    expect(code.trim().startsWith("with")).toBe(true);
    expect(code.split(";").filter((s) => s.trim())).toHaveLength(1);
    expect(code).not.toMatch(/\b(create|insert|update|delete|drop|alter|truncate|grant|revoke|copy|into|perform|do)\b/i);
    await db.exec("begin transaction read only");
    try {
      const res = await db.query(SQL);
      expect(res.rows.length).toBeGreaterThan(10);
    } finally {
      await db.exec("rollback");
    }
  });

  it("returns aggregates only: no id, no word, no transcript", async () => {
    const res = await db.query<Record<string, unknown>>(SQL);
    expect(res.fields.map((f) => f.name)).toEqual(["metric", "stored", "current_noenv", "current", "new_noenv", "new"]);
    const flat = JSON.stringify(res.rows);
    for (let k = 0; k < 5; k++) expect(flat).not.toContain(person(k));
    expect(flat).not.toContain("00000000-0000-4000-8000");
    for (const w of ["thinking", "silence", "Twenty", "client-"]) expect(flat).not.toContain(w);
    for (const row of res.rows) {
      for (const v of Object.values(row).slice(1)) {
        expect(v === null || typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v))).toBe(true);
      }
    }
  });

  it("counts the window's scored recordings and summarises each score", async () => {
    const res = await db.query<{ metric: string; stored: string; current: string; new: string }>(SQL);
    const line = (m: string) => res.rows.find((r) => r.metric === m)!;
    expect(Number(line("scored recordings in the window").stored)).toBe(RECORDINGS.length);
    expect(Number(line("n (replayed recordings)").new)).toBe(RECORDINGS.length);
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    const news = RECORDINGS.map((r) => EXPECTED.get(r.name)!.newScore);
    expect(Number(line("median").new)).toBeCloseTo(median(news), 3);
    const under = news.filter((x) => x < 40).length / news.length;
    expect(Number(line("share under 40").new)).toBeCloseTo(under, 3);
    // The check reads 1: every stored verdict rebuilt.
    expect(Number(line("stored held-pause verdicts rebuilt").current)).toBe(1);
    expect(Number(line("people with 3+ felt").stored)).toBeGreaterThanOrEqual(3);
    expect(line("within-person corr with felt").new).not.toBeNull();
  });
});
