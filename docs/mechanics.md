# mechanics.md

> Sister doc to vision.md and brand.md. This file governs progression,
> retention mechanics, economy, and pricing. AI sessions building any
> lesson flow, shop, paywall, or notification must comply.

## Progression: the path

Duolingo-style linear path. Units → lessons → stars.

- **Unit** = a skill theme (Filler Elimination, Pace Control, The Pause,
  Structure, Compression, Thinking Under Fire)
- **Lesson** = one recorded rep (60–90s) against that unit's drill type
- **Stars (1–3) per lesson** = objective metric thresholds, never
  participation. Example (Filler unit): 3★ = <3 fillers/min,
  2★ = <6, 1★ = completed. Thresholds calibrated per unit during
  beta — but ALWAYS traceable to a number (vision.md: measure,
  don't flatter; no horoscope stars)
- Replay any lesson to improve stars. Star totals gate unit unlocks.

## Mode taxonomy

**Daily rep (free, sacred):** one lesson from the path. ≤5 minutes
total. Nothing may bloat this loop.

**Boss modes (weekly, premium):** longer, harder, streak-multiplying.
- **Cold Topic** — assigned unfamiliar topic, 3–5 min research window,
  90s explanation. Scored on delivery AND accuracy (LLM knows ground
  truth; confident wrong claims get flagged). Infinite content treadmill.
- **Debate** — AI takes the opposing side of a prompt; user argues,
  AI rebuts, user responds. Scored on structure under opposition.
- **Hostile Q&A** — user gives a 60s take; AI interrupts with
  skeptical/adversarial questions. Trains composure and pause quality
  under pressure. (Adversarial ≠ abusive: the AI challenges arguments,
  never the person — vision.md constraints apply to our own AI too.)

**Stress mods (shop items):** purchasable difficulty modifiers applied
to any lesson — crowd noise, tighter timer, mid-rep interruption,
"no notes" mode. Harder run = star multiplier. Stress is something the
user OPTS INTO for reward; the app never imposes it.

## Scoring — the Ethos Index (/1000)

The composite: **"Your Ethos: 612/1000."** The score IS the brand — you
train your ethos. Big denominator makes small progress visible (+12
feels real). Eight dimensions in two integrity tiers; weights sum to 1000.

### Tier 1 — measured (deterministic, from timestamps + transcript; no AI judgment)

- **Pause /100 · weight 150** — our signature, weighted at the top.
  v1 sketch: baseline 60; +8 per held pre-sentence pause (0.8–2.5s,
  cap 5); −10 per mid-sentence panic gap >1.5s; small bonus for pause
  before the final sentence (landing the ending). Calibrate in beta.
- **Fillers /100 · weight 150** — fillers/min curve: 0 fpm = 100,
  ≥8 fpm = 0.
- **Pace /100 · weight 100** — distance from the 130–160 WPM zone,
  plus variance bonus (pace that moves beats monotone pace).
- **Range /100 · weight 100** — repetition inverted: distinct-word
  ratio, repeated n-gram phrases, crutch-word density ("really",
  "very", "good", "thing").

### Tier 2 — judged (LLM-scored against defined criteria; MUST cite ≥1 quoted moment or timestamp per score, else the output is rejected and re-run)

- **Structure /100 · weight 150** — clear opening claim, ordered
  points, an ending that lands (not a trail-off).
- **Credibility /100 · weight 150** — "sounds like you know what
  you're talking about": specificity over vagueness, concrete examples,
  commitment to claims. Anchored by a deterministic input: hedge-word
  density ("I guess", "maybe", "sort of", "I feel like") is counted,
  not vibes-judged.
- **Engagement /100 · weight 100** — hook quality, imagery/analogy
  use, sentence variety, direct address. (Absorbs "entertaining" —
  same underlying behaviors; two scores would double-count.)
- **Confidence /100 · weight 100** — hybrid: restarts and
  self-corrections (measured), hedge density (measured), delivery
  steadiness; the LLM only labels tone and must cite the moment.

### Display rules

- Results screen leads with the Index delta ("+18") and the ONE focus —
  never a wall of eight numbers.
- Each dimension is tappable → why this score (cited moments) + one way
  to improve. (The explainability pattern users love in Wellspoken.)
- Free tier: Index + Tier 1 breakdown. Premium: full eight + history
  per dimension.
- Stars stay lesson-level (per-unit thresholds); the Index is the
  across-time number. XP stays effort. Three currencies, three jobs,
  never mixed.


- **Daily streak** advances on any completed rep. Boss modes multiply.
- **Currency** (name TBD — earn via stars, streaks, boss wins)
- **Shop:** streak freezes and cosmetics (Demos poses). Retakes are
  free for everyone (27 Aug — retries left the shop, #170 era call);
  stress mods ship free with XP multipliers rather than as purchases.
- **Hard rule — no pay-to-win:** currency and money can NEVER buy
  stars, streak length, or score improvements. The numbers are the
  product; sell convenience and challenge, never the truth.
- Freezes capped (3 equipped max, #174) — infinite freezes kill the
  loss aversion that makes streaks work.

## Accounts, XP, leaderboard, history (added 9 Aug 2026)

- **Accounts:** Supabase auth (email OTP + Google/Apple). Anonymous-first:
  the user completes rep 1 BEFORE any signup; the account gate appears at
  "save your progress," never before the first rep. (Wellspoken's
  quiz-wall lesson applied to auth.)
- **XP — effort currency.** Earned per completed rep; boss modes and
  stress mods multiply it. XP feeds levels and the leaderboard.
  CRITICAL separation of concerns: XP measures showing up (volume);
  stars measure quality (thresholds). They never mix, and XP can never
  be bought — the no-pay-to-win rule applies.
- **Leaderboard:** SHELVED 27 Aug (#173) until there are users to rank.
  The design when it returns: weekly XP league of ~20 users (Duolingo
  league pattern), resets Monday, display names only. Because it ranks
  XP (effort) not stars (quality), competing hard can't corrupt the
  scores. XP and `xp_events` keep accruing meanwhile.
- **History:** the training log (design-direction layout B, repurposed
  as a secondary screen). Every rep is a row — date, drill, stars,
  fillers, WPM, held pauses — tapping opens full results including the
  pause bar. Free tier: last 7 days. Premium: full history +
  day-1-vs-day-N comparison cards.


Coach register only (brand.md voice). Loss-aversion framing is
allowed ("streak ends in 3h"); guilt and insecurity are not
(no sad mascots, no "you're falling behind everyone").
The 1/day cap is lifted (#179). Two rules survive it and are not
negotiable: quiet hours (default 10pm–7am) bind every send, and a
reminder never fires about a day whose practice is already done (#143).

## Monetization

**Model: freemium. Monthly + annual, annual pushed hard** (Calm/Elevate
playbook: capture the year while motivation is high).

Free tier:
- Daily rep + path progression
- Basic metrics: filler count, WPM
- Streak + freezes (earnable only)

Premium:
- Full pause analytics (the comfortable-silence scores)
- Complete history + day-1-vs-day-N comparison cards
- Personal lexicon: full history of word swaps and base phrases
  (free tier gets the daily swap, not the archive)
- All boss modes (Cold Topic, Debate, Hostile Q&A)
- Unlimited judged analyses (free meters at 1/day, rollover 3)

Pricing — DECIDED 31 Aug (DECISIONS #197), comparables-checked against
Elevate, Yoodli, Duolingo Super and the A$150/hr human coach:
- Monthly: A$14.99
- Annual: A$79.99 (shown as A$6.67/mo, ~55% saving, headline plan)
- The first price test, when real cohorts exist, runs upward
  (vs A$19.99 / A$119.99), never downward. No lifetime, no weekly
  plan, no decoy tier, no time-limited trial (the free tier is the
  permanent trial).
- Paywall moment: after the day-3 progress card, not at install —
  let the first visible improvement sell it. Built 31 Aug (#198):
  the day-3 progress moment, the cap-moment line (day 3 on), and the
  standing /you row. Streak surfaces never carry an offer.

## Retention lifecycle (the honest model)

- **Days 1–14:** fast, visible wins (fillers, pacing). The hook.
  If the day-14 progress card isn't undeniable, nothing else matters
  (vision.md north star).
- **Months 2–9:** the deep skill — structure, pauses, composure.
  The path is designed to span this.
- **Graduation problem:** framed as fitness, not a course — skills
  decay without reps, and difficulty always has a next tier (stress
  mods, harder bosses, infinite Cold Topics). Nobody "finishes" a gym.
- **Business math:** a ~6-month median paying life at these prices is
  a good business when CAC ≈ 0 (founder-documented reps as content).
  We do not need 2-year retention; we need an undeniable first 14 days.

## Competitor intel — Wellspoken (researched Aug 2026)

Scale check: ~76 App Store ratings at 4.7 — an early-stage small team,
NOT an incumbent. The gap is one build cycle, not a moat.

What their users love (and what we do about each):
- **Detailed, non-generic feedback** ("practical, clearly shows thought")
  → our no-horoscope rule already covers this; every claim traces to a
  timestamp or number.
- **Vocabulary supply** — their most-praised feature: word swaps,
  "vocabulary activation," safe base phrases, Personal Lexicon
  → ADOPTED as the supply layer (vision.md daily loop step 5):
  one word/phrase upgrade per rep from the user's own transcript,
  accumulating into a personal lexicon. Premium: full lexicon history.
- **One visible progress number** (their 1000-pt Index)
  → ours is stars + streak + the day-1-vs-day-N card; consider a single
  composite score later, but not before the loop retains.
- **Symptom-first marketing** ("replaying conversations in your head,
  freezing in meetings, losing words mid-sentence")
  → adopt the STRUCTURE (name the felt moment, honestly) for Ethos
  landing/store copy — this is honest pain-naming and stays inside
  vision.md's no-manufactured-insecurity rule.
- **Founders in the trenches** (review replies, Discord)
  → do identically: Timothy replies personally; small Discord/community
  from the first 10 users.

Their known resentment point: a long manipulative onboarding quiz
before the paywall (users explicitly rage-quit over it)
→ our paywall placement (after the day-3 progress card, minimal
onboarding) is confirmed correct; never add a quiz-wall.

What we have that they don't: game layer (path/stars/streaks/shop),
a mascot with warmth, pause-as-a-scored-skill, boss modes, and a
Gen Z register vs their professional-in-meetings framing.

### Hands-on teardown (Timothy, Aug 2026)

Positioning correction: they are more playful and consumer-polished than
their marketing suggests — homepage runs 4 daily tasks (daily 60s, clear
thinking, lexicon flash, Echo check-in) with strong hierarchy, plus
optional modes (drills, roleplay, mock interviews, thought partner,
upload-and-analyze a real meeting). "We're the fun one" is NOT a
sufficient differentiator. Ours is: true progression (path/stars/boss/
economy vs their task checklist), pause-as-skill, persona/register,
and distribution speed.

Mechanisms observed, with implications:
- **Topic roulette wheel before recording** — randomness as ritual;
  variable anticipation makes prompt selection an experience, not a
  dropdown. We differ deliberately (curated path serves thresholds),
  but the lesson stands: the moment before recording deserves design.
- **Notes + structure tips pre-recording** — scaffolding lowers
  activation energy and teaches structure implicitly. Open queue:
  a "frame" step (30s think time, optional notes) — this literally
  trains think-before-you-speak, the founding desire.
- **Score out of 1000** — big denominators feel substantial and make
  small progress visible (+12 points feels real; 4.2→4.3 doesn't).
  Strengthens the case for an eventual composite index (still held
  until loop retains).
- **Per-category drill-down: why this score + how to improve** —
  explainability = trust. Confirms our no-horoscope rule is the
  converting behavior, not just ethics.
- **Genuine strengths named** — honest praise for what measurably went
  well. ADOPTED: coach output schema gains one strength line, metric-
  traced (true praise is measurement, not flattery).
- **Retakes** — low-friction mastery loop; we already have retries.
- **Upload real recordings (meetings)** — real-stakes data is powerful;
  open queue for post-MVP.

Discipline note: admiration is not a roadmap. Their 4-task homepage and
mode buffet is v2+ territory; our engine + single-rep loop ships first.
Product thoughtfulness will be table stakes between two small teams —
the race is decided by distribution and iteration speed.

## Open items

- Currency name (after app name locks)
- Star thresholds per unit (calibrate in beta on real recordings)
- Pricing research pass → replace placeholders
- Freeze/mod prices and earn rates (balance after loop exists)
