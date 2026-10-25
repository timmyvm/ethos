"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconBoss, IconBubble, IconMic, IconSpark, IconTrend } from "@/components/Icon";
import { PremiumMark } from "@/components/PremiumMark";
import { RollNumber } from "@/components/premium/RollNumber";
import { Stair } from "@/components/premium/Stair";
import { Overlay } from "@/components/ui/Overlay";
import { currentPath, openPortal, startCheckout } from "@/lib/billing-client";
import { PAYWALL_COPY, calendarFromToday, ladderSentence, paywallStep, stepLabels } from "@/lib/plan-view";
import { prefersReducedMotion } from "@/lib/prefs";
import { formatBare } from "@/lib/pricing";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ACTION_CLASS } from "@/lib/ui";
import { authHref, withPaywall, withoutPaywall } from "@/lib/use-paywall-return";

/**
 * The Premium sheet (docs/ladder-spec.md, surface 1). It only ever
 * appears AFTER visible progress or on a deliberate tap into locked
 * content, never at install and never as a quiz (mechanics.md).
 *
 * The sheet is plum (`.card-premium`, practice-tab-4): the tier's own
 * surface, so tapping the plum wall on Practice lands on plum. No sage on
 * it, the PremiumMark once as its eyebrow, and the one tap terracotta: a
 * premium card with an action is a plum card with a terracotta button.
 *
 * Kept from before: the grabber, the mark, the reason line, the headline,
 * the five benefits (ordered by expected demand, #199) and the closing
 * line, the screen's one negation. New: the price ladder (#377). One
 * plan, A$12.99 in month 1 and a dollar less every month you stay, to
 * A$6.99 from month 7. The staircase says it before any sentence does:
 * scrub it and the readout rolls to each month's price and the day it
 * starts, the Paw hops to the step, and the steps behind it press flat.
 * The caption says the renewal and the reset once, as facts.
 *
 * Checkout opens only when NEXT_PUBLIC_CHECKOUT_OPEN is "1" (read once,
 * here). Off, the tap opens the invite code exactly as before. On, the
 * tap goes to Stripe Checkout (or, for an account already on a plan, the
 * portal); an anonymous session is asked for an account first, through
 * doors that bring it straight back to this sheet (paywall=1,
 * lib/use-paywall-return.ts), and the code moves to a secondary.
 */

/** What a surface asks the sheet to say: its name, and what continues. */
export interface PaywallAsk {
  reason: string;
  headline?: string;
}

/** Live checkout, read once at module level: on only when it is exactly "1". */
const CHECKOUT_OPEN = process.env.NEXT_PUBLIC_CHECKOUT_OPEN === "1";

/** A phrase that wraps whole, so a line never breaks "(free: 1 / a day)". */
const keep = (s: string) => <span className="whitespace-nowrap">{s}</span>;

/**
 * What premium is, in expected-demand order (#199), each led by its own
 * glyph (practice-tab-5, -20, -21). No end punctuation. Two of the five
 * are wider than the 342px text column at 15px, so each keeps its tail
 * whole and breaks at the phrase.
 */
const BENEFITS = [
  { Glyph: IconBubble, text: <>Demos&apos;s full read on every recording {keep("(free: 1 a day)")}</> },
  { Glyph: IconMic, text: "Presence on video, with its moments" },
  { Glyph: IconTrend, text: "Your whole history, all nine skills" },
  { Glyph: IconSpark, text: "Every word you've earned, kept" },
  { Glyph: IconBoss, text: <>Speed rush, Interview and Hostile Q&amp;A, {keep("any boss topic, any week")}</> },
];

/**
 * The line under the mark: what was tapped, without saying "premium" a
 * second time and without a ' · ' compound (PRINCIPLES 4). The surfaces
 * pass strings like "Full history · premium", "Tight timer · premium
 * mod", "Premium games" and "Hostile Q&A · once a week free".
 */
