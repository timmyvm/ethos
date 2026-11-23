/**
 * The flat A camera (#516): every surface that draws a stat icon or a
 * lesson object, photographed the same way on any build (the 3D set
 * before, the flat A set after), light and dark, 390x844 at
 * deviceScaleFactor 2. Its before and after sheets are in
 * docs/look/icons-flat-a/.
 *
 *   node scripts/look-icons-flat-a.mjs <base-url> <out-dir> [scene ...]
 *   LOOK_SRC=$PWD node scripts/look-icons-flat-a.mjs http://localhost:4112 /tmp/flat-a/after
 *   LOOK_THEMES=light node scripts/look-icons-flat-a.mjs http://localhost:4112 /tmp/flat-a hero
 *
 * The build is a fixture build (scripts/look-stat-icons.mjs's header):
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 4111
 *
 * Self-contained: the fixtures are a trimmed copy of scripts/look-fixtures.mjs
 * (three weeks of recordings, the Supabase mock, the localStorage seed, the
 * scored live take), the scenes are lifted from look-stat-icons.mjs,
 * look-today-cards.mjs, look-lessons-pool.mjs and look-streak.mjs. Nothing
 * is imported from a checkout, so the before and after builds are shot by
 * one file. The one optional input is LOOK_SRC, a checkout whose
 * scripts/moment-fixture.ts renders Best round yet's card (no camera walks
 * a whole round to it); without it that scene is skipped.
 *
 * The page's clock is moved to Thursday 19 November 2026, 19:30 in
 * Melbourne, and every fixture date is counted from that day, so the shots
 * do not change with the day the camera runs on (Today's topic is drawn
 * by the calendar day).
 *
 * Selectors wait for the SURFACE (the card, the row, the stage), never for
 * an <img> to load, so the same scenes run when the icons are inline SVG.
 *
 * Scenes (each shot light and dark, files <surface>-<theme>.png):
 *   today     today-open (an open day: the streak chip's flame unlit),
 *             streakbadge-open (the header count, cropped), today-modes
 *             (Hostile and the weekly boss rows), today-lit and
 *             streakbadge-lit (today spoken: the flame lit)
 *   freeze    today-freeze, today-freeze-line: a missed day a freeze
 *             covered, so the freeze line stands on Today
 *   hero      today-hero-<family> and rep-<family> for pause, fillers,
 *             repairs, pace and range: Today's card in each trait family,
 *             and the recording screen its Start opens (the object on the
 *             topic card)
 *   you       you-open, you-numbers-open (streak unlit), you-lit,
 *             you-numbers-lit
 *   lessons   lessons-top (the Up next stage), lessons-upnext (cropped),
 *             lessons-full (every lesson's thumbnail), lesson-<family>
 *             (a lesson's own stage with its big object)
 *   log       log-best: the Log's Daily list at the all-time best's row
 *   games     games-top, games-full (Hostile's tile, a game's best cup),
 *             plaque (the best plaque before a game's Record)
 *   shop      shop, shop-freeze
 *   welcome   welcome-plan: the introduction's plan, Day one's card
 *   active    active, active-rows: the founder's who-is-active rows, then
 *             further down where streaks at 0 stand unlit
 *   streak    streak-moment-start (the 380pt flame unlit, the moment's
 *             first frame) and streak-moment-end (lit, settled): a take
 *             recorded through a fake microphone, Wednesday to Thursday
 *   workbench workbench-icons-a, -b, -now: /workbench/icons, each column
 *             (?only=a|b|now) as a whole page
 *   moment    moment: Best round yet (needs LOOK_SRC)
 *
 * Exits 1 when a scene could not find its surface or its forced state
 * (a family that did not come up, a freeze line that never landed).
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const require = createRequire("/home/user/ethos/package.json");
const { chromium } = require("playwright");

const [BASE_ARG, OUT_ARG, ...ONLY] = process.argv.slice(2);
if (!BASE_ARG || !OUT_ARG) {
  console.error("usage: node scripts/look-icons-flat-a.mjs <base-url> <out-dir> [scene ...]");
  process.exit(2);
}
const BASE = BASE_ARG.replace(/\/$/, "");
const OUT = resolve(OUT_ARG);
mkdirSync(OUT, { recursive: true });
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};
const written = [];

// ---- The camera's day ---------------------------------------------------------
const MEL = "Australia/Melbourne";
const CAM_DAY = "2026-11-19"; // a Thursday
const [MY, MM, MD] = CAM_DAY.split("-").map(Number);
/** The page's "now": 19:30 on the camera's day in Melbourne (AEDT, +11). */
const CLOCK = new Date(`${CAM_DAY}T19:30:00+11:00`);

