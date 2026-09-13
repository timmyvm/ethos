# Percentiles: where "58th" comes from

How Ethos turns one sixty-second recording into a position against the
general population, what that rests on, and where it is guessing.

Companion to `lib/percentile.ts` (the arithmetic), `content/norms.ts`
(the distributions and their citations) and `lib/norms.test.ts` (the
gate that stops an unsourced one shipping).

> **Status: all five traits are provisional, and that is the finding
> rather than a to-do.** Four researchers read the primary literature,
> one per measurable trait, and came back with the same shape of answer
> every time: the centres are published and convergent, and the
> between-speaker **spread**, which is the half a percentile is actually
> made of, is not. A provisional trait draws its ring's trough dashed,
> says "scale provisional" on its card in words, and cannot be the
> reason a lesson is chosen. Nothing here ships a percentile as fact.

## Why this document exists

A percentile is a claim about everybody else. "You are at the 58th"
asserts that 58% of the population does this worse than you, and the
only thing separating that from decoration is a real distribution behind
it. An invented one would look exactly like a working feature on a
phone, which is why the numbers live in one file with their sources
attached and a test that fails when a source is missing.

The rule this whole document serves: **where the evidence will not
support a placement, say so in the interface, not in a footnote.**

## How the research was done, and what did not finish

Four researchers, one per measurable trait, instructed to read primary
papers rather than summaries, to quote the actual reported values, and
to answer "can Ethos ship a percentile for this honestly" directly. Each
proposal was then handed to a separate auditor with a single job:
**verify every citation exists and says what it was claimed to say**,
redo the arithmetic, recompute the percentile points, and check whether
the population studied matches the population Ethos serves doing the
task Ethos measures. Where an audit disagrees with the proposal, the
audit wins and the disagreement is recorded.

**All four proposals completed. Three of the four audits did.** The run
hit a session limit partway through; the fillers, pace and pausing
audits ran, the pitch audit did not. That is stated here rather than
quietly omitted, because a document whose whole purpose is to be honest
about what stands behind a number cannot be coy about which of its own
checks were performed.

**Auditing was worth it.** Every audit that ran found something the
proposal had got wrong, and in both of the first two the error ran in
the direction of the proposal being more confident than its own
evidence. The fillers proposal claimed no published dispersion exists
for English filled pauses when the paper it says it read in full gives
65 English speakers and a median. The pace proposal built its only
direct measurement on a percentile label its source attaches to
different numbers, and left an 11% correction unapplied that its own
cited source states outright. Neither was catchable by rereading the
proposal. **Read the pitch section as one careful reader's work rather
than two**, and run that audit before anything is built on it.

Read-aloud data used for a spontaneous monologue model is a real
problem, and so is conversational data used for a monologue. Both are
flagged per trait rather than smoothed over.

## The model

Three decisions turn a raw measurement into a position. All three live
in `lib/percentile.ts` and each is tested against independently computed
values.

### 1. Direction

The raw scale is not the health scale. Fewer fillers is better, so the
percentile inverts: a person at one filler a minute is near the top, not
near the bottom.

- `lower` — fewer is better. Percentile = P(population value > yours).
- `higher` — more is better. Percentile = P(population value < yours).
- `band` — there is a middle, and both sides of it are worse.

### 2. Bands

Speech rate has no "more is better". Somebody at 210 words a minute
beats 97% of the population on the raw number, which is true and
useless. So a banded trait is ranked on **distance from the middle of
the band**, and the percentile answers "how many people are further from
the middle than you".

The assumption this buys, stated plainly because it is the shakiest
thing in the model: **it treats the two sides of the band as costing the
same.** Speaking 30 words a minute too slow and 30 too fast score
identically. The literature does not obviously support that symmetry,
and it is the first thing to revisit with real user data.

The band's centre is computed in the space the norm is fitted in, so a
log-normal band has a geometric middle rather than an arithmetic one.

### 3. Shape

A rate that cannot go below zero and has a long right tail — fillers a
minute, pause length — is log-normal, not normal. Fitting a normal there
puts a chunk of the population below zero, and the visible symptom is
that everybody scores above the 50th percentile. `fromMedian(median,
ratio84)` builds a log-normal from the two numbers papers usually
report.

