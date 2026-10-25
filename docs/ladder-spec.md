# The price ladder: the final design

The spec the ladder's surfaces are built and reviewed against. The design comes from two
directions shot on the workbench and judged side by side. The research behind it is the
Apple Design Award pass: Flighty, Duolingo, Any Distance, Gentler Streak, (Not Boring)
Habits, Halide, Tide Guide, Crouton, Bears Gratitude and Copilot Money.

- **B, the staircase,** wins the object. It is `app/workbench/ladder-b/`.
- **A, the timeline,** gives it three things:
  - **Real calendar months,** so every price carries its date (Flighty, Copilot).
  - **The readout,** which rolls as you scrub (Halide, Tide Guide).
  - **The plain inset-group grammar** of the manage sheet (Crouton).

A is `app/workbench/ladder-a/`. Shots of both are in `docs/look/ladder-directions/`; B is
shot from its workbench page.

## The rules this design keeps

- **Plum is the paid tier.** It appears on the paywall sheet and on the price-drop sheet
  (the tier speaking: a logged extension of DESIGN.md principle 2), and as the PremiumMark.
  You's plan card, the manage sheet and Settings are neutral, because managing a plan is a
  utility.
- **Terracotta is the one tap per screen.** Sage never appears: a price is not earned.
- **Type comes from the tokens only.** Price readouts are Outfit 800 tabular, and there are
  no new arbitrary sizes.
- **Every price that is not today's carries its date.**
- **The reset rule is said once per surface, as a fact.** Cancel is never hidden, greyed or
  shamed. Cancelling takes two taps, the same as starting.
- **Dates and "today" are computed after mount.** The ladder only renders from client data
  or on a tap, so nothing date-dependent is server-rendered. This guards against the React
  #418 hydration error.

## Pieces (lift, then clean up; the workbench stays as the record)

| Piece | File | From |
|---|---|---|
| `Stair`: picture, slider and stage modes; `tone` plum or neutral; sizes lg, md and sm; `at`; `ghostAfter`; `hop` and `onLand`; rise-in | `components/premium/Stair.tsx` and its CSS in `app/globals.css` under a `/* the price ladder */` block | B `Stair.tsx`, `ladder-b.css` |
| `Paw`, the token on your step | `components/premium/Paw.tsx` | B `Paw.tsx` |
| `RollNumber`, which rolls only the digits that change | `components/premium/RollNumber.tsx` | A `RollNumber.tsx` (B `Roll.tsx` is the same idea; keep one) |
| Plan maths and words, pure and tested: month start dates from an anchor, `planFromBilling`, the state, the words per state, `monthsToFloor`, the spoken text for screen readers | `lib/plan-view.ts` and `lib/plan-view.test.ts` | A `ladder.ts`, B `data.ts` |
| Browser calls to the six routes, typed | `lib/billing-client.ts` | new |
| `PlanCard` (You), `ManageSheet`, `SettingsPlanRow` | `components/premium/PlanCard.tsx`, `ManageSheet.tsx` | B `Plan.tsx`, A `Surfaces.tsx` |
| `CheckoutReturn`, `PriceDropSheet` | `components/premium/Moments.tsx` | B `Moments.tsx`, A's `MomentSheet` (its Demos and bubble) |

### The calendar

**The anchor.**
- A free account's month 1 starts today.
- On a live plan, month `m + 1` starts at `current_period_end`, where `m = ladder_month`.
- Month `n` starts `n - m - 1` months from there.
- Add months the way Stripe does: keep the anchor day and clamp it to the month's last day.
  A plan started on 31 Jan renews on 28 Feb, then 31 Mar.

**Labels.**
- Under each step goes its short month name (`Oct`), and the floor reads `Apr+`.
- A readout date is `24 Nov` (en-AU, day and short month).
- When the date is more than 300 days away, add the year.

## The Stair

**Geometry.**
- Seven steps measured from zero: height = `max * cents / 1299`. The max is 120 for lg, 88
  for md and 40 for sm, so the floor step's height reads as 54% of the first.
