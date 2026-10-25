"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncPlan } from "./billing-client";
import { fetchBilling, type BillingRow, type ProfileRow } from "./client-data";
import { withTimeout, READ_TIMEOUT_MS } from "./load";
import { planView, type PlanView } from "./plan-view";
import { markCheckoutSeen, takeDrop } from "./price-drop";
import { checkoutOutcome, readReturn, withoutReturn, type Arrival, type StripeReturn } from "./plan-return";

/**
 * The plan as a page holds it (docs/ladder-spec.md, surfaces 2 to 5):
 * the billing row read after mount, "today" taken after mount (never on
 * the server: the React #418 guard), and the view lib/plan-view.ts makes
 * of the two. You, Settings and Today each mount it; the manage sheet
 * hands back what the billing routes answer through `adopt`, so the
 * card behind the sheet changes with it.
 *
 * `profile` is the profile read when the page already makes one (You
 * reads it for the name): "loading" until it lands, "failed" if it did
 * not. A page that only needs a live plan (Settings' row, Today's drop)
 * passes nothing: a live billing row decides alone.
 */
export type ProfileRead = ProfileRow | null | "loading" | "failed";

/** A sync that has not answered by now is reported as slow; the spec's one re-read waits this long. */
export const REREAD_AFTER_MS = 4000;

export interface Plan {
  view: PlanView;
  /** This device's today, from the first effect on; null on the server render. */
  today: Date | null;
  /**
   * The plan could not be decided: the billing read failed or timed out,
   * or the profile read the page passed failed and no live billing row
   * decides alone (`planFailed`).
   */
  failed: boolean;
  /** Read the row again, showing the skeleton while it comes. */
  retry: () => void;
  /** Read the row again quietly: what is on screen stays until it lands. */
  reread: () => Promise<BillingRow | null | undefined>;
  /**
   * Take a billing route's answer as the row, over any read still in
   * flight, and its word on the account's Premium over the profile read
   * the page made at mount (`planProfile`).
   */
  adopt: (row: BillingRow | null, premium?: boolean) => void;
}

/**
 * The billing read with the page-level ceiling (lib/load.ts): a read
 * that never answers rejects after eight seconds, so the plan's skeleton
 * always ends, in the card or in "Premium didn't load" with its retry.
 */
export function readBilling(
  read: () => Promise<BillingRow | null> = fetchBilling,
  ms: number = READ_TIMEOUT_MS
): Promise<BillingRow | null> {
  return withTimeout(read(), ms);
}

/**
 * Whether the plan has failed: only while it is still unknown. A live
 * billing row decides alone (planView), so a profile that failed never
 * hides a card already decided; a quiet re-read that fails over a row
 * on screen leaves the row.
 */
export function planFailed(
  view: PlanView,
  billingFailed: boolean,
  billing: BillingRow | null | undefined,
  profile: ProfileRead
): boolean {
  if (view.kind !== "unknown") return false;
  return (billingFailed && billing === undefined) || profile === "failed";
}

/**
 * The profile the plan reads: the page's own read (unknown while it is
 * out or failed), with Premium as a billing route last said it. A plan
 * that a 409 found ended answers premium false, and a mount-time read
 * that said true (a paid plan's Premium) would otherwise draw the
 * invite-code line over an account with no Premium at all.
 */
export function planProfile(profile: ProfileRead, premium: boolean | undefined): ProfileRow | null | undefined {
  const base = profile === "loading" || profile === "failed" ? undefined : profile;
  return base && premium !== undefined ? { ...base, premium } : base;
}

export function usePlan(profile: ProfileRead = null): Plan {
  const [today, setToday] = useState<Date | null>(null);
  const [billing, setBilling] = useState<BillingRow | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  /** A billing route's word on Premium, and the profile read it overrides. */
  const [said, setSaid] = useState<{ premium: boolean; over: ProfileRead } | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  /** The newest read wins; a route's answer outranks every read before it. */
  const seq = useRef(0);

  const reread = useCallback(async () => {
    const n = ++seq.current;
    try {
      const row = await readBilling();
      if (n === seq.current) {
        setBilling(row);
        setFailed(false);
      }
      return row;
    } catch {
      if (n === seq.current) setFailed(true);
      return undefined;
    }
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setBilling(undefined);
    void reread();
  }, [reread]);

  const adopt = useCallback((row: BillingRow | null, premium?: boolean) => {
    seq.current += 1;
    setBilling(row);
    setFailed(false);
    if (premium !== undefined) setSaid({ premium, over: profileRef.current });
  }, []);

  useEffect(() => {
    setToday(new Date());
    void reread();
  }, [reread]);

  // A fresh profile read is newer than any route's earlier word.
  const premiumNow = said && said.over === profile ? said.premium : undefined;
  const profileRow = useMemo(() => planProfile(profile, premiumNow), [profile, premiumNow]);
  const view = useMemo(
    () => planView(profileRow, today ? billing : undefined, today ?? new Date(0)),
    [profileRow, billing, today]
  );

  return { view, today, failed: planFailed(view, failed, billing, profile), retry, reread, adopt };
}

