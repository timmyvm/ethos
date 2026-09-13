"use client";

import Link from "next/link";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { Ring } from "@/components/Ring";
import { CountUp } from "@/components/CountUp";
import { TRAIT, type TraitId } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { DURATION } from "@/lib/motion";
import { buzz } from "@/lib/prefs";
import { repHref } from "@/lib/rep-config";
import {
  fmtRaw,
  nextLine,
  nextTrait,
  ordinal,
  readTraitsFromRow,
  withUnit,
  type TraitReading,
} from "@/lib/trait-readings";

/**
 * A lesson (DECISIONS #258). One trait, start to finish.
 *
 * This is what replaced the road. The lesson exists because a NUMBER
 * said so, the screen says which number on the way in, and it says what
 * moved on the way out. Nothing here is unlocked by a star and nothing
 * is gated by a position in a sequence: the only reason this lesson is
 * the one you are looking at is that this trait was your lowest.
 *
 * The shape, in order:
 *
 *   name       the trait, the percentile, the ring. What and where.
 *   why        why a listener cares, and the distinction people miss.
 *   how        the tactics.
 *   example    the same line said two ways, so the distinction is
 *              something you can hear rather than something asserted.
 *   practice   sixty seconds, with the tactic on screen.
 *   after      the ring MOVES, the percentile counts to its new value,
 *              and the next trait is named with its number.
 *
 * The example step is skipped for a trait without approved copy, rather
 * than filled with something written on the spot.
 */
const STEPS = ["name", "why", "how", "example", "practice", "after"] as const;
type Step = (typeof STEPS)[number];

export default function Practice() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <Lesson />
    </Suspense>
  );
}