/** Melbourne's offset from UTC at an instant, in minutes. */
const melOffset = (at) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: MEL, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, Number(x.value)])
  );
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - at.getTime()) / 60000;
};
/** n days before the camera's day, at h:12 on Melbourne's clock. */
const day = (n, h = 18) => {
  const wall = Date.UTC(MY, MM - 1, MD - n, h, 12);
  return new Date(wall - melOffset(new Date(wall)) * 60000);
};
const iso = (n) => day(n).toISOString();
const dateOnly = (n) => {
  const d = new Date(Date.UTC(MY, MM - 1, MD - n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

// ---- Fixtures: three weeks of practice (scripts/look-fixtures.mjs) ---------------
const SPOKE = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26];
const LESSONS = [
  ["f1", 3], ["f1", 2], ["f2", 3], ["f2", 2], ["f3", 3], ["f3", 3], ["f4", 2], ["f4", 3],
  ["p1", 3], ["p1", 2], ["p2", 2], ["p2", 3], ["p3", 1], ["p3", 2], ["p4", 2],
  ["h1", 3], ["h1", 2], ["h2", 2], ["h2", 1], ["h3", 1], ["h3", 2], ["h4", 1],
];
/* The landing done three of three, the closed mouth two in: Lessons' Up next says carry on. */
const LESSON_PRACTICE = {
  12: "lesson:the-landing:1",
  14: "lesson:the-landing:2",
  16: "lesson:the-landing:3",
  18: "lesson:closed-mouth:1",
  20: "lesson:closed-mouth:2",
};
const pauses = (held) =>
  Array.from({ length: held }, (_, i) => ({ t: 6 + i * 11, len: 1.1 + (i % 3) * 0.3, kind: i % 3 === 1 ? "mid" : "pre" }));
const WEIGHTS = {
  pause: 150, fillers: 100, repairs: 50, pace: 100, range: 100,
  structure: 150, credibility: 150, engagement: 100, confidence: 100,
};
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const points = (score, weight) => Math.round((clamp(score) / 100) * weight);
const indexOf = (tier1, tier2) => {
  const all = { ...tier1, ...Object.fromEntries(Object.entries(tier2).map(([k, v]) => [k, typeof v === "number" ? v : v.score])) };
  return Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + points(all[k], w), 0);
};
const focusFor = (fillers) => {
  if (fillers.length === 0) return "Keep the pause before your point.";
  const counts = {};
  for (const f of fillers) counts[f.word] = (counts[f.word] ?? 0) + 1;
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return `Kill ‘${top}’. ${n} of your ${fillers.length} filler${fillers.length === 1 ? "" : "s"}.`;
};
const TIER2 = {
  structure: { score: 64, citedMoment: '"the mistake people make is waiting to feel ready"', improve: "Open with the claim, then the example." },
  credibility: { score: 58, citedMoment: '"ready is a feeling that shows up after you start"', improve: "Name one number." },
  engagement: { score: 61, citedMoment: '"the big version arrives on its own"', improve: "One question to the room." },
  confidence: { score: 66, citedMoment: '"you do the small version every day"', improve: "Land the last sentence." },
};
const TRANSCRIPT =
  "So the thing about habits is they compound. You do the small version every day and the big version arrives on its own. The mistake people make is waiting to feel ready. Ready is a feeling that shows up after you start, not before. I used to think discipline was the whole answer, and I would plan a week that no person could actually do, and then I would miss a day and quit the plan instead of the day. What changed was making the thing small enough that missing it felt stupid. Five minutes. Not an hour, not a session I have to clear an evening for, just five minutes I can do standing in a kitchen. And the odd part is that the five minutes usually turns into more, but it only does that because it was allowed to be five.";

const reps = [...SPOKE]
  .sort((a, b) => b - a)
  .map((ago, i) => {
    const [lesson, stars] = LESSONS[i % LESSONS.length];
    const fillerCount = Math.max(0, 9 - Math.round(i / 3) + (i % 2));
    const fillers = Array.from({ length: fillerCount }, (_, k) => ({ word: k % 2 ? "um" : "like", t: 4 + k * 7.3 }));
    const tier1 = { pause: 60 + (i % 5) * 6, fillers: 40 + i * 2, repairs: 66, pace: 80 + (i % 3) * 5, range: 58 };
    return {
      id: `rep-${i + 1}`,
      lesson_id: LESSON_PRACTICE[i] ?? lesson,
      created_at: iso(ago),
      duration_s: 58 + (i % 4) * 7,
      transcript: TRANSCRIPT,
      wpm: 128 + ((i * 7) % 30),
      filler_count: fillerCount,
      fillers,
      pauses: pauses(2 + (i % 4)),
      stars,
      focus: focusFor(fillers),
      strength: "Held the pause before ‘the mistake people make’.",
      supply: { original: "making the thing small", upgrade: "making the habit small", note: "It says exactly what you meant." },
      ethos_index: indexOf(tier1, TIER2),
      audio_path: null,
      dimensions: { tier1, anchors: { hedgeCount: 2, restartCount: 1 }, tier2: TIER2 },
      mode: "daily",
      mods: [],
      xp_multiplier: 1,
      boss_topic_id: null,
      accuracy: null,
      capture_mode: "voice",
      delivery_metrics: null,
      presence_score: null,
      delivery_moments: null,
      client_id: `look-${i + 1}`,
    };
  });
/** The newest recording (yesterday's): the one Today's card reads its trait off. */
const NEWEST_ID = reps[reps.length - 1].id;

const xp_events = reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
const coin_ledger = [
  ...SPOKE.slice(0, 17).map((ago, i) => ({ id: `c${i}`, kind: "earned", amount: 1, reason: "streak_day", earned_on: dateOnly(ago), created_at: iso(ago) })),
  { id: "spent-1", kind: "spent", amount: 8, reason: "shop:pose_speaking", earned_on: null, created_at: iso(9) },
];
const lexicon = [
  { id: "l1", original: "really good", upgrade: "so moving", created_at: iso(1) },
  { id: "l2", original: "doing stuff for", upgrade: "getting ready for", created_at: iso(3) },
  { id: "l3", original: "a lot of rain", upgrade: "heavy rain", created_at: iso(5) },
  { id: "l4", original: "making the thing small", upgrade: "making the habit small", created_at: iso(8) },
  { id: "l5", original: "make a decision about", upgrade: "decide on", created_at: iso(12) },
];
const POSE = "pose_speaking";
const profile = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: POSE };
const streaks = { freezes_equipped: 1 };
const streak_freezes = [{ used_on: dateOnly(11) }];

/** Today's recording at 09:12 (the fixtures' TODAY_REP): a day already spoken. */
const TODAY_REP = {
  ...reps[reps.length - 1],
  id: "7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  client_id: "k-today",
  created_at: day(0, 9).toISOString(),
  ethos_index: 665,
  stars: 2,
  lesson_id: "h4",
};

