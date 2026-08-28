# Ethos, functionally complete, visually blank

A brief for a ground-up visual design pass.

You are designing **Ethos**, a shipped, working product. Everything below
is product law or shipped behavior: the mechanics, the numbers, the flows,
the copy voice. What has been deliberately withheld is every trace of how
it currently looks. No palette, no typefaces, no shape language, no
existing layouts, no mascot art. Treat this as a real product whose first
visual designer never existed. You are that designer.

Two ground rules for the pass:

1. **Mechanics are law.** Nothing in sections 1 to 4 is up for redesign.
   Your work is the visual and interaction skin over these exact behaviors.
2. **Where this brief names a meaning (an "earned" accent, "one tap per
   screen"), the meaning is required and the rendering is yours.** Hues,
   faces, shapes, motion, illustration style: all open.

---

## 1. What Ethos is

**A daily gym for speech.** Five minutes of practice a day until speaking
clearly under pressure is a trait, not a performance.

Most people can speak but can't command: can't hold a pause, can't
compress a thought into one clean sentence, can't think out loud without
filler. Courses teach theory, coaches cost $150/hr, nobody offers reps.
Ethos is the reps.

**The user, as a person:** ambitious, 16 to 28, self-improvement driven.
Trains their body, manages their money, listens to podcasts, and has
noticed their speech doesn't match their ambition. No presentation next
week; a daily gap between who they are and how they sound. They
self-diagnose. The product never has to convince them the problem exists.

**Platform:** mobile-first web app (installable PWA). Light theme is the
default; a full dark theme exists behind a System / Light / Dark toggle.

**Positioning:** a gym, not a classroom. A coach, not a guru. Format is
the differentiator: daily, streak-driven, gamified practice, with the
only engine anywhere that scores silence as a skill.

**Headlines (locked copy):** "Practice being worth listening to." on
acquisition surfaces; "Earn the room." on hero, onboarding and merch.

**North star:** day-14 retention. The day-1 versus day-N comparison card
is both the core retention asset and the core marketing asset, same
artifact.

**Mascot:** Demos, a red panda. He appears at moments and is never
furniture: listening while you record, celebrating at the streak moment,
asleep on a missed-day state, speaking when he asks you questions. His
art style, proportions and rendering are yours to invent.

## 2. Hard laws

Any design that breaks one of these is wrong, however good it looks.

- **No manufactured insecurity.** Never tell users they're inadequate or
  invisible. They know their gap; the job is reps, not fear.
- **No manosphere language.** No "alpha", "high-value", "dominate".
- **No guru energy.** The coach cites numbers, not vibes.
- **No horoscope feedback.** Every claim on every screen traces to a
  timestamp or a number. If it can't point at a moment, it isn't said.
- **Measure, don't flatter.** Honest scores beat encouraging lies. The
  user respects hard mirrors.
- **Perceived progress never exceeds real progress.** No fake momentum,
  no decorative progress bars.
- **No pay-to-win.** Money and currency never buy stars, streak length or
  score points. The numbers are the product; the store sells convenience
  and decoration only.
- **Loss aversion allowed, guilt banned.** "Streak ends in 3h" is fine.
  Sad mascots, shame states and "you're falling behind everyone" are not.
- **One primary action per screen.** Exactly one control per screen wears
  the action accent. Everything else recedes.
- **Daily loop is five minutes or less.** Any surface that bloats it loses.
- **One celebration per completed recording** (the streak moment, about
  two seconds, dismissible). Never a second one.
- **The word "confidence" never appears in copy.** (The trained thing is
  named instead: steadiness, composure, command.)
- **Honest states.** "Nothing yet" and "didn't load" are different
  screens. A number that couldn't be read renders as a dash, never a
  zero. A skeleton always resolves to content, empty, or error.

## 3. The numbers (the product's cast)

Numbers are the hero of every screen. The full inventory:

### The Ethos Index, out of 1000

The composite score: "Your Ethos: 612." Big denominator so small progress
is visible (+12 feels real). Nine dimensions in two integrity tiers;
weights sum to exactly 1000.

Measured tier (deterministic, from timestamps and transcript, free and
unlimited):

| Dimension | Weight | What it measures |
|---|---|---|
| Pause | 150 | Placement of silence: a pause before a sentence is composure, inside one is hesitation |
| Fillers | 100 | um, uh, like, you know: rate per minute, with locations |
| Self-corrections | 50 | Abandoned and restarted sentences |
| Pace | 100 | Distance from the 130 to 160 words-per-minute zone, plus variety |
| Range | 100 | Vocabulary breadth, repeated phrases, crutch words |

Judged tier (AI-scored against criteria; every score must cite a quoted
moment or timestamp; metered at 1 free per day, rollover cap 3, unlimited
on premium):

| Dimension | Weight | What it measures |
|---|---|---|
| Structure | 150 | Clear opening claim, ordered points, an ending that lands |
| Credibility | 150 | Specificity over vagueness; hedge words counted, not vibed |
| Engagement | 100 | Hook, imagery, sentence variety, direct address |
| Steadiness | 100 | Restarts, hedges, delivery evenness |

Display rules: each dimension shows its weighted points against its own
denominator (132/150, never 88/100) and the parts sum to the printed
total. Every row is tappable: why this score, the cited moment, one way
to improve. The results screen leads with the Index delta ("+18") and ONE
focus for tomorrow, never a wall of nine numbers.

### Presence, out of 1000 (optional video mode)

A second score beside the Index, same size, never blended into it. Four
dimensions of 250: gesture rate, posture, head stability, eye line.
Computed on-device from pose landmarks; **raw video never leaves the
phone and is never stored**, which is a selling point said plainly, not
fine print. While recording in this mode the user sees their own skeleton
drawn over the camera image: the line between the shoulders IS the
posture number. Video mode is off by default for daily lessons, on by
default for boss modes; the very first recording is always audio only.

### The pause map (the signature artifact)

Every recording renders as a timeline: speech, minor beat gaps, and every
held pause classified by verdict. A pause that landed (before a sentence,
held clean) reads as an achievement; a mid-sentence gap, a pause with a
filler leaning on it, or dead air past 3.5 seconds is shown as neutral
fact, named with a timestamp, never celebrated. No competitor has this
artifact. Audio replay marks fillers and held pauses on a scrubber; tap a
marker to hear the moment. The transcript is always open on the results
screen, never behind a disclosure.

### Stars, 1 to 3 per lesson

Objective metric thresholds, never participation. A substance gate caps
stars on near-empty answers, and below the floor the state is "Not enough
to score", not a low score. Star totals open the gates between units.
Replayable for better stars.

### Streak, freezes, day counter

- **Streak:** advances on any completed recording, one count per day.
  Today shows "at risk" until the day's recording lands.
- **Freezes:** earned one per full week of streak, also buyable with
  coins, maximum three equipped. Auto-spent to bridge a missed day; a
  frozen day bridges the streak but never counts toward it.
- **Day counter:** "Day 12", distinct days you spoke. Never resets, only
  climbs; the kind number beside the streak's sharp one. Rendered with a
  short trail of recent days, each day marked spoken / frozen / missed,
  with a "best day yet" marker when today beats the record.

### XP, levels, coins, traits

- **XP:** effort currency, per recording; boss modes and stress mods
  multiply it. Feeds levels. Never buyable.
- **Coins:** one per day you spoke, however many recordings. Spent in the
  shop on streak freezes and Demos poses. Nothing more.
- **Traits:** the nine Index dimensions as levels on the profile. Each
  recording's single best dimension levels up (+1 at 70% of its points,
  +2 at 90%). Ranked bars, best first, leader highlighted. They gate
  nothing and buy nothing: a mirror, not a currency.

