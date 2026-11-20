/**
 * The flat icons' drawings (workbench only: app/workbench/icons, nothing
 * in the app reads this yet).
 *
 * Every icon is drawn on one 96-unit master grid (24px at 4x) from three
 * primitives: a rounded polygon (rectangles and triangles with a set
 * radius on every corner), a circle, and a pill. No freehand curve, no
 * bulging side: between two corners a side is straight, and a corner is
 * one clean arc of the radius it is given (6u at least, tips 6 to 8u).
 *
 * One exception, the streak's flame. Fire is curves: drawn with straight
 * sides and 6u tips it read as a mitten from 120px up (round 1, the
 * campfire), and Ethos shows it at 380 on the streak moment. So the flame
 * is built from circular arcs only, never a line, every join tangent (a
 * concave arc where a tongue flicks or a notch opens), and its tips may
 * be sharper: the main tip 3 to 4u, the side tips about 4u, a notch's
 * round 4.5u at least. Nothing else in it drops under the method: the
 * gaps and bands stay 12u, the notches 10 to 12u open.
 *
 * Each icon is a short stack of named layers: `base` (the silhouette),
 * `shade` (one flat shape in the same hue, clipped inside the
 * silhouette, on the side away from the light), `light` (one small
 * flat shape near the top left, only drawn from 24px up), and where the
 * object needs it a second colour (a target's rings, a dart, sand) or,
 * for the flame alone, `inner`: one lighter, warmer tongue of the same
 * family, drawn at every size. A
 * layer names a colour role, never a colour: the role is read from a CSS
 * variable, `--fi-<kind>-<role>` (components/icons/flat/flat-icons.css),
 * so a variant or a theme swaps every tone without touching a path.
 *
 * Light comes from the top left for the whole set.
 */

export type Pt = readonly [number, number];

export type Shape =
  | { kind: "path"; d: string; evenodd?: boolean }
  | { kind: "circle"; cx: number; cy: number; r: number }
  /** A rounded rectangle centred on (cx, cy), turned by `angle` degrees. `r` defaults to half the short side: a pill. */
  | { kind: "pill"; cx: number; cy: number; w: number; h: number; angle?: number; r?: number };

export type Layer = {
  /** What the layer is: base, shade, light, or the object's own part (ring, dart, sand). */
  part: string;
  /** The colour role it fills with: `--fi-<kind>-<tone>`. */
  tone: string;
  shapes: readonly Shape[];
  /** Clipped to the union of these parts' shapes (a shade stays inside its silhouette). */
  clip?: readonly string[];
  /** Drawn only at this size (CSS px) and over: the highlight leaves at 20px. */
  minPx?: number;
};

export type FlatIconDef = {
  /** What a stranger should say at 24px with no label. */
  name: string;
  layers: readonly Layer[];
  /**
   * Scaled about the grid's centre, then moved, so the drawn icon fills
   * 84 to 88u whatever its drawing's own extent (a round tip draws short of
   * its vertex). Measured, never guessed: the board prints each icon's box.
   */
  fit?: { scale: number; dx?: number; dy?: number };
};

export const FLAT_GRID = 96;

