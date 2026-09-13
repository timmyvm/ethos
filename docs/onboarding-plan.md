# Job 5, Phase A: the first thirty seconds

The plan for the introduction. Phase B builds it. Nothing here is built yet
except the one image at the bottom.

`docs/refs/` does not exist in this repo, so the look loops in this job compare
against the four references named in DESIGN.md from memory of their patterns,
not against screenshots. Drop phone shots in `docs/refs/` and the comparisons
get sharper.

## What already exists

Decision #232 built most of Phase A's brief a session ago. Being honest about
that is the point of this section, because the brief reads as a rebuild and a
rebuild would throw away working, tested code.

| Phase A asks for | Status |
| --- | --- |
| 5 to 7 questions covering age, goal, what gets in the way, experience | **Exists.** Five, in `lib/onboarding.ts`, one per screen |
| A plain data structure mapping answers to what they get | **Exists.** `content/portfolio.ts`, already the only place the mapping lives |
| Supabase schema for answers and the generated result, tied to the user | **Exists.** `supabase/migrations/0009_onboarding.sql`, closed-set checks, RLS |
| One image per screen from one style brief | **Partly.** Nine poses from #233's brief. Two of them are the banned thing |

So this is not a rebuild. It is three additions, one deletion and Phase B.

**What survives:** the nine-screen walk, the five questions and their options,
the portfolio table, the builder, the migration, the sync, the Demos set, the
progress bar, Back, Skip, and the resume-on-refresh state.

**What is thrown away:** the dumbbell.

## The deletion, first

`assets/demos-onboard-dumbbell.png` is a red panda doing a bicep curl. It is
the art for "How much have you practised?". `public/demos-workout.webp` is a
second red panda doing a bicep curl; it is a shop cosmetic priced at 8 coins
and it renders on `/games`, `/boss` and `/hostile`.

CLAUDE.md: the gym is banned, "not in the interface, the docs, the marketing,
the prompts, or your own reasoning". A previous sweep caught the words and
renamed the shop item to "Demos, mid-practice". It did not look at the
picture. Two pictures of a workout have been shipping ever since.

Both are replaced in this job. The onboarding one is the image below.

## 1. The questions

Seven screens, one question each, after the three intro screens. Five exist;
two are new. Every one is a tap except the first.

| # | Question | Answer type | Why it earns a screen |
| --- | --- | --- | --- |
| 1 | I'm Demos. What do I call you? | One text field, 24 chars, skippable | **New.** Demos has no way to address anyone today, and the brief asks for his opening line to them. It also introduces the mascot by name, which the app has never once done |
| 2 | How old are you? | Four rows, single choice | Sets the prompt pool. Under 18 drops the job prompts |
| 3 | What do you want this for? | Four rows, single choice | Picks the headline and the boss |
| 4 | What do you notice when you talk? | Six rows, up to three | The load-bearing one. The first one picked names the first number and flags a unit |
| 5 | How much have you practised? | Three rows, single choice | Sets two defaults: the frame step, and whether units teach before they test |
| 6 | Where does it matter most? | Four rows, single choice, optional | Narrows the prompt pool by place |
| 7 | When do you want your minute? | Five rows, single choice, optional | **New.** Writes `prefs.reminderHour`, which the push cron already reads. The streak is the retention mechanic and its switch is currently three taps deep in Settings |

Two decisions inside that table worth stating out loud.

**The name goes first, not last.** A keyboard in the first ten seconds is
friction, and the usual advice is to ask after someone is invested. Against
that: a name given at the start is spent on six screens, and a name given at
the end is spent on one. The screen is Demos introducing himself, so the ask is
reciprocal rather than a form field, and Skip keeps every existing no-name
line working. This is the one I would test first if the walk's completion rate
drops.

**Question 7 asks for no permission.** It writes an hour and nothing else.
`armPush` and `armReminder` already no-op until `Notification.permission` is
granted, so the hour sits waiting and the browser prompt stays where it is
today, after the first recording. Asking for a notification permission inside
the first thirty seconds is how an app loses it permanently.

## 2. Personalisation

The structure exists and is already the only place the mapping lives. It gains
two things.

**Demos's opening line to them**, four rows in `content/portfolio.ts`:

```ts
export const OPENING = {
  full:   (name, said) => `${name}. You said ${said}. From day one that's a number.`,
  noName: (said)       => `You said ${said}. From day one that's a number.`,
  noPain: (name)       => `${name}. Sixty seconds a day, measured.`,
  none:                   "Sixty seconds a day, measured.",
};
```

`buildPortfolio` returns it as `opening`, and the plan screen leads with it in
place of today's "Built from what you told me."

**His reply to an answer**, one string per option, on the options themselves.
The rule: **Demos replies where the answer changes something, and nods where it
does not.** A mascot who says something after every tap is a chatterbox; one
who speaks only when the answer moved a lever is proof that the app is
listening. So ten strings, not twenty-three:

- name: "Good to meet you, {name}."
- age: only Under 18 gets a line ("School and life prompts, then.")
- what you notice: all six, built from the metric they already name, for
  instance "Fillers. I count them, with timestamps." and "Rambling. One claim,
  one example, an ending."
- practised: all three, because all three change a setting, for instance
  "I'll skip the intros. Straight to the floor."
- goal, place, time: the nod, no line

**On "their starting point on the road":** the road does not reorder, ever
(#10, #46), so nobody's starting point moves and no plan should imply it does.
What the answers can honestly do is flag the unit that trains what they
noticed. `Portfolio.focus` already computes it. Phase B puts a `YOUR FOCUS`
mark on that checkpoint on the road, until the first star in it is earned, so
the answers show up somewhere other than the screen that collected them.

Everything above lives in `content/portfolio.ts`, editable without touching a
component. `PORTFOLIO_RULES_VERSION` goes 1 to 2, which rebuilds stored
portfolios.

## 3. Supabase

Smaller than expected, because two of the three fields already have homes.

- The answers and the built portfolio: `public.onboarding`, migration 0009.
  Unchanged.
- The name: `profiles.display_name`, which exists, is written by
  `updateDisplayName` and is read on `/you`. No migration. Worth knowing: it is
  the name the league board shows, so the walk will say so on the screen.
- The hour: `prefs.reminderHour` on the device, and `push_subscriptions` on the
  server once a subscription exists. No migration.

One migration, `0010_onboarding_v2.sql`, for the two things that have no home:

```sql
alter table public.onboarding
  add column if not exists reminder_hour smallint
    check (reminder_hour is null or reminder_hour between 0 and 23);

