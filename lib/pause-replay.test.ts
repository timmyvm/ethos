import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHAPED_TAKE, whisperTake, type SpokenSegment, type WhisperTake } from "./__fixtures__/whisper-take";
import { calibrate, classifyGap, type Envelope } from "./envelope";
import { dimensionPoints } from "./index-score";
import { computeMetrics, type FillerHit, type Pause, type Segment, type Word } from "./metrics";
import { MIC_FILLS_PAUSE, pauseReport, type PauseVerdict } from "./pause-quality";
import { sentenceEnds } from "./sentence-ends";

/*
 * supabase/replay/pause-replay.sql against the TypeScript (#476).
 *
 * The replay recomputes each tester recording's Pause score from what it
 * stored, under #476's rules and under the rules before them, and returns
 * aggregates. Here it runs on Postgres (PGlite, every migration applied,
 * so tester_admin.recordings is the real view) over synthetic recordings
 * stored the way the route stores them, and each recording's numbers from
 * its per-recording core must equal the TypeScript's: #476's scorer with
 * the trace allowed to fill a pause (`micFills: true`) for "new", the same
 * scorer as it ships (`MIC_FILLS_PAUSE`, off) for "new_noenv", and the
 * scorer before #476 (`legacy` below) for "current". The aggregate must
 * read only aggregates, and the file must write nothing.
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
function envelopeFor(take: Pick<WhisperTake, "words" | "durationS">, voiced: number[]): Envelope {
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

/**
 * #476's score for a take, the phone's trace passed as the route passes
 * it. `micFills` true is the SQL's "new" (the trace read from the stored
 * notes); left to the default, `MIC_FILLS_PAUSE` (off), it is "new_noenv",
 * the rule that ships.
 */
function newScoreOf(
  take: { words: Word[]; segments: Segment[] },
  m: ReturnType<typeof computeMetrics>,
  envelope: Envelope | null,
  micFills?: boolean
): number {
  return pauseReport({
    pauses: m.pauses,
    words: take.words,
    fillers: m.fillers,
    durationS: m.durationS,
    segments: take.segments,
    envelope,
    ...(micFills === undefined ? {} : { micFills }),
  }).score;
}

