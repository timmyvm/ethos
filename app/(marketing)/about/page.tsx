import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { DemosArt } from "@/components/DemosArt";
import { MarketingBack, MarketingLink } from "@/components/MarketingBack";
import { PauseBar } from "@/components/PauseBar";
import { ScoreCard } from "@/components/ScoreCard";
import type { Pause } from "@/lib/metrics";
import type { PauseVerdict } from "@/lib/pause-quality";
import { ACTION_CLASS } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Ethos: practice being worth listening to",
  // §8: the acquisition line. Clarity converts at zero awareness:
  // "practice" says daily rather than one-off, and "worth listening to"
  // names the thing being built without dragging in fear of the podium.
  description:
    "Practice being worth listening to. Five minutes of practice a day, measured against timestamps, not vibes.",
  openGraph: {
    title: "Ethos: practice being worth listening to",
    description:
      "Courses teach theory. Ethos is daily practice: one prompt, 60 seconds, every number measured.",
  },
};

/**
 * One minute of somebody's practice, as the pause map draws it
 * (marketing-5): six held pauses, four that landed a point (sage) and
 * two that were searching (hollow), so both marks and the legend show.
 * Labelled a sample on the page, like the score card above it.
 */
const SAMPLE_PAUSES: (Pause & { verdict: PauseVerdict })[] = [
  { t: 0, len: 1.1, kind: "pre", verdict: "opening" },
  { t: 9.4, len: 1.5, kind: "pre", verdict: "landing" },
  { t: 19.1, len: 1.2, kind: "mid", verdict: "hesitation" },
  { t: 30.6, len: 1.7, kind: "pre", verdict: "landing" },
  { t: 41.3, len: 0.9, kind: "mid", verdict: "hesitation" },
  { t: 50.2, len: 1.4, kind: "pre", verdict: "landing" },
];

/** A footer link: a 44px target in the caption's voice (marketing-9). */
const FOOT_LINK =
  "press inline-flex min-h-11 items-center px-3 font-semibold text-stone-500 hover:text-ink";

/**
 * Landing page. Symptom-first headline structure (mechanics.md, adopted
 * from Wellspoken's marketing) kept strictly inside vision.md's
 * no-manufactured-insecurity rule: name the felt moment honestly, never
 * imply the reader is inadequate, never sell fear.
 *
 * The page shows the product rather than describing it (marketing-1,
 * -5): the real score card and the real pause map, each labelled a
 * sample. Demos arrives once, waving, in the hero (marketing-4, -7).
 */