/** The light's floor: under 24px an icon is its base and shade only (the size ladder). */
export const LIGHT_MIN_PX = 24;

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * A polygon with a round corner at every vertex, convex or concave. `radii`
 * is one radius for every corner or one per vertex. Where two corners
 * want more of a side than it has, both are shortened in proportion, so
 * a big radius can turn a whole side into one arc (a cup's round bottom)
 * without overlapping its neighbour.
 */
export function roundedPolygon(points: readonly Pt[], radii: number | readonly number[]): string {
  const n = points.length;
  const want = points.map((_, i) => (typeof radii === "number" ? radii : radii[i]));
  const geo = points.map((p, i) => {
    const p0 = points[(i - 1 + n) % n];
    const p2 = points[(i + 1) % n];
    const ax = p0[0] - p[0];
    const ay = p0[1] - p[1];
    const bx = p2[0] - p[0];
    const by = p2[1] - p[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    const half = Math.acos(cos) / 2;
    const tan = Math.tan(half);
    return { ua: [ax / la, ay / la], ub: [bx / lb, by / lb], la, lb, tan, d: want[i] / tan };
  });
  // Each side is shared by two corners; neither may take more than its share.
  const d = geo.map((g) => g.d);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const side = geo[i].lb;
    const sum = geo[i].d + geo[j].d;
    if (sum > side) {
      d[i] = Math.min(d[i], (geo[i].d / sum) * side);
      d[j] = Math.min(d[j], (geo[j].d / sum) * side);
    }
  }
  const corners = points.map((p, i) => {
    const g = geo[i];
    const p0 = points[(i - 1 + n) % n];
    const p2 = points[(i + 1) % n];
    const cross = (p[0] - p0[0]) * (p2[1] - p[1]) - (p[1] - p0[1]) * (p2[0] - p[0]);
    return {
      t1: [p[0] + g.ua[0] * d[i], p[1] + g.ua[1] * d[i]],
      t2: [p[0] + g.ub[0] * d[i], p[1] + g.ub[1] * d[i]],
      r: d[i] * g.tan,
      sweep: cross > 0 ? 1 : 0,
    };
  });
  let out = `M${fmt(corners[0].t2[0])} ${fmt(corners[0].t2[1])}`;
  for (let k = 1; k <= n; k++) {
    const c = corners[k % n];
    out += `L${fmt(c.t1[0])} ${fmt(c.t1[1])}A${fmt(c.r)} ${fmt(c.r)} 0 0 ${c.sweep} ${fmt(c.t2[0])} ${fmt(c.t2[1])}`;
  }
  return `${out}Z`;
}

/** A circle as a path (two arcs), so it can sit in an evenodd ring. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`;
}

/** A ring: a disc with a round hole, filled evenodd. */
function ring(cx: number, cy: number, outer: number, inner: number): Shape {
  return { kind: "path", d: circlePath(cx, cy, outer) + circlePath(cx, cy, inner), evenodd: true };
}

const poly = (points: readonly Pt[], radii: number | readonly number[]): Shape => ({
  kind: "path",
  d: roundedPolygon(points, radii),
});

/** Points scaled about the grid's centre (48, 48). */
function scale(points: readonly Pt[], k: number): Pt[] {
  return points.map(([x, y]) => [48 + (x - 48) * k, 48 + (y - 48) * k]);
}

/** A point `along` units down a direction (degrees) from (x, y), then `across` to its right. */
function at(x: number, y: number, deg: number, along: number, across = 0): Pt {
  const a = (deg * Math.PI) / 180;
  return [x + Math.cos(a) * along - Math.sin(a) * across, y + Math.sin(a) * along + Math.cos(a) * across];
}

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
/* pill on the centre tongue's left face.                               */
/*                                                                      */
/* Drawn with an arc-only pen (each step one arc of a radius and a      */
/* turn), solved so the tips and notches land where they are set, then  */
/* scaled to 88u tall and centred; the numbers below are that drawing,  */
/* baked. Its floor is 20px (You is 22, Today's chips 20).              */
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
   shade and 10.5u of the light. The long arcs and lines past its ends lie
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
      // Along the centre tongue's left face, 4u inside the outline at the notch's rim.
      shapes: [{ kind: "pill", cx: 47.5, cy: 33, w: 12, h: 18, angle: 28 }],
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
/* carries one V near its end. The shade falls on the lower right arms. */
/* ------------------------------------------------------------------ */
const C = 48;
const ARM = 42;
const ARM_W = 13;
const V_AT = 21;
const V_LEN = 13;
const V_W = 10;
const V_DEG = 56;
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
  fit: { scale: 1.024 },
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
      shapes: [{ kind: "pill", ...centre(at(C, C, 210, 30)), w: 12, h: 7, angle: 30 }],
    },
  ],
};

function centre([x, y]: Pt) {
  return { cx: x, cy: y };
}

/* ------------------------------------------------------------------ */
/* Know how it ends: a target with a dart in its middle. Three rings    */
/* (base, ring colour, base), the dart in a second hue lying across it  */
/* from the top right, its flight a rounded triangle.                   */
/* ------------------------------------------------------------------ */
const TX = 44;
const TY = 52;
const DART_DEG = 135; // from the tail, down and left into the bullseye
const TAIL: Pt = [74, 22];
/* The flight: two swept fins either side of the tail, so it reads as
   feathers and never as a knob. */
