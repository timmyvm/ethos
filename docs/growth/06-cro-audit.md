# 06 — CRO Specialist: Heuristic Funnel Audit, Top Fixes, Radical Variants

**Role:** CRO consultant (heuristic-audit school; pre-traffic specialist) · **Date:** 2026-08-12
**Mandate:** Audit the built funnel screen by screen, name the five fixes worth founder-hours, and spec three radical variants with qualitative test plans — no A/B theatre at zero traffic.

---

## 0. Operating stance and evidence discipline

- **No split tests.** Classic A/B is statistically meaningless below ~1,000
  conversions/month; adopting 01 §3 and 02 §4.1 verbatim: at beta N the
  toolkit is heuristic audit, watched sessions, and radical variants judged
  on qualitative signal. Anyone proposing a button-color test at this stage
  is spending the founder's scarcest resource on noise.
- **Audit what exists.** Every finding below is tagged **[BUILT]** (I read
  the shipped code: `app/welcome/page.tsx`, `app/page.tsx`,
  `app/rep/page.tsx`, `components/RepResult.tsx`, `components/AuthForm.tsx`,
  `lib/onboarding.ts`, `lib/entitlement.ts`, `lib/drills.ts`,
  `app/(marketing)/about/page.tsx`, `app/signup`, `app/signin`) or
  **[SPEC — VERIFY ON STAGING]** (the surface exists only in decisions/docs,
  or the evidence is a repo note I could not re-run tonight). A spec-level
  finding is never presented as an observed one.
