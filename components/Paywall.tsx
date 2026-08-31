"use client";

import { useRef, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Premium sheet. mechanics.md: annual pushed hard, monthly present,
 * and it only ever appears AFTER visible progress (the day-3 moment) or
 * on a deliberate tap into locked content — never at install, never a
 * quiz. Pricing is DECIDED (candidate B, the comparables pass in
 * docs/growth/04 §5): A$14.99 monthly, A$79.99 annual.
 *
 * The sheet wears the deep-sage material (the score card's, #165): the
 * most premium surface the system owns, so the ask looks like the thing
 * it's asking for. One terracotta tap, per brand.md.
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

export function Paywall({
  reason,
  headline = "The whole gym.",
  onClose,
}: {
  reason: string;
  /**
   * Names what continues or deepens, keyed to the surface that opened
   * the sheet — the cap moment talks about coaching, the archive about
   * the recording it holds. Never about what the user lacks.
   */
  headline?: string;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");
  const [askingCode, setAskingCode] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

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
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setError("The server didn't answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay label="Ethos Premium" onClose={onClose}>
      <div className="card-sage max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] px-6 pb-8 pt-7 text-cream">
        <div className="label-data !text-sage-mist">{reason}</div>
        <h2 className="font-display mt-1.5 text-[30px] leading-[1.05]">
          {headline}
        </h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-cream/80">
          <li>Demos&apos;s full read on every recording. Free covers 1 a day</li>
          <li>Presence on video: the score, its moments, the trendline</li>
          <li>Your whole history, with a line for each of the nine skills</li>
          <li>Your whole lexicon, every word you&apos;ve earned</li>
          <li>The boss library: any topic any week, Hostile Q&amp;A at will</li>
        </ul>

        {unlocked ? (
          <div className="mt-6 rounded-[24px] bg-cream/10 p-5 text-center">
            <div className="font-display text-[24px]">Unlocked.</div>
            <p className="mt-1 text-[13.5px] text-cream/70">
              Premium is on this account now.
            </p>
          </div>
        ) : (
          <>
            {/* Two plans, one selected. The annual card leads with the
                per-month figure and keeps the honest total beside it,
                always: persuasion by arithmetic, never by concealment. */}
            <button
              onClick={() => setPlan("annual")}
              aria-pressed={plan === "annual"}
              className={`press mt-5 flex w-full items-center justify-between rounded-[24px] p-4 text-left transition-colors ${
                plan === "annual"
                  ? "border-[1.5px] border-cream/40 bg-cream/10"
                  : "border border-cream/15"
              }`}
            >
              <div>
                <div className="text-[15px] font-bold">Annual</div>
                <div className="text-[12.5px] text-cream/60">
                  billed A$79.99 a year
                </div>
              </div>
              <div className="text-right">
                <span className="font-display text-[26px] leading-none">
                  A$6.67
                </span>
                <div className="label-data mt-0.5 !text-sage-mist">
                  a month · save 55%
                </div>
              </div>
            </button>
            <button
              onClick={() => setPlan("monthly")}
              aria-pressed={plan === "monthly"}
              className={`press mt-2.5 flex w-full items-center justify-between rounded-[24px] p-4 text-left transition-colors ${
                plan === "monthly"
                  ? "border-[1.5px] border-cream/40 bg-cream/10"
                  : "border border-cream/15"
              }`}
            >
              <div className="text-[15px] font-bold text-cream/80">Monthly</div>
              <div className="text-right">
                <span className="font-display text-[20px] leading-none text-cream/80">
                  A$14.99
                </span>
                <div className="label-data mt-0.5 !text-cream/50">a month</div>
              </div>
            </button>

            {!askingCode ? (
              <>
                <button
                  onClick={openCode}
                  className="press mt-5 min-h-11 w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream transition-colors hover:bg-terracotta-600"
                >
                  {plan === "annual" ? "Start with annual" : "Start with monthly"}
                </button>
                <button
                  onClick={openCode}
                  className="mt-3 min-h-11 w-full text-[13.5px] font-semibold text-cream/70"
                >
                  I have a code
                </button>
              </>
            ) : (
              <form onSubmit={redeem} className="mt-5">
                <p className="text-[13px] leading-relaxed text-cream/70">
                  Checkout opens soon. Right now premium is by invite code.
                </p>
                <label className="sr-only" htmlFor="premium-code">
                  Invite code
                </label>
                <div className="mt-2.5 flex gap-2">
                  <input
                    id="premium-code"
                    ref={codeRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Your code"
                    className="min-w-0 flex-1 rounded-full border border-cream/25 bg-cream/10 px-5 py-3.5 text-[16px] text-cream placeholder:text-cream/40 focus:border-cream/50"
                  />
                  <button
                    type="submit"
                    disabled={busy || !code.trim()}
                    className="press min-h-11 shrink-0 rounded-full bg-terracotta-500 px-6 py-3.5 text-[15px] font-semibold text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-50"
                  >
                    {busy ? "One moment" : "Unlock"}
                  </button>
                </div>
                {error && (
                  <p className="mt-2.5 text-[13px] leading-relaxed text-terracotta-300">
                    {error}
                  </p>
                )}
              </form>
            )}

            <button
              onClick={onClose}
              className="mt-3 min-h-11 w-full text-[13.5px] text-cream/50"
            >
              Not yet
            </button>
          </>
        )}
        <p className="mt-3 text-center text-[11.5px] text-cream/40">
          Money never buys stars, streaks, or scores.
        </p>
      </div>
    </Overlay>
  );
}
