"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { CHECKOUT_COPY, checkoutReturnWords, dropWords, pictureLabel, stepLabels, type PlanView } from "@/lib/plan-view";
import { prefersReducedMotion } from "@/lib/prefs";
import { formatAud } from "@/lib/pricing";
import { usePlan, usePriceDrop } from "@/lib/use-plan";
import { Price, PriceCell } from "./PlanCard";
import { HOP_DELAY_MS, Stair } from "./Stair";

/**
 * The ladder's two moments (docs/ladder-spec.md): the first step, back
 * from Checkout, and the month the price steps down. Demos appears at
 * these two and nowhere else on the ladder: an arrival, never furniture.
 */

/** The stair waits for its sheet, as the paywall's does. */
const RISE_AFTER_MS = 180;

/**
 * Back from Checkout, in the plan card's place on You for this visit:
 * Demos celebrating beside his line, then the stair with month 1 lit
 * and the Paw landing on it, then the board, month 1's price and the
 * next one with its date. It stands on the ground rather than in a
 * card, because his bubble is a card and a card in a card is two
 * containers for one thing.
 *
 * The page scrolls it into view, so it holds its entrance until it is
 * there: the Paw lands where someone can see it land. The slot's live
 * region says the line; this is the picture of it.
 */
export function CheckoutReturn({ view, today }: { view: PlanView; today: Date }) {
  const w = checkoutReturnWords(view, today);
  const root = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    // A page that never scrolls it fully in still shows it.
    const t = setTimeout(() => setSeen(true), 2400);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <div ref={root} data-look="checkout-return" aria-hidden className={seen ? "arrive" : "invisible"}>
      <div className="flex items-center gap-2">
        <DemosArt pose="celebrate" size={120} className="!mx-0 -ml-1" />
        {/* Pretty, not balanced: balance set "Premium is / on. This is /
            your first step." on a narrow phone. */}
        <SpeechBubble tail="left" className="min-w-0 flex-1 text-pretty">
          {CHECKOUT_COPY.on}
        </SpeechBubble>
      </div>
      {/* Remounted when it comes into view, so its rise and the Paw's
          landing play then; the first one only holds the height. */}
      <Stair
        key={seen ? "in" : "wait"}
        tone="neutral"
        size="sm"
        at={1}
        bleed={20}
        riseDelay={seen ? 260 : 0}
        label={pictureLabel(view, today)}
        className="mt-4"
      />
      <div className="mt-3 flex items-end justify-between gap-4">
        <PriceCell caption={w.left.caption} cents={w.left.cents} />
        {w.right && <PriceCell caption={w.right.caption} cents={w.right.cents} end />}
      </div>
    </div>
  );
}

/**
 * The month the price steps down (surface 5): a plum sheet, the tier
 * speaking. Demos says it; the readout shows last month's price until
 * the Paw lands on this month's step, and on that frame the digits roll
 * (10.99 to 9.99: two places turn, ".99" holds), the step takes its
 * weight and the haptic fires. One terracotta tap, "Done". Reduced
 * motion draws the end state with a fade.
 */
export function PriceDropSheet({
  view,
  today,
  from,
  onClose,
}: {
  view: PlanView;
  today: Date;
  /** The month this device last saw: the roll and the hop start there (usePriceDrop). */
  from: number | null;
  onClose: () => void;
}) {
  return (
    <Overlay label={DROP_LABEL} onClose={onClose} className="w-full max-w-[430px]">
      <DropBody view={view} today={today} from={from} onClose={onClose} />
    </Overlay>
  );
}

/** The dialog's name: the bubble's first sentence. */
const DROP_LABEL = "Your price dropped";

function DropBody({
  view,
  today,
  from,
  onClose,
}: {
  view: PlanView;
  today: Date;
  from: number | null;
  onClose: () => void;
}) {
  const close = useOverlayClose(onClose);
  // The words are the moment's: taken once, so a row that changes behind
  // the sheet does not rewrite what it is celebrating.
  const words = useMemo(() => dropWords(view, today, from), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [labels] = useState(() => stepLabels(view.calendar));
  // Reduced motion: no hop and no roll, the end state from the start,
  // faded in with the sheet. (The sheet only renders after a tap or a
  // read, never on the server, so the preference is safe to read here.)
  const [still] = useState(() => prefersReducedMotion());
  const [landed, setLanded] = useState(still);
  const shown = landed ? words.toCents : words.fromCents;

  return (
    <div className="card-premium max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-sheet px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-cream">
      {/* D45: Done at the top right in white, as every information sheet
          closes (D15), so a billing event carries no terracotta. */}
      <SheetHead onClose={close} plum />
      {/* His line on the plum sheet's own cream, balanced so each
          sentence keeps its line where it can and "Month 4" never
          parts: "Your price / dropped. / Month 4 / starts today." at
          320, two lines from 375. */}
      <div className="flex items-center gap-2">
        {/* Below 360 he steps down to 88, so his line has the room to
            set in three lines rather than four. */}
        {/* His hello (D45): a price that steps down is news, not a
            streak, so the celebrate pose, its sparkles and its clip stay
            the streak's. */}
        <DemosArt pose="hello" size={112} className="!mx-0 -ml-1 max-[359px]:!h-[88px] max-[359px]:!w-[88px]" />
        <SpeechBubble tail="left" material="plum" className="min-w-0 flex-1 text-balance">
          {words.bubble.replace(/Month (\d+)/, "Month\u00a0$1")}
        </SpeechBubble>
      </div>
      <p role="status" className="sr-only">
        {landed ? `Month ${Math.max(1, view.month)} is ${formatAud(words.toCents)}.` : ""}
      </p>
      <p aria-hidden className="mt-5 text-cream">
        <Price cents={shown} size="hero" tone="plum" roll />
      </p>
      <p className="mt-2 text-caption text-cream/70">{words.caption}</p>
      <Stair
        tone="plum"
        size="lg"
        at={words.hop.to}
        hop={{ from: words.hop.from, to: words.hop.to, key: still ? 0 : 1, delay: RISE_AFTER_MS + HOP_DELAY_MS }}
        onLand={() => setLanded(true)}
        labels={labels}
        bleed={24}
        riseDelay={RISE_AFTER_MS}
        label={pictureLabel(view, today)}
        className="mt-2"
      />
    </div>
  );
}

/**
 * The drop on a page that reads nothing else about the plan (Today): it
 * reads the billing row after mount and opens the sheet over the page,
 * at most once per new month. `hold` keeps it back while another sheet
 * is up. Renders nothing at all until there is a drop to show.
 */
export function PriceDropOnLoad({ hold = false }: { hold?: boolean }) {
  const plan = usePlan();
  const drop = usePriceDrop(plan.view, !hold);
  if (!drop.open || !plan.today) return null;
  return <PriceDropSheet view={plan.view} today={plan.today} from={drop.from} onClose={drop.close} />;
}
