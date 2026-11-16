import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BODY_DEFAULT_PX,
  MIN_LAYOUT_WIDTH,
  VIEWPORT_PLAIN,
  ZOOM_CEILING,
  ZOOM_FLOOR,
  layoutWidthFor,
  textSizeBootScript,
  textZoom,
  viewportFor,
} from "./text-size";
import { DEFAULT_PREFS } from "./prefs";

/**
 * The phone's text size, followed (#451). The arithmetic, the boot
 * script that runs it before anything is laid out, and the one viewport
 * tag the page is allowed to have.
 */

/** What iOS sets body text at, up the Text Size slider and through Larger Accessibility Sizes. */
const IOS_BODY = [14, 15, 16, 17, 19, 21, 23, 28, 33, 40, 47, 53];
/** The narrow side of every iPhone and iPad sold, in points, and two sizes between. */
const DEVICES = [320, 360, 375, 390, 393, 402, 414, 428, 430, 440, 744, 768, 820, 834, 1024];

describe("the layout width a text size asks for", () => {
  it("is the phone's own at the default size and under it", () => {
    for (const device of DEVICES) {
      for (const body of [14, 15, 16, 17]) expect(layoutWidthFor(body, device)).toBe(device);
    }
  });

  it("gets narrower as the text grows, and never narrower than 320", () => {
    for (const device of DEVICES) {
      let last = device;
      for (const body of IOS_BODY) {
        const width = layoutWidthFor(body, device);
        expect(width).toBeLessThanOrEqual(last);
        expect(width).toBeGreaterThanOrEqual(Math.min(device, MIN_LAYOUT_WIDTH));
        expect(Number.isInteger(width)).toBe(true);
        last = width;
      }
    }
  });

  it("on a 390pt iPhone: one step is 349, two steps and everything past them is 320", () => {
    expect(layoutWidthFor(19, 390)).toBe(349);
    expect(layoutWidthFor(21, 390)).toBe(320);
    expect(layoutWidthFor(23, 390)).toBe(320);
    expect(layoutWidthFor(53, 390)).toBe(320);
  });

  it("a larger phone has more room to follow with", () => {
    expect(layoutWidthFor(21, 430)).toBe(348);
    expect(layoutWidthFor(23, 430)).toBe(320);
    expect(textZoom(23, 430)).toBeCloseTo(1.34375, 5);
    expect(textZoom(53, 390)).toBeCloseTo(1.21875, 5);
  });

  it("a 320pt phone has none, whatever the slider says", () => {
    for (const body of IOS_BODY) expect(layoutWidthFor(body, 320)).toBe(320);
  });

  it("never follows past the ceiling where there is room to spare", () => {
    for (const body of IOS_BODY) {
      expect(textZoom(body, 1024)).toBeLessThanOrEqual(ZOOM_CEILING + 0.001);
    }
    expect(textZoom(53, 1024)).toBeCloseTo(ZOOM_CEILING, 2);
  });

  it("leaves the page alone under the floor, so a rounding step is never a zoom", () => {
    for (const device of DEVICES) {
      for (const body of IOS_BODY) {
        const zoom = textZoom(body, device);
        expect(zoom === 1 || zoom >= ZOOM_FLOOR).toBe(true);
      }
    }
    // 17.3 on a 390 phone would be 383 wide, 1.018 times: not worth a different layout.
    expect(layoutWidthFor(17.3, 390)).toBe(390);
  });

  it("answers nonsense with the phone as it is", () => {
    expect(layoutWidthFor(NaN, 390)).toBe(390);
    expect(layoutWidthFor(0, 390)).toBe(390);
    expect(layoutWidthFor(-21, 390)).toBe(390);
    expect(textZoom(NaN, 390)).toBe(1);
  });
});

describe("the viewport tag", () => {
  it("is the plain one when nothing is followed", () => {
    expect(viewportFor(1)).toBe(VIEWPORT_PLAIN);
    expect(VIEWPORT_PLAIN).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
  });

  it("states a scale and no width when a size is followed, so the browser infers the width", () => {
    const content = viewportFor(1.21875);
    expect(content).toBe("initial-scale=1.21875, viewport-fit=cover");
    expect(content).not.toMatch(/width/);
  });

  it("never locks the pinch: no maximum scale, no user-scalable", () => {
    for (const content of [VIEWPORT_PLAIN, viewportFor(1.2), textSizeBootScript]) {
      expect(content).not.toMatch(/maximum-scale|minimum-scale|user-scalable/);
    }
  });
});

