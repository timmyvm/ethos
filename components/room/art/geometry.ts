/*
 * The room's drawing space and the small helpers its layers share.
 *
 * Everything is drawn on one 900 x 1600 stage (9:16). The parts that
 * matter sit inside x 100 to 800, which every phone from 320x568 to
 * 430x932 shows; the rest is there for the crop and the tilt.
 */

export const VIEW_W = 900;
export const VIEW_H = 1600;
export const VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;

/** Eye level: the line the sky meets the far city at. */
export const HORIZON = 660;

/** Where the window meets the floor, and where the desk's far edge runs. */
export const FLOOR_LINE = 932;
export const DESK_EDGE = 1000;

/** How far each layer travels at full tilt, in CSS px (spec, #475). */
export const DEPTH = {
  sky: 8,
  far: 16,
  mid: 21,
  near: 26,
  office: 30,
  interviewer: 34,
  front: 41,
  desk: 48,
  pen: 64,
} as const;

/** The pen's roll at full tilt, in degrees. */
export const PEN_ROLL = 1.5;

/** A small deterministic generator, so the city is the same every time. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One path from many rectangles: the cheapest way to draw windows. */
export function rects(list: Array<[number, number, number, number]>): string {
  return list
    .map(([x, y, w, h]) => `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}z`)
    .join("");
}

export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
