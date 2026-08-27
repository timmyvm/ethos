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
not high-vis orange, and by SCARCITY.

Full ramps live in `app/globals.css` (the source of truth since the
Organic reskin, DECISIONS #165, 25 Aug). Core tokens:

| Role            | Value      | Tailwind ref     | Use |
|-----------------|------------|------------------|-----|
| CTA / primary   | #C67139    | terracotta-500   | Buttons, the ONE tap per screen |
| CTA hover       | #B2432C    | terracotta-600   | Hover/pressed |
| Earned          | #7A8A5E    | sage-500         | Stars, XP, held pauses, freezes, trail pebbles |
| Text            | #201E1D    | ink              | All body/headings |
| Background      | #F5EAD8    | ground           | App + site background |
| Surface         | #FAF3E3    | surface          | Cards, nav |
| Track           | #ECDFC4    | sand             | Progress troughs, empty slots |
| Score card      | #2F3624    | sage-900         | The "Your ethos" card, both themes |

*Was terracotta #E76F51 with amber #F59E0B as the earned accent until
25 Aug.* The Organic reskin (#165) softened the tap colour and moved
everything earned onto sage, so terracotta means exactly one thing:
tap here. Amber is retired. The full sage ramp and the dark theme's
step-lifted remaps live in `app/globals.css`.

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

- Headings / numbers: **Caprasimo**, weight 400 ONLY (it ships one
  weight — never fake-bold it; globals.css pins this), tabular figures
  on (DECISIONS #166, the Organic reskin handoff). The metrics (filler
  count, WPM, streak) are the hero — set them big.
  *Was Fraunces 600/700 from 11–25 Aug, and Space Grotesk before that*
  (#114, then #166): the grotesk's numerals collided, the serif carried
  the warmth, and Caprasimo keeps that warmth at the reskin's rounder,
  friendlier register.
- Body: **Figtree**; `.label-data` is Figtree 700 uppercase for data
  labels. Space Mono is retired (#166). No new faces.
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
  Free: one daily rep + basic metrics (fillers, WPM).
  Paid: pause analytics, full history, day-vs-day comparisons,
  Cold Topic drill archive. Exact price point → mechanics.md
  after one research pass.
