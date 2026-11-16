import { useId } from "react";
import { DESK_EDGE, FLOOR_LINE, HORIZON, VIEW_BOX } from "./geometry";

/*
 * The room around him: the dusk sky, the office's frame and floor, the
 * desk between you, and the pen. Flat shapes, no outlines; depth comes
 * from value (the far things lighter and warmer) and from the layers.
 */

/* ---- the sky: deep at the top, burning low, the sun going down right ---- */

const SUN = { x: 632, y: HORIZON - 6 };

export function Sky() {
  /* Ids of its own, so a second room on the page never shares (or, hidden, blanks) its gradients. */
  const sky = `room-sky${useId()}`;
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={sky} x1="0" y1="40" x2="0" y2={HORIZON + 20} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a1744" />
          <stop offset="0.3" stopColor="#33296b" />
          <stop offset="0.52" stopColor="#653c8a" />
          <stop offset="0.68" stopColor="#a84b8b" />
          <stop offset="0.8" stopColor="#e06a73" />
          <stop offset="0.91" stopColor="#f99a68" />
          <stop offset="1" stopColor="#ffcf86" />
        </linearGradient>
      </defs>
      <rect x="-80" y="-80" width="1060" height="1040" fill={`url(#${sky})`} />
      {/* first stars */}
      <g fill="#fff4e0">
        <circle cx="540" cy="150" r="2.6" opacity="0.7" />
        <circle cx="690" cy="96" r="2" opacity="0.55" />
        <circle cx="236" cy="210" r="2.2" opacity="0.5" />
        <circle cx="812" cy="236" r="2.6" opacity="0.6" />
        <circle cx="96" cy="120" r="2" opacity="0.45" />
        <circle cx="380" cy="104" r="1.8" opacity="0.5" />
      </g>
      {/* long flat clouds */}
      <g>
        <rect x="470" y="330" width="300" height="16" rx="8" fill="#9a4f95" opacity="0.55" />
        <rect x="560" y="356" width="170" height="10" rx="5" fill="#9a4f95" opacity="0.45" />
        <rect x="-80" y="402" width="250" height="14" rx="7" fill="#b9558e" opacity="0.5" />
        <rect x="520" y="556" width="290" height="14" rx="7" fill="#f2877a" opacity="0.6" />
        <rect x="610" y="580" width="180" height="9" rx="4.5" fill="#f2877a" opacity="0.5" />
        <rect x="-40" y="532" width="160" height="10" rx="5" fill="#f5a07a" opacity="0.55" />
      </g>
      {/* the sun and its flat rings of light */}
      <g fill="#ffd894">
        <circle cx={SUN.x} cy={SUN.y} r="250" opacity="0.08" />
        <circle cx={SUN.x} cy={SUN.y} r="170" opacity="0.12" />
        <circle cx={SUN.x} cy={SUN.y} r="112" opacity="0.2" />
      </g>
      <circle cx={SUN.x} cy={SUN.y} r="64" fill="#fff0c9" />
    </svg>
  );
}

/* ---- the office: ceiling, glass frame, floor, one plant ---- */

const LEAVES: Array<[x: number, lean: number, h: number, w: number, tone: 0 | 1 | 2]> = [
  [792, -34, 318, 34, 1],
  [770, -60, 250, 30, 0],
  [812, 8, 350, 32, 2],
  [828, 46, 268, 30, 0],
  [800, -10, 214, 28, 1],
  [846, 70, 200, 26, 2],
];

const LEAF_FILL = ["#2c6b5c", "#3b8a6c", "#4fa27b"];

function leaf([x, lean, h, w]: (typeof LEAVES)[number], base: number): string {
  const tipX = x + lean;
  const tipY = base - h;
  const midY = base - h * 0.55;
  return `M${x - w / 2} ${base}C${x - w * 0.62} ${midY} ${tipX - w * 0.3} ${tipY + h * 0.2} ${tipX} ${tipY}C${tipX + w * 0.25} ${tipY + h * 0.24} ${x + w * 0.66} ${midY} ${x + w / 2} ${base}Z`;
}

