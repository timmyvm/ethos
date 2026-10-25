"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IconBoss, IconBubble, IconMic, IconSpark, IconTrend } from "@/components/Icon";
import { PremiumMark } from "@/components/PremiumMark";
import { reasonLine } from "@/components/Paywall";
import { Overlay } from "@/components/ui/Overlay";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ACTION_CLASS } from "@/lib/ui";
import { FIRST_PRICE_CENTS, FLOOR_MONTH, FLOOR_PRICE_CENTS } from "@/lib/pricing";
import { RUNGS, TODAY, addMonths, dayMonth, dayMonthLong, formatAud, formatBare, spokenPrice } from "./data";
import { Roll } from "./Roll";
import { Stair } from "./Stair";

/**
 * The paywall, direction B. Today's sheet kept whole (the grabber, the
 * mark, the reason, the headline, the five benefits, the one terracotta
 * tap, "Not yet", the closing line) with the Annual and Monthly radios
 * replaced by the staircase.
 *
 * Three facts in three seconds, each carried by the object first and a
 * sentence second: the lit first step with the token on it and the tap
 * say A$12.99 today; the steps falling away to a floor that runs off
 * the sheet say it drops every month you stay, to A$6.99 from month 7;
 * the line over the tap says what happens if the plan ends. Every
 * price is printed on its own step, so the full ladder is disclosed
 * before purchase as text, not only as a shape.
 */

const keep = (s: string) => <span className="whitespace-nowrap">{s}</span>;

const BENEFITS = [
  { Glyph: IconBubble, text: <>Demos&apos;s full read on every recording {keep("(free: 1 a day)")}</> },
  { Glyph: IconMic, text: "Presence on video, with its moments" },
  { Glyph: IconTrend, text: "Your whole history, all nine skills" },
  { Glyph: IconSpark, text: "Every word you've earned, kept" },
  { Glyph: IconBoss, text: <>Speed rush, Interview and Hostile Q&amp;A, {keep("any boss topic, any week")}</> },
];

/** The checkout flag (the contract: live only when it is "1"). */
const CHECKOUT_OPEN = process.env.NEXT_PUBLIC_CHECKOUT_OPEN === "1";

export type PaywallPhase = "ready" | "busy" | "needsAccount" | "error" | "code";

/** What the readout says for rung n, in words and for VoiceOver. */
export function rungWords(rung: number, from = TODAY) {
  const cents = RUNGS[rung - 1].cents;
  const date = addMonths(from, rung - 1);
  const floor = rung === FLOOR_MONTH;
  return {
    cents,
    month: floor ? `Month ${FLOOR_MONTH} onward` : `Month ${rung}`,
    when: rung === 1 ? "Today" : `From ${dayMonth(date)}`,
    spoken:
      rung === 1
        ? `Month 1, today, ${spokenPrice(cents)}`
        : `${floor ? `Month ${FLOOR_MONTH} and every month after` : `Month ${rung}`}, from ${dayMonthLong(date)}, ${spokenPrice(cents)}`,
  };
}

