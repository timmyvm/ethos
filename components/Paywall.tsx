"use client";

import { useRef, useState } from "react";
import { IconBoss, IconBubble, IconMic, IconSpark, IconTrend } from "@/components/Icon";
import { PremiumMark } from "@/components/PremiumMark";
import { Overlay } from "@/components/ui/Overlay";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ACTION_CLASS } from "@/lib/ui";
import { useRovingRadio } from "@/lib/use-roving-radio";

/**
 * Premium sheet. mechanics.md: annual pushed hard, monthly present,
 * and it only ever appears AFTER visible progress (the day-3 moment) or
 * on a deliberate tap into locked content — never at install, never a
 * quiz. Pricing is DECIDED (candidate B, the comparables pass in
 * docs/growth/04 §5): A$14.99 monthly, A$79.99 annual.
 *
 * The sheet is plum (`.card-premium`, practice-tab-4, amending #171):
 * the tier's own surface, so tapping the plum wall on Practice lands on
 * plum, not on the score card's earned sage. No sage anywhere on it, the
 * PremiumMark once as its eyebrow, and the one tap still terracotta: a
 * premium card with an action is a plum card with a terracotta button.
 *
 * The list is ordered by expected demand (04 §4.2): the judged read
 * first, because the person most likely to be reading this just spent
 * their day's read. Every line names a concrete thing, no adjectives.
 *
 * No checkout exists yet, so the primary tap tells the truth and opens
 * the real unlock: an invite code, checked by /api/redeem against a
 * server env var. The button is never dead.
 */
/** What a surface asks the sheet to say: its name, and what continues. */
export interface PaywallAsk {
  reason: string;
  headline?: string;
}

/**
 * Checkout does not exist yet. While this is false the primary opens the
 * invite code and there is no second "I have a code" doing the same
 * thing (practice-tab-19). When checkout ships, the primary goes there
 * and the code returns as the secondary.
 */
const CHECKOUT_OPEN: boolean = false;

const PLANS = ["annual", "monthly"] as const;
type Plan = (typeof PLANS)[number];

/** A phrase that wraps whole, so a line never breaks "(free: 1 / a day)". */
const keep = (s: string) => <span className="whitespace-nowrap">{s}</span>;

