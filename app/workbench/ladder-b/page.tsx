"use client";

import "./ladder-b.css";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DemosArt } from "@/components/DemosArt";
import { IconGear } from "@/components/Icon";
import { PaywallB, PaywallBody } from "./PaywallB";
import { CodeLine, FreeDoor, ManageBody, ManageSheet, PlanCard, SettingsAccount } from "./Plan";
import { CheckoutReturn, DropBody, DropSheet } from "./Moments";
import { PLANS } from "./data";

/**
 * Direction B, "The staircase" (the workbench, DECISIONS #255): every
 * surface of the price ladder at 390px, each in its own labelled frame,
 * on the fixed fictional data the three directions share (today is
 * Saturday 24 October 2026).
 *
 * `?open=paywall` raises the real sheet over a stand-in for You, so it
 * can be photographed in place; `?open=manage` and `?open=drop` do the
 * same for the manage sheet and the monthly drop.
 */
export default function LadderB() {
  return (
    <Suspense>
      <Bench />
    </Suspense>
  );
}

function Bench() {
  const open = useSearchParams().get("open");
  const [closed, setClosed] = useState(false);
  const [replayDrop, setReplayDrop] = useState(0);
  const [replayReturn, setReplayReturn] = useState(0);

  if (open && !closed) {
    return (
      <>
        <Backdrop />
        {open === "paywall" && <PaywallB reason="Premium" onClose={() => setClosed(true)} checkoutOpen />}
        {open === "manage" && <ManageSheet plan={PLANS.active} onClose={() => setClosed(true)} />}
        {open === "drop" && <DropSheet onClose={() => setClosed(true)} />}
      </>
    );
  }

  return (
    <main className="mx-auto max-w-[390px] pb-28 pt-8">
      <header className="px-5">
        <p className="eyebrow">Price ladder, direction B</p>
        <h1 className="section-head mt-1">The staircase</h1>
        <p className="mt-2 text-caption leading-relaxed text-stone-500">
          Seven steps measured from zero, in the answer rows&apos; grammar. A token with Demos&apos;s paw stands on your month. Paid months press flat.
        </p>
      </header>

      <Frame id="1-paywall-checkout" title="1. Paywall, free account, checkout open" sheet>
        <PaywallBody onClose={() => {}} checkoutOpen onStart={() => "needsAccount"} />
      </Frame>

      <Frame id="2-paywall-account" title="2. Paywall, needs an account" sheet>
        <PaywallBody onClose={() => {}} checkoutOpen initialPhase="needsAccount" />
      </Frame>

      <Frame id="3a-you-active" title="3a. You, active, month 3">
        <PlanCard plan={PLANS.active} />
      </Frame>
      <Frame id="3b-you-floor" title="3b. You, at the floor, month 9">
        <PlanCard plan={PLANS.floor} />
      </Frame>
      <Frame id="3c-you-ending" title="3c. You, ending 24 Nov">
        <PlanCard plan={PLANS.ending} />
      </Frame>
      <Frame id="3d-you-pastdue" title="3d. You, card declined">
        <PlanCard plan={PLANS.pastDue} />
      </Frame>
      <Frame id="3e-you-code" title="3e. You, Premium from an invite code">
        <CodeLine />
      </Frame>
      <Frame id="3f-you-free" title="3f. You, the free account's door">
        <FreeDoor />
      </Frame>

      <Frame id="4a-manage-active" title="4a. Manage plan" sheet>
        <ManageBody plan={PLANS.active} onClose={() => {}} />
      </Frame>
      <Frame id="4b-manage-confirm" title="4b. Manage plan, after one tap on Cancel plan" sheet>
        <ManageBody plan={PLANS.active} initialMode="confirm" onClose={() => {}} />
      </Frame>
      <Frame id="4c-manage-ending" title="4c. Manage plan, ending" sheet>
        <ManageBody plan={PLANS.ending} onClose={() => {}} />
      </Frame>
      <Frame id="4d-manage-pastdue" title="4d. Manage plan, card declined" sheet>
        <ManageBody plan={PLANS.pastDue} onClose={() => {}} />
      </Frame>

      <Frame id="5-settings" title="5. Settings, the Manage plan row">
        <SettingsAccount plan={PLANS.active} />
      </Frame>

      <Frame
        id="6-checkout-return"
        title="6. Back from checkout, on You"
        action={<Replay onClick={() => setReplayReturn((n) => n + 1)} />}
      >
        <div className="large-title-row">
          <h2 className="large-title">You</h2>
          <span className="flex size-11 items-center justify-center rounded-control bg-surface text-stone-500">
            <IconGear size={22} />
          </span>
        </div>
        <div className="mt-5">
          <CheckoutReturn replay={replayReturn} />
        </div>
      </Frame>

      <Frame
        id="7-drop"
        title="7. The month the price drops"
        sheet
        action={<Replay onClick={() => setReplayDrop((n) => n + 1)} />}
      >
        <DropBody replay={replayDrop} onClose={() => {}} />
      </Frame>
    </main>
  );
}

function Replay({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-link text-terracotta-700">
      Replay
    </button>
  );
}

/**
 * One surface in its frame. A sheet stands at the frame's foot over a
 * stand-in for the scrim, as it stands over a page; anything else sits
 * on the ground at the screen's 20px gutter.
 */
function Frame({
  id,
  title,
  sheet = false,
  action,
  children,
}: {
  id: string;
  title: string;
  sheet?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-display text-row">{title}</h2>
        {action}
      </div>
      <div
        data-shot={id}
        className={`mt-2.5 ${sheet ? "lb-frame-scrim flex flex-col justify-end pt-10" : "bg-ground px-5 py-6"}`}
      >
        {children}
      </div>
    </section>
  );
}

/** A still of You behind a sheet opened in place: title and identity card. */
function Backdrop() {
  return (
    <main className="px-5 pt-7">
      <div className="large-title-row">
        <h1 className="large-title">You</h1>
        <span className="flex size-11 items-center justify-center rounded-control bg-surface text-stone-500">
          <IconGear size={22} />
        </span>
      </div>
      <section className="card mt-5 p-5 text-center">
        <DemosArt pose="hello" size={128} halo={{ tone: "sky", kind: "coin" }} />
        <p className="section-head mt-3">Timothy</p>
        <p className="font-display mt-1 text-title font-extrabold">Level 7</p>
        <div className="mx-auto mt-3 h-2 w-[200px] bg-sand">
          <div className="h-full w-2/5 bg-sage-500" />
        </div>
      </section>
      <div className="mt-7">
        <FreeDoor />
      </div>
    </main>
  );
}
