"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PremiumMark } from "@/components/PremiumMark";
import { Disclosure } from "@/components/ui/Disclosure";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { useAttempts, type Attempts } from "@/lib/attempt";
import { cancelPlan, currentPath, openPortal, resumePlan, syncPlan } from "@/lib/billing-client";
import type { BillingRow } from "@/lib/client-data";
import {
  MANAGE_COPY,
  PENDING_LINE,
  cancelledStatus,
  confirmBody,
  endingBody,
  endingTitle,
  hasPlan,
  manageLine,
  pictureLabel,
  planView,
  resumedStatus,
  retriedLine,
  stepLabels,
  unpaidLine,
  type PlanView,
} from "@/lib/plan-view";
import { withPortalReturn } from "@/lib/plan-return";
import { prefersReducedMotion } from "@/lib/prefs";
import { FIRST_PRICE_CENTS, formatAud } from "@/lib/pricing";
import { ACTION_CLASS } from "@/lib/ui";
import { IconDeclined, Price } from "./PlanCard";
import { Stair } from "./Stair";

/**
 * The manage sheet (docs/ladder-spec.md, surface 3), opened from You's
 * plan card and Settings' row. A neutral raised sheet read top down like
 * a recipe card (Crouton): the mark and Done, where the plan stands, the
 * stair, then what can be done, as plain inset rows.
 *
 * Cancel is a row like any other, in ink, never hidden or greyed. Its
 * tap turns the rows into the confirm in place (the box's height on the
 * base spring, the contents cross-fading), and the confirm's terracotta
 * "Cancel plan" is the second tap: two taps out, as two taps in. A
 * result is said once in a status line where the buttons were, then the
 * sheet settles into the plan's new state. A 409 is never a dead end:
 * the sheet asks Stripe for the row and draws whatever it now is.
 *
 * Every call answers through `onPlan`, so the card or row behind the
 * sheet changes with it.
 */

/** How long a result's line holds before the sheet settles into the new state. */
const BEAT_MS = 1600;

/** The fills a group takes on the raised sheet: in dark it steps up a layer, as iOS's cells do. */
const GROUP = "inset-group dark:bg-[color-mix(in_srgb,var(--color-raised),#fff_5.5%)]!";

type Busy = "cancel" | "resume" | "portal-tap" | "portal-row" | null;

export function ManageSheet({
  view,
  today,
  onClose,
  onPlan,
}: {
  view: PlanView;
  today: Date;
  onClose: () => void;
  /** A billing route's answer: the row as the server now has it, and the account's Premium. */
  onPlan: (billing: BillingRow | null, premium: boolean) => void;
}) {
  // The portal's request, abandoned the moment the sheet starts to
  // leave (Done, Escape, the scrim, a drag): its answer then never sends
  // the browser to Stripe.
  const attempts = useAttempts();
  return (
    // The panel is the sheet's own width: a flex item sized by its
    // content would draw a narrow sheet for a short state.
    <Overlay label={MANAGE_COPY.manage} onClose={onClose} onLeave={attempts.abandon} className="w-full max-w-[430px]">
      <ManageBody view={view} today={today} onClose={onClose} onPlan={onPlan} attempts={attempts} />
    </Overlay>
  );
}

