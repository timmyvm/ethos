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
const [MY, MM, MD] = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
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
      focus: focusFor(fillers),
      strength: "Held the pause before \u2018the mistake people make\u2019.",
      supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
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
    };
  });

const xp_events = reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
/*
 * LOOK_POSE: the Demos pose the account wears on You's stage. The default
 * buys and wears the speaking pose; "none" keeps it bought and takes it
 * off (You's own "hello"); another shop pose id is bought instead, at
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
  { id: "l1", original: "really good", upgrade: "compelling", created_at: iso(1) },
  { id: "l2", original: "sort of shows", upgrade: "demonstrates", created_at: iso(3) },
  { id: "l3", original: "a lot of people", upgrade: "most of us", created_at: iso(5) },
  { id: "l4", original: "the thing about", upgrade: "what matters about", created_at: iso(8) },
  { id: "l5", original: "kind of like", upgrade: "resembles", created_at: iso(12) },
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

/** Tester mode for the camera (scripts/look-testers.mjs): who is a tester, what the answers' writes do, and what was sent. */
export const testerMode = { tester: process.env.LOOK_TESTER === "1", feedback: "ok", answers: [] };
const TESTER_ROW = { consent_version: 1, consented_at: iso(9) };

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
    const row = testerMode.tester ? TESTER_ROW : null;
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
    return route.fulfill({ status: 201, headers: cors, body: "" });
  }
  if (url.pathname.startsWith("/rest/v1/billing")) {
    const row = plan.billing;
    if (single) return route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
    return route.fulfill(json(row ? [row] : []));
  }
  const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
  if (req.method() !== "GET") return route.fulfill(json([]));
  let rows = TABLES[table] ?? [];
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
  const id = url.searchParams.get("id");
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
const analyze = {
  transcript: reps[0].transcript,
  metrics: {
    durationS: 62, wordCount: 150, wpm: 145, fillerCount: 4, fillersPerMin: 3.9,
    fillers: [{ word: "um", t: 5.2 }, { word: "like", t: 18.4 }, { word: "um", t: 33.1 }, { word: "you know", t: 50.7 }],
    fillerCounts: { um: 2, like: 1, "you know": 1 }, topFiller: "um",
    repairCount: 1, repairsPerMin: 1, unvoicedHesitations: 1, disfluenciesPerMin: 4.8,
    pauses: [{ t: 2.1, len: 1.2, kind: "pre", verdict: "opening" }, { t: 20, len: 0.9, kind: "mid" }, { t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 58, len: 1.1, kind: "pre" }],
    heldPauses: 4, composedPauses: 3, midSentencePauses: 1, stars: BEST ? 3 : 2,
    substance: { wordCount: 150, distinctRatio: 0.62, repeatShare: 0.05 },
  },
  /* Pace and Variety a few points over the fixture's last recording, so
     the live Index (the sum of these, log-14) lands three above it. */
  tier1: LIVE_TIER1,
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "Kill \u2018um\u2019. 2 of your 4 fillers.",
    strength: "Held the pause before \u2018the mistake people make\u2019.",
    supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
    coachLine: "4 fillers in 62s. Tomorrow: kill \u2018um\u2019.",
    dimensions: LIVE_TIER2,
  },
  ethosIndex: indexOf(LIVE_TIER1, LIVE_TIER2), previousIndex: reps[reps.length - 1].ethos_index, repId: "rep-live", scorable: true,
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