function Lesson() {
  const params = useParams<{ trait: string }>();
  const search = useSearchParams();
  const id = params.trait as TraitId;
  const def = TRAIT[id];

  /*
   * `?done=1` is how the recorder hands the lesson back: the walk goes
   * out to /rep and returns to the last step, where the new reading is
   * waiting to be compared with the one it left on.
   */
  const returning = search.get("done") === "1";

  const [readings, setReadings] = useState<TraitReading[] | null>(null);
  const [before, setBefore] = useState<TraitReading | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    let live = true;
    fetchReps(30)
      .then((reps) => {
        if (!live || reps.length === 0) return;
        const last = readTraitsFromRow(reps[reps.length - 1]);
        setReadings(last);
        /*
         * The comparison is against the recording BEFORE this one, not
         * against a stored snapshot: a snapshot would go stale the
         * moment somebody recorded outside the lesson, and then the
         * screen would claim a change that did not happen here.
         */
        if (reps.length > 1) {
          const prev = readTraitsFromRow(reps[reps.length - 2]);
          setBefore(prev.find((r) => r.id === id) ?? null);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (returning) setI(STEPS.length - 1);
  }, [returning]);

  if (!def) notFound();

  const steps = STEPS.filter((s) => s !== "example" || def.walkthrough);
  const step: Step = steps[Math.min(i, steps.length - 1)];
  const now = readings?.find((r) => r.id === id) ?? null;
  const go = (n: number) => setI(Math.max(0, Math.min(n, steps.length - 1)));
  const back = i > 0 ? () => go(i - 1) : undefined;

  // ---- name -------------------------------------------------------------
  if (step === "name") {
    return (
      <LessonScreen
        center
        stepKey={step}
        onBack={back}
        /* "Today's lesson" claims the app chose this. On a provisional
           scale it refused to (nextTrait returns nothing), so the
           eyebrow says what the screen actually is. */
        eyebrow={now?.quality === "provisional" ? "Practice" : "Today's lesson"}
        title={def.name}
        line={def.what}
        art={
          <div className="mb-6 flex justify-center">
            <Ring
              value={now?.fraction ?? 0}
              size={132}
              delay={220}
              /* The scale is provisional or it is not, and the big ring
                 on the lesson's first screen is the loudest place in
                 the app to be quiet about that. */
              provisional={now?.quality === "provisional"}
            >
              <CountUp
                value={now?.percentile ?? 0}
                durationMs={DURATION.max}
                className="font-display text-[36px] font-extrabold leading-none"
              />
              <span className="label-micro mt-1 text-stone-500">percentile</span>
            </Ring>
          </div>
        }
        /* The reason, said out loud on the way in. This sentence is the
           whole shift: a lesson is here because a number is. */
        fineprint={
          /*
           * A provisional scale does not get to say "the 40th". The
           * MEASUREMENT is known either way and the placement is the
           * half that is a guess, so the provisional line leads with
           * the number that is true and names the doubt out loud. The
           * dashed trough says the same thing in the picture; a person
           * reading the fineprint should not have to decode it.
           */
          !now
            ? undefined
            : now.quality === "provisional"
              ? `${withUnit(id, now.raw)}, from your last recording. This scale is provisional.`
              : `Your lowest trait. ${ordinal(now.percentile)} percentile, from your last recording.`
        }
        action={{ label: "Why it matters", onPress: () => go(i + 1) }}
      />
    );
  }

  // ---- why --------------------------------------------------------------
  if (step === "why") {
    return (
      <LessonScreen
        center
        stepKey={step}
        onBack={back}
        eyebrow={def.name}
        title="Why it matters"
        line={def.why}
        controls={
          /* The distinction is the hinge: the one thing people have
             wrong about this trait. It gets a card rather than a second
             line, because a lesson that can be skimmed past its hinge
             is a tip. */
          <div className="rounded-card border border-sage-300 bg-sage-50 p-3.5">
            <div className="label-micro text-sage-700">The part people miss</div>
            <p className="mt-1.5 text-body leading-relaxed">{def.distinction}</p>
          </div>
        }
        action={{ label: "How to do it", onPress: () => go(i + 1) }}
      />
    );
  }

  // ---- how --------------------------------------------------------------
  if (step === "how") {
    return (
      <LessonScreen
        center
        stepKey={step}
        onBack={back}
        eyebrow={def.name}
        title="The technique"
        howTo={def.howTo}
        lead="howTo"
        ladder
        action={{
          label: def.walkthrough ? "Hear it" : "Take the floor",
          onPress: () => go(i + 1),
        }}
      />
    );
  }

  // ---- example ----------------------------------------------------------
  if (step === "example" && def.walkthrough) {
    const w = def.walkthrough;
    return (
      <LessonScreen
        center
        stepKey={step}
        onBack={back}
        eyebrow={def.name}
        title="Same words, moved"
        line={w.note}
        controls={
          <div className="space-y-3">
            <Line label="Searching" text={w.before} />
            <Line label="Landed" text={w.after} lit />
          </div>
        }
        action={{ label: "Take the floor", onPress: () => go(i + 1) }}
      />
    );
  }

  // ---- practice ---------------------------------------------------------
  if (step === "practice") {
    return (
      <LessonScreen
        center
        stepKey={step}
        onBack={back}
        eyebrow={def.name}
        title="Sixty seconds"
        line={def.howTo[0]}
        action={{
          label: "Record",
          href: repHref({ lesson: `trait-${id}`, back: `/practice/${id}?done=1` }),
        }}
        fineprint="The tactic stays on screen while you talk."
      />
    );
  }

  // ---- after ------------------------------------------------------------
  const nxt = readings ? nextTrait(readings) : null;
  const delta = now && before ? now.percentile - before.percentile : null;

  return (
    <LessonScreen
      /* Every step of the walk centres its block. Top-aligned, the
         short ones sit above half a screen of nothing and the walk
         reads as six different layouts. */
      center
      stepKey={step}
      onBack={back}
      eyebrow={def.name}
      title={
        /* "Up 26" is a claim about the population. Where the scale is
           provisional there is no such claim to make, only a second
           measurement, so the screen says that instead. */
        delta !== null && delta > 0 && now?.quality !== "provisional"
          ? `${def.name}, up ${delta}.`
          : `${def.name}, measured again.`
      }
      line={
        !now
          ? undefined
          : now.quality === "provisional"
            ? `${withUnit(id, now.raw)}${
                before ? `, from ${fmtRaw(before.raw)} last time.` : "."
              }`
            : `${ordinal(now.percentile)} percentile${
                before ? `, from the ${ordinal(before.percentile)}.` : "."
              }`
      }
      art={
        <div className="mb-6 flex justify-center">
          {/* The ring travels from where it WAS to where it is, in
              front of them: the value it mounts with is the old one and
              the new one lands a beat later. That beat is the whole
              reward, and cutting to the answer throws it away. */}
          <MovingRing
            from={before?.fraction ?? 0}
            to={now?.fraction ?? 0}
            percentile={now?.percentile ?? 0}
            provisional={now?.quality === "provisional"}
          />
        </div>
      }
      controls={
        nxt && nxt.next.id !== id ? (
          <Link
            href={`/practice/${nxt.next.id}`}
            className="press elev-1 flex items-center gap-3 rounded-card border border-card-edge bg-raised p-4"
          >
            <Ring value={nxt.next.fraction} size={44} delay={500}>
              <span className="font-display text-[13px] font-extrabold leading-none">
                {nxt.next.percentile}
              </span>
            </Ring>
            <span className="min-w-0 flex-1">
              <span className="label-micro block text-stone-500">Next</span>
              <span className="font-display block text-[15px] font-bold">
                {TRAIT[nxt.next.id].name}, {ordinal(nxt.next.percentile)}
              </span>
            </span>
          </Link>
        ) : undefined
      }
      action={{ label: "Done", href: "/" }}
      /* The same invariant as the card: a percentile never stands on
         its own, including at the top of the scale (nextLine). */
      fineprint={now ? (nextLine(now) ?? undefined) : undefined}
    />
  );
}

/**
 * The ring that moves. It mounts on the OLD value, waits for the screen
 * to arrive, then travels to the new one, so the change is something
 * that happens rather than something already on the screen when you got
 * there.
 */
function MovingRing({
  from,
  to,
  percentile,
  provisional = false,
}: {
  from: number;
  to: number;
  percentile: number;
  provisional?: boolean;
}) {
  const [value, setValue] = useState(from);
  const [shown, setShown] = useState(Math.round(from * 100));
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setValue(to);
      setShown(percentile);
      if (to > from) {
        setClosing(true);
        buzz(14);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [from, to, percentile]);

  return (
    <Ring
      value={value}
      size={132}
      state={closing ? "closing" : "idle"}
      delay={0}
      provisional={provisional}
    >
      <CountUp
        value={shown}
        durationMs={DURATION.max}
        className="font-display text-[36px] font-extrabold leading-none"
      />
      <span className="label-micro mt-1 text-stone-500">percentile</span>
    </Ring>
  );
}

/** One version of the line, in the transcript's own voice. */
function Line({ label, text, lit = false }: { label: string; text: string; lit?: boolean }) {
  return (
    <div
      className={`rounded-card border p-3.5 ${
        lit ? "border-sage-300 bg-sage-50" : "border-edge bg-surface"
      }`}
    >
      <div className="label-micro text-stone-500">{label}</div>
      <p className="mt-1.5 text-body leading-relaxed">{text}</p>
    </div>
  );
}
