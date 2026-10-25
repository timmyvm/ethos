/**
 * Settings' "Manage plan" row (docs/ladder-spec.md, surface 4) can only
 * be drawn once the billing read lands, after the page has settled. Left
 * at that, the row pushed Sign out, Your data, About and Delete down 62px
 * the moment it arrived (DESIGN.md principle 8). This device remembers
 * whether it last saw a plan, under an `ethos` key (so deleting the
 * account clears it with the rest), and while the plan is unknown a
 * subscriber's row holds its place as a skeleton. A free account never
 * draws one, so it never collapses one. Every touch of storage is
 * guarded: a store that cannot be read is no hint.
 */
import { hasPlan, type PlanView } from "./plan-view";

export const PLAN_ROW_KEY = "ethos.plan.row";

export interface HintStore {
  get(): string | null;
  set(value: string): void;
  clear(): void;
}

export const browserHintStore: HintStore = {
  get: () => window.localStorage.getItem(PLAN_ROW_KEY),
  set: (value) => window.localStorage.setItem(PLAN_ROW_KEY, value),
  clear: () => window.localStorage.removeItem(PLAN_ROW_KEY),
};

/** Whether this device last saw a plan on this account. */
export function readPlanHint(store: HintStore = browserHintStore): boolean {
  try {
    return store.get() === "1";
  } catch {
    return false;
  }
}

/** Remember what a known plan is; an unknown or failed one changes nothing. */
export function keepPlanHint(view: PlanView, failed: boolean, store: HintStore = browserHintStore): void {
  if (failed || view.kind === "unknown") return;
  try {
    if (hasPlan(view)) store.set("1");
    else store.clear();
  } catch {
    // Full or blocked: the row may shift once, the lesser fault.
  }
}

/** Forget it (signing out: the next account on this device is someone else's). */
export function forgetPlanHint(store: HintStore = browserHintStore): void {
  try {
    store.clear();
  } catch {
    // As above.
  }
}

/**
 * What the row's place in the account group holds:
 * - `row`: the plan is known and is one (active, ending, declined, pending);
 * - `skeleton`: still unknown on a device that last saw a plan;
 * - `error`: the read failed for an account that can hold a plan, so its
 *   cancel path is never silently gone;
 * - `none`: free, ended, code, or an unknown plan on a device that saw none.
 */
export function settingsRowSlot(s: {
  view: PlanView;
  /** "Today" has been taken (after mount). */
  ready: boolean;
  failed: boolean;
  hint: boolean;
  /** The session has an email: an anonymous one cannot hold a plan. */
  signedIn: boolean;
}): "row" | "skeleton" | "error" | "none" {
  if (s.failed) return s.signedIn || s.hint ? "error" : "none";
  if (s.ready && s.view.kind !== "unknown") return hasPlan(s.view) ? "row" : "none";
  return s.hint ? "skeleton" : "none";
}
