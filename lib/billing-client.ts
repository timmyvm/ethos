/**
 * The browser's calls to the billing routes (app/api/billing/*), typed
 * to the contract lib/billing-routes.test.ts documents. The sixth route,
 * the webhook, is Stripe's alone and never called from here.
 *
 * Each call carries this session's token and answers a discriminated
 * result instead of throwing: `{ ok: true, ... }`, or `{ ok: false,
 * status, error }` where `error` is the server's own sentence (short and
 * safe to show as it is) or a calm one of ours. A network failure or a
 * request that hangs past `TIMEOUT_MS` is status 0. Nothing here polls:
 * sync asks Stripe and is rate limited, so it is called once, on a
 * return from Checkout or the portal.
 *
 * Client only. Never import lib/billing.ts (the server's) from a page.
 */
import type { BillingRow } from "./client-data";
import { supabaseBrowser } from "./supabase-browser";

/** A request that has not answered by now is reported, not waited on. */
export const TIMEOUT_MS = 20_000;

export interface BillingFailure {
  ok: false;
  /** The HTTP status; 0 when the server never answered. */
  status: number;
  /** One short sentence, safe to show as it is. */
  error: string;
  /** Checkout's 403, or no session at all: a plan needs a real account. */
  needsAccount?: boolean;
  /** A 429's wait, in seconds. */
  retryAfterS?: number;
}

export type CheckoutResult =
  | { ok: true; kind: "checkout"; url: string }
  /** The account already has a live plan: open the portal, never a second plan. */
  | { ok: true; kind: "manage" }
  | BillingFailure;

export type PortalResult = { ok: true; url: string } | BillingFailure;

/** sync, cancel and resume: the plan as the server now has it. */
export type PlanResult = { ok: true; billing: BillingRow | null; premium: boolean } | BillingFailure;

export const OFFLINE = "The server didn't answer. Check your connection and try again.";
export const NO_SESSION = "That session has expired. Sign in and try again.";
export const NEEDS_ACCOUNT = "Premium needs an account. Make one and everything you've practised stays.";

/** The server's own fallbacks, for an answer that carries no sentence. */
const FALLBACK = {
  checkout: "Checkout didn't open, and nothing was charged. Try again in a minute.",
  portal: "Your plan's page didn't open. Try again in a minute.",
  sync: "Your plan didn't load. Try again in a minute.",
  cancel: "Your plan didn't cancel. Try again in a minute.",
  resume: "Your plan didn't change. Try again in a minute.",
} as const;

type Route = keyof typeof FALLBACK;

/** Where the browser is now, as a same-origin path to come back to. */
export function currentPath(): string {
  if (typeof window === "undefined") return "/you";
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

async function token(): Promise<string | null> {
  try {
    const db = supabaseBrowser();
    if (!db) return null;
    return (await db.auth.getSession()).data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

type Answer =
  | { ok: true; status: number; body: Record<string, unknown> }
  | BillingFailure;

async function post(route: Route, body?: Record<string, unknown>): Promise<Answer> {
  const bearer = await token();
  if (!bearer) {
    return route === "checkout"
      ? { ok: false, status: 401, error: NEEDS_ACCOUNT, needsAccount: true }
      : { ok: false, status: 401, error: NO_SESSION };
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  let res: Response;
  try {
    res = await fetch(`/api/billing/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body ?? {}),
      signal: controller?.signal,
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const parsed = (await res.json().catch(() => null)) as unknown;
  const json = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  if (res.ok) return { ok: true, status: res.status, body: json };
  const error = typeof json.error === "string" && json.error.trim() ? json.error.trim() : FALLBACK[route];
  return {
    ok: false,
    status: res.status,
    error,
    ...(json.needsAccount === true ? { needsAccount: true } : {}),
    ...(typeof json.retryAfterS === "number" ? { retryAfterS: json.retryAfterS } : {}),
  };
}

/** An https (or, in development, http) URL the browser may be sent to: Stripe's pages. A `javascript:` or junk answer is refused. */
function sendable(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Not the server's fault and not the person's: an answer we cannot use. */
const malformed = (route: Route, status: number): BillingFailure => ({ ok: false, status, error: FALLBACK[route] });

/**
 * POST /api/billing/checkout. `returnTo` is where Checkout's back arrow
 * lands (a same-origin path; the server sends anything else to /you).
 */
export async function startCheckout(opts: { returnTo?: string } = {}): Promise<CheckoutResult> {
  const a = await post("checkout", { returnTo: opts.returnTo ?? currentPath() });
  if (!a.ok) return a;
  if (a.body.manage === true) return { ok: true, kind: "manage" };
  const url = sendable(a.body.url);
  return url ? { ok: true, kind: "checkout", url } : malformed("checkout", a.status);
}

/** POST /api/billing/portal: Stripe's page for the card, the receipts and cancelling. */
export async function openPortal(opts: { returnTo?: string } = {}): Promise<PortalResult> {
  const a = await post("portal", { returnTo: opts.returnTo ?? currentPath() });
  if (!a.ok) return a;
  const url = sendable(a.body.url);
  return url ? { ok: true, url } : malformed("portal", a.status);
}

function plan(route: Route, a: Answer): PlanResult {
  if (!a.ok) return a;
  if (!("billing" in a.body) || typeof a.body.premium !== "boolean") return malformed(route, a.status);
  const billing = a.body.billing;
  if (billing !== null && (typeof billing !== "object" || Array.isArray(billing))) return malformed(route, a.status);
  return { ok: true, billing: billing as BillingRow | null, premium: a.body.premium };
}

/** POST /api/billing/sync: Stripe's word on the plan now. Once per return, never polled. */
export async function syncPlan(): Promise<PlanResult> {
  return plan("sync", await post("sync"));
}

/** POST /api/billing/cancel: cancel at the end of the paid month. 409 when already ending or ended. */
export async function cancelPlan(): Promise<PlanResult> {
  return plan("cancel", await post("cancel"));
}

/** POST /api/billing/resume: undo a cancel that has not taken effect. 409 once the plan has ended. */
export async function resumePlan(): Promise<PlanResult> {
  return plan("resume", await post("resume"));
}
