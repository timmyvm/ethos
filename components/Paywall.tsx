"use client";

import { useRef, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Premium sheet. mechanics.md: annual pushed hard, monthly present,
 * and it only ever appears AFTER visible progress (day-3 card) or on a
 * deliberate tap into locked content — never at install, never a quiz.
 * Prices are placeholders until the research pass (open queue).
 *
 * The sheet wears the deep-sage material (the score card's, #165): the
 * most premium surface the system owns, so the ask looks like the thing
 * it's asking for. One terracotta tap, per brand.md.
 *
 * No checkout exists yet, so the primary tap tells the truth and opens
 * the real unlock: an invite code, checked by /api/redeem against a
 * server env var. The button is never dead.
 */
export function Paywall({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
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
      <div className="card-sage w-full max-w-[430px] rounded-t-[28px] px-6 pb-8 pt-7 text-cream">
        <div className="label-data !text-sage-mist">{reason}</div>
        <h2 className="font-display mt-1.5 text-[30px] leading-[1.05]">
          The whole gym.
        </h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-cream/80">
          <li>Full pause analytics, the silence scores</li>
          <li>Complete history and day-1-vs-day-30 cards</li>
          <li>Your whole lexicon, not just today&apos;s swap</li>
          <li>Every boss topic, any week, plus Hostile Q&amp;A</li>
          <li>Unlimited judged analyses</li>
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
            <div className="mt-5 flex items-center justify-between rounded-[24px] border-[1.5px] border-cream/35 bg-cream/10 p-4">
              <div>
                <div className="text-[15px] font-bold">Annual</div>
                <div className="text-[12.5px] text-cream/60">
                  billed A$79.99
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
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-[24px] border border-cream/15 p-4">
              <div className="text-[15px] font-bold text-cream/80">Monthly</div>
              <span className="font-display text-[20px] leading-none text-cream/80">
                A$14.99
              </span>
            </div>

            {!askingCode ? (
              <>
                <button
                  onClick={openCode}
                  className="press mt-5 min-h-11 w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream transition-colors hover:bg-terracotta-600"
                >
                  Start with annual
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