### What the model refuses to do

- **No decimals.** A percentile is rounded to a whole number, because no
  speech norm in this literature supports more precision than that, and
  because "58th" is something a person can hold.
- **No composite percentile from provisional parts.** A blend of five
  numbers is only as honest as its weakest input.
- **No percentile as a grade.** It is a position. Nothing in the
  interface colours it by good or bad, and every card that shows one
  also shows the next concrete move — a bare descriptive norm makes
  above-average people ease off (`docs/closure.md`, the boomerang).

## What Ethos measures, and what it does not

The five traits and the raw number each one reads (`lib/trait-readings.ts`):

| Trait | Raw measure | Source field |
| --- | --- | --- |
| Pausing | landed pauses a minute | `pauses` of kind `pre` |
| Fillers | um and uh per hundred words | `fillers` filtered to `FILLED_PAUSES`, over the word count |
| Restarts | restarts per hundred words | recovered from `dimensions.tier1.repairs`, then re-expressed |
| Pace | words a minute, silence included | `wpm` |
| Variety | distinct words per hundred | type-token ratio of the transcript |

Two of those are **per hundred words rather than per minute**, and that
is a finding rather than a formatting choice. Per minute, the same
speaker saying "um" exactly as often per sentence appears to cut a third
of them by speeding up from 120 to 160 words a minute. It is also the
unit the disfluency literature reports, so it removes a conversion that
would otherwise have to assume a speech rate.

**Fillers means um and uh here, and nothing else.** `fillersPerMin`
still counts *like, you know, sort of, kind of, basically, actually* and
*literally*, and the results screen still shows them with timestamps.
The ring is not drawn from them, because no published rate counts them
and a percentile against a rate that counts a different set of words is
a subtraction, not a position. The Fillers section below has the full
reason.

**Pitch variation is not measured at all.** The brief named it as a
trait to place people on, and Ethos's "range" dimension is *lexical*
(distinct words and repeated phrases), not acoustic. Nothing in the app
computes fundamental frequency today. The section below records what a
pitch model would need and whether it is reachable from a phone
microphone; until it is built there is no pitch percentile, provisional
or otherwise.

**Restarts are recovered, not stored.** There is no `repairs_per_min`
column, so the rate is reconstructed by inverting `repairScore`, which
is exact to about 0.015 a minute and lower-bounded at the floor (a score
of 0 means "three a minute or worse" and cannot say which). The right
fix is a column, and it should happen before any of this reaches a real
user.

## The traits, one at a time

Each section answers one question first: **can Ethos place somebody on
this honestly today.** All five answers are no, and the reasons are
different enough to be worth reading separately: one has no
speaker-level data anywhere, one had the wrong words in its numerator,
one has a single source and no spread, one has the best data in the
review and the wrong band, and one cannot use a published figure at all
because of how its measure behaves with sample length.

---

### Pausing

**Verdict: provisional.** The thresholds are well evidenced. The
placement is not, and the reason is structural rather than a matter of
finding more papers.

**What the evidence gives.** The two decisions under `lib/pause-quality.ts`
are the best-supported things in the engine.

