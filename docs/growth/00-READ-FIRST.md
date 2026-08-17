# 00 — READ FIRST: Map of the Overnight Growth Run

**For:** Timothy · **Date:** 2026-08-12 · **Written by:** the skeptical final pass, loyal to no document below.

**RUN STATUS.** All seven role sessions completed tonight, sequentially, plus a
rules-compliance sweep: 01 Growth PM ✓, 02 Data Analyst ✓, 03 Behavioral
Designer ✓, 04 Monetization PM ✓, 05 Conversion Copy ✓, 06 CRO Audit ✓,
07 Lifecycle ✓. CLAUDE.md, BUILD-PLAN.md and DECISIONS.md were all present.
This was a documents-only run — nothing in the product was touched.

**This file is a map, not a green light. Nothing in 01–07 is approved by
virtue of existing.** Every recommendation below the fold is unapplied until
you rule on it. Two items outrank everything else in all seven documents:

1. **SMTP is broken** (06 §0.1 fact 2; co-signed 07 §0.2.1). The save-progress
   email-attach call 504s. Until fixed and verified on a real phone, every
   anonymous user is unmeasurable churn-in-waiting and the email channel does
   not exist. Both docs rank this above every growth idea in the run.
2. **The armed reminder can fire after the day's rep is done** (07 §0.2.2 —
   `scheduled` tier ignores `didToday`). A wrong push teaches users to disable
   the channel. Small fix, protects the whole channel.
   **→ FIXED 12 Aug** (DECISIONS #143): `nextFireTime` now arms tomorrow's
   hour when the day's rep is done, at every tier; Settings' "Next:" line
   follows.

---

## 1. Executive summaries (five lines each)

**01 — Growth PM.** Claims the north star should be W2R: % of rep-1 completers
with ≥1 scored rep in local days 8–14 (a rep, not a streak; a window, not a
day) — a refinement of vision.md's Day-14 line, not a challenge. Defines
"activated" as a second scored rep on a different local day within 72h.
Builds a five-branch metric tree (activation, habit, value depth, durability,
cohort supply) and declares it the only permissible dashboard. Refuses to
write a ranked experiment backlog at zero users; sets a data gate (≥100
rep-1 completers, one matured ≥50 cohort, ≥10 watched sessions, full dogfood
table) that unlocks one. Wants built: instrumentation only. Raises two
formal challenges (league density, path runway).

**02 — Data Analyst.** Claims most metrics are already computable from
existing Supabase tables and client events should only capture taps that
leave no row (~14 events total). Verified the schema tonight and found four
gaps: null `ethos_index` is ambiguous (breaks at the #96 flip), tz offset
received but not stored, no engine version on reps, nullable `user_id`.
Wants built: a one-table Supabase-native `events` table (half a day), four
one-column fixes — fix 1 (`scorable`/`judged`) explicitly before the flip.
Ships five weekly SQL metrics and a 12-item anti-self-deception checklist
(fractions not percentages below n=50, no peeking, exclude the founder,
never read trendlines across engine versions). Zero challenges to locks.

**03 — Behavioral Designer.** Claims the Hooked loop is complete except the
investment step: the lexicon — the only uncopyable deposit — never visibly
pays out. Audits every mechanic for loop closure; finds streaks/stars/coins
closed, XP levels decoration, the coin catalogue exhausted in ~6 weeks,
the comparison-card reveal missing. Wants built (for review, not tonight):
the "Callback" loop — deterministic detection of a supplied word appearing
in a later transcript, celebrated with a timestamp ("*Compelling* — 0:42.
That's yours now."), roughly a day of work, gated behind engine/dogfood.
Post-flip: the judged cap as an aimable tool, chess.com style, never a
meter. Raises Challenge A (XP multipliers make the post-flip league
quietly purchasable); endorses 01's two challenges.

**04 — Monetization PM.** Claims the paid tier sells depth on an existing
habit: deep reads, Presence readout, the archive, the boss library — mapped
surface by surface with framing and named mis-designs. Streak surfaces are
never monetized, ever. Wants built at flip (not now): the paywall sheet per
its spec (`Paywall.tsx` is one era stale — divergence table included),
Stripe, dormant events live pre-flip. Recommends price candidate B
(A$14.99 / A$79.99), first test upward never downward, no trial, no decoys,
no lifetime. Sets a seven-item flip checklist (baselines before boolean)
and six flip-day riders needing your ruling. Raises three challenges:
lexicon storage cap (#31), comparison cards fully premium (#17), one free
Presence taste (#73).

**05 — Conversion Copy.** Claims copy can only promise what the product
measurably does — zero outcome statistics until a real cohort produces one;
its entire voice-of-customer table is marked invented. Delivers: three
awareness-staged hero variants + the 5 symptom-first headlines the open
queue asked for, full post-flip cap-moment copy in loss and gain framings
(both written so E1 is real), five pushes (two dormant with the league),
and the pricing page ("Not a trial. This is the gym."). Wants run: a
7-headline five-second test on 5 persona strangers within the launch
window. Diverges from 04 on the CTA ("Start Pro" vs "Start with annual").
Raises Challenge C1: #86 puts the brand line where the clarity line is
needed (hero placement, not line quality).

**06 — CRO Audit.** Claims the funnel's two biggest problems are structural,
not copy: the marketing landing (`/about`) is orphaned — no route links to
it, so strangers meet welcome screen 1, which fails a 5-second test — and
the save-progress tap 504s (SMTP), severing branch D entirely. LIFT-audits
every built screen; logs 14 frictions (founder-shaped rep-1 prompt,
mislabeled mic-deny dead end, buried when-plan chips, iOS reminders that
cannot fire). Wants built: five fixes sized to one founder-week, and three
radical variants (one-screen door, founder-rep-as-landing-artifact, unscored
mic check) as 5-user watch tests. Raises CRO-1 (#133 front door) and CRO-2
(#35 Frame step hidden at rep 1).

**07 — Lifecycle.** Claims the trust budget is the whole job and the honest
channel inventory at launch is tiny: in-app surfaces, ONE pre-armed local
push (Chromium only — iOS Safari cannot receive push at all, so the d=0.65
reminder lever is mostly dead for the persona), and transactional email once
SMTP works. Builds the full message map with hard caps, nine suppression
rules, a never-send list, and channel-level kill criteria; drafts only
D0–D7 copy (first reminder, streak-at-risk, streak-lost consolation) and
refuses to write win-back copy before ≥10 real lapse signals exist. Wants
built: the `didToday` arm fix, an email sending path, `when_plan_cleared`
instrumentation, Spam Act unsubscribe plumbing. Raises L1 (email-reminder
offer where push can't fire) and L2 (one narrow second push on high-stakes
streak days, against the one-per-day cap).

---

## 2. Contradictions — you decide, none resolved here

The seven docs agree suspiciously often — partly because 02–07 adopted 01's
contracts by instruction. Where they actually disagree:

### 2.1 Role vs role

| # | Docs · sections | The disagreement |
|---|---|---|
| 1 | 01 §2.1 vs 02 §0 gap 1 + §2 conventions | **"Scored rep" is defined two ways.** 01: passes the substance floor. 02 operationalizes it as `ethos_index IS NOT NULL` — which post-flip will mostly mean "metered out," silently changing every retention denominator. 02's §1.4 fix 1 is the patch; until you approve it, the NSM's own unit is ambiguous at the flip. |
| 2 | 01 §5 note 1 vs 02 §1.2 | 01's handoff specifies a `rep_completed` client event; 02 cut it (the `reps` row IS the event). 02 amended the contract 01 wrote; 01 never re-signed. Minor, but the "event vocabulary is the contract" claim in five later docs points at 02's version, not 01's. |
| 3 | 01 §1.3 branch B vs 02 §0 | 01 lists p50 loop time as a tree metric; 02 states it cannot be computed from anything that exists (spec-only). One doc's dashboard cell is another doc's vaporware. |
| 4 | 02 §3 mechanics row vs 03 §6(b) | **Primary metric for audio/celebration experiments.** 02: next-day return of exposed users. 03: that cell stays empty for months at pre-gate N — promote sound/haptics opt-out rate to primary. Unresolved; 03 filed it "for their next pass," which never happened. |
| 5 | 01 §2.3 vs 06 §0.1 fact 2 + §8 | **How bad is branch D.** 01: soft-wall decline is a leak — "watch, don't panic." 06: it is not a leak, it is a break — the save tap 504s for everyone, so durability is severed, not leaking. Same branch, opposite urgency. 06 is the one that read the plumbing. |
| 6 | 02 §1.2 vs 06 §8 | 02 marks `signup_completed` BUILT-SURFACE (healthy, just needs a logging call); 06: the underlying tap errors — the event would have measured zeros and looked like copy failure. 06 requests 02's checklist gain "verify the instrumented tap actually completes." Not adopted anywhere yet. |
| 7 | 03 §1 (Action row) vs 06 §8 | 03's Hooked map: "ability is maximised; nothing to fix." 06: true for the daily loop, false at rep 1 — founder-shaped prompt + unsplit fear stack tax ability exactly where it matters most. 06 calls it a friendly amendment; it still inverts 03's grade on the funnel's most important screen. |
| 8 | 04 §4.2.5 vs 05 §3.5.1 + §5.4 | **The one terracotta CTA.** 04: "Start with annual." 05: "Start Pro" — the button should name the decision, not restate the plan selector. Both docs ship their own word; a paywall can only have one. |
| 9 | 04 §4.2.2 vs 05 §3.4 | Boss-library headline: 04 directs "any topic, any time"; 05 overrides with "Good. Want another?" and demotes 04's line to a bullet. 05 claims ownership of words per 04's own handoff — but the substitution is a real framing change (capability vs appetite). |
| 10 | 05 §4.4 vs 07 §0.1 + §7(a) | **The lapsed-3-day push.** 05 wrote it as a sendable message. 07: it can only be pre-armed on Chromium with copy frozen at arm time; for the iOS persona majority it does not exist. 07 re-filed it as M-L0 with delivery limits and moved the lapsed workload to email — a channel 05's doc never covers. |
| 11 | 05 §4 (precedence ladder) vs 07 §2.2 | **Who gets the boss push.** 05's ladder: streak > boss > league > lapsed, applied per-message. 07's arm-time rule: boss body only when streak < 2 — streak holders never receive the boss push at all (the in-app chip does that job). Also a mechanism dispute: 07 says 05's ladder is unenforceable as written because bodies are composed at different times. |
| 12 | 05 §8 (C1) vs 06 §8 (CRO-1) | **What is wrong with the hero.** 05: the wrong locked headline (#86) holds the hero slot — swap placements. 06: neither locked headline renders anywhere a stranger lands; the marketing page is orphaned and the problem is routing, not placement. 06 explicitly calls C1 the shallow version of its own challenge. Ruling on CRO-1 largely moots C1; ruling on C1 alone leaves 06's structural finding standing. |
| 13 | 03 §3.3 vs 04 §8 | The bought streak freeze: 03 expects it to be a middle-band coin sink; 04 says it is a *signal*, not a sink (schedule-outruns-streak users are the annual prospects). Mild, but it changes whether the shop needs more sinks or better telemetry. |

### 2.2 Role docs vs source docs — collisions needing a ruling (04 §3's riders, restated)

Not challenges — ambiguities the #96 flip exposes. All are yours:

- **Stress mods:** mechanics.md premium list ("unlocked for purchase") vs
  03 §3.3 + 04 rider 3 (coin-economy consumable; both roles want coins).
- **Retries:** on mechanics.md's Premium list AND its Shop list. Same
  ruling needed; 04 recommends coins.
- **"Full pause analytics":** #31 (premium) vs #75 (all measured metrics
  free — Pause is measured). 04 rider 2 reads later-amends-earlier: Pro
  sells per-dimension history, not the pause score. Confirm or correct.
- **Grandfathering (the Strava clause):** free-era users have seen their
  full archive; 04 rider 1 says hiding it at flip is the worst pattern
  available. No lock covers it either way.
- **`surface: day3_card` + `offer` enum:** 04 §8's two additions to 02's
  event schema — requested, never confirmed by 02 (its session had ended).

### 2.3 Formal challenges to DECISIONS.md locks — consolidated

Every challenge raised tonight, one table. None applied. "Endorsed by"
means another role co-signed with additional evidence.

| Doc | Decision(s) | Challenge (one line) | Proposed settling test |
|---|---|---|---|
| 01 C1 (endorsed 03 B, one of the two 02 endorses) | #16 + mechanics.md leagues | A ~20-slot league at single-digit WAU is a dead room broadcasting "this product is dead" — same logic that killed clan wars (#89) | Gate league *visibility* behind ≥15 rep-active weekly pool; personal XP target below threshold; compare league-exposed vs pre-league cohorts' W2R when it first trips |
| 01 C2 (endorsed 03 C) | #141 + mechanics.md "Retention lifecycle" | 29 lessons ÷ 1/day ≈ 4 weeks; the stated months-2–9 retention story has no content spine, and goal-gradient (03) predicts a motivational cliff for the best cohort simultaneously | Instrument `path_exhausted` + distance-to-end; measure week-5/6 return of exhausted vs not; content trigger fires when first 5 real users are ≤7 lessons out; 03 adds: seat the endless progression (Index trendline/PBs) beside the road before anyone finishes |
| 03 A (endorsed 04 rider 6) | #16, #36, #37 | Post-flip, Pro surfaces (boss library, mods) multiply XP — league rank becomes quietly purchasable; the 16–28 F2P-raised persona will name it | Rank leagues on base XP (`xp_events.base_amount`, one column now, free era, zero UX change); or post-flip check premium vs free placement at equal rep counts |
| 04 M1 | #31 | The 3-entry free lexicon cap kills the product's best investment loop in week one for exactly the population that is the funnel; storage costs nothing | Accrue all entries for everyone, free tier *views* latest 3 + true counts, Pro opens the archive; post-flip cohort-compare supply adoption + W2R, cap-storage vs cap-view |
| 04 M2 | #17, #31 | Comparison cards fully premium starve the CAC≈0 engine — the free ~95% generate zero spread on the one artifact built to spread | Free milestone cards (day 7/30/100, auto-offered, shareable); Pro keeps any-day-vs-any-day; measure `share_card_created` and link-tagged branch-E arrivals |
| 04 M3 | #73 | Presence is the only Pro good sold entirely on description — paywall-after-value is the product's own doctrine and no Presence value is ever felt | E5: one free first-video-rep readout per user; kill if taste satisfies instead of selling |
| 05 C1 | #86 | The hero gets the brand line when zero-awareness traffic needs the clarity line; #86's own rationale argues for the swap | 7-line five-second test on 5 persona strangers now; post-gate sequential cohorts on landing→rep-1-start |
| 06 CRO-1 | #133 (+ #86) | The fresh-browser redirect makes an app-onboarding screen do the marketing page's job; `/about` and both locked headlines render to no one (grep-verified: zero inbound links) | Narrowing amendment: fresh root visits get the acquisition hero → "Take the floor" → /welcome; settle with the 5-second test, then hero-swapped sequential cohorts |
| 06 CRO-2 | #35 | Frame step OFF-by-default optimizes the steady state and silently applies it to rep 1, where performance fear peaks and Settings is undiscovered | Rep-1-only inline offer ("30 seconds to think first?" / "Just record"); 06's V3 watch sessions answer it for free |
| 07 L1 | #136 (collides with #134's ask cadence) | The when-plan reminder cannot fire on the persona's default device (iOS Safari: unsupported); offer "remind me by email" only when the tier can't fire — a functional ask, arguably a third email ask in spirit, hence a challenge | Ship behind the tier check; watch 5 iOS first-sessions for when-plan tap depression; then email-reminder vs no-reminder iOS cohorts. Moot until SMTP + a sending path exist |
| 07 L2 | mechanics.md "one notification per day max" | A morning-slot user gets zero at-risk coverage; narrowest version: streak ≥7, reminder produced no rep, one extra push 21:00–21:30, only when no freeze can bridge | Post-data only (≥50 users with streak ≥7): sequential cohorts, escalation on/off, streak-7 survival vs disables + `when_plan_cleared`; default absent your ruling is the cap as written |

02 raised zero challenges (reviewed all 142 entries; endorses 01's two).

---

## 3. The 10 weakest assumptions in the run, with the cheapest test for each

Ordered by how much of the run leans on them.

1. **Welcome screen 1 tells a stranger what the product is.** The de facto
   hero for all cold traffic; 06 predicts it fails its own answer key.
   *Test:* 06 §5's five-second test, 5 strangers, one evening.
2. **Anyone can be reached after leaving.** Branch D, the entire email
   channel, and all of 07 assume the save tap works. It 504s.
   *Test:* fix SMTP, then save on a real phone twice on different days
   (06 fix 1's own bar). ~1 hour including the dashboard change.
3. **The when-plan reminder — the run's single largest cited effect
   (d=0.65) — can fire for the persona.** 06/07 say it mostly can't (iOS).
   *Test:* open speakethos.com on one iPhone, tap a chip, wait a day.
   10 minutes plus patience.
4. **Which rep-1 fear actually kills sessions.** 01 bets on voice-cringe,
   06 bets on "I'll do this later" tab-close, 06's P2 bets on the
   perform-now stall. Three docs, three different top leaks, zero
   observations. *Test:* 5 watched first sessions (consented screen
   recordings); note where each person stalls. One evening — and it
   discharges part of 01's data-gate item 3.
5. **A 17-year-old can answer "introduce yourself and what you're
   building."** Half the locked persona builds nothing. *Test:* ask 5
   people aged 16–20 to answer the prompt aloud, count the stalls.
   Under an hour.
6. **Anyone sees the mic primer.** The claimed 2–3× grant-rate mechanism
   lives in the smallest, faintest text on the screen. *Test:* in the
   same 5 watched sessions, ask afterward "what did you expect the mic
   permission to do?" Free, piggybacks on #4.
7. **The 72h activation window predicts W2R.** Borrowed from Duolingo,
   never checked against an Ethos human. *Test:* none cheap — 01 §2.4's
   activated-vs-not split at ≥50 rep-1 completers is the real test; until
   then treat every "activation rate" number as provisional by definition.
8. **Supplied words ever come back out.** The Callback (03's flagship
   spec) assumes upgraded words reappear in later speech. *Test:* grep
   your own dogfood transcripts for your own lexicon entries. 30 minutes,
   zero build, and it prices a day of proposed work.
9. **Candidate-B pricing is inside the persona's willingness to pay.**
   A$79.99/yr is comparables arithmetic, not a human answer. *Test:* show
   5 persona people the pricing page mock and ask what they expected it to
   cost *before* revealing the price. One hour. (Weak method, but it beats
   zero humans, which is the current sample.)
10. **The intake assumptions the whole run is sized against.** ~15
    founder-hours/week and a 4–6-week soft launch are marked "intake
    unfilled" in all seven docs — and the launch window quietly collides
    with 01's own data gate (≥100 rep-1 completers with acquisition
    deliberately off). *Test:* fill in the intake and do the arithmetic on
    your actually-reachable audience. 15 minutes; re-scopes every
    "founder-week" estimate in the run.

---

## 4. Reading order for tomorrow morning

**First (before coffee is finished):**
1. 06 §0.1 + 07 §0.2 — the SMTP break and the `didToday` arm bug. The only
   two items in 3,600 lines that are urgent regardless of any decision.
2. §2 of this file — the contradictions and the challenge table. Everything
   you don't rule on stays unresolved; nothing self-executes.

**Read in full (decision-dense, code-verified, or binding):**
3. 06 (entire) — the only doc that audits what is actually shipped; its §6
   five fixes are one founder-week and mostly ruling-free.
4. 01 §§1–2 — the metric and activation contracts every other doc adopted.
   If you disagree here, six documents shift.
5. 02 §1.4 + §4 — four one-column fixes (fix 1 is pre-flip-or-never) and
   the anti-self-deception checklist, which is the run's best artifact.

**Skim (structure now, detail when relevant):**
6. 03 §2 audit table + §4 Callback (a build proposal — judge it against
   assumption #8 above before scheduling it).
7. 04 §§1–3 + §7 — the surface map, the never-do rules, the flip checklist.
   File §5–6 mentally as "exists, dated."
8. 07 §§0–2 — channel truth, caps, suppression rules. The message map (§§4–6)
   is reference material.
9. 05 §2 — hero variants + the 5 headlines (they close an open-queue item);
   the rest is post-flip copy in a drawer.

**Safely ignorable until real data exists (all self-labelled as such):**
- Every WAITING ON DATA section: 01 §2.4/§4, 02's validation splits,
  03 §3.2's post-flip metering, 04 §§5.2–6 (pricing tests E1–E5),
  05 §§3–4's dormant copy, 07 §§5.3–5.4 + §9 (lapsed, post-paywall-hit).
- Everything league-shaped, in every doc, until Challenge 01-C1 is ruled.
- All benchmark numbers. They are other products' facts.

---

## 5. What this run could not know

Seven documents, ~3,600 lines, zero users — and that ratio is the honest
headline. Nothing in this run has ever been touched by a stranger: every
funnel prediction is a code walk, every persona reaction is invented and
labelled so, every benchmark is some other product's number, and the
much-cited activation definition is Duolingo's instinct wearing Ethos event
names. The apparent consensus across the seven roles is partly
manufactured — 02 through 07 were instructed to adopt 01's contracts, so
agreement is sequence, not independent confirmation; the places they broke
ranks anyway (§2) are the most informative lines of the night. What only
launching will answer: whether the return curve flattens above zero at all
(the PMF question — 02 M4 — beside which every other question is
decoration); which of the three competing rep-1 leak theories is true;
whether pause-as-a-skill actually differentiates or merely audits well;
whether anyone pays A$79.99 for depth on a habit; whether the persona shows
up when the founder stops being the sample. The run's real output is not
strategy — it is instrumentation specs, kill criteria, and a discipline for
not lying to yourself, which is worth exactly as much as the first fifty
real users you point it at. Fix the SMTP, watch five strangers, and most of
these documents will start earning or losing their claims within a week.

*End of read-first. Nothing below docs/growth/ was modified tonight.*