/** The scores the TypeScript gives one recording. */
function scoresOf(r: Recording) {
  const { words, segments, durationS } = r.take;
  const m = computeMetrics(words, durationS, segments);
  const old = legacyPauses(words, segments);
  const was = (envelope: Envelope | null) => legacyScore(legacyJudge(old, words, m.fillers, envelope), m.durationS);
  const storedPauses = legacyJudge(old, words, m.fillers, r.envelope);
  return {
    metrics: m,
    newScore: newScoreOf(r.take, m, r.envelope, true),
    newNoEnv: newScoreOf(r.take, m, r.envelope),
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
    // "new_noenv" is what ships: the trace passed and left out, as with none.
    expect(MIC_FILLS_PAUSE).toBe(false);
    for (const r of RECORDINGS) {
      const e = EXPECTED.get(r.name)!;
      expect(e.newNoEnv, r.name).toBe(newScoreOf(r.take, e.metrics, null, true));
      expect(e.newNoEnv, r.name).toBe(newScoreOf(r.take, e.metrics, r.envelope, false));
    }
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
    expect(rows.map((x) => x.new_noenv)).toEqual(RECORDINGS.map((r) => EXPECTED.get(r.name)!.newNoEnv));
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

/*
 * Harder than the takes above, which a fixture writes cleanly: Whisper's
 * rougher spellings, timed the way it really times them, and the
 * thresholds hit exactly. Each recording is a run of segments whose text
 * and word list are written separately:
 *  - numbers, money, times and contractions ("1,000", "$20", "9:30",
 *    "it’s"), split or joined in the word list ("3.5" or "3" "5",
 *    "five-minute" or "five" "minute"), and abbreviations ("U.S.",
 *    "e.g.", the known miss);
 *  - accented and non-Latin words, a dash the text has and the list does
 *    not, and one the list has as a word of no letters;
 *  - every way a sentence can end or not: . ? ! ?! "..." "…" "...?" ".\""
 *    and ". . .", and words that carry their own punctuation, as older
 *    fixtures did;
 *  - segments that start where the last ended, up to 1.6s before their
 *    first word, or up to 1.4s after it (past the slack, so they do not
 *    align), a word added to or dropped from the text, empty text, a
 *    segment repeated whole;
 *  - gaps of exactly 0.3, 0.8 and 3.5s and a hair either side, and an um
 *    exactly half a second from a pause and one a hair past it.
 * Postgres and the TypeScript must find the same sentence ends, word by
 * word, under both rules, and the same four scores. These run on the
 * columns the replay reads, without the migrations, so there can be many.
 */
describe("the replay on Whisper's rougher shapes", () => {
  const TOKENS: [string, string[]][] = [
    ["talk", ["talk"]], ["the", ["the"]], ["room", ["room"]], ["point", ["point"]], ["we", ["we"]],
    ["really", ["really"]], ["people", ["people"]], ["stayed", ["stayed"]], ["quiet", ["quiet"]],
    ["landed", ["landed"]], ["finally", ["finally"]], ["because", ["because"]],
    ["don't", ["don't"]], ["it’s", ["it’s"]], ["I've", ["I've"]], ["3.5", ["3.5"]], ["3.5", ["3", "5"]],
    ["1,000", ["1,000"]], ["1,000", ["1000"]], ["$20", ["$20"]], ["$20", ["20"]], ["50%", ["50%"]],
    ["9:30", ["9:30"]], ["2019", ["2019"]], ["five-minute", ["five-minute"]], ["five-minute", ["five", "minute"]],
    ["U.S.", ["U.S."]], ["e.g.", ["e.g."]], ["café", ["café"]], ["naïve", ["naïve"]], ["日本", ["日本"]],
    ["—", []], ["—", ["—"]], ["\"Why", ["Why"]], ["um,", ["um"]], ["Uh,", ["Uh"]], ["erm", ["erm"]],
    ["like,", ["like"]], ["you", ["you"]], ["know,", ["know"]], ["basically,", ["basically"]],
  ];
  const ENDS = ["", "", "", "", "", ",", ".", ".", "?", "!", "...", "…", "...?", "?!", ".\"", ". . ."];
  /** Gaps on and either side of every line the rules draw, and ordinary ones. */
  const EDGES = [0.3, 0.29, 0.31, 0.8, 0.79, 0.81, 3.5, 3.49, 3.51];

  interface Rough {
    words: Word[];
    segments: Segment[];
    durationS: number;
    voiced: number[];
  }

  function rough(seed: number): Rough {
    const next = rng(seed);
    const pick = <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)];
    const words: Word[] = [];
    const segments: Segment[] = [];
    let t = r2(next() * 1.5);
    let prevEnd = 0;
    const gapAfter = () => {
      const r = next();
      if (r < 0.08) return pick(EDGES);
      if (r < 0.7) return 0.04 + next() * 0.2;
      if (r < 0.8) return 0.3 + next() * 0.5;
      if (r < 0.97) return 0.8 + next() * 2.7;
      return 3.5 + next() * 2;
    };
    const segs = 3 + Math.floor(next() * 12);
    for (let s = 0; s < segs; s++) {
      const shown: string[] = [];
      const first = words.length;
      const n = 2 + Math.floor(next() * 12);
      for (let k = 0; k < n; k++) {
        const [text, forms] = pick(TOKENS);
        const end = pick(ENDS);
        shown.push(text + end);
        const ownPunctuation = next() < 0.04;
        forms.forEach((form, f) => {
          const dur = r2(0.1 + next() * 0.5);
          const word = ownPunctuation && f === forms.length - 1 ? form + end : form;
          words.push({ word, start: t, end: r2(t + dur) });
          // An um that ends exactly half a second before the next word starts.
          const edge = /^(um|uh|erm)$/i.test(form) && next() < 0.3 ? 0.5 : null;
          t = r2(t + dur + (edge ?? gapAfter()));
        });
      }
      const d = next();
      if (d < 0.05) shown.splice(Math.floor(next() * shown.length), 0, "actually");
      else if (d < 0.09 && shown.length > 1) shown.splice(Math.floor(next() * shown.length), 1);
      const mine = words.slice(first);
      const firstStart = mine[0]?.start ?? t;
      const w = next();
      const start =
        w < 0.4 ? r2(Math.max(0, firstStart - 0.04))
        : w < 0.65 ? prevEnd
        : w < 0.82 ? r2(Math.max(0, firstStart - next() * 1.6))
        : r2(firstStart + next() * 1.4);
      const end = r2((mine[mine.length - 1]?.end ?? firstStart) + next() * 0.3);
      const text = next() < 0.03 ? "" : " " + shown.join(" ");
      segments.push({ start, end, text });
      if (next() < 0.04) segments.push({ start, end, text });
      prevEnd = end;
    }
    const durationS = r2((words[words.length - 1]?.end ?? 0) + next() * 1.5);
    const voiced = Array.from({ length: 40 }, (_, k) => k).filter(() => next() < 0.15);
    return { words, segments, durationS, voiced };
  }

  /** The rule before #476, word by word: its own punctuation, or the next word starts a segment. */
  function legacyStops(words: Word[], segments: Segment[]): boolean[] {
    const segStarts = new Set(segments.map((s) => Math.round(s.start * 100)));
    const startsSegment = (w: Word) => {
      for (let ms = -5; ms <= 5; ms++) if (segStarts.has(Math.round(w.start * 100) + ms)) return true;
      return false;
    };
    return words.map((w, i) => endsSentence(w.word) || (i + 1 < words.length && startsSegment(words[i + 1])));
  }

  /** Said without one held pause: beats only, so 20 under both rules. */
  function rushed(): Rough {
    const words = "We really stayed in the room because the point finally landed".split(" ").map((word, i) => ({
      word,
      start: r2(0.4 + i * 0.5),
      end: r2(0.4 + i * 0.5 + (i % 3 === 0 ? 0.15 : 0.4)),
    }));
    const segments = [{ start: 0.36, end: 6.4, text: " We really stayed in the room, because the point finally landed." }];
    return { words, segments, durationS: 7, voiced: [] };
  }

  /**
   * Every line drawn exactly, in times a double holds exactly: an um that
   * starts half a second after a pause ends and one that ends half a
   * second before the next starts (both filled: the line is "within"), a
   * 3.5s silence (held, not dead air: dead is past it), and a landing at
   * exactly four fifths of the take (the ending).
   */
  function edges(): Rough {
    const at = (word: string, start: number, end: number): Word => ({ word, start, end });
    const words = [
      ..."We really stayed in the room together".split(" ").map((w, k) => at(w, 0.5 + k * 0.5, 0.75 + k * 0.5)),
      at("So", 4.75, 5), // 1.0s after "together."
      at("um", 5.25, 5.5), // starts 0.5s after that pause ends
      at("it", 5.5, 5.75),
      at("stopped", 5.75, 6), // ends 0.5s after the um does
      ..."Then the whole room went".split(" ").map((w, k) => at(w, 9.5 + k * 0.5, 9.75 + k * 0.5)), // 3.5s on
      at("quiet", 11.75, 12),
      at("And", 13, 13.25), // 1.0s on, at 12.0: four fifths of 15
      at("it", 13.5, 13.75),
      at("landed", 14, 14.25),
    ];
    const segments = [
      { start: 0.46, end: 3.8, text: " We really stayed in the room together." },
      { start: 4.71, end: 6.05, text: " So, um, it stopped." },
      { start: 9.46, end: 12.05, text: " Then the whole room went quiet." },
      { start: 12.96, end: 14.3, text: " And it landed." },
    ];
    return { words, segments, durationS: 15, voiced: [] };
  }

  /**
   * And a hair past the um's line: an um that starts 0.52s after a pause
   * ends and ends 0.52s before the next one starts, so it fills neither.
   * With the trace off this line is the only way a pause is filled, so a
   * replay that drew it anywhere from 0.52s to 1.2s must not agree.
   */
  function pastTheEdge(): Rough {
    const at = (word: string, start: number, end: number): Word => ({ word, start, end });
    const words = [
      ..."We really stayed in the room together".split(" ").map((w, k) => at(w, 0.5 + k * 0.5, 0.75 + k * 0.5)),
      at("So", 4.75, 5), // 1.0s after "together.": a landing
      at("um", 5.27, 5.5), // starts 0.52s after that pause ends
      at("it", 5.5, 5.77),
      at("stopped", 5.77, 6.02), // ends 0.52s after the um does: 1.0s on, a pause after 4 words
      at("Then", 7.02, 7.27),
      at("the", 7.52, 7.77),
      at("whole", 8.02, 8.27),
      at("room", 8.52, 8.77),
      at("went", 9.02, 9.27),
      at("quiet", 9.52, 9.77),
      at("And", 10.77, 11.02), // 1.0s on: a landing
      at("it", 11.27, 11.52),
      at("landed", 11.77, 12.02),
    ];
    const segments = [
      { start: 0.46, end: 3.8, text: " We really stayed in the room together." },
      { start: 4.71, end: 6.07, text: " So, um, it stopped." },
      { start: 6.98, end: 9.82, text: " Then the whole room went quiet." },
      { start: 10.73, end: 12.07, text: " And it landed." },
    ];
    return { words, segments, durationS: 13, voiced: [] };
  }

  const ROUGH = [...Array.from({ length: 120 }, (_, k) => rough(4760 + k)), rushed(), pastTheEdge(), edges()];
  const roughId = (k: number) => `00000000-0000-4000-9000-${String(k + 1).padStart(12, "0")}`;
  let pg: PGlite;

  function tsOf(r: Rough) {
    const m = computeMetrics(r.words, r.durationS, r.segments);
    const envelope = envelopeFor({ words: r.words, durationS: m.durationS }, r.voiced);
    const old = legacyPauses(r.words, r.segments);
    const was = (e: Envelope | null) => legacyScore(legacyJudge(old, r.words, m.fillers, e), m.durationS);
    return {
      m,
      stored: legacyJudge(old, r.words, m.fillers, envelope),
      scores: {
        new: newScoreOf(r, m, envelope, true),
        new_noenv: newScoreOf(r, m, envelope),
        current: was(envelope),
        current_noenv: was(null),
      },
    };
  }
  const TS = ROUGH.map(tsOf);

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(`
      create schema tester_admin;
      create table tester_admin.recordings (
        rep_id uuid, user_id uuid, felt text, ethos_index int, pause_score numeric, spoken_on date
      );
      create table public.reps (id uuid, duration_s numeric, whisper_raw jsonb, pauses jsonb, fillers jsonb);
    `);
    for (const [k, r] of ROUGH.entries()) {
      const { m, stored } = TS[k];
      await pg.query(`insert into public.reps values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`, [
        roughId(k),
        m.durationS,
        JSON.stringify({ text: "", words: r.words, segments: r.segments }),
        JSON.stringify(stored),
        JSON.stringify(m.fillers),
      ]);
      await pg.query(`insert into tester_admin.recordings values ($1, $2, null, 500, $3, '2026-11-09')`, [
        roughId(k),
        roughId(k % 5),
        TS[k].scores.current,
      ]);
    }
  }, 120_000);

  afterAll(async () => {
    await pg?.close();
  });

  const core = () => SQL.slice(0, SQL.indexOf(MARKER));

  it("covers what it says it does", () => {
    const texts = ROUGH.flatMap((r) => r.segments.map((s) => s.text)).join("|");
    for (const shape of ["U.S.", "1,000", "it’s", "…", "...?", "?!", ". . .", "—", "日本"]) expect(texts).toContain(shape);
    const aligned = ROUGH.map((r) => sentenceEnds(r.words, r.segments));
    const segs = aligned.reduce((n, a) => n + a.segments, 0);
    const lined = aligned.reduce((n, a) => n + a.aligned, 0);
    // Most segments line up; enough do not that the fallback is exercised.
    expect(lined / segs).toBeGreaterThan(0.5);
    expect(segs - lined).toBeGreaterThan(50);
    const gaps = ROUGH.flatMap((r) => r.words.slice(1).map((w, i) => r2(w.start - r.words[i].end)));
    for (const edge of [0.3, 0.8, 3.5]) expect(gaps).toContain(edge);
    expect(TS.some((x) => x.scores.new === 20)).toBe(true);
    // The exact lines: both ums fill their pauses, 3.5s is held, and the
    // landing at 12.0 of 15 lands the ending.
    const e = ROUGH[ROUGH.length - 1];
    const judged = pauseReport({
      pauses: TS[ROUGH.length - 1].m.pauses, words: e.words, fillers: TS[ROUGH.length - 1].m.fillers,
      durationS: 15, segments: e.segments,
    });
    expect(judged.pauses.filter((p) => p.verdict !== "beat").map((p) => `${p.t}:${p.verdict}`)).toEqual([
      "3.75:filled", "6:filled", "12:landing",
    ]);
    expect(judged.landedTheEnding).toBe(true);
    // A hair past the line, the um fills neither pause beside it.
    const k = ROUGH.length - 2;
    const past = pauseReport({
      pauses: TS[k].m.pauses, words: ROUGH[k].words, fillers: TS[k].m.fillers,
      durationS: 13, segments: ROUGH[k].segments,
    });
    expect(TS[k].m.fillers.map((f) => f.word)).toEqual(["um"]);
    expect(past.pauses.filter((p) => p.verdict !== "beat").map((p) => `${p.t}:${p.verdict}`)).toEqual([
      "3.75:landing", "6.02:hesitation", "9.77:landing",
    ]);
    expect(TS.some((x) => x.scores.new !== x.scores.new_noenv)).toBe(true);
  });

  it("finds the same sentence ends, word by word, under both rules", async () => {
    const res = await pg.query<{ rep_id: string; i: number; stop_new: boolean; stop_cur: boolean }>(
      `${core()}\nselect rep_id, i, stop_new, stop_cur from wstop order by rep_id, i`
    );
    for (const [k, r] of ROUGH.entries()) {
      const rows = res.rows.filter((x) => x.rep_id === roughId(k));
      expect(rows.map((x) => x.stop_new), `recording ${k}, #476`).toEqual(sentenceEnds(r.words, r.segments).stops);
      expect(rows.map((x) => x.stop_cur), `recording ${k}, before`).toEqual(legacyStops(r.words, r.segments));
    }
  });

  it("gives every recording the TypeScript's four scores", async () => {
    const res = await pg.query<{ rep_id: string; new: number; new_noenv: number; current: number; current_noenv: number }>(
      `${core()}\nselect rep_id, new, new_noenv, current, current_noenv from per_recording order by rep_id`
    );
    expect(res.rows).toHaveLength(ROUGH.length);
    for (const [k] of ROUGH.entries()) {
      const row = res.rows.find((x) => x.rep_id === roughId(k))!;
      const sql = { new: row.new, new_noenv: row.new_noenv, current: row.current, current_noenv: row.current_noenv };
      expect(sql, `recording ${k}`).toEqual(TS[k].scores);
    }
  });
});
