"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  IconBoss,
  IconBubble,
  IconGauge,
  IconMic,
  IconPremium,
  IconUpload,
} from "@/components/Icon";
import { DemosArt } from "@/components/DemosArt";
import { Paywall } from "@/components/Paywall";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { draw, GAMES, needsPremium, type Game } from "@/lib/games";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * Practice, the tab that was Tools (DECISIONS #157, #184, #292, #294).
 *
 * The weekly boss, then the games as tiles: Free above, Premium behind
 * a frosted plum wall (#317, Timothy: "games are tiles", no blurbs, a
 * white pill on the wall so the boss keeps the one tap).
 *
 *  - The boss's sky stage IS its card (M13): the screen's one lifted
 *    thing, at the sheet radius, with Start on the ground under it. A
 *    card round a stage was a card in a card, and the button and the
 *    stage had different side insets (practice-tab-10).
 *  - One tile for every game (practice-tab-11): the glyph on its
 *    picture tone, the name under it, 96px. The Free grid, the Premium
 *    grid and the still copies behind the wall are the same tile, and
 *    a tile in a grid carries no chevron.
 *  - Nothing moves on load and nothing is guessed (practice-tab-2,
 *    -14): the week is read on the device after mount, the plan slot
 *    holds a skeleton until the profile lands, and a failed read says
 *    so instead of showing a paying user the wall.
 *
 * Colour: the boss stage is the introduction's sky, with the full-body
 * clock pose standing in it, and every game has its own picture-tone
 * tile. Picture colour only: the tap stays terracotta, plum stays the
 * tier's, and no tile is a trait tone, because no game here practises
 * one trait and a trait's colour means that trait everywhere else.
 */
const GLYPH: Record<string, ReactNode> = {
  qa: <IconBubble size={22} />,
  rush: <IconGauge size={22} />,
  interview: <IconMic size={22} />,
};

/* Each game's tile tone (globals.css, `.tone-*` and "practice (/games)").
   Mint, sun and sky from the introduction; Hostile Q&A stands in the
   hot seat, a charcoal tile with a light shield (not gold: gold on black
   reads as a Pro badge beside a plum mark), since the fourth pastel
   (coral) is his coat and in terracotta's family. */
const TILE: Record<string, string> = {
  qa: "tone-mint",
  rush: "tone-sun",
  interview: "tone-sky",
};

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
  /* Behind the wall: the charcoal seat in the middle, under the plum
     mark, and the sky tile in a corner, so nothing blue peeks out
     beside plum (practice-tab-7). */
  const behind = [
    ...paid.filter((g) => g.id === "rush"),
    null,
    ...paid.filter((g) => g.id !== "rush"),
  ];

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
      <section aria-labelledby="boss-title" className="mt-4">
        <div className="intro-stage tone-sky practice-stage elev-2 h-[160px] p-5">
          <div className="relative z-[2] flex h-full max-w-[60%] flex-col">
            <p className="eyebrow practice-stage-ink">This week&apos;s boss</p>
            <h2
              id="boss-title"
              className="font-display mt-1.5 text-title font-extrabold"
            >
              Cold Topic
            </h2>
            <p
              className="practice-week font-display mt-auto text-link font-bold"
              data-done={bossDone || undefined}
            >
              {weekState}
            </p>
          </div>
          <div className="absolute bottom-[2px] right-1 z-[1] h-[132px] w-[132px]">
            {arrive !== null && (
              <DemosArt
                pose="clock"
                size={132}
                pop={arrive}
                grounded
                halo={{ tone: "sky", kind: "stage" }}
              />
            )}
          </div>
        </div>
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
            <GameTile
              key={g.id}
              glyph={GLYPH[g.id]}
              tile={TILE[g.id]}
              name={g.name}
              onPress={() => play(g)}
            />
          ))}
          <GameTile
            glyph={<IconUpload size={22} />}
            tile="game-tile-plain"
            name="Upload a recording"
            href="/upload"
          />
        </div>

        <h2 className="section-head mt-7">Premium</h2>
        {planFailed ? (
          <ErrorLine onRetry={readPlan} className="mt-3">
            Your plan didn&apos;t load.
          </ErrorLine>
        ) : premium === null ? (
          <Skeleton rounded="rounded-sheet" className="mt-3 h-[218px]" />
        ) : premium ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {paid.map((g) => (
              <GameTile
                key={g.id}
                glyph={GLYPH[g.id]}
                tile={TILE[g.id]}
                name={g.name}
                onPress={() => play(g)}
              />
            ))}
            <GameTile
              glyph={<IconBoss size={22} />}
              tile="game-tile-seat"
              name="Hostile Q&A"
              href="/hostile"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPaywall("Premium games")}
            className="press premium-wall mt-3 block w-full rounded-sheet text-left"
          >
            <span aria-hidden className="premium-wall-behind grid grid-cols-3 gap-3">
              {behind.map((g) =>
                g ? (
                  <GameTile key={g.id} glyph={GLYPH[g.id]} tile={TILE[g.id]} name={g.name} still />
                ) : (
                  <GameTile key="hostile" glyph={<IconBoss size={22} />} tile="game-tile-seat" name="Hostile Q&A" still />
                )
              )}
            </span>
            <span className="premium-wall-glass">
              <span className="premium-wall-mark">
                <IconPremium size={20} />
              </span>
              <span className="font-display mt-3 block text-row text-ink">
                Speed rush, Interview, Hostile Q&amp;A
              </span>
              <span className="premium-wall-cta font-display mt-4">Unlock</span>
            </span>
          </button>
        )}
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

/**
 * One game, as a tile: its glyph on its tone at the top, its name under
 * it, nothing to read. `still` draws it inert for the copies behind the
 * Premium wall, with a placeholder bar where the name would be, so no
 * half-legible word smears through the glass.
 */
function GameTile({
  glyph,
  tile,
  name,
  href,
  onPress,
  still = false,
}: {
  glyph: ReactNode;
  /** The tile's tone class: a `.tone-*`, or one of the two named tiles. */
  tile: string;
  name: string;
  href?: string;
  onPress?: () => void;
  still?: boolean;
}) {
  const inner = (
    <>
      <span aria-hidden className={`game-tile ${tile}`}>
        {glyph}
      </span>
      {still ? (
        <span className="mt-2.5 block h-2.5 w-14 rounded-[3px] bg-sand" />
      ) : (
        <span className="font-display block pt-2.5 text-row text-ink">{name}</span>
      )}
    </>
  );
  const cls = "game-card card flex min-h-24 flex-col p-3 text-left";
  /* Behind the glass each glyph sits centred in its column and level
     with the wall's mark (the glass centres a 130px stack in 200px, so
     the mark's top is 34px into a copy): the seat hides under the mark
     exactly and the sun and sky blur either side of it, rather than a
     grey haze peeking out at the mark's corner (practice-tab-7). */
  if (still) return <span className={`${cls} items-center pt-[34px]`}>{inner}</span>;
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