/** The boot script, run against a stood-in page. */
function boot({
  prefs,
  supports = true,
  body = BODY_DEFAULT_PX,
  screen = { width: 390, height: 844 },
  readyState = "loading",
  existing = false,
  broken = false,
}: {
  prefs?: unknown;
  supports?: boolean;
  body?: number | string;
  screen?: { width: number; height: number };
  readyState?: string;
  existing?: boolean;
  broken?: boolean;
} = {}) {
  const written: string[] = [];
  const html: Record<string, string> = {};
  const probes: { style: { cssText: string } }[] = [];
  let attached = 0;
  const made: { name: string; attrs: Record<string, string> }[] = [];
  const appended: unknown[] = [];
  const meta = () => {
    const m = {
      name: "",
      attrs: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        m.attrs[k] = v;
      },
    };
    made.push(m);
    return m;
  };
  const kept = existing ? meta() : null;
  const document = {
    readyState,
    documentElement: {
      appendChild() {
        attached += 1;
      },
      removeChild() {
        attached -= 1;
      },
      setAttribute(k: string, v: string) {
        html[k] = v;
      },
    },
    createElement(tag: string) {
      if (tag === "meta") return meta();
      const probe = { style: { cssText: "" } };
      probes.push(probe);
      return probe;
    },
    write(markup: string) {
      written.push(markup);
    },
    querySelector() {
      return kept;
    },
    head: {
      appendChild(node: unknown) {
        appended.push(node);
      },
    },
  };
  const css = { supports: (prop: string, value: string) => supports && prop === "font" && value === "-apple-system-body" };
  const storage = {
    getItem(key: string) {
      if (broken) throw new Error("storage is closed");
      if (key !== "ethos.prefs" || prefs === undefined) return null;
      return typeof prefs === "string" ? prefs : JSON.stringify(prefs);
    },
  };
  const run = new Function("document", "window", "localStorage", "CSS", "getComputedStyle", "screen", textSizeBootScript);
  run(document, { CSS: css }, storage, css, () => ({ fontSize: typeof body === "number" ? `${body}px` : body }), screen);
  const tag = written.join("");
  const content = /content="([^"]*)"/.exec(tag)?.[1] ?? null;
  return { written, tag, content, html, probes, attached, made, appended, kept };
}

