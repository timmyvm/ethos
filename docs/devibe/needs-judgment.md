# needs-judgment.md

Things the migration hit that a rule doesn't cover. The playbook's own
instruction: stop and write it here rather than choosing, then Timothy
rules between phases. Nothing here blocks anything else.

---

## 1. The unit emoji on the path (Checkpoint 1, finding 6)

**Status:** half-answered, deliberately.

The functional marks are drawn now — the padlock on a locked node and the
flame on the weekly boss come from `components/Icon.tsx`, on the same grid
as the tab bar (DECISIONS #152). What's left is the per-unit identity
emoji in `lib/path.ts`: ✂️ Precision, ⏱ Pace, 🤫 The Pause, 🔥 Boss, 🧱
Structure, 🗜️ Compression, ⚡ Thinking Under Fire. They render in the
small unit headers on `/path` and on the road.

Why they weren't touched with the rest: those seven are *content*, not
chrome. Replacing them means designing seven marks that read at 11px and
say "compression" and "thinking under fire" without a caption — real
design work, and the report's option (c), a tiny Demos pose per unit, is
better than any icon and more work again.

The three options, unchanged from the audit:

- **(a) Keep them.** They're game iconography, and games use emoji
  deliberately. Cost: they render differently on every OS, which is the
  one thing in the app that isn't ours.
- **(b) Seven drawn marks** in `Icon.tsx`. Consistent, cheap, a bit
  anonymous — an icon for "compression" is always going to be a guess.
- **(c) Seven Demos poses.** Most on-brand, most work, and it puts the
  mascot in the one place vision.md would allow furniture — a unit is a
  place, not a moment.

**Recommendation: (c), scheduled after the desktop shell.** (a) is fine
until then; it's the only remaining spot where a platform draws part of
our brand.

## 2. The desktop shell (Checkpoint 1, finding 7)

Every screen is a 430px column centred in a 1440px cream void. The
report's cheapest fix is a deliberate desktop shell: the same stage,
constrained, with a side rail carrying Demos, the streak and the day
trail — rather than a true multi-column redesign of each screen.

Not started: it's the biggest visual change in the queue and it wants a
decision about what the rail holds before anyone writes it. Phone-first
stays right for the product either way.

## 3. A failed entitlement read (out of Checkpoint 1's scope)

`fetchProfile()` still degrades quietly: if the read fails, `premium`
stays false and a paying subscriber sees padlocks. Surfacing it on every
screen that reads it would be noise, and retrying silently risks a
flicker of locks. The honest options are a cached last-known entitlement
in local storage, or a single quiet line on the screens that gate
content. Both are decisions about how much to trust a stale answer.

---

## 2. Instrument reskin: the three derived values (DECISIONS #202)

**Status:** RESOLVED by #203 — the palette reverted to the Organic
values, so every colour is a designed one again. The only survivors
from #201's token additions are `edge` (old stone-200 doing the
card-outline job) and `sage-lit` #a9c37f (the day-trail bars, kept
because it reads on the deep sage card); `rust`/`rust-lit` now resolve
to the old terracotta-600/-300, i.e. #195's original delta colours.

## 3. Instrument reskin: two mock lines refused by the copy law

**Status:** needs Timothy's ruling only if he wants the mock's version.
(Still relevant after #203 — both are layout-era copy questions, not
colour ones.)

- The shop footer "Nothing here buys a star, a streak, or a score." is
  in the mock; #163 removed exactly this disclaimer (the rule lives in
  the ledger and `shop.test.ts`). Shipped without it.
- The Tools eyebrow "GAMES · REAL REPS, ROLLED CONDITIONS" says "reps",
  which #164 bans from the interface and `lib/copy.test.ts` enforces.
  Shipped as "GAMES".

---

## 4. The contrast floor vs the Organic values (UX audit, 2 Sep)

**Status:** needs Timothy's ruling. DESIGN-RULES asks for ≥ 4.5:1 "against
its surface (check terracotta-on-cream and every stone mid-tone in BOTH
themes)" and the shipped tokens miss it on every screen (axe serious ×20).
Measured on the cream ground: stone-300 2.39:1 (the road's future rows,
inactive nav tabs 1.88:1, month labels 1.86:1), stone-400 2.72:1 (every
eyebrow label and caption), stone-500 3.57:1 (the prompt under the lesson
title, the back links), cream on terracotta-500 3.35:1 (the one tap per
screen, 15px bold). Dark: 3.41 / 3.99, nav 2.45, the CTA 3.35.

The fix is a palette pass and #165/#203 lock the values, so nothing was
changed. Options: (a) raise stone-400/500 to ≈ ink at 62% / 72% and use
stone-400 wherever stone-300 carries words; (b) the CTA either darkens its
fill toward terracotta-600 or sets its text in ink (brand.md says cream).
Either way it is one token pass; the audit report has the per-element list.

## 5. Which lesson is "next" (UX audit, 2 Sep)

**Status:** the contradiction is fixed (#220: the debrief now reads the
path's `nextLesson`, like the floor and the road). What still wants a
ruling is the rule itself: `nextLesson` pins the floor to the first lesson
under three stars, so a beginner who scores 1★ on The baseline is asked to
"Go again" on it every morning, and a day-7 user with six starred lessons
is still sent to lesson 1. mechanics.md gates units on cumulative stars
and never says a lesson must reach 3★ before the next one opens. If the
intent is "advance on any star, revisit for the missing ones", the change
is one line in `lib/path.ts` plus its test.

## 6. The bought pose vs the celebrate pose (UX audit, 2 Sep)

**Status:** needs a ruling. `app/page.tsx` shows `demos-celebrate.webp`
whenever today's practice is done, which hides a pose bought minutes
earlier ("bought, and on your card"). Either the equipped pose wins when
one is set, or the shop copy says when it appears.
