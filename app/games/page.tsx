"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  IconBoss,
  IconBubble,
  IconGauge,
  IconCase,
  IconUpload,
} from "@/components/Icon";
import { DemosArt } from "@/components/DemosArt";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { ErrorLine } from "@/components/ui/ErrorState";
import { HeroStage } from "@/components/ui/HeroStage";
import { Skeleton } from "@/components/ui/Skeleton";
import { bossAnswerLine, bossReadLine } from "@/lib/boss";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { draw, GAMES, needsPremium, type Game } from "@/lib/games";
import { HOSTILE_LINE } from "@/lib/hostile";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";
import { usePaywallReturn } from "@/lib/use-paywall-return";

/**
 * Practice, the tab that was Tools (DECISIONS #157, #184, #292, #294).
 *
 * The weekly boss, then the games as tiles: Free above, then Premium as
 * one card that names the three paid modes and has one door (D31). It
 * was a frosted plum wall over blurred copies of the tiles (#317), which
 * read as a failed image load; what #317 asked for stays: one block, the
 * three names, and an Unlock that is not terracotta, so the boss keeps
 * the one tap.
 *
 *  - The boss's sky stage IS its card (M13): the screen's one lifted
 *    thing, at the sheet radius, with Start on the ground under it. A
 *    card round a stage was a card in a card, and the button and the
 *    stage had different side insets (practice-tab-10).
 *  - One tile for every game (practice-tab-11): the glyph on a neutral
 *    surface tile in ink (D30: Q&A's mint disagreed with Upload's grey),
 *    the name under it, 96px. A tile in a grid carries no chevron.
 *  - Nothing moves on load and nothing is guessed (practice-tab-2,
 *    -14): the week is read on the device after mount, the plan slot
 *    holds a skeleton until the profile lands, and a failed read says
 *    so instead of showing a paying user the wall.
 *
 * Colour: the boss stage is the introduction's sky, with the full-body
 * clock pose standing in it. Under the stage everything is neutral
 * (STATE, #391): the tiles are surface with ink glyphs, the tap stays
 * terracotta, and plum is only the PremiumMark.
 */
const GLYPH: Record<string, (size: number) => ReactNode> = {
  qa: (s) => <IconBubble size={s} />,
  rush: (s) => <IconGauge size={s} />,
  /* The case, not the mic: the mic is Practice's own tab mark (D17),
     so on this screen it means Practice and nothing else. */
  interview: (s) => <IconCase size={s} />,
  hostile: (s) => <IconBoss size={s} />,
};

/**
 * The three paid modes as Premium's card lists them (D31): each one's
 * own line, already written where the mode lives, so the card makes no
 * new claim (COPY-RULES).
 */
const PREMIUM_MODES = [
  ...GAMES.filter(needsPremium).map((g) => ({ id: g.id, name: g.name, line: g.blurb })),
  { id: "hostile", name: "Hostile Q&A", line: HOSTILE_LINE },
];

const DAY_MS = 86_400_000;
/** The week (its start) the boss stage last welcomed Demos in. */
const SEEN_KEY = "ethos.practice.bossSeen";

