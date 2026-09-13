/**
 * The fixtures every look-loop tool shares: three weeks of practice, a
 * Supabase mock that answers for the whole app, the localStorage seed
 * that makes a browser look like a returning user, and a scored
 * recording for the results screen.
 *
 * Extracted so `scripts/look.mjs` (the camera) and `scripts/strip.mjs`
 * (the frame strips) photograph the SAME app. Two copies of a fixture
 * set is two apps, and the second one drifts.
 */

// ---- Fixtures: three weeks of practice ------------------------------------
const day = (n, h = 18) => {
  const d = new Date();
  d.setHours(h, 12, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const iso = (n) => day(n).toISOString();
const dateOnly = (n) => {
  const d = day(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Days ago the user spoke (yesterday last, so today is still open).
const SPOKE = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26];
const LESSONS = [
  ["f1", 3], ["f1", 2], ["f2", 3], ["f2", 2], ["f3", 3], ["f3", 3], ["f4", 2], ["f4", 3],
  ["p1", 3], ["p1", 2], ["p2", 2], ["p2", 3], ["p3", 1], ["p3", 2], ["p4", 2],
  ["h1", 3], ["h1", 2], ["h2", 2], ["h2", 1], ["h3", 1], ["h3", 2], ["h4", 1],
];
const pauses = (held) =>
  Array.from({ length: held }, (_, i) => ({ t: 6 + i * 11, len: 1.1 + (i % 3) * 0.3, kind: i % 3 === 1 ? "mid" : "pre" }));
const reps = SPOKE.map((ago, i) => {
  const idx = SPOKE.length - 1 - i; // oldest first below
  return { ago, i, idx };
})
  .sort((a, b) => b.ago - a.ago)
  .map(({ ago }, i) => {
    const [lesson, stars] = LESSONS[i % LESSONS.length];
    const index = 512 + Math.round(i * 5.9 + Math.sin(i) * 14);
    const fillers = Math.max(0, 9 - Math.round(i / 3) + (i % 2));
    return {
      id: `rep-${i + 1}`,
      lesson_id: lesson,
      created_at: iso(ago),
      duration_s: 58 + (i % 4) * 7,
      /*
       * A REAL sixty-second length, about 150 words. The old fixture
       * was 42 tokens against a claimed 128 words a minute over 58
       * seconds, which is a third of the words the rest of the row
       * says were spoken. That is not a cosmetic mismatch: distinct
       * words per hundred rises as a sample shrinks, so a 42-token
       * transcript photographed the Variety ring pinned at 100 on
       * every screen in the gallery.
       */
      transcript:
        "So the thing about habits is they compound. You do the small version every day and the big version arrives on its own. The mistake people make is waiting to feel ready. Ready is a feeling that shows up after you start, not before. I used to think discipline was the whole answer, and I would plan a week that no person could actually do, and then I would miss a day and quit the plan instead of the day. What changed was making the thing small enough that missing it felt stupid. Five minutes. Not an hour, not a session I have to clear an evening for, just five minutes I can do standing in a kitchen. And the odd part is that the five minutes usually turns into more, but it only does that because it was allowed to be five.",
      wpm: 128 + ((i * 7) % 30),
      filler_count: fillers,
      fillers: Array.from({ length: fillers }, (_, k) => ({ word: k % 2 ? "um" : "like", t: 4 + k * 7.3 })),
      pauses: pauses(2 + (i % 4)),
      stars,
      focus: "Kill 'um'. 2 of your 4 fillers.",
      strength: "Held the pause before 'the mistake people make'.",
      supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
      ethos_index: index,
      audio_path: null,
      dimensions: {
        tier1: { pause: 60 + (i % 5) * 6, fillers: 40 + i * 2, repairs: 66, pace: 80 + (i % 3) * 5, range: 58 },
        anchors: { hedgeCount: 2, restartCount: 1 },
        tier2: {
          structure: { score: 64, citedMoment: '"the mistake people make is waiting to feel ready"', improve: "Open with the claim, then the example." },
          credibility: { score: 58, citedMoment: '"ready is a feeling that shows up after you start"', improve: "Name one number." },
          engagement: { score: 61, citedMoment: '"the big version arrives on its own"', improve: "One question to the room." },
          confidence: { score: 66, citedMoment: '"you do the small version every day"', improve: "Land the last sentence." },
        },
      },
      mode: "daily",
      mods: [],
      xp_multiplier: 1,
      boss_topic_id: null,
      accuracy: null,
      capture_mode: "voice",
      delivery_metrics: null,
      presence_score: null,
      delivery_moments: null,
    };
  });

const xp_events = reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
// 17 earned, 8 spent on the speaking pose: 9 in hand, so the shop shows
// every button state at once (owned, buy, two "more to go").
const coin_ledger = [
  ...SPOKE.slice(0, 17).map((ago, i) => ({ id: `c${i}`, kind: "earned", amount: 1, reason: "streak_day", earned_on: dateOnly(ago), created_at: iso(ago) })),
  { id: "spent-1", kind: "spent", amount: 8, reason: "shop:pose_speaking", earned_on: null, created_at: iso(9) },
];
const lexicon = [
  { id: "l1", original: "really good", upgrade: "compelling", created_at: iso(1) },
  { id: "l2", original: "sort of shows", upgrade: "demonstrates", created_at: iso(3) },
  { id: "l3", original: "a lot of people", upgrade: "most of us", created_at: iso(5) },
  { id: "l4", original: "the thing about", upgrade: "what matters about", created_at: iso(8) },
  { id: "l5", original: "kind of like", upgrade: "resembles", created_at: iso(12) },
];
const profile = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: "pose_speaking" };
const streaks = { freezes_equipped: 1 };
const streak_freezes = [{ used_on: dateOnly(11) }];

// ---- Supabase mock ---------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: false, session_id: "s1" })}.sig`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "tim@example.com", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: iso(30), updated_at: iso(0) };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "r1", user };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const TABLES = { reps, xp_events, coin_ledger, lexicon, streak_freezes, onboarding: [] };

async function supabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(json(session));
  if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(json(user));
  if (url.pathname.startsWith("/auth/v1/")) return route.fulfill(json({}));
  if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill(json(0));
  if (url.pathname.startsWith("/rest/v1/profiles")) return route.fulfill(json(single ? profile : [profile]));
  if (url.pathname.startsWith("/rest/v1/streaks")) return route.fulfill(json(single ? streaks : [streaks]));
  const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
  if (req.method() !== "GET") return route.fulfill(json([]));
  const rows = TABLES[table] ?? [];
  const id = url.searchParams.get("id");
  if (id) {
    const found = rows.find((r) => r.id === id.replace(/^eq\./, ""));
    return route.fulfill(single ? (found ? json(found) : json({ code: "PGRST116", message: "0 rows" }, 406)) : json(found ? [found] : []));
  }
  if (single) return route.fulfill(rows[0] ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406));
  return route.fulfill(json(rows));
}