/**
 * Which return from Stripe this visit is, read once after mount and
 * taken out of the address straight away, so a reload never syncs or
 * celebrates twice. Undefined until read.
 */
export function useStripeReturn(): StripeReturn | undefined {
  const [kind, setKind] = useState<StripeReturn | undefined>(undefined);
  // A ref, so the development double effect reads the flag the first
  // pass already took out of the address.
  const got = useRef<StripeReturn | undefined>(undefined);
  useEffect(() => {
    if (got.current === undefined) {
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      got.current = readReturn(here);
      if (got.current) {
        try {
          window.history.replaceState(window.history.state, "", withoutReturn(here));
        } catch {
          // A browser that refuses the rewrite still gets its one sync.
        }
      }
    }
    setKind(got.current);
  }, []);
  return kind;
}

/**
 * Back from Stripe: one sync, never a poll (the route asks Stripe and is
 * rate limited).
 *
 * - From the portal: the row is taken quietly; a failure leaves the
 *   page's own read standing.
 * - From Checkout: `switching` while sync is out, then the moment (`on`)
 *   for a plan live in its first month, or `slow` with one re-read of
 *   the row after four seconds (lib/plan-return.ts `checkoutOutcome`).
 *   Month 1 is remembered, so the first step is never a price drop.
 *
 * `onPremium` hears the server's word on the account's Premium.
 */
export function useStripeReturns(
  ret: StripeReturn | undefined,
  plan: Pick<Plan, "adopt" | "reread">,
  onPremium?: (premium: boolean) => void
): { arrival: Arrival; rereading: boolean } {
  const [arrival, setArrival] = useState<Arrival>(null);
  const [rereading, setRereading] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  const premiumRef = useRef(onPremium);
  premiumRef.current = onPremium;
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ret || started.current) return;
    started.current = true;
    if (ret === "checkout") setArrival("switching");
    void (async () => {
      const r = await syncPlan();
      if (r.ok) {
        planRef.current.adopt(r.billing, r.premium);
        premiumRef.current?.(r.premium);
      }
      if (ret === "portal" || !alive.current) return;
      const first = checkoutOutcome(r.ok ? planView(null, r.billing, new Date()) : null);
      if (first.arrival === "on") markCheckoutSeen();
      setArrival(first.arrival);
      if (!first.reread) return;
      setRereading(first.arrival === "slow");
      setTimeout(async () => {
        if (!alive.current) return;
        const row = await planRef.current.reread();
        if (!alive.current) return;
        const last = checkoutOutcome(row === undefined ? null : planView(null, row, new Date()), true);
        if (last.arrival === "on") markCheckoutSeen();
        setArrival(last.arrival);
        setRereading(false);
      }, REREAD_AFTER_MS);
    })();
  }, [ret]);

  return { arrival, rereading };
}

/**
 * The monthly price drop (surface 5): true once, the first time a page
 * sees a new month whose price fell. `enabled` holds it back (during a
 * checkout return, or while another sheet is up); the decision is taken
 * once per month per mount, and the stored month keeps it to once across
 * Today and You.
 */
export function usePriceDrop(
  view: PlanView,
  enabled = true
): { open: boolean; from: number | null; close: () => void } {
  const [open, setOpen] = useState(false);
  /** The month this device last saw, which the sheet rolls from. */
  const [from, setFrom] = useState<number | null>(null);
  const decided = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || view.kind === "unknown") return;
    if (decided.current === view.month) return;
    decided.current = view.month;
    // Only ever opens it: the development double effect must not close it.
    const seen = takeDrop(view);
    if (seen !== null) {
      setFrom(seen);
      setOpen(true);
    }
  }, [enabled, view]);
  const close = useCallback(() => setOpen(false), []);
  return { open, from, close };
}
