import { useId } from "react";
import { HORIZON, VIEW_BOX, r1, rects, seeded } from "./geometry";

/*
 * The city through the glass, far below, in three flat layers that get
 * darker, cooler and bigger as they come closer. Late sun from the left:
 * the far layer is lit pink by the haze, the near towers catch a warm
 * edge on their sun side, and a few windows are already on.
 */

type Roof = "flat" | "step" | "antenna" | "slant" | "dome" | "spire";
type Tower = [x: number, w: number, top: number, roof?: Roof];

const BOTTOM = 980;

function towerPath([x, w, top, roof = "flat"]: Tower): string {
  const b = BOTTOM;
  switch (roof) {
    case "step": {
      const i = w * 0.18;
      const s = Math.min(40, w * 0.35);
      return `M${x} ${b}V${top + s}H${x + i}V${top}H${x + w - i}V${top + s}H${x + w}V${b}Z`;
    }
    case "antenna": {
      const ax = x + w * 0.62;
      return `M${x} ${b}V${top}H${ax - 2}V${top - 46}h5V${top}H${x + w}V${b}Z`;
    }
    case "slant":
      return `M${x} ${b}V${top + Math.min(34, w * 0.4)}L${x + w} ${top}V${b}Z`;
    case "dome":
      return `M${x} ${b}V${top + w * 0.28}Q${x} ${top} ${x + w / 2} ${top}Q${x + w} ${top} ${x + w} ${top + w * 0.28}V${b}Z`;
    case "spire": {
      const c = x + w / 2;
      return `M${x} ${b}V${top + 30}H${c - 10}V${top}l10 -64l10 64V${top + 30}H${x + w}V${b}Z`;
    }
    default:
      return `M${x} ${b}V${top}H${x + w}V${b}Z`;
  }
}

function roofTop([, w, top, roof]: Tower): number {
  if (roof === "step") return top + Math.min(40, w * 0.35) + 10;
  if (roof === "slant") return top + Math.min(34, w * 0.4) + 8;
  if (roof === "dome") return top + w * 0.3;
  if (roof === "spire") return top + 40;
  return top + 12;
}

/** Lit (and, on the near towers, unlit) windows on a tower's face. */
function windowGrid(
  towers: Tower[],
  seed: number,
  opts: { gx: number; gy: number; ww: number; wh: number; lit: number; pad: number; until: number },
) {
  const rnd = seeded(seed);
  const lit: Array<[number, number, number, number]> = [];
  const dark: Array<[number, number, number, number]> = [];
  for (const t of towers) {
    const [x, w] = t;
    const cols = Math.floor((w - opts.pad * 2 + (opts.gx - opts.ww)) / opts.gx);
    if (cols < 1) continue;
    const span = cols * opts.gx - (opts.gx - opts.ww);
    const x0 = x + (w - span) / 2;
    for (let y = roofTop(t) + opts.pad; y < opts.until; y += opts.gy) {
      for (let c = 0; c < cols; c++) {
        const cell: [number, number, number, number] = [x0 + c * opts.gx, y, opts.ww, opts.wh];
        if (rnd() < opts.lit) lit.push(cell);
        else dark.push(cell);
      }
    }
  }
  return { lit: rects(lit), dark: rects(dark) };
}

/* ---- far: small, pink with haze, tops just under the horizon ---- */

const FAR: Tower[] = [
  [-164, 58, 622, "step"], [-104, 34, 652],
  [-68, 46, 640, "antenna"], [-20, 60, 668], [42, 40, 630], [84, 54, 656, "slant"],
  [140, 38, 676], [180, 62, 642, "step"], [244, 44, 664], [290, 56, 628, "antenna"],
  [348, 40, 652], [390, 64, 670], [456, 46, 634, "dome"], [504, 58, 660],
  [564, 40, 618, "spire"], [606, 54, 652], [662, 46, 672], [710, 60, 636, "step"],
  [772, 42, 662], [816, 56, 646, "antenna"], [874, 44, 670], [920, 60, 632, "slant"],
  [982, 48, 660], [1032, 56, 640],
];

export function FarCity() {
  const haze = `room-far-haze${useId()}`;
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={haze} x1="0" y1={HORIZON} x2="0" y2="820" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6a37f" stopOpacity="0" />
          <stop offset="1" stopColor="#f6a37f" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d={FAR.map(towerPath).join("")} fill="#cf7489" />
      <rect x="-150" y={HORIZON} width="1200" height={BOTTOM - HORIZON} fill={`url(#${haze})`} />
    </svg>
  );
}

