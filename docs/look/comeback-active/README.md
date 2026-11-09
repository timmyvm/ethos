# Who is active (#431), shot with fixtures

`/active`, Timothy's page for watching whether testers come back. Shot on 9 Nov 2026 at 20:30 Melbourne with invented data shaped like the week measured that day: 21 current testers, four recording nearly every day, three more on the 8th, two the day before, six who recorded one to three days and stopped, six who joined and never recorded, three with reminders on, and one tester who stopped testing (so the last row reads Tester 22: numbers never move). No real tester's data is in these shots.

The data goes through the page's own aggregation (`lib/active.ts`), printed by `scripts/active-fixtures.ts`; the camera (`scripts/look-active.mjs`) answers `/api/active` with it.

| Shot | What it shows |
|---|---|
| `active-390-light.png`, `-dark`, `active-375-light.png` | The founder's first screen: today's two numbers, the fourteen days' totals, the first rows |
| `active-390-light-full.png` | The whole page: every row, "You" last and out of the totals, the legend |
| `active-loading-390-light.png` | The skeleton at the landed card's height |
| `active-failed-390-light.png` | A read that failed, with Try again |
| `active-not-founder-390-light.png` | Anyone else, and anyone while `ADMIN_EMAILS` is unset: the app's own Nothing here |
