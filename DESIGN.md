# DESIGN.md, Ethos

Nothing here is banned. One question decides everything: does it move the screen closer to the reference? A shadow, a blur, a gradient, a spring, a loop: if the reference has it and it earns its place on this screen, use it. If a token is missing, add it, then use it.

## What premium means here

The target, described so you can see it, not policed so you can grep it.

- **Type carries the hierarchy.** Outfit 700/800 for numbers and titles, tabular digits, Figtree for body. Big numbers, small labels, generous air between them. When a screen feels flat, the first suspects are weight contrast and spacing, not colour.
- **One warm accent.** Terracotta means tap. Sage means earned. Plum means paid. Stone on a plain ground holds the room. Colour is information first, but richness is welcome: a warm tinted shadow, a grain on the ground, a scrim with a little blur under a sheet.
- **Plum is the tier, and nothing else.** Where the app says a surface belongs to Premium it says it in plum, in the same word, with the same mark, every time: `components/PremiumMark.tsx`. Nine spellings of one tier read as nine features. Plum never means tap, because terracotta owns the press and that does not change, so a premium card with an action is a plum card with a terracotta button on it. Plum never means earned, because sage is stars and streaks and anything worked for, and an allowance you were given is not a thing you earned. The mark is a door, never a padlock: the ellipsis stays, the counter still counts, the row still says how many recordings are behind it. The mark names the tier; it never hides the number.
- **Depth is real.** A card sits on the ground and has a fill. It can cast a soft warm shadow or stand on a raised step, whichever reads better beside the reference. Choose per screen, keep it consistent within one.
- **Continuity.** A state change shows where it came from, what caused it, or what was earned. Sheets rise, results land, the ring grows out of the Record button, the active tab dot slides. Springs are right for celebration and for anything a finger drags. 200ms is the default, not the ceiling: a sheet or a page push can take 350, a celebration 600. Nothing teleports.
- **Speed is the loudest signal.** Under 100ms perceived in the recording loop. Optimistic writes. Measured numbers render instantly, the judged read streams in. Skeletons reserve exact space so nothing shifts.
- **Finished means every state exists.** Empty (designed, one action, Demos where it fits), loading, error with retry, populated. Every control has a visible focus and pressed state. Keyboard works, Escape closes. Reduced motion collapses to fades. On a phone the layout reconfigures, targets are 44px, the primary tap is 48px and bottom anchored above the safe area.
- **Demos** shows up at moments: an empty state, a milestone, a first recording. His presence should feel like an arrival, not wallpaper.

## What this pass enforces