// ---- Game rounds (look-fixtures gamesMode): ladders, a best, the boss and Hostile in the log
function gameOfTheDayFixture(n = 0) {
  const t = Date.UTC(MY, MM - 1, MD + n);
  return ["rush", "interview"][Math.round(t / 86_400_000) % 2];
}
const cutIn = (at, gap, verdict, cleanAfter) => ({
  at, line: "Says who?", gap, gapFrom: at + 0.2, gapTo: at + 0.2 + gap, verdict,
  fillerAt: null, fillerWord: null, cleanAfter, spokeAfter: (cleanAfter ?? 0) + gap + 1,
});
const roundBase = (level, cap, durationS, stars, counted, best = null) => ({
  v: 1, level, cap, durationS, stoppedBy: "you", lastWord: durationS - 0.6, stars, scorable: true, counted, best,
});
const GAME_ROUNDS = [
  [12, "qa", "qa2", 2, 588, { game: "qa", ...roundBase(1, 90, 48, 2, true, 22), cutIns: [cutIn(14.2, 1.1, "held", 22)] }],
  [10, "qa", "qa9", 3, 640, { game: "qa", ...roundBase(1, 90, 52, 3, true, 26), cutIns: [cutIn(13.1, 1.3, "held", 26)] }],
  [5, "qa", "qa14", 3, 652, { game: "qa", ...roundBase(2, 90, 49, 3, true, 31), cutIns: [cutIn(7.4, 1.2, "held", 31)] }],
  [3, "qa", "qa17", 2, 611, { game: "qa", ...roundBase(2, 90, 41, 2, false, null), cutIns: [cutIn(8.2, 0.5, "breath", null)] }],
  ...[[21, 1], [20, 1], [18, 2], [16, 2], [9, 3], [8, 3], [7, 3], [6, 3]].map(([ago, level], i) => {
    const cap = [45, 30, 20][level - 1];
    return [ago, "rush", `ru${i + 1}`, 3, 620 + i * 6, { game: "rush", ...roundBase(level, cap, cap - 2.4, 3, true), spare: 2.4, landed: true }];
  }),
  [2, "interview", "iv3", 2, 712, { game: "interview", ...roundBase(1, 90, 74, 2, true, 712), firstWord: 0.6, inWindow: true, numberAtEnd: "30 percent", cutIns: [] }],
];
function gameRows() {
  const base = reps[reps.length - 1];
  const row = (ago, h, id, lesson, stars, index, round) => ({
    ...base, id, client_id: id, lesson_id: lesson, created_at: day(ago, h).toISOString(),
    duration_s: round?.durationS ?? 60, stars, ethos_index: index, round,
  });
  const rows = GAME_ROUNDS.map(([ago, g, q, stars, index, round], i) => row(ago, 8, `game-${i + 1}`, `game:${g}:${q}`, stars, index, round));
  const bossTake = (ago, h, id, topic, index, accuracy) => ({
    ...row(ago, h, id, `boss:${topic}`, 2, index, null),
    mode: "boss", boss_topic_id: topic, duration_s: 84,
    accuracy: accuracy === null ? null : { score: accuracy, coverage: accuracy / 100, covered: [0, 1, 2], missed: [], confidentlyWrong: 0, claims: [] },
  });
  rows.push(
    bossTake(8, 19, "boss-1", "dunning-kruger", 648, 82),
    bossTake(15, 9, "boss-2", "great-vowel-shift", null, null),
    bossTake(15, 19, "boss-3", "great-vowel-shift", 621, 74),
    bossTake(29, 19, "boss-4", "placebo-effect", 590, 61),
    {
      ...row(9, 20, "hostile-1", "hostile-take", 2, 641, null),
      round: {
        v: 1, game: "hostile", claimId: "zoos",
        verdict: {
          held: { score: 72, citedMoment: "kept the claim", improve: "Name the cost." },
          answered: { score: 64, citedMoment: "answered it", improve: "Shorter." },
          composed: { score: 70, citedMoment: "steady", improve: "Slow down." },
          coachLine: "You held it.",
        },
        questions: [],
      },
    }
  );
  return rows;
}

// ---- Forcing Today's trait family ------------------------------------------------
/*
 * Today's card reads its trait off the newest measured recording before
 * today (lib/challenge.ts practiceRow, lib/next-practice.ts choosePractice:
 * the weakest standing). No fixture or switch picks a family, so the
 * camera rewrites that one row's measurements: the wanted trait at its
 * worst, the other four at their best. Nothing in the app changes.
 *   pause    no pause before a sentence (0 landed a minute)
 *   fillers  30 "um" in 150 words (20 filled pauses per hundred words)
 *   repairs  the restart score at 0 (3 a minute) over 60 words (5 per hundred)
 *   pace     40 words a minute (the band is 130 to 160)
 *   range    46 distinct words in 150 (31 per hundred; scorable needs 30)
 */
const FAMILIES = ["pause", "fillers", "repairs", "pace", "range"];
function familyRow(row, fam) {
  const words = fam === "repairs" ? 60 : 150;
  const distinct = fam === "range" ? 46 : Math.round(words * 0.9);
  const fillers = fam === "fillers" ? Array.from({ length: 30 }, (_, k) => ({ word: "um", t: 1 + k * 1.9 })) : [];
  const held = fam === "pause" ? [] : Array.from({ length: 24 }, (_, k) => ({ t: 1 + k * 2.4, len: 1.1, kind: "pre" }));
  return {
    ...row,
    duration_s: 60,
    wpm: fam === "pace" ? 40 : 145,
    filler_count: fillers.length,
    fillers,
    pauses: held,
    scorable: true,
    word_count: words,
    distinct_words: distinct,
    dimensions: { ...row.dimensions, tier1: { ...row.dimensions.tier1, repairs: fam === "repairs" ? 0 : 100 } },
  };
}

// ---- What the mock answers, set per scene -----------------------------------------
const state = {};
function reset() {
  Object.assign(state, {
    premium: false, // the plan: free, or an invite code's Premium (games, plaque)
    games: false, // game rounds, boss takes and a Hostile take in the reps reads
    today: false, // today's 09:12 recording: the day spoken
    family: null, // a trait family forced on Today's card
    freeze: false, // yesterday missed, a freeze held and spent: the freeze line
    repsFn: null, // the streak scene's own history
    frozenFn: null, // the streak scene's frozen days
    taken: false, // the live take has been scored
  });
  profile.premium = false;
}
reset();

