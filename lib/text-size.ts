/**
 * The phone's text size, followed (#451, Apple's Dynamic Type).
 *
 * Someone who has turned their iPhone's text up has said how big they
 * need words to be, and every app on the phone answers. Ethos set its
 * type in fixed sizes and did not. It follows now, the way the phone's
 * own Display Zoom does: the page is laid out as a narrower phone and
 * shown larger, so the words, the numbers, the marks and the taps all
 * grow together, and every layout rule the app has (they are written
 * against the width and height of the screen) reads the room it really
 * has. A 390pt iPhone with its text two steps up lays Ethos out at 320
 * and shows it 1.22 times the size: the layout the 320 gates already
 * hold to.
 *
 * How: the viewport tag's `initial-scale`. With no width beside it the
 * browser infers the layout width as device-width / scale, in portrait
 * and landscape alike. The tag is written by the head's boot script
 * before anything is laid out, from the size iOS sets body text at
 * (`font: -apple-system-body` on a probe: 17 at the default, 19, 21 and
 * 23 up the Text Size slider, 28 to 53 under Larger Accessibility
 * Sizes). The app owns the tag: the root layout tells Next to emit no
 * viewport tag of its own, because Next re-inserts its tag on every
 * client navigation and the last tag in the head wins.
 *
 * What it does not do:
 *  - shrink. A text size under the default leaves Ethos as it is drawn:
 *    11px is its floor (#450);
 *  - go past the room there is. The layout never gets narrower than
 *    320, so a 390pt phone tops out at 1.22 and a 430pt one at 1.34,
 *    whatever the slider says;
 *  - change while the app is open. It is read when the page loads; a
 *    new text size is followed the next time Ethos opens. Changing the
 *    viewport of a running page is the part of this that iOS has broken
 *    before, and it is not needed.
 *
 * A plain module, never a "use client" one: the root layout inlines the
 * script as a string (see lib/theme-boot.ts for why that matters).
 */

/** The size iOS sets body text at when Text Size is at its default. */
export const BODY_DEFAULT_PX = 17;
/** The narrowest layout the app is cut for. */
export const MIN_LAYOUT_WIDTH = 320;
/** Under this much, the page is left exactly as it is. */
export const ZOOM_FLOOR = 1.03;
/** Where there is room to spare (an iPad), no more than this. */
export const ZOOM_CEILING = 1.5;

/** What the viewport tag says when nothing is followed: the app as it has always been laid out. */
export const VIEWPORT_PLAIN = "width=device-width, initial-scale=1, viewport-fit=cover";

/**
 * The layout width for a body text size on a device `deviceWidth`
 * points across (its narrow side): the device's own width at or under
 * the default size, narrower as the text grows, never under 320.
 */
export function layoutWidthFor(bodyPx: number, deviceWidth: number): number {
  if (!(bodyPx > BODY_DEFAULT_PX) || !(deviceWidth > MIN_LAYOUT_WIDTH)) return deviceWidth;
  const want = Math.min(bodyPx / BODY_DEFAULT_PX, ZOOM_CEILING);
  const width = Math.max(MIN_LAYOUT_WIDTH, Math.round(deviceWidth / want));
  return deviceWidth / width < ZOOM_FLOOR ? deviceWidth : width;
}

/** How much larger the page is shown: device width over layout width, 1 when nothing is followed. */
export function textZoom(bodyPx: number, deviceWidth: number): number {
  const width = layoutWidthFor(bodyPx, deviceWidth);
  return width === deviceWidth ? 1 : Math.round((deviceWidth / width) * 100000) / 100000;
}

/** The viewport tag's content for a zoom. */
export function viewportFor(zoom: number): string {
  return zoom > 1 ? `initial-scale=${zoom}, viewport-fit=cover` : VIEWPORT_PLAIN;
}

/**
 * The boot script. Writes the page's one viewport tag, and says the zoom
 * on <html> (`data-text-zoom`) for the code that reads the visual
 * viewport. Kept in step with `layoutWidthFor` above by
 * lib/text-size.test.ts, which runs both on the same inputs.
 *
 * `document.write` only while the page is still being parsed: called
 * later it would replace the document. If the script ever runs late it
 * sets the tag through the DOM instead.
 */
export const textSizeBootScript = `
(function(){
  var plain = '${VIEWPORT_PLAIN}';
  var content = plain, zoom = 1;
  try {
    var p = JSON.parse(localStorage.getItem('ethos.prefs')||'{}');
    if (p.followTextSize !== false && window.CSS && CSS.supports && CSS.supports('font','-apple-system-body')) {
      var probe = document.createElement('span');
      probe.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none';
      document.documentElement.appendChild(probe);
      var body = parseFloat(getComputedStyle(probe).fontSize);
      document.documentElement.removeChild(probe);
      var device = Math.min(screen.width, screen.height);
      if (body > ${BODY_DEFAULT_PX} && device > ${MIN_LAYOUT_WIDTH}) {
        var want = Math.min(body / ${BODY_DEFAULT_PX}, ${ZOOM_CEILING});
        var width = Math.max(${MIN_LAYOUT_WIDTH}, Math.round(device / want));
        if (device / width >= ${ZOOM_FLOOR}) {
          zoom = Math.round((device / width) * 100000) / 100000;
          content = 'initial-scale=' + zoom + ', viewport-fit=cover';
        }
      }
    }
  } catch (e) { content = plain; zoom = 1; }
  try {
    if (zoom > 1) document.documentElement.setAttribute('data-text-zoom', String(zoom));
    if (document.readyState === 'loading') {
      document.write('<meta name="viewport" data-text-size content="' + content + '">');
    } else {
      var m = document.querySelector('meta[name="viewport"][data-text-size]');
      if (!m) { m = document.createElement('meta'); m.name = 'viewport'; m.setAttribute('data-text-size', ''); document.head.appendChild(m); }
      m.setAttribute('content', content);
    }
  } catch (e) {}
})();
`;

/** The zoom the boot script applied to this page: read off <html>, 1 where there is none. */
export function appliedTextZoom(): number {
  if (typeof document === "undefined") return 1;
  const z = Number(document.documentElement.getAttribute("data-text-zoom"));
  return z > 1 ? z : 1;
}

/**
 * Whether this browser can follow a text size at all: WebKit on an
 * Apple device, which is the one place `-apple-system-body` means
 * anything.
 */
export function textSizeFollowed(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("font", "-apple-system-body");
  } catch {
    return false;
  }
}

/**
 * The zoom this phone's text size asks for, whether or not Ethos is
 * following it: what the boot script applies with the switch on. 1
 * where the text is at its default or under, where the phone has no
 * room to spare, and where the browser cannot say. Settings shows its
 * row only where this is over 1: a switch that could change nothing is
 * not offered (#446).
 */
export function askedTextZoom(): number {
  if (typeof document === "undefined" || !textSizeFollowed()) return 1;
  try {
    const probe = document.createElement("span");
    probe.style.cssText = "font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none";
    document.documentElement.appendChild(probe);
    const body = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return textZoom(body, Math.min(window.screen.width, window.screen.height));
  } catch {
    return 1;
  }
}
