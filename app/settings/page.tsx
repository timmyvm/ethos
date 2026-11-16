"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
import { ActionRow, LinkRow, PAGE_CLASS, PoseAvatar, Section } from "@/components/settings/Rows";
import { signOut } from "@/lib/auth";
import { fetchProfile, heldProfile } from "@/lib/client-data";
import { cleanName, readOnboarding } from "@/lib/answers";
import { adoptAccountPose } from "@/lib/pose-save";
import { DEFAULT_PREFS, readPrefs, type Prefs } from "@/lib/prefs";
import { forgetPlanHint } from "@/lib/plan-hint";
import { usePlan, type ProfileRead } from "@/lib/use-plan";
import { useAccount } from "@/lib/use-account";
import { useHourLabel } from "@/lib/time-label";
import { planWord, reminderValue, themeWord } from "@/lib/settings-index";
import { SIGNED_OUT_HOME } from "@/lib/account-gate";
import { DOOR_COPY, TEST, TEST_COPY } from "@/content/tester";
import { isCurrentTester } from "@/lib/tester";
import { testDay, zoneDayKey } from "@/lib/tester-days";
import { fetchTester, forgetTesterHint, readTesterHint, testZoneHere } from "@/lib/tester-client";

/**
 * Settings (#479, Timothy's Duolingo reference of 16 Nov, drawn in
 * Ethos's own grouped list). The index is doors: the profile on top,
 * then Account, Notifications and Plan; Practice, Appearance and
 * Accessibility; Privacy and data, Help and the tester door; Sign out
 * alone; Terms and Privacy policy at the foot. The groups carry no heads,
 * as a phone's own Settings index does: a head over "Account" that said
 * Account, and one over "Practice" that said Practice, said each word
 * twice. Every door says the value its page holds ("6 pm", "Free",
 * "System"), and every page has its way back here. The one irreversible
 * action, Delete my account, moved to Privacy and data, alone at the end
 * of that page.
 */
export default function SettingsPage() {
  const { account } = useAccount();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [pose, setPose] = useState<string | null>(null);
  /* The name: the account's as this visit last read it, else the
     introduction's, before paint; the account's own when it lands. */
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [profileRead, setProfileRead] = useState<ProfileRead>("loading");
  const plan = usePlan(profileRead);
  const hour = useHourLabel();
  /* Tester mode (docs/testers.md): the door is the code for everyone
     else, "Testing Ethos, On" for a tester, "Agree again" for one on an
     older consent. The device's last answer paints first. */
  const [testing, setTesting] = useState<"no" | "on" | "renew">("no");
  const [testDayNow, setTestDayNow] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  useLayoutEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    setPose(p.pose);
    const held = heldProfile();
    const local = cleanName(readOnboarding().answers.name);
    if (held !== undefined) setName(cleanName(held?.display_name) ?? local);
    else if (local) setName(local);
    setTesting(readTesterHint() ? "on" : "no");
    setTestDayNow(testDay(zoneDayKey(Date.now(), testZoneHere())));
  }, []);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setProfileRead(p);
        setName(cleanName(p?.display_name) ?? cleanName(readOnboarding().answers.name));
        if (p) setPose(adoptAccountPose(p.equipped_pose));
      })
      .catch(() => {
        setProfileRead("failed");
        setName((n) => (n === undefined ? cleanName(readOnboarding().answers.name) : n));
      });
    fetchTester()
      .then((t) => setTesting(isCurrentTester(t) ? "on" : t ? "renew" : "no"))
      .catch(() => {});
  }, []);

  async function leave() {
    setLeaving(true);
    await signOut();
    // The next account on this device is someone else's.
    forgetPlanHint();
    forgetTesterHint();
    // Sign-in, not Today: a signed-out device is asked to make an account there.
    window.location.href = SIGNED_OUT_HOME;
  }

  const signedIn = account?.kind === "account";
  const planValue = plan.failed ? "Didn't load" : plan.today ? planWord(plan.view.kind) : null;

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Settings" back={{ href: "/you", label: "You" }} />

      {/* The profile on top, as a phone's Settings puts its owner: the
          picture is the pose worn on You, the name, then the email. */}
      <div className="inset-group mt-5">
        <Link
          href="/settings/profile"
          data-look="settings-profile"
          className="group-row press-row flex w-full items-center gap-3.5 text-left"
        >
          <PoseAvatar pose={pose} size={56} />
          <span className="min-w-0 flex-1">
            {name === undefined ? (
              <Skeleton className="h-5 w-28" />
            ) : (
              <span className="font-display block truncate text-detail">{name ?? "Add your name"}</span>
            )}
            <span className="mt-0.5 block truncate text-caption text-stone-500">
              {account === undefined ? (
                <Skeleton className="mt-1 h-3.5 w-40" />
              ) : signedIn ? (
                account.email
              ) : (
                "Your picture, name and goal"
              )}
            </span>
          </span>
          <Disclosure />
        </Link>
      </div>

      <Section>
        <LinkRow
          href="/settings/account"
          label="Account"
          value={account === undefined ? null : signedIn ? undefined : "Not saved"}
        />
        <LinkRow href="/settings/notifications" label="Notifications" value={reminderValue(prefs.reminderHour, hour)} />
        <LinkRow href="/settings/plan" label="Plan" value={planValue} />
      </Section>

      <Section>
        <LinkRow href="/settings/practice" label="Practice" />
        <LinkRow href="/settings/appearance" label="Appearance" value={themeWord(prefs.theme)} />
        <LinkRow href="/settings/accessibility" label="Accessibility" />
      </Section>

      <Section>
        <LinkRow href="/settings/data" label="Privacy and data" />
        <LinkRow href="/settings/help" label="Help" />
        <LinkRow
          href="/tester?from=settings"
          label={testing === "no" ? DOOR_COPY.settingsCode : DOOR_COPY.settingsTesting}
          value={
            testing === "on"
              ? testDayNow !== null && testDayNow > TEST.days
                ? // Collection carries on after the test (#405): On, never Ended.
                  DOOR_COPY.settingsOn
                : testDayNow !== null && testDayNow >= 1
                  ? TEST_COPY.settingsDay(testDayNow)
                  : DOOR_COPY.settingsOn
              : testing === "renew"
                ? DOOR_COPY.settingsRenew
                : undefined
          }
        />
      </Section>

      {/* Sign out alone, the way every phone's Settings ends: a guest has
          nothing to sign out of that would not lose its recordings, so
          its way is the Account page's ask. */}
      {signedIn && (
        <div className="inset-group mt-7">
          <ActionRow label={leaving ? "Signing out…" : "Sign out"} onClick={() => void leave()} disabled={leaving} center />
        </div>
      )}

      <nav aria-label="Legal" className="mt-5 flex justify-center gap-1">
        <Link href="/terms?from=settings" className="press inline-flex min-h-11 items-center px-3 text-caption font-semibold text-stone-500">
          Terms
        </Link>
        <Link href="/privacy?from=settings" className="press inline-flex min-h-11 items-center px-3 text-caption font-semibold text-stone-500">
          Privacy policy
        </Link>
      </nav>
    </main>
  );
}