/**
 * What premium is, in expected-demand order (#199), each led by its own
 * glyph (practice-tab-5, -20, -21). No end punctuation. Two of the five
 * are wider than the 312px text column at 15px, so each keeps its tail
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

export function Paywall({
  reason,
  headline = "Premium opens everything",
  onClose,
  onUnlocked,
}: {
  reason: string;
  /**
   * Names what continues or deepens, keyed to the surface that opened
   * the sheet — the cap moment talks about coaching, the archive about
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
  const [plan, setPlan] = useState<Plan>("annual");
  const [askingCode, setAskingCode] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const plans = useRovingRadio({ values: PLANS, value: plan, onChange: setPlan });
  const why = reasonLine(reason);

  function openCode() {
    setAskingCode(true);
    // After the reveal renders, not before.
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const db = supabaseBrowser();
      const token = db
        ? (await db.auth.getSession()).data.session?.access_token
        : null;
      if (!token) {
        setError("Do one recording first, then the code has somewhere to land.");
        return;
      }
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That didn't go through. Try again.");
        return;
      }
      setUnlocked(true);
      // Every premium read on the page behind this sheet is stale now;
      // a reload is the honest refresh.
      setTimeout(() => (onUnlocked ? onUnlocked() : window.location.reload()), 900);
    } catch {
      setError("The server didn't answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay label="Premium" onClose={onClose}>
      <div className="card-premium max-h-[92dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-sheet px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7 text-cream">
        {/* The grabber: the sheet already follows a finger down
            (Overlay), and this is how a thumb knows (practice-tab-23). */}
        <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-cream/30" />
        {/* The tier's own mark, once, then what was tapped. The reason
            never says "premium" again (reasonLine). */}
        <PremiumMark variant="chip" />
        {why && <p className="eyebrow mt-2.5 text-cream/70">{why}</p>}
        <h2 className="font-display mt-1 text-title text-cream">{headline}</h2>
        <ul className="mt-5 space-y-3 text-body leading-snug text-cream/85">
          {BENEFITS.map(({ Glyph, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span aria-hidden className="mt-px shrink-0 text-cream/60">
                <Glyph size={18} />
              </span>
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>

        {unlocked ? (
          <div role="status" className="arrive mt-6 rounded-card bg-cream/10 p-5 text-center">
            <div className="font-display text-title">Unlocked.</div>
            <p className="mt-1 text-caption text-cream/70">
              Premium is on this account now.
            </p>
          </div>
        ) : (
          <>
            {/* Two plans, one chosen: one radio group, one tab stop, the
                arrows move the choice (practice-tab-17). The chosen card
                is the bright one and its text follows it; the annual
                card leads with the per-month figure, the larger number,
                and keeps the honest total beside it, always: persuasion
                by arithmetic, never by concealment. */}
            <div role="radiogroup" aria-label="Plan" className="mt-5 space-y-2.5">
              {PLANS.map((p, i) => {
                const on = plan === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPlan(p)}
                    {...plans.getItemProps(p, i)}
                    className={`press flex w-full items-center gap-3 rounded-card border-[1.5px] p-4 text-left transition-colors ${
                      on ? "border-cream bg-cream/10 text-cream" : "border-cream/15 text-cream/80"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-cream/40"
                    >
                      {on && <span className="h-2 w-2 rounded-full bg-cream" />}
                    </span>
                    {p === "annual" ? (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="font-display block text-body font-bold">Annual</span>
                          {/* PRINCIPLES 4: no caps middot compound
                              ("A MONTH · SAVE 55%"). The saving sits
                              with the honest total; the unit under the
                              price is a caption, as on Monthly. */}
                          <span className="block text-caption text-cream/70">
                            A$79.99 a year, save 55%
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="font-display block text-num-m tabular-nums">A$6.67</span>
                          <span className="block text-caption text-cream/80">a month</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-display min-w-0 flex-1 text-body font-bold">
                          Monthly
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="font-display block text-num-s tabular-nums">A$14.99</span>
                          <span className="block text-caption text-cream/70">a month</span>
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {!askingCode ? (
              <>
                {/* No checkout yet, so the one tap opens the real unlock,
                    the invite code (#171); the secondary that did the
                    same thing waits for CHECKOUT_OPEN (practice-tab-19). */}
                <button type="button" onClick={openCode} className={`${ACTION_CLASS} mt-5`}>
                  {plan === "annual" ? "Start with annual" : "Start with monthly"}
                </button>
                {CHECKOUT_OPEN && (
                  <button
                    type="button"
                    onClick={openCode}
                    className="font-display mt-3 min-h-11 w-full text-link text-cream/70"
                  >
                    I have a code
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={redeem} className="reveal mt-5">
                <p className="text-caption leading-relaxed text-cream/70">
                  Checkout opens soon. Right now premium is by invite code.
                </p>
                <label className="sr-only" htmlFor="premium-code">
                  Invite code
                </label>
                <div className="mt-2.5 flex gap-2">
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
                    aria-invalid={!!error}
                    aria-describedby={error ? "premium-code-error" : undefined}
                    placeholder="Invite code…"
                    className="min-h-12 min-w-0 flex-1 rounded-control border border-cream/25 bg-cream/10 px-4 text-read text-cream placeholder:text-cream/50 focus:border-terracotta-500 focus:shadow-[inset_0_0_0_1px_var(--color-terracotta-500)] focus-visible:outline-none!"
                  />
                  {/* Disabled on plum: the fill steps back to the field's
                      own cream/10, never a faded terracotta. */}
                  <button
                    type="submit"
                    disabled={busy || !code.trim()}
                    className="press font-display min-h-12 shrink-0 rounded-control bg-terracotta-500 px-6 text-body font-bold text-on-accent transition-colors disabled:bg-cream/10 disabled:text-cream/60"
                  >
                    {busy ? "One moment…" : "Unlock"}
                  </button>
                </div>
                {error && (
                  <p
                    id="premium-code-error"
                    role="alert"
                    className="mt-2.5 text-caption leading-relaxed text-terracotta-300"
                  >
                    {error}
                  </p>
                )}
              </form>
            )}

            <button
              type="button"
              onClick={onClose}
              className="font-display mt-3 min-h-11 w-full text-link text-cream/70"
            >
              Not yet
            </button>
          </>
        )}
        <p className="mt-3 text-center text-caption text-cream/60">
          Money never buys stars, streaks, or scores.
        </p>
      </div>
    </Overlay>
  );
}