export default function GamesPage() {
  const router = useRouter();
  /* Null while the profile is in flight: a paying user must never see
     the wall flash and collapse into their grid (practice-tab-14). */
  const [premium, setPremium] = useState<boolean | null>(null);
  /* The profile read failed: the slot says so and offers the retry,
     rather than showing a paying user the wall (#146). */
  const [planFailed, setPlanFailed] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall("Premium games"));
  /* Whether this week's boss has a recording behind it yet. Read once,
     from the same rows the log shows. Null while in flight (the label
     holds its line); a failed read lands on false and the card says
     "days left", which is true either way. */
  const [bossDone, setBossDone] = useState<boolean | null>(null);
  /* Days left in the week, from the DEVICE's own week. Read after
     mount, never in render (practice-tab-2): the server's week is UTC
     and the phone's is local, so on a Sunday morning in Melbourne the
     two disagreed by a day and React threw #418. */
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  /* Demos springs onto the stage on the first visit of the week and
     stands still after that: he appears at moments, never as furniture,
     and a tab you come back to is not a moment. Null until read, so he
     never pops in late on top of a still first frame. */
  const [arrive, setArrive] = useState<boolean | null>(null);

  function readPlan() {
    setPlanFailed(false);
    setPremium(null);
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => setPlanFailed(true));
  }

  useEffect(() => {
    const week = weekStart();
    let first = true;
    try {
      first = localStorage.getItem(SEEN_KEY) !== week.toISOString();
      localStorage.setItem(SEEN_KEY, week.toISOString());
    } catch {
      /* No storage: treat every visit as the first. */
    }
    setArrive(first);
    setDaysLeft(
      Math.max(1, 7 - Math.floor((Date.now() - week.getTime()) / DAY_MS))
    );

    readPlan();
    fetchReps()
      .then((rows) => {
        const since = week.getTime();
        setBossDone(
          rows.some(
            (r) =>
              (r.lesson_id ?? "").startsWith("boss:") &&
              new Date(r.created_at).getTime() >= since
          )
        );
      })
      .catch(() => setBossDone(false));
  }, []);

  /* A non-breaking space while either read is out, so the line keeps
     its height and nothing under it moves when the words land. */
  const weekState =
    bossDone === null || daysLeft === null
      ? " "
      : bossDone
        ? "Done this week"
        : daysLeft === 1
          ? "Last day"
          : `${daysLeft} days left`;
  const startLabel = bossDone ? "Again" : "Start";

  const free = GAMES.filter((g) => !needsPremium(g));
  const paid = GAMES.filter(needsPremium);

  function play(g: Game) {
    if (needsPremium(g) && premium !== true) {
      setPaywall(g.name);
      return;
    }
    router.push(repHref({ game: g.id, q: draw(g).id }));
  }

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader title="Practice" />

      {/* The weekly headliner. The sky stage is the card itself, the
          screen's one lifted thing, with Demos standing in it holding
          his clock (the boss is timed), the name and the week's state
          on the left. Nothing on the stage is a tap; Start sits on the
          ground under it, edge to edge with it. */}
      <section aria-labelledby="boss-title" className="mt-5">
        {/* The house stage (components/ui/HeroStage.tsx): every tab's
            hero is this one, since the cohesion pass. */}
        <HeroStage
          eyebrow="This week's boss"
          title="Cold Topic"
          titleId="boss-title"
          line={
            <p
              className="practice-week font-display mt-auto pt-3 text-link font-bold"
              data-done={bossDone || undefined}
            >
              {weekState}
            </p>
          }
          art={
            arrive !== null && (
              <DemosArt
                pose="clock"
                size={132}
                pop={arrive}
                grounded
                halo={{ tone: "sky", kind: "stage" }}
              />
            )
          }
        >
          {/* What the boss asks (D30), from its own two clocks, a
              sentence a line so neither breaks mid-way at 390. */}
          <p className="stage-ink font-display mt-1 text-body font-semibold">
            <span className="block">{bossReadLine()}</span>
            <span className="block">{bossAnswerLine()}</span>
          </p>
        </HeroStage>
        <Link
          href="/boss"
          aria-label={`${startLabel}: Cold Topic`}
          className={`${ACTION_CLASS} relative mt-3`}
        >
          {startLabel}
        </Link>
      </section>

      {/*
       * Free first, then the wall (26 Sep, Timothy: "premium is blurry,
       * blocked behind a physical wall, not just a colour, and free
       * chillin above them"). No blurbs: the name and the glyph say what
       * the game is, and the game's own screen says the rules.
       */}
      <div className="stagger mt-7">
        <h2 className="section-head">Free</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {free.map((g) => (
            <GameTile key={g.id} glyph={GLYPH[g.id](22)} name={g.name} onPress={() => play(g)} />
          ))}
          <GameTile glyph={<IconUpload size={22} />} name="Upload a recording" href="/upload" />
        </div>

        {/* The tier's head, its name and its mark (D31, D04): the mark
            is a label at the head, never a filled tile. */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <h2 className="section-head">Premium</h2>
          <PremiumMark variant="chip" />
        </div>
        {planFailed ? (
          <ErrorLine onRetry={readPlan} className="mt-3">
            Your plan didn&apos;t load.
          </ErrorLine>
        ) : premium === null ? (
          /* The free user's card at its landed height (principle 8);
             a subscriber's grid is shorter and lands with .arrive. */
          <Skeleton rounded="rounded-card" className="premium-card-slot mt-3" />
        ) : premium ? (
          <div className="arrive mt-3 grid grid-cols-3 gap-3">
            {paid.map((g) => (
              <GameTile key={g.id} glyph={GLYPH[g.id](22)} name={g.name} onPress={() => play(g)} />
            ))}
            <GameTile glyph={GLYPH.hostile(22)} name="Hostile Q&A" href="/hostile" />
          </div>
        ) : (
          /* One card, crisp (D31): the three paid modes as rows that
             say what each is, and one door. The rows are not doors; the
             Unlock is, as the secondary pill, so the boss's Start stays
             the screen's one terracotta. `premium-wall` is the hook the
             camera and check-sheet-touch open the paywall by. */
          <div className="card premium-card-slot arrive mt-3 px-4 pb-4">
            <ul>
              {PREMIUM_MODES.map((m) => (
                <li
                  key={m.id}
                  className="flex min-h-14 items-center gap-3 border-t border-hairline py-2 first:border-t-0"
                >
                  <span aria-hidden className="shrink-0 text-ink">
                    {GLYPH[m.id](24)}
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block text-detail font-semibold text-ink">{m.name}</span>
                    <span className="block text-link font-medium text-stone-500">{m.line}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPaywall("Premium games")}
              className="press premium-wall pill-on-raised font-display mt-2 flex min-h-11 w-full items-center justify-center rounded-tap border border-edge bg-surface px-6 text-body font-bold text-ink"
            >
              Unlock
            </button>
          </div>
        )}
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

/**
 * One game, as a tile: its glyph in ink on the neutral surface tile
 * (D30), its name under it, nothing to read.
 */
function GameTile({
  glyph,
  name,
  href,
  onPress,
}: {
  glyph: ReactNode;
  name: string;
  href?: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <span aria-hidden className="game-tile game-tile-plain">
        {glyph}
      </span>
      <span className="font-display block pt-2.5 text-row text-ink">{name}</span>
    </>
  );
  const cls = "game-card card flex min-h-24 flex-col p-3 text-left";
  return href ? (
    <Link href={href} className={`press ${cls}`}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onPress} className={`press ${cls}`}>
      {inner}
    </button>
  );
}