// ---- Supabase mock ----------------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: false, session_id: "s1" })}.sig`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "tim@example.com", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: iso(30), updated_at: iso(0) };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "r1", user };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* Migration 0037's columns, worked out from each row's own transcript unless the row carries them. */
const SUBSTANCE_COLS = ["scorable", "word_count", "distinct_words"];
function withSubstance(row) {
  if (!row || typeof row !== "object" || !("transcript" in row)) return row;
  if (SUBSTANCE_COLS.every((c) => typeof row[c] === "boolean" || typeof row[c] === "number")) return row;
  const tokens = (String(row.transcript ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(Boolean);
  const n = tokens.length;
  const d = new Set(tokens).size;
  const ratio = n > 0 ? Math.round((d / n) * 1000) / 1000 : 0;
  return { ...row, scorable: n >= 20 && ratio >= 0.3, word_count: n, distinct_words: d };
}

function repsRows() {
  if (state.repsFn) return state.repsFn();
  let rows = reps;
  if (state.freeze) rows = rows.filter((r) => r.id !== NEWEST_ID);
  if (state.family) rows = rows.map((r) => (r.id === NEWEST_ID ? familyRow(r, state.family) : r));
  if (state.today) rows = [...rows, TODAY_REP];
  if (state.games) rows = [...rows, ...gameRows()];
  return rows;
}

async function supabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
  const one = (row) => route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(json(session));
  if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(json(user));
  if (url.pathname.startsWith("/auth/v1/")) return route.fulfill(json({}));
  if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill(json(0));
  if (url.pathname.startsWith("/rest/v1/profiles")) return route.fulfill(json(single ? profile : [profile]));
  if (url.pathname.startsWith("/rest/v1/streaks")) return route.fulfill(json(single ? streaks : [streaks]));
  if (url.pathname.startsWith("/rest/v1/testers")) return single ? one(null) : route.fulfill(json([]));
  if (url.pathname.startsWith("/rest/v1/billing")) return single ? one(null) : route.fulfill(json([]));
  const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
  /* The freeze scene's spend: the upsert answers the row it wrote, so the
     sync counts a rescue (lib/client-data.ts spendFreezes). */
  if (table === "streak_freezes" && req.method() === "POST" && state.freeze) return route.fulfill(json([{ id: "fz-spent" }], 201));
  if (req.method() !== "GET") return route.fulfill(json([]));
  let rows;
  if (table === "reps") {
    rows = repsRows();
    if ((url.searchParams.get("lesson_id") ?? "").startsWith("like.game:")) rows = rows.filter((r) => (r.lesson_id ?? "").startsWith("game:"));
  } else if (table === "streak_freezes") {
    rows = state.frozenFn ? state.frozenFn() : streak_freezes;
  } else if (table === "coin_ledger") {
    /* A freeze bought in the Shop, held for the freeze scene's missed day. */
    rows = state.freeze
      ? [...coin_ledger, { id: "fz-bought", kind: "spent", amount: 14, reason: "shop:streak_freeze", earned_on: null, created_at: iso(4) }]
      : coin_ledger;
  } else {
    rows = { xp_events, lexicon, onboarding: [], saved_words: [], say_better: [] }[table] ?? [];
  }
  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    const sign = dir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => (a[col] < b[col] ? -sign : a[col] > b[col] ? sign : 0));
  }
  const limit = Number(url.searchParams.get("limit"));
  if (limit > 0) rows = rows.slice(0, limit);
  if (table === "reps") rows = rows.map(withSubstance);
  const id = url.searchParams.get("id");
  if (id && id.startsWith("in.(")) {
    const ids = new Set(id.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")));
    return route.fulfill(json(rows.filter((r) => ids.has(r.id))));
  }
  if (id) {
    const found = rows.find((r) => r.id === id.replace(/^eq\./, ""));
    return single ? one(found) : route.fulfill(json(found ? [found] : []));
  }
  if (single) return one(rows[0]);
  return route.fulfill(json(rows));
}

/* The billing routes: sync answers the plan (free, or an invite code's Premium with no billing row). */
async function billingApi(route) {
  const name = new URL(route.request().url()).pathname.split("/").pop();
  if (name === "sync") return route.fulfill(json({ billing: null, premium: state.premium }));
  return route.fulfill(json({ error: "Not here." }, 404));
}

// ---- The scored live take, for the streak moment (look-fixtures analyze) --------
const LIVE_TIER1 = { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 };
const dim = (score, moment) => ({ score, citedMoment: moment, improve: "Open with the claim, then the example." });
const LIVE_TIER2 = {
  structure: dim(64, '"the mistake people make is waiting to feel ready"'),
  credibility: dim(58, '"ready is a feeling that shows up after you start"'),
  engagement: dim(61, '"the big version arrives on its own"'),
  confidence: dim(66, '"you do the small version every day"'),
};
const LIVE_TRANSCRIPT =
  "So the thing about habits is, um, they compound. You do the small version every day and, like, it builds on its own. Um, the mistake people make is waiting to feel ready. You know, ready is a feeling that shows up after you start. I used to think discipline was the whole answer, and I would plan a week nobody could really do, then miss a day and quit the plan instead of the day. What changed was making the habit small enough that missing it felt stupid. Five minutes. Not an hour, just five minutes I can do standing in a kitchen. And the five minutes usually turns into more, but only because it was allowed to be five.";