const fins = (): Shape[] =>
  [-1, 1].map((side) => {
    const [x, y] = TAIL;
    return poly(
      [at(x, y, DART_DEG, 12, side * 3), at(x, y, DART_DEG, -11, side * 18), at(x, y, DART_DEG, -13, side * 3)],
      [3, 5, 3],
    );
  });
const target: FlatIconDef = {
  name: "target with a dart",
  fit: { scale: 1, dx: 0.2, dy: -0.2 },
  layers: [
    { part: "base", tone: "base", shapes: [{ kind: "circle", cx: TX, cy: TY, r: 39 }] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "path", d: circlePath(TX, TY, 40) + circlePath(TX - 7, TY - 7, 41), evenodd: true }],
    },
    { part: "ring", tone: "ring", shapes: [ring(TX, TY, 27, 14)] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", ...centre(at(TX, TY, 222, 33)), w: 14, h: 8, angle: 132 }],
    },
    {
      part: "dart",
      tone: "dart",
      shapes: [
        { kind: "pill", ...centre(at(TAIL[0], TAIL[1], DART_DEG, 18)), w: 60, h: 10, angle: DART_DEG },
        ...fins(),
      ],
    },
    {
      part: "dart-shade",
      tone: "dart-shade",
      clip: ["dart"],
      shapes: [poly([at(TAIL[0], TAIL[1], DART_DEG, -12, 0), at(TAIL[0], TAIL[1], DART_DEG, 60, 0), at(TAIL[0], TAIL[1], DART_DEG, 60, -30), at(TAIL[0], TAIL[1], DART_DEG, -12, -30)], 0)],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The two-second pause: an hourglass. Two caps, a glass of two rounded  */
/* triangles meeting at a 12u waist, sand in the bottom and a last heap */
/* in the top.                                                          */
/* ------------------------------------------------------------------ */
const GLASS: readonly Pt[] = [
  [22, 14],
  [74, 14],
  [55, 48],
  [74, 82],
  [22, 82],
  [41, 48],
];
const hourglass: FlatIconDef = {
  name: "hourglass",
  layers: [
    { part: "glass", tone: "glass", shapes: [poly(GLASS, [4, 4, 9, 4, 4, 9])] },
    {
      part: "sand",
      tone: "sand",
      clip: ["glass"],
      shapes: [poly([[20, 84], [76, 84], [48, 58]], [2, 2, 8]), poly([[28, 30], [68, 30], [48, 52]], [2, 2, 4])],
    },
    {
      part: "light",
      tone: "light",
      minPx: 32,
      clip: ["glass"],
      shapes: [{ kind: "pill", cx: 33, cy: 25, w: 7, h: 12, angle: -29 }],
    },
    {
      part: "base",
      tone: "base",
      shapes: [
        poly([[13, 5], [83, 5], [83, 19], [13, 19]], 7),
        poly([[13, 77], [83, 77], [83, 91], [13, 91]], 7),
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([[62, 0], [96, 0], [96, 96], [62, 96]], 0)],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Hostile Q&A (Today's row only): a speech bubble struck by a bolt.     */
/* ------------------------------------------------------------------ */
const hostile: FlatIconDef = {
  name: "speech bubble with a bolt",
  fit: { scale: 1.024, dy: 3.5 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [
        poly([[6, 10], [90, 10], [90, 70], [6, 70]], 22),
        poly([[18, 60], [44, 60], [14, 90]], [4, 4, 6]),
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "circle", cx: 92, cy: 104, r: 52 }],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 24, cy: 26, w: 18, h: 8 }],
    },
    {
      part: "bolt",
      tone: "bolt",
      shapes: [poly([[50, 16], [66, 16], [58, 34], [70, 34], [44, 66], [50, 44], [36, 44]], [4, 4, 3, 4, 4, 3, 4])],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The weekly boss (Today's row only): a mountain with a snow cap and a */
/* pennant on its peak.                                                 */
/* ------------------------------------------------------------------ */
const PEAK: Pt = [48, 30];
const MOUNTAIN: readonly Pt[] = [PEAK, [91, 90], [5, 90]];
const boss: FlatIconDef = {
  name: "mountain with a flag",
  fit: { scale: 1, dy: 1 },
  layers: [
    {
      part: "pole",
      tone: "pole",
      shapes: [{ kind: "pill", cx: 48, cy: 22, w: 10, h: 36, r: 5 }],
    },
    {
      part: "flag",
      tone: "flag",
      shapes: [poly([[50, 5], [80, 14], [50, 24]], [4, 6, 4])],
    },
    { part: "base", tone: "base", shapes: [poly(MOUNTAIN, [9, 8, 8])] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([PEAK, [96, 96], [62, 96]], 0)],
    },
    {
      part: "snow",
      tone: "snow",
      clip: ["base"],
      shapes: [poly([[20, 20], [76, 20], [72, 56], [60, 50], [48, 58], [36, 50], [24, 56]], [0, 0, 4, 6, 6, 6, 4])],
    },
  ],
};

export const FLAT_ICONS = { streak, xp, best, freeze, target, hourglass, hostile, boss } as const;
export type FlatKind = keyof typeof FLAT_ICONS;
export const FLAT_KINDS = Object.keys(FLAT_ICONS) as FlatKind[];

/** The six the board is choosing between; hostile and boss are drawn only so Today's rows can be seen whole. */
export const FLAT_SIX: readonly FlatKind[] = ["streak", "xp", "best", "freeze", "target", "hourglass"];

/** The icon's fit as an SVG transform, or nothing when it is drawn to size. */
export function fitTransform(def: FlatIconDef): string | undefined {
  if (!def.fit) return undefined;
  const { scale: k, dx = 0, dy = 0 } = def.fit;
  return `translate(${fmt(48 + dx)} ${fmt(48 + dy)}) scale(${fmt(k)}) translate(-48 -48)`;
}

/** A shape as SVG markup (the board's static renders and the prototype share it). */
export function shapeMarkup(s: Shape): string {
  if (s.kind === "circle") return `<circle cx="${fmt(s.cx)}" cy="${fmt(s.cy)}" r="${fmt(s.r)}"/>`;
  if (s.kind === "path") return `<path d="${s.d}"${s.evenodd ? ' fill-rule="evenodd" clip-rule="evenodd"' : ""}/>`;
  const r = s.r ?? Math.min(s.w, s.h) / 2;
  const t = s.angle ? ` transform="rotate(${fmt(s.angle)} ${fmt(s.cx)} ${fmt(s.cy)})"` : "";
  return `<rect x="${fmt(s.cx - s.w / 2)}" y="${fmt(s.cy - s.h / 2)}" width="${fmt(s.w)}" height="${fmt(s.h)}" rx="${fmt(r)}"${t}/>`;
}

/**
 * The whole icon as one SVG string, its colours read from CSS variables
 * (`--fi-<kind>-<role>`), clip ids prefixed with `uid`.
 */
export function iconMarkup(kind: FlatKind, size: number, uid: string): string {
  const def = FLAT_ICONS[kind];
  const layers = def.layers.filter((l) => size >= (l.minPx ?? 0));
  const clips = new Map<string, string>();
  for (const l of layers) {
    if (!l.clip) continue;
    const key = l.clip.join("-");
    if (clips.has(key)) continue;
    const shapes = def.layers.filter((m) => l.clip!.includes(m.part)).flatMap((m) => m.shapes);
    clips.set(key, `<clipPath id="${uid}-${key}">${shapes.map(shapeMarkup).join("")}</clipPath>`);
  }
  const body = layers
    .map((l) => {
      const clip = l.clip ? ` clip-path="url(#${uid}-${l.clip.join("-")})"` : "";
      return `<g data-part="${l.part}" fill="var(--fi-${kind}-${l.tone})"${clip}>${l.shapes.map(shapeMarkup).join("")}</g>`;
    })
    .join("");
  const defs = clips.size ? `<defs>${[...clips.values()].join("")}</defs>` : "";
  const t = fitTransform(def);
  const inner = t ? `<g transform="${t}">${defs}${body}</g>` : defs + body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}" data-kind="${kind}">${inner}</svg>`;
}