export function reasonLine(reason: string): string {
  const parts = reason
    .split(" · ")
    .map((p) => p.trim())
    .flatMap((p, i) => {
      if (/^premium$/i.test(p)) return [];
      // "Premium games" names a thing; "premium mod" only restates the tier.
      if (/^premium\s/i.test(p)) return i === 0 ? [p.replace(/^premium\s+/i, "")] : [];
      return p ? [p] : [];
    });
  const line = parts.join(", ");
  return line ? line[0].toUpperCase() + line.slice(1) : "";
}

type Phase = "ready" | "busy" | "error" | "needsAccount" | "code";

/** The paywall's ladder rises once the sheet has nearly settled. */
const LADDER_RISE_DELAY_MS = 180;

export function Paywall({
  reason,
  headline = "Premium opens everything",
  onClose,
  onUnlocked,
}: {
  reason: string;
  /**
   * Names what continues or deepens, keyed to the surface that opened
   * the sheet: the cap moment talks about coaching, the archive about
   * the recording it holds. Never about what the user lacks.
   */
  headline?: string;
  onClose: () => void;
  /**
   * After a successful unlock. The default reloads, so every premium
   * read behind the sheet refreshes. A surface mid-flow (the debrief,
   * the day-3 moment) passes its own continuation instead: a reload
   * on /rep threw the debrief away and landed on an empty Record
   * screen (DECISIONS #220).
   */
  onUnlocked?: () => void;
}) {
  // Dates are this device's, read once when the sheet opens: the sheet
  // only ever renders on the client, after a tap.
  const [today] = useState(() => new Date());
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const why = reasonLine(reason);
  const readout = paywallStep(step, today);
  // Which way the readout's lines turn: later months come from above, as
  // the digits do when the price goes down.
  const [turn, setTurn] = useState({ step, dir: "" as "" | "up" | "down" });
  if (turn.step !== step) setTurn({ step, dir: step > turn.step ? "down" : "up" });
  const [labels] = useState(() => stepLabels(calendarFromToday(today)));
  // Where the account doors and Checkout's back arrow bring them: this
  // page, with the sheet open again.
  const [here] = useState(() => withPaywall(currentPath()));
  // The scrolling part fades at its foot while there is more under it.
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);
  // A state that grows the shelf (the code, the account ask, an error)
  // keeps the ladder in sight just above it: the part scrolls to its end.
  useEffect(() => {
    if (phase !== "code" && phase !== "needsAccount" && phase !== "error") return;
    const el = scroller.current;
    if (!el) return;
    const frame = requestAnimationFrame(() =>
      el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" })
    );
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const el = scroller.current;
    measure();
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure, phase, unlocked]);

  // Back from Stripe through the browser's back/forward cache, the page
  // is restored as it was left: "One moment…" on a sheet nobody is
  // waiting on. Give the tap back (the Google button's lesson, #307).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPhase((p) => (p === "busy" ? "ready" : p));
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  function openCode() {
    setPhase("code");
    setError(null);
    // After the reveal renders, not before.
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  async function start() {
    if (!CHECKOUT_OPEN) {
      openCode();
      return;
    }
    if (phase === "busy") return;
    setPhase("busy");
    setError(null);
    const out = await startCheckout({ returnTo: here });
    if (out.ok && out.kind === "checkout") {
      // Busy until the browser has left.
      window.location.assign(out.url);
      return;
    }
    if (out.ok) {
      // Already on a plan: its card and receipts, never a second plan.
      const portal = await openPortal({ returnTo: withoutPaywall(here) });
      if (portal.ok) {
        window.location.assign(portal.url);
        return;
      }
      setError(portal.error);
      setPhase("error");
      return;
    }
    if (out.needsAccount || out.status === 401) {
      setPhase("needsAccount");
      return;
    }
    setError(out.error);
    setPhase("error");
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setCodeError(null);
    try {
      const db = supabaseBrowser();
      const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setCodeError(PAYWALL_COPY.codeFirst);
        return;
      }
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setCodeError(body?.error ?? PAYWALL_COPY.codeFailed);
        return;
      }
      setUnlocked(true);
      // Every premium read on the page behind this sheet is stale now;
      // a reload is the honest refresh.
      setTimeout(() => (onUnlocked ? onUnlocked() : window.location.reload()), 900);
    } catch {
      setCodeError("The server didn't answer. Try again.");
    } finally {
      setRedeeming(false);
    }
  }

  const twoUp = CHECKOUT_OPEN && !unlocked && (phase === "ready" || phase === "busy" || phase === "error");

  return (
    <Overlay label="Premium" onClose={onClose}>
      {/* Two parts: what Premium is and what it costs scroll; the tap
          stays at the foot, so on a short phone it is never below the
          fold. When everything fits, the seam is invisible. */}
      <div className="card-premium flex max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] w-full max-w-[430px] flex-col overflow-hidden rounded-t-sheet text-cream">
        <div
          ref={scroller}
          onScroll={measure}
          data-more={more || undefined}
          className="paywall-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 pb-4 pt-7"
        >
          {/* The grabber: the sheet already follows a finger down
              (Overlay), and this is how a thumb knows (practice-tab-23). */}
          <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-cream/30" />
          {/* The tier's own mark, once, then what was tapped. The reason
              never says "premium" again (reasonLine). */}
          <PremiumMark variant="chip" />
          {why && <p className="eyebrow mt-2.5 text-cream/70">{why}</p>}
          <h2 className="font-display mt-1 text-title text-cream">{headline}</h2>
          <ul className="mt-4 space-y-2.5 text-body leading-snug text-cream/85">
            {BENEFITS.map(({ Glyph, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span aria-hidden className="mt-px shrink-0 text-cream/60">
                  <Glyph size={18} />
                </span>
                <span className="min-w-0">{text}</span>
              </li>
            ))}
          </ul>

          {!unlocked && (
            /* The ladder: a head, the readout the stair drives, the
               stair, and the facts in one caption. */
            <section aria-labelledby="paywall-ladder-head" className="mt-5 border-t border-cream/15 pt-4">
              <h3 id="paywall-ladder-head" className="detail-head text-cream">
                {PAYWALL_COPY.head}
              </h3>
              {/* The slider speaks for the readout (its valuetext). */}
              <div aria-hidden className="mt-2 flex items-end justify-between gap-3">
                <p className="font-display flex items-baseline whitespace-nowrap tabular-nums text-cream">
                  <span className="mr-1 text-num-m text-cream/70">A$</span>
                  <RollNumber className="text-num-l" text={formatBare(readout.cents)} value={readout.cents} />
                </p>
                <div className="min-w-0 overflow-hidden pb-0.5 text-right">
                  <p key={readout.dateLine} data-dir={turn.dir || undefined} className="roll-line font-display text-row text-cream">
                    {readout.dateLine}
                  </p>
                  <p key={readout.monthLine} data-dir={turn.dir || undefined} className="roll-line mt-0.5 text-caption text-cream/70">
                    {readout.monthLine}
                  </p>
                </div>
              </div>
              <Stair
                tone="plum"
                size="lg"
                at={1}
                selected={step}
                onSelect={(n) => setStep(n)}
                labels={labels}
                bleed={24}
                riseDelay={LADDER_RISE_DELAY_MS}
                label={PAYWALL_COPY.sliderLabel}
                valueText={(n) => paywallStep(n, today).valueText}
                summary={ladderSentence()}
                className="mt-3"
              />
              <p className="mt-4 text-caption leading-relaxed text-cream/70">{PAYWALL_COPY.caption}</p>
            </section>
          )}
        </div>

        <div className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {unlocked ? (
            <div role="status" className="arrive rounded-card bg-cream/10 p-5 text-center">
              <div className="font-display text-title">{PAYWALL_COPY.unlockedTitle}</div>
              <p className="mt-1 text-caption text-cream/70">{PAYWALL_COPY.unlockedLine}</p>
            </div>
          ) : phase === "code" ? (
            <form onSubmit={redeem} className="reveal">
              {!CHECKOUT_OPEN && <p className="text-caption leading-relaxed text-cream/70">{PAYWALL_COPY.codeSoon}</p>}
              <label className="sr-only" htmlFor="premium-code">
                Invite code
              </label>
              <div className={`${CHECKOUT_OPEN ? "" : "mt-2.5 "}flex gap-2`}>
                <input
                  id="premium-code"
                  name="invite-code"
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-invalid={!!codeError}
                  aria-describedby={codeError ? "premium-code-error" : undefined}
                  placeholder="Invite code…"
                  className="min-h-12 min-w-0 flex-1 rounded-control border border-cream/25 bg-cream/10 px-4 text-read text-cream placeholder:text-cream/50 focus:border-terracotta-500 focus:shadow-[inset_0_0_0_1px_var(--color-terracotta-500)] focus-visible:outline-none!"
                />
                {/* Disabled on plum: the fill steps back to the field's
                    own cream/10, never a faded terracotta. */}
                <button
                  type="submit"
                  disabled={redeeming || !code.trim()}
                  className="press font-display min-h-12 shrink-0 rounded-control bg-terracotta-500 px-6 text-body font-bold text-on-accent transition-colors disabled:bg-cream/10 disabled:text-cream/60"
                >
                  {redeeming ? PAYWALL_COPY.unlockBusy : PAYWALL_COPY.unlock}
                </button>
              </div>
              {codeError && (
                <p id="premium-code-error" role="alert" className="mt-2.5 text-caption leading-relaxed text-terracotta-300">
                  {codeError}
                </p>
              )}
            </form>
          ) : phase === "needsAccount" ? (
            <>
              {/* Where the tap was: what it needs, and the way there,
                  which brings them straight back to this sheet. */}
              <p role="status" className="arrive rounded-control bg-cream/10 p-4 text-body leading-snug text-cream/85">
                {PAYWALL_COPY.needsAccount}
              </p>
              <Link href={authHref("signup", here)} className={`${ACTION_CLASS} mt-3`}>
                {PAYWALL_COPY.createAccount}
              </Link>
              <Link
                href={authHref("signin", here)}
                className="font-display mt-1 flex min-h-11 w-full items-center justify-center text-link text-cream"
              >
                {PAYWALL_COPY.haveAccount}
              </Link>
            </>
          ) : (
            <>
              {phase === "error" && error && (
                <p role="alert" className="mb-3 text-caption leading-relaxed text-terracotta-300">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void start()}
                disabled={phase === "busy"}
                aria-busy={phase === "busy" || undefined}
                className={ACTION_CLASS}
              >
                {phase === "busy" ? PAYWALL_COPY.busy : PAYWALL_COPY.start}
              </button>
              {/* With checkout live the code is the second way in, on one
                  row with "Not yet" so the sheet still fits a phone; with
                  it off, the tap above already is the code (#171). */}
              {twoUp && (
                <div className="mt-1 grid grid-cols-2">
                  <button type="button" onClick={openCode} className="font-display min-h-11 text-link text-cream">
                    {PAYWALL_COPY.haveCode}
                  </button>
                  <button type="button" onClick={onClose} className="font-display min-h-11 text-link text-cream/70">
                    {PAYWALL_COPY.notYet}
                  </button>
                </div>
              )}
            </>
          )}

          {!twoUp && !unlocked && (
            <button type="button" onClick={onClose} className="font-display mt-1 min-h-11 w-full text-link text-cream/70">
              {PAYWALL_COPY.notYet}
            </button>
          )}
          <p className={`${unlocked ? "mt-3" : "mt-1"} text-center text-caption text-cream/60`}>{PAYWALL_COPY.closing}</p>
        </div>
      </div>
    </Overlay>
  );
}