function ManageBody({
  view,
  today,
  onClose,
  onPlan,
  attempts,
}: {
  view: PlanView;
  today: Date;
  onClose: () => void;
  onPlan: (billing: BillingRow | null, premium: boolean) => void;
  attempts: Attempts;
}) {
  const close = useOverlayClose(onClose);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  /** A result's sentence, said where the buttons were for a beat. */
  const [beat, setBeat] = useState<string | null>(null);
  /** What the live region says: the beat, once. */
  const [said, setSaid] = useState("");

  useEffect(() => {
    if (beat === null) return;
    // The live region empties with it, so the same sentence later is said again.
    const t = setTimeout(() => {
      setBeat(null);
      setSaid("");
    }, BEAT_MS);
    return () => clearTimeout(t);
  }, [beat]);

  // Back from Stripe through the back/forward cache, the sheet is
  // restored as it was left: give the rows back.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  function settle(row: BillingRow | null, premium: boolean, sentence: string) {
    onPlan(row, premium);
    setConfirming(false);
    setBusy(null);
    setBeat(sentence);
    setSaid(sentence);
  }

  /**
   * A 409: the plan moved under us. Ask Stripe, draw what it is, and say
   * the server's sentence, unless the plan has ended: the "ended" head
   * then says it and the reset rule, once, and a beat repeating the
   * server's "This plan has ended" under it would say it twice.
   */
  async function resync(sentence: string) {
    const s = await syncPlan();
    if (s.ok) {
      if (!hasPlan(planView(null, s.billing, today))) {
        onPlan(s.billing, s.premium);
        setConfirming(false);
        setBusy(null);
        setSaid(`${ENDED_TITLE}. ${ENDED_LINE}`);
        return;
      }
      settle(s.billing, s.premium, sentence);
      return;
    }
    setError(sentence);
    setBusy(null);
  }

  async function cancel() {
    if (busy) return;
    setBusy("cancel");
    setError(null);
    const r = await cancelPlan();
    if (r.ok) settle(r.billing, r.premium, cancelledStatus(planView(null, r.billing, today), today));
    else if (r.status === 409) await resync(r.error);
    else {
      setError(r.error);
      setBusy(null);
    }
  }

  async function resume() {
    if (busy) return;
    setBusy("resume");
    setError(null);
    const r = await resumePlan();
    if (r.ok) settle(r.billing, r.premium, resumedStatus(planView(null, r.billing, today), today));
    else if (r.status === 409) await resync(r.error);
    else {
      setError(r.error);
      setBusy(null);
    }
  }

  async function portal(which: "portal-tap" | "portal-row") {
    if (busy) return;
    const id = attempts.start();
    setBusy(which);
    setError(null);
    const r = await openPortal({ returnTo: withPortalReturn(currentPath()) });
    // The sheet was closed while it was out: stay on this page.
    if (!attempts.live(id)) return;
    if (r.ok) {
      // Busy until the browser has left.
      window.location.assign(r.url);
      return;
    }
    setError(r.error);
    setBusy(null);
  }

  const kind = view.kind;
  // A declined plan keeps its decline in the head even once it is set
  // to end (the charge still being retried is the thing to fix), and a
  // plan set to end, declined or not, offers "Keep my plan" rather than
  // a cancel the server would answer with a 409.
  const head =
    kind === "active" || kind === "floor"
      ? "price"
      : view.declined && (kind === "ending" || kind === "pastDue" || kind === "unpaid")
        ? "declined"
        : kind === "ending"
          ? "ending"
          : kind === "incomplete"
            ? "pending"
            : "ended";
  const actions = view.cancelling && (kind === "ending" || kind === "unpaid") ? "ending" : head;
  const panel = beat !== null ? "beat" : confirming ? "confirm" : actions;
  const locked = busy !== null;

  const updateRow = (
    <Row
      label={MANAGE_COPY.update}
      note={MANAGE_COPY.updateCaption}
      busy={busy === "portal-row"}
      disabled={locked}
      onClick={() => void portal("portal-row")}
    />
  );
  /* D44: Cancel plan is its own group, a centred red word with no
     chevron, so it reads as the action it is, never as a door. One tap
     still opens the confirm in place (#386). */
  const cancelGroup = (
    <div className={`${GROUP} mt-4`}>
      <button
        type="button"
        onClick={() => {
          if (locked) return;
          setError(null);
          setConfirming(true);
        }}
        aria-disabled={locked || undefined}
        aria-expanded={false}
        data-look="cancel-plan"
        className="group-row press-row font-display flex w-full items-center justify-center text-center text-detail font-semibold text-destructive aria-disabled:text-stone-400"
      >
        {MANAGE_COPY.cancel}
      </button>
    </div>
  );

  return (
    <div className="elev-3 max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-sheet border border-b-0 border-transparent bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-ink dark:border-card-edge dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-raised),#fff_3%)_0,var(--color-raised)_88px)]">
      {/* The grabber and Done in one row, as every information sheet
          closes (D15), then the tier's mark. */}
      <SheetHead onClose={close} label={MANAGE_COPY.done} />
      <PremiumMark variant="chip" />
      <p role="status" className="sr-only">
        {said}
      </p>

      {/* Where the plan stands. */}
      <Morph id={head} className="mt-2">
        {head === "price" ? (
          <>
            <p className="flex items-baseline">
              <Price cents={view.priceCents} size="l" />
              <span className="ml-2 text-body text-stone-500">{MANAGE_COPY.thisMonth}</span>
            </p>
            <p className="mt-1.5 text-body text-pretty text-stone-500">{withPrices(manageLine(view, today))}</p>
          </>
        ) : head === "ending" ? (
          <>
            <h2 className="font-display text-title">{endingTitle(view, today)}</h2>
            <p className="mt-1.5 text-body text-pretty text-stone-500">{withPrices(endingBody(view, today))}</p>
          </>
        ) : head === "declined" ? (
          <>
            <h2 className="font-display flex items-center gap-2 text-title">
              <IconDeclined size={22} />
              {MANAGE_COPY.declined}
            </h2>
            <p className="mt-1.5 text-body text-pretty text-stone-500">
              {withPrices(
                kind === "unpaid" ? unpaidLine(view, today) : kind === "ending" ? endingBody(view, today) : retriedLine(view)
              )}
            </p>
          </>
        ) : head === "pending" ? (
          <>
            <h2 className="font-display text-title">{MANAGE_COPY.pending}</h2>
            <p className="mt-1.5 text-body text-pretty text-stone-500">{PENDING_LINE}</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-title">{ENDED_TITLE}</h2>
            <p className="mt-1.5 text-body text-pretty text-stone-500">{withPrices(ENDED_LINE)}</p>
          </>
        )}
      </Morph>

      {head !== "ended" && (
        <Stair
          tone="neutral"
          size="md"
          at={kind === "incomplete" ? null : view.step}
          labels={stepLabels(view.calendar)}
          ghostAfter={view.cancelling}
          bleed={24}
          riseDelay={180}
          label={pictureLabel(view, today)}
          className="mt-3"
        />
      )}

      {/* What can be done. */}
      <Morph id={panel} className="mt-5">
        {panel === "beat" ? (
          <p aria-hidden className={`${GROUP} flex min-h-12 items-center gap-3 px-4 py-3 text-body`}>
            <IconCheck />
            <span className="min-w-0">{beat}</span>
          </p>
        ) : panel === "confirm" ? (
          <div role="group" aria-labelledby="manage-confirm-head">
            <h3 id="manage-confirm-head" className="detail-head">
              {MANAGE_COPY.confirmTitle}
            </h3>
            <p className="mt-1 text-body text-pretty text-stone-500">{confirmBody(view, today)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Backing out takes the failed cancel's line with it: an
                  alert about an action nobody is taking any more. */}
              <button
                type="button"
                aria-disabled={locked || undefined}
                onClick={() => {
                  if (locked) return;
                  setError(null);
                  setConfirming(false);
                }}
                className="press font-display flex min-h-12 items-center justify-center rounded-tap border-2 border-edge px-4 text-body font-bold text-ink aria-disabled:text-stone-400"
              >
                {MANAGE_COPY.keep}
              </button>
              <button
                type="button"
                aria-disabled={locked || undefined}
                aria-busy={busy === "cancel" || undefined}
                onClick={() => void cancel()}
                className={`${ACTION_CLASS} px-4!`}
              >
                {busy === "cancel" ? MANAGE_COPY.busy : MANAGE_COPY.cancel}
              </button>
            </div>
          </div>
        ) : panel === "ending" ? (
          <>
            <button
              type="button"
              aria-disabled={locked || undefined}
              aria-busy={busy === "resume" || undefined}
              onClick={() => void resume()}
              className={ACTION_CLASS}
            >
              {busy === "resume" ? MANAGE_COPY.busy : MANAGE_COPY.keep}
            </button>
            <div className={`${GROUP} mt-4`}>{updateRow}</div>
          </>
        ) : panel === "declined" ? (
          <>
            <button
              type="button"
              aria-disabled={locked || undefined}
              aria-busy={busy === "portal-tap" || undefined}
              onClick={() => void portal("portal-tap")}
              className={ACTION_CLASS}
            >
              {busy === "portal-tap" ? MANAGE_COPY.busy : MANAGE_COPY.updateCard}
            </button>
            <div className={`${GROUP} mt-4`}>
              <Row
                label={MANAGE_COPY.receipts}
                busy={busy === "portal-row"}
                disabled={locked}
                onClick={() => void portal("portal-row")}
              />
            </div>
            {cancelGroup}
          </>
        ) : panel === "pending" ? (
          <div className={GROUP}>{updateRow}</div>
        ) : panel === "price" ? (
          <>
            <div className={GROUP}>{updateRow}</div>
            {cancelGroup}
          </>
        ) : null}
      </Morph>

      {error && (
        <p role="alert" className="mt-3 text-caption leading-relaxed text-rust">
          {error}
        </p>
      )}
    </div>
  );
}

