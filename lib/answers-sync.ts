/**
 * Reconciling the introduction's answers with the account (DECISIONS
 * #232, #249), the freeze-sync pattern: one rule in one place.
 *
 * A finished walk on this device goes up, portfolio included, to each
 * account this device signs into, once (#499): the mark is per account
 * (`syncedTo`, the user ids it has been settled with), so the answers
 * that reached a guest's session or account A still reach account B
 * when B signs in here next. An account that already finished the
 * introduction keeps its own: nothing from this device is written over
 * it. After that first meeting, a change made here goes up to the
 * account it was made under. A device with no answers takes the
 * account's down, because the account is what follows someone to a new
 * phone. Anything else is left alone.
 *
 * Two of the seven answers do not live on the onboarding row, and both
 * travel here anyway:
 *
 *  - The NAME is `profiles.display_name`, which already existed and
 *    which /you edits. Storing a second copy on the onboarding row
 *    would be two truths about one string.
 *  - The HOUR is a device preference (lib/prefs.ts) that the push cron
 *    reads off the subscription, and there is no subscription until
 *    notification permission is granted, which the introduction never
 *    asks for. So the onboarding row carries it, and a new phone
 *    inherits the choice before it has been granted anything.
 */

import {
  fetchOnboarding,
  fetchProfile,
  updateDisplayName,
  upsertOnboarding,
  type OnboardingRow,
} from "./client-data";
import {
  answered,
  cleanAnswers,
  cleanName,
  readOnboarding,
  writeOnboarding,
  type OnboardingState,
} from "./answers";
import { TIMES } from "@/content/portfolio";
import { buildPortfolio } from "./portfolio";
import { readPrefs, writePrefs } from "./prefs";
import { currentSession } from "./supabase-browser";

/** The account (or guest session) this device holds now, by user id. */
async function signedInAs(): Promise<string | null> {
  return (await currentSession())?.userId ?? null;
}

export async function syncOnboarding(): Promise<OnboardingState> {
  const local = readOnboarding();

  if (local.done) {
    const who = await signedInAs();
    // No session, nobody to settle with: the walk waits on this device.
    if (!who) return local;
    if (!local.syncedTo.includes(who)) return meet(local, who);
    return local.synced ? local : sendUp(local, who);
  }

  if (!answered(local.answers)) {
    const remote = await fetchOnboarding().catch(() => null);
    if (remote) return takeDown(remote, await signedInAs());
  }
  return local;
}

/**
 * The first time this device's finished walk meets an account (#499).
 * One that finished the introduction itself keeps its own; one that has
 * not gets this device's walk. A read that fails settles nothing, so the
 * next sync asks again rather than write over what it could not see.
 */
async function meet(local: OnboardingState, who: string): Promise<OnboardingState> {
  let theirs: OnboardingRow | null;
  try {
    theirs = await fetchOnboarding();
  } catch {
    return local;
  }
  if (theirs) {
    /* Settled: this device's answers, as they stand, are not this
       account's to take. A change made here from now on goes up to it. */
    return writeOnboarding({ synced: true, syncedTo: [...local.syncedTo, who] });
  }
  return sendUp(local, who);
}

/** This device's finished walk, up to the account signed in as `who`. */
async function sendUp(local: OnboardingState, who: string): Promise<OnboardingState> {
  const portfolio = buildPortfolio(local.answers);
  const ok = await upsertOnboarding({
    age_band: local.answers.ageBand,
    goal: local.answers.goal,
    pains: local.answers.pains,
    level: local.answers.level,
    context: local.answers.context,
    reminder_hour: readPrefs().reminderHour,
    portfolio,
    rules_version: portfolio.rulesVersion,
  });
  /*
   * The name rides along but does not gate the sync: a walk whose
   * answers reached the account is synced even if the profile upsert
   * failed, because the answers are what `synced` is about and the
   * name has its own screen to be fixed on.
   */
  if (local.answers.name !== null) {
    await updateDisplayName(local.answers.name).catch(() => false);
  }
  return ok ? writeOnboarding({ synced: true, syncedTo: [...local.syncedTo, who] }) : local;
}

/** The account's finished walk, onto this device: answers, name and hour. */
async function takeDown(remote: OnboardingRow, who: string | null): Promise<OnboardingState> {
  // The name is on the other table, and a missing profile is not a
  // reason to drop the answers we just successfully read.
  const name = await fetchProfile()
    .then((p) => cleanName(p?.display_name))
    .catch(() => null);
  /*
   * The hour round-trips; the "No reminder" ANSWER does not, since
   * the column holds an hour and "off" has none. A new phone reads
   * that as unanswered, which produces exactly the same silence, so
   * the loss costs nothing worth a second column.
   */
  if (remote.reminder_hour !== null) {
    writePrefs({ reminderHour: remote.reminder_hour });
  }
  return writeOnboarding({
    answers: cleanAnswers({
      name,
      time: TIMES.find((t) => t.hour === remote.reminder_hour)?.id ?? null,
      ageBand: remote.age_band as never,
      goal: remote.goal as never,
      pains: (remote.pains ?? []) as never,
      level: remote.level as never,
      context: remote.context as never,
    }),
    done: true,
    synced: true,
    /* The walk came from this account, so it is settled with it. */
    syncedTo: who ? [...readOnboarding().syncedTo, who] : readOnboarding().syncedTo,
  });
}

/**
 * Whether the person just signed in has finished the introduction
 * (#497): this device's walk and the account's onboarding row, merged
 * as `syncOnboarding` merges them. A walk finished on this device counts,
 * a guest's included, and goes up to the account if it has none, whichever
 * account this device signed into before (#499); an account that
 * finished elsewhere comes down onto this device, over a walk left part
 * way here, so the walk opens on its plan and never on the room. Null
 * when the account could not be read: the caller leaves the person where
 * they were going rather than guess.
 */
export async function introFinished(): Promise<boolean | null> {
  const local = readOnboarding();
  if (local.done) {
    await syncOnboarding().catch(() => local);
    return true;
  }
  let remote: OnboardingRow | null;
  try {
    remote = await fetchOnboarding();
  } catch {
    return null;
  }
  if (!remote) return false;
  await takeDown(remote, await signedInAs());
  return true;
}
