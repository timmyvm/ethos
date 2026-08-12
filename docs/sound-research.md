# Celebration sound — the research pass

Done 12 Aug 2026, one focused pass per the CLAUDE.md protocol, after
DECISIONS #138 locked the placement (one chime, at the streak
celebration, never while the mic is hot). This pass calibrated the
chime itself. Grades: **[A]** primary/peer-reviewed · **[B]** credible
secondary · **[C]** practitioner lore.

## What Duolingo actually does

No verified attribution for their core in-app sounds — the ~2022–23
refresh has no design-blog post, and the studio claims circulating on
aggregators don't check out. What IS analyzable is the audio itself
**[B]**: the correct-answer sound is two fast notes rising a **major
third** (F#→A#, "a doorbell in reverse"); the fail sound is its exact
inversion, a **descending tritone**. Their whole system is a tiny
interval grammar — consonant+rising = yes, dissonant+falling = no —
in mallet/bell timbre, sub-second. Not orchestration.
(Musical analysis: losdoggies.com/archives/8816 and /8842.)

Ethos takes the grammar, not the notes: our chime is D major,
deliberately not their F#, and the descending half doesn't exist
because failure states don't either (no shame states, #26).

## The load-bearing findings

- **Earcon guidelines** (Brewster, Wright & Edwards, HCI '95) **[A]**:
  use musical-instrument timbres, **not raw sine/square tones**; keep
  pitch inside ~125 Hz–5 kHz; differentiate sounds by rhythm + pitch
  structure. This is why the chime's voice is triangle + octave
  partial + 3-cent detune rather than the pure sines of the first cut.
  https://www.dcs.gla.ac.uk/~stephen/papers/HCI95.pdf
- **Rising contour + major mode = positive valence**, replicated
  **[A]** (Hofbauer 2023, IJP; Frontiers in Psych 2017). Falling,
  minor, dissonant, rough = negative.
- **Juiciness helps and overdoses** **[A]**: juicy audio feedback
  raises presence (Springer 2021), and Hicks et al. warn too much
  dents intrinsic motivation. One sound per rep is the dose.
- **Apple, WWDC17 "Designing Sound"** **[A]**: silence is golden; UI
  sounds sit well below notification volume; filter out frequencies a
  phone speaker can't reproduce; always ship an off switch.
- **Google Material sound** **[A]**: "the more often an interaction
  happens, the less intrusive that sound should be" — the reason the
  DAILY chime is the short open triad and only milestones get the
  full resolved figure.
- **The casino line** **[A]** (Dixon et al.): slot "winning jingles"
  on net losses measurably inflate arousal and make players
  overestimate wins. Celebrate only real events, one sound per event,
  never scale loudness with stakes.

## The spec as shipped (lib/sfx.ts)

Rising D-major figure, triangle fundamental (+3 cents) + sine octave
partial at 25%, banded 180–2200 Hz, 8 ms attack, exponential decays,
master ≈ −12 dB:

- **Daily**: D4 → F#4 → A4, ~0.53 s, left open on the fifth — the
  copy under it says "Same time tomorrow".
- **Milestone (7/14/30)**: the triad lands D5, ~0.92 s, resolved.

**One deliberate deviation from the researched spec**: it gave the
final accent note more peak (0.70 vs 0.50). Not adopted — the accent
is carried by register and length instead, because louder-on-bigger is
the slot-machine pattern the same brief documents (#139).

**Not built, defined for later**: a one-note tick in the same voice
(A5, ~120 ms, quieter) if star/coin moments ever earn a sound — same
timbre family, one-note grammar for small events, the figure reserved
for streaks. Adding it reopens #138's "one sound per rep", so it waits
for a reason.

All constants are in the star-threshold bucket: v1 numbers to
calibrate by ear on a real phone speaker (Apple's advice: live with a
sound for a week before trusting it).
