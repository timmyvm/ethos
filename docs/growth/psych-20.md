# The reel's 20 tricks, the honest way

The reel lists 20 ways apps pull people back and get them to pay. A commenter asked which are good and which are dark. Here is where Ethos stands on each one, what was built (26 Nov), the two calls that are yours, and what we refuse.

The bar every change had to clear: it traces to a number, it is earned, it keeps the day under five minutes, and it uses no fake urgency, fake numbers or fake people. Each of the 20 appears once below.

## Already working

Nothing to build for these five.

- **Price anchoring.** The paywall. The first price anyone sees is A$12.99, the real month 1 charge. Every lower price is a real future month with its date. The anchor is a price people actually pay, never a made-up "was A$29.99".
- **Endowed progress.** The introduction and day one. The bar is full only at the first recording (#501), and the first recording pays each skill real XP (#498). No head start is ever handed out. #47 and closure.md reject the fake kind.
- **Curiosity gap.** The results. The wait shows your words as they arrive, the stars land on goals you saw first, and tomorrow's cue gets answered by your next recording. Every day ends closed. No score is ever hidden to make you come back (closure.md row 16). The dead "open loop" code went in build 6.
- **Status.** You and the Log. Your level, XP, streak, trait levels and best recording all compare you with yourself. The one comparison with other people names its source: "Against published speech research, not other Ethos users." The league stays shelved (#173), since a room of three people says "dead app".
- **Fresh start effect.** Today and Practice. After a break Today says "Welcome back" and never counts the missed days (#431). The weekly boss turns on Monday. A "New week" push was looked at and cut: a calendar label traces to no number (#430's rule) and would reach about one person a week. The dead `freshStart()` code, which said "New week, new league" about a league that doesn't exist, went in build 6.

## Built (26 Nov)

All six are built, merged on one branch and checked together, ranked by how much each should lift return and paying. None needed anything from you, and none changes a price, a plan or one of your calls. Each has its DECISIONS entry, and two extras from the same pass are at the end of this section.

### 1. Miss one day, keep the streak by speaking twice (Loss aversion, FOMO). Built: #518

**What changed.** Someone on a 2 to 6 day streak misses one day and has no freeze. The next day, two recordings of 20+ words cover the missed day. The streak goes on. A day is kept at most once in 7 days, never for a two-day gap, and never for runs of 7 or more, which already earn freezes. An offer nobody takes up keeps nothing, so it can come round again a few days later.

- **Today:** unchanged. "Welcome back", and the flame at its grey 0.
- **Under Record, first recording:** "Two recordings of 20+ words keep a 5-day streak alive"
- **Results after the first:** the tap reads "One more" and records again on the same topic. "Done for today" becomes the quiet link under it, with the line "One more keeps a 5-day streak alive". Only on Today's practice or a topic of your own; lessons, games and the boss keep their own way on.
- **Under Record, second recording:** "One more of 20+ words keeps a 5-day streak alive". It names the 20 words again because a shorter take keeps nothing.
- **Streak screen after the second:** the flame lights on 5 and rolls to 6. The missed day is drawn in the freeze's sky wash with a small mic in it, so a covered day, a frozen day and an open day differ in shape as well as colour, with "Two recordings covered Tuesday." under the week row.

Skip the second recording and nothing changes: at midnight it is the normal break it is today. A capped fourth recording still counts: it has its 20+ words, only no Ethos score.

**One change from the plan, found in review.** Freezes are now earned from the streak you see, with covered days in it. Earning them from the streak without covered days let the app show 7 days and play the 7-day moment while holding no freeze, and the line under Record promised one. So a 6-day run covered on its seventh spoken day earns its freeze that day, as 6 days, a freeze and one more day always has. A covered day is never a freeze spent.

**Starts on:** 27 Nov (`REPAIR_FROM`), so nobody's numbers move on the day it ships. If it lands on main later than that, move the date to the day it lands.

**Why it's honest:** It is earned by work and can never be bought. Like a freeze, the covered day bridges the streak but never adds to it. The deadline is the real end of the day, and it is said only where you record. There is no push, no countdown and no sad Demos. Missing a day still costs a second recording. Your freeze cap (#174) is untouched.

**Why it matters:** This is the spec in closure.md row 14, and it had never been built (#282). closure.md's own warning is that a visible streak with no way back makes a break worse than showing no streak at all: 45% carry on after a break, against 61% with no streak shown. In week one nobody has a freeze yet, so until now one missed day ended the streak.

### 2. The first recording measures what they told us (Commitment and consistency). Built: #519

**What changed.** In the introduction people say what bothers them: rushing, freezing, sounding flat. The plan promises that number. But the first recording is The baseline, whose line spoke about the carried filler cue. Now, on an account's first scored recording only, Demos's line leads with their own concern and its number. The line is the sentence that skill already uses, with its moment to play.

- Rushing: "You said rushing: 184 words a minute." or "You said rushing: 148 words a minute, in the zone."
- Freezing: "You said freezing: 1 of 4 pauses mid-sentence, at ▶0:20"
- Sounding flat: "You said sounding flat: “really” 5 times, first ▶0:12"

Fillers, trailing off, rambling, no answer, a take too short to score and a capped take keep today's line. The cue for tomorrow is still saved for the warm-up; only the glance leaves it out on this one take.

**Why it's honest:** It keeps the app's own promise, with a real number and a timestamp. It asks for nothing new.

**Why it matters:** The biggest drop is right after the first recording: 6 of 21 testers recorded for one to three days, then stopped (#430). A first number about the thing you actually raised is the strongest reason to come back for a second.

### 3. The reminder says yesterday's cue (Loading the trigger). Built: #520

**What changed.** The push used to say "Last time: 4 fillers in 62 seconds.", and then the screen it opened led with a different number, the cue. Now the push body is the warm-up's own two lines, word for word:

- "Last time, “like” 9 times. Pause where “like” was."
- "Last time, 184 words a minute. Pause at every full stop."

The title stays "Your 6 pm practice". With no cue, a cue already answered today, a failed read or a body over 110 characters, it keeps the old words.

**It works now.** The push reads the cue from your account (migration 0034), and 0034 has been on production since 17 Nov, so this changes the push from the day it ships.

**Why it's honest:** It is your own number from your last recording, sent once, at your hour, never on a day you already spoke.

### 4. The paywall and About say only true things (Sunk cost, IKEA effect, Reciprocity, Social proof). Built: #521

**What changed.** Four lines on the screens where people decide to sign up or pay:

- **Paywall, benefit 4:** "Every word you've earned, kept" became "Weekly boss: any topic, any time". Say it better has been free since #507, so the old line sold something free and implied your saved phrases were at risk. The boss line is true: free gets the week's topic or two spins, once a week; Premium picks any topic, any time.
- **Paywall, closing line:** "Money never buys stars, streaks, or scores." became "Money never buys stars, streaks, or a higher score." Since #514 the top line sells "Every recording scored", so the old foot contradicted it.
- **Since day one (day 3):** the tap "Keep every number" became "See Premium", and the sheet opens on its normal headline. Free keeps every recording, so "Keep" implied a loss that isn't real. The true line above it stays: "Free shows the last 7 days and scores 3 recordings a day. Premium opens all of it."
- **About:** under the sample chart, "A sample, three weeks in." became "Example numbers: your line starts with your first recording." The chart says "▲ 48 since you started", which read like a promise.

**Why it's honest:** Every promise on a money screen has to be literally true. A sharp 22-year-old will spot "scored" at the top and "never buys scores" at the bottom. It lands before checkout opens.

**Parked:** putting your own real numbers on About. Your line mixes takes from before and after the 16 Nov pause rescoring (#476), plus test takes, so part of the rise would be the rule change and not you.

### 5. Say the daily limit before the 4th recording, not after (Scarcity). Built: #522

**What changed.** A free user used to record a 4th time and only find out afterwards that it had no score. Now, once this phone knows today's 3 are used, the line under Record says:

"You've used today's 3 scored recordings. Ethos score back tomorrow."

It is grey, with no Premium button. It only shows when the phone is sure (this account, this day, none left, a free plan read); if it isn't sure, it says nothing. On the day after a missed day, the streak line from build 1 wins the slot: a 4th recording is still 20+ words and still keeps the day, so that is the line worth reading. Once the day is kept, the limit line takes its place.

**Why it's honest:** It is a real limit with its real count and reset, said before you spend the take. Hostile Q&A already works this way. No lift is claimed. It just stops a surprise.

### 6. "Most pauses yet" stops rewarding the wrong pauses (Variable reward). Built: #523

**What changed.** On a pausing day, the "Most pauses yet" record counted every pause, mid-sentence ones included. So you could earn it by doing more of the thing Demos tells you to fix. #495 fixed exactly this on the Log. Now the record counts the pauses between sentences that landed: the same number the closing note gives, so dead air past 3.5 seconds and a pause with an um next to it never count. The sheet card says "4 pauses between sentences, past your 3". An older recording with no pause list holds no best, so it never says "past your 0".

In the same file the dead reward code is gone: the near-miss, open-loop and landmark functions, including "New week, new league". A test now fails on any line that says "see your score tomorrow" or "unlock to see".

**Why it's honest:** A surprise reward has to come from getting better, never from getting worse. No randomness is added. Chests stay dead (#89).

### Also built in this pass

- **Say it better counts a free account's 4th recording (#524).** Your call 4, decided yes and built. A capped take now stores a small marker (`dimensions.capped`), and "N of M you now say on your own" counts a saved phrase said in it, with its timestamp, as it counts any scored take. Its results show the proof token too, so the count and the token agree. Takes with no real answer and takes the coach failed to read still don't count. Capped takes from 19 to 26 Nov carry no marker and stay uncounted.
- **docs/vision.md uses the app's own words (#525).** Practice, recording, the practice floor and the weekly boss, all through.

## Your call

1. **Social currency: add a quiet "Share" link to the 7, 14 and 30-day streak screens?** Recommended: not now. You cut the share card on 12 Nov (#458), and the median account has 4.5 recordings, so almost nobody reaches day 7. Ask again when 20 people a week hit 7 days.
2. **The money rule in CLAUDE.md says "money buys cosmetics only", but Premium sells more scored recordings, history, Presence and games (#73, #514). Change it to "Money never buys a number: no star, no streak day, no higher score"?** Recommended: yes. That is what you already decided, and build 4's closing line now says the same thing.

## We won't do

- **Tamagotchi effect.** A Demos with hunger or moods who gets sad when you skip. That is guilt (#26), Demos as furniture, and fake urgency. Your flame, levels and Say it better already grow with care and never punish you for being away.
- **Decoy effect.** A third plan priced to lose so A$12.99 looks good. It is a fake option and would reverse your one-plan call (#377).
- **Framing.** A per-day price such as "43c a day" or "less than a coffee". The figure changes with the length of the month (A$12.99 is 42c a day in January and 46c in February), so it is a number we can't stand behind. "Your price drops every month you stay" is already the honest frame.
- **Identity-based habits.** Labels like "Variety is yours now" after five strong recordings. With today's scoring, most people would get Variety by their fifth recording without changing anything, while almost nobody would get Pausing. That is a flattering label nobody earned. "N of M you now say on your own" in Say it better is already the honest version.

## Housekeeping

- docs/vision.md is fixed (#525).
- The "Held the room" badge counts mid-sentence pauses too. It stays for now, because changing it would take a badge away from anyone who already has it (#523).
