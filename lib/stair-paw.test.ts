import { readFileSync } from "node:fs";
import * as React from "react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stair } from "@/components/premium/Stair";

/*
 * The paywall's stair without the Paw (notes1, Timothy: "Lets remove
 * the paw from the paywall"). The lit step and the readout carry the
 * selection; the slider stays a slider. The Paw stays where he named
 * nothing: You's plan card, the manage sheet and the price drop.
 */
// The components compile to React.createElement here (vitest's classic
// JSX), so the global has to be there when they render.
(globalThis as { React?: typeof React }).React = React;

const labels = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr+"];
const slider = (paw?: boolean) =>
  renderToString(
    createElement(Stair, {
      tone: "plum",
      size: "lg",
      at: 1,
      selected: 3,
      onSelect: () => {},
      labels,
      label: "Month",
      valueText: (n: number) => `Month ${n}`,
      ...(paw === undefined ? {} : { paw }),
    })
  );

describe("Stair's paw prop", () => {
  it("draws the Paw by default", () => {
    expect(slider()).toContain("stair-token");
  });

  it("draws no Paw with paw={false}, and says so to the CSS so the room above the steps closes", () => {
    const html = slider(false);
    expect(html).not.toContain("stair-token");
    expect(html).toMatch(/data-paw="none"/);
  });

  it("keeps the slider whole without the Paw: role, value, valuetext, keys", () => {
    const html = slider(false);
    expect(html).toMatch(/role="slider"/);
    expect(html).toMatch(/aria-valuenow="3"/);
    expect(html).toMatch(/aria-valuetext="Month 3"/);
    expect(html).toMatch(/tabindex="0"/);
    // The lit step still carries the selection.
    expect(html.match(/data-state="lit"/g)?.length).toBe(1);
  });

  it("keeps the Paw on a picture (You's plan card, the manage sheet)", () => {
    const html = renderToString(createElement(Stair, { tone: "neutral", size: "sm", at: 2, label: "Your plan" }));
    expect(html).toContain("stair-token");
  });
});

describe("where the Paw goes", () => {
  it("the paywall turns it off", () => {
    expect(readFileSync("components/Paywall.tsx", "utf8")).toMatch(/<Stair[\s\S]{0,400}paw=\{false\}/);
  });
  it("nothing else does", () => {
    for (const f of ["components/premium/PlanCard.tsx", "components/premium/ManageSheet.tsx", "components/premium/Moments.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/paw=\{false\}/);
    }
  });
  it("closes the Paw's room with the variable that made it", () => {
    expect(readFileSync("app/globals.css", "utf8")).toMatch(/\.stair\[data-paw="none"\]\s*\{\s*--stair-token:\s*0px;/);
  });
});
