# DECISIONS.md — the log

Format: `#N · date · decision · rationale/reference`
Locked means locked. Reopen only with user data or Timothy's explicit call.

## Locked

1. 2026-08-08 · Product = daily speech gym (skill trait), not deadline prep · founder is user zero; persona-wedge over context-wedge
2. 2026-08-08 · Persona: ambitious 16–28 self-improvement demographic · founder-identical; reachable via content channels
3. 2026-08-08 · Freemium, monthly + annual (annual pushed) · Duolingo/Elevate pattern; capture the year while motivation is high
4. 2026-08-08 · Palette: terracotta #E76F51 CTA, amber earned-only, stone/cream room · brand.md; one orange per screen
5. 2026-08-08 · Type: Space Grotesk display/numbers, Inter body, Space Mono data labels · numbers are the hero; mono kills wellness-softness
6. 2026-08-09 · Name: **Ethos** · Aristotle's speaker-credibility; passes say/spell filter (filter itself is locked: non-founder says + spells first try)
7. 2026-08-09 · Mascot: red panda "Demos", flat, no outlines, cute not smug · approved art = assets/demos-side-profile.png; Higgsfield ref element `demos-red-panda`
8. 2026-08-09 · Signature element: the pause bar — silence rendered amber as achievement · core product insight made visible; no competitor has it
9. 2026-08-09 · Home layout: "The Floor" — one dominant rep card · opening the app = being handed the floor
10. 2026-08-09 · Stars = objective metric thresholds only, never participation · measure-don't-flatter
11. 2026-08-09 · Paywall placement: after day-3 progress card; minimal onboarding, never a quiz-wall · Wellspoken's quiz-wall is a documented resentment point
12. 2026-08-09 · Supply layer: one word/phrase upgrade per rep from user's own transcript → personal lexicon · Wellspoken users' most-praised feature; measurement + supply = coaching
13. 2026-08-09 · Boss modes (Cold Topic, Debate, Hostile Q&A) are premium weekly content, not the daily loop · protects the 5-minute habit
14. 2026-08-09 · No pay-to-win; freezes capped at 2 equipped · currency buys convenience and challenge, never truth
15. 2026-08-09 · Accounts: Supabase auth, anonymous-first — rep 1 before signup, gate at "save progress" · quiz-wall lesson applied to auth
16. 2026-08-09 · XP = effort currency (reps, boss/mod multipliers) feeding weekly ~20-person leagues; stars remain the ONLY quality signal; XP unbuyable · leaderboard rewards grinding without corrupting scores
17. 2026-08-09 · History = training-log layout (design direction B); free 7 days, premium full archive + comparison cards
18. 2026-08-09 · Ethos Index /1000: 8 dimensions, two tiers — measured (Pause 150, Fillers 150, Pace 100, Range 100) + judged (Structure 150, Credibility 150, Engagement 100, Confidence 100) · the score IS the brand ("your Ethos"); big denominator makes progress visible
19. 2026-08-09 · Judged scores must cite ≥1 quoted moment/timestamp or the LLM output is rejected and re-run; Credibility and Confidence get deterministic anchors (hedge/restart counts) · no-horoscope rule enforced in schema, not just prose
20. 2026-08-09 · "Entertaining" folded into Engagement · same underlying behaviors; separate scores would double-count
21. 2026-08-09 · WPM zone: 130–160 = "in the zone", below = "strolling", above = "sprinting" · aligned to the Index pace dimension (mechanics.md); one zone everywhere
22. 2026-08-09 · Pause bar rendering: composed (pre-sentence) held pause = amber pill; mid-sentence held pause = stone pill; beats = dots; speech = ~2s ticks · amber stays earned-only — mid-sentence silence is shown, not celebrated
23. 2026-08-09 · Coach layer is best-effort: LLM output that fails voice/grounding validation retries twice then falls back to a deterministic coach line built from metrics · the numbers are the product; the LLM never blocks or invents them
24. 2026-08-09 · Engine LLM: claude-opus-5, strict JSON schema, low effort, server-side refusal fallback · one call per rep; latency inside a ≤5-min loop

