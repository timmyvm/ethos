/**
 * The six stat drawings: the marks a count or a mode stands beside.
 * Streak, XP, best, freeze (the counts), and Hostile Q&A and the weekly
 * boss (Today's two games). The method, the primitives and their
 * exceptions are in primitives.ts.
 *
 * Client-safe on purpose: FlatIcon (and StatIcon through it) imports
 * this file and primitives.ts, nothing else, so the lesson objects
 * (lesson-drawings.ts) never reach the browser bundle. Every kind here
 * has an unlit grey for every role it names (flat-icons.css), because
 * any of them can be drawn on a day not yet earned.
 */
import { LIGHT_MIN_PX, at, centre, poly, ring, scale, type FlatIconDef, type Pt, type Shape } from "./primitives";

/* ------------------------------------------------------------------ */
/* The streak: a flame of Ethos's own, every side a tangent arc. A round */
/* foot, the left side one convex sweep up into a tapered lick, a tall  */
/* centre tongue, and a lower lick on the right that rises out of a     */
/* deep V and flicks back (the S on its outer side). All three lean     */
/* right, as a flame does in a draught; their tips stand at y 4, 15 and */
/* 27, staggered so they never read as a crown.                         */
/*                                                                      */
/* Inside it, one lighter tongue in the same family (amber, never lemon)*/
/* rises from the foot's lower left along the body's lean and is cut by */
/* the outline: off-centre, leaning, under half the height. Never the  */
/* arrangement of an orange flame with a yellow teardrop centred inside */
/* it. The shade is a crescent on the foot's lower right, the light a   */
/* slim pill up the centre tongue's left face.                          */
/*                                                                      */
/* Drawn with an arc-only pen (each step one arc of a radius and a      */
/* turn), solved so the tips and notches land where they are set, then  */
/* scaled to 88u tall and centred; the numbers below are that drawing,  */
/* baked. Its floor is 20px (You is 22, Today's chips 20).              */
/*                                                                      */
/* The first of the arc exceptions (primitives.ts). Fire is curves:     */
/* drawn with straight sides and 6u tips it read as a mitten from 120px */
/* up, and Ethos shows it at 380 on the streak moment. So its tips may  */
/* be sharper (the main tip 3 to 4u, the side tips about 4u, a notch's  */
/* round 4.5u at least); nothing else drops under the method: the gaps  */
/* and bands stay 12u, the notches 10 to 12u open.                      */
/* ------------------------------------------------------------------ */

/**
 * Clockwise from the bottom of the foot, 15 arcs and no line:
 *  1. A28.6   foot, to the lower left          9. A3.64   main tip (y 4)
 *  2. A50     left side (one convex sweep)    10. A63.2   centre tongue, right edge (concave)
 *  3. A64.1   up into the left lick           11. A5.2    right notch, a V (bottom y 44)
 *  4. A3.9    left tip (y 15)                 12. A26     right lick, inner edge
 *  5. A20.8   the lick's inner flank, convex  13. A4.16   right tip (y 27)
 *     for 6u so the lick tapers               14. A45.3   the right lick's S (concave)
 *  6. A24.4   then concave into the notch     15. A36     foot, right side, back to the bottom
 *  7. A4.68   left notch, a V (bottom 35,31; 12u open at y 24)
 *  8. A73.3   centre tongue, left edge
 */
const FLAME_D =
  "M47.35 92A28.6 28.6 0 0 1 25.66 82.04A49.96 49.96 0 0 1 17.09 67.85A64.08 64.08 0 0 1 18.84 16.7A3.9 3.9 0 0 1 25.76 16.46A20.82 20.82 0 0 1 27.89 21.85A24.44 24.44 0 0 0 30.39 28.21A4.68 4.68 0 0 0 38.79 27.68A73.3 73.3 0 0 1 53.44 5.13A3.64 3.64 0 0 1 59.65 8.36A63.19 63.19 0 0 0 61.35 40.21A5.2 5.2 0 0 0 71.44 39.44A26.04 26.04 0 0 1 75.78 28.64A4.16 4.16 0 0 1 83.25 31.93A45.26 45.26 0 0 0 82.83 49.71A36.05 36.05 0 0 1 47.35 92Z";

/* The shade's inner edge: one arc of r 94 from the right side just under
   the right lick (82.5, 36.3) to the foot at (39.3, 90.8), bowed down and
   to the right so it follows the foot as a crescent, 14u at its widest.
   Its other sides lie outside the flame. */
const FLAME_SHADE_D = "M82.5 36.34A93.67 93.67 0 0 1 39.25 90.83L39.25 132.59L130.99 132.59L130.99 36.34Z";

/* The inner tongue: its left edge one convex arc (r 50) up to a 3u tip at
   (35, 49), a short concave flick (r 12.5, 5u) under the tip, then one
   convex arc (r 25) down to the outline at (28, 84.5). It touches the
   outline only on the foot's lower left (about 6% of it), 12u clear of the
   shade and 16u of the light. The long arcs and lines past its ends lie
   outside the flame and are cut by the clip. */