- Step width is (column − 6 × gap) / 7, with a 6px gap.
- The floor step bleeds through the parent's padding to the sheet's edge and fades over
  24px (`mask-image`). That says "forever" without a word.

**Steps** are radius 12 on top and 6 on the bottom, with a 2px edge and a 4px lip, in the
answer rows' grammar.

| Step | Plum tone | Neutral tone |
|---|---|---|
| Paid (before the current month) | Pressed flat: lip 0, cream/16 fill | Lip 0, `surface` fill, stone-500 text |
| Current | Lit: solid cream, plum-900 text, lip in cream/60, with the Paw standing on it | Ink fill (stone-900 light, cream dark), with the Paw |
| Future | Raised, cream/8 fill, cream/20 edge and lip | `raised`, `edge` border and lip |
| Ending plan (`ghostAfter`) | Future steps as dashed outlines with no fill | Same |

**Faces.**
- A price is shown as whole plus superscript cents: `12` at `num-s` 17/800 tabular and
  `.99` at the suffix size, raised.
- The month label sits under the step at `.label-micro`, cream/60 on plum and stone-500 on
  neutral.
- The sm size shows no faces.

**Slider mode** (the paywall only).
- The whole stair is one `role="slider"` with `aria-valuemin=1`, `aria-valuemax=7`,
  `aria-valuenow` and `aria-valuetext` (for example "Month 4, from 24 January, A$9.99"),
  plus `tabIndex=0`.
- ←/→/Home/End move the selection.
- Pointer capture and drag: the selection is `floor(x / pitch)`.
- A tap selects, and letting go keeps the selection.
- The step under the finger presses 2px and its lip goes 4 to 2. The Paw hops to the
  selection on `--spring-snappy`.
- `buzz(6)` fires per step crossed, never on release.
- An sr-only sentence lists the whole ladder once: "Month 1 A$12.99, month 2 A$11.99, …,
  month 7 on A$6.99."

