/**
 * Reconciling the self-diagnosis with the account (DECISIONS #231).
 *
 * The answers are given before a session exists, so the device holds
 * them first. Once a profile can be read, one rule in one place: an
 * unsynced answer on this device is the newest thing anyone said, so it
 * goes up; otherwise the account's answer comes down, because the
 * account is what follows someone to a new phone.
 */

import type { ProfileRow } from "./client-data";
import { updateSelfDiagnosis } from "./client-data";
import {
  isAgeBand,
  isGoal,
  readProfile,
  writeProfile,
  type Profile,
} from "./profile";

export async function syncProfile(remote: ProfileRow | null): Promise<Profile> {
  const local = readProfile();
  const answered = local.goal !== null || local.ageBand !== null;

  if (answered && !local.synced) {
    const ok = await updateSelfDiagnosis(local.goal, local.ageBand);
    return ok ? writeProfile({ synced: true }) : local;
  }

  const goal = isGoal(remote?.goal) ? remote!.goal : null;
  const ageBand = isAgeBand(remote?.age_band) ? remote!.age_band : null;
  if (goal !== null || ageBand !== null) {
    if (goal !== local.goal || ageBand !== local.ageBand) {
      return writeProfile({ goal, ageBand, synced: true });
    }
    return local.synced ? local : writeProfile({ synced: true });
  }
  return local;
}
