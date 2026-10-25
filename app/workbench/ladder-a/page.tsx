"use client";

import { useEffect, useState } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { DemosArt } from "@/components/DemosArt";
import { Overlay } from "@/components/ui/Overlay";
import { springMs, SPRING } from "@/lib/spring";
import "./ladder-a.css";
import type { PlanState } from "./ladder";
import {
  CodePremiumLine,
  FreeDoor,
  ManageSheet,
  MomentSheet,
  PaywallSheet,
  PlanCard,
  SettingsPremiumGroup,
  type ManageStep,
  type PaywallState,
} from "./Surfaces";

/**
 * Direction A, the timeline (the workbench, DECISIONS #255).
 *
 * Every surface the price ladder touches, at 390px, as it would really
 * look, each in its own labelled frame; `?open=paywall` also raises the
 * paywall as the real overlay sheet so it can be shot in place, and
 * `?open=drop` the monthly moment. The data is fixed and fictional and
 * identical across the three directions: today is Saturday 24 October
 * 2026.
 */
const TODAY = new Date(2026, 9, 24);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

type Sub = Extract<PlanState, { kind: "active" | "ending" | "past_due" }>;
const ACTIVE: Sub = { kind: "active", start: d(2026, 8, 24), month: 3 };
const FLOOR: Sub = { kind: "active", start: d(2026, 2, 24), month: 9 };
const ENDING: Sub = { kind: "ending", start: d(2026, 8, 24), month: 3, endsOn: d(2026, 11, 24) };
const PAST_DUE: Sub = {
  kind: "past_due",
  start: d(2026, 8, 24),
  month: 3,
  declinedOn: d(2026, 10, 24),
  retryOn: d(2026, 10, 27),
};

/** The stair starts to rise as the sheet's spring is about 80% home
    (a third of its settle time), so the two read as one arrival. */
const SHEET_LANDS = Math.round(springMs(SPRING.sheet) * 0.3);