export function Office() {
  const potTop = FLOOR_LINE - 96;
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      {/* floor, polished: the sky lies in it as a warm band */}
      <rect x="-120" y={FLOOR_LINE} width="1140" height="168" fill="#1d1836" />
      <rect x="-120" y={FLOOR_LINE + 6} width="1140" height="20" fill="#33264d" opacity="0.7" />
      <rect x="-120" y={FLOOR_LINE - 6} width="1140" height="12" fill="#120f26" />
      {/* the glass's frame: mullions floor to ceiling */}
      <g fill="#16122d">
        <rect x="770" y="0" width="18" height={FLOOR_LINE} />
        <rect x="-120" y="-110" width="1140" height="182" />
      </g>
      <g fill="#3c3266">
        <rect x="770" y="72" width="4" height={FLOOR_LINE - 72} opacity="0.7" />
      </g>
      {/* the glass catches the room's light in two long glares */}
      <g fill="#ffffff">
        <path d="M560 72h96L432 932h-96z" opacity="0.04" />
        <path d="M690 72h24L520 932h-24z" opacity="0.05" />
      </g>
      {/* the ceiling's light line */}
      <rect x="-120" y="58" width="1140" height="6" fill="#4a3d7a" />
      <rect x="-120" y="64" width="1140" height="8" fill="#211a3e" />
      {/* the plant, right of him, on the floor by the glass */}
      <g>
        {LEAVES.map((l, i) => (
          <path key={i} d={leaf(l, potTop + 8)} fill={LEAF_FILL[l[4]]} />
        ))}
        <path
          d={`M742 ${potTop}h112l-10 ${96}h-92z`}
          fill="#d9744f"
        />
        <path d={`M742 ${potTop}h26l-6 ${96}h-10z`} fill="#f09a6c" />
        <rect x="736" y={potTop - 8} width="124" height="16" rx="5" fill="#c4613f" />
      </g>
    </svg>
  );
}

/* ---- the desk: dark, glossy, the sunset lying in it ---- */

export function Desk() {
  const id = useId();
  const desk = `room-desk${id}`;
  const glint = `room-glint${id}`;
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={desk} x1="0" y1={DESK_EDGE} x2="0" y2="1700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e2850" />
          <stop offset="0.35" stopColor="#221d3f" />
          <stop offset="1" stopColor="#141127" />
        </linearGradient>
        <linearGradient id={glint} x1="0" y1={DESK_EDGE} x2="0" y2="1500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff9f7a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ff9f7a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="-160" y={DESK_EDGE} width="1220" height="760" fill={`url(#${desk})`} />
      {/* the sun's reflection, a long warm streak toward you */}
      <path d={`M${SUN.x - 70} ${DESK_EDGE}h140l60 520h-260z`} fill={`url(#${glint})`} />
      {/* the far edge catching the light */}
      <rect x="-160" y={DESK_EDGE - 2} width="1220" height="6" fill="#5c4d8e" />
      <rect x={SUN.x - 110} y={DESK_EDGE - 2} width="220" height="6" fill="#ffb487" opacity="0.8" />
      {/* your CV, under his heels */}
      <g transform="rotate(-3 214 1118)">
        <path d="M134 1084L294 1078L306 1150L122 1158Z" fill="#e9e1d4" />
        <path d="M144 1092h40v24h-40z" fill="#c9bcaa" />
        <path d="M196 1094h74v5h-74zM196 1106h60v5h-60zM142 1126h140v5h-140zM140 1138h124v5h-124z" fill="#b3a693" />
      </g>
    </svg>
  );
}

/* ---- the pen: black lacquer, gold, nearest thing to you ---- */

export function Pen() {
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <g transform="translate(596 1268) rotate(-14)">
        {/* its long flat shadow, away from the sun */}
        <path d="M-196 22L150 8Q196 8 226 22L232 34Q190 46 140 44L-190 40Z" fill="#06050f" opacity="0.42" />
        {/* tip */}
        <path d="M-172 -12L-214 -2Q-220 0 -214 2L-172 12Z" fill="#cdd0dc" />
        <path d="M-172 -12L-214 -2L-172 -2Z" fill="#eef0f6" />
        <rect x="-176" y="-13" width="9" height="26" rx="2" fill="#f2b544" />
        {/* barrel */}
        <rect x="-168" y="-15" width="290" height="30" rx="15" fill="#191626" />
        <rect x="-150" y="-10" width="258" height="6" rx="3" fill="#4d4768" />
        {/* cap */}
        <rect x="118" y="-16" width="90" height="32" rx="16" fill="#100e1b" />
        <rect x="116" y="-16" width="11" height="32" fill="#f2b544" />
        <rect x="134" y="-11" width="62" height="5" rx="2.5" fill="#3d3856" />
        {/* clip */}
        <rect x="138" y="-27" width="70" height="9" rx="4.5" fill="#f6c45a" />
        <circle cx="140" cy="-22.5" r="6" fill="#f6c45a" />
        <rect x="150" y="-26" width="50" height="3" rx="1.5" fill="#fde7a8" />
      </g>
    </svg>
  );
}
