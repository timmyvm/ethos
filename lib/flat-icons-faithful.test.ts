import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FlatDrawing } from "@/components/icons/flat/FlatDrawing";
import { FLAT_ICONS, FLAT_KINDS, iconMarkup, type FlatKind } from "@/components/icons/flat/geometry";

/*
 * The flat set was drawn and reviewed outside the app, one standalone SVG
 * per drawing with its colours baked in (lib/__fixtures__/flat-icons/, the
 * render truth; xp, best, target and hourglass baked from the drawings as
 * they stood before the lesson set came in, the target's and the gauge's
 * colours since retoned to their families' in the #516 review, the
 * shapes untouched). This holds the app's code to
 * them: every kind, drawn through both writers (the SVG string scripts and
 * the export use, and the React component pages render) with the tones
 * flat-icons.css gives it, must raster the same as its truth at 192px.
 * Compared as pixels, never as strings, so a reordered attribute or a
 * renamed clip id cannot fail it and a moved corner cannot pass it.
 */

const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "components/icons/flat/flat-icons.css"), "utf8");
const truthDir = path.join(root, "lib/__fixtures__/flat-icons");
const PX = 192;

/** The tone values of the one `.fi` rule. */
const tones = (() => {
  const at = css.indexOf(".fi {");
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return new Map([...body.matchAll(/(--fi-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
})();

/** CSS variables replaced by their values, the size set to PX, and the namespace a bare React svg lacks. */
function bake(svg: string): string {
  // A stat mark's fill carries its hex as a fallback (stat-tones.ts); the CSS value is what draws.
  let out = svg.replace(/var\((--fi-[\w-]+)(?:, #[0-9a-f]{6})?\)/g, (_, v: string) => {
    const value = tones.get(v);
    if (!value) throw new Error(`no tone for ${v}`);
    return value;
  });
  if (!/<svg[^>]*xmlns=/.test(out)) out = out.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return out.replace(/(<svg[^>]*?) width="[^"]*" height="[^"]*"/, `$1 width="${PX}" height="${PX}"`);
}

async function raster(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}

type Diff = { max: number; off: number };

/** The largest channel difference anywhere, and how many pixels differ by more than an edge's anti-aliasing. */
function diff(a: Buffer, b: Buffer): Diff {
  expect(a.length).toBe(b.length);
  let max = 0;
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    let px = 0;
    for (let c = 0; c < 4; c++) px = Math.max(px, Math.abs(a[i + c] - b[i + c]));
    max = Math.max(max, px);
    if (px > 48) off++;
  }
  return { max, off };
}

const truth = (kind: FlatKind) => bake(readFileSync(path.join(truthDir, `${kind}.svg`), "utf8"));
const viaString = (kind: FlatKind) => bake(iconMarkup(kind, PX, "t"));
const viaReact = (kind: FlatKind) =>
  bake(renderToStaticMarkup(createElement(FlatDrawing, { kind, def: FLAT_ICONS[kind], size: PX })));

describe("the flat set matches its reviewed drawings", () => {
  it("has a render truth for every kind", () => {
    expect(FLAT_KINDS).toHaveLength(21);
    for (const kind of FLAT_KINDS) expect(() => readFileSync(path.join(truthDir, `${kind}.svg`)), kind).not.toThrow();
  });

  for (const kind of FLAT_KINDS) {
    it(`${kind}: the SVG string and the React component raster as its truth at ${PX}px`, async () => {
      const want = await raster(truth(kind));
      // The truth draws something: a blank raster would match a blank port.
      let drawn = 0;
      for (let i = 3; i < want.length; i += 4) if (want[i] > 128) drawn++;
      expect(drawn / (PX * PX), `${kind} truth coverage`).toBeGreaterThan(0.2);
      const string = diff(await raster(viaString(kind)), want);
      const react = diff(await raster(viaReact(kind)), want);
      // An edge may land a step differently; nothing may move: under 0.1% of
      // the 36,864 pixels may differ by more than anti-aliasing does.
      for (const [via, d] of [["string", string], ["react", react]] as const) {
        expect(d.off, `${kind} via ${via}: ${d.off} pixels off, max ${d.max}`).toBeLessThanOrEqual(36);
      }
      console.log(`${kind.padEnd(10)} string max ${string.max} (${string.off} off), react max ${react.max} (${react.off} off)`);
    });
  }

  it("fills the grid the same way everywhere: every drawing's long axis runs 84 to 88u", async () => {
    for (const kind of FLAT_KINDS) {
      const px = await raster(viaString(kind));
      let [l, r, t, b] = [PX, 0, PX, 0];
      for (let y = 0; y < PX; y++)
        for (let x = 0; x < PX; x++)
          if (px[(y * PX + x) * 4 + 3] > 127) [l, r, t, b] = [Math.min(l, x), Math.max(r, x), Math.min(t, y), Math.max(b, y)];
      const long = (Math.max(r - l, b - t) + 1) * (96 / PX);
      expect(long, kind).toBeGreaterThanOrEqual(84);
      expect(long, kind).toBeLessThanOrEqual(88.5);
    }
  });

  it("is not blind: a silhouette moved by 1u fails it", async () => {
    const want = await raster(truth("cube"));
    const moved = viaString("cube").replace('<g data-part="base"', '<g data-part="base" transform="translate(1 0)"');
    expect(moved).not.toBe(viaString("cube"));
    expect(diff(await raster(moved), want).off).toBeGreaterThan(36);
  });
});
