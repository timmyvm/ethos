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

Calm orange = comfort + command. Achieved by low-saturation terracotta,
not high-vis orange, and by SCARCITY: terracotta appears exactly once
per screen, and everything else is warm cream, ink and hairlines.

Full ramps live in `app/globals.css` (the source of truth). The values
are the Organic palette (DECISIONS #165), carried on the Instrument
layout (#201's structure, #203's colours). Core tokens:

| Role            | Value      | Tailwind ref     | Use |
|-----------------|------------|------------------|-----|
| CTA / primary   | #C67139    | terracotta-500   | The ONE tap per screen; cream text on it |
| CTA hover       | #B2432C    | terracotta-600   | Hover/pressed; also wrong-direction deltas (`rust`) |
| Accent text     | #8F4D24    | terracotta-700   | Warm text links ("keep them →") |
| Earned          | #7A8A5E    | sage-500         | Stars, streak, earned fills, leader trait bar, Buy |
| Earned dim      | #9DAB7D    | sage-400         | Non-leader trait bars |
| Earned border   | #C3CDA6    | sage-300         | Sage outline buttons, XP chips |
| Text            | #201E1D    | ink              | All body/headings |
| Ground          | #F5EAD8    | ground           | The room; layout cards sit on it behind 1px edges |
| Raised          | #FAF3E3    | surface/raised   | Nav bar, sheets, the current (terracotta-ringed) card |
| Hairline        | rgba(ink,.08) | hairline      | Row separators |
| Card outline    | rgba(ink,.14) | edge          | 1px card borders |
| Track           | #ECDFC4    | sand             | Progress troughs (square-cornered, #201) |
| Score card      | #2F3624    | sage-900         | The "Your ethos" card, both themes |

*Amber #E0A800 was the tap for exactly one commit (the Instrument
handoff, #201) and was reverted on Timothy's call (#203): the layout
stayed, the colours came home.* Terracotta means exactly one thing:
tap here. The dark theme's step-lifted remaps live in
`app/globals.css`.

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
