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

## Open queue (research-once, decide, move up)

- Currency name — after launch copywriting pass
- Star thresholds per unit — calibrate on real beta recordings
- Exact pricing — one research pass vs Elevate/Yoodli/Duolingo Super AUD pricing
- PWA vs native wrap (Capacitor) — decide after engine works; mic reliability is the deciding factor
- Stress-mod pricing/earn rates — after economy exists
- Demos pose set (celebrate/listen/asleep/speaking) — generate from Higgsfield ref when step 3 needs them
- Landing page symptom-first headline — write 5, test on the persona
- "Frame" step before recording (30s think time, optional notes) — trains think-before-you-speak; decide after dogfood
- Upload real recordings (meetings) — post-MVP