export default function About() {
  // A stranger's top row, and the static HTML for everyone: the
  // wordmark and the way in. From Settings, MarketingBack puts the way
  // back in its place once the page has read `?from` (marketing-2).
  const stranger = (
    <div className="flex min-h-11 items-center justify-between">
      <div className="font-display text-lead font-extrabold">ethos</div>
      {/* The bar's own trailing link (15/600 ink, a 44px target), so
          this row speaks the app's bar grammar; -mr-2 sets the word on
          the gutter. */}
      <Link href="/signin" className="screen-bar-link press -mr-2">
        Sign in
      </Link>
    </div>
  );

  return (
    <main className="px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {/* The app's bar geometry: 44px at the top, under the status bar. */}
      <div className="pt-[env(safe-area-inset-top)]">
        <Suspense fallback={stranger}>
          <MarketingBack stranger={stranger} />
        </Suspense>
      </div>

      <DemosArt pose="wave" size={120} className="-ml-2 mt-6" />
      <h1 className="large-title mt-4">
        You had the point. <span className="block">It came out fuzzy.</span>
      </h1>
      <p className="mt-4 text-balance text-read text-stone-800">
        That&apos;s a practice problem. One prompt a day, 60 seconds of
        talking, and every second of it measured.
      </p>

      <Link href="/welcome" className={`${ACTION_CLASS} mt-6`}>
        Take the floor
      </Link>
      <p className="mt-3 text-center text-caption text-stone-500">
        No signup until you&apos;ve spoken.
      </p>

      <section className="card elev-2 mt-12 p-5">
        <h2 className="font-display text-lead font-bold">The daily loop</h2>
        <ol className="mt-3 space-y-3 text-read text-stone-800">
          <li>
            <span className="font-semibold text-ink">One prompt.</span>{" "}
            Impromptu, explain-it, argue-against-yourself. It changes daily.
          </li>
          <li>
            <span className="font-semibold text-ink">60 seconds.</span> You
            talk. That&apos;s the whole ask.
          </li>
          <li>
            <span className="font-semibold text-ink">Hard numbers.</span>{" "}
            Filler count with timestamps, words per minute, and a pause map
            that separates composure from panic.
          </li>
          <li>
            <span className="font-semibold text-ink">One focus.</span> One
            thing for tomorrow, tied to a number.
          </li>
          <li>
            <span className="font-semibold text-ink">One upgrade.</span> A
            better word from your own transcript, collected into your own
            lexicon.
          </li>
        </ol>
      </section>

      {/* "Hard numbers", shown: the card the app draws, with numbers a
          person three weeks in might have, and said to be a sample. */}
      <div className="mt-12">
        <ScoreCard
          index={612}
          delta={48}
          recordings={21}
          stars={14}
          foot="A sample, three weeks in."
        />
        <p className="mt-3 text-body font-semibold">
          If we can&apos;t point at a timestamp, we don&apos;t say it.
        </p>
      </div>

      <h2 className="font-display mt-12 text-title">We score silence</h2>
      <p className="mt-3 text-read text-stone-800">
        Ethos times every pause and marks where it landed: before a
        sentence, or inside one.
      </p>
      <div className="mt-4">
        <PauseBar pauses={SAMPLE_PAUSES} durationS={60} />
      </div>

      {/*
       * §7: the differentiator is FORMAT, not features. Yoodli already
       * does body language and eye contact over webcam, and it is not a
       * small player: $40M Series B in Dec 2025 at a $300M valuation,
       * Google and Databricks as enterprise clients, a Toastmasters
       * partnership covering ~300k members. Claiming nobody does body
       * language would be false and checkable, which is the fastest way
       * to lose the one thing this product sells.
       */}
      <h2 className="font-display mt-12 text-title">Daily, with video</h2>
      <p className="mt-3 text-read text-stone-800">
        Yoodli is a strong rehearsal tool: it reads your body language
        before a big talk. Nobody is doing{" "}
        daily, streak-driven, gamified practice with video.
      </p>

      <h2 className="font-display mt-12 text-title">
        The camera is optional, and it stays here
      </h2>
      <p className="mt-3 text-read text-stone-800">
        With video on, your posture, gestures and eye line are read{" "}
        <span className="font-semibold text-ink">on your device</span>. Only
        five numbers are uploaded, the same five you see.
      </p>

      <h2 className="font-display mt-12 text-title">What you can count on</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-read text-stone-800 marker:text-stone-300">
        <li>Every claim traces to a number.</li>
        <li>Money buys cosmetics. Stars, streaks and scores are earned.</li>
        <li>Five minutes a day.</li>
      </ul>

      <Link href="/welcome" className={`${ACTION_CLASS} mt-10`}>
        Take the floor
      </Link>

      <footer className="mt-12 border-t border-hairline pt-6 text-center text-caption text-stone-400">
        <p>
          Ethos, from Aristotle. Logos is logic, pathos is emotion, ethos is
          the credibility of the speaker.
        </p>
        <div className="mt-2 flex flex-wrap justify-center">
          <MarketingLink href="/privacy" className={FOOT_LINK}>
            Privacy
          </MarketingLink>
          <MarketingLink href="/terms" className={FOOT_LINK}>
            Terms
          </MarketingLink>
          <a href="mailto:hello@speakethos.com" className={FOOT_LINK}>
            hello@speakethos.com
          </a>
        </div>
      </footer>
    </main>
  );
}
