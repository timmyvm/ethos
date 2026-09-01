import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ethos: practice being worth listening to",
  // §8: the acquisition line. Clarity converts at zero awareness —
  // "practice" says gym rather than one-off, and "worth listening to"
  // names the thing being trained without dragging in fear of the podium.
  description:
    "Practice being worth listening to. Five minutes of practice a day, measured against timestamps, not vibes.",
  openGraph: {
    title: "Ethos: practice being worth listening to",
    description:
      "Courses teach theory. Ethos is the daily gym: one prompt, sixty seconds, every number measured.",
  },
};

/**
 * Landing page. Symptom-first headline structure (mechanics.md, adopted
 * from Wellspoken's marketing) kept strictly inside vision.md's
 * no-manufactured-insecurity rule: name the felt moment honestly, never
 * imply the reader is inadequate, never sell fear.
 */
export default function About() {
  return (
    <main className="px-5 pb-24 pt-10">
      <div className="font-display text-[22px] font-bold">ethos</div>

      <h1 className="font-display mt-10 text-[34px] font-bold leading-[1.15]">
        You had the point.
        <br />
        It came out fuzzy.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-stone-600">
        That&apos;s a practice problem. Courses teach theory, coaches cost $150 an
        hour, and you build a skill the boring way: daily, with honest
        measurement.
      </p>
      <p className="mt-3 text-[16px] font-semibold leading-relaxed">
        Practice being worth listening to.
      </p>

      <Link
        href="/welcome"
        className="mt-6 block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-stage press"
      >
        Take the floor
      </Link>
      <p className="mt-2.5 text-center text-[12.5px] text-stone-500">
        60 seconds. No signup until you&apos;ve spoken.
      </p>

      <div className="relative mt-12 overflow-hidden rounded-[24px] border border-hairline bg-surface p-6">
        <h2 className="font-display text-[20px] font-bold">The daily loop</h2>
        <ol className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-stone-600">
          <li>
            <span className="font-semibold text-ink">One prompt.</span>{" "}
            Impromptu, explain-it, argue-against-yourself. It changes daily.
          </li>
          <li>
            <span className="font-semibold text-ink">
              Sixty seconds.
            </span>{" "}
            You talk. That&apos;s the whole ask.
          </li>
          <li>
            <span className="font-semibold text-ink">Hard numbers.</span>{" "}
            Filler count with timestamps, words per minute, and a pause map
            that separates composure from panic.
          </li>
          <li>
            <span className="font-semibold text-ink">One focus.</span>{" "}
            Not five. One thing for tomorrow, tied to a number.
          </li>
          <li>
            <span className="font-semibold text-ink">One supply.</span>{" "}
            A better word from your own transcript, collected into your own
            lexicon.
          </li>
        </ol>
        <Image
          src="/demos-speaking.webp"
          alt="Demos, the Ethos coach"
          width={120}
          height={120}
          className="demos pointer-events-none absolute -bottom-4 -right-4 w-[120px] opacity-95"
        />
      </div>

      <h2 className="font-display mt-12 text-[20px] font-bold">
        We score silence.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Most apps treat a pause as dead air. Ethos times yours and asks where
        it landed: before a sentence it reads as composure, inside one it
        reads as searching. The difference is measurable, so we measure it.
      </p>

      <div className="mt-6 rounded-[24px] bg-stage p-6 text-cream">
        <div className="label-data !text-cream/60">Your Ethos · /1000</div>
        <p className="mt-3 text-[14.5px] leading-relaxed text-cream/75">
          Nine dimensions. Five measured straight off the timestamps: pause,
          fillers, self-corrections, pace, range. Four judged against your
          words, and a judged score with no quoted moment is thrown out and
          re-run.
        </p>
        <p className="mt-3 text-[14.5px] font-semibold">
          If we can&apos;t point at a timestamp, we don&apos;t say it.
        </p>
      </div>

      {/*
       * §7 — the differentiator is FORMAT, not features. Yoodli already
       * does body language and eye contact over webcam, and it is not a
       * small player: $40M Series B in Dec 2025 at a $300M valuation,
       * Google and Databricks as enterprise clients, a Toastmasters
       * partnership covering ~300k members. Claiming nobody does body
       * language would be false and checkable, which is the fastest way
       * to lose the one thing this product sells.
       */}
      <h2 className="font-display mt-12 text-[20px] font-bold">
        Rehearsal tools exist. This isn&apos;t one.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Yoodli is a strong one: it reads your body language over a webcam,
        you run a session before the big thing, and you leave. The daily
        speaking apps listen to your voice and stop there.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Nobody is doing daily, streak-driven, gamified practice with video. Five
        minutes a day, scored on what you said{" "}
        <span className="font-semibold text-ink">and</span> how you held
        yourself saying it. That&apos;s the gap.
      </p>

      <h2 className="font-display mt-12 text-[20px] font-bold">
        The camera is optional, and it stays here.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Voice or voice + video, your call, remembered per drill. With video
        on, your posture, gestures and eye line are read{" "}
        <span className="font-semibold text-ink">on your device</span>. The
        video is never uploaded. Five numbers are, the same five on your
        screen.
      </p>

      <h2 className="font-display mt-12 text-[20px] font-bold">
        What this refuses to be
      </h2>
      <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-stone-600">
        <li>· No manufactured insecurity. You already know your gap.</li>
        <li>· No alpha talk. This serves ambition, not contempt.</li>
        <li>· No horoscope feedback. Every claim traces to a number.</li>
        <li>· No pay-to-win. Money never buys stars, streaks, or scores.</li>
        <li>· No deadline cram. It&apos;s a gym, not a rescue.</li>
      </ul>

      <Link
        href="/welcome"
        className="mt-10 block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-stage press"
      >
        Take the floor
      </Link>
      <p className="mt-6 text-center text-[12px] text-stone-400">
        Ethos, from Aristotle. Logos is logic, pathos is emotion, ethos is
        the credibility of the speaker.
      </p>
      <p className="mt-4 text-center text-[12px] text-stone-400">
        <Link href="/privacy" className="font-semibold text-stone-500">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="font-semibold text-stone-500">
          Terms
        </Link>{" "}
        · hello@speakethos.com
      </p>
    </main>
  );
}
