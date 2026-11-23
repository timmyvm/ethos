/**
 * The fifteen lessons' objects, three to a trait. The method, the
 * primitives and their exceptions are in primitives.ts.
 *
 * NEVER import this file from a client component (anything under a
 * "use client" boundary, FlatIcon and StatIcon included): it is the bulk
 * of the set's geometry, and only the export script, the workbench
 * (app/workbench/icons) and tests read it. lib/flat-icons.test.ts
 * walks FlatIcon's imports to hold that.
 *
 * One tone set per trait family (flat-icons.css): Pausing blue, Fillers
 * pink, Repairs orange, Pace green, Range violet, each with its own
 * shade and light, and the set's one gold (#ffb914, its shade #eb9c00)
 * where an object takes a second colour, with no exception: the target
 * and the gauge's needle, drawn first in the stat board's red with a navy
 * dart, take Repairs' orange and the gold since the #516 review.
 *
 * Weight: each object's long axis runs 84 to 88u (the `fit` of each
 * drawing is measured to land there; lib/flat-icons-faithful.test.ts
 * holds it), and most cover 38 to 55% of the grid. The swerving arrow and
 * the boomerang are thin by nature and cover about 30%.
 */
import type { TraitId } from "@/content/traits";
import {
  LIGHT_MIN_PX,
  at,
  centre,
  circlePath,
  fmt,
  poly,
  rect,
  ring,
  roundedPolygon,
  type FlatIconDef,
  type Pt,
  type Shape,
} from "./primitives";

