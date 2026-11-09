# Open straight into speaking (#431): before and after

Today and the recording screen Start opens, as a returning tester sees them on Monday 9 Nov (test day 8), from `comeback/today.md`'s scenes: free and Premium with the streak alive or broken, back after four days away, a non-tester, and a day already spoken. 390x844 light and dark, 375x667 light, and the recorder under an iPhone's user agent (iOS 18.7 Safari). Camera: `scripts/look-comeback.mjs` (`before/` on c134ec8, `after/` on this branch's production build). Counts are in each folder's `report.json`.

## Counts, 390x844 light

| | Before | After |
|---|---|---|
| Today, tester, first screen: words | 44 | **39** |
| Today, tester, first screen: taps | 5 (You, the tactic, Start, spin, difficulty) | **3** (You, Start, Another topic) |
| Choices on Start's row | 3 | **1** |
| Today, non-tester, first screen: words / taps | 42 / 8 | 30 / 6 |
| Recorder before Record, iPhone: words / taps | 44 / 7 | **23 / 3** |
| Recorder before Record, desktop (Video available): words / taps | 36 / 7 | 25 / 5 |
| Words read before the mic, tester on an iPhone | 88 | **62** |
| Taps from opening Today to the first second of recording | 2 (Start, Record) | 2 (Start, Record) |
| The reminder's door | bare `/rep`: the road's "Argue that one everyday habit is underrated", 43 words | Today's own topic, ready: 25 words (23 on an iPhone) |
| Already spoke today: Today | 43 words, 6 taps | unchanged |
| Already spoke today: recorder on an iPhone | 42 words, 7 taps | 32, 5 (the greyed Video half is gone) |

The after first screen, word for word: "T 35 6 Test day 8 of 14 Hi, Timothy Today's practice About 70 seconds The last time you were genuinely nervous Start Another topic Tester 0B5E 7A21 Speak today, then answer both questions. 6 of 14 days spoken". The ready recorder on an iPhone: "Today Today's practice The last time you were genuinely nervous Pause after the full stop Record This one keeps a 6-day streak alive".

Timings are in the reports but are not comparable: `before/` ran on a dev server, `after/` on a production build (the dev server kept failing a Next dev invariant mid-run).

## Five differences, after against before

1. **Start's row.** One 48px terracotta pill across the card, where it shared the row with two 48px glass circles. Spin is now "Another topic", 15/600 text in the card's ink, 44px tall, under Start.
2. **Beside the object.** "About 70 seconds" (13/600, white at 90%) under the lead, where the trait chip and the two-line tactic were. The band between it and the topic is the card's stage air: the same band the recording screen's topic card has.
3. **Card height.** 376px to 416px on an open day; the roulette keeps 416 with its way back in the link's slot, so opening it moves nothing (strip: `docs/look/strips/comeback-another-topic-light.png`; before that fix it cut 40px).
4. **The greeting.** "Welcome back" on a return, 34/800, in the same measure "Hi, Timothy" had; no name, because the name does not fit beside the rising object.
5. **The recorder.** The do-line heading and two tactic tiles gone; the card grows from 300 to as much as 440 to take the room; on an iPhone the Voice/Video pair is gone, so Record is the only control under the tactic.

Fixed in the loop: the cost line's ink (78% to 90%), the roulette's 40px cut, and the ready recorder's two empty bands (125px and 150px of ground, now the card's).

## The #430 review (9 Nov)

The `after/` shots were re-shot on the review's build; the five lines above describe the #431 build, and these correct them.

1. **Card height.** The open-day card is 376 again, not 416: the object zone's foot rises 40px on an open day, so the topic rises 40px into the band under the cost line, and the tester's road and its dates clear the nav glass at 390x844 and 393x852 (they sat under it at 738 to 762). The roulette holds 376 too, with its way back inside.
2. **The greeting.** "Hi, Timothy" at 34/800 every day. The return's welcome is the card's lead, "Welcome back" in "Today's practice"'s place. (The line above said "34/800"; what rendered was 29 at 390, 28 at 375, 32 at 430, and the name never survived.)
3. **The recorder.** The ready card takes the room up to 480 (Record 52px under the tactic at 390x844, the band over the card 37), its topic in Today's 40/800 on the same lines as the card that was tapped, and its object in a box up to 160, about Today's size, where it was 26px words and a 112px object in 440px of colour.
