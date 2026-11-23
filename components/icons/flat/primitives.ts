/**
 * The flat icons' method and the primitives every drawing is made of.
 *
 * The set (variant A, Timothy's pick: one bright palette of its own, the
 * same in both themes) is drawn in Duolingo's newer method, never from
 * their art: no owl, no flame with a teardrop centred in it, no gems,
 * hearts, shields, path nodes or hexes of theirs. Two files of drawings
 * use it:
 *
 *   stat-drawings.ts    the six a count or a mode stands beside (streak,
 *                       XP, best, freeze, Hostile Q&A, the weekly boss);
 *                       light enough for a client component (FlatIcon).
 *   lesson-drawings.ts  the fifteen lessons' objects, grouped by trait.
 *                       Never imported by a client component: only the
 *                       export script, the workbench and tests read it,
 *                       so the browser bundle carries none of them.
 *
 * geometry.ts gathers all 21 for those readers (FLAT_ICONS, iconMarkup).
 *
 * Every icon is drawn on one 96-unit master grid (24px at 4x) from three
 * primitives: a rounded polygon (a radius on every corner), a circle, and
 * a pill. Between two corners a side is straight, and a corner is one
 * clean arc of the radius it is given, 6u at least on a silhouette.
 *
 * The documented exceptions:
 *  - Curves drawn as arcs. Where the object is itself a curve, its outline
 *    is circular arcs with every join tangent (a concave arc where an edge
 *    turns in): the streak's flame, the arrow's swerving band, the
 *    boomerang, and the gauge's dial where it meets its flat foot. Their
 *    tips may be sharper than 6u; each drawing's comment gives its radii.
 *  - The doorway. The door's frame takes r3 at its feet (they stand on the
 *    floor) and at the doorway's top corners, so the opening stays square
 *    and never reads as an arch.
 *  - Corners no one sees: a corner another part covers (the flag cloth's
 *    inside the pole, the zip tapes' feet inside the closed tape, the
 *    bubble tail's root, the hourglass glass under its caps), and a shape
 *    that only cuts a shade, a face or a stripe (r 0: the clip draws the
 *    edge, not the shape).
 *  - Small parts round at their own scale: a detail inside a silhouette
 *    (the bolt in the bubble, the boss's pennant and snow, the zip's teeth
 *    and slot, the target's fins, the road's lines, the cup's stem foot),
 *    and the flag's checks, square cells inside the cloth's hem.
 *
 * Each icon is a short stack of named layers: `base` (the silhouette),
 * `shade` (one flat shape in the same hue, 7 to 10 points of lightness
 * darker, clipped inside the silhouette on the side away from the light),
 * `light` (one small pill near the top left, drawn only from 24px up), and
 * where the object needs one, a second colour (a dart, sand, a needle,
 * the gold of a zip). At most three tones of a hue and at most one second
 * colour in a drawing. The shade's grammar: a boxy object takes a straight
 * split on its right; a round one takes a crescent, the outside of an
 * offset circle.
 *
 * A layer names a colour role, never a colour: the role is read from a
 * CSS variable, `--fi-<kind>-<role>` (components/icons/flat/flat-icons.css),
 * so the unlit greys swap every tone without touching a path.
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

/** A number as the drawings write it: two decimals at most. */
export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

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
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`;
}

/** A ring: a disc with a round hole, filled evenodd. */
export function ring(cx: number, cy: number, outer: number, inner: number): Shape {
  return { kind: "path", d: circlePath(cx, cy, outer) + circlePath(cx, cy, inner), evenodd: true };
}

/** A rounded polygon as a shape. */
export const poly = (points: readonly Pt[], radii: number | readonly number[]): Shape => ({
  kind: "path",
  d: roundedPolygon(points, radii),
});

/** A rectangle's four corners, clockwise from the top left. */
export function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** Points scaled about the grid's centre (48, 48). */
export function scale(points: readonly Pt[], k: number): Pt[] {
  return points.map(([x, y]) => [48 + (x - 48) * k, 48 + (y - 48) * k]);
}

/** A point `along` units down a direction (degrees) from (x, y), then `across` to its right. */
export function at(x: number, y: number, deg: number, along: number, across = 0): Pt {
  const a = (deg * Math.PI) / 180;
  return [x + Math.cos(a) * along - Math.sin(a) * across, y + Math.sin(a) * along + Math.cos(a) * across];
}

/** A point as a pill's or a circle's centre. */
export function centre([x, y]: Pt) {
  return { cx: x, cy: y };
}

/* ------------------------------------------------------------------ */
/* Drawing a definition. One plan, two writers: the SVG string here     */
/* (scripts, tests, the export) and the React component (FlatDrawing),  */
/* so the two can never draw a different icon.                          */
/* ------------------------------------------------------------------ */

/** The icon's fit as an SVG transform, or nothing when it is drawn to size. */
export function fitTransform(def: FlatIconDef): string | undefined {
  if (!def.fit) return undefined;
  const { scale: k, dx = 0, dy = 0 } = def.fit;
  return `translate(${fmt(48 + dx)} ${fmt(48 + dy)}) scale(${fmt(k)}) translate(-48 -48)`;
}

/** One SVG element: its tag and its attributes, in React's spelling (fillRule, clipRule). */
export type ShapeElement =
  | { tag: "circle"; attrs: { cx: string; cy: string; r: string } }
  | { tag: "path"; attrs: { d: string; fillRule?: "evenodd"; clipRule?: "evenodd" } }
  | { tag: "rect"; attrs: { x: string; y: string; width: string; height: string; rx: string; transform?: string } };

export function shapeElement(s: Shape): ShapeElement {
  if (s.kind === "circle") return { tag: "circle", attrs: { cx: fmt(s.cx), cy: fmt(s.cy), r: fmt(s.r) } };
  if (s.kind === "path")
    return { tag: "path", attrs: s.evenodd ? { d: s.d, fillRule: "evenodd", clipRule: "evenodd" } : { d: s.d } };
  const r = s.r ?? Math.min(s.w, s.h) / 2;
  const attrs: Extract<ShapeElement, { tag: "rect" }>["attrs"] = {
    x: fmt(s.cx - s.w / 2),
    y: fmt(s.cy - s.h / 2),
    width: fmt(s.w),
    height: fmt(s.h),
    rx: fmt(r),
  };
  if (s.angle) attrs.transform = `rotate(${fmt(s.angle)} ${fmt(s.cx)} ${fmt(s.cy)})`;
  return { tag: "rect", attrs };
}

const SVG_NAME: Record<string, string> = { fillRule: "fill-rule", clipRule: "clip-rule" };

/** A shape as SVG markup. */
export function shapeMarkup(s: Shape): string {
  const el = shapeElement(s);
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => ` ${SVG_NAME[k] ?? k}="${v}"`)
    .join("");
  return `<${el.tag}${attrs}/>`;
}

export type DrawingPlan = {
  transform?: string;
  /** One clip per distinct list of parts: a shade stays inside the union of what it names. */
  clips: { id: string; shapes: readonly Shape[] }[];
  layers: { part: string; tone: string; clipId?: string; shapes: readonly Shape[] }[];
};

/**
 * What a drawing puts on the page at `size` CSS px: the layers the size
 * ladder keeps (under 24px the light leaves), each with its clip, the
 * clips' ids prefixed with `uid` so two icons on a page never share one.
 */
export function drawingPlan(def: FlatIconDef, size: number, uid: string): DrawingPlan {
  const layers = def.layers.filter((l) => size >= (l.minPx ?? 0));
  const clips = new Map<string, readonly Shape[]>();
  for (const l of layers) {
    if (!l.clip) continue;
    const id = `${uid}-${l.clip.join("-")}`;
    if (clips.has(id)) continue;
    clips.set(
      id,
      def.layers.filter((m) => l.clip!.includes(m.part)).flatMap((m) => m.shapes),
    );
  }
  return {
    transform: fitTransform(def),
    clips: [...clips].map(([id, shapes]) => ({ id, shapes })),
    layers: layers.map((l) => ({
      part: l.part,
      tone: l.tone,
      clipId: l.clip ? `${uid}-${l.clip.join("-")}` : undefined,
      shapes: l.shapes,
    })),
  };
}

/**
 * A drawing as one SVG string, its colours read from CSS variables
 * (`--fi-<kind>-<role>`), clip ids prefixed with `uid`.
 */
export function drawingMarkup(kind: string, def: FlatIconDef, size: number, uid: string): string {
  const plan = drawingPlan(def, size, uid);
  const defs = plan.clips.length
    ? `<defs>${plan.clips.map((c) => `<clipPath id="${c.id}">${c.shapes.map(shapeMarkup).join("")}</clipPath>`).join("")}</defs>`
    : "";
  const body = plan.layers
    .map((l) => {
      const clip = l.clipId ? ` clip-path="url(#${l.clipId})"` : "";
      return `<g data-part="${l.part}" fill="var(--fi-${kind}-${l.tone})"${clip}>${l.shapes.map(shapeMarkup).join("")}</g>`;
    })
    .join("");
  const inner = plan.transform ? `<g transform="${plan.transform}">${defs}${body}</g>` : defs + body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}" data-kind="${kind}">${inner}</svg>`;
}
