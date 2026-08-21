# Ethos copy rules

Add to CLAUDE.md's reading list next to DESIGN-RULES.md. These govern every
user-facing string.

## Budgets (hard limits per screen)

- **Zero em dashes.** Not one. Commas, full stops and colons do the same
  work in fewer characters, and the dash was the tell (asserted in
  `lib/copy.test.ts`, and written into the coach's prompt so generated
  copy obeys it too).
- Say it in as few words as you can. Someone opened this app to speak,
  not to read: one line beats three, and a number beats a line.
- One "X, not Y" / negation construction. It's the brand's favorite move,
  which is exactly why it can't appear five times.
- One mantra appearance. "Never money" is a principle, not a chorus. Say
  it once where it lands hardest and trust the reader after that.
- Section captions: one sentence. If a mechanic needs more, it doesn't belong
  here (see placement rules).
- Zero rhetorical fragments used as sentences ("No guessing." "Just reps.")
  outside of marketing pages, where at most one is allowed.

## Vocabulary

- **"Rep" never reaches the interface** (#164, asserted in
  `lib/copy.test.ts`). The artifact is a recording, the path unit is a
  lesson, the habit is practice, and time does the rest ("since last
  time"). Identifiers and routes keep the word; nobody reads them aloud.

## Placement: explain at the moment it matters, or not at all

- **Default to no explanation** (#163). If a mechanic is legible from its
  numbers, labels and states, let people infer it. People know what XP
  is, what a streak freeze does, what a locked door means. Printed
  mantras and per-card disclaimers are gone; the mechanic is the message,
  and the tests on the mechanic are where the principles live.

- Mechanics text lives where the mechanic HAPPENS, first time only:
  freeze rules appear when a freeze is earned or spent, not permanently on
  the profile. Coin economics live in the shop, not under the balance.
- A number with a good label needs no paragraph. "1 a day" already explains
  coin earning; the philosophy under it was for us, not the user.
- Instructions on the rep screen: what to do, one line. Why it works moves
  to the tips card, which is already expandable. Hardware details (mic
  permission) appear the first time only, then never again.
- If a string exists to justify a design decision to the user, cut it. The
  decision log is DECISIONS.md, not the interface.

## Voice: plain first, clever rarely

- Default register: a coach who respects your time. Short declaratives.
  "is/are" over "serves as/becomes/turns into".
- Clever lines are a spice: max one per screen, earned placements only
  (empty states, milestones, the welcome carousel). A settings toggle never
  needs wit.
- Banned constructions (the AI tells): "which is why …", "It's not X,
  it's Y", chained fragments ("Not A. Not B. Just C."), tailing negations
  ("…, no guessing"), explaining a feature by what it ISN'T.
- Numbers speak for themselves. "17 reps" beats any sentence about
  consistency.

## The test for every string

Read it aloud. If it sounds like a fortune cookie, a pitch deck, or a
footnote defending the roadmap, rewrite it as something a busy human would
say to another busy human, or delete it.
