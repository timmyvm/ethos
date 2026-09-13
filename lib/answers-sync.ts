/**
 * Reconciling the introduction's answers with the account (DECISIONS
 * #232, #249), the freeze-sync pattern: one rule in one place.
 *
 * A finished walk on this device that the account hasn't heard goes
 * up, portfolio included. A device with no answers takes the account's
 * down, because the account is what follows someone to a new phone.
 * Anything else is left alone.
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

export async function syncOnboarding(): Promise<OnboardingState> {
  const local = readOnboarding();

  if (local.done && !local.synced) {
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
    return ok ? writeOnboarding({ synced: true }) : local;
  }

  if (!local.done && !answered(local.answers)) {
    const remote = await fetchOnboarding().catch(() => null);
    if (remote) {
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
      });
    }
  }
  return local;
}