describe("the boot script", () => {
  it("writes the plain tag at the default text size, and marks nothing", () => {
    const page = boot();
    expect(page.written).toHaveLength(1);
    expect(page.tag).toBe(`<meta name="viewport" data-text-size content="${VIEWPORT_PLAIN}">`);
    expect(page.html["data-text-zoom"]).toBeUndefined();
  });

  it("writes exactly one viewport tag, whatever the phone says", () => {
    for (const body of IOS_BODY) {
      const page = boot({ body });
      expect(page.written).toHaveLength(1);
      expect(page.tag.match(/<meta /g)).toHaveLength(1);
      expect(page.tag).toMatch(/^<meta name="viewport" data-text-size content="[^"<>]+">$/);
    }
  });

  it("agrees with the arithmetic on every text size and every device", () => {
    for (const device of DEVICES) {
      for (const body of [...IOS_BODY, 17.3, 18, 20.5]) {
        const page = boot({ body, screen: { width: device, height: Math.round(device * 2.16) } });
        const zoom = textZoom(body, device);
        expect(page.content, `${body}px on ${device}`).toBe(viewportFor(zoom));
        expect(page.html["data-text-zoom"], `${body}px on ${device}`).toBe(zoom > 1 ? String(zoom) : undefined);
      }
    }
  });

  it("reads the phone's narrow side, so a phone held sideways lays out the same", () => {
    const upright = boot({ body: 21, screen: { width: 390, height: 844 } });
    const sideways = boot({ body: 21, screen: { width: 844, height: 390 } });
    expect(sideways.content).toBe(upright.content);
    expect(upright.content).toBe("initial-scale=1.21875, viewport-fit=cover");
  });

  it("measures with a probe that is never seen and never left behind", () => {
    const page = boot({ body: 21 });
    expect(page.probes).toHaveLength(1);
    expect(page.probes[0].style.cssText).toContain("font:-apple-system-body");
    expect(page.probes[0].style.cssText).toContain("visibility:hidden");
    expect(page.probes[0].style.cssText).toContain("position:absolute");
    expect(page.attached).toBe(0);
  });

  it("follows unless the person has switched it off", () => {
    expect(boot({ body: 21, prefs: {} }).content).toBe("initial-scale=1.21875, viewport-fit=cover");
    expect(boot({ body: 21, prefs: { theme: "dark" } }).content).toBe("initial-scale=1.21875, viewport-fit=cover");
    expect(boot({ body: 21, prefs: { followTextSize: true } }).content).toBe("initial-scale=1.21875, viewport-fit=cover");
    const off = boot({ body: 21, prefs: { followTextSize: false } });
    expect(off.content).toBe(VIEWPORT_PLAIN);
    expect(off.html["data-text-zoom"]).toBeUndefined();
    expect(off.probes).toHaveLength(0);
  });

  it("is on by default in the app's preferences", () => {
    expect(DEFAULT_PREFS.followTextSize).toBe(true);
  });

  it("writes the plain tag where the browser has no text size to follow", () => {
    const page = boot({ body: 21, supports: false });
    expect(page.content).toBe(VIEWPORT_PLAIN);
    expect(page.probes).toHaveLength(0);
  });

  it("writes the plain tag when anything goes wrong on the way", () => {
    expect(boot({ body: 21, broken: true }).content).toBe(VIEWPORT_PLAIN);
    expect(boot({ body: 21, prefs: "{not json" }).content).toBe(VIEWPORT_PLAIN);
    expect(boot({ body: "" }).content).toBe(VIEWPORT_PLAIN);
    expect(boot({ body: "medium" }).content).toBe(VIEWPORT_PLAIN);
    expect(boot({ body: 21, screen: { width: 0, height: 0 } }).content).toBe(VIEWPORT_PLAIN);
  });

  it("never calls document.write once the page has been read: it sets the tag through the DOM", () => {
    for (const readyState of ["interactive", "complete"]) {
      const fresh = boot({ body: 21, readyState });
      expect(fresh.written).toHaveLength(0);
      expect(fresh.appended).toHaveLength(1);
      expect(fresh.made[0].name).toBe("viewport");
      expect(fresh.made[0].attrs.content).toBe("initial-scale=1.21875, viewport-fit=cover");
      expect(fresh.made[0].attrs["data-text-size"]).toBe("");

      const again = boot({ body: 21, readyState, existing: true });
      expect(again.written).toHaveLength(0);
      expect(again.appended).toHaveLength(0);
      expect(again.kept?.attrs.content).toBe("initial-scale=1.21875, viewport-fit=cover");
    }
  });

  it("carries the module's numbers, not copies of them", () => {
    expect(textSizeBootScript).toContain(`'${VIEWPORT_PLAIN}'`);
    expect(textSizeBootScript).toContain(`body > ${BODY_DEFAULT_PX}`);
    expect(textSizeBootScript).toContain(`Math.max(${MIN_LAYOUT_WIDTH},`);
    expect(textSizeBootScript).toContain(`>= ${ZOOM_FLOOR}`);
    expect(textSizeBootScript).toContain(`, ${ZOOM_CEILING})`);
  });
});

describe("the page has one viewport tag, and the boot script owns it", () => {
  const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

  it("the root layout tells Next to emit none of its own", () => {
    const viewport = /export const viewport: Viewport = \{([\s\S]*?)\n\};/.exec(layout)?.[1] ?? "";
    expect(viewport).toMatch(/\bwidth: undefined,/);
    expect(viewport).toMatch(/\binitialScale: undefined,/);
    expect(viewport).not.toMatch(/maximumScale|userScalable|viewportFit/);
  });

  it("the boot script is the head's first child, ahead of every other script", () => {
    const head = /<head>([\s\S]*?)<\/head>/.exec(layout)?.[1] ?? "";
    const first = head.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").trim();
    expect(first.startsWith("<script dangerouslySetInnerHTML={{ __html: textSizeBootScript }} />")).toBe(true);
  });

  it("a browser running no script still gets the plain tag", () => {
    expect(layout).toMatch(/<noscript>\s*<meta name="viewport" content=\{VIEWPORT_PLAIN\} \/>\s*<\/noscript>/);
  });

  it("nothing else in the app writes a viewport tag", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          const source = readFileSync(join(process.cwd(), path), "utf8");
          if (/name=["']viewport["']|export const viewport\b|generateViewport/.test(source)) hits.push(path);
        }
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(dir);
    expect(hits.sort()).toEqual(["app/layout.tsx", "lib/text-size.ts"]);
  });
});
