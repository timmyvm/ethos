# 07 — Lifecycle / CRM: Message Map, Streak-Save Protocol, Channel Doctrine

**Role:** Lifecycle marketing lead (push + email) · **Date:** 2026-08-12
**Mandate:** Every message spends trust from a finite budget — build the full lifecycle
structure now, draft only what launch week (D0–D7) needs, and refuse to write copy that
depends on behavior nobody has observed yet.

---

## 0. Operating stance

- **The trust budget is the whole job.** Over-sending doesn't get ignored — it trains
  users to disable notifications, which kills streak-saves, which kills retention. A
  disabled notification channel is unrecoverable at our scale: there is no "re-engage
  the disabled" play that works. Duolingo's edge is not volume; it is timing (the
  user's own habitual practice hour) and escalating only when a streak is genuinely at
  risk. Ethos already encodes half of this in product law: one notification per day
  max, quiet hours 10pm–7am (mechanics.md), loss-aversion allowed, guilt banned (#26),
  and — the head start most products never get — **#136 already stores a
  user-chosen reminder hour and arms the OS reminder at the when-plan tap.** The
  habitual-time story starts from that tap, not from scratch.
- **The standing test, applied to every row below:** would the user thank us for this
  message at least sometimes? A message that only serves us is cut before it is
  drafted. (This is 03's endorsement test applied to the outbox.)
- Stage facts: pre-launch, near-zero traffic, zero usage data. Everything is free
  behind one constant (#96) — every post-paywall-hit message here is design-for-the-
  flip, dormant by definition (the segment does not exist). Every voice-of-customer
  line is **UNVALIDATED HYPOTHESIS**.
- Contracts adopted: 01's metric tree and activation definition (rep 2, different
  local day, ≤72h), 02's event vocabulary verbatim (`when_plan_set`,
  `notification_permission_granted/denied`, `reminder_clicked`, `soft_wall_*`,
  `signup_completed`, dormant `paywall_hit`) and their measure-clicks-not-sends
  honesty rule, 03's freeze-rescue and boss-countdown suggestions, 04's
  never-monetize-streak-surfaces rule (becomes a suppression rule here), 05's push
  drafts (adopted/critiqued in §7), 06's SMTP finding (escalated in §0.2).
- **ASSUMPTION (intake unfilled): ~15 focused founder-hours/week.**
  **ASSUMPTION (intake unfilled): soft launch / public beta within ~4–6 weeks.**
- Market: AU-first. One legal note lifecycle owns: the **AU Spam Act 2003** requires
  consent, sender identification, and a functional unsubscribe on commercial
  electronic messages. Transactional auth mail is fine as shipped; every lifecycle
  email in this map ships with a working one-tap unsubscribe and the hello@ reply
  footer (#83) from the first send. Non-negotiable, and also just good practice.
- Where I disagree with a locked decision, §8 raises it formally. Nothing locked is
  silently contradicted.

### 0.1 Channel ground truth — what can actually reach a user (verified in code)

Honesty about delivery comes before any copy. Per #42 and `lib/reminders.ts` (read
tonight), "push" at Ethos today means **locally-armed notifications, not server
push**. The app arms tomorrow's reminder while it is open, with copy composed at
arm time (`reminderBody(ctx)` knows the streak); it cannot compose or send anything
to a closed tab from the server. Three tiers, as the code itself names them:

| Tier | Who gets it | Fires with the tab closed? | Lifecycle consequence |
|---|---|---|---|
| `scheduled` (Notification Triggers) | Chromium desktop/Android | **Yes** — OS fires it | The only real push we have. Copy is frozen at arm time |
| `open-tab` | Other desktop browsers; installed-PWA iOS without triggers | Only while a tab is alive — "almost never on mobile" (the code's own words) | Effectively desktop-only |
| `unsupported` | iOS Safari in-browser | No Notification API at all | The when-plan tap stores an hour and honestly reports it can't fire (#42) |

Consequences this document is built on:

1. **The persona's default device (AU 16–28, iPhone) mostly cannot receive our
   push.** 06 row 12 flagged this as "the d=0.65 lever is dead on iOS"; adopted.
   The honest cross-platform channel for a closed tab is **email** — which
   `docs/email.md` already says, in its "Not built yet" section, and which needs a
   sending path of its own (Supabase Auth mail won't carry lifecycle sends).
2. **There is no lapsed-user push in real time.** A "you've been gone 3 days"
   message can only exist as an arm-and-cancel trigger set during the *last*
   session (armed ahead, cancelled on return) — Chromium only, copy frozen at
   arm time. Everything else lapsed is email or nothing.
3. **Trigger-based > scheduled still holds** — but at launch the triggers that can
   actually fire a message are: app-open (in-app surfaces), rep-completed (in-app),
   the pre-armed daily hour (push), and email-capture events (email). The message
   map marks delivery honestly per row.

### 0.2 Two blockers above every message in this file (founder, check first)

1. **SMTP is broken (06 §0.1 fact 2, Crit).** The email-attach call 504s; until the
   dashboard fix is verified on a real phone, the email channel — the only channel
   that reaches a closed iPhone tab — does not exist, and neither does branch D.
   Every email row below is downstream of this. 06 ranked it the #1 item across all
   six documents; from the lifecycle chair I co-sign: **this is the only lifecycle
   work that matters this week.**
2. **The armed reminder can fire after the day's rep is already done.** In
   `armReminder`, only the `open-tab` timer checks `ctx.didToday`; the `scheduled`
   tier arms the next occurrence of the hour regardless. A user who reps at 9am
   with an 8pm reminder hour gets "12 days. One rep keeps it." at 8pm — a push
   that is *wrong*, hours after they already did the thing. A wrong push is the
   fastest possible way to teach someone to disable the channel. Fix: when
   `didToday`, arm for tomorrow's occurrence, not the next one. Small, and it
   protects the entire channel. (For founder review; documents-only run.)
   **→ FIXED 12 Aug** (DECISIONS #143), exactly as specced above.

---

## 1. Channel strategy — what belongs where, and what we never send

### 1.1 The doctrine, one line per channel

| Channel | Its one job | Trust cost per message | What belongs here |
|---|---|---|---|
| **In-app** | React to what just happened | ~Zero — the user came to us | Almost everything: celebrations (#34), freeze-rescue notice, streak-lost consolation, at-risk states, milestone cards, comparison-card reveals, cap cards (post-flip), boss countdown chip |
| **Push (local, pre-armed)** | Echo the user's own plan at the hour they chose | High — interrupts their day, spends permission capital | Exactly one message: the daily reminder at the #136 hour. Its *body* varies by state (default / at-risk / boss). Nothing else, ever |
| **Email** | Reach a closed tab; carry durability and long gaps | Medium — inbox space, unsubscribe risk | Transactional (shipped, blocked per §0.2), reminder-fallback (proposed, §8 L1), lapsed 7/14/30 win-back, post-paywall-hit (post-flip), founding-member at flip (04 E4) |
| **Never built** | — | — | SMS, retargeting pixels, third-party ad audiences — the privacy posture (#70–74, and 06's "no email, no pixel — by design") is a selling point; lifecycle does not quietly undercut it |

The asymmetry is deliberate: **in-app is the default channel for every message in
this map.** Push and email must argue their way out of the app, and the only
arguments that count are "the user is not in the app and their plan/streak/data is
at stake."

### 1.2 The never-send list (cut before drafting; each only serves us)

- **"We miss you" / sad Demos / guilt calendars** ("it's been 5 days…") — banned by
  #26 and brand.md; a miss is never mentioned, per #51's forward-only law.
- **A push announcing a streak loss.** The loss is never news we deliver to a lock
  screen. Post-loss, the push channel goes silent on streak topics for 48h; the
  consolation lives in-app at next open (§5.4). Post-loss guilt causes uninstalls.
- **Any money message on any streak surface or streak-risk day** — 04 §1.3, adopted
  as suppression rule S6. The push channel never sells, period: a paywall in a
  notification is the one placement 04's map never sanctioned, and it stays that way.
- **"Buy a freeze before midnight."** Freezes auto-spend when they can close the
  whole gap (#38/#39); there is no purchase decision to prompt, and prompting coin
  purchases at the anxiety moment is the Duolingo streak-repair pattern wearing our
  currency. The shop stays a place you visit calmly.
- **Social-proof blasts** ("1,000 people repped today") — false at our N, and fake
  at every N (05 §5.5).
- **Product-update newsletters / digests** pre-launch. Nobody asked; the list is
  nine friends (illustrative assumption — no real lifecycle list exists yet).
- **Re-permission nags.** One primed ask at the when-plan tap (#136). A denial is an
  answer; we re-ask only when the user walks into settings themselves.
- **League messages** — dormant until 01's Challenge 1 (density gate) is ruled and a
  league renders for anyone. 05's drafts stay in the drawer.
- **Anything between 10pm and 7am local** (mechanics.md), email included: lifecycle
  emails send 8am–8pm local (Melbourne approximation until `reps.tz_offset_min`
  ships — 02 §1.4 fix 2).

### 1.3 Anonymous-first: when each channel comes online, per user

The map must respect that channels *unlock in sequence* — most users have no
reachable channel at all until they act:

| Moment | Channel state |
|---|---|
| Arrival → rep 1 | **Nothing.** No email, no permission, no push. All D0 messaging is in-app, by construction |
| When-plan tap (#136, final results screen) | Push unlocks — *if* granted, *if* tier ≠ unsupported. On iOS Safari: the hour is stored, nothing can fire (§0.1) |
| Soft-wall save (#134 → #142 confirm) | Email unlocks. This is the **only** email-capture moment in the product (rep-1 exit, once more at streak 3, never again) |
| Neither | The #137 standing line is the entire re-engagement surface. A cleared browser = a user we can never message, count, or win back |

**The lifecycle case for the email ask, stated for the record:** email is not an
account formality here — it is the only channel that survives a closed tab on the
persona's default device. Every day an activated user stays anonymous, our
streak-save protocol runs at partial strength (in-app + maybe-push) and our lapsed
protocol runs at zero. That is the strongest argument in this file for the soft
wall's placement at the moment of maximum staked value (#134 has it right) — and
for §8 Challenge L1, which proposes the one additional, *functional* ask: "remind
me by email" at the when-plan tap when the browser can't fire notifications.

---

## 2. Global frequency caps + suppression rules (structural — applies at launch)

### 2.1 Hard caps

| Channel | Cap | Source |
|---|---|---|
| Push | **≤1/day**, quiet hours 10pm–7am | mechanics.md, locked (challenged narrowly in §8 L2; the cap holds unless Timothy rules) |
| Push | Zero on any local day with a completed rep | §0.2 item 2 (needs the arm fix); a reminder after the rep is a wrong push |
| Email (lifecycle) | ≤1/week per user; ≤1 per lapse stage; ≤2/month total while lapsed | This doc |
| Email (transactional) | User-caused only (confirm, reset, receipt) — uncapped, they asked | docs/email.md |
| In-app system lines | ≤1 coach-register system line on home beyond the standing #137 line | Precedence: freeze-rescue > streak-lost consolation > fresh-start (#51) > milestone |
| All channels | Launch week = transactional email + the armed reminder + in-app. **No other sends exist yet.** | Honest inventory, §0.1 |

### 2.2 The single push slot — body priority at arm time

The daily slot always belongs to the #136 reminder; only its **body** changes.
Priority, decided at arm time from known context (copy is frozen when armed, §0.1):

1. **Streak-at-risk** (streak ≥ 2): the streak copy (§4 M-H2).
2. **Boss-drop Monday** (boss gate reached, streak < 2): 05 §4.5's copy, adopted.
   Streak users don't need the boss push — they'll be in the app today anyway, where
   the countdown chip (03 §2, endorsed) does this job without spending the slot.
3. **Default** (streak 0–1): the day-two / take-the-floor copy (§4 M-H1).

League bodies enter this ladder only if leagues ever render (dormant).

### 2.3 Suppression rules (each one prevents a named collision)

| # | Rule | Why |
|---|---|---|
| S1 | Never a streak message and a league message on the same local day, any channel | The brief's own example; two pressures stack into nagging |
| S2 | Rep completed today → total push silence until tomorrow | The channel's credibility rests on never being wrong |
| S3 | Streak lost → 48h of push/email silence on streak topics; consolation is in-app, once, at next open | Post-loss guilt is the uninstall moment; #52's end-on-true-and-good applies to the *relationship*, not just the screen |
| S4 | Any rep row halts every lapsed/win-back sequence instantly | A returned user gets a celebration, not email 2 of 3 |
| S5 | No lifecycle email on a local day the user clicked a push (`reminder_clicked`) | Two interruptions for one behavior is double-billing the trust budget |
| S6 | No money surface (post-flip) in any push, any streak-risk state, or within 24h of a streak loss | 04 §1.3, extended to channels |
| S7 | Soft wall shown this session → no other email ask this session | One ask per session; #134's restraint, generalized |
| S8 | Permission denied → no re-ask from us, ever; settings-initiated only | A denial respected is trust banked |
| S9 | Quiet hours bind every channel, including email scheduling | mechanics.md, extended |

### 2.4 Global kill criteria (the channel-level dead-man switches)

Structural now, thresholds **WAITING ON DATA** (set after the first 50 granted
users exist): any message class whose *disables* (notification permission revoked,
reminder hour cleared, email unsubscribed) exceed its *conversions* (same-local-day
rep after click/open) over two consecutive weekly readings is retired — written
into the growth log as a loss per 01 §4.1's house rule. Instrumentation this needs
from 02 (addendum, their naming rules respected): `when_plan_cleared` — the
reminder hour being removed in settings is currently invisible (localStorage
prefs), and it is the kill-metric for the entire push channel.

---

## 3. The message map — format key

Every row: **trigger | audience | channel | goal | copy | metric | cap | kill.**
Copy column: a Demos-voice draft for D0–D7 and the streak-save protocol (needed at
launch), or **WAITING ON DATA** with the exact observed behavior that unlocks it.
Status: **[SHIPPED]** = exists in product (adopted, not rewritten), **[DRAFT]** =
copy written here, **[WAITING]** = framework only, **[DORMANT]** = post-flip or
pending a ruling.

---

## 4. Stage 1 — D0 activation & D1–D14 habit formation (launch-week set, drafted)

Tree branch A/B (01). The D0 rows are shipped surfaces — listed so the map is
complete and so nobody re-drafts locked copy.

| ID | Trigger | Audience | Channel | Goal | Copy | Metric | Cap | Kill |
|---|---|---|---|---|---|---|---|---|
| M-D0-1 | Rep-1 final results screen, no reminder hour set | All rep-1 completers | In-app | The when-plan tap (d=0.65) | **[SHIPPED]** #136's one-tap chips. 06 fix 5 (move chips above Tomorrow/Retake) endorsed | `when_plan_set` rate per walk completion | Once, until an hour is set | n/a — product surface |
| M-D0-2 | Rep-1 exit, anonymous | Anonymous rep-1 completers | In-app | Email capture at peak staked value | **[SHIPPED]** #134 soft wall; quiet "Not now" | `soft_wall_viewed→saved` | Twice ever (rep 1, streak 3) — locked | Locked (#134) |
| M-D0-3 | "Save my progress" tapped | Savers | Email | Confirm the address | **[SHIPPED]** `confirm-signup.html` — **BLOCKED by §0.2.1** | `signup_completed{path:anonymous_upgrade}` | Transactional | n/a |
| M-D0-4 | Anonymous, ≥1 rep, home render | Decliners | In-app | Standing honest risk line | **[SHIPPED]** #137 "N recordings live only in this browser · keep them" | Late saves | Standing, quiet | Locked (#137) |
| M-H1 | Armed reminder fires, streak 0–1, at the chosen hour | When-plan users, D1+ | Push (local) | Rep 2 on a different local day ≤72h — **the activation event itself** (01 §2.1) | **[DRAFT]** §6.1 (polished, A/B) | `reminder_clicked` → same-local-day rep row | 1/day slot; S2 | Two weekly readings where clicks → reps < disables (§2.4) |
| M-H2 | Armed reminder fires, streak ≥2 | Streak holders | Push (local) | Keep the streak with one true number | **[DRAFT]** §6.2 (polished, A/B) | Same as M-H1, plus streak survival that day | 1/day slot; S2, S3 | Same as M-H1 |
| M-H3 | Streak reaches 3, still anonymous | Anonymous streakers | In-app | Second (final) email ask | **[SHIPPED]** #134's second showing | `soft_wall{trigger:streak3}` save rate | Once ever | Locked |
| M-H4 | App open, a freeze auto-spent since last open (#38/#39) | Freeze-rescued users | In-app | Make the safety net *felt*; reinforce keeping freezes | **[DRAFT]** "A freeze covered Tuesday. Streak intact at 12 — 1 freeze left." (03's suggestion, given words. Numbers real, tone flat, no ceremony — a frozen day is protection, not achievement, so no amber, no chime, per #65/#138) | Freeze-rescued users' next-7-day rep rate | Once per rescue | If watched sessions read it as scolding ("you needed saving") — reword to pure fact or cut |
| M-H5 | App open, streak lost since last open (no freeze could bridge, #39) | Streak losers | In-app | Console; re-anchor on the number that didn't reset (#93); point forward only (#51) | **[DRAFT]** §6.3 (polished, A/B) | Same-day rep after seeing it; uninstall/absence rate after loss | Once per loss; S3 silences push/email 48h | If post-loss return is *worse* than a no-message control cohort (WAITING ON DATA) — then even consolation is salt; show only the day counter |
| M-H6 | Day 7 of days-spoken (#93 counter = 7) | Week-one completers | In-app | First unprompted day-1-vs-day-7 comparison reveal — the vision.md core asset, surfaced (03 §2's missing reveal; inside the free 7-day window, so no #17/#31 conflict) | **[DRAFT]** Card header: "Seven days on the board." One line under the two numbers: "Day 1: 540. Day 7: 588. Same mouth, more reps." | `comparison_card_viewed{days_spanned:7}`; `share_card_created` | Once, at the milestone | If nobody taps or shares across the first 50 week-one users, the reveal moves to day 14 (WAITING ON DATA) |

Notes on the drafted set: every line survives the read-aloud test and the banned-word
check (no "confidence", no hype adjectives); every number shown is the user's own or
the product's (60 seconds, a streak count, a date). The freeze-rescue line (M-H4)
deliberately does *not* say "it didn't train you" — that's #38's internal rationale,
and rationale is not copy.

---

## 5. Stage 2 — active, at-risk (the streak-save protocol), lapsed, post-paywall-hit

### 5.1 Active (habit held, weeks 2+)

| ID | Trigger | Audience | Channel | Goal | Copy | Metric | Cap | Kill |
|---|---|---|---|---|---|---|---|---|
| M-A1 | Monday, boss gate reached (#28: 12 stars), streak < 2 at arm time | Boss-eligible, non-streaking | Push (body slot, §2.2 rule 2) | The weekly appointment (03 §2) | **[DRAFT — adopted from 05 §4.5 verbatim]** "This week's Cold Topic just dropped. 3 minutes to study something you've never met. 90 seconds to explain it." Deliverability: `scheduled` tier only; armed the prior session | Boss rep rows on Mondays | Weekly; loses the slot to M-H2 | Same §2.4 rule |
| M-A2 | Home render, boss cleared this week | Boss finishers | In-app | Anticipation for next reset | **[DRAFT]** Chip: "Next topic Monday." (03's countdown chip; four words is the whole message) | Boss repeat rate week over week | Standing chip | n/a — passive |
| M-A3 | Day counter hits 30 / 50 / 100 | Long-run users | In-app only — **never push** | Milestone celebration (#140's fanfare ladder points here, per 03) | **[DRAFT]** "Day 30. Thirty days you spoke." (The number is the copy) | Continued days-spoken slope | Once per milestone | n/a |
| M-A4 | ≥7 days spoken with ≥5 reps; modal rep hour ≠ chosen reminder hour by ≥2h | Habitual users | In-app (settings-adjacent card, once) | **Habitual-time send optimization** — offer, never silently move: the reminder is *their* plan (#136's mechanism breaks if we edit it for them) | **WAITING ON DATA.** Unlock: ≥7 days of rep timestamps per user **and** `reps.tz_offset_min` shipped (02 §1.4 fix 2 — without it we cannot compute a local modal hour). Copy shape reserved: "You usually rep about 7:40am. Move the reminder there?" | Offer-accepted rate; reminder→rep conversion before/after | Once per detected drift | If acceptance <20% of shown, stop offering — the chosen hour is the plan |
| M-A5 | League promotion/demotion | League members | Push (body slot) | — | **[DORMANT]** — 05 §4.2/4.3 copy in the drawer; no league renders (01 Challenge 1 pending, 02 cut the events) | — | — | Dormant |

### 5.2 The streak-save protocol (structural, drafted — needed at launch)

The brief's protocol is: remind at habitual time → escalate once near expiry →
offer streak freeze → console after loss. Two of those four steps collide with
locked law, and the honest protocol is what survives the collision:

**Step 1 — Remind at the habitual time.** The armed reminder at the #136 hour, body
by §2.2 priority. At streak ≥2 the body is M-H2's at-risk copy. This is the whole
push-side protocol under the current cap.

**Step 2 — Escalate near expiry: structurally impossible as briefed, and I say so
rather than pretend.** (a) mechanics.md caps notifications at one/day — the
habitual-hour send *is* the day's send; (b) quiet hours start at 10pm and streaks
expire at local midnight (#77), so the "final hours" window is inside quiet hours
anyway; (c) on `scheduled` tier the copy is frozen at arm time — we cannot compose
an 11pm "3 hours left" push at 11pm. **Therefore: escalation is in-app.** The home
screen's at-risk state (#26) and the floor card carry the urgency for anyone who
opens the app; the push never doubles. §8 Challenge L2 proposes the one narrow
exception (streak ≥7, second send at 9pm, hard conditions) for Timothy's ruling;
until ruled, one send stands.

**Step 3 — The freeze is not offered; it works.** Freezes auto-spend when they can
bridge the whole gap (#38/#39). There is no decision to prompt, so there is no
message at risk time — the message is M-H4's *next-morning rescue notice*, which
turns the silent save into felt value. No purchase prompt, ever (§1.2).

**Step 4 — After the loss, console — in-app, once, then forward.** M-H5 (§6.3).
S3 silences push and email on streak topics for 48h. The next armed reminder body
drops streak language entirely and re-arms on the day counter: it says what is
still true, not what broke.

### 5.3 Lapsed (7/14/30) — framework only; the win-back that refuses to guess

Definitions: *lapsed-N* = no rep row for N consecutive local days, measured from
last rep (02's local-day rule). All rows require email capture — an anonymous
lapsed user is unreachable by design (§1.3), which is the durability branch's whole
argument. **All copy and exact timing WAITING ON DATA.**

| ID | Trigger | Audience | Channel | Goal | Copy | Metric | Cap | Kill |
|---|---|---|---|---|---|---|---|---|
| M-L0 | Last session ends; arm-and-cancel trigger at +3 days, cancelled by any return | `scheduled`-tier users only | Push (pre-armed) | Early re-engagement before the habit cools | **[DRAFT — adopted from 05 §4.4, held in the drawer]** "Day 13 is one rep away. The day counter only counts up." Copy is armable (numbers known at arm time); **the 3-day timing is a guess → WAITING ON DATA:** set it at the elbow of 02's M4 return curve once ≥50 users / 4 weeks exist | Return rep within 24h of fire | One per lapse; S4 | Disables after fire > returns, two readings |
| M-L1 | Lapsed-7 | Email-captured, lapsed | Email | First win-back: forward frame, their own immovable numbers (day counter, best Index, lexicon size) | **WAITING ON DATA.** Unlock: ≥10 real lapse signals — hello@ replies (#83), observed sessions, or churned-user conversations — so the email answers the *actual* reason people stop, not my guess. Principles locked now: never mentions the gap (#51), cites only their numbers, one CTA (one rep), unsubscribe visible | Open → rep within 72h | One email, once per lapse | Unsubscribe rate of the send > its return rate |
| M-L2 | Lapsed-14 | Same, still gone | Email | Second angle (different content, not a louder repeat — likely the day-7 comparison card as attachment/image if M-H6 proves shareable) | **WAITING ON DATA** — same unlock as M-L1, plus M-H6's card-engagement data | Same | One email | Same |
| M-L3 | Lapsed-30 | Same, still gone | Email | Last word: honest, warm, final. States we stop emailing; door stays open | **WAITING ON DATA** for copy. Structure locked: this is the LAST send — after it, silence forever unless they return (S4). **No offer attached** — 04 §5.4.3 sanctions a win-back offer only at ≥60 days lapsed and only post-flip; if that day comes, the offer rides a separate 04-owned send, not this one | Return within 14d; unsubscribe | One email, then permanent stop | If M-L1/M-L2 both killed, M-L3 never ships |

**Timing unlock, stated exactly:** the 7/14/30 cadence is an industry default, not
a measured cliff. When 02's M4 return curve has ≥50 users and 4 weeks of readings,
re-set the stages to just after the curve's observed drop-offs. Until then the
defaults stand as *placeholders in the framework*, and no lapsed email sends at all
before the list clears ~30 captured users — at nine friends, a win-back email is a
weird text message.

### 5.4 Post-paywall-hit (post-flip only — this segment does not exist while #96 holds)

The highest-intent segment we will ever have: a free user who hit the judged-tier
cap (#75) and didn't convert. Nothing here renders in the free era — no meter UI
exists before the flip (03 §3.2's rule, adopted by 04 and 05).

| ID | Trigger | Audience | Channel | Goal | Copy | Metric | Cap | Kill |
|---|---|---|---|---|---|---|---|---|
| M-P1 | `paywall_hit{surface:judged_meter}` — the rep itself | Capped free users | In-app | The cap card + sheet | **[DORMANT — copy exists]** 05 §3.1/3.2, adopted wholesale; nothing for lifecycle to add | `paywall_viewed→upgrade_started`; guardrail: exposed-cohort W2R (02's paywall row) | Product surface | 02's loss condition |
| M-P2 | ≥2 `paywall_hit` in 7 days, no upgrade, email-captured | Repeat-capped users | Email, **once per user ever** | The one considered follow-up: next morning (never same-day — the hit already spoke), gain-framed unless E1 says otherwise | **WAITING ON DATA.** Unlock: the flip itself, live `paywall_hit` events with a denominator, and E1's loss-vs-gain result (04 §6) so the email's framing follows evidence, not my prior | `upgrade_started` from email; unsubscribe; recipient W2R vs matched non-recipients | Once ever per user; S5, S6 | Unsubscribes > upgrades, or recipient W2R dips — then the segment gets zero email and the cap card does all the work |
| M-P3 | Streak-risk day + capped same day | — | — | **No message. Ever.** | Suppression S6 — the collision 04 §1.3 exists to prevent | — | — | — |

---

## 6. The three messages that matter most (D0–D7, fully polished)

Chosen for leverage: M-H1 is the activation event's delivery vehicle (01's NSM
hinges on rep 2), M-H2 is the retention workhorse, M-H5 is the uninstall-moment
defuser. Push titles are fixed at "Ethos" by the pipeline (`lib/reminders.ts`), so
variants are bodies; the in-app message gets headline + body. A/B here means
sequential-cohort comparison per 02 §4.1 — never a 50-user split.

### 6.1 M-H1 — the first armed reminder (D1, at the hour they chose)

The reader's state: they did one rep yesterday, felt the numbers, tapped a plan.
This push is *their own plan coming back* — the copy's job is to make it feel that
way, and to make the ask 60 seconds, not "a session."

- **A (baseline-frame, ties to #135):**
  > **Ethos** · Your baseline is set. Today's rep gets a number to beat it. 60 seconds.
- **B (habit-frame — the shipped `reminderBody` line, promoted to variant):**
  > **Ethos** · Day two is the one that makes it a habit.

Rationale: A cashes the exact cheque rep 1 wrote ("every rep after this has a
number to beat"); B names the honest stakes of day two (Duolingo's 1→2-day jump is
their stated retention cliff). A is my prior — it is specific to *this user's*
yesterday; B is generic to everyone's day two. Metric: `reminder_clicked` → rep row
same local day, cohort vs cohort. Both end forward, neither mentions what happens
if they don't.

### 6.2 M-H2 — streak-at-risk (armed body when streak ≥2)

- **A (the shipped line, promoted to variant):**
  > **Ethos** · 12 days. One rep keeps it.
- **B (05 §4.1's draft, adopted as the challenger):**
  > **Ethos** · 12 days, still standing. One 60-second rep before midnight makes it 13.

Rationale: A is five words and pure fact; B adds the cost (60 seconds) and the
deadline (midnight — #77's local day, true) and pre-answers "no time tonight."
Duolingo's practice says specificity of cost wins at the margin; brand says shorter
wins. This is exactly the kind of pair sequential cohorts settle. Loss aversion on
the number, zero guilt about the person, no sad mascot (#26) — both variants comply
by construction. One deliverability note: "before midnight" copy can fire no later
than 9:59pm (quiet hours), which is honest — the deadline named is real, the send
respects the curfew.

### 6.3 M-H5 — the streak-lost consolation (in-app, next open after a loss)

The most dangerous moment in the lifecycle: post-loss guilt causes uninstalls, and
the first screen after a loss decides whether the user reads Ethos as a coach or a
scold. Rules in force: #52 (end on something true and good), #51 (forward only —
the miss is never mentioned), #93 (the day counter is the number that didn't
reset), no sad Demos.

- **A (counter-anchored):**
  > **Day 12 doesn't reset.**
  > The streak starts again at one. The twelve days you spoke are still on the
  > board — and today can make it thirteen.
- **B (plain-fact):**
  > **The counter kept counting.**
  > Streaks reset; days spoken don't. You're at 12. One rep starts the next run.

Rationale: both lead with the un-losable number, state the reset as mechanics (not
verdict), and end on the forward move. Neither says "you missed," "don't worry,"
or "it's okay" — reassurance implies a failure to be reassured about, which is the
guilt mechanic entering through the back door. A is warmer; B is drier and four
words shorter. Metric: same-day rep after seeing the card, and — the one that
matters — return rate over the following 7 days vs users who lost a streak before
this card existed. **WAITING ON DATA** rider on the whole message: if a no-message
control cohort returns *better*, even consolation is salt, and the card reduces to
the day counter with no copy at all.

---

## 7. Colleague documents — adopted and critiqued

- **01 (Growth PM):** metric contract adopted; every row above names a branch-A/B/D
  job. Their branch-D framing ("email capture among W2-retained users") understates
  one thing this file makes explicit: email is not just measurement durability, it
  is the **only functioning re-engagement channel for the iOS majority** — capture
  rate is a lifecycle-capability metric, not only a data one.
- **02 (Data Analyst):** event vocabulary used exclusively; their
  measure-clicks-not-sends rule (their §1.2 `reminder_clicked` row) adopted as this
  channel's honesty baseline. Two addenda requested per their no-parallel-names
  rule: (a) `when_plan_cleared` — the push channel's kill-metric is currently
  invisible (§2.4); (b) when an email sending path is built, sends/opens/
  unsubscribes need a home (their `events` table works; `email_sent{message_id}` is
  enough — no content, IDs only, privacy floor intact).
- **03 (Behavioral Designer):** freeze-rescue line (their streaks row) adopted and
  given words (M-H4); boss countdown chip adopted (M-A2); their §3.4
  no-exogenous-randomness doctrine is why no message in this map ever promises a
  surprise ("come back and see!") — every push names exactly what is true.
- **04 (Monetization PM):** §1.3's streak/monetization firewall adopted as S6 and
  extended: *the push channel never sells at all*, any state, any era. Their
  §5.4.3 win-back offer stays theirs — my M-L3 explicitly does not carry it. Their
  flip checklist gains one lifecycle rider: **M-P2 must not exist at flip-day** —
  it ships only after E1's framing data exists; a post-cap email guessing at
  framing is spending the highest-intent segment on a coin flip.
- **05 (Conversion Copywriter):** their §4 pushes, adopted and re-homed: 4.1
  becomes M-H2 variant B (their best push); 4.5 becomes M-A1 verbatim; 4.2/4.3
  stay dormant with the league. **Two critiques from the channel chair:**
  (a) their §4.4 lapsed-3-day push is written as if it can be *sent* — it can only
  be pre-armed on Chromium (arm-and-cancel, §0.1), so for the iOS persona majority
  it does not exist; it is filed as M-L0 with its delivery limits named, and the
  lapsed workload moves to email, which their doc never covers — that gap is this
  document. (b) Their §4 precedence ladder (streak > boss > league > lapsed) is
  right about order but silent about *mechanism* — at arm time we can't referee a
  race between messages we compose at different times; §2.2 turns their ladder
  into an arm-time body-priority rule, which is the enforceable version. Adopted
  otherwise; their read-aloud test was applied to every draft here.
- **06 (CRO):** their SMTP finding is this file's blocker #1 (§0.2) — from the
  lifecycle chair it outranks every message in this map, because it decides
  whether the email channel exists. Their row 12 (iOS reminder gap) is adopted as
  the factual basis of §0.1 and Challenge L1. One friendly extension: their fix 5
  (when-plan prominence) is also lifecycle's fix — the when-plan tap is this
  entire document's supply line; every push in §4–6 is downstream of that one tap.

---

## 8. Formal challenges

### Challenge L1 — The when-plan tap should offer "remind me by email" when the browser can't fire notifications (touches #136's flow; adjacent to #134's ask cadence)

**Claim:** #136 arms a reminder that, per #42's own tiers, cannot fire for the
persona's majority device (iOS Safari: `unsupported`; the tap stores an hour and
the settings screen honestly says it can't fire). The d=0.65 implementation-
intention mechanism is built and mostly dead on arrival for AU 16–28. Email is the
one channel that reaches a closed iPhone tab, and `docs/email.md` already names
email reminders as "the honest cross-platform answer" — unbuilt. Proposal: when
the when-plan tap resolves to tier `open-tab` or `unsupported`, the confirmation
line offers one optional field: "This browser can't fire reminders. Want it by
email instead?" — a *functional* ask (the email has a job the user just requested),
not a save-progress wall.
**Evidence:** `lib/reminders.ts` tier logic (read tonight); 06 row 12 ("the
when-plan lever is dead on iOS", High severity); docs/email.md "Not built yet";
#134's own design language distinguishing loud asks (the wall, twice) from quiet
functional surfaces (#137's line). The collision to rule on: #134 says the soft
wall shows twice, "never again after" — a reminder-email field is arguably a third
email ask in spirit, which is why this is a challenge and not a recommendation.
**Test that settles it:** ship behind the tier check only (Chromium users never
see it). Watch five iOS first-sessions: does the field depress the when-plan tap
rate (the primary lever must not pay for the fallback)? Then compare
reminder→same-local-day-rep conversion, email-reminder cohort vs no-reminder iOS
cohort, sequentially. Kill: when-plan tap rate drops, or email-reminder
unsubscribes exceed its rep conversions in two weekly readings. Dependencies:
§0.2's SMTP fix and an email sending path (docs/email.md) — this challenge is
moot until both exist, which is also its scheduling.

### Challenge L2 — One narrow second push on high-stakes streak-risk days (challenges mechanics.md's "one notification per day max")

**Claim:** the flat one-per-day cap gives a morning-slot user zero at-risk coverage:
their single send fires at 8am, and if the day slides, the streak dies with the
channel silent — the exact moment the brief's Duolingo analysis says escalation is
warranted ("escalating only when a streak is genuinely at risk"). Proposal, at its
narrowest: users with streak ≥7 whose habitual-hour reminder produced no rep may
receive ONE additional push at 21:00–21:30 local (inside the curfew — quiet hours
still bind), body M-H2, capped at 2 sends that day, never on consecutive days,
and only while an earned/bought freeze cannot auto-bridge (#38/#39 — if the freeze
will save it, the silence is honest because nothing is actually at stake).
**Evidence:** Duolingo's streak-save escalation is their publicly-credited
retention mechanic and it is *conditional*, not a volume increase; the one-per-day
cap was written (mechanics.md, 9 Aug era) before #136 existed — before the send
was the user's own plan at their own hour, which changes what "one more" costs;
loss-aversion framing is explicitly allowed (#26) and a 9pm "12 days. One rep
keeps it." is loss-aversion, not guilt. The counter-evidence I hold myself to:
every additional send spends the trust budget this document exists to protect,
which is why the conditions are this tight and the default answer, absent
Timothy's ruling, is the cap as written.
**Test that settles it:** post-data only (≥50 users with streaks ≥7). Sequential
cohorts, escalation on vs off: streak-7+ survival through risk days, against
notification disable rate and `when_plan_cleared` (§2.4's addendum). Kill: any
rise in disables/permission revocations that outpaces streaks saved — then the
cap was right, the challenge dies, and the entry in the growth log says so
(#118's publish-the-refuted-hypothesis precedent).

---

## 9. WAITING ON DATA — the consolidated unlock ledger

Do not act on any row's downstream deliverable until its unlock exists.

| Deliverable | Unlocked by (exactly) |
|---|---|
| Habitual send time (M-A4) | ≥7 days spoken + ≥5 reps per user **and** `reps.tz_offset_min` shipped (02 §1.4 fix 2) — modal local hour is uncomputable without it |
| Lapsed cadence timing (M-L0–L3 stages) | 02's M4 return curve at ≥50 users / 4 weeks — stages re-set to the observed drop-offs |
| Win-back copy (M-L1/L2) | ≥10 real lapse signals: hello@ replies, observed sessions, or churned-user conversations |
| Lapsed-30 final email (M-L3) | M-L1/M-L2 surviving their kill criteria |
| Post-paywall-hit email (M-P2) | The #96 flip + live `paywall_hit` denominator + E1's framing result (04 §6) |
| §2.4 kill thresholds (numbers) | ≥50 granted-permission users; two weekly readings |
| M-H5's existence (vs bare counter) | Post-loss return, message vs no-message cohorts |
| Any email send at all | §0.2's SMTP fix verified on a real phone, twice, on different days (06 fix 1's own bar) |

Founder-review fix list surfaced by this document (documents-only run — nothing
touched tonight): the SMTP repair (06 #1, co-signed); the `didToday` arm fix
(§0.2.2); the email sending path for non-auth mail (docs/email.md "Not built
yet"); `when_plan_cleared` + `email_sent` instrumentation (§7, 02 addenda);
one-tap unsubscribe + Spam Act footer in every lifecycle template before the
first lifecycle send (§0).

---

*End of role 7. Launch week's lifecycle, honestly inventoried, is: the in-app
surfaces, one armed reminder whose body is chosen at arm time, and transactional
email once SMTP works. That is not thin — it is the correct size of a channel
whose budget is trust, spent on users who exist.*
