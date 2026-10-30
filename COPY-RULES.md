# Ethos copy rules

Third on CLAUDE.md's reading list, after STATE.md and DESIGN.md. These govern every
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
- Zero rhetorical fragments used as sentences ("No guessing." "Just practice.")
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
- Instructions on the recording screen: what to do, one line. Why it works moves
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
- Numbers speak for themselves. "17 recordings" beats any sentence about
  consistency.

## Testers (`content/tester.ts`, docs/testers.md)

The friends testing the scores meet a few strings nobody else does. They
follow every rule above, and `lib/tester.test.ts` checks the ones a test
can.

- **The consent names everything kept, then five things, and one tap.**
  Title "Testing Ethos", the line "Everything Ethos keeps while you
  test, and why." (a tester agreeing again reads "Testing now also
  keeps how you use Ethos, your device, your connection and problems.
  Read it all, then agree again.", which names what is new), then, as
  lead and sentence:
  - What's kept, each named on its own line: Your recordings, Transcripts,
    Your scores, Your answers, How you use it, Your device, Your
    connection, Problems. Timothy's list of 30 Oct, every item kept; the
    recordings line names every file you upload "(video included)",
    because Upload sends a file as it is, and the camera's numbers, with
    "The live camera's video stays on your phone." (Privacy's first
    promise).
  - What for: Making the scores accurate and fixing what breaks.
  - Who sees it: Only Timothy, who makes Ethos. Nothing is sold, and it
    goes only to the services that run the app, named in Privacy.
    ("Privacy" opens the Privacy page's Testers section.)
  - How long: Up to 12 months after the test ends, then it's deleted.
    If you keep using Ethos, your recordings and scores stay in your
    account. (The 12-month removal takes what testing added; a friend
    who stays keeps their practice, as everyone does.)
  - Deleting it: Ask Timothy and it's all deleted within 7 days.
    Deleting your account in Settings deletes it too.
  - Under 18?: A parent or guardian has said yes.

  "I agree" is the one tap, and it comes after the last line: on a
  short phone it is reached by scrolling past "Under 18?", never
  before it. "Not now" leaves and stores nothing. Its one negation is
  "Nothing is sold." It never says "Nothing is shared": every
  recording goes to the services that score and store it.
- **The consent is versioned.** Change a word and `CONSENT_VERSION`
  goes up with it: the server stores the version each tester agreed to,
  and a tester on an older version reads the new one before anything
  more is kept (version 2, 30 Oct, named the services; migration 0021.
  Version 3, 30 Oct, named everything; migration 0022). A tester on an
  older version is asked once, on their next open, with no code to
  type; Settings' row reads "Testing Ethos, Agree again" until they do.
- **The tester number is how a friend says who they are.** "Your
  tester number", the account id's first eight characters in two fours
  ("3F9A 1C2E"), with Copy. On the moment it switches on, Demos says
  "Send Timothy your tester number."
- **The match check is two questions, one either side of the score.**
  Before the score shows, one tap: "How did that feel?" over "Before
  you see the score.", Rough, Okay, Strong, or Skip; tapping goes
  straight on to the score. After the
  score, by its number, since the score is two steps back by then:
  "Did 665 feel right?" ("Did the score feel right?" when there is no
  number). Too low, About right, Too high. Too low and Too high open
  "What felt off?", optional. The save line says "Answer saved" for
  every answer, "Note saved", or "Your answer didn't save." with Try
  again. Both are plain grey controls, never terracotta: the screen's
  one terracotta tap stays its own. Above "How did that feel?" the take
  stands on the scoring panel it was read on: "Recorded", its length,
  its wave at rest. No score is on screen while it asks.
- **A tester on an older consent reads "Testing is paused."** with
  "Agree again", where the question would be (results and the Log),
  grey: nothing is asked or kept until they agree.
- **A full test says so.** Past the tester limit a right code reads
  "Testing is full. Message Timothy."
- **The doors are named for what they hold.** "Tester code" (the
  top right of the introduction's first screen, caption size and
  muted, and Settings), then "Testing Ethos, On" for a tester, and
  "You're testing Ethos" once it is on.

## The test for every string

Read it aloud. If it sounds like a fortune cookie, a pitch deck, or a
footnote defending the roadmap, rewrite it as something a busy human would
say to another busy human, or delete it.