const FLAME_INNER_D =
  "M13.2 107.17A416.3 416.3 0 0 1 14.15 85.4A49.96 49.96 0 0 1 33.23 49.52A3.12 3.12 0 0 1 38.2 52.63A12.49 12.49 0 0 0 38.25 58.03A24.98 24.98 0 0 1 25.64 85.7A416.3 416.3 0 0 1 12.69 92.3L12.69 113.86L-29.28 113.86L-29.28 107.17Z";

const streak: FlatIconDef = {
  name: "flame",
  layers: [
    { part: "base", tone: "base", shapes: [{ kind: "path", d: FLAME_D }] },
    { part: "shade", tone: "shade", clip: ["base"], shapes: [{ kind: "path", d: FLAME_SHADE_D }] },
    { part: "inner", tone: "inner", clip: ["base"], shapes: [{ kind: "path", d: FLAME_INNER_D }] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      clip: ["base"],
      // A streak up the centre tongue's left face, leaning with it (31°), wholly
      // inside the tongue: 8 by 19, as slim as the cup's and the bolt's. The
      // old 12 by 18 pill sat across the notch's rim and read as a bean from
      // 200px up.
      shapes: [{ kind: "pill", cx: 49, cy: 24, w: 8, h: 19, angle: 31 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* XP: a bolt, upright and heavy, cut from two rounded triangles' worth  */
/* of polygon. The shade is the lower blade's right face.               */
/* ------------------------------------------------------------------ */
/* The vertices stand outside the grid on purpose: a 6u round on a tip of
   35 degrees takes about 16u off its point, so each tip is set that much
   further out for the drawn bolt to fill 86u. */
const BOLT: readonly Pt[] = scale(
  [
    [58, -4], // top
    [8, 58], // left tip
    [44, 58], // notch, left (concave)
    [36, 102], // bottom tip
    [88, 38], // right tip
    [54, 38], // notch, right (concave)
  ],
  1.13,
);
const BOLT_R = 6;

const xp: FlatIconDef = {
  name: "lightning bolt",
  fit: { scale: 0.96, dy: 0.2 },
  layers: [
    { part: "base", tone: "base", shapes: [poly(BOLT, BOLT_R)] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([BOLT[5], [110, BOLT[4][1]], [BOLT[3][0], 120], BOLT[2]], 0)],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 38, cy: 30, w: 9, h: 22, angle: 39 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Best: a cup. A U bowl, a stem, a base, two ring handles. The shade is */
/* the cup's right third, the light a pill in the bowl's left.          */
/* ------------------------------------------------------------------ */
const BOWL: readonly Pt[] = [
  [24, 8],
  [72, 8],
  [72, 52],
  [24, 52],
];
const best: FlatIconDef = {
  name: "trophy",
  fit: { scale: 1.049, dy: -1 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [
        ring(23, 27, 16, 6),
        ring(73, 27, 16, 6),
        poly(BOWL, [6, 6, 24, 24]),
        poly([[40, 46], [56, 46], [58, 72], [38, 72]], [0, 0, 4, 4]),
        poly([[24, 72], [72, 72], [72, 90], [24, 90]], 7),
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([[58, 0], [96, 0], [96, 96], [58, 96]], 0)],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 34, cy: 25, w: 9, h: 20 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The freeze: a snowflake. Three pills cross to six arms; each arm     */
/* carries one V. The shade falls on the lower right arms.              */
/*                                                                      */
/* Drawn for 20 and 24px first (it was soft there): the Vs open at 50°  */
/* and sit out at 24u, where the arms are far enough apart that a V     */
/* never meets its neighbour's (7u clear; they touched before, which    */
/* filled the flake into a hexagon of specks at 20px), and each arm is  */
/* 12u, 3px at 24. The fit moves it 2u right so the upright arm lands   */
/* on whole pixels at 24px (columns 11 to 14) and its ends on rows 1    */
/* and 23; the slanted arms cannot snap and need not.                   */
/* ------------------------------------------------------------------ */
const C = 48;
const ARM = 44;
const ARM_W = 12;
const V_AT = 24;
const V_LEN = 12;
const V_W = 10;
const V_DEG = 50;
const armShapes: Shape[] = [90, 30, -30].map((deg) => ({
  kind: "pill",
  cx: C,
  cy: C,
  w: ARM * 2,
  h: ARM_W,
  angle: deg,
}));
const branchShapes: Shape[] = [];
for (const deg of [-90, -30, 30, 90, 150, 210]) {
  const [bx, by] = at(C, C, deg, V_AT);
  for (const side of [-1, 1]) {
    const dir = deg + side * V_DEG;
    const [mx, my] = at(bx, by, dir, V_LEN / 2);
    branchShapes.push({ kind: "pill", cx: mx, cy: my, w: V_LEN + V_W, h: V_W, angle: dir });
  }
}
const freeze: FlatIconDef = {
  name: "snowflake",
  fit: { scale: 1, dx: 2 },
  layers: [
    { part: "base", tone: "base", shapes: [...armShapes, ...branchShapes] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "circle", cx: 96, cy: 96, r: 52 }],
    },
    {
      part: "light",
      tone: "light",
      minPx: 32,
      clip: ["base"],
      shapes: [{ kind: "pill", ...centre(at(C, C, 210, 31)), w: 12, h: 7, angle: 30 }],
    },
  ],
};


/* ------------------------------------------------------------------ */
/* Hostile Q&A (Today's row only): a speech bubble struck by a bolt.     */
/* The bolt is XP's own, scaled into the bubble, so the set has one     */
/* bolt. No pool under it in the row: a bubble floats, it never stands. */
/* The bubble is a slab, so it takes the boxy objects' shade, a straight */
/* split on the right like the cup's and the mountain's. At x 60 it     */
/* runs through the bolt's right arm (the bolt spans x 30 to 66), so it */
/* never grazes the bolt's tip; the old corner circle read as a page    */
/* curling up.                                                          */
/* ------------------------------------------------------------------ */
/* Half XP's bolt, centred on the bubble's body, so 9u of coral stay clear
   above and below it (the worktree's bolt came within 4u of the foot). */
const HOSTILE_BOLT: readonly Pt[] = BOLT.map(([x, y]) => [48 + (x - 48) * 0.5, 40 + (y - 49.4) * 0.5] as Pt);
const hostile: FlatIconDef = {
  name: "speech bubble with a bolt",
  fit: { scale: 1.024, dy: 3.5 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [
        poly([[6, 8], [90, 8], [90, 72], [6, 72]], 22),
        poly([[18, 61], [44, 61], [14, 92]], [4, 4, 6]),
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([[60, 0], [100, 0], [100, 100], [60, 100]], 0)],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 22, cy: 24, w: 14, h: 8 }],
    },
    { part: "bolt", tone: "bolt", shapes: [poly(HOSTILE_BOLT, 3.5)] },
  ],
};

/* ------------------------------------------------------------------ */
/* The weekly boss (Today's row only): a mountain with a pennant on its */
/* peak. Two peaks, so it reads as a mountain and never as a cone (on   */
/* white the old one-peak drawing lost its snow to the ground and stood */
/* as a blue triangle on its pool). The main peak is split at its apex, */
/* its right face in shade, and stands in front of a lower back peak    */
/* drawn whole in the base: split too, the back peak's lit face was an  */
/* 8u sliver beside the shade. Each peak wears a snow cap with a wavy   */
/* foot, in a pale blue that keeps its edge on white; the pole rises    */
/* from the main peak behind it.                                        */
/* ------------------------------------------------------------------ */
const PEAK: Pt = [40, 30];
const PEAK2: Pt = [68, 46];
const MOUNTAIN: readonly Pt[] = [PEAK, [78, 88], [4, 88]];
const MOUNTAIN2: readonly Pt[] = [PEAK2, [92, 88], [44, 88]];
/* The main peak's right side, carried on to the grid's foot. */
const SHADE_FOOT: Pt = [PEAK[0] + ((78 - PEAK[0]) * (100 - PEAK[1])) / (88 - PEAK[1]), 100];
const boss: FlatIconDef = {
  name: "mountain with a flag",
  fit: { scale: 1.04, dy: 1 },
  layers: [
    {
      part: "pole",
      tone: "pole",
      shapes: [{ kind: "pill", cx: PEAK[0], cy: 24, w: 10, h: 34 }],
    },
    {
      part: "flag",
      tone: "flag",
      shapes: [poly([[PEAK[0] + 2, 5], [PEAK[0] + 35, 15], [PEAK[0] + 2, 25]], [3, 4.5, 3])],
    },
    { part: "base", tone: "base", shapes: [poly(MOUNTAIN2, [5, 6, 6]), poly(MOUNTAIN, [8, 6, 6])] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([PEAK, SHADE_FOOT, [PEAK[0], 100]], 0)],
    },
    {
      part: "snow",
      tone: "snow",
      clip: ["base"],
      shapes: [
        poly([[10, 10], [70, 10], [58, 47], [50, 55], [40, 48], [30, 55], [22, 47]], [0, 0, 4, 5, 5, 5, 4]),
        poly([[PEAK2[0] - 14, 30], [PEAK2[0] + 14, 30], [PEAK2[0] + 9, 57], [PEAK2[0] + 2, 62], [PEAK2[0] - 3, 56], [PEAK2[0] - 8, 60]], [0, 0, 3, 3, 3, 3]),
      ],
    },
  ],
};


export const STAT_ICONS = { streak, xp, best, freeze, hostile, boss } as const;
export type StatFlatKind = keyof typeof STAT_ICONS;
export const STAT_FLAT_KINDS = Object.keys(STAT_ICONS) as StatFlatKind[];