alter table public.onboarding alter column rules_version set default 2;
```

`reminder_hour` is stored here as well as in the subscription so a new phone
inherits the choice before it has granted anything. RLS already covers the
table.

## 4. Images

### The style brief

Unchanged from #233, restated so this file stands alone:

> Flat vector, no outlines, bold flat colour shapes, low detail. Full body,
> both feet visible, front three-quarter. Calm and slightly wry. Palette
> pinned by hex: fur `#d05c37`, ears, limbs and tail rings `#58271a`, face
> mask, cheeks and belly `#f7e6cf`, eyes `#3c241c` with one white highlight.
> Completely flat: no shading, no gradients, no highlights, no rim light, no
> drop shadow. Plain white background, cut to alpha afterwards. One prop per
> screen, in terracotta `#e07a5f`.

**One departure from the brief you wrote.** You asked for a terracotta accent
light. Decisions #7 and #233 ban lighting on the mascot, because a rim light on
flat art is an outline and the mascot has no outlines. A lit panda standing
next to eight unlit ones is exactly the drift the pipeline exists to stop. So
the warmth goes into the prop instead: one terracotta object per screen, which
is how the rest of the app spends its accent. Say the word and I will light
them.

**Aspect ratio: 1:1, 1024px**, matching #233. The set is normalised by
character height onto one baseline, and a 180px square slot never uses extra
height.

### One subject per screen

| Screen | Subject | Status |
| --- | --- | --- |
| Intro 1 | A wave | Shipped |
| Intro 2 | Speaking, arcs drawn in SVG | Shipped |
| Intro 3 | Celebrating | Shipped |
| Q1 name | A paw on his own chest, the other open to you | **New** |
| Q2 age | Counting on fingers | Shipped |
| Q3 goal | A rolled-paper telescope | Shipped |
| Q4 notice | A paw cupped to the ear | Shipped |
| Q5 practised | A handheld microphone, looking down at it | **New, replaces the dumbbell** |
| Q6 place | Headphones | Shipped |
| Q7 time | A chunky round alarm clock in both paws | **New** |
| Plan | A clipboard | Shipped |

Plus one outside the walk: the shop cosmetic `demos-workout.webp`, in the
in-app style rather than this one, since that set is a different crop and
proportion. Four new images, eight credits of the 219.

### The pipeline

Generate at 1:1 → cut the background with the border flood fill in
`scripts/cut-demos-alpha.mjs` → stand on the set's one baseline at the set's
one scale → WebP with alpha at q92 → `public/`, source PNG in `assets/`.

### The one image

`assets/demos-onboard-mic.png` → `public/demos-onboard-mic.webp`, for Q5,
replacing the dumbbell. The before and after, at the 120px the question screen
draws it, in both themes, with the squint pass and the set it has to live in:
`docs/look/poses/mic-approval.png`.

Two things this took that are worth writing down.

**It is a prop swap off the shipped frame, not a fresh drawing.** The first
attempt used the character Element and came back side-on with half-lidded eyes:
a good picture and a broken set. Uploading the exact frame being replaced and
changing one object keeps the pose, the face, the tail and the scale, which is
the only way eleven screens stay one character. `scripts/cut-onboard-pose.mjs`
then measures the shipped pose it is replacing and matches the new one's
character height, centre and baseline to it, so joining the set is mechanical
rather than judged: 923px tall, feet at 993 in a 1024 square, which is #233's
92% and 97% exactly.

**The prop took four attempts, and the look loop is why.** At 1024px every
version looked fine. At the 120px the screen actually draws, the first read as
a lollipop (round dark head, short fat handle, held in both paws at the chest)
and the second lost its handle entirely, because the render made it cream and
cream vanishes into his belly. What works is geometry plus contrast: a small
head, a slim handle three times its height, the whole thing dark brown with one
terracotta band at the neck, held in one paw with the other arm relaxed. Art
gets the look loop too, or it ships at the size nobody checked.

## Phase B, so you can see the shape

1. Eleven screens. Progress bar over seven, Back on every one, Skip on the
   three non-essentials.
2. State: `ethos.onboarding` already persists answers and step across a
   refresh. The name joins it; the hour writes straight to prefs.
3. Demos reacts: the reply table above, plus a one-shot nod on a tap, a small
   bounce when the third thing you notice hits the cap, and the existing
   per-pose loop underneath.
4. Each screen a moment: the title arrives, the rows stagger in on the motion
   layer from #242, and the button lifts to elevation 2 the instant it
   becomes tappable.
5. The last screen leads with the result: his opening line, then the three
   plan lines landing one at a time, then the boss, then the button. Job 6's
   shape, applied here first.
6. `lib/copy.test.ts` already reads these files, so every new string is held
   to the budget and to the gym ban on the way in.