const LIVE_WORDS = (() => {
  const raw = LIVE_TRANSCRIPT.match(/[A-Za-z0-9']+/g);
  let t = 0.4;
  return raw.map((word, i) => {
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]/.test(LIVE_TRANSCRIPT.split(/\s+/)[i] ?? "") ? 0.9 : 0);
    return w;
  });
})();
const LIVE_FILLERS = (() => {
  const out = [];
  const w = LIVE_WORDS.map((x) => x.word.toLowerCase());
  for (let i = 0; i < w.length; i++) {
    if (w[i] === "you" && w[i + 1] === "know") out.push({ word: "you know", t: LIVE_WORDS[i++].start });
    else if (w[i] === "um" || (w[i] === "like" && w[i + 1] === "it")) out.push({ word: w[i], t: LIVE_WORDS[i].start });
  }
  return out;
})();
const analyzeBody = {
  transcript: LIVE_TRANSCRIPT,
  words: LIVE_WORDS,
  metrics: {
    durationS: 62, wordCount: LIVE_WORDS.length, wpm: 145, fillerCount: LIVE_FILLERS.length, fillersPerMin: 3.9,
    fillers: LIVE_FILLERS, fillerCounts: { um: 2, like: 1, "you know": 1 }, topFiller: "um",
    repairCount: 1, repairsPerMin: 1, unvoicedHesitations: 1, disfluenciesPerMin: 4.8,
    pauses: [{ t: 2.1, len: 1.2, kind: "pre", verdict: "opening" }, { t: 20, len: 0.9, kind: "mid" }, { t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 58, len: 1.1, kind: "pre" }],
    heldPauses: 4, composedPauses: 3, midSentencePauses: 1, stars: 2,
    substance: { wordCount: LIVE_WORDS.length, distinctRatio: 0.62, repeatShare: 0.05 },
  },
  tier1: LIVE_TIER1,
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "Kill ‘um’. 2 of your 4 fillers.",
    strength: "Held the pause before ‘the mistake people make’.",
    supply: { original: "a week nobody could really do", upgrade: "an impossible week", note: "It says the same in fewer words." },
    coachLine: "4 fillers in 62s. Tomorrow: kill ‘um’.",
    dimensions: LIVE_TIER2,
  },
  ethosIndex: indexOf(LIVE_TIER1, LIVE_TIER2), previousIndex: reps[reps.length - 1].ethos_index, repId: "rep-live", scorable: true,
  pauseHeadline: "3 pauses between sentences.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 2, capped: false },
};

// ---- The founder's who-is-active view (scripts/active-fixtures.ts, printed once) ----
const ACTIVE_VIEW = {"view":{"days":["2026-10-27","2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08","2026-11-09"],"totals":[{"recorded":0,"opened":0},{"recorded":0,"opened":0},{"recorded":0,"opened":0},{"recorded":0,"opened":0},{"recorded":0,"opened":0},{"recorded":0,"opened":0},{"recorded":7,"opened":2},{"recorded":9,"opened":4},{"recorded":9,"opened":3},{"recorded":7,"opened":3},{"recorded":5,"opened":3},{"recorded":6,"opened":2},{"recorded":7,"opened":4},{"recorded":3,"opened":6}],"rows":[{"number":"9E37 79B1","label":"Tester 1","you":false,"days":["none","none","none","none","none","none","recorded","recorded","recorded","recorded","recorded","recorded","recorded","recorded"],"streak":8,"reminder":18},{"number":"78DD E6C4","label":"Tester 2","you":false,"days":["none","none","none","none","none","none","recorded","recorded","recorded","opened","recorded","recorded","recorded","opened"],"streak":3,"reminder":21},{"number":"5384 53D7","label":"Tester 3","you":false,"days":["none","none","none","none","none","none","none","none","none","none","recorded","none","recorded","recorded"],"streak":2,"reminder":null},{"number":"2E2A C0EA","label":"Tester 4","you":false,"days":["none","none","none","none","none","none","recorded","recorded","recorded","none","opened","none","none","none"],"streak":0,"reminder":null},{"number":"08D1 2DFD","label":"Tester 5","you":false,"days":["none","none","none","none","none","none","none","none","recorded","recorded","none","opened","none","none"],"streak":0,"reminder":null},{"number":"3C6E F362","label":"Tester 6","you":false,"days":["none","none","none","none","none","none","recorded","recorded","opened","recorded","recorded","recorded","recorded","recorded"],"streak":5,"reminder":18},{"number":"1715 6075","label":"Tester 7","you":false,"days":["none","none","none","none","none","none","recorded","opened","none","recorded","opened","none","recorded","opened"],"streak":1,"reminder":null},{"number":"F1BB CD88","label":"Tester 9","you":false,"days":["none","none","none","none","none","none","recorded","none","recorded","none","none","recorded","opened","none"],"streak":0,"reminder":null},{"number":"CC62 3A9B","label":"Tester 10","you":false,"days":["none","none","none","none","none","none","none","recorded","recorded","opened","none","none","opened","none"],"streak":0,"reminder":null},{"number":"A708 A7AE","label":"Tester 11","you":false,"days":["none","none","none","none","none","none","recorded","recorded","none","recorded","none","none","none","none"],"streak":0,"reminder":null},{"number":"E377 9B10","label":"Tester 12","you":false,"days":["none","none","none","none","none","none","opened","opened","none","none","none","none","none","none"],"streak":0,"reminder":null},{"number":"1FE6 8E72","label":"Tester 13","you":false,"days":["none","none","none","none","none","none","opened","none","opened","none","none","none","opened","none"],"streak":0,"reminder":null},{"number":"DAA6 6D13","label":"Tester 14","you":false,"days":["none","none","none","none","none","none","none","recorded","recorded","recorded","recorded","recorded","recorded","opened"],"streak":6,"reminder":null},{"number":"B54C DA26","label":"Tester 15","you":false,"days":["none","none","none","none","none","none","none","recorded","recorded","none","none","opened","recorded","none"],"streak":1,"reminder":null},{"number":"8FF3 4739","label":"Tester 16","you":false,"days":["none","none","none","none","none","none","none","opened","none","recorded","none","recorded","none","opened"],"streak":0,"reminder":null},{"number":"6A99 B44C","label":"Tester 17","you":false,"days":["none","none","none","none","none","none","none","recorded","opened","none","none","none","none","opened"],"streak":0,"reminder":null},{"number":"4540 215F","label":"Tester 18","you":false,"days":["none","none","none","none","none","none","none","none","recorded","none","opened","none","opened","none"],"streak":0,"reminder":null},{"number":"81AF 14C1","label":"Tester 19","you":false,"days":["none","none","none","none","none","none","none","opened","none","none","none","none","none","none"],"streak":0,"reminder":null},{"number":"BE1E 0823","label":"Tester 20","you":false,"days":["none","none","none","none","none","none","none","none","none","none","none","none","none","none"],"streak":0,"reminder":null},{"number":"5C55 81D4","label":"Tester 21","you":false,"days":["none","none","none","none","none","none","none","none","none","opened","none","none","none","none"],"streak":0,"reminder":null},{"number":"FA8C FB85","label":"Tester 22","you":false,"days":["none","none","none","none","none","none","none","none","none","none","none","none","none","opened"],"streak":0,"reminder":null},{"number":"C0A0 13E2","label":"You","you":true,"days":["none","none","none","none","none","recorded","recorded","recorded","recorded","recorded","recorded","recorded","recorded","recorded"],"streak":9,"reminder":8}]},"clock":{"sources":[{"secret":"PUSH_TICK_SECRET","caller":"database","last":"2026-11-09T09:01:00.000Z","hours":24},{"secret":"CRON_SECRET","caller":"github","last":"2026-11-09T07:06:00.000Z","hours":5}],"alive":true}};

