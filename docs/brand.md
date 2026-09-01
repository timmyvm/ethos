# brand.md

> Sister doc to vision.md. vision.md defines what this is;
> this file defines how it looks, sounds, and gets named.
> AI sessions: any generated UI, copy, or asset must comply.

## One-line feeling

Gym at 6am, not a webinar.

## Name — DECIDED: **Ethos** (9 Aug 2026)

From Aristotle's Rhetoric: the three modes of persuasion are logos
(logic), pathos (emotion), and ethos — the credibility of the speaker
themselves. The product's promise in one 2,400-year-old word.
Passes the say/spell filter clean.

Pairing: mascot **Demos** the red panda (Demosthenes — the original
speech gym: daily reps, pebbles in mouth, speeches over waves).
Ethos + Demos = matched Greek pair. Demos pending final veto.

First actions when building resumes:
- Domain hunt — ethos.com/.app will be taken or priced absurdly
  (Ethos insurance exists). Acceptable fallbacks: tryethos.app,
  ethos.fit, speakethos.com, getethos variants (check conflict with
  insurance co's getethos.com first). Handles: @ethosapp / @trainethos.
- Trademark search in AU + US for software/education class before
  spending on brand assets. Ethos collisions are in insurance and
  crypto — different classes, but verify.

Graveyard: Orate (spelling barrier), Spoke (collisions), Aloud
(vetoed), Plato (group-games app), Socrates/Aurelius (spelling —
"arielus"), Wisdom/Synthesis/Fluency (course-y), Command (violates
vision.md), rooster-era list: Beat, Hold, Verbal, Riff, Floor,
Unmute, Forte, Podium, Carry, Aura.

Rejected (fails "gym, not course"): Wisdom, Synthesis, Fluency.
Rejected (violates vision.md language constraints): Command.

## Color system

Quiet paper + one command colour. Command comes from SCARCITY: amber
appears exactly once per screen, and everything else is paper, ink and
hairlines.

Full ramps live in `app/globals.css` (the source of truth since the
Instrument reskin, DECISIONS #201, 1 Sep — the Tailwind ramp NAMES stay
`terracotta-*`/`sage-*` for diff-hygiene; the values are amber and
olive). Core tokens:

| Role            | Value      | Tailwind ref     | Use |
|-----------------|------------|------------------|-----|
| Action / CTA    | #E0A800    | terracotta-500   | The ONE tap per screen; ink text on it, never white |
| Action text     | #8A6A10    | terracotta-700   | Amber-family text links ("keep them →") |
| Earned          | #47572F    | sage-500         | Stars, streak, earned fills, leader trait bar, Buy |
| Earned dim      | #9DAB7D    | sage-400         | Non-leader trait bars |
| Earned border   | #C3CDA6    | sage-300         | Olive outline buttons, XP chips |
| Text            | #191713    | ink              | All body/headings; also the score-card fill |
| Ground + cards  | #FAF8F3    | ground/surface   | ONE paper — hairlines separate, not fills |
| Raised          | #FFFDF8    | raised           | Nav bar, the current (amber-ringed) card |
| Hairline        | #E7E2D7    | hairline         | Row separators |
| Card outline    | #E0DACC    | edge             | 1px card borders |
| Track           | #ECE6D9    | sand             | Progress troughs (square-cornered) |
| Score card      | #191713    | stage            | The "Your ethos" card, both themes |
| Mascot          | #B05038    | rust             | Demos's fur; wrong-direction deltas (#195) |

*Was terracotta #C67139 with sage earned (the Organic reskin, #165,
25 Aug); terracotta #E76F51 with amber earned before that.* The
Instrument reskin (#201) inverts amber's old meaning: amber IS the tap
now, olive carries everything earned, terracotta survives only as the
mascot's fur and the wrong-direction delta. The dark theme's remaps
live in `app/globals.css`, derived pending a designed dark pass.

## Mascot — DECIDED: Red Panda

Timothy's call, 9 Aug 2026. Style rules (locked):
- Cartoon, flat, **no outlines** — bold color shapes only
- Clear silhouette: ears + face mask + ringed tail must read at 32px
- Logo sits on **white**; app background stays cream
- Wears the palette natively: terracotta coat, cream face/cheeks,
  dark-rust (#752C1F) limbs and belly, ringed tail, amber sound arcs
- Drawn mid-speech (open mouth + arcs) — the mark depicts speaking
- Per vision.md: he coaches, never guilt-trips. No sad-mascot
  notifications, no shame states. Missed day = coach register.
- Character name: proposed **Demos** (from Demosthenes — the original
  speech gym: daily reps, pebbles, practicing over waves). Pending.

Concept art (SVG, full body + head mark + scale check) in
brand-board.html. Dropped: rooster, Ember (flame), Beat (waveform).

Hard rules:
- **Orange appears only where a tap is wanted.** One CTA per screen.
  Orange as decoration is banned — scarcity is what makes it command.
- Warm neutrals only. No pure black (#000), no pure white (#FFF),
  no cool grays. Stone scale, not slate/gray.
- Dark mode SHIPPED (#64, semantic tokens; #167 ramp-step accent swaps).
  Light stays the default; the old "dark mode later" hold is done.

## Typography

- Numbers + UI: **Outfit**, weights 600/700/800, every numeral
  `tabular-nums` (DECISIONS #201, the Instrument reskin handoff). The
  metrics (filler count, WPM, streak) are the hero — set them big, 800,
  tracked −0.02em.
  *Was Caprasimo 400 from 25 Aug (#166), Fraunces 600/700 from 11–25
  Aug (#114), Space Grotesk before that (#5)*: the grotesk's numerals
  collided, the serif carried warmth, Caprasimo rounded it — and the
  Instrument direction trades that warmth for a training-log's
  precision, which Outfit's geometric tabular digits deliver.
- Body copy only: **Figtree** 400–700. Eyebrow labels (`.label-data`,
  `.section-title`) are Outfit 11px/700 uppercase, tracked 0.14em.
  No new faces.
- Numbers are the brand. Day-1 vs day-30 comparisons should look like
  a training log, not a report card.

## Copy rules (extends vision.md voice)

- Short sentences. Specific numbers. Zero hype adjectives.
- Coach register: "11 fillers. Down from 19. Tomorrow: kill 'like.'"
- Banned words in all UI/marketing: alpha, dominate, high-value,
  unlock your potential, top 1%, level up your life.
- The user is never told they're inadequate. The gap is theirs;
  the reps are ours.

## Locked business decisions (reference)

- **Model: freemium** (Duolingo / Elevate pattern).
  Free: the daily loop, every measured metric, one judged read a day.
  Paid: unlimited judged reads, the Presence readout, full history
  with per-dimension trendlines, the full lexicon, the boss library.
  Pricing decided (DECISIONS #197): A$14.99 monthly / A$79.99 annual.
  Details in mechanics.md.
