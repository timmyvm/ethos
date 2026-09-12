/**
 * Reconciling the introduction's answers with the account (DECISIONS
 * #232), the freeze-sync pattern: one rule in one place.
 *
 * A finished walk on this device that the account hasn't heard goes
 * up, portfolio included. A device with no answers takes the account's
 * down, because the account is what follows someone to a new phone.
 * Anything else is left alone.
 */

import { fetchOnboarding, upsertOnboarding } from "./client-data";
import {
  answered,
  cleanAnswers,
  readOnboarding,
  writeOnboarding,
  type OnboardingState,
} from "./answers";
import { buildPortfolio } from "./portfolio";

export async function syncOnboarding(): Promise<OnboardingState> {
  const local = readOnboarding();

  if (local.done && !local.synced) {
    const ok = await upsertOnboarding({
      age_band: local.answers.ageBand,
      goal: local.answers.goal,
      pains: local.answers.pains,
      level: local.answers.level,
      context: local.answers.context,
      portfolio: buildPortfolio(local.answers),
      rules_version: buildPortfolio(local.answers).rulesVersion,
    });
    return ok ? writeOnboarding({ synced: true }) : local;
  }

  if (!local.done && !answered(local.answers)) {
    const remote = await fetchOnboarding().catch(() => null);
    if (remote) {
      return writeOnboarding({
        answers: cleanAnswers({
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
