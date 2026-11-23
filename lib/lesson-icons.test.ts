import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LESSON_OBJECT_KIND } from "@/components/icons/flat/lesson-drawings";
import { MEASURE_PX, boundsModule, lessonSvgFiles, visibleBox, type ArtBox } from "@/components/icons/flat/export";
import { LESSONS } from "@/content/lessons";
import { objectSrc } from "./home";
import { ART_BOUNDS } from "./lesson-art-bounds";

/*
 * The lesson icons: each lesson's flat object as one SVG file,
 * public/lessons/<lesson id>.svg, written by scripts/export-flat-icons.mjs
 * from the lessons' drawings with the tones of flat-icons.css baked in,
 * and committed. This holds what the export promises: the files on disk
 * are exactly what it would write now (so a drawing or a tone changed
 * without re-running it fails here), each is small, each rasters as its
 * reviewed drawing, Today's art boxes are measured from them, and the
 * service worker keeps them offline. No 3D cut is left.
 */
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const css = read("components/icons/flat/flat-icons.css");
const files = lessonSvgFiles(css);

/** A file's ceiling: the largest (the zip, its teeth and slider) is about 3.3 KB. */
const MAX_BYTES = 4096;

const raster = (svg: string, px: number) =>
  sharp(Buffer.from(svg), { density: (72 * px) / 96 }).resize(px, px).ensureAlpha().raw().toBuffer();

describe("the lesson icons", () => {
  it("are one SVG per lesson, at the path every reader asks for", () => {
    expect(Object.keys(files)).toHaveLength(15);
    for (const lesson of LESSONS) {
      expect(lesson.art).toBe(`/lessons/${lesson.id}.svg`);
      expect(objectSrc(lesson.id)).toBe(lesson.art);
      expect(files[`public${lesson.art}`], lesson.id).toBeDefined();
    }
    // An id that is no lesson's draws the house's object.
    expect(objectSrc("nope")).toBe("/lessons/the-long-one.svg");
  });

  it("are exactly what the export writes now: regenerating changes no byte", () => {
    for (const [path, svg] of Object.entries(files)) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(readFileSync(join(root, path), "utf8"), `${path}: re-run scripts/export-flat-icons.mjs`).toBe(svg);
    }
    const onDisk = readdirSync(join(root, "public/lessons")).map((n) => `public/lessons/${n}`);
    expect(onDisk.sort()).toEqual(Object.keys(files).sort());
  });

  it(`each stays under ${MAX_BYTES} bytes, with no comment, no variable and no data attribute`, () => {
    for (const [path, svg] of Object.entries(files)) {
      expect(statSync(join(root, path)).size, path).toBeLessThanOrEqual(MAX_BYTES);
      expect(svg, path).not.toMatch(/<!--|var\(|data-|style=/);
      expect(svg, path).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 96 96"/);
      // Every fill is a baked hex.
      for (const [, fill] of svg.matchAll(/fill="([^"]+)"/g)) expect(fill, path).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keep their clip ids to themselves: every id is the lesson's, and every clip it names is its own", () => {
    for (const [path, svg] of Object.entries(files)) {
      const id = path.slice("public/lessons/".length, -".svg".length);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      for (const one of ids) expect(one.startsWith(`${id}-`), `${path} ${one}`).toBe(true);
      for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids, path).toContain(ref);
    }
  });

  it("take every tone from flat-icons.css: a tone changed there changes the file", () => {
    const moved = css.replace("--fi-bowl-base: #3463ef;", "--fi-bowl-base: #123456;");
    expect(moved).not.toBe(css);
    const again = lessonSvgFiles(moved);
    expect(again["public/lessons/the-landing.svg"]).toContain('fill="#123456"');
    expect(again["public/lessons/the-landing.svg"]).not.toBe(files["public/lessons/the-landing.svg"]);
    expect(again["public/lessons/the-long-one.svg"]).toBe(files["public/lessons/the-long-one.svg"]);
  });

  /* The reviewed drawings (lib/__fixtures__/flat-icons/, the render truth
     lib/flat-icons-faithful.test.ts holds the code to): a file rasters as
     its kind's truth at 192px, under 0.1% of pixels off by more than an
     edge's anti-aliasing. */
  for (const lesson of LESSONS) {
    it(`${lesson.id}: its file rasters as its drawing's truth`, async () => {
      const kind = LESSON_OBJECT_KIND[lesson.id];
      const truth = readFileSync(join(root, "lib/__fixtures__/flat-icons", `${kind}.svg`), "utf8");
      const [a, b] = await Promise.all([raster(files[`public${lesson.art}`], 192), raster(truth, 192)]);
      expect(a.length).toBe(b.length);
      let off = 0;
      for (let i = 0; i < a.length; i += 4) {
        let px = 0;
        for (let c = 0; c < 4; c++) px = Math.max(px, Math.abs(a[i + c] - b[i + c]));
        if (px > 48) off++;
      }
      expect(off, `${lesson.id} (${kind})`).toBeLessThanOrEqual(36);
    });
  }

  it("are measured for Today's card: lib/lesson-art-bounds.ts is the box of each file as drawn", async () => {
    expect(Object.keys(ART_BOUNDS).sort()).toEqual(LESSONS.map((l) => l.id).sort());
    expect(read("lib/lesson-art-bounds.ts")).toContain("Generated by scripts/export-flat-icons.mjs");
    const boxes: Record<string, ArtBox> = {};
    for (const lesson of LESSONS) {
      boxes[lesson.id] = visibleBox(await raster(files[`public${lesson.art}`], MEASURE_PX), MEASURE_PX);
      const b = ART_BOUNDS[lesson.id];
      for (const k of ["l", "t", "r", "b", "reach"] as const) expect(Math.abs(b[k] - boxes[lesson.id][k]), `${lesson.id} ${k}`).toBeLessThan(0.004);
      // The reach (the disc the object stands in is sized by it) is past half the box's longer side and inside its half-diagonal.
      const [w, h] = [b.r - b.l, b.b - b.t];
      expect(b.reach, lesson.id).toBeGreaterThanOrEqual(Math.max(w, h) / 2 - 0.004);
      expect(b.reach, lesson.id).toBeLessThanOrEqual(Math.hypot(w, h) / 2 + 0.004);
      // Inside its square, the long side 84 to 88u of 96 as the set is drawn.
      for (const v of [b.l, b.t]) expect(v, lesson.id).toBeGreaterThan(0.03);
      for (const v of [b.r, b.b]) expect(v, lesson.id).toBeLessThan(0.97);
      expect(Math.max(b.r - b.l, b.b - b.t), lesson.id).toBeGreaterThan(0.86);
    }
    // The module is the one the export writes from those boxes, rows sorted.
    expect(boundsModule(ART_BOUNDS)).toBe(read("lib/lesson-art-bounds.ts"));
  });

  it("are precached under a cache that moved with them, and no 3D cut is left anywhere", () => {
    const sw = read("public/sw.js");
    for (const lesson of LESSONS) expect(sw).toContain(`"${lesson.art}"`);
    expect(sw).not.toMatch(/\/lessons\/[\w/-]*\.webp|lessons\/(large|hero)\//);
    expect(Number(sw.match(/const CACHE = "ethos-v(\d+)";/)![1])).toBeGreaterThanOrEqual(22);
    for (const gone of ["public/lessons/large", "public/lessons/hero", "scripts/cut-lesson-icons.mjs", "assets/lessons-3d"]) {
      expect(existsSync(join(root, gone)), gone).toBe(false);
    }
  });
});
