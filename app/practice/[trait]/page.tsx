"use client";

import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { Ring } from "@/components/Ring";
import { CountUp } from "@/components/CountUp";
import { Disclosure } from "@/components/ui/Disclosure";
import { NORMS } from "@/content/norms";
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
  const router = useRouter();
  const search = useSearchParams();
  const id = params.trait as TraitId;
  const def = TRAIT[id];

  /* The example step is skipped for a trait without approved copy. */
  const steps = STEPS.filter((s) => s !== "example" || def?.walkthrough);

  const [readings, setReadings] = useState<TraitReading[] | null>(null);
  const [before, setBefore] = useState<TraitReading | null>(null);
  /*
   * practice-detail-1: whether the read has come back at all, success,
   * nothing recorded yet, or a failure. Until it has, nothing on the
   * screen is a number: the ring thinks and the figure is a dash, never
   * a 0 (STATE: unknown progress is never drawn as zero).
   */
  const [loaded, setLoaded] = useState(false);
  /*
   * `?done=1` is how the recorder hands the lesson back: the walk goes
   * out to /rep and returns to the last step, where the new reading is
   * waiting to be compared with the one it left on. Read on the FIRST
   * render (practice-detail-5), so the return paints the last step
   * straight away instead of one frame of the first step and a slide.
   */
  const [i, setI] = useState(() => (search.get("done") === "1" ? steps.length - 1 : 0));

  useEffect(() => {
    let live = true;
    fetchReps(30)
      .then((reps) => {
        if (!live) return;
        if (reps.length > 0) {
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
        }
        setLoaded(true);
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (!def) notFound();

  const step: Step = steps[Math.min(i, steps.length - 1)];
  const now = readings?.find((r) => r.id === id) ?? null;
  /* The scale's quality is the norm's, known before any read lands. */
  const provisional = NORMS[id].quality === "provisional";
  const go = (n: number) => setI(Math.max(0, Math.min(n, steps.length - 1)));
  /*
   * Step 0's back is the way OUT, not `undefined` (#279). This route is
   * in Nav's BARE list, so it draws no tab bar, and `LessonScreen` only
   * renders its back row when `onBack` is truthy: between them, the
   * first screen of a lesson had no control on it but the one that goes
   * deeper. A lesson is entered by tapping a trait on Today and has to
   * be leavable the same way.
   *
   * practice-detail-24: the way out REPLACES this entry with Today
   * rather than stacking Today on top of it, so the OS back gesture from
   * Today never reopens the lesson.
   */
  const back = i > 0 ? () => go(i - 1) : () => router.replace("/");

  /*
   * What every step shares. The trait (practice-detail-6): `data-trait`
   * on <main>, so the rings, the eyebrow and the distinction wear its
   * tone, the colour the tile on Today wore when it was tapped. The axis
   * (practice-detail-3, wellspoken-course s2): eyebrow, title and line
   * centred on the ring's line, and the block centred in the height
   * above the tap, so the six steps read as one layout.
   */
  const frame = { fill: true, align: "center", stepKey: step, trait: id } as const;

  /*
   * R3: the trait's stage takes the free height on every step and the
   * ring stands centred on it, scaled to the room (principle 7). It is
   * the same element from the first step to the recording, so it stays
   * put while the words change under it; the walk ends on the last
   * step, where the ring finally moves.
   */
  const stage = (
    <>
      <Ring
        value={now?.fraction ?? null}
        size={RING}
        tone="trait"
        state={loaded ? "idle" : "thinking"}
        delay={220}
        /* The scale is provisional or it is not, and the big ring on
           the lesson's stage is the loudest place in the app to be
           quiet about that. */
        provisional={now !== null && provisional}
        className={COIN}
      >
        {now ? (
          <CountUp value={now.percentile} durationMs={DURATION.max} className={FIGURE} />
        ) : (
          <Dash />
        )}
        <span className="label-micro mt-1 text-stone-500">percentile</span>
      </Ring>
      <Measured id={id} now={now} />
    </>
  );

  // ---- name -------------------------------------------------------------
  if (step === "name") {
    /*
     * practice-detail-2: "Today's lesson" claims the app chose this, so
     * it is said only where it did: this trait is the one `nextTrait`
     * would send somebody to. A provisional scale never chooses, and
     * nothing has chosen while the read is in flight, so both say what
     * the screen is.
     */
    const lowest = readings ? nextTrait(readings)?.next.id === id : false;
    return (
      <LessonScreen
        {...frame}
        onBack={back}
        eyebrow={lowest ? "Today's lesson" : "Practice"}
        title={def.name}
        line={def.what}
        art={stage}
        /*
         * The reason, said on the way in, in one plain sentence. The
         * measurement itself sits by the ring (practice-detail-7);
         * this line says what the ring's number is worth. Held at one
         * line while the read is in flight, so the block does not
         * move when it lands.
         */
        fineprint={
          !loaded
            ? " "
            : !now
              ? "Record once to place this trait."
              : provisional
                ? "The percentile is an estimate."
                : lowest
                  ? `Your lowest trait, at the ${ordinal(now.percentile)} percentile.`
                  : `${ordinal(now.percentile)} percentile, from your last recording.`
        }
        action={{ label: "Why it matters", onPress: () => go(i + 1) }}
      />
    );
  }

  // ---- why --------------------------------------------------------------
  if (step === "why") {
    return (
      <LessonScreen
        {...frame}
        onBack={back}
        eyebrow={def.name}
        art={stage}
        title="Why it matters"
        line={def.why}
        controls={
          /* The distinction is the hinge: the one thing people have
             wrong about this trait. It gets a ground of its own rather
             than a second line, because a lesson that can be skimmed
             past its hinge is a tip. The trait's ground, not sage
             (practice-detail-15): nothing on it is earned. */
          <div className="rounded-card bg-(--tone-stage) p-4">
            <h2 className="detail-head tone-ink">The part people miss</h2>
            <p className="mt-2 text-read text-stone-800 text-pretty">{def.distinction}</p>
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
        {...frame}
        onBack={back}
        eyebrow={def.name}
        art={stage}
        title="The technique"
        howTo={def.howTo}
        lead="howTo"
        ladder
        action={{
          label: def.walkthrough ? "Hear it" : "Start",
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
        {...frame}
        onBack={back}
        eyebrow={def.name}
        art={stage}
        title="Same words, moved"
        line={w.note}
        controls={
          <div className="space-y-3">
            <Line label="Searching" text={w.before} />
            <Line label="Landed" text={w.after} lit />
          </div>
        }
        action={{ label: "Start", onPress: () => go(i + 1) }}
      />
    );
  }

  // ---- practice ---------------------------------------------------------
  if (step === "practice") {
    return (
      <LessonScreen
        {...frame}
        onBack={back}
        eyebrow={def.name}
        art={stage}
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
      {...frame}
      onBack={back}
      eyebrow={def.name}
      title={
        /* "Up 26" is a claim about the population. Where the scale is
           provisional there is no such claim to make, only a second
           measurement, so the screen says that instead. */
        delta !== null && delta > 0 && !provisional
          ? `${def.name}, up ${delta}.`
          : loaded && !now
            ? /* The read came back with nothing to compare (or failed):
                 no claim that anything was measured. */
              `${def.name}, no reading yet.`
            : `${def.name}, measured again.`
      }
      line={
        /* One line held while the read is in flight, so the ring and
           the title above it stay where they are when it lands. */
        !now
          ? " "
          : provisional
            ? `${withUnit(id, now.raw)}${
                before ? `, from ${fmtRaw(before.raw)} last time.` : "."
              }`
            : `${ordinal(now.percentile)} percentile${
                before ? `, from the ${ordinal(before.percentile)}.` : "."
              }`
      }
      art={
        /* The ring travels from where it WAS to where it is, in front
           of them: the value it mounts with is the old one and the new
           one lands a beat later. That beat is the whole reward, and
           cutting to the answer throws it away. practice-detail-4: it
           is not mounted until the read is back, because mounted early
           it seeded on 0 and drew every change as a rise from empty;
           keyed on both values, so it always starts from the right
           one. Until then it thinks, with a dash, never a 0. */
        now ? (
          <MovingRing
            key={`${before?.fraction}-${now.fraction}`}
            from={before?.fraction ?? 0}
            fromPercentile={before?.percentile ?? 0}
            to={now.fraction}
            percentile={now.percentile}
            provisional={provisional}
          />
        ) : (
          <Ring
            value={null}
            size={RING}
            tone="trait"
            state={loaded ? "idle" : "thinking"}
            className={COIN}
          >
            <Dash />
            <span className="label-micro mt-1 text-stone-500">percentile</span>
          </Ring>
        )
      }
      controls={
        /* Latent while every norm is provisional (nextTrait returns
           nothing then); it wears the NEXT trait's tone, not this
           one's. */
        nxt && nxt.next.id !== id ? (
          <Link
            href={`/practice/${nxt.next.id}`}
            data-trait={nxt.next.id}
            className="card press flex items-center gap-3 p-4"
          >
            <Ring value={nxt.next.fraction} size={44} tone="trait" delay={500}>
              <span className="font-display text-link font-extrabold leading-none tabular-nums">
                {nxt.next.percentile}
              </span>
            </Ring>
            <span className="min-w-0 flex-1">
              <span className="eyebrow block">Next</span>
              <span className="font-display block text-body font-bold">
                {TRAIT[nxt.next.id].name}, {ordinal(nxt.next.percentile)}
              </span>
            </span>
            <Disclosure />
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

/** The ring's drawn size (its viewBox and stroke, M18); the stage
 *  scales it to the room it is given. */
const RING = 168;
/*
 * R3: the ring as an object on its stage, a disc of the ground behind
 * the trough so the number stays on plain ground, scaled to the stage:
 * 58% of the room's height, never under 152 or over 236 (its stroke
 * scales with it through the viewBox).
 */
const COIN = "rounded-full bg-ground size-[clamp(152px,58cqh,236px)]! [&>svg]:size-full";
/* The figure steps up from num-l to num-hero once the ring is big
   enough to hold it (a room 380px tall gives a 220 ring). */
const FIGURE =
  "font-display text-num-l tabular-nums [@container(min-height:380px)]:text-num-hero";

/** Unknown, drawn as unknown: a dash where the number goes. */
function Dash() {
  return (
    <span aria-hidden className={`${FIGURE} opacity-60`}>
      –
    </span>
  );
}

/**
 * practice-detail-7, #263: the number that IS measured, by the ring and
 * not in the fine print under the button. On a provisional scale the
 * placement is the guess and this is the fact. One line whether or not
 * it is known yet, so nothing moves when it lands.
 */
function Measured({ id, now }: { id: TraitId; now: TraitReading | null }) {
  const shown = now ? fmtRaw(now.raw) : null;
  return (
    <p
      aria-hidden={shown === null || undefined}
      className={`mt-3 text-center text-caption text-stone-500 ${shown === null ? "invisible" : "arrive"}`}
    >
      <span className="font-display text-num-s text-ink tabular-nums">{shown ?? "0"}</span>{" "}
      {shown === "1" ? TRAIT[id].unitOne : TRAIT[id].unit}
    </p>
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
  fromPercentile,
  to,
  percentile,
  provisional = false,
}: {
  from: number;
  fromPercentile: number;
  to: number;
  percentile: number;
  provisional?: boolean;
}) {
  const [value, setValue] = useState(from);
  const [shown, setShown] = useState(fromPercentile);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setValue(to);
      setShown(percentile);
      /* A lift and a buzz only for a real rise from a real reading: a
         drop is never drawn as a gain, and a first reading has nothing
         to rise from. */
      if (to > from && from > 0) {
        setClosing(true);
        buzz(14);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [from, to, percentile]);

  return (
    <Ring
      value={value}
      size={RING}
      tone="trait"
      state={closing ? "closing" : "idle"}
      delay={0}
      provisional={provisional}
      className={COIN}
    >
      <CountUp value={shown} durationMs={DURATION.max} className={FIGURE} />
      <span className="label-micro mt-1 text-stone-500">percentile</span>
    </Ring>
  );
}

/** One version of the line, in the transcript's own voice. */
function Line({ label, text, lit = false }: { label: string; text: string; lit?: boolean }) {
  return (
    <div
      className={`rounded-card border p-4 ${
        /* "Landed" stays sage: silence that landed is earned, Ring's
           own grammar for it. */
        lit ? "border-sage-300 bg-sage-50" : "border-edge bg-surface"
      }`}
    >
      <div className="eyebrow">{label}</div>
      <p className="mt-1.5 text-read text-stone-800 text-pretty">{text}</p>
    </div>
  );
}
