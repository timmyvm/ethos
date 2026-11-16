"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorLine } from "@/components/ui/ErrorState";
import { ActionRow, InfoRow, InfoRowSkeleton, LinkRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { ManageSheet } from "@/components/premium/ManageSheet";
import { SettingsPlanRow, SettingsPlanRowSkeleton } from "@/components/premium/PlanCard";
import { fetchProfile } from "@/lib/client-data";
import { keepPlanHint, readPlanHint, settingsRowSlot } from "@/lib/plan-hint";
import { usePlan, useStripeReturn, useStripeReturns, type ProfileRead } from "@/lib/use-plan";
import { useAccount } from "@/lib/use-account";
import { restoreOffered } from "@/lib/settings-index";

/**
 * Plan (#479): the plan's row and the manage sheet (#385, #386), which
 * holds cancel, Keep my plan, and Stripe's portal for the card and the
 * receipts; back from the portal, one sync takes the row Stripe has now.
 * A free account sees Free and the way to Premium. Managing a plan is a
 * utility, so the page stays neutral; plum is only the mark (DESIGN).
 * Restore purchases is drawn only inside the native build, where an App
 * Store plan would be restored; on the web Stripe and the account hold
 * the plan on every device.
 */
export default function PlanPage() {
  const { account } = useAccount();
  const [profileRead, setProfileRead] = useState<ProfileRead>("loading");
  const plan = usePlan(profileRead);
  const stripeReturn = useStripeReturn();
  useStripeReturns(stripeReturn === "portal" ? "portal" : null, plan);
  const [managing, setManaging] = useState(false);
  /* Whether this device last saw a plan (lib/plan-hint.ts): a
     subscriber's row holds its place from the first frame. */
  const [hint, setHint] = useState(false);
  const [native, setNative] = useState(false);
  const [restoring, setRestoring] = useState(false);
  useLayoutEffect(() => {
    setHint(readPlanHint());
    setNative(restoreOffered(navigator.userAgent));
  }, []);
  useEffect(() => {
    fetchProfile()
      .then(setProfileRead)
      .catch(() => setProfileRead("failed"));
  }, []);
  useEffect(() => {
    if (plan.today) keepPlanHint(plan.view, plan.failed);
  }, [plan.view, plan.failed, plan.today]);

  const signedIn = account?.kind === "account";
  const slot = settingsRowSlot({ view: plan.view, ready: plan.today !== null, failed: plan.failed, hint, signedIn });
  const known = plan.today !== null && plan.view.kind !== "unknown";

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Plan" back={{ href: "/settings", label: "Settings" }} />

      <Section title="Your plan" className="mt-5">
        {slot === "error" ? (
          <div className="group-row">
            <ErrorLine onRetry={plan.retry}>Premium didn&apos;t load.</ErrorLine>
          </div>
        ) : slot === "skeleton" ? (
          <SettingsPlanRowSkeleton />
        ) : slot === "row" && plan.today ? (
          <SettingsPlanRow view={plan.view} today={plan.today} onOpen={() => setManaging(true)} arrive={hint ? "line" : "row"} />
        ) : !known ? (
          <InfoRowSkeleton />
        ) : plan.view.kind === "code" ? (
          <InfoRow label="Plan" value="Premium, from a code" />
        ) : (
          <>
            <InfoRow label="Plan" value="Free" />
            <LinkRow href="/you?paywall=1" label="See Premium" />
          </>
        )}
        {native && (
          <ActionRow
            label={restoring ? "Restoring…" : "Restore purchases"}
            onClick={() => {
              setRestoring(true);
              // The native shell restores through the App Store and answers
              // with ethos:restore-purchases-done; a shell that never answers
              // never leaves the row held (#479 review).
              const done = () => {
                window.clearTimeout(timer);
                window.removeEventListener("ethos:restore-purchases-done", done);
                setRestoring(false);
                plan.retry();
              };
              const timer = window.setTimeout(done, 20_000);
              window.addEventListener("ethos:restore-purchases-done", done);
              window.dispatchEvent(new CustomEvent("ethos:restore-purchases"));
            }}
            disabled={restoring}
          />
        )}
      </Section>

      {managing && plan.today && (
        <ManageSheet
          view={plan.view}
          today={plan.today}
          onClose={() => setManaging(false)}
          onPlan={(row, premium) => plan.adopt(row, premium)}
        />
      )}
    </main>
  );
}