The 0.3 s floor for a beat is right and citable. De Jong and Bosker
tested every threshold from 20 ms to 1000 ms against fluency ratings and
found the correlation rises to 300 ms and then falls, concluding that
250 to 300 ms is optimal and that going higher actively degrades the
measure ([DiSS 2013](https://pure.mpg.de/rest/items/item_1900232_6/component/file_1900231/content),
51 speakers, 10,668 hand-marked pauses). Goldman-Eisler's original
articulatory/hesitation split at 250 ms, Grosjean and Deschamps's 300 ms
floor and Gilden's 250 ms all sit in the same band. 0.3 s is the top of
the defensible range, which is the right end to be at for a phone
microphone where a stop closure can look like silence.

Scoring **placement rather than presence** is the oldest replicated
result in the field, and Ethos reads it correctly. Goldman-Eisler
(1972): 78% of sentence boundaries carry a pause over 0.5 s, against 66%
of clause transitions and 93% of word transitions carrying less.
Grosjean and Deschamps: about 70% of pauses fall at major constituent
breaks ([Grosjean, Grosjean & Lane 1979](https://www.francoisgrosjean.ch/speech_prod/6.%20Grosjean,%20Grosjean%20&%20Lane.pdf)).
Hawkins: 66% of pauses and 75% of pause time at clause and sentence
boundaries, against 10% and 6% inside minor constituents. Redford: 7% of
adult pauses ungrammatical against 18% for five year olds. Tavakoli's 40
natives against 40 learners found the mark of disfluency is not pausing
more, it is pausing **mid-clause**. "Same silence, opposite meaning,
only the boundary tells you which" is not a design conceit; it is what
the literature says.

The duration distribution is log-normal and multimodal, which is settled
rather than assumed. Campione and Véronis state it outright over ~6,000
pauses in 5.5 hours across five languages
([Speech Prosody 2002](http://sprosig.org/sp2002/pdf/campione-veronis.pdf)),
Rose and Watanabe log-transform for the same reason, and a log-normal
fitted from Campione and Véronis's own summary statistics reproduces
their long-pause class weight to two decimals (14.0% against their
fitted 0.14). Anything computed on raw milliseconds will be wrong in a
way that looks fine.

**What it does not give.** Essentially every published pause
distribution is a distribution **of pauses, not of speakers**. A ring
needs the between-speaker spread of a per-speaker summary, and for pause
placement in first-language English that number appears to be
unpublished. The centres are solid and convergent (20 to 22 pauses a
minute across four labs and two languages, about 70% at boundaries); a
centre without a spread cannot produce a percentile.

Three further problems would bite even if that number existed. A
sixty-second recording yields roughly 20 pauses of which about 5 clear
the held line, so a placement ratio of 3 in 5 carries a 95% interval of
something like 15% to 95%: one recording would mostly report luck.
Gilden showed pause length scales with **body height**, explaining 18 to
36% of the variance, so a raw-duration percentile partly ranks people by
stature. And `pauseReport`'s composite is invented here, so no published
distribution for it can exist by definition.

**On telling a rhetorical pause from a hesitation acoustically: no.**
The only published within-pause discriminator is articulatory, not
acoustic: Krivokapić and Ramanarayanan's pause postures, where
grammatical pauses show a significant slowing of articulator movement
*during* the silence and non-grammatical ones do not. That needs
electromagnetic articulometry or real-time MRI of the vocal tract. It is
not reachable from a phone, and no acoustic correlate of it has been
reported. What *is* reachable sits in the ~200 ms **before** the pause:
final lengthening and pitch reset are the published acoustic markers of
a prosodic boundary. That is the route to detecting a boundary from the
signal rather than trusting Whisper's punctuation, which is currently an
unmeasured source of error in the one thing this trait scores.

**What this changes in the app.** One number is loose. The empirical
boundary between the medium and long pause classes is 1045 ms (Campione
and Véronis's second threshold); English between-sentence pauses average
0.98 s in public presentation and 1.01 s in commencement speeches; top
competition speakers run 0.83 to 1.24 s between sentences against 0.42
to 0.67 s within them. At `HELD_MIN_S = 0.8` Ethos calls 24.4% of all
pauses held where the genuine long class is 14%, so roughly a third of
what it scores as a landing is an ordinary boundary pause rather than a
rhetorical one. Two honest options: raise the line to about 1.0 s, or
keep 0.8 s and stop calling it a rhetorical pause in the copy. A
boundary pause is still worth rewarding; it is just not the thing the
word promises. **Not changed yet** — it moves every stored score's
meaning, and that is a decision to make deliberately rather than inside
a documentation pass.

`DEAD_AIR` at 3.5 s is well placed and should stay: the fitted model
puts 0.23% of pauses above it, and Campione and Véronis found pauses
over 2 s make up 2.8% of spontaneous speech and are absent from read
speech. Do not lower it towards Kohtz and Niebuhr's 600 ms tolerance
threshold, which governs how a **response gap in dialogue** reads, not a
silence inside your own sentence.

---

### Fillers

**Verdict: provisional. The measure itself changed because of this
research, and the audit then changed both of the numbers.**

**The blocker was not sample size, it was the construct.** Every
published rate counts filled pauses and nothing else: Bortfeld et al.
2001 ([Language and Speech 44(2)](https://heatherbortfeld.com/wp-content/uploads/2016/09/bortfeld_etal_ls2001.pdf),
~192,000 words, 96 speakers) reports 2.56 fillers per 100 words; Clark
and Fox Tree 2002 ([Cognition 84(1)](http://www.columbia.edu/~rmk7/HC/HC_Readings/Clark_Fox.pdf))
give Switchboard 79,623 fillers in 2.7 million words, which is 2.95 per
100; London-Lund gives 2.30. Ethos's `fillersPerMin` also counted
*like, you know, sort of, kind of, basically, actually* and *literally*.
Placing somebody against one set while measuring the other is a
subtraction between two different quantities wearing the word
percentile.

So `lib/metrics.ts` now reports `filledPauseCount` and `filledPer100`
beside the existing numbers, and the trait reads the second of those
(DECISIONS #260). The discourse markers stay counted and timestamped on
the results screen, because they are real and people care about them.
They are simply not something a position can be claimed about.

**Per hundred words rather than per minute**, for a second reason from
the same review. Per minute rewards talking faster: the same speaker at
120 and at 160 words a minute, saying "um" exactly as often per
sentence, appears to have cut a third of them. Shriberg found filled
pause rate did not correlate with speaking rate, but her faster speakers
produced more false starts and fewer repetitions, so the per-minute unit
lets somebody buy a better filler number with a worse restart number.

**What the audit changed.** The proposal came back with a log-normal at
median 4.53 per 100 words and sigma 0.75. The audit verified all nine
citations exist and match their quoted numbers, redid every calculation
and found no arithmetic error, and then rejected both parameters:

- **The centre was above every English figure the proposal computed for
  itself.** Every rate it derived lands between 2.30 and 2.95 per 100
  words; it then set the centre at 6.0 using the only two figures it
  could not verify. One of those was a secondary report whose unit turns
  out to be a syllable-to-word conversion the proposal separately flags
  as its own unsourced assumption. The other was 5,000 words of 1961 to
  1976 British voicemail, and the same paper contains a better-matched
  English monologue corpus (Pear, 20 Californians narrating a film, 282
  fillers) that the proposal quoted and never divided. **Corrected to a
  median of 3.0, and treated as a ceiling rather than a midpoint**,
  because the English primary cluster centres near 2.5 and the only
  quantified age-on-rate finding anywhere (a parliamentary corpus, IRR
  0.862 per decade) is worth roughly 1.2 to 1.5× for Ethos's band.
- **The proposal's stated reason for provisional status was false, and
  the false part was load-bearing.** It said no published dispersion
  exists for English filled pauses. Section 7.3 of Clark and Fox Tree —
  a paper it claims to have read in full — gives 65 English speakers
  with over 1,000 words each, ranging from 1.2 to 88.5 fillers per 1,000
  words about a median of 17.3. That error was not safe in either
  direction: it licensed borrowing a spread from a Hungarian secondary
  source, and the borrowed value was the **floor** of what the English
  data supports. **Corrected to sigma 1.0.** A too-narrow spread pushes
  everybody toward the tails and makes every placement more confident
  than the evidence allows.
- **The monologue-versus-dialogue direction is undetermined, not
  three-to-one.** The proposal framed one dissenter against four. The
  audit found a second independent source on the dissenting side inside
  a paper the proposal had read (Broen and Siegel 1972, whose proposed
  mechanism — heightened fluency in monologue from more careful
  monitoring — describes a scored sixty-second recording precisely), and
  showed that one of the four was a contrast *within* dialogue rather
  than evidence about monologue. The proposal's own note says that if
  this reading is wrong the median roughly doubles. **An undetermined
  factor of two on the centre is not something a ring can absorb.**
- **The sampling noise is much worse than reported.** The proposal said
  Poisson noise "moves the displayed percentile by double digits". The
  audit computed it: a median speaker over ~150 words expects 6.8 filled
  pauses with a Poisson standard deviation of 2.61, and a one-sigma
  swing moves the displayed percentile **about 40 points**, on roughly
  two thirds of recordings. That is larger than almost any real
  difference between two people, and it is the strongest single argument
  against drawing a ring from one sixty-second recording at all.
- **Two overclaims corrected.** The sex gap is not settled: Bortfeld has
  men 47% higher and Shriberg replicates the direction, but the
  parliamentary corpus reverses it in two of four languages, with men 47
  to 59% *lower*. And Tagliamonte's "like" finding is age-grading:
  it peaks at 15 to 16 and declines through 17 to 19 and university, so
  Ethos's 16 to 28 band sits almost entirely on the falling side. The
  construct-mismatch argument does not need that claim and survives
  without it.

**What the audit confirmed.** The conversational centre of 2.5 to 3.0
per 100 words across three independent corpora. Total disfluency near 6
per 100 words (Bortfeld 5.97; [Shriberg 1996](https://www.sri.com/wp-content/uploads/2021/12/disfluencies_in_switchboard.pdf)
5.53 on Switchboard, 5.47 on AMEX). Filled pauses at 40 to 45% of all
disfluencies, which is why Ethos is right to score fillers and restarts
separately: they are different-sized halves that move independently, and
Verdonik's 2025 Slovenian data has them moving in **opposite**
directions between public and private speech. And the shape: Clark and
Fox Tree's own English per-speaker range is violently right-skewed, so
log-normal is the fitted answer rather than a preference.

**What this says about the shipped scores**, which the audit reproduced
from `lib/index-score.ts` and called the most actionable finding in the
whole review. `fillerScore` runs linearly to zero at 8 fillers a minute;
against the evidence at 150 words a minute, the median speaker scores
**15 out of 100** and everyone above the 75th percentile is pinned at
zero, before the discourse markers are added. `repairScore` zeroes at 3
a minute while the population restart rate is 2.52 to 3.10 a minute
across Ethos's own pace zone, so the average human scores **3 to 16 out
of 100** on self-corrections. Both curves describe a much more fluent
speaker than the literature does, and `index-score.ts` says so in its
own header: "All curve constants are v1 sketches".

**One line for the copy.** Nothing in this literature identifies a floor
below which too few filled pauses becomes a problem, but Clark and Fox
Tree's entire thesis is that *uh* and *um* are conventional signals
rather than noise, and words after a repetition are processed faster
rather than slower. Zero is not a goal Ethos should imply. It is simply
outside the observed range.

---

### Restarts

**Verdict: provisional**, for two reasons that compound.

**The audit caught this trait describing itself wrongly, and the
correction doubled its centre.** The copy calls a restart "a sentence
you abandoned and began again a different way", and `detectRepairs` has
never checked the landing: it counts any run-up of up to four words
repeated within two words of itself, so a verbatim repeat scores exactly
the same as a real restart. Bortfeld reports those two separately, 1.94
per 100 words of restarts and 1.47 of repeats, which means the honest
comparison is their **sum, 3.41 per 100 words**, not the 1.94 this
document first filed. The mismatch is now asserted in
`lib/metrics.test.ts` so it cannot drift back silently, and narrowing
the code to match its own name is on the list below rather than done
here, because it moves every score already in the log.

No dispersion is published for restarts at all — from the same paper that
publishes none for fillers, and without the section 7.3 that rescued
them. The spread here is borrowed from the filled-pause figure, which is
precisely what the fillers audit criticised the fillers proposal for
doing. It is done knowingly, it is written down, and it is why this
trait cannot rise above provisional.

The second reason is ours. There is no `repairs_per_min` column, so the
rate is reconstructed by inverting `repairScore` — exact to about 0.015
a minute, and lower-bounded at the floor, where a score of 0 means
"three a minute or worse" and cannot say which. Moving the trait to per
hundred words adds a second derivation on top of that: the rate is
turned back into a count using the recording's duration, then divided by
its word count. **A trait whose raw value is two derivations deep off a
score that was itself set from intuition should not be shipped to
anybody before the column exists.**

### Pace

**Verdict: provisional, and the band is in the wrong place.** This is
the trait with the most real data and the clearest finding about the
app.

**What the evidence gives.** Four independent routes to a centre, all
landing between 141 and 160 words a minute:

| Route | Source | Words a minute |
| --- | --- | --- |
| Direct measurement | Venkatagiri 1999, young adults, "talking" | 136 to 144 |
| Speech rate with silence, Ethos's exact measure | [Bradlow, Kim & Blasingame 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5848867/), n = 27, ages 18 to 34, mean 23 | 141 (narrative) to 146 (Q&A) |
| Articulation rate discounted by measured pause fraction | [Jacewicz et al. 2010](https://u.osu.edu/spalab/files/2017/09/Jacewicz_Fox_Wei_2010-ptcnko.pdf) × Bradlow | 150 to 160 |
| Turn-wise, ages 16 to 28 | [Yuan, Liberman & Cieri 2006](https://www.isca-archive.org/interspeech_2006/yuan06_interspeech.pdf), Fisher | ~157, upper bound |

Bradlow is the closest match Ethos will find: first-language English
speakers at a mean age of 23, producing a spontaneous monologue, with
silence included. The proposed model is log-normal with a median of
**148 words a minute** and a coefficient of variation of **0.20**,
giving P10 = 115, P25 = 130, P50 = 148, P75 = 169, P90 = 191.

Worth recording: the famous "150 words a minute" figure has no floor.
It traces to the National Center for Voice and Speech with no paper, no
sample, no method and no year, and every site repeating it cites another
site. It happens to be close to what the real literature says, which is
luck rather than evidence.

**What it does not give.** The spread again, though less badly than
elsewhere. The candidates ranged from 12% (articulation rate, which
strips out the pausing where most between-person variance lives, so a
floor) to 27 to 31% (n = 27, inflated by automatic syllable detection).
0.20 comes from the two estimates that are actually about between-person
variation in speaking rate with pauses: a Jordanian young-adult sample
at 20.4% (n = 51, right age, wrong language) and Yuan's Switchboard
range un-averaged to about 19.7%. Agreement between two, not a
published number.

**What this says about the shipped scores, and it is the loudest finding
in the whole review.** Ethos's target zone of 130 to 160 words a minute
is **the 26th to the 65th percentile**. It contains under 40% of the
population and it sits low: about 35% of ordinary speakers are faster
than its upper edge and are currently charged 2 points a word for it.

And the penalty is symmetric when the evidence is not. `paceScore`
charges somebody at an energetic 180 exactly what it charges somebody
grinding out 110. Below the band the penalty is real: listeners rate
moderate-to-fast speakers as more competent, credible and confident than
slow ones (Miller et al. 1976; Smith and Shaffer 1991, 1995), and below
roughly 115 a young speaker is audibly labouring. Above it the evidence
is much weaker than the coaching lore: the time-compressed-speech
literature has native listeners near ceiling well above normal rate,
Smith and Shaffer use 180 as their **moderate** condition, and TED
speakers average 169
([Wingrove 2017](https://www.sciencedirect.com/science/article/abs/pii/S1475158517301029),
measured on one-minute windows, the same window Ethos uses). Nothing
supports a penalty starting at 161. An honest curve is steep below about
120, flat from about 125 to 175, and shallow above about 190.

**What the audit changed.** It verified nine of the ten studies exist,
found the percentile arithmetic clean end to end, and called the
directionality analysis the most valuable thing in the proposal. Then it
took the centre and the spread apart:

- **The one direct measurement does not say what it was quoted as
  saying.** Route A, sold as the only paper reporting words a minute
  directly, rests on a percentile label the source abstract attaches to
  different numbers, in a paper nobody in the chain actually read. That
  is the most serious finding in the audit.
- **A correction was available and not applied.** The proposal describes
  Bradlow's acoustic-syllable under-count as "an unstated amount".
  Bradlow's own 2019 table states it: 123 acoustic syllables against 139
  orthographic, an 11% loss, measured on read speech, which loses less
  than spontaneous speech does. Applying it moves two of the three
  routes up by 14 to 20 words a minute. **The centre is defensible as a
  rough prior over roughly 145 to 165, not as 148 plus or minus 10.**
- **The spread is derived wrongly twice.** The range-to-deviation
  divisor used is the constant for a sample of about 500 where
  Switchboard has 2,438; and the un-averaging step assumes two people on
  a phone call vary independently, where the entrainment literature says
  they converge on each other.
- **And here is what that costs.** Holding the centre at 148 and
  sweeping the spread across the range the proposal itself calls
  plausible, somebody recorded at 127 words a minute sits **anywhere
  from the 10th percentile to the 32nd**. The number Ethos would print
  beside that recording is not a measurement, it is a choice. Under
  vision.md's own rule, that feedback traces to a timestamp or a number
  or it is not said, a percentile that swings that far on an unmeasured
  parameter does not trace to anything.

So the audit's verdict is sharper than the proposal's, and it is the one
adopted here: **ship the band change, do not ship the percentile.** Show
the raw rate and which side of the band it falls on, and fit the
placement to Ethos's own recordings.

Two corrections the audit made to this document's own citations, made
before filing. The Jordanian normative study is Damhoureyeh, Darawsheh,
Qa'dan and Natour, not Al-Khateeb. And "native listeners comprehend at
200 to 250 words a minute" could not be traced to a primary source, so
what is claimed above is only what the time-compressed-speech literature
supports. An unsourced convenience is exactly what the NCVS figure was
rejected for, and it does not get a pass for agreeing with us.

**The band is not changed yet**, for the same reason as the held-pause
line: it moves every score already in the log. It is the first thing to
fix once the Index's role is settled, and it is the one change the
researcher and the auditor asked for independently.

One consequence for the ring, already implemented: a percentile of raw
words a minute is meaningless for a banded trait, because the 95th and
the 5th are both bad and a ring would draw them as opposites. The
percentile is computed on **distance from the middle of the band**, and
the number printed beside it stays the raw rate, because that is the
half that traces to the recording.

---

### Variety

**Verdict: provisional, with no research commissioned and an honest
reason.**

Variety is distinct words per hundred spoken, which is a type-token
ratio. Type-token ratio is famously dependent on sample length: it falls
as a sample grows, so a figure computed over 150 words is not comparable
to any corpus figure computed over thousands, and no published
distribution exists for the quantity Ethos actually computes on the
sample size Ethos actually takes. A percentile drawn against a corpus
TTR would not be a weak estimate; it would be a different measurement
wearing the same name. This is the same class of error as the filler
construct mismatch, caught before it shipped rather than after.

It stays provisional until Ethos can fit it to its own recordings, which
is the only sample that matches on length.

---

### Pitch, which Ethos does not measure

The brief named pitch variation as a trait to place people on. **Ethos
does not measure it at all.** The Index's "range" dimension is lexical —
distinct-word ratio and repeated trigrams — and nothing in the app
computes fundamental frequency. The name should change so it stops
implying an acoustic measurement it does not make.

The population data is better than expected and still not enough.
Traunmüller and Eriksson give a solid centre pooled over 942 speakers
(within-speaker standard deviation 2.7 to 2.8 semitones for European
languages) and a clean gradient from dull to lively speech (2.1 → 2.8 →
4.0 → 4.8 st), but publish no spread. The best-matched population in the
literature — Hudson et al.'s 100 male speakers of Standard Southern
British English, aged 18 to 25, spontaneous speech — computed
per-speaker standard deviations and never printed them.

The measurement is the real blocker, and three findings say so:

1. **Extraction settings move the answer as much as the person does.**
   Hincks measured one speaker's presentation three times with three
   pitch-search bounds and got 0.234, 0.131 and 0.183 — the full width
   of the population distribution, from one recording, by changing a
   parameter.
2. **One uncorrected creak destroys a window.** Removing a single
   misanalysed creak moved a ten-second measure from 0.35 to 0.06:
   bottom of the corpus to top. Creak is common in 16 to 28 year olds
   and commoner in spontaneous speech than in reading. Every usable
   published norm was hand-cleaned.
3. **Sixty seconds is thin.** Within-speaker variation across ten-second
   windows is 93% of between-speaker variation. Even with a perfect
   tracker, one minute supports a percentile to about ±17 points at the
   median.

**Is it reachable from a phone?** The capture is. Web Audio gives raw
samples far above what a 60 to 400 Hz search needs, and fundamental
frequency is one of only two measures that survived a device change
intact in the smartphone-validity literature (r = 0.991 and 0.992 for
mean F0, where jitter, shimmer, HNR and CPP all showed device effects).
But the tracker should not run in the browser: Ethos already ships audio
to a server for Whisper, and a server has tools with octave-jump
post-processing, where the browser libraries are good enough for a
guitar tuner and unvalidated on creaky spontaneous speech. It is the
roughly 1% of octave errors that wreck a standard deviation, because one
halved frame is a twelve-semitone outlier.

The honest first version is not a percentile at all. Hincks and Edlund
built and evaluated a **live in-recording meter** (semitone SD over a
rolling ten-second window, 100 ms latency) that produced a 2.5-semitone
effect which transferred to an unaided presentation afterwards. That
needs no population norm and is honest on day one.

**One free improvement found on the way.** `app/rep/page.tsx` asks for
`getUserMedia({ audio: true })`, which leaves Chrome's noise suppression
and automatic gain control **on** by default. Automatic gain control
boosts quiet passages, which is exactly what the voiced-envelope check
in the pause detector reads, so an uncontrolled processor sits upstream
of a number Ethos already ships. Passing `{ echoCancellation: false,
noiseSuppression: false, autoGainControl: false }` costs nothing and
removes the variable. **Not changed yet**: it could cut both ways for
Whisper in a noisy room, and that is a question for real recordings
rather than a documentation pass.


## What this review says to do, in order

Numbered by how much they change, not by effort. The first three are
changes to numbers the app already ships and they do not wait on any
percentile.

1. **Recalibrate `fillerScore` and `repairScore`.** The median speaker
   scores 15 out of 100 on fillers and 3 to 16 on restarts. Both curves
   were set from intuition for a speaker the literature does not
   describe. This is the highest-value finding in the whole review and
   it is independent of every ring.
2. **Move the pace zone, on both sides at once.** 130 to 160 is the 26th
   to the 65th percentile. The honest shape is steep below about 120,
   flat from about 125 to 175, and shallow above about 190. The
   researcher and the adversarial auditor asked for this independently,
   and it is the only thing in the whole review they fully agreed on. It
   is one change across `lib/index-score.ts` and `content/norms.ts`,
   because the app must not end up with two zones disagreeing about what
   "in the zone" means.
3. **Decide what 0.8 seconds is called.** At that threshold about 24% of
   pauses count as held where the genuine long class is 14%, so roughly
   a third of what Ethos scores as a landing is an ordinary boundary
   pause. Raise the line to about 1.0 s, or keep it and stop calling it
   rhetorical.
4. **Narrow `detectRepairs` to what its own name says**, so a verbatim
   repeat stops counting as a restart, and move the norm back to
   Bortfeld's 1.94 when it does.
5. **Give restarts a column.** The one trait whose raw value is
   recovered from a score rather than stored, now two derivations deep.
6. **Run the audit that did not.** Pitch.
7. **Then fit the norms to Ethos's own recordings.** Every distribution
   here is somebody else's population. Once there are a few hundred
   sixty-second recordings from 16 to 28 year olds speaking a monologue
   into a phone, that is both a better norm and the only one that
   matches on task, length and pipeline. Variety cannot be done any
   other way at all.

## Open questions

1. **Is the band symmetric?** The pace percentile treats too-slow and
   too-fast as costing the same, and the evidence says they do not. Real
   user data will settle it faster than the literature will.
2. **Can one minute carry a position at all?** The fillers audit put the
   sampling noise at about 40 percentile points on two thirds of
   recordings. Whatever ring ships should either widen with the sample
   or show a trend across recordings rather than a position from one.
3. **Does the percentile move for the right reason?** A trait can climb
   because somebody got better or because they recorded something
   easier. Neither the model nor the interface currently distinguishes
   them.
4. **Should the microphone stop processing the signal?**
   `getUserMedia({ audio: true })` leaves noise suppression and
   automatic gain control on, and automatic gain control boosts exactly
   the quiet passages the pause detector reads. Turning them off costs
   one line and could cut either way for transcription in a noisy room.
   It needs real recordings, not an argument.
