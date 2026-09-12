# DESIGN.md, Ethos

Nothing here is banned. One question decides everything: does it move the screen closer to the reference? A shadow, a blur, a gradient, a spring, a loop: if the reference has it and it earns its place on this screen, use it. If a token is missing, add it, then use it.

## What premium means here

The target, described so you can see it, not policed so you can grep it.

- **Type carries the hierarchy.** Outfit 700/800 for numbers and titles, tabular digits, Figtree for body. Big numbers, small labels, generous air between them. When a screen feels flat, the first suspects are weight contrast and spacing, not colour.
- **One warm accent.** Terracotta means tap. Sage means earned. Stone on cream holds the room. Colour is information first, but richness is welcome: a warm tinted shadow, a grain on the ground, a scrim with a little blur under a sheet.
- **Depth is real.** A card sits on the ground and has a fill. It can cast a soft warm shadow or stand on a raised step, whichever reads better beside the reference. Choose per screen, keep it consistent within one.
- **Continuity.** A state change shows where it came from, what caused it, or what was earned. Sheets rise, results land, the ring grows out of the Record button, the active tab dot slides. Springs are right for celebration and for anything a finger drags. 200ms is the default, not the ceiling: a sheet or a page push can take 350, a celebration 600. Nothing teleports.
- **Speed is the loudest signal.** Under 100ms perceived in the recording loop. Optimistic writes. Measured numbers render instantly, the judged read streams in. Skeletons reserve exact space so nothing shifts.
- **Finished means every state exists.** Empty (designed, one action, Demos where it fits), loading, error with retry, populated. Every control has a visible focus and pressed state. Keyboard works, Escape closes. Reduced motion collapses to fades. On a phone the layout reconfigures, targets are 44px, the primary tap is 48px and bottom anchored above the safe area.
- **Demos** shows up at moments: an empty state, a milestone, a first recording. His presence should feel like an arrival, not wallpaper.

## Tokens

Colour, radius and motion live in `app/globals.css` and `lib/motion.ts`. Radius: control 10, card 12, sheet 16, chips are pills, Record is a circle. Three dark layers plus stage. Text roles that clear AA. The named motion classes in `STATE.md`. Extend them whenever the reference asks for something they lack; a value goes into the tokens first and gets used second.

## References

`docs/refs/` holds phone screenshots of apps that feel the way Ethos should: Instagram (continuity), Headspace (warmth), Duolingo (celebration), Linear mobile (type). Timothy adds them. If the folder is empty, say so in the first line of your reply and run the loop against the app alone.

## The look loop, every UI task

1. **Before.** Playwright at 390px, light and dark, the screen you are about to touch. Save to `docs/look/<screen>-before-{light,dark}.png`.
2. **Build.**
3. **After.** Same shots. View them. Then view the closest reference beside them.
4. **Name five differences** in concrete terms: weight, spacing, radius, shadow, timing, alignment. No adjectives. Fix the top three now, not next session.
5. **Motion.** Capture frames at 0, 80, 160, 240 and 400ms after the tap and view them as a strip. If the change cuts, it isn't finished.
6. **Show Timothy** before and after in the reply. His reaction outranks the loop.

## When Timothy says it feels off

Reproduce his exact view: width, theme, the moment. Name what he saw in one line. Fix it. Then check every other screen for the same thing before he finds it there.
