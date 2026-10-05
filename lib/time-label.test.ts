import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatHour, padHour, useHourLabel } from "./time-label";

describe("hour labels", () => {
  it("pads the 24 hour form both renders agree on", () => {
    expect(padHour(0)).toBe("00:00");
    expect(padHour(9)).toBe("09:00");
    expect(padHour(21)).toBe("21:00");
  });

  it("says an hour the way the locale does", () => {
    expect(formatHour(21, "en-GB")).toBe("21");
    expect(formatHour(21, "en-US")).toMatch(/^9\s?PM$/i);
    expect(formatHour(9, "en-AU")).toMatch(/^9\s?am$/i);
  });

  it("uses the device's own locale when none is given", () => {
    const device = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2000, 0, 1, 7));
    expect(formatHour(7)).toBe(device);
  });

  /* The server render is what the client's first render must match
     (#418): before mount the label is the padded form, never the
     device's words. */
  it("renders the padded form on the server", () => {
    function Probe() {
      const hour = useHourLabel();
      return createElement("span", null, hour(21));
    }
    expect(renderToString(createElement(Probe))).toBe("<span>21:00</span>");
  });
});
