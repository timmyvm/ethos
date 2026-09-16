# Duolingo's introduction, 16 Sep 2026

Timothy's own recording (web app, dark theme, 58 seconds, from the language
pick to the first lesson). His read: "so simple, like empty, but brings your
attention so well. It makes me want to do the lesson." These are the
mechanics behind that read, in concrete terms, so the look loop can compare
against them without re-watching.

## What every screen does

1. **The mascot is the speaker.** There are no headings. Every line, the
   greeting, every question, every reply, is inside Duo's speech bubble with
   a tail on him. `01`, `03`, `05`.
2. **The bubble types in, then he moves.** The bubble appears empty, the
   text fills over roughly 300ms, then his wing lifts over the next 700ms.
   On Continue the bubble text dims before the next screen. `11`.
3. **Nothing else is on the page.** A full-screen intro is: ground, Duo at
   the exact centre, one bubble, a hairline, one button bottom-right. A
   question screen is: one thick progress bar, Duo's head in the top-left,
   the bubble, the options, the button. No back, no skip, no "3 of 7", no
   subline under the question. `01`, `03`.
4. **The button is grey until you answer.** Continue sits in the footer
   disabled, then turns green the moment an option is picked. The colour
   change is the reward for answering, and the eye goes there without
   reading. `03` against `04`.
5. **He replies in his own voice, on the same screen.** Pick "Spend time
   productively" and the question in the bubble is replaced by "That's a
   wise choice!" while the options stay. `05`.
6. **Options are objects, not rows.** Each is about 64px on a phone, with a
   coloured illustrated glyph at the left, a bold label, a 2px edge and a
   darker 4px bottom edge. Selected is accent edge, accent text, tinted
   fill; never an inverted block. `03`, `04`.
7. **One continuous progress bar, no count.** Thick, pill, green, with a
   highlight stripe; it fills smoothly and never says how many screens
   remain. `03` to `09`.
8. **The mascot and bubble are a fixed stage.** Between screens the bubble
   empties and the content below swaps; he does not leave. `08`.
9. **A beat between questions.** Before the reminder ask, a full-screen Duo
   line ("It can be hard to stay motivated...") breaks the run of
   questions. `09`.
10. **The lesson comes before the account.** Ethos already does this (#277).
    `10`.

## What Ethos should not copy

- The voice. "Let's get this party started!" is the register COPY-RULES
  bans. The structure (the mascot speaks) transfers; the words stay ours.
- The 3D bottom-edge buttons and the bar's highlight stripe. Those are
  Duolingo's brand; ours is a flat fill on a tinted shadow.
- Hearts, and the "each mistake costs" dialog.

## Ethos's introduction beside it (docs/look/welcome/)

- Ethos puts the line in a 26px heading under a static Demos; Duolingo
  puts it in the mascot's mouth.
- An Ethos question screen carries nine things (back, bar, "1 of 7",
  Demos, heading, subline, input, Next, Skip); Duolingo's carries five.
- Ethos's Next is always terracotta, with Skip under it on every screen;
  Duolingo's Continue is grey until answered and there is no Skip.
- Ethos's options are 44px rows with no glyph and an inverted ink block
  when selected; Duolingo's are 64px objects with a glyph and an accent
  edge.
- Ethos's bar is seven 3px segments plus a counter; Duolingo's is one bar.
- Ethos runs three intro screens then seven questions straight; Duolingo
  breaks the run with one mascot beat.