// ---- Best round yet's markup, from the checkout's own component (optional) ----------
let MOMENT_HTML = null;
if (want("moment") && process.env.LOOK_SRC) {
  const src = resolve(process.env.LOOK_SRC);
  if (existsSync(join(src, "scripts/moment-fixture.ts"))) {
    try {
      MOMENT_HTML = execFileSync("npx", ["vite-node", "--config", "vitest.config.ts", "scripts/moment-fixture.ts"], {
        cwd: src, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      fail(`moment: scripts/moment-fixture.ts did not render in ${src} (${String(e.message).slice(0, 120)})`);
    }
  } else fail(`moment: no scripts/moment-fixture.ts in ${src}`);
}

// ---- The browser and its contexts ----------------------------------------------------
/** What a returning account's browser holds (look-fixtures seed). */
function seed({ theme, session, pose }) {
  localStorage.setItem("ethos.welcomed", new Date().toISOString());
  localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose, skipIntros: true, haptics: false }));
  localStorage.setItem(
    "ethos.onboarding",
    JSON.stringify({
      answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" },
      step: 6,
      done: true,
      synced: true,
    })
  );
  localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
  localStorage.setItem("ethos.gates.streak", new Date().toISOString());
  localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
  localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function open(theme) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: MEL, colorScheme: theme, serviceWorkers: "block",
    permissions: ["microphone", "notifications"], reducedMotion: "no-preference",
  });
  /* The page's clock, moved to the camera's day and still running (look-streak):
     the recorder times a take by it, so a fixed clock would make every take too short. */
  await ctx.addInitScript((shift) => {
    const Real = Date;
    class Shifted extends Real {
      constructor(...a) {
        if (a.length === 0) super(Real.now() + shift);
        else super(...a);
      }
      static now() {
        return Real.now() + shift;
      }
    }
    globalThis.Date = Shifted;
  }, CLOCK.getTime() - Date.now());
  /* Math.random seeded: a game's question and Hostile's claim are drawn by
     it (lib/games.ts), and an unseeded draw put a different question on
     the plaque's screen in each theme and each run. */
  await ctx.addInitScript(() => {
    let s = 0x2f6e2b1;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/billing/*", billingApi);
  await ctx.route("**/api/push", (r) => r.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", (r) => r.fulfill(json({ ok: true, kept: 0 })));
  await ctx.route("**/api/active", (r) => r.fulfill(json(ACTIVE_VIEW)));
  await ctx.route("**/api/analyze", async (route) => {
    await sleep(900);
    state.taken = true;
    await route.fulfill(json(analyzeBody));
  });
  await ctx.addInitScript(seed, { theme, session, pose: POSE });
  /* The reminder ask has had today's showing and Since day one has been seen. */
  await ctx.addInitScript(() => {
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    if (!localStorage.getItem("ethos.pro.day3")) localStorage.setItem("ethos.pro.day3", new Date().toISOString());
  });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
  } catch {}
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

/** The route opened and its surface drawn: no skeleton, fonts in, every picture decoded. */
async function go(page, path, surface, label) {
  for (let i = 0; ; i++) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    const ok = await page.waitForSelector(surface, { timeout: 20000 }).then(() => true, () => false);
    if (ok) break;
    if (i === 2) {
      fail(`${label}: ${surface} never drew on ${path}`);
      return false;
    }
  }
  await settle(page);
  return true;
}

async function settle(page) {
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  /* A lazy picture below the fold would photograph as a hole in a full-page shot. */
  await page.evaluate(() => {
    for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = "eager";
  });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(1400);
}

const file = (name, theme) => join(OUT, `${name}-${theme}.png`);
async function shot(page, name, theme, opts = {}) {
  const path = file(name, theme);
  await page.screenshot({ path, ...opts });
  written.push(path);
  console.log("shot", `${name}-${theme}`);
}
/** Scroll the first selector to the middle of the screen. */
async function centre(page, sel) {
  const loc = page.locator(sel).first();
  if ((await loc.count()) === 0) return false;
  await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await sleep(500);
  return true;
}
/** The joined boxes of the selectors, padded, in the current scroll position. */
async function crop(page, name, theme, sels, pad = 16) {
  const boxes = [];
  for (const sel of [sels].flat()) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    const b = await loc.boundingBox();
    if (b) boxes.push(b);
  }
  if (!boxes.length) return fail(`${name}-${theme}: nothing to crop (${[sels].flat().join(", ")})`);
  const vw = 390;
  const vh = 844;
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const x1 = Math.min(vw, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const y1 = Math.min(vh, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  await shot(page, name, theme, { clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
}
/**
 * The whole page from the top. Fixed things (the floating tab bar, a
 * sticky bar) are hidden for it: a full-page shot draws them once, over
 * whatever row sits at their viewport place, and that row's picture is
 * then lost from the comparison.
 */
async function fullShot(page, name, theme) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      if (getComputedStyle(el).position === "fixed") el.setAttribute("data-look-hidden", el.style.visibility || "-");
    }
    const css = document.createElement("style");
    css.id = "look-hide-fixed";
    css.textContent = "[data-look-hidden]{visibility:hidden!important}";
    document.head.appendChild(css);
  });
  await sleep(300);
  await shot(page, name, theme, { fullPage: true });
  await page.evaluate(() => {
    document.getElementById("look-hide-fixed")?.remove();
    for (const el of document.querySelectorAll("[data-look-hidden]")) el.removeAttribute("data-look-hidden");
  });
}