/* ---- mid: violet, a few windows, haze at the feet ---- */

const MID: Tower[] = [
  [-150, 74, 690, "antenna"], [-72, 110, 732, "step"], [42, 78, 702],
  [124, 92, 744, "slant"], [220, 70, 712], [294, 104, 728, "step"], [402, 86, 700, "dome"],
  [492, 74, 740], [570, 100, 706, "antenna"], [674, 80, 734], [758, 108, 698, "step"],
  [870, 76, 726], [950, 96, 712, "slant"], [1046, 70, 740],
];

const MID_WINDOWS = windowGrid(MID, 7, { gx: 16, gy: 22, ww: 6, wh: 9, lit: 0.12, pad: 12, until: 930 });

/*
 * One neighbour taller than this floor, left of the glass: it is what
 * says high-rise. Its sun side still catches the last of the light.
 */
const TALL = "M58 980V386H74V326H90V290H112V214h6V290H140V326H158V386H176V980Z";
const TALL_LIT = "M140 980V386H176V980ZM140 326H158V386H140ZM128 290H140V326H128Z";
const TALL_FLOORS = rects(
  Array.from({ length: 24 }, (_, i): [number, number, number, number] => [66, 404 + i * 22, 70, 3]),
);
const TALL_WINDOWS = rects([
  [78, 452, 8, 10], [110, 518, 8, 10], [94, 606, 8, 10], [78, 672, 8, 10], [122, 430, 8, 10],
  [148, 474, 8, 10], [160, 584, 8, 10], [148, 650, 8, 10],
]);

export function MidCity() {
  const haze = `room-mid-haze${useId()}`;
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={haze} x1="0" y1="760" x2="0" y2="900" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c76c8c" stopOpacity="0" />
          <stop offset="1" stopColor="#c76c8c" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d={TALL} fill="#6c4590" />
      <path d={TALL_LIT} fill="#c96a8c" />
      <path d={TALL_FLOORS} fill="#5d3b80" />
      <path d={TALL_WINDOWS} fill="#ffd690" />
      <path d={MID.map(towerPath).join("")} fill="#8a5291" />
      <path d={MID_WINDOWS.lit} fill="#ffd690" opacity="0.9" />
      <rect x="-150" y="760" width="1200" height={BOTTOM - 760} fill={`url(#${haze})`} />
    </svg>
  );
}

/* ---- near: big indigo blocks, a lit sun side, windows on ---- */

const NEAR: Tower[] = [
  [-240, 150, 800, "step"], [-80, 128, 770, "antenna"], [58, 170, 822], [238, 140, 786, "step"],
  [388, 160, 812], [556, 150, 778, "slant"], [716, 132, 806, "antenna"], [858, 170, 790, "step"],
  [1036, 140, 818],
];

const NEAR_WINDOWS = windowGrid(NEAR, 19, { gx: 20, gy: 26, ww: 8, wh: 12, lit: 0.2, pad: 16, until: 940 });

/* The sun side of each near tower: its left fifth, catching the light. */
const NEAR_SIDE = NEAR.map(([x, w, top, roof]) => {
  const s = r1(w * 0.2);
  const t = roof === "step" ? top + Math.min(40, w * 0.35) : roof === "slant" ? top + Math.min(34, w * 0.4) : top;
  return `M${x} ${BOTTOM}V${t}h${s}V${BOTTOM}Z`;
}).join("");

const NEAR_RIM = NEAR.map(([x, w, top, roof]) => {
  const t = roof === "step" ? top + Math.min(40, w * 0.35) : roof === "slant" ? top + Math.min(34, w * 0.4) : top;
  return `M${x} ${BOTTOM}V${t}h4V${BOTTOM}Z`;
}).join("");

export function NearCity() {
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <path d={NEAR.map(towerPath).join("")} fill="#45387c" />
      <path d={NEAR_SIDE} fill="#5b468f" />
      <path d={NEAR_WINDOWS.dark} fill="#3b2f6e" />
      <path d={NEAR_WINDOWS.lit} fill="#ffd27e" />
      <path d={NEAR_RIM} fill="#ff9f7e" opacity="0.7" />
    </svg>
  );
}
