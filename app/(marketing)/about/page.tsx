import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ethos — a daily gym for speech",
  description:
    "Five minutes of reps a day until speaking clearly under pressure is a trait, not a performance.",
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
        Not nerves. Not a lack of ideas. Just no reps. Courses teach theory,
        coaches cost $150 an hour, and neither gives you the one thing that
        builds a skill: doing it daily and being measured honestly.
      </p>

      <Link
        href="/welcome"
        className="mt-6 block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream press"
      >
        Take the floor
      </Link>
      <p className="mt-2.5 text-center text-[12.5px] text-stone-500">
        60 seconds. No signup until you&apos;ve done one.
      </p>

      <div className="relative mt-12 overflow-hidden rounded-[18px] border border-hairline bg-surface lift p-6">
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
            A better word, pulled from your own transcript. They collect into
            a lexicon that&apos;s actually yours.
          </li>
        </ol>
        <Image
          src="/demos-speaking.webp"
          alt="Demos, the Ethos coach"
          width={120}
          height={120}
          className="pointer-events-none absolute -bottom-4 -right-4 w-[120px] opacity-95"
        />
      </div>

      <h2 className="font-display mt-12 text-[20px] font-bold">
        We score silence.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Every other app treats a pause as dead air. We time yours and ask
        where it landed. Before a sentence, it reads as composure — you
        thought, then spoke. Inside one, it reads as searching. That single
        distinction is the difference between sounding certain and sounding
        lost, and no competitor measures it.
      </p>

      <div className="mt-6 rounded-2xl bg-stage p-6 text-cream lift-stage">
        <div className="label-data !text-stone-400">Your Ethos · /1000</div>
        <p className="mt-3 text-[14.5px] leading-relaxed text-stone-300">
          Eight dimensions. Four measured straight from the timestamps —
          pause, fillers, pace, range. Four judged against your actual words,
          and every judged score has to quote the moment it came from or it
          gets thrown out and re-run.
        </p>
        <p className="mt-3 text-[14.5px] font-semibold">
          If we can&apos;t point at a timestamp, we don&apos;t say it.
        </p>
      </div>

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
        className="mt-10 block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream press"
      >
        Start your first rep
      </Link>
      <p className="mt-6 text-center text-[12px] text-stone-400">
        Ethos — from Aristotle&apos;s three modes of persuasion. Logos is
        logic, pathos is emotion, ethos is the credibility of the speaker.
      </p>
    </main>
  );
}