export default function LadderA() {
  const [open, setOpen] = useState<null | "paywall" | "drop" | "manage">(null);
  const [paywallState, setPaywallState] = useState<PaywallState>("offer");
  const [manage, setManage] = useState<{ plan: Sub; step: ManageStep } | null>(null);
  const [stage, setStage] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("open");
    // In place: the sheets stand over a page shaped like You, not over
    // the workbench's own frames.
    if (q || params.has("stage")) setStage(true);
    if (q === "paywall" || q === "drop") setOpen(q);
    if (q === "manage") setManage({ plan: ACTIVE, step: "main" });
  }, []);

  const overlays = (
    <>
      {open === "paywall" && (
        <Overlay label="Premium" onClose={() => setOpen(null)}>
          <PaywallSheet
            today={TODAY}
            state={paywallState}
            lead={SHEET_LANDS}
            onStart={() => setPaywallState("needs-account")}
            onClose={() => setOpen(null)}
          />
        </Overlay>
      )}
      {open === "drop" && (
        <Overlay label="Your price dropped" onClose={() => setOpen(null)}>
          <MomentSheet
            kind="drop"
            start={d(2026, 7, 24)}
            today={TODAY}
            month={4}
            stepFrom={3}
            stepAfter={springMs(SPRING.sheet)}
            onDone={() => setOpen(null)}
          />
        </Overlay>
      )}
      {manage && (
        <Overlay label="Manage plan" onClose={() => setManage(null)}>
          <ManageSheet plan={manage.plan} today={TODAY} initialStep={manage.step} onDone={() => setManage(null)} />
        </Overlay>
      )}
    </>
  );

  if (stage) {
    return (
      <main className="la-root mx-auto max-w-[390px] px-5 pb-28 pt-7">
        <h1 className="large-title">You</h1>
        <section className="card mt-5 p-5 text-center">
          <DemosArt pose="hello" size={128} halo={{ tone: "sky", kind: "coin" }} />
          <p className="section-head mt-3">Timothy</p>
          <p className="font-display mt-1 text-title font-extrabold tabular-nums">Level 7</p>
          <div className="mx-auto mt-3 h-2 w-[200px] bg-sand">
            <div className="h-full w-[41%] bg-sage-500" />
          </div>
          <p className="mt-1.5 text-caption font-medium tabular-nums text-stone-500">145 of 350 to level 8</p>
        </section>
        <div className="mt-7">
          <FreeDoor
            onOpen={() => {
              setPaywallState("offer");
              setOpen("paywall");
            }}
          />
        </div>
        {overlays}
      </main>
    );
  }

  return (
    <main className="la-root mx-auto max-w-[390px] pb-28 pt-8">
      <header className="px-5">
        <h1 className="section-head">The ladder, as a timeline</h1>
        <p className="mt-1 text-caption text-stone-500">
          Direction A. Real months from today, Saturday 24 October 2026.
        </p>
        <button
          type="button"
          data-open-paywall
          onClick={() => {
            setPaywallState("offer");
            setOpen("paywall");
          }}
          className="text-link mt-3 text-terracotta-700"
        >
          Open the paywall in place
        </button>
      </header>

      <Frame id="a-1" n="1" title="Paywall, a free account">
        <SheetStage>
          <PaywallSheet today={TODAY} state="offer" />
        </SheetStage>
      </Frame>

      <Frame id="a-1-scrub" n="1" title="Paywall, scrubbed to month 4">
        <SheetStage>
          <PaywallSheet today={TODAY} state="offer" initialSel={4} />
        </SheetStage>
      </Frame>

      <Frame id="a-2" n="2" title="Paywall, needs an account">
        <SheetStage>
          <PaywallSheet today={TODAY} state="needs-account" />
        </SheetStage>
      </Frame>

      <Frame id="a-3a" n="3a" title="You, active, month 3">
        <YouStage>
          <PlanCard plan={ACTIVE} today={TODAY} onOpen={() => setManage({ plan: ACTIVE, step: "main" })} />
        </YouStage>
      </Frame>
      <Frame id="a-3b" n="3b" title="You, at the lowest price, month 9">
        <YouStage>
          <PlanCard plan={FLOOR} today={TODAY} onOpen={() => setManage({ plan: FLOOR, step: "main" })} />
        </YouStage>
      </Frame>
      <Frame id="a-3c" n="3c" title="You, ending 24 Nov">
        <YouStage>
          <PlanCard plan={ENDING} today={TODAY} onOpen={() => setManage({ plan: ENDING, step: "main" })} />
        </YouStage>
      </Frame>
      <Frame id="a-3d" n="3d" title="You, card declined">
        <YouStage>
          <PlanCard plan={PAST_DUE} today={TODAY} onOpen={() => setManage({ plan: PAST_DUE, step: "main" })} />
        </YouStage>
      </Frame>
      <Frame id="a-3e" n="3e" title="You, Premium from an invite code">
        <YouStage>
          <CodePremiumLine />
        </YouStage>
      </Frame>
      <Frame id="a-3f" n="3f" title="You, a free account's door">
        <YouStage>
          <FreeDoor onOpen={() => setOpen("paywall")} />
        </YouStage>
      </Frame>

      <Frame id="a-4a" n="4a" title="Manage plan">
        <SheetStage>
          <ManageSheet plan={ACTIVE} today={TODAY} />
        </SheetStage>
      </Frame>
      <Frame id="a-4b" n="4b" title="Manage plan, cancel tapped once">
        <SheetStage>
          <ManageSheet plan={ACTIVE} today={TODAY} initialStep="confirm" />
        </SheetStage>
      </Frame>
      <Frame id="a-4c" n="4c" title="Manage plan, ending">
        <SheetStage>
          <ManageSheet plan={ENDING} today={TODAY} />
        </SheetStage>
      </Frame>
      <Frame id="a-4d" n="4d" title="Manage plan, card declined">
        <SheetStage>
          <ManageSheet plan={PAST_DUE} today={TODAY} />
        </SheetStage>
      </Frame>

      <Frame id="a-5" n="5" title="Settings, Manage plan">
        <div className="bg-ground px-5 pb-8 pt-1">
          <SettingsPremiumGroup plan={ACTIVE} onOpen={() => setManage({ plan: ACTIVE, step: "main" })} />
          {/* Settings' next group as it ships, for the row's company. */}
          <section className="mt-7">
            <h2 className="group-head">About</h2>
            <div className="inset-group">
              {["What Ethos is", "Privacy", "Terms"].map((label) => (
                <span key={label} className="group-row flex w-full items-center gap-3">
                  <span className="font-display flex-1 text-row">{label}</span>
                  <Disclosure />
                </span>
              ))}
            </div>
          </section>
        </div>
      </Frame>
      <Frame id="a-5b" n="5" title="Settings, the row's other states">
        <div className="bg-ground px-5 pb-8 pt-1">
          <SettingsPremiumGroup plan={PAST_DUE} />
          <div className="mt-7">
            <SettingsPremiumGroup plan={ENDING} />
          </div>
          <div className="mt-7">
            <SettingsPremiumGroup plan={FLOOR} />
          </div>
        </div>
      </Frame>

      <Frame id="a-6a" n="6a" title="Checkout return, confirming">
        <SheetStage>
          <MomentSheet kind="welcome" start={TODAY} today={TODAY} month={1} confirming />
        </SheetStage>
      </Frame>
      <Frame id="a-6b" n="6b" title="Checkout return, Premium on">
        <SheetStage>
          <MomentSheet kind="welcome" start={TODAY} today={TODAY} month={1} />
        </SheetStage>
      </Frame>

      <Frame id="a-7" n="7" title="Your price dropped, month 4">
        <SheetStage>
          <MomentSheet kind="drop" start={d(2026, 7, 24)} today={TODAY} month={4} stepFrom={3} stepAfter={700} />
        </SheetStage>
      </Frame>

      {overlays}
    </main>
  );
}

function Frame({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-2.5 flex items-baseline gap-2 px-5">
        <span className="font-display text-body font-extrabold tabular-nums text-terracotta-700">{n}</span>
        <span className="font-display text-body font-bold">{title}</span>
      </div>
      <div id={id} data-frame className="relative overflow-hidden">
        {children}
      </div>
    </section>
  );
}

/** A sheet as it stands over a screen: the scrim's colour above it. */
function SheetStage({ children }: { children: React.ReactNode }) {
  return <div className="la-frame-sheet flex flex-col items-center justify-end pt-14">{children}</div>;
}

/** You's ground and gutter, where the plan sits under Day 1 vs now. */
function YouStage({ children }: { children: React.ReactNode }) {
  return <div className="bg-ground px-5 py-6">{children}</div>;
}