// The scoring mock, for the live results screen.
const dim = (score, moment) => ({ score, citedMoment: moment, improve: "Open with the claim, then the example." });
const analyze = {
  transcript: reps[0].transcript,
  metrics: {
    durationS: 62, wordCount: 150, wpm: 145, fillerCount: 4, fillersPerMin: 3.9,
    fillers: [{ word: "um", t: 5.2 }, { word: "like", t: 18.4 }, { word: "um", t: 33.1 }, { word: "you know", t: 50.7 }],
    fillerCounts: { um: 2, like: 1, "you know": 1 }, topFiller: "um",
    repairCount: 1, repairsPerMin: 1, unvoicedHesitations: 1, disfluenciesPerMin: 4.8,
    pauses: [{ t: 2.1, len: 1.2, kind: "pre", verdict: "opening" }, { t: 20, len: 0.9, kind: "mid" }, { t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 58, len: 1.1, kind: "pre" }],
    heldPauses: 4, composedPauses: 3, midSentencePauses: 1, stars: 2,
    substance: { wordCount: 150, distinctRatio: 0.62, repeatShare: 0.05 },
  },
  tier1: { pause: 72, fillers: 55, repairs: 66, pace: 90, range: 64 },
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "Kill 'um'. 2 of your 4 fillers.",
    strength: "Held the pause before 'the mistake people make'.",
    supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
    coachLine: "4 fillers in 62s. Tomorrow: kill 'um'.",
    dimensions: {
      structure: dim(64, '"the mistake people make is waiting to feel ready"'),
      credibility: dim(58, '"ready is a feeling that shows up after you start"'),
      engagement: dim(61, '"the big version arrives on its own"'),
      confidence: dim(66, '"you do the small version every day"'),
    },
  },
  ethosIndex: 651, previousIndex: reps[reps.length - 1].ethos_index, repId: "rep-live", scorable: true,
  pauseHeadline: "Two silences landed a point; one was searching.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 0, capped: false },
};

/**
 * What a browser has to know to look like someone twenty-two days in:
 * the introduction is done, the theme is set, and the first-run gates
 * have already fired. Passed to `context.addInitScript`.
 */
export function seed(arg) {
  const { theme, session } = typeof arg === "string" ? { theme: arg, session: null } : arg;
  localStorage.setItem("ethos.welcomed", new Date().toISOString());
  localStorage.setItem(
    "ethos.prefs",
    JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false })
  );
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
  // Without a session the mock answers nothing and every screen draws
  // day zero, which is not the app anybody is looking at.
  if (session) {
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
  }
}

export const supabaseRoute = supabase;
export const analyzeBody = analyze;
export { reps, profile, cors, json, session };