/** A plan the 409 found already ended: what is true now, and the reset rule, once. */
const ENDED_TITLE = "Your plan has ended";
const ENDED_LINE = `A new one starts at month 1, ${formatAud(FIRST_PRICE_CENTS)}.`;

/** Prices in a sentence stand out in ink, the way a board prints its figures. */
function withPrices(text: string): ReactNode {
  const parts = text.split(/(A\$\d+\.\d{2})/);
  return parts.map((part, i) =>
    i % 2 ? (
      <span key={i} className="font-semibold whitespace-nowrap text-ink tabular-nums">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * A row in the sheet's group: a label, an optional note, the chevron (or
 * "One moment…" while it opens). While a call is out every control in
 * the sheet is aria-disabled rather than disabled, and its handler
 * refuses: a disabled button drops the keyboard's focus to <body>, and
 * the next Tab walked out of the modal to the nav behind it.
 */
function Row({
  label,
  note,
  busy = false,
  disabled = false,
  onClick,
}: {
  label: string;
  note?: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick();
      }}
      aria-disabled={disabled || undefined}
      aria-busy={busy || undefined}
      className="group-row press-row flex w-full items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && <span className="mt-0.5 block text-caption text-stone-500">{note}</span>}
      </span>
      {busy ? <span className="shrink-0 text-caption text-stone-500">{MANAGE_COPY.busy}</span> : <Disclosure />}
    </button>
  );
}