/** One scene in one theme: the state reset, a fresh context, the body, the context closed. */
async function scene(name, theme, body, set = () => {}) {
  reset();
  set();
  const { ctx, page } = await open(theme);
  try {
    await body(page, theme);
  } catch (e) {
    fail(`${name}-${theme}: ${String(e.message).split("\n")[0].slice(0, 200)}`);
  } finally {
    await ctx.close();
  }
}

const TODAY_SURFACE = "main .home-hero:not([data-family='none'])";
/** A lesson per family, each the family's emblem (lib/home.ts TRAIT_OBJECT). */
const LESSON_FOR = {
  pause: "the-long-one",
  fillers: "the-cold-open",
  repairs: "finish-it",
  pace: "room-to-land",
  range: "name-it-once",
};

for (const theme of THEMES) {
  if (want("today")) {
    /* An open day (the newest recording is yesterday's): the chip's flame unlit. */
    await scene("today", theme, async (page) => {
      if (!(await go(page, "/", TODAY_SURFACE, "today-open"))) return;
      await shot(page, "today-open", theme);
      await crop(page, "streakbadge-open", theme, ".today-earned", 12);
      if (await centre(page, "main .home-modes")) {
        await settle(page);
        await shot(page, "today-modes", theme);
      } else fail(`today-modes-${theme}: no .home-modes`);
    });
    /* Today spoken at 09:12: the chip's flame lit. */
    await scene(
      "today-lit",
      theme,
      async (page) => {
        if (!(await go(page, "/", TODAY_SURFACE, "today-lit"))) return;
        await shot(page, "today-lit", theme);
        await crop(page, "streakbadge-lit", theme, ".today-earned", 12);
      },
      () => (state.today = true)
    );
  }

  if (want("freeze")) {
    /* Yesterday missed and a freeze held (bought in the Shop): the sync spends
       it on yesterday and Today says so in its line with the freeze's mark. */
    await scene(
      "freeze",
      theme,
      async (page) => {
        if (!(await go(page, "/", TODAY_SURFACE, "today-freeze"))) return;
        const line = await page.waitForSelector("main .home-freeze", { timeout: 15000 }).then(() => true, () => false);
        if (!line) return fail(`today-freeze-${theme}: the freeze line never landed`);
        await centre(page, "main .home-freeze");
        await settle(page);
        await shot(page, "today-freeze", theme);
        await crop(page, "today-freeze-line", theme, "main .home-freeze", 16);
      },
      () => (state.freeze = true)
    );
  }

  if (want("hero")) {
    for (const fam of FAMILIES) {
      await scene(
        `hero-${fam}`,
        theme,
        async (page) => {
          if (!(await go(page, "/", TODAY_SURFACE, `today-hero-${fam}`))) return;
          const got = await page.locator("main .home-hero").first().getAttribute("data-family");
          if (got !== fam) fail(`today-hero-${fam}-${theme}: the card came up ${got}`);
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(300);
          await shot(page, `today-hero-${fam}`, theme);
          /* The recording screen the card's Start opens: the same object on the topic card. */
          const href = await page.locator("main .home-hero a[href^='/rep']").first().getAttribute("href").catch(() => null);
          if (!href) return fail(`rep-${fam}-${theme}: no Start on the card`);
          if (!(await go(page, href, "main section[aria-label='Your topic']", `rep-${fam}`))) return;
          const repFam = await page.locator("main section[aria-label='Your topic']").first().getAttribute("data-family");
          if (repFam !== fam) fail(`rep-${fam}-${theme}: the topic card came up ${repFam}`);
          await shot(page, `rep-${fam}`, theme);
        },
        () => (state.family = fam)
      );
    }
  }

  if (want("you")) {
    for (const [tag, today] of [["open", false], ["lit", true]]) {
      await scene(
        `you-${tag}`,
        theme,
        async (page) => {
          if (!(await go(page, "/you", "main [aria-label='Your numbers']", `you-${tag}`))) return;
          await shot(page, `you-${tag}`, theme);
          await crop(page, `you-numbers-${tag}`, theme, "main [aria-label='Your numbers']", 16);
        },
        () => (state.today = today)
      );
    }
  }

  if (want("lessons")) {
    await scene("lessons", theme, async (page) => {
      if (!(await go(page, "/lessons", "main a[data-up-next]", "lessons"))) return;
      await shot(page, "lessons-top", theme);
      await crop(page, "lessons-upnext", theme, ["main .arrive:has(> a[data-up-next])"], 12);
      await fullShot(page, "lessons-full", theme);
    });
    for (const fam of FAMILIES) {
      await scene(`lesson-${fam}`, theme, async (page) => {
        if (!(await go(page, `/lessons/${LESSON_FOR[fam]}`, "main h1", `lesson-${fam}`))) return;
        await shot(page, `lesson-${fam}`, theme);
      });
    }
  }

  if (want("log")) {
    await scene("log", theme, async (page) => {
      if (!(await go(page, "/history", "main .log-row", "log"))) return;
      if (!(await centre(page, "main .log-row[data-best]"))) return fail(`log-best-${theme}: no best row on the Log`);
      await settle(page);
      await shot(page, "log-best", theme);
    });
  }

  if (want("games")) {
    const premiumGames = () => {
      state.premium = true;
      profile.premium = true;
      state.games = true;
    };
    await scene(
      "games",
      theme,
      async (page) => {
        if (!(await go(page, "/games", "main .game-card", "games"))) return;
        await page.waitForSelector("main .game-card .tile-best-value", { timeout: 10000 }).catch(() => fail(`games-${theme}: no tile shows a best`));
        await settle(page);
        await shot(page, "games-top", theme);
        await fullShot(page, "games-full", theme);
      },
      premiumGames
    );
    /* The plaque before a game's Record: Q&A at level 2, best 31s clean. */
    await scene(
      "plaque",
      theme,
      async (page) => {
        if (!(await go(page, "/games", "main .game-card:has(.tile-best-value)", "plaque"))) return;
        await page.locator("main .game-card:has(.tile-best-value)").first().click();
        await page.waitForURL(/\/rep/, { timeout: 10000 }).catch(() => {});
        const ok = await page.waitForSelector(".best-plaque", { timeout: 15000 }).then(() => true, () => false);
        if (!ok) return fail(`plaque-${theme}: no .best-plaque`);
        await settle(page);
        await shot(page, "plaque", theme);
      },
      premiumGames
    );
  }

  if (want("shop")) {
    await scene("shop", theme, async (page) => {
      if (!(await go(page, "/shop", "main .card:has-text('Streak freeze')", "shop"))) return;
      await shot(page, "shop", theme);
      await centre(page, "main .card:has-text('Streak freeze')");
      await crop(page, "shop-freeze", theme, "main .card:has-text('Streak freeze')", 12);
    });
  }

  if (want("welcome")) {
    /* The introduction's plan (a finished walk opens on it): Day one's card stands the Fillers door's object. */
    await scene("welcome", theme, async (page) => {
      if (!(await go(page, "/welcome?step=plan", "text=Day one starts today.", "welcome-plan"))) return;
      await shot(page, "welcome-plan", theme);
    });
  }

  if (want("active")) {
    await scene("active", theme, async (page) => {
      if (!(await go(page, "/active", "main li:has([aria-label^='Streak'])", "active"))) return;
      await shot(page, "active", theme);
      /* Further down: rows at 0, their flame unlit, beside running ones. */
      await centre(page, "main li:has([aria-label^='Streak']) >> nth=4");
      await shot(page, "active-rows", theme);
    });
  }

  if (want("streak")) {
    /*
     * The streak moment (look-streak's roll): spoke Monday to Wednesday, so
     * today's take rolls 3 to 4. Recorded through Chromium's fake microphone,
     * scored by the mock, and left by the results' way back, which plays the
     * moment. Its animations are paused and sought: the first frame (the
     * flame unlit, before it lights) and the settled end.
     */
    const ago = (n, h = 18) => new Date(Date.parse(`${CAM_DAY}T${String(h).padStart(2, "0")}:12:00+11:00`) - n * 86_400_000);
    const template = reps[reps.length - 1];
    const row = (n, i, h) => ({ ...template, id: `streak-${i}`, client_id: `streak-${i}`, created_at: ago(n, h).toISOString() });
    await scene(
      "streak",
      theme,
      async (page) => {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForSelector("main .arrive", { timeout: 30000 });
        await sleep(800);
        await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
        await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
        await sleep(1200);
        await page.click('button[data-record="start"]', { force: true });
        await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
        await sleep(3000);
        await page.click('button[aria-label="Stop and score this recording"]', { force: true });
        await page.waitForSelector("main [data-glance]", { timeout: 30000 });
        await sleep(2600);
        await page.locator("main [data-results-back]").click();
        const moment = await page.waitForSelector("[data-streak-moment]", { timeout: 6000 }).then(() => true, () => false);
        if (!moment) return fail(`streak-moment-${theme}: no moment on the way back`);
        await sleep(300);
        const t = await page.evaluate(() => {
          const el = document.querySelector("[data-streak-moment]");
          for (const a of document.getAnimations()) a.pause();
          return {
            lightAt: Number(el.getAttribute("data-light-at")),
            end: Number(el.getAttribute("data-end-ms")),
            from: el.getAttribute("data-from"),
            to: el.getAttribute("data-to"),
          };
        });
        if (t.from !== "3" || t.to !== "4") fail(`streak-moment-${theme}: rolled ${t.from} to ${t.to}, wanted 3 to 4`);
        const seek = (ms) =>
          page.evaluate((ms) => {
            for (const a of document.getAnimations()) {
              a.pause();
              a.currentTime = ms;
            }
          }, ms);
        /* Pictures in the moment decoded before either frame. */
        await page.evaluate(() => Promise.all([...document.querySelectorAll("[data-streak-moment] img")].map((i) => i.decode().catch(() => {})))).catch(() => {});
        if (Number.isFinite(t.lightAt) && t.lightAt > 0) {
          await seek(t.lightAt - 1);
          await sleep(200);
          await shot(page, "streak-moment-start", theme);
        } else fail(`streak-moment-start-${theme}: no data-light-at on the moment`);
        await seek((Number.isFinite(t.end) && t.end > 0 ? t.end : 4000) + 1000);
        await sleep(200);
        await shot(page, "streak-moment-end", theme);
      },
      () => {
        let rows = [row(1, 1), row(2, 2), row(3, 3)];
        state.repsFn = () => {
          const out = [...rows];
          if (state.taken) out.push({ ...row(0, 99, 19), id: "rep-live", client_id: "rep-live", created_at: new Date(Date.now() + (CLOCK.getTime() - Date.now())).toISOString(), ethos_index: analyzeBody.ethosIndex });
          return out;
        };
        state.frozenFn = () => [];
      }
    );
  }

  if (want("workbench")) {
    /* One column at a time (the page's own `?only=`): the whole board is
       over 10,000px tall at 390 and reads as a strip of dots. */
    for (const col of ["a", "b", "now"]) {
      await scene(`workbench-${col}`, theme, async (page) => {
        if (!(await go(page, `/workbench/icons?only=${col}`, "main", `workbench-icons-${col}`))) return;
        await fullShot(page, `workbench-icons-${col}`, theme);
      });
    }
  }

  if (want("moment") && MOMENT_HTML) {
    /* Best round yet: the component's own markup laid over the live page, so it wears the build's CSS. */
    await scene(
      "moment",
      theme,
      async (page) => {
        if (!(await go(page, "/games", "main .game-card", "moment"))) return;
        await page.evaluate((html) => {
          const el = document.createElement("div");
          el.id = "look-inject";
          el.style.cssText = "position:fixed;inset:0;z-index:60;background:var(--color-ground);padding:72px 16px 0";
          el.innerHTML = html;
          document.body.appendChild(el);
        }, MOMENT_HTML);
        await settle(page);
        await crop(page, "moment", theme, "#look-inject .card", 16);
      },
      () => {
        state.premium = true;
        profile.premium = true;
        state.games = true;
      }
    );
  }
}

await browser.close();
console.log(`\n${written.length} shots in ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} failure(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("every scene found its surface and its state");