**Picture mode** (the plan card and manage sheet): `role="img"` with an `aria-label`
sentence ("Month 3 of the price ladder. A$10.99 now, A$9.99 from 24 November, A$6.99 from
24 February.").

**Stage mode** (the price-drop moment).
- After 450ms the Paw hops from step m−1 to step m on an arc, on `--spring-base`.
- The landing step takes its weight: a 2px press and a sheen crossing it in 600ms.
- `onLand` fires on the same frame, so the parent's RollNumber rolls, and `buzz([8, 40, 8])`
  fires.

**Rise-in** (every first render): the steps rise 12px and fade in, staggered 30ms left to
right, on `--spring-base`.

**Reduced motion** (`data-motion="reduce"`): no rise, no hop and no roll. A 200ms fade
stands in.

**320px:** the steps shrink with the column. The faces are sized for the whole stair at
once, never step by step, so one stair prints every price at one size. As the step's content
narrows below 36px (a 360 phone) the cents drop to a smaller size (8px); below 32px (a 320
phone) the whole dollars step down to `row` 14 with them, so all seven faces still print
whole; below 29px the faces hide on future steps first, then all. The 14 is the one face
size off the number scale, taken from direction B's own 320 stair: hiding the three
two-digit faces (the lit month 1 among them) read as a broken ladder. This must be checked
at 320.

## Surfaces

### 1. The paywall (`components/Paywall.tsx`)

**Kept as is:** the plum `.card-premium` sheet, the grabber, the PremiumMark chip, the
reason line, the headline, the five benefits, and the closing line "Money never buys stars,
streaks, or scores." (the screen's one negation).

**The ladder section** sits under a hairline after the benefits:
- The head: `.detail-head` (17/700) cream, "Your price drops every month you stay".
- The readout row:
  - Left: `A$` at the `num-m` scale cream/70, then the price at `num-l` 36/800 tabular
    through RollNumber.
  - Right, stacked and right-aligned: the date line at `row` 14/700 cream ("Today", or
    "From 24 Jan") over "Month 1" (or "Month 7 on") at caption cream/70.
- The Stair: plum, lg, slider mode, Paw on step 1, the floor step bleeding.
- The caption: 12.5 cream/70, max two lines at 390: "Renews monthly until you cancel, any
  time in the app. If a plan ends, the next one starts at A$12.99."

**The tap** is `ACTION_CLASS`, "Start at A$12.99" (busy: "One moment…"). Under it are "Not
yet" and the closing line.

**Checkout open** (`NEXT_PUBLIC_CHECKOUT_OPEN === "1"`):
- The tap calls `startCheckout` and sends the browser to `url`.
- `{manage:true}` goes to the portal URL instead.
- An error shows in a `role=alert` line in the existing error style.
- "I have a code" appears as a secondary text button that opens the code form.

**Needs an account** (403 `needsAccount`):
- The ladder stays.
- An inset note (cream/10 fill, radius 12, p-4, body cream/85) reads "A plan needs an
  account. Make one and you'll come back here." Sign-up carries `next` through the inbox
  link and Google's round trip (lib/auth.ts `withNext`), and the page each lands on ends
  on "Back to Premium" (`onwardLink`).
- The tap becomes "Create an account", linking to `/signup?next=` with the current path
  plus `paywall=1`, so the sheet reopens on return.
- The link is "I already have one", to `/signin?next=` the same.
- If signup does not honour `next`, make it, in the smallest change that works.

**Checkout off:**
- The tap opens the invite-code form exactly as today, with "Checkout opens soon. Right now
  Premium is by invite code."
- There is no secondary.

**Motion:** the sheet rises (Overlay); the stair rises in once the sheet has settled (start
at 180ms).

### 2. The plan on You (`app/you/page.tsx`, at the Premium door's place)

The plan is a `.card` p-4 that presses (0.985) and opens the manage sheet.

**Active:**
- Top row: the PremiumMark chip on the left; on the right, "Month 3" at `row` stone-500
  with the Disclosure chevron.
- Middle row:
  - Left: "This month" caption stone-500 over `A$` and `10.99` at `num-m`.
  - Right, right-aligned: "From 24 Nov" caption over `A$9.99` at `num-m`.
- The Stair: neutral, sm, picture mode, the Paw on 3.
- Foot: caption stone-500, "4 months to your lowest price, A$6.99 from 24 Feb."

The other states:

| State | What changes |
|---|---|
| Floor (month ≥ 7) | The right column is gone. The middle says "This month" `A$6.99`. Foot: "Your lowest price, every month from here." |
| Ending | Middle left: "Premium until 24 Nov" at `detail`. Foot: "Keep your plan and month 4 is A$9.99." The stair is ghosted after the current step. The card still opens the manage sheet. |
| Past due | Middle left: "Card declined" at `detail`, with the declined glyph from B in stone-500, never red. Foot: "Premium stays on while month 4's A$9.99 is retried." (the charge being retried is the renewal that failed, never this month's price). Stripe has already rolled the period into that month, so the stair's labels count month m + 1 from a month before `current_period_end`. |
| Unpaid | As past due, with "Premium is off until month 4's A$9.99 goes through." The steps are numbered, not dated: Stripe keeps rolling periods nobody pays for. |
| Invite code (premium with no billing row) | Unchanged: "Premium is on this account." |
| Free, or a plan that ended | The existing Premium door, unchanged. |
| Unknown (a profile or billing read failed or is loading) | A skeleton at the card's final height. Never the free door, never A$0.00. |

**Checkout return** (`?checkout=done`):
- Call sync once. Until it answers, the card shows its skeleton with "Switching Premium on…"
  in a `role=status`.
- On success, the CheckoutReturn moment takes the card's place for this visit:
  - DemosArt celebrate at 120 beside a SpeechBubble, "Premium is on. This is your first
    step." This is the one Demos on the page while it shows.
  - Under it, the sm stair with step 1 lit and the Paw landing, and "Month 1 A$12.99" left,
    "From 24 Nov A$11.99" right.
- Then it removes the query with `history.replaceState`.
- If sync fails, a `role=status` caption reads "Your payment went through. Premium can take
  a minute to show here." Re-read billing once after 4s.

### 3. The manage sheet (`ManageSheet`, from the plan card and from Settings)

The sheet is the `raised` neutral sheet: radius 20, grabber, `.sheet-scrim`, and Overlay
behaviour (Escape closes, focus trapped).

**Head:** the PremiumMark chip on the left, "Done" on the right (a text button, 44px).

**Active:**
- `A$` and `10.99` at `num-l`, then "this month" at body stone-500 on the same baseline.
- "Month 3. A$9.99 from 24 Nov." at body.
- The Stair: neutral, md, picture mode.
- Then an `.inset-group`:
  - "Update card and receipts", with "Opens Stripe, then brings you back." as caption and a
    Disclosure chevron. It calls the portal and sends the browser there.
  - "Cancel plan" with a Disclosure chevron.

**Confirm** (one tap on "Cancel plan"):
- The group is replaced in place: height on `--spring-base`, contents in a 200ms cross-fade.
- `detail` "Cancel your plan?", then body "Premium runs to 24 Nov. If the plan ends, the
  next one starts at A$12.99."
- Two equal buttons side by side, 48px:
  - "Keep my plan": outline, `edge` border, ink.
  - "Cancel plan": terracotta, the screen's one tap.
- Busy: "One moment…" with both disabled. Errors go in `role=alert`.
- Done: `role=status` "Cancelled. Premium runs to 24 Nov.", then the sheet becomes Ending.

**Ending:**
- The title at `title` 26/700 reads "Premium until 24 Nov", with body "Then the plan ends.
  Keep it and month 4 is A$9.99."
- The stair is ghosted after the current step.
- The tap is terracotta "Keep my plan" (resume). On success, `role=status` "You're staying.
  Month 4 is A$9.99 from 24 Nov." and the sheet goes back to Active.
- Under it, one inset row: "Update card and receipts".

**Past due:**
- The title "Card declined" with the glyph.
- Body: "Premium stays on while month 4's A$9.99 is retried."
- The stair, then the terracotta tap "Update card" (portal).
- Then the group: "Receipts" (portal) and "Cancel plan" (a confirm of its own: "Month 4's
  A$9.99 is still being retried. If it goes through, Premium runs to 24 Nov; if it fails,
  the plan ends when the retries stop.").
- Cancelled while declined, the head keeps "Card declined" over "The plan is set to end.
  Premium runs to 24 Nov if month 4's A$9.99 goes through.", and the actions are Ending's
  ("Keep my plan" and the card row). An unpaid plan cancelled says "The plan ends on 7 Nov"
  and never "Premium runs to": Premium is off. Neither offers the cancel again.

**A 409 from cancel or resume:** sync, re-render from the fresh row, and show that row's
state. Never a dead end.

### 4. Settings (`app/settings/page.tsx`)

Accounts with a billing row whose plan has not ended get one row in the account's
`.inset-group`. It reads "Manage plan" with a secondary line, then the PremiumMark chip and
the Disclosure, and it opens the same ManageSheet. The secondary line by state:
- Active: "Month 3, A$9.99 from 24 Nov"
- Floor: "Month 9, A$6.99"
- Ending: "Ends 24 Nov"
- Past due: "Card declined" (cancelled: "Card declined, set to end")
- Unpaid: "Card declined" (cancelled: "Card declined, ends 7 Nov")

While the plan is unknown, a device that last saw a plan here (`ethos.plan.row`) holds the
row's place with its skeleton; a failed read says "Premium didn't load." with its retry.

### 5. The price-drop moment (`PriceDropSheet`)

**When it shows:**
- The plan is live, `ladder_month >= 2`, and `ladder_month` is greater than the last month
  this device saw.
- The last month seen is stored in `localStorage` under `ethos.ladder.seen`, inside
  try/catch.
- On first sight there is no stored value: store the current month silently, with no
  celebration.
- Checkout return stores 1.
- A plan whose month went down (a new plan) stores silently.

It is mounted on Today and on You; the stored key keeps it to once.

**The sheet** is plum `.card-premium` (the logged third Premium surface):
- A head row: DemosArt celebrate at 112 with a SpeechBubble, "Your price dropped. Month 4
  starts today."
- The readout: `A$` and the price at `num-hero` 56/800, which rolls from 10.99 to 9.99 when
  the Paw lands.
- A caption: "A$8.99 from 24 Dec." At the floor it reads "Your lowest price, every month
  from here."
- The Stair: plum, lg, stage mode, hopping from 3 to 4.
- The tap is terracotta "Done".
- Reduced motion shows the end state with a fade.

## Copy

All of it is above, verbatim. Per screen there is at most one negation, zero em dashes and
no fragments as sentences. Every new string is added to whatever `lib/copy.test.ts` scans,
if it scans components.

## Terms and Privacy

Terms gets a "Premium and billing" section in the page's voice. It covers:
- one plan, billed monthly in A$, GST included;
- the ladder as a small table, months 1 to 6 and "7 on";
- it renews on the day it started until cancelled;
- cancel in the app (Settings, Manage plan, or You), with Premium running to the end of the
  paid month;
- months are counted in a row on one plan;
- a declined payment is retried for about two weeks and the plan keeps its place;
- if a plan ends, a new plan starts at month 1;
- price changes are emailed at least 30 days ahead and never touch a paid month;
- there are no part-month refunds except where the Australian Consumer Law requires them;
- coins, stars, streaks and scores are never for sale.

Update the page's date to 25 October 2026.

Privacy names Stripe:
- Stripe takes the payment and holds the card. Ethos never sees the card number.
- Ethos keeps the Stripe customer id, the plan's status and the months paid.
- Deleting the account ends the plan at once. The delete confirm says so before anyone
  types DELETE: "Your plan ends now too, with no refund for the days left to 24 Nov."

## Checklist (implementers tick it, reviewers verify it)

- [ ] Exactly one terracotta fill on every screen and sheet, in every state.
- [ ] No sage anywhere on the ladder. Plum only on the paywall, the price-drop sheet and
      the PremiumMark.
- [ ] The paywall at 390 shows the ladder head, readout, stair and caption without
      horizontal scroll. At 320 nothing clips or wraps the step faces.
- [ ] The slider:
  - [ ] works with ←/→/Home/End, drag and tap;
  - [ ] VoiceOver hears "Month n, from date, price";
  - [ ] the sr-only list is read once.
- [ ] Reduced motion: no rise, hop or roll; there is a fade.
- [ ] Each You plan state renders at its own height with no layout shift when the data
      lands. The unknown state is a skeleton, never the free door.
- [ ] Cancel is reachable in two taps from You (card, Cancel plan, confirm counts as the
      second tap on "Cancel plan"). It is never hidden or greyed.
- [ ] Every date is computed after mount from the billing row. Month labels follow
      Stripe's clamped anchor day (unit tested: 31 Jan → 28 Feb → 31 Mar).
- [ ] `?checkout=done` syncs once, celebrates once, and cleans the URL.
- [ ] The price-drop moment shows exactly once per new month across Today and You, never
      on first sight, never for month 1.
- [ ] Every new user-facing string has no em dash, no gym words, no "rep", and at most one
      negation per screen.
- [ ] Terms states the ladder, the renewal, the cancel path, the reset rule, retries and
      refunds.
- [ ] `npx tsc --noEmit`, `npx vitest run` and `next build` pass, and the six browser
      gates hold their counts.
- [ ] Look loop shots for each surface and state, light and dark, at 390, plus the paywall
      at 320. They are viewed and the top three differences fixed.