function IconCheck() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-ink">
      <circle cx="9" cy="9" r="7.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="m5.6 9.2 2.3 2.3 4.5-4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A box whose contents change in place: the height follows on the base
 * spring and the new contents cross-fade over the old in 200ms, so the
 * rows becoming the confirm (and the confirm becoming its result) read
 * as one object changing, never a cut. When the control that had focus
 * leaves with the old contents, focus lands on the box, inside the
 * sheet, rather than escaping to the page behind it. Reduced motion
 * keeps the fade and drops the height's travel.
 *
 * The box pads 4px inside its clip so a focus ring is never cut; it
 * gives the sides and the foot back, and the caller's top margin is the
 * visual gap less those 4px.
 */
function Morph({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [glide, setGlide] = useState(false);
  const [shown, setShown] = useState(id);
  const [leaving, setLeaving] = useState<{ id: string; node: ReactNode } | null>(null);
  /** The contents as last committed: what leaves when `id` changes. */
  const last = useRef<ReactNode>(children);
  if (shown !== id) {
    setShown(id);
    setLeaving({ id: shown, node: last.current });
  }
  useEffect(() => {
    last.current = children;
  });

  useEffect(() => {
    setGlide(!prefersReducedMotion());
  }, []);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  // The focused control left with the old contents: keep focus in the sheet.
  useLayoutEffect(() => {
    if (!leaving) return;
    const active = document.activeElement;
    if (!active || active === document.body) box.current?.focus({ preventScroll: true });
  }, [leaving]);

  return (
    <div
      ref={box}
      tabIndex={-1}
      className={`relative -mx-1 -mb-1 overflow-hidden p-1 outline-none! ${className}`}
      style={{
        height: height === null ? undefined : height + 8,
        transition: glide ? "height var(--spring-base-duration) var(--spring-base)" : undefined,
      }}
    >
      <div ref={inner} key={shown} className={leaving ? "fade-in" : undefined}>
        {children}
      </div>
      {leaving && (
        <div
          key={`out:${leaving.id}`}
          aria-hidden
          inert
          className="pointer-events-none absolute inset-x-1 top-1"
          style={{ animation: "fade-out var(--duration-base) var(--ease-out) forwards" }}
          onAnimationEnd={() => setLeaving(null)}
        >
          {leaving.node}
        </div>
      )}
    </div>
  );
}
