/**
 * Tester presence's boot script (#402): inlined into the document head
 * by the root layout, it runs before paint and before React hydrates.
 * On a device holding the tester hint, during the test or the week
 * after it, it marks the page (`html[data-test-tile]`), and Today's
 * server-rendered page holds the test tile's 208px from its first paint
 * (`.test-tile-slot`, app/page.tsx). Without it a reload painted Today
 * without the tile, and hydration then pushed everything under the
 * practice card down 220px (DESIGN rule 8).
 *
 * The same rule as lib/tester-client.ts `useTestPresence`, which keeps
 * the mark in step once React runs: the hint, and today's date in the
 * zone the test's days are counted in (lib/tester-days.ts `testZone`).
 *
 * A plain module and a plain string, like lib/theme-boot.ts and for its
 * reason: a value a server component imports from a client module
 * reaches the browser as a reference to that module's chunk.
 */

import { TEST } from "@/content/tester";
import { PUSH_ACK_KEY } from "./reminders-zone";
import { addDays } from "./tester-days";
import { TESTER_HINT_KEY } from "./tester-signal";

/** The last day Today shows the tile: a week after the test's last. */
export const TEST_SHOWN_UNTIL = addDays(TEST.last, TEST.shownAfter);

export const testerBootScript = `
(function(){try{
  if (localStorage.getItem(${JSON.stringify(TESTER_HINT_KEY)}) !== '1') return;
  var zone = ${JSON.stringify(TEST.zone)};
  try {
    var ack = JSON.parse(localStorage.getItem(${JSON.stringify(PUSH_ACK_KEY)}) || 'null');
    if (ack) zone = ack.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
  } catch (e) {}
  var day = function (z) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  };
  var today;
  try { today = day(zone); } catch (e) { today = day(${JSON.stringify(TEST.zone)}); }
  if (today >= ${JSON.stringify(TEST.first)} && today <= ${JSON.stringify(TEST_SHOWN_UNTIL)}) {
    document.documentElement.setAttribute('data-test-tile', '');
  }
}catch(e){}})();
`;
