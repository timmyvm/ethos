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
