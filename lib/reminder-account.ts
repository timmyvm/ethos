/**
 * The reminder's hour on the account (#430), on the introduction's row
 * (`onboarding.reminder_hour`, 0010), which `syncOnboarding` already
 * restores into a new phone's prefs. A phone's own storage does not
 * follow a person: an iPhone's home-screen app keeps storage apart from
 * Safari's, so an hour kept only in the Safari tab never reached the
 * installed app. On the account, the installed app (signed in) and any
 * new phone can offer it back in one tap.
 *
 * An update, never an insert: a row made here with only the hour would
 * read on a new phone as a finished introduction with every answer empty.
 * A person with no row yet gets it from their introduction's own sync.
 * Only an hour the person chose goes here, through the arm (`armInTap`):
 * the Safari tab's install steps save none (#430 review), because the
 * installed app read an hour nobody picked as "picked" and as on.
 */

import { supabaseBrowser } from "./supabase-browser";

export async function saveAccountHour(hour: number): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  try {
    const { data } = await db.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return false;
    const { error } = await db
      .from("onboarding")
      .update({ reminder_hour: hour, updated_at: new Date().toISOString() })
      .eq("user_id", uid);
    return !error;
  } catch {
    return false;
  }
}