export function PaywallBody({
  reason = "Premium",
  headline = "Premium opens everything",
  initialPhase = "ready",
  checkoutOpen = CHECKOUT_OPEN,
  rise = false,
  onClose,
  onStart,
  className = "",
}: {
  reason?: string;
  headline?: string;
  initialPhase?: PaywallPhase;
  checkoutOpen?: boolean;
  rise?: boolean;
  onClose: () => void;
  /** The workbench's stand-in for the network: says what the server would. */
  onStart?: () => PaywallPhase;
  className?: string;
}) {
  const [phase, setPhase] = useState<PaywallPhase>(initialPhase);
  const [rung, setRung] = useState(1);
  const [instant, setInstant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const why = reasonLine(reason);
  const r = rungWords(rung);
  const returnTo = typeof window === "undefined" ? "/you" : window.location.pathname;

  async function start() {
    if (!checkoutOpen) {
      setPhase("code");
      requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }
    if (onStart) {
      setPhase(onStart());
      return;
    }
    setPhase("busy");
    setError(null);
    try {
      const db = supabaseBrowser();
      const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setPhase("needsAccount");
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ returnTo }),
      });
      const body = (await res.json().catch(() => null)) as { url?: string; manage?: boolean; needsAccount?: boolean; error?: string } | null;
      if (res.status === 403 && body?.needsAccount) return setPhase("needsAccount");
      if (res.ok && body?.url) return window.location.assign(body.url);
      if (res.ok && body?.manage) return window.location.assign("/you?manage=1");
      setError(body?.error ?? "Checkout didn't open. Try again.");
      setPhase("error");
    } catch {
      setError("The server didn't answer. Try again.");
      setPhase("error");
    }
  }

  const next = encodeURIComponent(`${returnTo}?paywall=1`);

  return (
    <div
      className={`card-premium w-full max-w-[430px] overflow-x-hidden overscroll-contain rounded-t-sheet px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 text-cream ${className}`}
    >
      <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-cream/30" />
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

      {/* The ladder: a head, a readout fixed above the stair, the stair. */}
      <section aria-labelledby="lb-ladder-head" className="mt-6">
        <h3 id="lb-ladder-head" className="font-display text-detail text-cream">
          Your price drops every month you stay
        </h3>
        {/* The readout follows the selection; the slider speaks for it. */}
        <div aria-hidden className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0 pb-0.5">
            <p className="font-display text-row text-cream">{r.month}</p>
            <p className="text-caption text-cream/70">{r.when}</p>
          </div>
          <p className="font-display text-num-l tabular-nums text-cream">
            <span className="lb-cur text-cream/70">A$</span>
            <Roll text={formatBare(r.cents)} value={r.cents} instant={instant} />
          </p>
        </div>
        <Stair
          tone="plum"
          size="lg"
          at={1}
          bleed={24}
          rise={rise}
          className="mt-2"
          selected={rung}
          onSelect={(n, how) => {
            setInstant(how === "drag");
            setRung(n);
          }}
          label="Price by month"
          valueText={(n) => rungWords(n).spoken}
        />
      </section>

      {/* The disclosure, before the tap, at reading size (ACL): the
          floor, the renewal, the reset. One sentence each. */}
      <p className="mt-4 text-caption leading-relaxed text-cream/70">
        From month {FLOOR_MONTH} it stays at {formatAud(FLOOR_PRICE_CENTS)}. It renews monthly, and you can cancel any time in the app. If the plan ends, a new one starts at {formatAud(FIRST_PRICE_CENTS)}.
      </p>

      {phase === "code" ? (
        <form
          onSubmit={(e) => e.preventDefault()}
          className="reveal mt-4"
        >
          <p className="text-caption leading-relaxed text-cream/70">Right now Premium opens with an invite code.</p>
          <label className="sr-only" htmlFor="lb-code">
            Invite code
          </label>
          <div className="mt-2.5 flex gap-2">
            <input
              id="lb-code"
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Invite code…"
              className="min-h-12 min-w-0 flex-1 rounded-control border border-cream/25 bg-cream/10 px-4 text-read text-cream placeholder:text-cream/50 focus-visible:outline-none!"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="press font-display min-h-12 shrink-0 rounded-control bg-terracotta-500 px-6 text-body font-bold text-on-accent disabled:bg-cream/10 disabled:text-cream/60"
            >
              Unlock
            </button>
          </div>
        </form>
      ) : phase === "needsAccount" ? (
        <>
          {/* Inline, where the tap was: what it needs and the way
              there, which brings them back to this sheet. */}
          <p role="status" className="arrive mt-4 rounded-control bg-cream/10 px-4 py-3 text-body leading-snug text-cream">
            A plan needs an account. Make one and you&apos;ll come straight back here.
          </p>
          <Link href={`/signup?next=${next}`} className={`${ACTION_CLASS} mt-3`}>
            Create an account
          </Link>
          <div className="mt-1 text-center">
            <Link href={`/signin?next=${next}`} className="font-display inline-flex min-h-11 items-center text-link text-cream">
              I already have one
            </Link>
          </div>
        </>
      ) : (
        <>
          {phase === "error" && error && (
            <p role="alert" className="mt-4 text-caption leading-relaxed text-terracotta-300">
              {error}
            </p>
          )}
          <button type="button" onClick={() => void start()} disabled={phase === "busy"} className={`${ACTION_CLASS} mt-4`}>
            {phase === "busy" ? "Opening checkout…" : `Start at ${formatAud(FIRST_PRICE_CENTS)}`}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="font-display mt-1 min-h-11 w-full text-link text-cream/70"
      >
        Not yet
      </button>
      <p className="mt-1 text-center text-caption text-cream/60">Money never buys stars, streaks, or scores.</p>
    </div>
  );
}

/** The real sheet: the body above, risen on the Overlay. */
export function PaywallB(props: Omit<Parameters<typeof PaywallBody>[0], "className" | "rise">) {
  return (
    <Overlay label="Premium" onClose={props.onClose}>
      <PaywallBody {...props} rise className="max-h-[92dvh] overflow-y-auto" />
    </Overlay>
  );
}
