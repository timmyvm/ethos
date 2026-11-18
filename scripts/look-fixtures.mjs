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
/* Dates are the camera's: every context shoots in Australia/Melbourne,
   so "today", each recording's day and each period end are that
   calendar's, whatever zone this script runs in. The recordings were
   built in the script's zone, which in a UTC container put yesterday's
   18:12 at 05:12 today in Melbourne: every shot showed today already
   spoken ("One more", "On your line.") and the morning nobody had
   photographed. */
const MEL = "Australia/Melbourne";
/*
 * LOOK_TODAY (YYYY-MM-DD): the camera's Melbourne "today", for a scene
 * photographed on another day than the one it runs on (the tester test's
 * last day, the week after it, #402). Every recording, period end and
 * date column is then that many days from it; the camera fixes the
 * page's clock to the same day (page.clock.setFixedTime).
 */
export const LOOK_TODAY = /^\d{4}-\d{2}-\d{2}$/.test(process.env.LOOK_TODAY ?? "") ? process.env.LOOK_TODAY : null;
const [MY, MM, MD] = (
  LOOK_TODAY ??
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MEL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
)
  .split("-")
  .map(Number);
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
/** n days before Melbourne's today, at h:12 on Melbourne's clock. */
const day = (n, h = 18) => {
  const wall = Date.UTC(MY, MM - 1, MD - n, h, 12);
  return new Date(wall - melOffset(new Date(wall)) * 60000);
};
const iso = (n) => day(n).toISOString();
/** That day's date in Melbourne, as a `date` column holds it. */
const dateOnly = (n) => {
  const d = new Date(Date.UTC(MY, MM - 1, MD - n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

// Days ago the user spoke (yesterday last, so today is still open).
const SPOKE = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26];
const LESSONS = [
  ["f1", 3], ["f1", 2], ["f2", 3], ["f2", 2], ["f3", 3], ["f3", 3], ["f4", 2], ["f4", 3],
  ["p1", 3], ["p1", 2], ["p2", 2], ["p2", 3], ["p3", 1], ["p3", 2], ["p4", 2],
  ["h1", 3], ["h1", 2], ["h2", 2], ["h2", 1], ["h3", 1], ["h3", 2], ["h4", 1],
];
/*
 * lessons-22: five recordings filed against lesson practices, so the
 * camera can photograph lesson progress at all (lib/lesson-progress.ts
 * reads it from `lesson:<id>:<n>` and nothing else). The landing
 * (Pausing) is done, three of three; the closed mouth (Fillers) is two
 * in, so Up next says carry on with its third. The cold open stays
 * untouched: check-lessons.mjs walks it from zero. Keyed by the
 * recording's index, oldest first; the newest (rep-22, the camera's
 * rep-detail) keeps its road id.
 */
const LESSON_PRACTICE = {
  12: "lesson:the-landing:1",
  14: "lesson:the-landing:2",
  16: "lesson:the-landing:3",
  18: "lesson:closed-mouth:1",
  20: "lesson:closed-mouth:2",
};
const pauses = (held) =>
  Array.from({ length: held }, (_, i) => ({ t: 6 + i * 11, len: 1.1 + (i % 3) * 0.3, kind: i % 3 === 1 ? "mid" : "pre" }));

/*
 * log-14: the Index a row shows is the sum of its own dimensions, the
 * way the app computes it (lib/index-score.ts `ethosIndex`, inlined:
 * this file cannot import the TS lib). The old fixture drew the Index
 * on its own curve, so every shot of a stored recording printed a hero
 * its nine rows did not add up to.
 */
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

/** The coach's focus, from the fillers this row actually has. */
const focusFor = (fillers) => {
  if (fillers.length === 0) return "Keep the pause before your point.";
  const counts = {};
  for (const f of fillers) counts[f.word] = (counts[f.word] ?? 0) + 1;
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return `Kill \u2018${top}\u2019. ${n} of your ${fillers.length} filler${fillers.length === 1 ? "" : "s"}.`;
};

const TIER2 = {
  structure: { score: 64, citedMoment: '"the mistake people make is waiting to feel ready"', improve: "Open with the claim, then the example." },
  credibility: { score: 58, citedMoment: '"ready is a feeling that shows up after you start"', improve: "Name one number." },
  engagement: { score: 61, citedMoment: '"the big version arrives on its own"', improve: "One question to the room." },
  confidence: { score: 66, citedMoment: '"you do the small version every day"', improve: "Land the last sentence." },
};

const reps = SPOKE.map((ago, i) => {
  const idx = SPOKE.length - 1 - i; // oldest first below
  return { ago, i, idx };
})
  .sort((a, b) => b.ago - a.ago)
  .map(({ ago }, i) => {
    const [lesson, stars] = LESSONS[i % LESSONS.length];
    const fillerCount = Math.max(0, 9 - Math.round(i / 3) + (i % 2));
    const fillers = Array.from({ length: fillerCount }, (_, k) => ({ word: k % 2 ? "um" : "like", t: 4 + k * 7.3 }));
    const tier1 = { pause: 60 + (i % 5) * 6, fillers: 40 + i * 2, repairs: 66, pace: 80 + (i % 3) * 5, range: 58 };
    return {
      id: `rep-${i + 1}`,
      lesson_id: LESSON_PRACTICE[i] ?? lesson,
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
      filler_count: fillerCount,
      fillers,
      pauses: pauses(2 + (i % 4)),
      stars,
      /* LOOK_FOCUS: a stored line as the coach writes one, read and
         instruction together ("... Tomorrow: ..."), for the Log's detail. */
      focus: process.env.LOOK_FOCUS ?? focusFor(fillers),
      strength: "Held the pause before \u2018the mistake people make\u2019.",
      supply: { original: "making the thing small", upgrade: "making the habit small", note: "It says exactly what you meant." },
      ethos_index: indexOf(tier1, TIER2),
      audio_path: null,
      dimensions: {
        tier1,
        anchors: { hedgeCount: 2, restartCount: 1 },
        tier2: TIER2,
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
      /* The outbox key it was stored under (0016): a tester's answer about it is filed by this. */
      client_id: `look-${i + 1}`,
    };
  });

const xp_events = reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
/*
 * LOOK_POSE: the Demos pose the account wears as its picture (#488). The default
 * buys and wears the speaking pose; "none" keeps it bought and takes it
 * off (no choice: the initial); another shop pose id is bought instead, at
 * its catalog price, and worn.
 *
 *   LOOK_POSE=none node scripts/look.mjs after-bare you
 */
export const POSE = process.env.LOOK_POSE ?? "pose_speaking";
const POSE_PRICE = { pose_speaking: 8, pose_workout: 8, pose_celebrate: 12 };
const BOUGHT = POSE === "none" ? "pose_speaking" : POSE;
if (!POSE_PRICE[BOUGHT]) throw new Error(`LOOK_POSE=${POSE} is not one of none, ${Object.keys(POSE_PRICE).join(", ")}`);
/** The device's copy of the worn pose (`ethos.prefs`), which seed() writes. */
export const POSE_PREF = POSE === "none" ? null : POSE;
// 17 earned, 8 spent on the speaking pose (or LOOK_POSE's, at its price):
// 9 in hand, so the shop shows every button state at once (owned, buy,
// two "more to go").
const coin_ledger = [
  ...SPOKE.slice(0, 17).map((ago, i) => ({ id: `c${i}`, kind: "earned", amount: 1, reason: "streak_day", earned_on: dateOnly(ago), created_at: iso(ago) })),
  { id: "spent-1", kind: "spent", amount: POSE_PRICE[BOUGHT], reason: `shop:${BOUGHT}`, earned_on: null, created_at: iso(9) },
];
const lexicon = [
  /* Pairs that pass #429's rule in their own takes: the speaker's words,
     said better, at the same strength. */
  { id: "l1", original: "really good", upgrade: "so moving", created_at: iso(1) },
  { id: "l2", original: "doing stuff for", upgrade: "getting ready for", created_at: iso(3) },
  { id: "l3", original: "a lot of rain", upgrade: "heavy rain", created_at: iso(5) },
  { id: "l4", original: "making the thing small", upgrade: "making the habit small", created_at: iso(8) },
  { id: "l5", original: "make a decision about", upgrade: "decide on", created_at: iso(12) },
];
const profile = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: POSE_PREF };

// ---- The plan: LOOK_PLAN picks the profile and the billing row -------------
/*
 * The price ladder (docs/ladder-spec.md) reads two rows: the profile's
 * premium and the billing row lib/billing.ts writes. LOOK_PLAN sets both,
 * dated from today so "From 24 Nov" is always a month out:
 *
 *   free (the default)  no row, premium off: the Premium door
 *   code                no row, premium on: an invite code
 *   active3             month 3, A$10.99, A$9.99 from a month on
 *   floor               month 9, A$6.99 every month
 *   ending              month 3, cancelled: Premium until the period end
 *   pastdue             month 3, the renewal declined and being retried
 *   pastdueending       pastdue, set to end in Stripe's portal (the app's
 *                       cancel ends a declined plan now)
 *   unpaid              month 3, retries ran out, Premium off
 *   unpaidending        unpaid, set to end in the portal: at the period end
 *   incomplete          the first payment pending
 *   ended               a plan that ended, premium off
 *   month1              month 1, as the checkout return lands
 *   drop4               month 4 starting today (the price drop; seed
 *                       LOOK_SEEN=3 so this device last saw month 3)
 *
 * The billing API's cancel and resume move the row (billingApiRoute), so
 * a camera walking the manage sheet sees the next state; `resetPlan()`
 * puts it back, and look.mjs calls it for each theme.
 */
export const PLAN_NAME = process.env.LOOK_PLAN ?? "free";
/* Period ends are Melbourne's calendar (MY, MM, MD, at the top), at
   12:12 there (01:12 UTC). */
const inDays = (n) => new Date(Date.UTC(MY, MM - 1, MD + n, 1, 12)).toISOString();
/** A month from today on the same day, Stripe's way (clamped to the month's last day). */
const inAMonth = () => {
  const last = new Date(Date.UTC(MY, MM + 1, 0)).getUTCDate();
  return new Date(Date.UTC(MY, MM, Math.min(MD, last), 1, 12)).toISOString();
};
const planRow = (over) => ({
  status: "active",
  ladder_month: 3,
  price_cents: 1099,
  next_price_cents: 999,
  current_period_end: inDays(30),
  cancel_at_period_end: false,
  ...over,
});
const PLANS = {
  free: { premium: false, billing: null },
  code: { premium: true, billing: null },
  active3: { premium: true, billing: planRow({}) },
  floor: { premium: true, billing: planRow({ ladder_month: 9, price_cents: 699, next_price_cents: 699 }) },
  ending: { premium: true, billing: planRow({ cancel_at_period_end: true, next_price_cents: null }) },
  pastdue: { premium: true, billing: planRow({ status: "past_due", current_period_end: inDays(29) }) },
  pastdueending: { premium: true, billing: planRow({ status: "past_due", current_period_end: inDays(29), cancel_at_period_end: true, next_price_cents: null }) },
  unpaid: { premium: false, billing: planRow({ status: "unpaid", current_period_end: inDays(12) }) },
  unpaidending: { premium: false, billing: planRow({ status: "unpaid", current_period_end: inDays(12), cancel_at_period_end: true, next_price_cents: null }) },
  incomplete: {
    premium: false,
    billing: planRow({ status: "incomplete", ladder_month: 0, price_cents: null, next_price_cents: null, current_period_end: inAMonth() }),
  },
  ended: { premium: false, billing: planRow({ status: "canceled", next_price_cents: null, current_period_end: inDays(-20) }) },
  month1: { premium: true, billing: planRow({ ladder_month: 1, price_cents: 1299, next_price_cents: 1199, current_period_end: inAMonth() }) },
  drop4: { premium: true, billing: planRow({ ladder_month: 4, price_cents: 999, next_price_cents: 899, current_period_end: inAMonth() }) },
};
if (!PLANS[PLAN_NAME]) {
  throw new Error(`LOOK_PLAN=${PLAN_NAME} is not one of ${Object.keys(PLANS).join(", ")}`);
}
/** The plan the mock answers with now: billing may move under cancel and resume. */
export const plan = { premium: false, billing: null };
/** Back to LOOK_PLAN, or to `name` for a camera that needs one plan for one screen (check-sheet-touch's manage sheet). */
export function resetPlan(name = PLAN_NAME) {
  const p = PLANS[name];
  plan.premium = p.premium;
  plan.billing = p.billing ? { ...p.billing } : null;
  const until = plan.billing?.current_period_end ? new Date(new Date(plan.billing.current_period_end).getTime() + 3 * 86_400_000).toISOString() : null;
  profile.premium = plan.premium;
  profile.premium_until = plan.premium && plan.billing ? until : null;
}
resetPlan();
/** LOOK_SEEN, the last ladder month this device celebrated (ethos.ladder.seen), or null. */
export const SEEN = process.env.LOOK_SEEN ?? null;
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
/*
 * LOOK_FRESH=1: an account that finished the introduction and has not
 * recorded yet, the state a first-time tester meets Today and Lessons
 * in. No recordings, no XP, no coins, no lexicon, no freezes; the
 * profile (the name typed in the introduction) and the plan stay.
 *
 *   LOOK_FRESH=1 node scripts/look.mjs before-fresh today lessons
 */
export const FRESH = process.env.LOOK_FRESH === "1";
const TABLES = FRESH
  ? { reps: [], xp_events: [], coin_ledger: [], lexicon: [], streak_freezes: [], onboarding: [] }
  : { reps, xp_events, coin_ledger, lexicon, streak_freezes, onboarding: [] };

/**
 * Tester mode for the camera (scripts/look-testers.mjs): who is a tester,
 * what the answers' writes do, and what was sent. `consentVersion` is
 * the consent the app shows (3 since 30 Oct); set it lower for a tester
 * asked again. `collected` holds every batch /api/tester/collect was sent
 * (collectRoute), and `collect` "stop" answers as the route does for
 * someone who is not testing.
 */
export const testerMode = {
  tester: process.env.LOOK_TESTER === "1",
  feedback: "ok",
  answers: [],
  consentVersion: Number(process.env.LOOK_CONSENT ?? 3),
  stored: {},
  collected: [],
  collect: "ok",
  /* When the account joined (testers.created_at): 14:00 on the test's
     first day in Melbourne, so its 18:12 recording that day counts. */
  joinedAt: "2026-10-30T03:00:00Z",
  /* A recording made today at 09:12 (TODAY_REP), on the reps reads, so
     Today shows a day already spoken and its question (#402). */
  today: false,
  /* The history read answers 500 (Today's unknown state). */
  repsFail: false,
  /* Milliseconds the testers row waits before it answers (the loading frame). */
  testerDelay: 0,
};

/**
 * Your words for the camera (#411, migration 0023): the rows the page
 * reads, `fail` for its error, `delay` (ms) for its skeleton. SAVED_ROWS
 * is a populated list; the default is empty, the page's first state.
 */
export const SAVED_ROWS = [
  /* Pairs that pass the word sheet's rule (#428): each keeps the meaning
     and says it better in its sentence, a phrase where the idiom or the
     intensifier is the unit. */
  { id: "sw-1", word: "thing", instead: "problem", sentence: "We need to fix the thing with the login page before Friday.", rep_id: null, created_at: iso(0) },
  { id: "sw-2", word: "very cold", instead: "freezing", sentence: "It was very cold on the walk home.", rep_id: null, created_at: iso(1) },
  { id: "sw-3", word: "got", instead: "landed", sentence: "I got the job last week.", rep_id: null, created_at: iso(2) },
  { id: "sw-4", word: "switch things up", instead: "shake things up", sentence: "I think today's the day I switch things up.", rep_id: null, created_at: iso(4) },
  { id: "sw-5", word: "a lot of people", instead: "crowds", sentence: "There were a lot of people at the protest on Saturday.", rep_id: null, created_at: iso(6) },
];
export const savedWordsMode = { rows: [], fail: false, delay: 0 };

/*
 * Say it better (#507, scripts/look-say-it-better.mjs): a list in every
 * state. sayMode.on puts SAY_LEXICON in the coach's table, SAY_SAVED in
 * the word sheet's, the recordings they came from and the later ones that
 * use them in the reps reads, and SAY_STATE in the test's table:
 *
 *   to test today  the thing is, doing stuff for, kind of like (never
 *                  tested, saved 2 to 4 days ago)
 *   you now say    make a decision about → decide on (a later recording,
 *                  twice), at the end of the day → in the end (yesterday's),
 *                  got → landed (a later recording)
 *   learning       a lot of rain (said once, back in 2 days), making the
 *                  thing small (back in 5; the live take says "making the
 *                  habit small", so the glance's proof line fires), very
 *                  cold (missed yesterday, over today's three: back
 *                  tomorrow), a lot of people (back in 6)
 *
 * sayMode.dry moves every test day into the future (nothing due);
 * sayMode.table "missing" answers the test's table as production does
 * before 0036 (the phone keeps the test); sayMode.empty is a new account.
 */
export const sayMode = { on: process.env.LOOK_SAY === "1", dry: false, empty: false, table: "ok", written: [] };
const sayUuid = (n) => `5a1b2c3d-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Whisper's timed words for a transcript: about 0.38s a word, a breath after each full stop. */
function timedWords(text) {
  const raw = text.split(/\s+/).filter(Boolean);
  let t = 0.6;
  return raw.map((tok) => {
    const word = tok.replace(/[^A-Za-z0-9']/g, "");
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]$/.test(tok) ? 0.9 : 0);
    return w;
  });
}
const sayRep = (n, ago, transcript) => ({
  ...reps[reps.length - 1],
  id: sayUuid(100 + n),
  client_id: `look-say-${n}`,
  created_at: iso(ago),
  lesson_id: "h4",
  transcript,
  words: timedWords(transcript),
});
export const SAY_REPS = [
  sayRep(1, 2, "I want to talk about habits. Most people think it comes down to motivation. So the thing is, habits compound when nobody's watching. Five minutes a day is enough."),
  sayRep(2, 3, "Last month was hectic. I was doing stuff for the trip all week, so the practice slipped. It came back once the bags were packed."),
  sayRep(3, 4, "Planning is easy to get wrong. It's kind of like when you plan a week nobody could actually do. Then one missed day ends the plan."),
  sayRep(4, 12, "The wedding was a lot of work. We had to make a decision about the venue before anything else. That took a month."),
  sayRep(5, 10, "The trip went sideways twice. At the end of the day, it was worth it. I would do it again tomorrow."),
  sayRep(6, 6, "The weekend was a wash. There was a lot of rain on Saturday, so we stayed in and cooked."),
  sayRep(7, 5, "Every project needs one call made early. I had to decide on a scope before the team could start. Then we had to decide on a date, and that one was harder."),
  sayRep(8, 1, "I spent the weekend fixing the plan. In the end the plan held, and nobody had to stay late. I landed the interview on Monday too."),
];
export const SAY_LEXICON = [
  { id: sayUuid(1), original: "the thing is", upgrade: "the point is", rep_id: SAY_REPS[0].id, created_at: iso(2) },
  { id: sayUuid(2), original: "doing stuff for", upgrade: "getting ready for", rep_id: SAY_REPS[1].id, created_at: iso(3) },
  { id: sayUuid(3), original: "kind of like", upgrade: "for example", rep_id: SAY_REPS[2].id, created_at: iso(4) },
  { id: sayUuid(4), original: "make a decision about", upgrade: "decide on", rep_id: SAY_REPS[3].id, created_at: iso(12) },
  { id: sayUuid(5), original: "at the end of the day", upgrade: "in the end", rep_id: SAY_REPS[4].id, created_at: iso(10) },
  { id: sayUuid(6), original: "a lot of rain", upgrade: "heavy rain", rep_id: SAY_REPS[5].id, created_at: iso(6) },
  { id: sayUuid(7), original: "making the thing small", upgrade: "making the habit small", rep_id: (reps.find((r) => r.created_at === iso(8)) ?? reps[0]).id, created_at: iso(8) },
];
export const SAY_SAVED = [
  { id: sayUuid(11), word: "very cold", instead: "freezing", sentence: "It was very cold on the walk home.", rep_id: null, created_at: iso(3) },
  { id: sayUuid(12), word: "got", instead: "landed", sentence: "I got the job last week.", rep_id: null, created_at: iso(9) },
  { id: sayUuid(13), word: "a lot of people", instead: "crowds", sentence: "There were a lot of people at the protest on Saturday.", rep_id: null, created_at: iso(7) },
];
/** The test's table (0036): the swaps already tested, keyed as the app keys them. */
const sayState = (key, step, dueIn, last, testedAgo) => ({
  swap: key,
  step,
  due: dateOnly(-dueIn),
  last,
  tested_on: testedAgo === null ? null : dateOnly(testedAgo),
  heard_at: null,
  hidden: false,
  updated_at: iso(testedAgo ?? 1),
});
export function sayStateRows() {
  if (sayMode.dry) {
    return [...SAY_LEXICON.map((l) => `c:${l.id}`), ...SAY_SAVED.map((w) => `w:${w.id}`)].map((k, i) => sayState(k, 1, 2 + (i % 4), "said", 1));
  }
  return [
    sayState(`c:${sayUuid(6)}`, 1, 2, "said", 1),
    sayState(`c:${sayUuid(7)}`, 2, 5, "said", 2),
    sayState(`w:${sayUuid(11)}`, 0, 0, "missed", 1),
    sayState(`w:${sayUuid(13)}`, 2, 6, "said", 1),
  ];
}

/**
 * Rows a camera adds to the reps reads (scripts/look-glance.mjs's lesson3:
 * the lesson's first two practices, taken earlier today). Empty by
 * default, so every other shot keeps the three weeks it always had.
 */
export const extraReps = [];

/**
 * Rows a camera puts in the reps table's place (scripts/look-levels.mjs:
 * a mix of trait levels and progress the three weeks never reach). Null,
 * the default, keeps the three weeks.
 */
export const repsMode = { rows: null };

/*
 * Migration 0037 (#511): every reps row answers with `scorable`,
 * `word_count` and `distinct_words`, worked out from its own transcript
 * the way the migration fills them (lib/metrics.ts `substance`, mirrored
 * here so a row a camera builds from another never carries its parent's
 * counts). LOOK_BEFORE_0037=1, or schema0037.applied set false, answers
 * as production does before the migration: a select naming one of the
 * three is refused with 42703, and no row carries them.
 */
export const schema0037 = { applied: process.env.LOOK_BEFORE_0037 !== "1" };
const SUBSTANCE_COLS = ["scorable", "word_count", "distinct_words"];
function substanceOf(text) {
  const tokens = (String(text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(Boolean);
  const n = tokens.length;
  const d = new Set(tokens).size;
  const ratio = n > 0 ? Math.round((d / n) * 1000) / 1000 : 0;
  return { scorable: n >= 20 && ratio >= 0.3, word_count: n, distinct_words: d };
}
function withSubstance(row) {
  if (!row || typeof row !== "object" || !("transcript" in row)) return row;
  if (SUBSTANCE_COLS.every((c) => typeof row[c] === "boolean" || typeof row[c] === "number")) return row;
  return { ...row, ...substanceOf(row.transcript) };
}
function withoutSubstance(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const c of SUBSTANCE_COLS) delete out[c];
  return out;
}

/*
 * #498: fourteen recordings (about production's p90 account) that put
 * You's trait levels in every state a level can be in under trait XP
 * (repsMode.rows = LEVEL_MIX). Every take is scorable and pays each trait
 * its score; level n costs 70 x n (lib/traits.ts):
 *
 *   Filler control  88 thirteen times, then 74: 1218 XP, level 5, 168
 *                   of level 6's 420 (40%), last +74
 *   Variety         62 thirteen times, then 69: 875, level 4, 175 of
 *                   350 (50%)
 *   Pace            48 every time: 672, level 3, 252 of 280 (90%)
 *   Pausing         15 every time: 210, level 2 just reached, its bar
 *                   empty
 *   Restart control 0 but one 40: level 0, 40 of 70 (57%), last +0
 *   Structure 60, Credibility 55, Steadiness 58 each time (Premium's
 *   rows): levels 4 at 40%, 20% and 32%. Engagement is never read: on
 *   Premium its row says "Not yet".
 *
 * lib/traits.test.ts holds the same fourteen to the same numbers.
 */
const LEVEL_TIER2 = {
  structure: { score: 60, citedMoment: TIER2.structure.citedMoment, improve: TIER2.structure.improve },
  credibility: { score: 55, citedMoment: TIER2.credibility.citedMoment, improve: TIER2.credibility.improve },
  confidence: { score: 58, citedMoment: TIER2.confidence.citedMoment, improve: TIER2.confidence.improve },
};
const LEVEL_TAKES = Array.from({ length: 14 }, (_, i) => [
  14 - i,
  {
    pause: 15,
    fillers: i === 13 ? 74 : 88,
    repairs: i === 6 ? 40 : 0,
    pace: 48,
    range: i === 13 ? 69 : 62,
  },
]);
export const LEVEL_MIX = LEVEL_TAKES.map(([n, tier1], i) => {
  const all = { ...tier1, ...Object.fromEntries(Object.entries(LEVEL_TIER2).map(([k, v]) => [k, v.score])) };
  return {
    ...reps[reps.length - 1],
    id: `lv-${i + 1}`,
    client_id: `look-lv-${i + 1}`,
    created_at: iso(n),
    ethos_index: Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + (k in all ? points(all[k], w) : 0), 0),
    dimensions: { tier1, anchors: { hedgeCount: 2, restartCount: 1 }, tier2: LEVEL_TIER2 },
  };
});

/** Today's recording for `testerMode.today`: the newest fixture's, made at 09:12 today, its Index 665. */
export const TODAY_REP = {
  ...reps[reps.length - 1],
  id: "7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  client_id: "k-today",
  created_at: day(0, 9).toISOString(),
  ethos_index: 665,
  stars: 2,
  lesson_id: "h4",
};

/*
 * Game rounds for the camera (the games plan, items 7 and 12): rows
 * filed `game:<id>:<q>` with `reps.round` set (migration 0026), so
 * Practice's tiles show a ladder. Off by default, so every other shot
 * keeps the three weeks it always had; LOOK_GAMES=1, or a camera setting
 * gamesMode.on, adds them to the reps reads.
 *   - Q&A at level 2, one of two days counted, best 31s clean.
 *   - Speed rush mastered: two days at each level, three 3-star days at
 *     level 3, four landed in a row there.
 *   - Interview at level 1, one day counted, best Index 712.
 * gamesMode.playedToday adds a round of today's free game (the rotation
 * in lib/games.ts) at 09:12 today, so the free tile reads as spent;
 * gamesMode.hostileUsed files this week's Hostile Q&A take.
 *
 *   LOOK_GAMES=1 node scripts/look.mjs after practice
 */
export const gamesMode = { on: process.env.LOOK_GAMES === "1", playedToday: false, hostileUsed: false };

/** lib/games.ts `gameOfTheDay`, inlined (this file cannot import the TS lib). */
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
/** [days ago, game, question, stars, index, round] */
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
  const rows = GAME_ROUNDS.map(([ago, g, q, stars, index, round], i) =>
    row(ago, 8, `game-${i + 1}`, `game:${g}:${q}`, stars, index, round)
  );
  if (gamesMode.playedToday) {
    const g = gameOfTheDayFixture(0);
    const round =
      g === "rush"
        ? { game: "rush", ...roundBase(1, 45, 41, 2, true), spare: 3.4, landed: true }
        : { game: "interview", ...roundBase(1, 90, 71, 2, true, 668), firstWord: 0.8, inWindow: true, numberAtEnd: null, cutIns: [] };
    rows.push(row(0, 9, "game-today", `game:${g}:${g === "rush" ? "ru20" : "iv14"}`, 2, 668, round));
  }
  if (gamesMode.hostileUsed) rows.push(row(0, 9, "hostile-today", "hostile-take", 2, 641, null));
  /* The Log's Games side (#486): three weeks of the weekly boss, the
     middle one taken twice (its first scored take counts), and a Hostile
     Q&A take with its stored verdict. Each at least eight days back, so
     no camera's "this week" changes: Practice's Start, /boss's lock and
     Hostile's free week read as they always did. */
  const bossTake = (ago, h, id, topic, index, accuracy) => ({
    ...row(ago, h, id, `boss:${topic}`, 2, index, null),
    mode: "boss", boss_topic_id: topic, duration_s: 84,
    /* As /api/analyze stores it (lib/accuracy.ts AccuracyResult): the
       stored recording's AccuracyCard counts `covered`, and a row
       without it threw on /rep/[id] (#486 review). */
    accuracy:
      accuracy === null
        ? null
        : { score: accuracy, coverage: accuracy / 100, covered: [0, 1, 2], missed: [], confidentlyWrong: 0, claims: [] },
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

/** /api/tester/collect as the route answers it, every batch kept for the camera's checks. */
export async function collectRoute(route) {
  const req = route.request();
  let body = null;
  try {
    body = JSON.parse(req.postData() ?? "null");
  } catch {}
  testerMode.collected.push({ body, auth: req.headers()["authorization"] ?? null, at: Date.now() });
  if (testerMode.collect === "stop") return route.fulfill(json({ error: "Not testing.", stop: true }, 403));
  return route.fulfill(json({ ok: true, kept: Array.isArray(body?.events) ? body.events.length : 0 }));
}
/** A tester on the consent the app shows (content/tester.ts CONSENT_VERSION); set testerMode.consentVersion lower for one asked again. */
const testerRow = () => ({ consent_version: testerMode.consentVersion, consented_at: iso(9), created_at: testerMode.joinedAt });

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
  /* Tester mode (migration 0020): LOOK_TESTER=1, or testerMode.tester
     set by a camera, makes the account a tester; testerMode.feedback
     "fail" refuses the match check's answers. Off, both behave as any
     table the account has no row in. */
  if (url.pathname.startsWith("/rest/v1/testers")) {
    if (testerMode.testerDelay) await new Promise((r) => setTimeout(r, testerMode.testerDelay));
    const row = testerMode.tester ? testerRow() : null;
    if (single) return route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
    return route.fulfill(json(row ? [row] : []));
  }
  if (url.pathname.startsWith("/rest/v1/tester_feedback") && req.method() !== "GET") {
    let sent = null;
    try {
      sent = req.postDataJSON();
    } catch {}
    testerMode.answers.push(sent);
    if (testerMode.feedback === "fail") return route.fulfill(json({ code: "XX000", message: "look: refused" }, 500));
    if (testerMode.feedback === "slow") await new Promise((r) => setTimeout(r, 1500));
    // Kept by recording, so the Log's page reopens an answer as it was left.
    if (sent?.client_id) testerMode.stored[sent.client_id] = sent;
    return route.fulfill({ status: 201, headers: cors, body: "" });
  }
  if (url.pathname.startsWith("/rest/v1/tester_feedback")) {
    const key = (url.searchParams.get("client_id") ?? "").replace(/^eq\./, "");
    const row = testerMode.stored[key] ?? null;
    if (single) return route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
    return route.fulfill(json(row ? [row] : []));
  }
  /* Your words (migration 0023): savedWordsMode.rows is the table;
     "fail" refuses the read, "slow" holds it, and a write lands in rows. */
  if (url.pathname.startsWith("/rest/v1/saved_words")) {
    if (savedWordsMode.delay) await new Promise((r) => setTimeout(r, savedWordsMode.delay));
    if (req.method() === "GET") {
      if (savedWordsMode.fail) return route.fulfill(json({ code: "XX000", message: "look: refused" }, 500));
      const rows = [...savedWordsMode.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      if (single) return route.fulfill(rows[0] ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406));
      return route.fulfill(json(rows));
    }
    if (req.method() === "POST") {
      let sent = null;
      try {
        sent = req.postDataJSON();
      } catch {}
      const row = { id: `sw-${savedWordsMode.rows.length + 1}-${Date.now()}`, created_at: new Date().toISOString(), sentence: null, rep_id: null, ...sent };
      delete row.user_id;
      savedWordsMode.rows.push(row);
      return route.fulfill(json(single ? row : [row], 201));
    }
    if (req.method() === "DELETE") {
      const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
      savedWordsMode.rows = savedWordsMode.rows.filter((r) => r.id !== id);
      return route.fulfill({ status: 204, headers: cors, body: "" });
    }
  }
  /* Say it better's test (0036): sayMode.table "missing" answers as
     production does before the migration; a write is kept. */
  if (url.pathname.startsWith("/rest/v1/say_better")) {
    if (sayMode.table === "missing") {
      return route.fulfill(json({ code: "PGRST205", message: "Could not find the table 'public.say_better' in the schema cache" }, 404));
    }
    if (req.method() === "GET") return route.fulfill(json(sayMode.on && !sayMode.empty ? sayStateRows() : []));
    try {
      sayMode.written.push(req.postDataJSON());
    } catch {}
    return route.fulfill({ status: 201, headers: cors, body: "" });
  }
  if (url.pathname.startsWith("/rest/v1/billing")) {
    const row = plan.billing;
    if (single) return route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
    return route.fulfill(json(row ? [row] : []));
  }
  const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
  if (req.method() !== "GET") return route.fulfill(json([]));
  if (table === "reps" && testerMode.repsFail) return route.fulfill(json({ code: "XX000", message: "look: history refused" }, 500));
  if (table === "reps" && !schema0037.applied) {
    const named = (url.searchParams.get("select") ?? "").split(",").map((c) => c.trim()).find((c) => SUBSTANCE_COLS.includes(c));
    if (named) return route.fulfill(json({ code: "42703", message: `column reps.${named} does not exist` }, 400));
  }
  let rows = table === "reps" && repsMode.rows ? repsMode.rows : TABLES[table] ?? [];
  if (sayMode.on && table === "lexicon") rows = sayMode.empty ? [] : SAY_LEXICON;
  if (sayMode.on && table === "reps" && !FRESH && !sayMode.empty) rows = [...rows, ...SAY_REPS];
  if (table === "reps" && testerMode.today && !FRESH) rows = [...rows, TODAY_REP];
  if (table === "reps" && extraReps.length > 0 && !FRESH) rows = [...rows, ...extraReps];
  if (table === "reps" && gamesMode.on && !FRESH) {
    rows = [...rows, ...gameRows()];
    // fetchGameRounds asks for game:% rows; the mock honours that one filter.
    if ((url.searchParams.get("lesson_id") ?? "").startsWith("like.game:")) {
      rows = rows.filter((r) => (r.lesson_id ?? "").startsWith("game:"));
    }
  }
  // PostgREST's order and limit, honoured, so a read for the newest N
  // gets the newest N (fetchReps asks descending and reverses).
  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    const sign = dir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => (a[col] < b[col] ? -sign : a[col] > b[col] ? sign : 0));
  }
  const limit = Number(url.searchParams.get("limit"));
  if (limit > 0) rows = rows.slice(0, limit);
  if (table === "reps") rows = rows.map(schema0037.applied ? withSubstance : withoutSubstance);
  const id = url.searchParams.get("id");
  /* PostgREST's in.(…) on ids (Say it better reads a few recordings' timed words). */
  if (id && id.startsWith("in.(")) {
    const want = new Set(id.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")));
    return route.fulfill(json(rows.filter((r) => want.has(r.id))));
  }
  if (id) {
    const found = rows.find((r) => r.id === id.replace(/^eq\./, ""));
    return route.fulfill(single ? (found ? json(found) : json({ code: "PGRST116", message: "0 rows" }, 406)) : json(found ? [found] : []));
  }
  if (single) return route.fulfill(rows[0] ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406));
  return route.fulfill(json(rows));
}

/*
 * The billing routes (app/api/billing/*), answered the way
 * lib/billing-routes.test.ts documents them. `checkout` is what the
 * checkout route says, set per shot (billingMode.checkout):
 *   "slow"     never answers inside a shot: the tap's busy state
 *   "account"  403 needsAccount: an anonymous session
 *   "error"    502 with the server's sentence
 *   "manage"   { manage: true }, then the portal
 *   "url"      a Checkout url (the camera never follows it)
 * Cancel and resume move the plan; sync answers it; the portal answers a
 * url the camera never follows.
 */
export const billingMode = { checkout: "slow", sync: "ok" };
export async function billingApiRoute(route) {
  const req = route.request();
  const name = new URL(req.url()).pathname.split("/").pop();
  const answer = (body, status = 200) => route.fulfill(json(body, status));
  if (name === "checkout") {
    const mode = billingMode.checkout;
    if (mode === "slow") {
      await new Promise((r) => setTimeout(r, 15000));
      return answer({ error: "Checkout didn't open, and nothing was charged. Try again in a minute." }, 502).catch(() => {});
    }
    if (mode === "account") return answer({ error: "Premium needs an account. Make one and everything you've practised stays.", needsAccount: true }, 403);
    if (mode === "error") return answer({ error: "Checkout didn't open, and nothing was charged. Try again in a minute." }, 502);
    if (mode === "manage") return answer({ manage: true });
    return answer({ url: "https://checkout.stripe.test/c/pay/cs_look" });
  }
  if (name === "portal") return answer({ url: "https://billing.stripe.test/p/session/look" });
  if (name === "sync") {
    if (billingMode.sync === "fail") return answer({ error: "Your plan didn't load. Try again in a minute." }, 502);
    return answer({ billing: plan.billing, premium: plan.premium });
  }
  if (name === "cancel" || name === "resume") {
    const row = plan.billing;
    if (!row) return answer({ error: "There's no plan on this account." }, 404);
    const ending = name === "cancel";
    // As lib/billing.ts cancelPlan: a declined plan ends now, Premium with it.
    if (ending && (row.status === "past_due" || row.status === "unpaid")) {
      plan.billing = { ...row, status: "canceled", cancel_at_period_end: false, next_price_cents: null, current_period_end: inDays(0) };
      plan.premium = false;
      profile.premium = false;
      profile.premium_until = null;
      await new Promise((r) => setTimeout(r, 400));
      return answer({ billing: plan.billing, premium: plan.premium });
    }
    if (ending === row.cancel_at_period_end) {
      return answer({ error: ending ? "This plan is already set to end." : "This plan has ended. A new one starts at month 1." }, 409);
    }
    plan.billing = {
      ...row,
      cancel_at_period_end: ending,
      next_price_cents: ending ? null : [1299, 1199, 1099, 999, 899, 799, 699][Math.min(row.ladder_month, 6)],
    };
    await new Promise((r) => setTimeout(r, 400));
    return answer({ billing: plan.billing, premium: plan.premium });
  }
  return answer({ error: "Not here." }, 404);
}

// The scoring mock, for the live results screen.
/*
 * LOOK_BEST=1: the live recording is a new best, three stars and an
 * Index past every fixture recording, so the score step's celebrate
 * pose (D52, lib/rewards `celebrates`) has a shot. Without it the
 * recording is two stars, three over the last, under the best, and
 * Demos speaks.
 *   LOOK_BEST=1 node scripts/look.mjs best rep-results
 */
export const BEST = process.env.LOOK_BEST === "1";
/*
 * LOOK_ONE_STAR=1: the live recording slips 12 times in its 62 seconds
 * (eleven fillers and a restart), over the second star's line of 11 a
 * minute (lib/metrics.ts starsFor, #504), so it earns the first star
 * alone: the glance with one goal lit and two open. Not with LOOK_BEST.
 */
export const ONE_STAR = !BEST && process.env.LOOK_ONE_STAR === "1";
const dim = (score, moment) => ({ score, citedMoment: moment, improve: "Open with the claim, then the example." });
const LIVE_TIER1 = BEST
  ? { pause: 92, fillers: 88, repairs: 90, pace: 96, range: 84 }
  : { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 };
const LIVE_TIER2 = {
  structure: dim(BEST ? 86 : 64, '"the mistake people make is waiting to feel ready"'),
  credibility: dim(BEST ? 82 : 58, '"ready is a feeling that shows up after you start"'),
  engagement: dim(BEST ? 80 : 61, '"the big version arrives on its own"'),
  confidence: dim(66, '"you do the small version every day"'),
};
/*
 * The live recording's words (#411): a transcript with the fillers the
 * metrics below count actually in it, and Whisper's word list with a
 * time for each, so the words step's transcript underlines what was
 * counted and its sheet says when. Whisper's list carries no
 * punctuation; the text does.
 */
const LIVE_TRANSCRIPT =
  "So the thing about habits is, um, they compound. You do the small version every day and, like, it builds on its own. Um, the mistake people make is waiting to feel ready. You know, ready is a feeling that shows up after you start. I used to think discipline was the whole answer, and I would plan a week nobody could really do, then miss a day and quit the plan instead of the day. What changed was making the habit small enough that missing it felt stupid. Five minutes. Not an hour, just five minutes I can do standing in a kitchen. And the five minutes usually turns into more, but only because it was allowed to be five.";
export const LIVE_WORDS = (() => {
  const raw = LIVE_TRANSCRIPT.match(/[A-Za-z0-9']+/g);
  // About 62 seconds, a little air after each full stop.
  let t = 0.4;
  return raw.map((word, i) => {
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]/.test(LIVE_TRANSCRIPT.split(/\s+/)[i] ?? "") ? 0.9 : 0);
    return w;
  });
})();
/** The fillers the engine counts in LIVE_WORDS, with their times, in order. */
const LIVE_FILLERS = (() => {
  const out = [];
  const w = LIVE_WORDS.map((x) => x.word.toLowerCase());
  for (let i = 0; i < w.length; i++) {
    if (w[i] === "you" && w[i + 1] === "know") out.push({ word: "you know", t: LIVE_WORDS[i++].start });
    else if (w[i] === "um" || (w[i] === "like" && w[i + 1] === "it")) out.push({ word: w[i], t: LIVE_WORDS[i].start });
  }
  return out;
})();
/*
 * LOOK_BEST's take is the cleaner one (#504 review): its three stars ask
 * for under 4 slips in 62 seconds (lib/metrics.ts starsFor), so it counts
 * the two ums and no restart, and the goals drawn under the stars agree
 * with the line Demos says. It counted 4 fillers and a restart with the
 * third star lit, which no take can earn.
 */
const LIVE_COUNTED = BEST
  ? LIVE_FILLERS.filter((f) => f.word === "um")
  : ONE_STAR
    ? /* The take's own four, then seven more ums through its middle. */
      [...LIVE_FILLERS, ...[9.5, 14, 23.5, 29, 34.5, 46, 52].map((t) => ({ word: "um", t }))].sort((a, b) => a.t - b.t)
    : LIVE_FILLERS;
const analyze = {
  transcript: LIVE_TRANSCRIPT,
  words: LIVE_WORDS,
  metrics: {
    durationS: 62, wordCount: LIVE_WORDS.length, wpm: 145, fillerCount: LIVE_COUNTED.length, fillersPerMin: BEST ? 1.9 : ONE_STAR ? 10.6 : 3.9,
    fillers: LIVE_COUNTED,
    fillerCounts: BEST ? { um: 2 } : ONE_STAR ? { um: 9, like: 1, "you know": 1 } : { um: 2, like: 1, "you know": 1 }, topFiller: "um",
    repairCount: BEST ? 0 : 1, repairsPerMin: BEST ? 0 : 1, unvoicedHesitations: 1, disfluenciesPerMin: BEST ? 1.9 : ONE_STAR ? 11.6 : 4.8,
    pauses: [{ t: 2.1, len: 1.2, kind: "pre", verdict: "opening" }, { t: 20, len: 0.9, kind: "mid" }, { t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 58, len: 1.1, kind: "pre" }],
    heldPauses: 4, composedPauses: 3, midSentencePauses: 1, stars: BEST ? 3 : ONE_STAR ? 1 : 2,
    substance: { wordCount: LIVE_WORDS.length, distinctRatio: 0.62, repeatShare: 0.05 },
  },
  /* Pace and Variety a few points over the fixture's last recording, so
     the live Index (the sum of these, log-14) lands three above it. */
  tier1: LIVE_TIER1,
  anchors: { hedgeCount: 2, restartCount: BEST ? 0 : 1 },
  coach: {
    focus: BEST ? "Kill \u2018um\u2019. Both your fillers were it." : ONE_STAR ? "Kill \u2018um\u2019. 9 of your 11 fillers." : "Kill \u2018um\u2019. 2 of your 4 fillers.",
    strength: "Held the pause before \u2018the mistake people make\u2019.",
    supply: { original: "a week nobody could really do", upgrade: "an impossible week", note: "It says the same in fewer words." },
    coachLine: BEST ? "2 fillers in 62s. Tomorrow: kill \u2018um\u2019." : ONE_STAR ? "11 fillers in 62s. Tomorrow: kill \u2018um\u2019." : "4 fillers in 62s. Tomorrow: kill \u2018um\u2019.",
    dimensions: LIVE_TIER2,
  },
  ethosIndex: indexOf(LIVE_TIER1, LIVE_TIER2), previousIndex: reps[reps.length - 1].ethos_index, repId: "rep-live", scorable: true,
  pauseHeadline: "3 pauses between sentences.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 2, capped: false },
};

/**
 * What a browser has to know to look like someone twenty-two days in:
 * the introduction is done, the theme is set, and the first-run gates
 * have already fired. Passed to `context.addInitScript`.
 */
export function seed(arg) {
  const { theme, session } = typeof arg === "string" ? { theme: arg, session: null } : arg;
  /* Serialised into the page, so the worn pose comes in on the argument
     (POSE_PREF); a caller that does not pass one wears the default. */
  const pose = arg && typeof arg === "object" && "pose" in arg ? arg.pose : "pose_speaking";
  localStorage.setItem("ethos.welcomed", new Date().toISOString());
  localStorage.setItem(
    "ethos.prefs",
    JSON.stringify({ theme, reducedMotion: false, pose, skipIntros: true, haptics: false })
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
  if (arg && typeof arg === "object" && arg.seen != null) localStorage.setItem("ethos.ladder.seen", String(arg.seen));
  // A device that last saw its account as a tester (lib/tester-client.ts).
  if (arg && typeof arg === "object" && arg.tester) localStorage.setItem("ethos.tester", "1");
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
