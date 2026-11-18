import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/history" }));

const { LogStage } = await import("@/components/log/LogStage");

/*
 * The Log's stage in each of its states (#506 and its review): what is on
 * it, and when Demos stands on it. He is there at a moment only, the empty
 * Log and the first recording, and the stage then takes the screen's
 * spare height so no band of bare ground is left (DESIGN 7).
 */
const stage = (props: Parameters<typeof LogStage>[0]) => renderToStaticMarkup(createElement(LogStage, props));

describe("the Log's stage", () => {
  it("with nothing recorded: a dash, the first-recording line, Demos, the spare height", () => {
    const html = stage({ index: null, first: null, series: [], recordings: 0 });
    expect(html).toContain("log-stage-empty");
    expect(html).toContain("Your first recording starts the line.");
    expect(html).toMatch(/demos-onboard-hello/);
    expect(html).not.toContain("log-chart");
  });

  it("with one recording: its number, Demos celebrating, the height its one row leaves, no line", () => {
    const html = stage({ index: 604, first: 604, series: [604], recordings: 1 });
    expect(html).toContain("log-stage-lone");
    expect(html).toContain("Your next recording starts the line.");
    expect(html).toMatch(/demos-onboard-celebrate/);
    expect(html).not.toContain("log-chart");
    expect(html).not.toContain("since you started");
  });

  it("with a history: the number, the change since the first and the line, and no Demos", () => {
    const html = stage({ index: 662, first: 611, series: [611, 640, 662], recordings: 22 });
    expect(html).not.toMatch(/log-stage-(empty|lone)/);
    expect(html).not.toMatch(/demos-onboard/);
    expect(html).toContain("log-chart");
    expect(html).toContain("51 since you started");
    expect(html).toContain('aria-label="Ethos 611 to 662, up 51"');
  });

  it("with two recordings, one of them too short to score: no line yet, and no Demos", () => {
    const html = stage({ index: 640, first: 640, series: [640], recordings: 2 });
    expect(html).not.toMatch(/demos-onboard/);
    expect(html).toContain("Your next recording starts the line.");
  });
});