Ten principles from the design pass (#326), each a thing you can count on a screenshot. Break one only where the screen looks better for it, and log why.

1. **One lifted thing.** At most one `elev-2` per screen, the card holding the one tap. Every other card is `.card`. No card inside a card, no filled tile inside a card.
2. **One tap colour.** Exactly one terracotta fill per screen and no hover step; terracotta-600 is only Stop. Plum only as PremiumMark and the two Premium surfaces; sage only on something earned.
3. **Type has a scale.** 34 / 26 / 20 / 19 / 17 / 16 / 15 / 14 / 13 / 12.5 / 10, numbers 72 / 56 / 36 / 24 / 17 at 800 tabular. The count of arbitrary `text-[…]` sizes only goes down.
4. **Capitals are for data.** Tracked caps only on data column heads and stat labels (plus the PremiumMark and Settings' iOS group heads), three per viewport at most, one idea per eyebrow, no ` · ` compounds. An eyebrow in a card is sentence case 13/600.
5. **One header, one way back.** ScreenHeader's large title or a BackLink at the same 44px geometry, its chevron at the bar's x and y; no ← or → in a label; every row-shaped door ends in the same stone-400 Disclosure.
6. **A trait wears its colour and its name**, everywhere it appears, from `content/traits.ts`.
7. **Rhythm belongs to the parent.** First block mt-5 under a title, sections mt-7, head to content mt-3, card to card gap-3, card p-4, hero p-5; no empty band over 64px at 390x844; the one tap 48px, bottom-anchored, clear of the nav by `--nav-clear`.
8. **Nothing moves on load, and unknown is never zero.** Every async slot reserves its height and lands with `.arrive`; loading or failed shows a skeleton or a dash.
9. **Demos speaks in one voice.** One tailed SpeechBubble in Figtree regular (19 in the introduction, 17 elsewhere) against Outfit 700 answers; one Demos per screen, never on a terracotta wash, and at 120px or more his idle clip plays.
10. **Every control is reachable and announced.** 44px targets, focus drawn inside clipped containers, radio groups on `useRovingRadio` with arrow keys, `role=status` or `role=alert` on every async result, Demos's lines read once.

## Tokens

Colour, radius and motion live in `app/globals.css`, `lib/motion.ts` and `lib/spring.ts`. Movement is a spring (damping, response), critically damped unless the gesture carried momentum; fades are curves. The `apple-design` skill (`.claude/skills/apple-design`) is the reference for motion, materials and type feel. Radius: control 12, card 16, sheet 20, chips are pills, Record is a circle. Three dark layers plus stage. Text roles that clear AA. The named motion classes in `STATE.md`. Extend them whenever the reference asks for something they lack; a value goes into the tokens first and gets used second.

## References

`docs/refs/` holds phone screenshots of apps that feel the way Ethos should: Instagram (continuity), Headspace (warmth), Duolingo (celebration, and the introduction: `docs/refs/duolingo-onboarding/`, cut from Timothy's own recording with the mechanics named in its NOTES.md; `13-question-list-dark.png` is the reference for answers as filled objects with an edge and a lip), Linear mobile (type). Three more since the design pass (#326): **Imprint** (`docs/refs/imprint/`) for how few containers a learning app needs: Home's one card over open sections (Lessons), Me's one identity card (You), the lesson sheet's art over a plain list (the lesson page). **Wellspoken** (`docs/refs/wellspoken/`), a speaking coach, for density and quiet: sentence-case labels, a count beside a section title, no hover fill on the tap, the course page's centred head. **Duolingo's path** (`docs/refs/duolingo/01-path.png`) for progress drawn as objects with a lip and stars as slots, and as the read Ethos departs from where Timothy's calls say so (neutral tiles, bare counters, crisp Premium doors). Timothy adds them. If the folder is empty, say so in the first line of your reply and run the loop against the app alone.

## Skills

Installed in `.claude/skills`, pinned in `skills-lock.json`, refreshed with `npx skills update`. They are references: this file, the tokens and `COPY-RULES.md` win every conflict.

- `apple-design`: motion, materials and type feel inside the app.
- `design-taste-frontend`: the marketing site and landing pages. Its own brief rules out multi-step product UI, so app screens answer to this file.
- `awesome-design-md`: DESIGN.md files for Linear, Stripe, Apple and about fifty more. Read one when a screen wants a second reference beside `docs/refs/`; never import it over this file.
- `image-to-code`: make or take a design image first, then build to match it. Written for Codex; here the image is a reference Timothy drops in or one an image tool generates.
- `web-design-guidelines`: Vercel's interface checklist. Run it on a finished screen after the look loop and fix what it finds.
- `playwright-cli`: drive the app by hand (open, click by ref, snapshot, screenshot) when the scripts below do not reach the moment.

## The tools the loop runs on

Three scripts, all against a dev server with the Supabase host mocked and three weeks of
practice in the fixtures (`scripts/look-fixtures.mjs`, shared so every tool photographs the
same app).

```
NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
export PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs

node scripts/look.mjs after today log          # stills, 390px, light and dark
LOOK_OUT=docs/look/audit node scripts/look.mjs after today   # into the design pass's gallery
LOOK_BLUR=7 node scripts/look.mjs squint today # the squint test
node scripts/strip.mjs mods / 'button:has-text("Make it harder")'   # a frame strip
node scripts/look-welcome.mjs after            # the introduction, walked and shot
node scripts/check-motion-layer.mjs            # the motion layer, asserted
node scripts/check-motion.mjs                  # the older motion layer, asserted
node scripts/check-onboarding.mjs              # the eleven-screen walk, asserted

# playwright-cli by hand; in the cloud container it needs the preinstalled Chromium
export PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium
npx @playwright/cli open http://localhost:3123  # then snapshot, click e12, screenshot
```

`look.mjs` photographs the app as a RETURNING user sees it, so its fixture has already finished
the introduction and cannot photograph it. `look-welcome.mjs` starts from an empty browser, taps
through all eleven screens and shoots each question twice, unanswered and answered, because
Demos's reply only exists after a tap. `strip.mjs` takes `STRIP_FRESH=1` and `STRIP_PRE='a|b|c'`
for the same reason: a transition part way through a walk needs the camera to walk in first.

The **squint test** blurs the document before the shot. At 7px nothing survives but mass and
colour, so a hierarchy that only works because you can read the words fails immediately. It is
the cheapest honest test in the repo.

A **frame strip** taps something and lays 0, 80, 160, 240 and 400ms side by side in one image.
Frame 0 is the moment BEFORE the tap; a screenshot takes 40 to 80ms to come back, so a zero
frame shot after the click is really the sixty frame. Five identical frames mean the change cut.

Three gotchas, all learned the hard way. `next build` writes into the directory `next dev`
serves, so build with `NEXT_DIST_DIR=.next-build` while a server is up or every shot comes back
a 404 page. An ambient loop on a control (the Record button breathes) makes Playwright's
click wait forever for it to hold still: those clicks need `{ force: true }`. And headless
Linux Chromium hints fonts to whole pixels, printing "Ne xt" and "4 O ctober": every camera
launches with `--font-render-hinting=none`, and a spacing problem seen only in a shot is the
camera until a phone shows it too (#325).

## The look loop, every UI task

1. **Before.** Playwright at 390px, light and dark, the screen you are about to touch. Save to `docs/look/<screen>-before-{light,dark}.png`.
2. **Build.**
3. **After.** Same shots. View them. Then view the closest reference beside them.
4. **Name five differences** in concrete terms: weight, spacing, radius, shadow, timing, alignment. No adjectives. Fix the top three now, not next session.
5. **Motion.** Capture frames at 0, 80, 160, 240 and 400ms after the tap and view them as a strip. If the change cuts, it isn't finished.
6. **Show Timothy** before and after in the reply. His reaction outranks the loop.

## When Timothy says it feels off

Reproduce his exact view: width, theme, the moment. Name what he saw in one line. Fix it. Then check every other screen for the same thing before he finds it there.
