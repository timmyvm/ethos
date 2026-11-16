/**
 * Best round yet's card for the stat icons' camera (#487 review): the
 * results walk's Moment with a Q&A level 2 best broken (38s clean after
 * the cut-in, past your 31s), rendered from the component itself so the
 * shot cannot drift from the code. No camera walks a whole round to it.
 *
 *   npx vite-node --config vitest.config.ts scripts/moment-fixture.ts > /tmp/moment.html
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Moment } from "@/components/Moment";
import { bestMoment } from "@/lib/round-copy";

const moment = bestMoment({ gameId: "qa", level: 2, before: 31, now: 38 });
if (!moment) throw new Error("no moment: the fixture no longer breaks a best");
process.stdout.write(renderToStaticMarkup(createElement(Moment, { moment })));
