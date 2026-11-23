import { ART_BOUNDS } from "./lesson-art-bounds";

/**
 * Where a lesson's object is inside its square, as the CSS that places it
 * reads it (`--art-l`, `--art-t`, `--art-w`, `--art-h`, `--art-reach`):
 * its visible box and its reach, as fractions of the square
 * (lib/lesson-art-bounds.ts). lib/home.ts `artBox` is the one Today's
 * card and the recorder read, with the house's object for an id that is
 * no lesson's. This is its own module so a screen that only stands a
 * lesson's object on its disc (Lessons' Up next) does not carry Today's
 * code with it.
 */
export function lessonArtBox(
  id: string
): Record<"--art-l" | "--art-t" | "--art-w" | "--art-h" | "--art-reach", number> {
  const b = ART_BOUNDS[id];
  if (!b) throw new Error(`no art box for ${id}`);
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    "--art-l": b.l,
    "--art-t": b.t,
    "--art-w": round(b.r - b.l),
    "--art-h": round(b.b - b.t),
    "--art-reach": b.reach,
  };
}
