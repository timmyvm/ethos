/**
 * The shift's before-and-after gallery (DECISIONS #252-#260).
 *
 * Composes the shots in `docs/look/shift/` into one sheet, in the order
 * the change actually happens: what the first card was, the three it
 * could become, the traits underneath it, and the lesson that comes out
 * of them.
 *
 * Light and dark sit side by side in each row rather than in two
 * separate sheets, because the comparison worth making here is between
 * the themes, not between the halves of a long scroll. A row narrow
 * enough to leave the sheet half empty carries its caption beside the
 * shots instead of above them.
 *
 * Run after the shift's walk has taken the shots:
 *
 *   node scripts/gallery-shift.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { existsSync, readFileSync } from "node:fs";

const DIR = "docs/look/shift/";
const OUT = "docs/look/shift/gallery.png";

const img = (name) =>
  existsSync(DIR + name)
    ? `data:image/png;base64,${readFileSync(DIR + name).toString("base64")}`
    : null;

/**
 * Each row: a title, a caption, and the shots that belong to it. `crop`
 * cuts a full-page shot down to the part the row is about, so a long
 * scroll does not dominate a sheet that is making a point about its
 * first card.
 */
const ROWS = [
  {
    title: "Before",
    note: "The first card led with an index out of a thousand: a number nobody has an instinct for, which has to be learned before it can mean anything. Underneath it, a fixed road that was the same road for everybody.",
    width: 300,
    crop: 620,
    shots: [["today-shift-before", "Today"]],
  },
  {
    title: "Three first cards, one shell",
    note: "A position among people, a duration, and a rate turned into the gap between. Rendered in the same shell so the choice is between the metrics rather than between three card designs.",
    width: 300,
    shots: [["home-cards", "A, B and C"]],
  },
  {
    title: "The traits underneath",
    note: "One ring each, the measurement first and the placement second. The literature review has landed and all five scales are still provisional: the centres are published and the between-speaker spread, which is the half a percentile is made of, is not. The dashed trough says so before the words do, and no lesson is chosen on any of them.",
    width: 300,
    shots: [["traits", "Five traits"]],
  },
  {
    title: "One lesson, because a number said so",
    note: "Name the trait with its percentile, why a listener cares, the technique, the same sentence said two ways, sixty seconds, and then the ring moves in front of them.",
    width: 176,
    lanes: true,
    shots: [
      ["lesson-1-name", "1 name"],
      ["lesson-2-why", "2 why"],
      ["lesson-3-how", "3 how"],
      ["lesson-4-example", "4 example"],
      ["lesson-5-practice", "5 practice"],
      ["lesson-6-after", "6 after"],
    ],
  },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1240, height: 900 });

const figure = (row, name, cap, theme) => {
  const src = img(`${name}-${theme}.png`);
  if (!src) return "";
  const box = row.crop
    ? `height:${row.crop}px;overflow:hidden;position:relative`
    : "";
  const fade = row.crop ? `<span class="fade ${theme}"></span>` : "";
  return `<figure style="width:${row.width}px">
    <div class="shot ${theme}" style="width:${row.width}px;${box}">
      <img src="${src}" style="width:${row.width}px">${fade}
    </div>
    <figcaption>${cap}<span class="t">${theme}</span></figcaption>
  </figure>`;
};

/** A lane is one theme's full set of steps, kept on its own line. */
const lane = (row, theme) =>
  `<div class="lane">${row.shots.map(([n, c]) => figure(row, n, c, theme)).join("")}</div>`;

const section = (row) => {
  const body = row.lanes
    ? `${lane(row, "light")}${lane(row, "dark")}`
    : `<div class="lane">${row.shots
        .flatMap(([n, c]) => ["light", "dark"].map((t) => figure(row, n, c, t)))
        .join("")}</div>`;
  if (!body.includes("<img")) return "";
  const head = `<h2>${row.title}</h2><p class="note">${row.note}</p>`;
  // A row of one shot per theme would leave most of the sheet empty, so
  // its caption stands in the space instead of above it.
  return row.lanes
    ? `<section>${head}${body}</section>`
    : `<section class="beside"><div class="shots">${body}</div><div class="aside">${head}</div></section>`;
};

await page.setContent(`
  <style>
    body { margin:0; background:#e7dcc6; color:#4b4539; font:12px/1.5 ui-sans-serif,system-ui; }
    section { padding: 24px 28px 28px; border-bottom:1px solid rgba(0,0,0,.09); }
    section:last-child { border-bottom:0; }
    h2 { margin:0; font-size:11px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; }
    .note { margin:8px 0 0; max-width:880px; font-size:12.5px; line-height:1.65; opacity:.78; }
    section > .note, section > h2 + .note { margin-bottom:18px; }
    .beside { display:flex; gap:34px; align-items:flex-start; }
    .beside .aside { flex:1; max-width:430px; padding-top:2px; }
    .beside .aside .note { margin-bottom:0; }
    .lane { display:flex; gap:14px; align-items:flex-start; margin-bottom:14px; }
    .lane:last-child { margin-bottom:0; }
    figure { margin:0; }
    .shot { border-radius:5px; overflow:hidden; box-shadow:0 1px 0 rgba(0,0,0,.14), 0 8px 22px rgba(0,0,0,.10); }
    img { display:block; }
    .fade { position:absolute; left:0; right:0; bottom:0; height:56px; }
    .fade.light { background:linear-gradient(to bottom, rgba(239,227,205,0), #efe3cd); }
    .fade.dark  { background:linear-gradient(to bottom, rgba(15,13,11,0), #0f0d0b); }
    figcaption { padding-top:8px; font:9.5px/1 ui-monospace,monospace; letter-spacing:.1em; text-transform:uppercase; opacity:.7; }
    .t { margin-left:8px; opacity:.6; }
  </style>
  ${ROWS.map(section).join("")}
`);
await page.waitForTimeout(600);
await page.screenshot({ path: OUT, fullPage: true });
console.log(`gallery → ${OUT}`);
await browser.close();