- **Free era (#96):** `EVERYTHING_FREE = true` verified in
  `lib/entitlement.ts`, and `fetchProfile` routes through `isUnlocked()`, so
  no paywall renders anywhere in the current funnel. This audit therefore
  contains zero paywall-conversion findings — that work is 04's, dormant.
- **Some friction is load-bearing.** The technique tips (#104), the Frame
  step (#35), the no-exit results walk (#103), the quiet soft-wall decline
  (#134), and the substance floor (#55) all stay. Nothing below recommends
  removing an anxiety-reduction or honesty affordance to "reduce steps."
- Colleague contracts adopted: 01's tree (findings name their branch), 02's
  event vocabulary (fix verification uses their names only), 03's
  endorsement test, 05's copy bans applied to every suggested line here.
- Voice-of-customer: none exists. Every felt-moment claim is
  **UNVALIDATED HYPOTHESIS**.
- **ASSUMPTION (intake unfilled): ~15 focused founder-hours/week.**
  **ASSUMPTION (intake unfilled): soft launch / public beta within ~4–6 weeks.**
- Formal challenges in §9. Nothing locked is silently contradicted.

### 0.1 The funnel as actually built (verified routing)

```
speakethos.com/  →  app/page.tsx (The Floor)
                    └─ useEffect: firstRun()? → router.replace("/welcome")   [BUILT]
/welcome         →  3 screens → "Take the floor" → /rep?lesson=f1            [BUILT]
/rep (rep 1)     →  audio-only, mic primer line, tips → Rec (getUserMedia)   [BUILT]
                 →  Stop → upload+analyze (~10s) → walked results ×3 (#103)  [BUILT]
                 →  final screen: closing note, Tomorrow, when-plan, CTAs    [BUILT]
                 →  any exit → SaveGate (rep1; again at streak 3) (#134)     [BUILT]
/signup (anon)   →  EMAIL ONLY (#142) → inbox → confirm → /auth/reset?first  [BUILT]
/about           →  the marketing landing… which NOTHING links to            [BUILT]
Return next day  →  memory + when-plan reminder (Chromium-only OS schedule)  [BUILT]
```

Two structural facts fall out of the routing check, and they frame the
whole audit:

1. **The marketing landing page is orphaned.** `app/(marketing)/about/`
   is a genuinely good acquisition page (symptom-first hero, the locked
   acquisition headline, the refuses-to-be list) and **no route, link, or
   nav in the product points at it** (verified by grep across `app/`).
   Cold traffic hitting speakethos.com gets the app shell, then a
   client-side bounce to `/welcome`. The de facto hero for every stranger
   is welcome screen 1. See §9 Challenge CRO-1.
2. **The funnel's most important tap is currently reported broken.**
   BUILT.md (12 Aug, "measured") records that Supabase custom SMTP is
   misconfigured: the email-attach call (`PUT /user`) — the exact call the
   anonymous upgrade (#142) makes when someone taps "Save my progress" →
   "Create my account" — hangs for GoTrue's 10s deadline and returns 504.
   The user sees a spinner, then an error; the mail *sometimes* lands
   anyway, which is worse (an error followed by a working link teaches
   distrust). **[BUILT — evidenced by the repo's own measurement note;
   re-verify live before and after the dashboard fix.]** Until this is
   fixed, branch D (durability) of 01's tree is not leaking — it is
   severed, and every anonymous user is a cleared-cache away from
   becoming unmeasurable churn.

---

## 1. LIFT audit, screen by screen

Factors: **V**alue-prop clarity · **R**elevance to the arriving visitor ·
**U**rgency · **A**nxiety · **D**istraction. Scored 1–5 (5 = healthy),
worst factor first per screen. Scores are heuristic judgments, stated so
they can be argued with — not measurements.

### 1.1 `/about` (the orphaned landing) — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **R — 2** | 2 | Not reachable. The best-written surface in the funnel has zero relevance because zero strangers land on it. Fix is routing, not copy. |
| U | 3 | "60 seconds. No signup until you've done one." under the CTA is the right urgency — cost-of-trying, not fake scarcity. |
| A | 4 | "The camera is optional, and it stays here" + anonymous-first line pre-answer the two big fears. Strong. |
| V | 4 | Hero names the felt moment; the daily-loop card explains the mechanism. Slightly long before the first CTA on mobile. |
| D | 4 | Two CTAs (top/bottom), same destination — fine. |

### 1.2 `/welcome` (the de facto hero) — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **V — 2** | 2 | Screen 1 is "You already know the gap." + body about fuzzy sentences. A stranger who gives it 5 seconds learns the *problem*, not what the product is or costs to try. The category ("record 60s, get numbers") arrives on screen 2 — one tap deep, behind a generic "Next". §6's 5-second test will fail on screen 1 as built. |
| **A — 3** | 3 | Nothing here says "no signup, nothing recorded yet" — the strongest anxiety-killers in the product are unstated at the exact moment a stranger decides whether to invest three taps. `/about` says it ("No signup until you've done one"); the screen people actually see doesn't. |
| D | 3 | "Skip" on screens 2–3 goes to `/` (the Floor), silently dropping the direct-to-first-lesson path the final CTA carries. A skipper lands on a home screen with more choices instead of the baseline rep. |
| U | 4 | Three short screens, one button each. Fine. |
| R | 4 | Symptom-first framing matches the self-diagnosing persona (vision.md). |

### 1.3 `/rep` idle, rep 1 — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **A — 2** | 2 | The two-anxiety stack lands here at once: (a) the OS mic prompt, and (b) "improvise 60 seconds, judged, right now." The #135 primer sentence exists and is well written — but it renders at 12.5px in stone-500, the visually quietest text on the screen, nowhere near the Rec button it primes. And it only renders when `repCount === 0` has resolved; on a slow fetch, a fast tapper meets the OS dialog cold. The *performance* anxiety (extemporising) has no affordance at all on rep 1 beyond the tips card — the Frame step that would help most is opt-in and OFF (#35), which a first-timer cannot know exists. **UNVALIDATED HYPOTHESIS:** the biggest rep-1 loss is not mic denial but "I'll do this later when I've thought of something to say" — silent tab-close between arrival and Rec. |
| **R — 3** | 3 | Lesson 1's prompt is "Introduce yourself and what you're building — 60 seconds, no notes." *What you're building* is founder-shaped. A 17-year-old student — half the locked persona (#2, 16–28) — is building nothing and now has to translate the prompt while already nervous. The baseline rep should be answerable by every member of the persona without translation. |
| V | 4 | Title, prompt, tips, "what this earns" anticipation (#48) — the screen explains itself. |
| D | 4 | One terracotta Rec button. Clean. |
| U | 4 | The anticipation cue is honest urgency. |

### 1.4 Mic permission + failure path — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **A — 2** | 2 | Ask fires at moment-of-use inside the Rec gesture — correct (#135). But the failure path is a cliff: `startRep`'s catch renders phase "error", whose card is headed **"Rep didn't score."** — a scoring-failure headline on a permission failure. Body: "Mic unavailable. Check browser permissions and try again." Generic, no browser-specific recovery, and once the OS has a stored "deny," tapping Rec again fails silently-instantly on most browsers, which reads as the app being broken. A denied first-timer has no route back that they can discover. |
| V | 3 | Nothing on the error card restates that nothing was lost / nothing recorded. |
| U/R/D | 4 | The ask itself is the right pattern; only the deny branch is unfinished. |

### 1.5 Recording + analyzing — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **A — 3** | 3 | Stop → immediate upload, no confirm, no minimum-duration guard. A panicked 4-second false start is stored forever and walks the full results flow to "Not enough to score." A first-timer who fumbles gets the product's sternest card as their first-ever feedback. (The floor itself is correct and locked, #55 — the issue is the rep-1 *framing* of the floor and the distance to "go again," see §3 row 7.) |
| D | 4 | Live tips yield to nudges (#129); meter, timer, one Stop. Disciplined. |
| V/U/R | 4 | "Scoring the rep… The numbers are computed, not guessed" is exactly right for a ~10s wait. |

### 1.6 Results walk (3 steps) + final screen — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **D — 2** | 2 | The final screen stacks: closing moment + "Tomorrow" decay card + when-plan chips + "Next lesson" (terracotta) + "Retake" + "Done for today". Five decisions on the screen where 01's tree says the single highest-leverage act is the when-plan tap (d = 0.65, #136). The lever is fourth in visual order and styled quietest. |
| A | 4 | Baseline frame (#135) in the delta slot, streak-end rule (#52), no exit until the debrief is done (#103 — load-bearing, keep). |
| V/R/U | 4–5 | The walk is the best-converting sequence in the product; leave its structure alone. |

### 1.7 SaveGate + `/signup` (anonymous upgrade) — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **A — 1** | 1 | Not the screen — the plumbing. The wall's copy is excellent (stakes the just-made numbers, quiet "Not now"), then "Create my account" hits the SMTP hang: ~10s spinner → error (§0.1 fact 2). The single most trust-sensitive tap in the funnel currently punishes the exact user who trusted it. |
| **V — 3** | 3 | The email-only two-step (#142) is correctly explained ("Two steps: the link confirms this address, then you pick the password") — but the inbox round-trip happens *mid-glow*, and the "Check your inbox" screen's CTA is "Back to the floor," which quietly ends the save flow with the save unconfirmed. No resend button; an unconfirmed user who lost the mail has no visible path. |
| D/U/R | 4 | One field, honest carrying-notice, sign-in-orphan warning on `/signin` — all good. |

### 1.8 Return next day — [BUILT]

| Factor | Score | Worst-first notes |
|---|---|---|
| **U — 2** | 2 | The return depends on memory plus the when-plan reminder, and the reminder truly schedules only on Chromium (#42, BUILT.md). The persona's default device is an iPhone; on iOS Safari the when-plan tap stores an hour and then honestly reports notifications unavailable. So the d = 0.65 mechanism is built and mostly cannot fire for the AU 16–28 audience. Not a copy fix — this is the open-queue web-push/native decision surfacing as a funnel hole. Flagged to the founder, not solvable inside this audit. |
| A | 4 | The morning-after surfaces (day counter #93, freeze-rescue line, no shame states) are the humane best of the product. |
| V/R/D | 4 | The Floor's decay-reason line ("why this, today," #66) is a genuinely strong return surface. |

---

## 2. Friction log — three personas walk the funnel

Method for the reader: these are *predicted* hesitations from the code
walk, written to be checked against five real watched sessions (§8 test
plans). Each is falsifiable by observation. All persona reactions:
**UNVALIDATED HYPOTHESIS.**

**P1 — Skeptical adult self-improver (26, trains, has tried three apps).**
Lands on `/welcome` screen 1: "You already know the gap." — *"Sure. What
is this?"* Taps Next out of momentum, not conviction. Screen 2 sells them
(numbers, never vibes). Rep screen: reads the tips, likes them, hesitates
at the prompt — *"introduce myself to… whom?"* Records. The walk lands;
the transcript being open (#56) is the trust moment. Hits SaveGate,
approves of the honesty, taps Save — 10-second hang, error. *"Yeah, this
is someone's side project."* This persona forgives rough edges everywhere
except the moment they handed over an email.

**P2 — Nervous student (17, hates their recorded voice).**
Welcome screens fine — the mascot helps. Rep screen: reads "Introduce
yourself and what you're building" and stalls; *builds nothing;* rereads.
Taps Rec eventually, mic prompt is fine (the primer's promise "live only
while you record" works *if they saw it*). Speaks 20 seconds, panics,
taps Stop. Gets "Not enough to score. …isn't a rep yet. Aim for 60–90
seconds of actually saying something." — reads it as a verdict on
themselves, not the take. The nearest "go again" is two screens away at
the end of the walk. **This is the funnel's most likely silent-churn
moment after the mic itself.** They will not tell anyone; watched
sessions are the only way to see it.

**P3 — Curious tab-hoarder (gives any link 8 seconds).**
Root URL: sees the Floor paint for a beat, then the bounce to `/welcome`
(the client-side redirect double-paints — minor, real). Screen 1: a red
panda and a headline about a gap. Eight seconds expire without the words
*record*, *60 seconds*, *free*, or *score* having appeared. Tab closed,
nothing retained, no way to ever re-reach them (no email, no pixel — by
design). The only fix that matters for P3 is that screen 1 answers §6's
5-second test on its own.

---

## 3. The friction table

Severity: **Crit / High / Med / Low** (impact on 01's branch A–D).
Effort: **S** (<1 founder-hour) / **M** (half-day) / **L** (days).

| # | Step | Friction / anxiety | Sev | Fix | Effort | Status |
|---|---|---|---|---|---|---|
| 1 | Save wall → signup | Email-attach `PUT /user` hangs 10s → 504 (SMTP misconfig); the funnel's #1 conversion tap errors for everyone | **Crit** | Supabase dashboard: Auth → Emails → SMTP (port 587/STARTTLS per `docs/email.md`), or toggle custom SMTP off; then verify the full confirm→`/auth/reset?first=1` loop on a real phone | S | [BUILT — repo-measured 12 Aug; re-verify live] |
| 2 | Cold arrival at root | Marketing landing orphaned; strangers meet welcome screen 1, which doesn't say what the product is; locked acquisition headline (#86) renders nowhere a stranger lands | High | §9 CRO-1 (routing challenge). Compliant interim fix: screen 1 gains one clarity subline + "free · no account to try" (see fix F4) | S–M | [BUILT] |
| 3 | Mic deny | Error card headed "Rep didn't score." on a permission failure; no recovery instructions; stored OS deny makes retry silently fail | High | Split the error state: mic-branch gets its own heading ("The mic didn't open — nothing was recorded"), per-browser re-enable hint, and a reassurance line | S | [BUILT] |
| 4 | Rep-1 prompt | "…and what you're building" excludes the non-founder half of the persona; translation load at peak anxiety | High | Reword lesson f1's prompt to be universally answerable, e.g. "Introduce yourself and one thing you're into right now" (same shape, same tips) | S | [BUILT] |
| 5 | Rep-1 primer visibility | #135's priming sentence is the smallest, faintest text on the screen and can miss fast tappers (renders only after `repCount` resolves) | Med | Move the mic promise to the button's own caption on rep 1 ("Rec — asks for your mic, live only while you record"); render it whenever `repCount` is 0 *or* unresolved | S | [BUILT] |
| 6 | Recording | No minimum-duration guard; a 3-second accidental Stop uploads, stores, and walks a dead rep | Med | Under ~8s, offer one interstitial: "That was 4 seconds — keep it or go again?" (keep = current behavior; never auto-discard) | M | [BUILT] |
| 7 | Rep-1 substance fail | "Not enough to score" copy is rep-agnostic and verdict-toned for a first-timer; "go again" is two screens away | High | Rep-1-only variant of the card: forward frame + an immediate "Same prompt, go again" action on that screen (walk resumes if they decline). The floor itself unchanged (#55) | S–M | [BUILT] |
| 8 | Results final screen | Five competing decisions; when-plan chips (the d = 0.65 lever) fourth in order and quietest | Med | On rep 1: when-plan directly under the closing moment, above "Tomorrow"; "Retake" collapses to a text link | S | [BUILT] |
| 9 | Welcome "Skip" | Skip → `/` loses the direct-to-lesson-1 path; skipper lands on a choice-rich home | Low | Skip → `FIRST_REP` (same destination as the final CTA) | S | [BUILT] |
| 10 | Root double-paint | Fresh visitor sees the Floor flash before the `/welcome` bounce (client-side redirect) | Low | Gate the Floor's first paint on the `firstRun()` check (render null for that frame) — or resolve with CRO-1 | S | [BUILT] |
| 11 | Check-inbox screen | No resend; CTA "Back to the floor" abandons an unconfirmed save; lost mail = dead end | Med | Add resend + "didn't arrive?" line; keep the return CTA | M | [BUILT] |
| 12 | Return next day | Reminder scheduling is Chromium-only; iOS persona majority effectively unreachable; when-plan mostly can't fire | High | Not fixable in copy. Founder decision: web push (server) or native wrap — already the open-queue item; this audit adds "the when-plan lever is dead on iOS" as its urgency argument | L | [BUILT] |
| 13 | Streak-3 second wall | Fires per #134 via `gateMoment` | — | Verified wired in code; behavior on a real 3-day anonymous streak untested by anyone | — | [BUILT — VERIFY ON STAGING] |
| 14 | Boss card on home, rep-1 era | "This week's boss: Cold Topic" is tappable before rep 1; a stranger can wander into the hardest mode first | Low | Show the boss card only when `history.length > 0` (mirrors the #137 line's condition) | S | [BUILT] |

---

## 4. Anxiety audit — the mic is the credit card

Recording your own voice ranks above a card number for many people:
a card leaks money, a recording leaks *self-image*. The funnel's job is
to split and sequence the component fears, never to pretend they aren't
there.

**The fear stack at rep 1, in order of when it can kill the session:**

1. **"What is this going to do with my voice?"** — answered well
   (moment-of-use ask, "live only while you record," anonymous-first),
   but the answer is one faint sentence (§3 row 5). The *system* is
   honest; the *presentation* under-spends on it.
2. **"I have to perform, now, unprepared."** — the real cliff
   (**UNVALIDATED HYPOTHESIS**, checkable by watching). Currently
   mitigated only by tips; the Frame step (#35) — 30 seconds of think
   time, exactly this fear's antidote — is invisible to the person who
   needs it most because it's an opt-in setting, OFF, discovered in
   Settings. §8 V3 attacks this directly.
3. **"I'll hear myself and cringe."** — 01's Category-1 hypothesis. The
   product's answer is decent by accident: playback is never forced, and
   the results lead with numbers, not audio. 05's drawer line ("Everyone
   hates their own recording. The numbers don't.") is ready if watching
   confirms the leak. Endorsed: hold it until observed.
4. **"If I mess up, it's on my permanent record."** — true today (every
   Stop persists; the log keeps it). Retakes exist but don't remove the
   fumble. §3 row 6 is the cheap mitigation at the moment it matters.

**Is anonymous-first actually exploited?** Mostly yes — verified in code:
zero account, zero name, zero email before value; the session is minted
*by the upload itself* (`ensureSession` inside `stopRep`), which is the
strongest possible version of "nothing is asked before value."
[BUILT]. The gaps: the welcome flow never *says* it (the one place the
weapon is pointed at nobody), and the `/about` page that does say it is
unreachable (§0.1). Zero-commitment is a conversion asset only if the
anxious visitor knows it before the fear fires.

---

## 5. The 5-second test — spec and answer key

**Protocol:** 5 people in persona (not friends-of-friends who've heard
the pitch). Show the surface for 5 seconds (screenshot, timed). Take it
away. Ask, in order: (1) "What is this?" (2) "What would happen if you
tapped the button?" (3) "What would it cost you to try?" (4) "Would
you?" Record verbatim. Run per surface: welcome screen 1 as built,
`/about` hero, and any §8 variant. Cost: one evening. (02 §4 item 3
applies: directional signal, never rates.)

**Answer key — a surface PASSES if 4 of 5 strangers retain:**

| Must retain | Passing paraphrases | Instant fail |
|---|---|---|
| Category | "you practice speaking / record yourself talking" | "a podcast thing", "therapy?", "a game" |
| The unit of work | "about a minute a day" | "a course", "lessons you watch" |
| The payoff | "it scores you / counts your ums / gives you numbers" | "it gives you tips", any vagueness |
| The cost of trying | "free / no signup / just talk" | "you make an account", "it's paid", don't-know |

**Predicted results (stated so the test can embarrass me):** `/about`
hero passes 3 of 4 rows (cost-of-trying passes via the sub-CTA line);
welcome screen 1 as built passes only Category-adjacent ("something
about speaking better") and fails units, payoff, and cost. If the
prediction holds, fix F4 / Challenge CRO-1 are confirmed by strangers,
not by me.

---

## 6. Top 5 fixes, ranked by severity × ease

1. **Repair the SMTP config and re-verify the anonymous upgrade
   end-to-end.** (Crit × S.) Mechanism repaired: the entire durability
   branch (01 tree D) — soft-wall save rate, email capture, the ability
   to ever re-engage or even *count* early users. Every other conversion
   improvement is pouring into a bucket with the bottom off until this
   tap works. Verification: `signup_completed{path: anonymous_upgrade}`
   (02's event) firing on a real phone, twice, on different days.
2. **Give the funnel a real front door.** (High × S–M.) Mechanism:
   branch A's first edge (arrival → rep-1 started) — currently the
   product's best persuasion (`/about`) has no traffic and its de facto
   replacement (welcome screen 1) fails the 5-second test. Interim
   compliant fix tonight-sized: screen 1 subline + cost-of-trying line
   (F4 below); the full fix is §9 CRO-1, Timothy's call.
3. **Finish the mic-deny branch.** (High × S.) Mechanism: the funnel's
   most expensive permission (#68) currently has a broken fallback — a
   deny is a mislabeled dead end. Correct heading, per-browser recovery
   hint, explicit "nothing was recorded." Verification:
   `mic_permission_denied` followed by a later `mic_permission_granted`
   for the same user becomes possible at all.
4. **Rewrite lesson f1's prompt + the rep-1 substance-fail card.**
   (High × S.) Mechanism: rep-1 completion and scored-rate (02 M5's
   "floor failure on rep 1 is an onboarding bug" — this is the bug's
   two most likely causes, pre-fixed). Universal prompt; rep-1 fail
   card gains a forward frame and same-screen "go again."
5. **Re-sequence the final results screen around the when-plan.**
   (Med × S.) Mechanism: implementation intention (#136) — the largest
   effect size in the research pass, currently the least prominent
   element on its screen. When-plan up, retake down to a text link.
   Verification: `when_plan_set` rate per rep-1 walk completion.

**F4 (referenced above), the tonight-sized welcome fix:** screen 1 keeps
its title and adds one line of category + cost under the body — e.g.
"A 60-second rep a day, scored with real numbers. Free, and nothing to
sign up for before your first one." — coach register, no banned words,
and it makes the de facto hero answer all four answer-key rows without
touching #133's routing or #86's lines.

---

## 7. Three radical variants (whole-screen rethinks, build-worthy)

Rep-before-signup is already the shipped flow (#15/#133) — these move
past it. Each is a variant to *build and watch*, not a redesign to
adopt tonight. All three respect the load-bearing-friction rule.

### V1 — "One-screen door": collapse the welcome to a single screen

**The rethink.** Three screens exist to earn three taps of patience from
someone who arrived with eight seconds. Invert it: ONE screen — Demos,
one clarity headline, three one-line rows (the gap / 60 seconds / real
numbers, compressing the current three titles), the cost-of-trying line,
one terracotta "Take the floor," the account door. Same route in
(#133's fresh-browser redirect untouched), same route out (lesson f1).
The intro's *content* survives; its *pacing* stops taxing P3 while P1/P2
lose nothing they'd miss.
**Mechanism:** every removed tap before the mic is removed abandonment
surface; the value prop moves from screen 2 to second 1.
**Test plan (5 users, in persona, screen-recorded with consent, phone):**
run 3 on the one-screen door, 2 on the built three-screen flow
(alternate order across users). Watch: time from load to Rec tap; any
scroll-back or hesitation on the single screen; whether anyone taps the
account door by mistake. Ask after: "What do you remember agreeing to?"
and the §5 answer-key questions. Signal that kills V1: single-screen
users arrive at the rep screen *not knowing what to do* (the intro was
doing comprehension work, not just pacing) — visible as prompt-rereading
or tips-scrolling longer than the three-screen users.

### V2 — "Show the mirror": a real scored rep as the landing artifact

**The rethink.** The funnel asks for the visitor's voice before showing
what the mirror looks like. Flip it: the front door (whichever surface
CRO-1 settles on) embeds ONE real rep — Timothy's, honestly labelled —
as a living results card: playable audio, the pause bar with its amber
landed pauses, three filler chips with timestamps, the Index. One line:
"This is what a rep looks like. Yours takes 60 seconds." CTA unchanged.
This is vision.md's own claim ("day-1 vs day-30 is the core marketing
asset") applied one step earlier: the *results screen* is the ad.
Founder-documented reps are already the stated CAC≈0 channel
(mechanics.md); this is that channel, on-site.
**Mechanism:** concreteness beats promise — the skeptic's "what do the
numbers actually look like?" and the nervous student's "how harsh is
it?" are both answered before the mic ask; curiosity ("what would MINE
say?") becomes the pull.
**Test plan (5 users):** show the mirror-hero to all 5 for as long as
they want, then ask: "What would you get if you recorded?" (specificity
of answer = the artifact worked), "Does seeing his numbers make you more
or less willing to record?" — then let them proceed for real and watch
whether they reach Rec. Signal that kills V2: users study the sample and
*leave satisfied* (the taste substitutes for the try — same failure mode
04 flagged for E5), or the sample reads as bragging/intimidating
("his score is 700-something, mine will be awful" — watch for verbatim).
**Effort:** M–L (one static artifact + audio; no engine work).
**Dependency:** an actually-good-but-imperfect founder rep — a flawless
sample would be manufactured-insecurity-adjacent (their gap vs his
polish); pick one with visible fillers on the card.

### V3 — "The mic check": split the two fears of rep 1

**The rethink.** Rep 1 currently bundles the permission fear and the
performance fear into one tap. Split them: after "Take the floor," an
optional 10-second **mic check** — "Say anything. This one isn't scored,
isn't kept, and doesn't count. It just proves the mic works." Level
meter dances, a *"heard you — nothing was saved"* line lands, then the
real baseline rep screen appears with the fear budget half-spent. The
mic check is genuinely unscored and unstored (no upload, no row) so it
never touches #55, #76, or the baseline framing (#135) — the baseline
rep is still the first rep that exists.
**Mechanism:** graduated exposure — the permission ask and first
voice-into-phone moment happen at zero stakes; the scored ask then
arrives as the *second* time they've spoken into the app, which is a
different animal for P2. Also converts the OS permission dialog into a
moment with literally nothing to lose.
**Test plan (5 users, deliberately recruit for nervousness — "would you
say you hate hearing recordings of yourself?"):** 3 with mic check, 2
without. Watch: Rec-tap latency on the scored rep; Stop-before-20s rate;
verbatim at the mic-check moment ("wait, it's not saving this?" is the
mechanism working). Ask after: "When were you most uncomfortable?"
Signal that kills V3: users treat the check as a step to skip (tap
through instantly, no relief visible) — then it's pure added friction
and dies; or users *practice their answer* during the check (it becomes
an unofficial Frame step — interesting, but then the honest fix is
surfacing #35 on rep 1 instead, at zero build cost).

---

## 8. Colleague documents — adopted and critiqued

- **01 (Growth PM):** tree and activation contract adopted; every fix
  above names its branch. Critique: branch D is described as a leak to
  "watch, don't panic" — the code walk says it is currently a *break*,
  not a leak (§0.1 fact 2). Their Category-1 instinct ("pair funnel
  numbers with watching real first sessions") is this document's method;
  the §7 test plans are the missing operational half of their §4.3
  gate's "≥10 observed sessions."
- **02 (Data Analyst):** event vocabulary used exclusively; no new
  events invented (V1–V3 are all measurable with `welcome_viewed`,
  `rep_started`, `mic_permission_*`, `when_plan_set`). Critique: their
  §0 ground-truth pass verified tables and entitlement but not the auth
  *plumbing* — the SMTP note sat in BUILT.md while §1.2 specced
  `signup_completed` as a healthy BUILT-SURFACE. An event on a broken
  tap would have measured zeros and looked like copy failure. Amendment
  requested: add "verify the instrumented tap actually completes" to
  their pre-launch checklist.
- **03 (Behavioral Designer):** endorsement test adopted for every fix
  and variant (V3 passes it verbatim: the user would describe the mic
  check as the app being considerate). Their Hooked read ("action:
  ability maximised; nothing to fix") is one notch too generous — the
  B=MAP analysis holds for the *daily* loop but not for rep 1, where
  ability is taxed by a founder-shaped prompt and an unsplit fear stack
  (§4). Friendly amendment, not a dispute.
- **04 (Monetization PM):** nothing to audit — no paywall renders in
  the free era, correctly. Their §4.3 divergence audit of `Paywall.tsx`
  matches what I read. One rider: their flip checklist should inherit
  §3 row 1 — flipping with a broken upgrade path would gate features
  behind an account flow that 504s.
- **05 (Conversion Copywriter):** hero variants and the §2.4 test
  protocol adopted — §5 here is the same protocol with an answer key
  bolted on. Critique: all three hero variants are written for a
  landing surface that no cold visitor currently reaches (§0.1 fact 1);
  their Challenge C1 argues placement while the deeper problem is that
  *neither* locked headline renders where strangers land. CRO-1 below
  is the structural version of their challenge; if it's accepted, their
  variants get a home and their test gets real traffic.

---

## 9. Formal challenges to locked decisions

### Challenge CRO-1 — The fresh-browser redirect (#133) makes the app's intro do the marketing page's job, and neither #86 headline ever meets a stranger

**Claim:** #133 routes every fresh browser at speakethos.com straight to
`/welcome`, and nothing links to `/about` — so the product's only
acquisition surface is an app-onboarding screen that (predictably, §5)
fails a 5-second test, while the purpose-built landing page and the
locked acquisition headline ("Practice being worth listening to.", #86)
render to no one. #133's own cited pattern — Duolingo's splash →
lesson-1 funnel — sits *behind* a marketing front door (duolingo.com);
the decision imported the splash and skipped the door.
**Evidence:** grep across `app/` shows zero inbound links to `/about`
[BUILT]; `app/page.tsx` `firstRun()` redirect [BUILT]; §1.2's LIFT
audit of screen 1 (V=2); 05 §2's three hero variants having no
reachable surface; #86 assigning a headline to "acquisition surfaces"
that currently do not exist in the funnel.
**Proposed amendment (narrowing, not reversal):** #133 keeps its rule
for the *app* — but a fresh browser arriving at the root gets the
acquisition hero (the `/about` content, or 05's variants) whose CTA is
"Take the floor" → `/welcome` (or, per V1, the collapsed door). One
screen added for strangers, zero change for returning devices, and both
locked headlines finally render where #86 says they should.
**Test that settles it:** §5's 5-second test on welcome-screen-1-as-hero
vs `/about`-as-hero (5 strangers each, answer key above). Post-gate
(01 §4.3): sequential-cohort arrival → `rep_started{rep_number:1}` with
the hero swapped per cohort. If welcome-as-landing matches the hero
within noise, #133 stands as built and F4's subline is enough.

### Challenge CRO-2 — The Frame step's default (#35) hides the funnel's best rep-1 anxiety tool from the only user who can't find it

**Claim:** #35 ships think-time OFF, opt-in via Settings — correct for
the retained daily user (protects the ≤5-minute loop) and wrong for
rep 1, where the performance fear peaks and the user doesn't know
Settings exists. The decision optimised the steady state and silently
applied it to the cold open.
**Evidence:** §4 fear stack item 2; the Frame step's own rationale
("trains think-before-you-speak, the founding desire") describing
exactly what a first-timer lacks; P2's predicted stall (§2 —
UNVALIDATED, but the cheapest hypothesis to check in the product).
**Proposed amendment:** rep 1 only — offer the Frame step inline as a
choice on the idle screen ("30 seconds to think first?" / "Just
record"), default respecting whatever is tapped thereafter. #35's
default stays OFF from rep 2 forever; the ≤5-minute loop is untouched
(rep 1 already has no loop to protect).
**Test that settles it:** the §7 V3 watch sessions answer this for free
(V3's kill-signal explicitly names this amendment as the fallback). If
observed first-timers don't stall pre-Rec, the challenge dies and #35
stands untouched.

---

*End of role 6. The five fixes in §6 are sized for one founder-week
alongside the SMTP repair; §7's variants are watch-tests, not builds to
ship; §9 is Timothy's call. Role 7: the SMTP finding (§0.1) is the one
item I'd escalate above every growth idea in all six documents — check
it first.*