25. 2026-08-09 · Bottom nav = Today / Path / Log / You, label-only, hidden on the floor and marketing · icons would compete with the one terracotta tap; the rep screen stays undistracted
26. 2026-08-09 · Streak: a day counts once; today keeps yesterday's streak alive but 'at risk' until the rep lands · loss-aversion framing allowed, guilt is not — no sad mascot, no shame state
27. 2026-08-09 · XP curve: each level costs 50 more than the last (L2 50, L3 150, L4 300) · first level-up inside week one at 10 XP/rep, then a real grind; calibrate in beta
28. 2026-08-09 · Unit unlocks gate on cumulative stars (Pace 4, Pause 8, Cold Topic 12) · progression earned by measured quality, never by attendance
29. 2026-08-09 · Achievements name the number that unlocked them · a badge without a number is a participation trophy
30. 2026-08-09 · Insights are pure arithmetic over stored reps, never an LLM call · cross-rep claims must be as checkable as single-rep ones
31. 2026-08-09 · Free tier: 7 days of log, 3 lexicon entries; premium unlocks archive, boss modes, full pause analytics · mechanics.md monetisation, paywall still only after the day-3 card
32. 2026-08-09 · Audio replay marks fillers and held pauses on the timeline, tap to seek · the user hears the evidence instead of taking our word for it
33. 2026-08-09 · Service worker caches shell + assets; /api/analyze and Supabase never cached · a rep that can't reach the engine fails honestly rather than showing stale numbers
34. 2026-08-09 · One celebration moment per rep (streak count, amber, ~2s, dismissible) · Demos celebrates there and nowhere else in the loop

35. 2026-08-10 · "Frame" step ships as an opt-in setting, 30s, OFF by default · moved up from the open queue; trains think-before-speak without taxing the ≤5-min loop for people who don't want it
36. 2026-08-10 · Boss: free gets this week's Cold Topic once; premium unlocks the library (any topic, any time) · keeps DECISIONS #13's intent — premium buys depth and repeats, not the first taste; a locked button nobody can press is not a monetisation strategy
37. 2026-08-10 · Stress mods multiply XP, never stars · corrects the original stress-mods note, which contradicted #10 and #16 — difficulty buys effort credit, quality stays measured
38. 2026-08-10 · Freezes are EARNED (one per full week of streak, 2 max), auto-spend on the gap, and bridge a day without counting toward the streak · money never buys streaks; a frozen day protected you, it didn't train you
39. 2026-08-10 · A freeze is only spent when it can close the WHOLE gap · half-bridging leaves the streak broken anyway, so spending would be theft
40. 2026-08-10 · Boss accuracy = coverage of ground truth − penalty for wrong claims (18 confident, 6 hedged) · arithmetic over cited verdicts, so the number is re-derivable from the stored report; hedging a wrong claim costs less than asserting it
41. 2026-08-10 · The server recomputes mods and the XP multiplier from the account's entitlement; the client's claim is advisory · a hand-edited URL can change how hard your rep is, never what it pays
42. 2026-08-10 · Settings names the reminder's real scheduling tier (OS-scheduled / tab-only / unsupported) · a reminder that silently never fires is worse than no reminder

43. 2026-08-10 · The path lives on the first screen, directly under the rep card · Amabile & Kramer (12,000 diary entries): nothing moves motivation like visible progress in meaningful work. The Floor keeps its one dominant action; the rail answers "where am I" underneath it
44. 2026-08-10 · Milestones are ordered by PROXIMITY, nearest first, always with an exact "N to go" · goal-gradient — perceived closeness is what raises effort, so the ordering is the feature, not a detail (asserted in tests)
45. 2026-08-10 · Endowed progress via one honest pre-filled node ("Showed up"), worth zero stars · Nunes & Drèze 2006 got 34% vs 19% completion with a head start customers could see was free — the reframe from "not begun" to "underway" does the work, not concealment. No free stars, ever
46. 2026-08-10 · Every reward names the number it measures — a milestone with no number does not ship · SDT gamification meta-analysis (35 studies, ~2,500 people): rewards lift motivation when INFORMATIONAL, undermine it when controlling, and did not improve competence satisfaction at all. Hattie & Timperley rank self-level praise among the least effective feedback. Reward often; never reward emptily
47. 2026-08-10 · Perceived progress must never exceed real progress · rejected the "hook them even if it isn't real" framing after the research pass: fluency illusion raises felt learning without raising learning, and for a speech gym the illusion is discovered in public. Also protects the comparison card, which works because both recordings are real (docs/progression-research.md)

## Open queue (research-once, decide, move up)

- Currency name — after launch copywriting pass
- Star thresholds per unit — calibrate on real beta recordings
- Exact pricing — one research pass vs Elevate/Yoodli/Duolingo Super AUD pricing
- PWA vs native wrap (Capacitor) — decide after engine works; mic reliability is the deciding factor
- Stress-mod pricing/earn rates — after economy exists
- ~~Demos pose set~~ — DELIVERED 9 Aug (assets/demos-{speaking,celebrate,listening,asleep,workout}.png). Speaking is live in the results coach bubble; the rest wire in at their step-3 moments (celebrate = streak/star, asleep = missed-day, listening = recording), never as furniture
- Landing page symptom-first headline — write 5, test on the persona
- ~~"Frame" step before recording~~ — DECIDED 10 Aug as #35 (opt-in, off by default)
- Upload real recordings (meetings) — post-MVP
- Payment processor — the `profiles.premium` flag is the only gate; wiring Stripe is a webhook that sets one boolean
- Crowd-noise realism — synthesised café bed ships now; revisit only if dogfood says it doesn't distract