### The supply layer (personal lexicon)

Measurement tells you what to remove; supply gives you what to say
instead. Each judged recording offers exactly ONE upgrade drawn from the
user's own transcript ("you said 'really good' three times, try
'compelling'"). Swaps accumulate into a personal lexicon on the profile,
with a flash-review drill beside it. Free tier keeps the three latest;
premium keeps the archive.

### Tomorrow's focus

Chosen by per-skill decay (what you're about to lose), and the reason
always names the number. One focus. Not five.

## 4. Flows

### First run (no quiz, ever)

1. **Welcome:** three swipeable screens introducing the product, plus a
   quiet "I already have an account". No questionnaire, no paywall.
2. **Lesson one, "The baseline":** audio only, mic permission asked at
   the moment of use with one plain priming sentence.
3. **Results:** the score carries a baseline frame in the delta's slot:
   "Day 0. Every recording after this has a number to beat."
4. **Save-progress soft wall** (the product is anonymous-first; the
   account ask comes only AFTER value exists): stakes the just-made
   numbers, primary "Save my progress", quiet "Not now" that continues to
   exactly where the user was going. Shown once more at streak 3, then
   never again. A standing one-line notice on home ("N recordings live
   only in this browser · keep them") for those who declined.
5. **When-plan:** on the way out of the first results, a one-tap
   morning / lunch / evening choice arms the daily reminder and only then
   asks notification permission.

### The daily loop (the sacred five minutes)

Home → today's lesson (its technique shown before recording, mapped to
what the engine measures) → record 60 to 90 seconds → results → done.

Recording screen behaviors that need design:

- A live ring around the record surface plus a level meter driven by the
  actual mic: something on screen must visibly move with the voice
  whenever the mic is hot.
- A live "hold" counter: seconds the ring has stayed clean, reset to zero
  by any nudge. The screen's one positive live signal.
- Nudges (too fast, filler burst) appear as brief line changes, never
  mid-sentence interruptions by the coach.
- Timed tips: one short line at the natural arc points of a recording
  (opening, middle, last stretch), 42 characters max, yields to a nudge.
- An optional "frame" step (30 seconds of think-time with notes that
  disappear when the clock starts), off by default.
- A topic roulette: "Not feeling it? Spin a new topic". The spin replaces
  the lesson card; choosing while deciding is quiet rehearsal.

Results are a walked sequence, one screen at a time, no exit until the
last: **score** (Index delta + the one focus + one metric-traced strength)
→ **numbers** (the dimension list, pause map, filler locations, pace) →
**words** (open transcript with tappable fillers, audio scrubber, the
lexicon swap). The walk always ends on something true and good, then
"Next lesson": momentum spent on the next thing, not a link home.

### The path (progression)

A single winding road of lessons down the home screen, under today's
card: 29 lessons across six units (Filler Elimination, Pace Control, The
Pause, Structure, Compression, Thinking Under Fire). Unit boundaries are
doors: closed until a cumulative star total opens them, captioned with
the exact distance ("opens at 16 stars · 4 to go"). Locked lessons stay
visible but dimmed past the door. One pre-filled node ("Showed up",
worth zero stars) so the road never reads "not begun". The current
node and the today card serve the same recording: one action, two
handles. A boss checkpoint sits mid-road. The road ends on its honest
length ("29 lessons... about 4 weeks").

### The weekly layer (boss modes and tools)

- **Cold Topic (boss):** a spinning wheel assigns an unfamiliar topic
  (free: the week's headliner plus two re-rolls; premium: spin freely or
  pick from a searchable library of 50+ topics). Lobby → timed research window where the
  study sheet lives (the cold open is the point) → 90-second explanation
  from memory → scored on delivery AND accuracy, with each claim quoted
  and marked true, hedged, or wrong.
- **Hostile Q&A (boss):** a 60-second take on an arguable claim, then
  Demos asks two skeptical questions that quote the user's actual
  argument, then a verdict: held / answered / composed. Adversarial,
  never abusive: the AI challenges arguments, never the person.
- **Tools tab:** Q&A (interruption mid-take), Speed rush (30-second
  timer), Interview (classic questions), plus upload-and-analyze (any
  audio file through the same engine). All real recordings through the
  real engine; a game debrief ends as a game ("Another round"), never a
  shove onto the path.
- **Stress mods:** opt-in difficulty on any lesson (crowd noise, tight
  timer, interruption, no notes) for an XP multiplier. Stress is chosen,
  never imposed.

### Money

Freemium. Free: the daily loop, path, streaks, measured metrics, one
judged analysis a day, 7 days of history, 3 lexicon entries, the week's
boss once. Premium: full pause analytics, full history plus comparison
cards, the lexicon archive, all boss modes at will, unlimited judged
analyses, the Presence score and trendline. The paywall appears after the
day-3 progress card, never at install, never behind a quiz. Annual is the
pushed plan. The paywall sheet is the most premium material in the
system, the same surface the score card wears.

The shop (coins only, never money): streak freeze at 14 coins, three
Demos poses at 8/8/12. Buy buttons never wear the action accent: the
price is the argument, the button is a door.

## 5. The screens

Ground truth from the shipped app. Copy in quotes is real and current;
keep its voice even where you rewrite it. "The one action" names the
single control per screen that wears the action accent.

### Shell

- One mobile column (~430px max), installable PWA.
- Bottom tab bar, four tabs: **Today** (home), **Tools**, **Log**, **You**.
  Icon plus label. The tab bar hides on focused flows: recording, bosses,
  onboarding, auth, marketing pages.
- Recordings that fail to upload wait in a local outbox and re-send
  silently on reconnect; error copy promises this ("The recording is
  saved on this device") and the app keeps the promise.

### Home ("the floor")

Job: hand the user the floor. One dominant lesson card, the standing
score, the whole path beneath.

- Wordmark; header chips: total stars (hidden at zero) and the streak
  badge ("Day 1 starts today" at zero; "{n} days" plus an "at risk"
  dimming until today's recording lands).
- Conditional banner when a freeze auto-spent: "A freeze covered 2 days
  you missed. The streak held."
- Eyebrow over the lesson card: "Today's lesson · The Pause" (or "Extra
  lesson" once today is done), plus a one-line reason naming a number:
  "Fillers scored 62/100, down 8 on the one before, and it's been 3
  days, your weakest right now." After an absence, the decay note: "5
  days since you spoke: about 39% off every score by now. One lesson
  re-measures it."
- **Lesson card:** title, prompt, Demos in the corner (the equipped shop
  pose; celebrating once today's recording is done). The one action:
  "Take the floor" (later "Go again").
- Under it: "Not feeling it? Spin a new topic" swaps the lesson card for
  the roulette (shape label like "Take a side", prompt, Spin, "Take this
  one", a back link). "Make it harder" opens the stress-mod picker.
- **Score card:** "Your Ethos" with the last Index /1000, delta since
  day one (direction-aware), recordings count, stars count, and the day
  trail: one dot per recent day, spoken / frozen / missed each distinct,
  caption "Day 12 of speaking", a "best day yet" marker when earned.
  Hidden entirely on day zero.
- Anonymous notice, one quiet line: "6 recordings live only in this
  browser · keep them".
- **The road:** the whole path as a winding vertical line of lesson
  nodes. An endowed first node ("Showed up", zero stars), star counts on
  cleared nodes, the current node ringed (it launches the same recording
  as the lesson card), a boss checkpoint mid-road, unit gates drawn as
  doors with exact distance ("opens at 16 stars · 4 to go"), locked
  lessons visible but dimmed past the door, and a closing card: "29
  lessons, end to end. About 4 weeks at one a day."
- States: the lesson card paints instantly (local data); the score card
  skeletons while loading; a failed read shows "Your score didn't load.
  The server didn't answer. Your recordings are safe." with retry, and is
  never confused with the day-zero state.

### Recording

Job: deliver one configured prompt, capture 60 to 90 seconds.

- Idle: back link, unit label, lesson title, prompt, mod chips with an
  "×2 XP" badge, Voice / Voice + Video toggle (from recording 2 on; the
  first is always audio and says so), "How to do this one" with three
  numbered technique tips, an anticipation card naming what this
  recording is about to earn ("This one keeps a 6-day streak alive"),
  the length line ("60 to 90 seconds. Pauses score in your favor."),
  a consent line ("Audio uploads for scoring; your camera never does"),
  and the one action: a big round **Rec** button.
- Optional frame step (off by default): 30-second think countdown, shape
  tips, a notes field, "They disappear when you record. You can't read
  and speak at once.", and "I'm ready".
- Recording: timer "m:ss / 1:30" (30s cap with the tight-timer mod;
  urgent treatment in the last 10 seconds; hard stop at the cap), a
  ~36-bar live level meter moving with the actual mic, one timed tip at
  a time ("Start with one beat of silence." / "An 'um' coming? Close
  your mouth." / "Last line is the one they keep."), each yielding to a
  live nudge. Voice mode shows listening Demos. Video mode shows a
  mirrored self-view with the user's own pose skeleton drawn over it, a
  live ring (clean vs nudge), nudge notes ("Eyes down", "Sinking",
  "Hands out of frame"), and a "holding 12s" counter that appears after
  4 clean seconds and resets on any nudge. The interruption mod cuts in
  once, mid-take, with a Demos card: "So what?" / "Says who?" / "Give me
  an example."
- Analyzing: "Scoring…" / "Transcribing, counting, measuring silence." /
  "Ten seconds or so. The numbers are computed, not guessed."
- Errors: a designed mic-permission helper (why, browser-specific steps,
  "Check again"); scoring failures keep the audio and offer "Score it
  again" with the same recording, auto-retrying when back online.

### The results walk (three forced steps)

Header "Lesson complete" with a "+1" coin chip when earned, a
three-segment step bar. No exit until step three.

1. **The score:** a gains row of chips ("+2★ · 4 of 45 stars", "+31
   Ethos · 612 → 643", "6-day streak · kept alive", "Compression
   unlocked"; drops shown, not hidden). The big count-up Index with "▲
   +31 since last time" (recording 1 instead: "Day 0. Everything after
   this has a number to beat."). Stars of three. A trait line
   ("Structure leveled up · 118/150"). The Demos coach card: coach line,
   "Tomorrow: {focus}", "Kept: {strength}", footer "AI-generated
   feedback". Boss recordings add the accuracy card; video recordings
   add the Presence score at the same size as the Index. When the judged
   tier is metered out: "Measured, not judged." with "It still counted
   toward your streak." When the substance gate fails: "Not enough to
   score." and one star, nothing measured, no fake zero.
2. **The numbers:** the pause map with its verdict legend ("landed a
   point" / "searching") and a headline sentence; the dimension list
   ("Every dimension · tap for why"), each row expanding to the cited
   moment and "↳ one way to improve", footer summing the rows to the
   printed Index; three stat tiles (WPM with "in the zone" /
   "sprinting" / "strolling", held pauses, length); every filler with
   its timestamp.
3. **Your words:** the supply card ("Supply · one upgrade, yours to
   keep": original struck through, the upgrade, a note), the full open
   transcript, the audio scrubber (tappable filler ticks, held-pause
   bands, "Tap a word to hear the moment"), records broken ("Best Ethos
   yet", "Most silence you've held"), a closing note that is always true
   and good ("5 composed pauses. Silence you chose, before a new point.
   That's the hard one."), tomorrow's focus with the number that chose
   it, and one-tap reminder chips ("Tomorrow · when?" Morning / Lunch /
   Evening) that arm the notification and only then trigger the OS
   permission ask.

The one action on step three: "Next lesson · {title}". Secondary:
"Retake this one", "Done for today". Game recordings end as games:
"Another round", "Back to Tools". The streak celebration overlays once
here: celebrating Demos, the streak number, one line ("Day one is the
hard one. It's done." / "7 straight. That's not motivation any more,
that's a habit."), auto-dismissing in about two seconds.

Exits may interpose the **save gate** (anonymous users, after recording
1 and once more at streak 3): the just-made Index large, "Day 1 is on
the board.", the honest stake ("This recording, its score and the streak
it starts live in this browser and nowhere else."), primary "Save my
progress", quiet "Not now" that continues to wherever the user was
going.

### The log (history)

Job: the training log. Proof over time.

- "The log" and "{n} recordings. Tap one for the full result."
- Sparklines for the Index and fillers/min (direction-aware: falling
  fillers read as improvement), "first · 512 / now · 643", "+131 since
  day one". Below two data points: "Two scores and this becomes a line.
  One more to go."
- "What the numbers say": derived insight cards, pure arithmetic
  ("'like' is 46% of your fillers", "Most fillers land in the opening
  third", "You speak cleanest around 9am", "Your floor is rising, not
  just your best day").
- A filler heatmap across the arc of a recording plus a top-words tally.
- The comparison card (two or more recordings): day 1 → day N rows for
  Ethos, fillers/min, words/min, held pauses, footer "34 recordings.
  Every number measured, none awarded." Deliberately screenshot-shaped;
  a share variant renders it as a 1080×1920 image with "DAY 1 → DAY 34".
- "Every recording", newest first: date, Index, stars, "{n} fillers ·
  {wpm} wpm · {held} held · {len}s". Rows open the stored recording
  (everything from the walk on one scroll, plus playback; never video,
  which only ever lived on the device).
- Free tier shows the last 7 days; "12 older recordings archived.
  Unlock full history" opens the paywall.
- Empty state: sleeping Demos, "Nothing logged yet. One recording and
  this becomes a training log.", one action: "Take the floor".

### You (profile)

Job: everything earned, one place.

- The page's only card: level, editable display name, Demos avatar,
  total XP, progress into the next level. Below it, bare stats on the
  ground: streak, longest, this week's XP.
- Traits: the nine dimensions as ranked bars, best first, leader
  highlighted, unleveled dimmed.
- Coins: balance, "1 a day", progress toward the first 14-coin item,
  "Open the shop". A failed read shows a dash, never zero.
- Freeze slots: three, filled or empty, "{n} more days earns one."
- The lexicon: original → upgrade rows, a flash-review drill from three
  entries up ("You said this. What did you swap it for?"), free cap of
  three with "{n} more upgrades in your archive" opening the paywall.
- The badge shelf: "Earned 4/10", ranked easiest to hardest, no tier
  labels (position is the claim), every badge naming its number ("Clean
  run · under 3 fillers a minute") and linking to the drill that
  produces it; unearned rows carry a progress bar.
- Day 1 vs now share card; the anonymous save-progress card when
  relevant.

### Tools

Job: a menu of doors. No primary action on this screen by design.

- A standout headliner: "This week's boss: Cold Topic. A topic you've
  never studied. 4 min research, 90s to explain, fact-checked."
- Rows with an XP-multiplier chip where staged mods apply: Q&A ("Give
  your take. Demos cuts in with a question." ×2), Speed rush ("The
  whole answer in 30 seconds." ×1.5), Interview ("Classic questions,
  answered cold."), Hostile Q&A ("Demos interrogates your take. Two
  questions, no notes."), Upload a recording ("A real meeting or a
  voice memo, through the same engine.").
- Questions are drawn on tap, never listed: the cold open is the
  training.

### Boss: Cold Topic (lobby → research → ready)

- Lobby: "Weekly boss · Cold Topic", "Explain what you haven't
  studied.", record line ("3 taken · best 641"), the wheel showing the
  topic title only (study material is withheld until the clock runs),
  "{n} spins left" for free users, "Pick a topic instead" (premium:
  searchable library of 50+ topics; free: paywall), the mod picker, and
  the weekly-taken state ("It resets Monday, or premium opens the
  library now.").
- Research: the topic, a 4:00 countdown, "What a correct answer covers"
  bullets, a source link, "I'm ready early".
- Ready: Demos in the workout pose, "Notes are gone. Ninety seconds,
  from memory. Wrong claims stated as fact cost more than saying you're
  unsure.", then "Take the floor" into the standard recording screen.
- Boss results add the accuracy card: score, "{n} of {m} points
  covered", each claim quoted verbatim and marked checks out / wrong /
  unverified ("You flagged the doubt, which cost less." when hedged),
  plus a "never mentioned" list.

### Boss: Hostile Q&A (take → two questions → verdict)

- Intro: "Hold a claim while Demos comes at it.", a claim card ("The
  claim · argue either side", re-rollable), "Record my take · 60s".
- While recording: a live level dot and bar that move with the voice
  (the screen's proof the mic is hot), a large seconds-left number,
  listening Demos. Between phases, thinking Demos ("Demos is weighing
  it up.").
- Each question quotes the speaker: "You said: '…'", then the skeptical
  question, and "He's arguing with the take, never with you." Answer
  cap 45s.
- Verdict: three scores of 100 (Held the claim / Answered the question /
  Stayed steady), each citing a session quote with an improve line, the
  take's own speech numbers (fillers, WPM, held pauses, Index), and
  "Your take banked to the log as a recording."
- Free tier: once a week, then the paywall.

### Upload

"A meeting, a voice memo, a run-through from your camera roll. The
engine reads it like anything recorded here." Limits stated up front
(25MB, ~6 minutes, "trim it to the part where you talk"), honest
specific failures, then the full result plus playback. Banks as today's
speaking.

### Shop

- Coin balance ("One coin a day you speak"), four items with art, name,
  price, blurb: the streak freeze (14) and three Demos poses (8/8/12).
- Buy buttons are quiet by design: never the action accent. Owned poses
  switch to "Put it on the card" / "On your card"; the equipped pose
  follows the account.
- Specific failure copy: "Not enough coins yet." / "That didn't go
  through. Your coins are untouched."

### Paywall (sheet)

- Opens only after visible progress or a deliberate tap on locked
  content; its eyebrow names the reason ("Full history · premium",
  "The boss library").
- "The whole gym." and five benefits ("Full pause analytics, the
  silence scores", "Complete history and day-1-vs-day-30 cards", "Your
  whole lexicon, not just today's swap", "Every boss topic, any week,
  plus Hostile Q&A", "Unlimited judged analyses").
- Annual pushed ("billed A$79.99, A$6.67 a month · save 55%"), monthly
  A$14.99. Checkout isn't live: both plans open an invite-code field
  with the honest line "Checkout opens soon. Right now premium is by
  invite code."
- Decline is "Not yet". Standing footer, its one appearance in the app:
  "Money never buys stars, streaks, or scores."

### Welcome (three screens, no quiz)

1. Listening Demos: "You already know the gap." / "The point was in
   your head and the sentence lost it. You need practice, not
   convincing."
2. Speaking Demos: "Sixty seconds a day." / "One prompt, one recording.
   The engine counts every filler, times every pause, and hands back
   numbers."
3. Celebrating Demos: "Earn the room." / "A pause held before a
   sentence scores as composure here. Nobody else measures that."

Progress dots, "Next" then "Take the floor" (straight into lesson one),
"I already have an account" on screen one, "Skip" after.

### Auth

- Signup "Keep what you've earned." / signin "Welcome back." A device
  card stakes what exists ("6 recordings and a 4-day streak."), and the
  signin variant warns that a different account leaves them behind.
  Google button, then email. Sent state: "Check your inbox", from a real
  reply-to address ("That address is a real inbox. Reply to it if
  something looks wrong.").
- Password hint: "Length beats punctuation. A phrase you'll remember is
  a better password than one you won't."

### Settings

Reminder hour chips with the honest scheduling tier spelled out ("Sent
from our server. It rings on this device with Ethos closed." vs "Your
browser can only fire this while Ethos is open in a tab."), quiet hours
(22:00 to 07:00), theme choice, recording toggles (frame step, haptics,
sound, verbatim transcripts with "Off makes it prettier and the filler
count wrong.", reduced motion), account section, JSON export ("Every
recording, transcript, score and lexicon entry. Yours to take."), and
delete with a typed confirm ("There is no undo."). Goodbye state:
sleeping Demos, "All gone." / "The door stays open".

### Marketing landing

"You had the point. It came out fuzzy." → "That's a practice problem."
The daily loop in five beats, the silence-scoring claim, a dark score
panel explaining the Index's two tiers ("a judged score with no quoted
moment is thrown out and re-run"), the named-competitor honesty ("Rehearsal
tools exist. This isn't one."), the camera privacy stance, the refuses-to-be
list, "Take the floor" with "60 seconds. No signup until you've spoken."

### System states

- 404: sleeping Demos, "Nothing here." / "Demos checked. Twice."
- Error boundary: "That screen didn't load. Your recordings are stored.
  Nothing was lost."
- Every failed read names its subject and the user's stake: "Your
  numbers didn't load. The server didn't answer. Your recordings are
  safe." Every page read times out at 8 seconds so no skeleton is
  permanent.

## 6. Voice (write all mock copy in it)

A coach who respects your time. Short declaratives. Second person.
Specific numbers over sentences about consistency: "17 recordings" beats
any line about dedication.

- Yes: "11 fillers today, down from 19. Tomorrow: kill 'like.'"
- No: "Great job! You're on your way to unlocking your true potential!"

Rules for every string you put in a mock:

- Zero em dashes. Commas, full stops and colons do the work.
- As few words as the truth needs. One line beats three; a number beats
  a line.
- At most one negation construction ("X, not Y") per screen.
- No rhetorical fragment chains ("No guessing. Just reps.") outside
  marketing, and at most one there.
- No hype adjectives, no "seamless", "effortless", "supercharge".
- The word is "recording" or "lesson" or "practice", never "rep".
- Don't explain a mechanic that is legible from its numbers and states.
  People know what a streak is. Mechanics text lives where the mechanic
  happens, first time only.
- Clever is a spice: at most one wry line per screen, in earned spots
  (empty states, milestones, welcome).

## 7. Meaning slots your visual system must fill

These semantic roles are locked; every rendering decision inside them is
yours.

1. **The action accent.** Exactly one control per screen wears it. On
   home that is today's recording. Retry buttons, buy buttons and
   secondary actions never wear it.
2. **The earned accent.** A separate, instantly recognizable treatment
   for things the user earned: landed pauses on the pause map, the
   streak, stars, the best-day marker, the leading trait. It never
   appears as decoration and never on anything unearned. (An unearned
   coin is never gold.)
3. **Direction-aware deltas.** A "right direction" and a "wrong
   direction" treatment for changing numbers, per metric semantics:
   fillers falling is good, the Index falling is bad.
4. **The room.** Everything that is neither action, earned, nor delta
   recedes so the numbers stay the hero.
5. **The premium material.** One distinct surface treatment for the
   product's signature moments: the score card and the paywall share it.
6. **Both themes.** Light default, full dark. Accents that carry meaning
   must keep their meaning in both.
7. **Demos at moments.** The mascot's placements are listed in section 1;
   design him and his poses, but never promote him to furniture.

## 8. Quality bar

- Every screen designed in five states: populated, empty (designed, one
  action, never "No data found"), loading (skeleton mirroring the real
  layout, no layout shift when content lands), error (what happened plus
  a retry), and interactive states on every control.
- Results render progressively: measured numbers instantly, judged
  feedback streams in. Design the intermediate state.
- Touch targets 44px minimum; nothing depends on hover; fully keyboard
  operable; text contrast 4.5:1 in both themes.
- Motion communicates origin, causality or success; decoration-only
  motion is banned. Celebrations may run long; everything else is fast.
  Everything collapses to simple fades under reduced motion.
- Confirmation dialogs only for the destructive and irreversible; undo
  for everything else.

## 9. The ask

High-visualization concept mocks, mobile-first, both themes.

**First ring (the product lives here):**

1. Home: today's lesson, the score card (Index, streak, day trail,
   stars), the winding road with its gates.
2. The recording screen, mid-recording.
3. The results walk, all three screens, including the pause map.
4. The training log (history) with a day-1 versus day-N comparison card.
5. The profile: level, traits, lexicon, badges.
6. The paywall sheet.

**Second ring (if the system has more to say):** welcome carousel, boss
lobby with the wheel, Tools menu, shop, the streak celebration moment,
a designed empty state, the marketing landing, dark theme passes of
ring one.

Invent freely: the wordmark, iconography, illustration and mascot style,
the motion language, the celebration. Everything except the mechanics,
the laws, and the voice.