/* ================================================================== */
/*  Pausing (pause)                                                   */
/* ================================================================== */

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
/* Pause between sentences (Pausing, blue): the pause sign and a full  */
/* stop after it. Two blocks 22u wide and 10u apart with 7u corners    */
/* (blocks, so never the letters "ll"), each shaded down its right     */
/* 6u, the set's straight split for a boxy object, and lit by a pill   */
/* high on its left. The stop is the drawing's one second colour, the  */
/* set's gold, 10u clear of the second block on the baseline, with the */
/* round objects' crescent shade.                                      */
/* ------------------------------------------------------------------ */
const PAUSE_BARS = [6, 38]; // each block's left edge
const PAUSE_W = 22;
const PAUSE_DOT = { cx: 82, cy: 74, r: 12 };
const pause: FlatIconDef = {
  name: "pause sign with a full stop",
  fit: { scale: 0.989, dx: -1.98, dy: 0.99 },
  layers: [
    { part: "base", tone: "base", shapes: PAUSE_BARS.map((x) => poly(rect(x, 8, x + PAUSE_W, 86), 7)) },
    { part: "shade", tone: "shade", clip: ["base"], shapes: PAUSE_BARS.map((x) => poly(rect(x + PAUSE_W - 6, 0, x + PAUSE_W + 4, 100), 0)) },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: PAUSE_BARS.map((x): Shape => ({ kind: "pill", cx: x + 7, cy: 25, w: 6, h: 18 })),
    },
    { part: "dot", tone: "dot", shapes: [{ kind: "circle", ...PAUSE_DOT }] },
    {
      part: "dot-shade",
      tone: "dot-shade",
      clip: ["dot"],
      shapes: [
        {
          kind: "path",
          d: circlePath(PAUSE_DOT.cx, PAUSE_DOT.cy, PAUSE_DOT.r + 1) + circlePath(PAUSE_DOT.cx - 3, PAUSE_DOT.cy - 3, PAUSE_DOT.r + 1.5),
          evenodd: true,
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Finish, then go quiet (Pausing, blue): a ball come to rest in a     */
/* bowl. A shallow basin with a fully round bottom and no foot (a foot */
/* made it an egg cup, a lamp, a trophy), shaded down its right; its   */
/* mouth, the inside seen from above, a pill across the rim in the     */
/* shade, which is what makes it a vessel and never a hull or a        */
/* horizon. The ball is the family's light blue, as the 3D's was, its  */
/* foot on the mouth's front edge, with the round objects' crescent    */
/* shade and the light on it.                                          */
/* ------------------------------------------------------------------ */
const BASIN: readonly Pt[] = [
  [4, 48],
  [92, 48],
  [80, 86],
  [16, 86],
];
const BOWL_BALL = { cx: 48, cy: 36, r: 23 }; // its foot at y 59, the mouth's front edge
const bowl: FlatIconDef = {
  name: "ball in a bowl",
  fit: { scale: 0.989, dy: -1.48 },
  layers: [
    { part: "base", tone: "base", shapes: [poly(BASIN, [0, 0, 36, 36])] },
    { part: "shade", tone: "shade", clip: ["base"], shapes: [poly([[60, 30], [110, 30], [110, 110], [54, 110]], 0)] },
    { part: "inside", tone: "shade", shapes: [{ kind: "pill", cx: 48, cy: 48, w: 88, h: 22 }] },
    { part: "ball", tone: "ball", shapes: [{ kind: "circle", ...BOWL_BALL }] },
    {
      part: "ball-shade",
      tone: "ball-shade",
      clip: ["ball"],
      shapes: [
        {
          kind: "path",
          d: circlePath(BOWL_BALL.cx, BOWL_BALL.cy, BOWL_BALL.r + 1) + circlePath(BOWL_BALL.cx - 7, BOWL_BALL.cy - 7, BOWL_BALL.r + 2),
          evenodd: true,
        },
      ],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 38, cy: 24, w: 8, h: 14, angle: 40 }],
    },
  ],
};

/* ================================================================== */
/*  Fillers (fillers)                                                 */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Your first sentence (Fillers): a door standing open, its knob on.    */
/* A frame (10u posts and lintel, standing on the floor) in the shade,  */
/* the room behind it the family's own deepest wine (`inside`, not a    */
/* second hue), 26u wide and square topped, so the doorway is never a   */
/* slot, an arch, a book's spine or a mail slot. The leaf swings out    */
/* toward you on the left, hinged behind the left post, its free edge   */
/* taller than the frame (4 to 98 against 10 to 90), so it reads as a   */
/* door opening. The leaf is the lit face; the knob is the light's      */
/* tone, drawn at every size; the light a pill at the leaf's top left.  */
/* The frame's feet stand on the floor, so they take a small round (3), */
/* as the cup's stem foot does, and the doorway's top corners are 3 so  */
/* it stays square.                                                     */
/* ------------------------------------------------------------------ */
const door: FlatIconDef = {
  name: "open door",
  fit: { scale: 0.97, dx: -6.8, dy: -3.89 },
  layers: [
    { part: "inside", tone: "inside", shapes: [poly([[52, 20], [78, 20], [78, 90], [52, 90]], 0)] },
    // The leaf's hinge side tucks under the left post.
    { part: "base", tone: "base", shapes: [poly([[22, 4], [54, 20], [54, 90], [22, 98]], [6, 3, 3, 6])] },
    {
      part: "frame",
      tone: "shade",
      // The inner feet stand on the doorway's floor, a straight edge, so they take no round.
      shapes: [poly([[46, 90], [46, 10], [88, 10], [88, 90], [78, 90], [78, 20], [56, 20], [56, 90]], [3, 6, 6, 3, 0, 3, 3, 0])],
    },
    { part: "knob", tone: "light", shapes: [{ kind: "circle", cx: 30, cy: 54, r: 6 }] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 30, cy: 22, w: 7, h: 16, angle: -12 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The closed mouth (Fillers, pink): a zip opening in a Y. Below, the  */
/* closed tape with a round foot; above, the two open tapes leaning    */
/* out. The shade is the seam's right: the right tape whole and the    */
/* closed tape right of x 48, one straight split. The teeth are tone   */
/* on tone, the family's pale pink at every size (the 3D's were        */
/* moulded in the tape's own colour): on the closed tape three 18 by   */
/* 12 bricks either side of the seam; on each open tape 10u teeth set  */
/* 2u inside its inner edge and turned with it, the right row half a   */
/* pitch above the left as a zip's are. Over them the metal in the     */
/* set's gold: the slider where the tapes meet, its right third in the */
/* gold's shade (the cup's split), and the pull hanging down over the  */
/* chain with a slot. The light is a streak down the left tape's outer */
/* side, long and thin so it never reads as one more tooth.            */
/* ------------------------------------------------------------------ */
const ZIP_LEFT: readonly Pt[] = [
  [24, 50],
  [48, 50],
  [34, 4],
  [10, 4],
];
const ZIP_RIGHT: readonly Pt[] = [
  [48, 50],
  [72, 50],
  [86, 4],
  [62, 4],
];
const ZIP_FOOT = 94; // the closed tape's foot, 4u under the last brick
const zipChain: Shape[] = [0, 1, 2].map((i) => {
  const c = i % 2 === 0 ? 43 : 53; // 5u either side of the seam
  const y = 54 + i * 12;
  return poly(rect(c - 9, y, c + 9, y + 12), 3);
});
/** An open tooth: a 10u square `t` of the way up a tape's inner edge (from (48, 50) to `top`), turned with it, 2u in. */
function zipTooth(top: Pt, side: -1 | 1, t: number): Shape {
  const len = Math.hypot(top[0] - 48, top[1] - 50);
  const u: Pt = [(top[0] - 48) / len, (top[1] - 50) / len]; // up the edge
  const n: Pt = side < 0 ? [u[1], -u[0]] : [-u[1], u[0]]; // into the tape
  const c: Pt = [48 + u[0] * len * t + n[0] * 7, 50 + u[1] * len * t + n[1] * 7];
  const k = (a: number, b: number): Pt => [c[0] + (u[0] * a + n[0] * b) * 5, c[1] + (u[1] * a + n[1] * b) * 5];
  return poly([k(-1, -1), k(1, -1), k(1, 1), k(-1, 1)], 3);
}
const zipper: FlatIconDef = {
  name: "zip",
  fit: { scale: 0.967, dy: -0.97 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [poly(rect(24, 44, 72, ZIP_FOOT), [0, 0, 14, 14]), poly(ZIP_LEFT, [0, 0, 7, 7]), poly(ZIP_RIGHT, [0, 0, 7, 7])],
    },
    { part: "shade", tone: "shade", clip: ["base"], shapes: [poly(rect(48, 50, 100, 110), 0), poly(ZIP_RIGHT, 0)] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      // 2.8u inside the left tape's outer edge, parallel to it, 3u clear of the teeth.
      shapes: [{ kind: "pill", cx: 20.7, cy: 21, w: 5, h: 22, angle: -16.9 }],
    },
    {
      part: "teeth",
      tone: "teeth",
      shapes: [
        ...zipChain,
        ...[0.47, 0.74].map((t) => zipTooth([34, 4], -1, t)),
        ...[0.335, 0.605, 0.875].map((t) => zipTooth([62, 4], 1, t)),
      ],
    },
    {
      part: "slider",
      tone: "metal",
      shapes: [poly([[33, 32], [63, 32], [58, 58], [38, 58]], [7, 7, 6, 6])],
    },
    { part: "slider-shade", tone: "metal-shade", clip: ["slider"], shapes: [poly(rect(55, 0, 100, 100), 0)] },
    {
      part: "pull",
      tone: "metal",
      shapes: [{ kind: "path", d: roundedPolygon(rect(40, 50, 56, 82), 8) + roundedPolygon(rect(45, 65, 51, 75), 3), evenodd: true }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The crutch (Fillers): a magnifying glass, finding the word you lean  */
/* on. A ring, a pale lens of its own hue, a handle down to the right.  */
/* The handle's inner end is buried in the ring's band (it starts 22u   */
/* out, inside the band's 18.5 to 31), so its full 20u width meets the  */
/* rim: with its round cap set against the rim it pinched there and     */
/* read as a separate pill, a lollipop at 24. One shade, the outside of */
/* a circle set up and left: a crescent on the ring and the whole       */
/* handle, the round objects' rule.                                     */
/* ------------------------------------------------------------------ */
const MX = 37;
const MY = 37;
const M_OUT = 31;
const M_IN = 18.5;
const M_DEG = 45;
const magnifier: FlatIconDef = {
  name: "magnifying glass",
  layers: [
    { part: "lens", tone: "lens", shapes: [{ kind: "circle", cx: MX, cy: MY, r: M_IN + 1 }] },
    {
      part: "base",
      tone: "base",
      shapes: [
        ring(MX, MY, M_OUT, M_IN),
        // From 22u to 74u out along the 45° line: the outer end is where it was.
        { kind: "pill", ...centre(at(MX, MY, M_DEG, 48)), w: 52, h: 20, angle: M_DEG },
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "path", d: circlePath(MX, MY, 90) + circlePath(MX - 6, MY - 6, 32), evenodd: true }],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", ...centre(at(MX, MY, 225, 10.5)), w: 14, h: 8, angle: -45 }],
    },
  ],
};

/* ================================================================== */
/*  Repairs (repairs)                                                 */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Finish it anyway: a chequered flag. A pole with a ball, the cloth in */
/* two panels folded once (straight sides; the right panel turned away */
/* from the light, in shade), a field of 4 by 3 checks inside a 6u hem */
/* so a white check never meets the ground (on white and the cream     */
/* stage the unhemmed cloth lost its edge), and the light along the     */
/* top hem over the first orange check.                                 */
/* ------------------------------------------------------------------ */
const CLOTH_TL: Pt = [27, 11];
const CLOTH_TM: Pt = [59, 18];
const CLOTH_TR: Pt = [91, 9];
const CLOTH_BL: Pt = [27, 58];
const CLOTH_BM: Pt = [59, 65];
const CLOTH_BR: Pt = [91, 56];
const CLOTH_HEM = 6;
const clothMix = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** A point in a four-cornered panel (TL, TR, BR, BL): u across it, v down it. */
const inPanel = (p: readonly Pt[], u: number, v: number): Pt => clothMix(clothMix(p[0], p[1], u), clothMix(p[3], p[2], u), v);
function flagChecks(): Shape[] {
  const out: Shape[] = [];
  const panels = [
    [CLOTH_TL, CLOTH_TM, CLOTH_BM, CLOTH_BL],
    [CLOTH_TM, CLOTH_TR, CLOTH_BR, CLOTH_BM],
  ];
  panels.forEach((panel, i) => {
    const t = CLOTH_HEM / (CLOTH_BL[1] - CLOTH_TL[1]);
    const r = i === 1 ? CLOTH_HEM / (CLOTH_TR[0] - CLOTH_TM[0]) : 0;
    const field = [inPanel(panel, 0, t), inPanel(panel, 1 - r, t), inPanel(panel, 1 - r, 1 - t), inPanel(panel, 0, 1 - t)];
    for (let c = 0; c < 2; c++)
      for (let row = 0; row < 3; row++) {
        if ((row + c) % 2 !== 1) continue;
        const [u0, u1, v0, v1] = [c / 2, (c + 1) / 2, row / 3, (row + 1) / 3];
        out.push(poly([inPanel(field, u0, v0), inPanel(field, u1, v0), inPanel(field, u1, v1), inPanel(field, u0, v1)], 0));
      }
  });
  return out;
}
/** Everything right of the fold. */
const flagFold = (): Shape => poly([[CLOTH_TM[0], 0], [100, 0], [100, 100], [CLOTH_BM[0], 100]], 0);
const flag: FlatIconDef = {
  name: "chequered flag",
  fit: { scale: 0.96, dx: -4.3, dy: 0.5 },
  layers: [
    {
      /* The pole in the cloth's own orange (a darker pole sank into the
         Repairs card), its right side in shade like the cloth's fold. */
      part: "pole",
      tone: "base",
      shapes: [
        { kind: "pill", cx: 21, cy: 52, w: 10, h: 82 },
        { kind: "circle", cx: 21, cy: 9, r: 7 },
      ],
    },
    { part: "pole-shade", tone: "shade", clip: ["pole"], shapes: [poly([[22, 0], [40, 0], [40, 100], [22, 100]], 0)] },
    {
      part: "base",
      tone: "base",
      // The cloth's left corners lie inside the pole, so their 3u rounds never show.
      shapes: [poly([[CLOTH_TL[0] - 3, CLOTH_TL[1]], CLOTH_TM, CLOTH_TR, CLOTH_BR, CLOTH_BM, [CLOTH_BL[0] - 3, CLOTH_BL[1]]], [3, 6, 7, 7, 6, 3])],
    },
    { part: "shade", tone: "shade", clip: ["base"], shapes: [flagFold()] },
    { part: "check", tone: "check", clip: ["base"], shapes: flagChecks() },
    { part: "check-shade", tone: "check-shade", clip: ["check"], shapes: [flagFold()] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      // Along the top edge (its 12 degree slope), over the hem and the first orange check: 2.6u clear of the pole, 2.7u of the white check.
      shapes: [{ kind: "pill", cx: 34.5, cy: 18, w: 12, h: 6, angle: 12 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Fix it after (Repairs): an arrow that swerves and carries on, a lane */
/* shift, never an S (two U turns read as the letter S, or a dollar     */
/* sign, at 24 and 44). A 28u band from a square tail (6u corners) at   */
/* the bottom: up 16, a bend of 55 to the right (r 18), 10 up and to    */
/* the right, a bend of 55 back (r 18), up 6, into a head pointing      */
/* straight up (a rounded triangle, r 6, 64u wide, its tip 30u on).     */
/* Circular arcs here, because the object is a curve; every join        */
/* tangent. Baked from the band pen (start (30, 94), heading up). The   */
/* shade is the band's right third along its whole length and the       */
/* head's right of the same line; the light a pill inside the head's    */
/* upper left edge, the set's top left.                                 */
/* ------------------------------------------------------------------ */
const ARROW_D =
  "M44 88L44 78A4 4 0 0 1 45.71 74.72L53.9 68.99A32 32 0 0 0 67.54 42.77L67.54 36.77L39.54 36.77L39.54 42.77A4 4 0 0 1 37.84 46.05L29.65 51.79A32 32 0 0 0 16 78L16 88A6 6 0 0 0 22 94L38 94A6 6 0 0 0 44 88Z";
const ARROW_HEAD: readonly Pt[] = [
  [53.54, 6.77], // tip
  [85.54, 42.77],
  [21.54, 42.77],
];
/** The band's right third: 4u to 16u right of its centreline (2u past its edge, clipped). */
const ARROW_SHADE_D =
  "M46 102L46 94L46 78A2 2 0 0 1 46.85 76.36L55.04 70.63A34 34 0 0 0 69.54 42.77L69.54 36.77L57.54 36.77L57.54 42.77A22 22 0 0 1 48.16 60.8L39.97 66.53A14 14 0 0 0 34 78L34 94L34 102Z";
const arrow: FlatIconDef = {
  name: "swerving arrow",
  fit: { scale: 1.02, dx: 0.89, dy: -3.96 },
  layers: [
    { part: "base", tone: "base", shapes: [{ kind: "path", d: ARROW_D }, poly(ARROW_HEAD, 6)] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "path", d: ARROW_SHADE_D }, poly([[57.54, 46.77], [57.54, -3.23], [113.54, -3.23], [113.54, 46.77]], 0)],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 43.9, cy: 30.42, w: 16, h: 7, angle: -48.37 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Know how it ends: a target with a dart in its middle. Three rings    */
/* (base, white ring, base) in Repairs' orange, the dart in the set's   */
/* gold lying across it from the top right, its flight two swept fins. */
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

/* ================================================================== */
/*  Pace (pace)                                                       */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Slow your main point: a speed gauge. A dial cut flat at its foot (a  */
/* full disc with a needle read as a clock), a pale face, five ticks on */
/* the upper 210 degrees only, and a gold needle on the slow side, the  */
/* one second colour (the set's one gold). The dial is a                */
/* curve, so its outline is tangent arcs: the disc, and an 8u round     */
/* where it meets its flat foot.                                        */
/* ------------------------------------------------------------------ */
/** A disc of radius R cut flat `h` under its centre, the two corners rounded to `f`: arcs and one line, every join tangent. */
function flatFootDisc(cx: number, cy: number, R: number, h: number, f: number): string {
  const xf = Math.sqrt((R - f) ** 2 - (h - f) ** 2);
  const k = R / (R - f);
  const ty = cy + (h - f) * k;
  const tx = xf * k;
  return (
    `M${fmt(cx - xf)} ${fmt(cy + h)}L${fmt(cx + xf)} ${fmt(cy + h)}` +
    `A${fmt(f)} ${fmt(f)} 0 0 0 ${fmt(cx + tx)} ${fmt(ty)}` +
    `A${fmt(R)} ${fmt(R)} 0 1 0 ${fmt(cx - tx)} ${fmt(ty)}` +
    `A${fmt(f)} ${fmt(f)} 0 0 0 ${fmt(cx - xf)} ${fmt(cy + h)}Z`
  );
}
const GAUGE_X = 48;
const GAUGE_Y = 56;
const GAUGE_R = 43;
const GAUGE_TICKS = [165, 217.5, 270, 322.5, 15];
const GAUGE_NEEDLE = 191; // the slow side, between the first two ticks
const gauge: FlatIconDef = {
  name: "speed gauge",
  fit: { scale: 0.98, dy: 1.3 },
  layers: [
    { part: "base", tone: "base", shapes: [{ kind: "path", d: flatFootDisc(GAUGE_X, GAUGE_Y, GAUGE_R, 24, 8) }] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [{ kind: "path", d: circlePath(GAUGE_X, GAUGE_Y, GAUGE_R + 1) + circlePath(GAUGE_X - 7, GAUGE_Y - 9, GAUGE_R + 3), evenodd: true }],
    },
    { part: "face", tone: "face", shapes: [{ kind: "path", d: flatFootDisc(GAUGE_X, GAUGE_Y, 32, 13, 6) }] },
    {
      part: "tick",
      tone: "base",
      shapes: GAUGE_TICKS.map((deg): Shape => ({ kind: "pill", ...centre(at(GAUGE_X, GAUGE_Y, deg, 24)), w: 11, h: 7.5, angle: deg })),
    },
    {
      part: "needle",
      tone: "needle",
      shapes: [
        // A pill from just behind the pivot to 28u out, between the first two ticks, on a 16u pivot.
        { kind: "pill", ...centre(at(GAUGE_X, GAUGE_Y, GAUGE_NEEDLE, 12.5)), w: 31, h: 9, angle: GAUGE_NEEDLE },
        { kind: "circle", cx: GAUGE_X, cy: GAUGE_Y, r: 8 },
      ],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", ...centre(at(GAUGE_X, GAUGE_Y, 222, 37.5)), w: 12, h: 6, angle: 132 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Change speed once: a gear stick. A round knob with the shift         */
/* pattern's H on it, upright (turned with the knob it read as a        */
/* scribble at 44, and the stick as a joystick), on a short shaft       */
/* leaning 14 degrees right (upright, a ball over shoulders read as a   */
/* person), standing in a low boot on a plate (without the plate the    */
/* 24px silhouette read as a keyhole or a pawn). The shade follows the  */
/* set's grammar: a crescent on the round knob, a straight split on the */
/* right of the shaft and boot, stopping at the knob. The light is a    */
/* pill on the knob's rim, 2u clear of the H and of the outline.        */
/* ------------------------------------------------------------------ */
const GEAR_PIVOT: Pt = [44, 78];
const GEAR_LEAN = -76; // the shaft's heading: up, 14 degrees right of vertical
const GEAR_KNOB = at(GEAR_PIVOT[0], GEAR_PIVOT[1], GEAR_LEAN, 50);
const GEAR_KNOB_R = 25;
/** The H's centre: 1u under the knob's, so the H keeps clear of the crescent and leaves room for the light. */
const GEAR_GATE: Pt = [GEAR_KNOB[0], GEAR_KNOB[1] + 1];
/** A point `along` the shaft from the pivot and `across` it (right is +). */
const onShaft = (along: number, across: number) => at(GEAR_PIVOT[0], GEAR_PIVOT[1], GEAR_LEAN, along, across);
const gearstick: FlatIconDef = {
  name: "gear stick",
  fit: { scale: 1, dx: 3.8 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [
        poly([[29, 67], [59, 67], [72, 86], [16, 86]], [9, 9, 4, 4]),
        { kind: "pill", cx: 44, cy: 87, w: 74, h: 11 },
        { kind: "pill", ...centre(onShaft(25, 0)), w: 56, h: 14, angle: GEAR_LEAN },
        { kind: "circle", cx: GEAR_KNOB[0], cy: GEAR_KNOB[1], r: GEAR_KNOB_R },
      ],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [
        {
          kind: "path",
          d: circlePath(GEAR_KNOB[0], GEAR_KNOB[1], GEAR_KNOB_R + 1) + circlePath(GEAR_KNOB[0] - 6, GEAR_KNOB[1] - 6, GEAR_KNOB_R + 2),
          evenodd: true,
        },
        // The shaft's right half, stopping where it meets the knob (26u up), so the ball keeps its own crescent.
        poly([onShaft(-30, 2.5), onShaft(26, 2.5), onShaft(26, 80), onShaft(-30, 80)], 0),
      ],
    },
    {
      /* The H, upright: two bars 9 by 26, 10u apart, and the cross 26 by 8. */
      part: "gate",
      tone: "gate",
      shapes: [
        { kind: "pill", cx: GEAR_GATE[0] - 9.5, cy: GEAR_GATE[1], w: 9, h: 26 },
        { kind: "pill", cx: GEAR_GATE[0] + 9.5, cy: GEAR_GATE[1], w: 9, h: 26 },
        { kind: "pill", cx: GEAR_GATE[0], cy: GEAR_GATE[1], w: 26, h: 8 },
      ],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      // On the rim up and left of the H, along the rim: 2.3u clear of the H's bar, 1.9u inside the outline.
      shapes: [{ kind: "pill", ...centre(at(GEAR_KNOB[0], GEAR_KNOB[1], 238, 20.5)), w: 9, h: 5, angle: 148 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Let it sink in: a road running away. One trapezoid, low and wide (a  */
/* tall one read as a cone or a pyramid), two white edge lines and      */
/* three dashes converging on its far end, every line stopping 7u short */
/* of the near edge (run off it, the edge lines made an A's legs and    */
/* the road looked cropped); the right verge in shade. A ground plane,  */
/* so no light. Its solid silhouette is a trapezoid, as the 3D's was:   */
/* the white lines carry the name.                                      */
/* ------------------------------------------------------------------ */
const ROAD_TOP = 26;
const ROAD_BOTTOM = 82;
const ROAD_TOP_W = 30;
const ROAD_BOTTOM_W = 92;
/** The road's x at height y, `f` of the way across it (0 the left edge, 1 the right). */
const roadX = (y: number, f: number) =>
  48 + (f - 0.5) * (ROAD_TOP_W + ((ROAD_BOTTOM_W - ROAD_TOP_W) * (y - ROAD_TOP)) / (ROAD_BOTTOM - ROAD_TOP));
/** A strip of the road from f0 to f1 across, y0 to y1 down, in perspective. */
const roadStrip = (f0: number, f1: number, y0: number, y1: number, r: number): Shape =>
  poly([[roadX(y0, f0), y0], [roadX(y0, f1), y0], [roadX(y1, f1), y1], [roadX(y1, f0), y1]], r);
const road: FlatIconDef = {
  name: "road",
  fit: { scale: 1.08, dy: -6.5 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [poly([[roadX(ROAD_TOP, 0), ROAD_TOP], [roadX(ROAD_TOP, 1), ROAD_TOP], [roadX(ROAD_BOTTOM, 1), ROAD_BOTTOM], [roadX(ROAD_BOTTOM, 0), ROAD_BOTTOM]], [8, 8, 9, 9])],
    },
    { part: "shade", tone: "shade", clip: ["base"], shapes: [roadStrip(0.86, 1.4, ROAD_TOP - 8, ROAD_BOTTOM + 8, 0)] },
    {
      part: "line",
      tone: "line",
      clip: ["base"],
      shapes: [
        roadStrip(0.12, 0.19, ROAD_TOP + 7, ROAD_BOTTOM - 7, 3),
        roadStrip(0.81, 0.88, ROAD_TOP + 7, ROAD_BOTTOM - 7, 3),
        roadStrip(0.42, 0.58, ROAD_BOTTOM - 23, ROAD_BOTTOM - 7, 3.5),
        roadStrip(0.425, 0.575, ROAD_BOTTOM - 38, ROAD_BOTTOM - 28, 3),
        roadStrip(0.43, 0.57, ROAD_TOP + 6, ROAD_TOP + 12, 2.5),
      ],
    },
  ],
};

/* ================================================================== */
/*  Range (range)                                                     */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Name it once (Range): a name tag, plain, nothing on it says price.   */
/* A tag of six corners (a chamfered head, a square foot) lying on the  */
/* diagonal, its head to the top left, and one eyelet: a round hole cut */
/* through the head (13u) in a ring of the light's tint (7u band),      */
/* drawn at every size. There is no loop of string: beside the hole it  */
/* made two overlapping circles, muddy at 120 and a keychain at 44.     */
/* The shade is the tag's right long side (a straight split, as boxy    */
/* objects take), the light a pill down its left.                       */
/* ------------------------------------------------------------------ */
const TAG_TILT = -40;
/** The tag is drawn upright about (0, 0), then turned 40 degrees to the left and set at (50, 50). */
function onTag(points: readonly Pt[]): Pt[] {
  const a = (TAG_TILT * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return points.map(([x, y]) => [50 + x * c - y * s, 50 + x * s + y * c]);
}
const TAG = onTag([
  [-26, -20],
  [-11, -40],
  [11, -40],
  [26, -20],
  [26, 40],
  [-26, 40],
]);
const [TAG_HOLE, TAG_LIGHT] = onTag([
  [0, -22],
  [-14, 4],
]);
const tag: FlatIconDef = {
  name: "name tag",
  fit: { scale: 1.06, dx: -6.37, dy: -5.57 },
  layers: [
    {
      part: "base",
      tone: "base",
      shapes: [{ kind: "path", d: roundedPolygon(TAG, [6, 6, 6, 6, 9, 9]) + circlePath(TAG_HOLE[0], TAG_HOLE[1], 6.5), evenodd: true }],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly(onTag([[10, -70], [70, -70], [70, 70], [10, 70]]), 0)],
    },
    { part: "eyelet", tone: "eyelet", shapes: [ring(TAG_HOLE[0], TAG_HOLE[1], 13.5, 6.5)] },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", ...centre(TAG_LIGHT), w: 8, h: 20, angle: TAG_TILT }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Same idea, new words (Range): a boomerang, posed as a wide "<": its  */
/* elbow to the left at (14, 48), one arm 56u up and to the right (-42  */
/* degrees), one down and to the right (62), 104 degrees open, so       */
/* neither arm is level or plumb (no Gamma, 7, r or corner bracket).    */
/* 36u wide at the elbow, 24 at the round tips. Six corners: the outer  */
/* elbow r 25 and the inner r 14, so the bend reads as carved wood and  */
/* not a pipe elbow; each tip a short side with two r 12 corners. The   */
/* outer sides bow out 5u and the inner sides in 4u. Circular arcs,     */
/* because the object is a curve (each side one arc, every corner a     */
/* fillet tangent to both sides). The shade is each arm's inner half,   */
/* cut along the arm's middle, so it reads as the ridge a boomerang     */
/* has; the light a pill on the upper arm near the elbow. Corners,      */
/* clockwise from the outer elbow: (-10.55, 43.67), (47.59, 1.61),      */
/* (63.65, 19.45), (34.76, 51.66), (50.89, 91.81), (29.7, 103.08).      */
/* ------------------------------------------------------------------ */
const BOOMERANG_D =
  "M0.99 30.86A131.22 131.22 0 0 1 39.43 4.9A12 12 0 0 1 53.2 7.84L54.32 9.09A12 12 0 0 1 53 26.42A60.51 60.51 0 0 0 36.12 48.39A14 14 0 0 0 34.92 55.2A60.51 60.51 0 0 0 43.26 81.62A12 12 0 0 1 38.58 98.35L37.1 99.14A12 12 0 0 1 23.15 97.2A131.22 131.22 0 0 1 -4.09 59.65A25 25 0 0 1 0.99 30.86Z";
const boomerang: FlatIconDef = {
  name: "boomerang",
  fit: { scale: 0.89, dx: 20.05, dy: -3.79 },
  layers: [
    { part: "base", tone: "base", shapes: [{ kind: "path", d: BOOMERANG_D }] },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      // From the elbow out along each arm's middle; everything inside the V.
      shapes: [poly([[14, 48], [77.91, -9.55], [210.96, 82.73], [54.37, 123.93]], 0)],
    },
    {
      part: "light",
      tone: "light",
      minPx: LIGHT_MIN_PX,
      shapes: [{ kind: "pill", cx: 15.2, cy: 34.91, w: 18, h: 7, angle: -35.88 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The actual thing (Range, violet): a solid block, a regular          */
/* isometric cube (side 43) whose three faces are the three tones: the */
/* top lit (light), the left the base, the right the shade. One        */
/* rounded hexagon (8u corners) for the silhouette; the faces are cut  */
/* inside it by the three edges that meet in a Y at the centre. The    */
/* lit top is the light, so it is drawn at every size and there is no  */
/* other highlight.                                                    */
/* ------------------------------------------------------------------ */
const CUBE_SIDE = 43;
const CUBE_HALF_W = CUBE_SIDE * Math.cos(Math.PI / 6);
const CUBE_MID: Pt = [48, 48];
const CUBE_UL: Pt = [48 - CUBE_HALF_W, 48 - CUBE_SIDE / 2];
const CUBE_UR: Pt = [48 + CUBE_HALF_W, 48 - CUBE_SIDE / 2];
const CUBE: readonly Pt[] = [
  [48, 48 - CUBE_SIDE],
  CUBE_UR,
  [48 + CUBE_HALF_W, 48 + CUBE_SIDE / 2],
  [48, 48 + CUBE_SIDE],
  [48 - CUBE_HALF_W, 48 + CUBE_SIDE / 2],
  CUBE_UL,
];
const cube: FlatIconDef = {
  name: "cube",
  fit: { scale: 1.02 },
  layers: [
    { part: "base", tone: "base", shapes: [poly(CUBE, 8)] },
    {
      part: "top",
      tone: "light",
      clip: ["base"],
      shapes: [poly([[CUBE_UL[0] - 20, CUBE_UL[1]], [48, -30], [CUBE_UR[0] + 20, CUBE_UR[1]], CUBE_UR, CUBE_MID, CUBE_UL], 0)],
    },
    {
      part: "shade",
      tone: "shade",
      clip: ["base"],
      shapes: [poly([CUBE_MID, CUBE_UR, [CUBE_UR[0] + 20, CUBE_UR[1]], [CUBE_UR[0] + 20, 120], [48, 120]], 0)],
    },
  ],
};

export const LESSON_ICONS = { hourglass, pause, bowl, door, zipper, magnifier, flag, arrow, target, gauge, gearstick, road, tag, boomerang, cube } as const;
export type LessonFlatKind = keyof typeof LESSON_ICONS;
export const LESSON_FLAT_KINDS = Object.keys(LESSON_ICONS) as LessonFlatKind[];

/** The objects by trait, in the order the families and their lessons are shown. */
export const LESSON_FAMILIES: readonly { trait: TraitId; kinds: readonly LessonFlatKind[] }[] = [
  { trait: "pause", kinds: ["hourglass", "pause", "bowl"] },
  { trait: "fillers", kinds: ["door", "zipper", "magnifier"] },
  { trait: "repairs", kinds: ["flag", "arrow", "target"] },
  { trait: "pace", kinds: ["gauge", "gearstick", "road"] },
  { trait: "range", kinds: ["tag", "boomerang", "cube"] },
];

/** Each lesson's object (content/lessons.ts ids): the drawing that stands for it. */
export const LESSON_OBJECT_KIND: Readonly<Record<string, LessonFlatKind>> = {
  "the-long-one": "hourglass",
  "inside-or-after": "pause",
  "the-landing": "bowl",
  "the-cold-open": "door",
  "closed-mouth": "zipper",
  "the-crutch": "magnifier",
  "finish-it": "flag",
  "or-rather": "arrow",
  "know-the-landing": "target",
  "one-gear-down": "gauge",
  "change-gear": "gearstick",
  "room-to-land": "road",
  "name-it-once": "tag",
  "second-pass": "boomerang",
  "short-and-concrete": "cube",
};
