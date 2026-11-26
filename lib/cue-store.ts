/**
 * Where the carried cue lives (DECISIONS #477): on the account,
 * `profiles.carried_cue` (migration 0034), so a cue set on the phone is
 * answered on the laptop, the way the worn pose follows the account
 * (0007). This phone keeps a copy (`ethos.cue`) for two reasons: the ready
 * recorder draws its warm-up in its first frame, before any read lands,
 * and the app works before 0034 is applied, when the column is missing
 * (42703 from Postgres, PGRST204 from PostgREST's schema cache), as
 * fetchReps goes on without `round` before 0026. The newer of the two
 * copies wins, by when each was written.
 */

import { useCallback, useEffect, useState } from "react";
import { missingCueColumn, newerCue, parseCueState, type CueState } from "./carried-cue";
import { currentSession, supabaseBrowser } from "./supabase-browser";
import { CUE_KEY, WARMUP_SKIPPED_KEY } from "./cue-keys";

export { CUE_KEY, WARMUP_SKIPPED_KEY, forgetCarriedCue } from "./cue-keys";

/* The column's own answer before 0034 lives with the store's shape, so the reminder's sender reads it too. */
export { missingCueColumn } from "./carried-cue";

function readLocal(): { uid: string | null; state: CueState | null } | null {
  try {
    const raw = localStorage.getItem(CUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: unknown; state?: unknown };
    return { uid: typeof parsed.uid === "string" ? parsed.uid : null, state: parseCueState(parsed.state) };
  } catch {
    return null;
  }
}

function writeLocal(uid: string | null, state: CueState | null) {
  try {
    localStorage.setItem(CUE_KEY, JSON.stringify({ uid, state }));
  } catch {}
}

/** This phone's copy for this account, or for whoever is signed in when the account is not known yet. */
export function localCue(uid?: string | null): CueState | null {
  const local = readLocal();
  if (!local) return null;
  if (uid !== undefined && local.uid !== uid) return null;
  return local.state;
}

/**
 * The cue the account carries: the account's copy and this phone's, the
 * newer of the two. Throws on a failed read (unknown is not "none"),
 * except for the missing column, which is this phone's copy alone.
 */
export async function fetchCarriedCue(): Promise<CueState | null> {
  const db = supabaseBrowser();
  const session = await currentSession();
  if (!db || !session) return localCue(null);
  const local = localCue(session.userId);
  const { data, error } = await db.from("profiles").select("carried_cue").maybeSingle();
  if (error) {
    if (missingCueColumn(error)) return local;
    throw error;
  }
  const server = parseCueState((data as { carried_cue?: unknown } | null)?.carried_cue ?? null);
  const best = newerCue(local, server);
  if (best && best !== local) writeLocal(session.userId, best);
  /* This phone holds a newer copy than the account (a save that failed,
     or one made before 0034): the account takes it now, so the next
     device does not answer a cue this one already answered (the #477
     review). Best effort; the next read tries again. */
  if (local && accountBehind(local, server)) {
    void db
      .from("profiles")
      .upsert({ user_id: session.userId, carried_cue: local }, { onConflict: "user_id" })
      .then(
        () => {},
        () => {}
      );
  }
  return best;
}

/** This phone's copy was written after the account's (or the account has none): the account takes it. */
export function accountBehind(local: CueState | null, server: CueState | null): boolean {
  if (!local) return false;
  return !server || Date.parse(local.at) > Date.parse(server.at);
}

/**
 * What a screen may keep drawing from this phone's copy once the session
 * is known (the #477 review): the copy this account wrote, or unknown. A
 * copy another account wrote (a shared phone, a sign-in over a guest) is
 * never drawn, answered or written on: it holds that person's own words.
 */
export function ownCopy(
  local: { uid: string | null; state: CueState | null } | null,
  uid: string | null
): CueState | null | undefined {
  if (!local) return undefined;
  return local.uid === uid ? local.state : undefined;
}

/**
 * Keeps the cue on this phone at once, then on the account. A missing
 * column keeps it on the phone alone; any other failure too, and the
 * next read takes the newer copy. Profiles are made lazily, so it upserts.
 */
export async function saveCarriedCue(state: CueState): Promise<boolean> {
  const session = await currentSession();
  writeLocal(session?.userId ?? null, state);
  const db = supabaseBrowser();
  if (!db || !session) return false;
  const { error } = await db
    .from("profiles")
    .upsert({ user_id: session.userId, carried_cue: state }, { onConflict: "user_id" });
  return !error;
}

/**
 * The carried cue for a screen: this phone's copy in the first frame
 * (undefined where it has none: not known yet), then the account's once
 * it is read. A failed read leaves what was drawn when this account wrote
 * it; with nothing drawn it stays unknown, so no take answers or
 * overwrites a cue it never saw. The session is asked first, and a copy
 * another account wrote is dropped then, before any read can fail. A read
 * that lands after a save never puts the older state back.
 */
export function useCarriedCue(): { state: CueState | null | undefined; save: (next: CueState) => void } {
  const [state, setState] = useState<CueState | null | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const local = readLocal();
    return local ? local.state : undefined;
  });
  useEffect(() => {
    let live = true;
    void (async () => {
      const session = await currentSession();
      if (!live) return;
      const mine = ownCopy(readLocal(), session?.userId ?? null);
      setState((drawn) => (drawn === undefined ? drawn : mine));
      try {
        const read = await fetchCarriedCue();
        if (live) setState((drawn) => (drawn ? newerCue(drawn, read) : read));
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, []);
  const save = useCallback((next: CueState) => {
    setState(next);
    void saveCarriedCue(next).catch(() => {});
  }, []);
  return { state, save };
}

/** Whether the warm-up was skipped today on this phone. */
export function warmupSkipped(today: string): boolean {
  try {
    return localStorage.getItem(WARMUP_SKIPPED_KEY) === today;
  } catch {
    return false;
  }
}

export function skipWarmup(today: string) {
  try {
    localStorage.setItem(WARMUP_SKIPPED_KEY, today);
  } catch {}
}
