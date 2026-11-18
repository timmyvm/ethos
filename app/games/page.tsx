"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { expectDraw, markDrawn } from "@/lib/first-draw";
import {
  IconBubble,
  IconGauge,
  IconCase,
  IconUpload,
} from "@/components/Icon";
import { DemosArt } from "@/components/DemosArt";
import { Paywall } from "@/components/LazyPaywall";
import { PremiumMark } from "@/components/PremiumMark";
import { StatIcon } from "@/components/StatIcon";
import { Disclosure } from "@/components/ui/Disclosure";
import { ErrorLine } from "@/components/ui/ErrorState";
import { HeroStage } from "@/components/ui/HeroStage";
import { Skeleton } from "@/components/ui/Skeleton";
import { BOSS_DONE_LINE, bossCardTopic } from "@/lib/boss";
import { dayKey } from "@/lib/challenge";
import { BOSS_ASK_LINE, hostileTile } from "@/lib/home-modes";
import {
  fetchGameRounds,
  fetchProfile,
  fetchReps,
  heldGameRounds,
  heldPremium,
  heldReps,
  type GameRoundRow,
  type RepRow,
} from "@/lib/client-data";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";
import {
  askedIdsFrom,
  drawFresh,
  gameById,
  gameOfTheDay,
  GAMES,
  needsPremium,
  type Game,
} from "@/lib/games";
import { weekStart } from "@/lib/level";
import {
  dayState,
  freeAgainLine,
  lessonIdsNewestFirst,
  PREMIUM_DEPTH,
  tileLadder,
  tomorrowLine,
  type TileLadder,
} from "@/lib/practice-tiles";
import { GAMES_LOG_HREF, GAMES_LOG_LABEL } from "@/lib/log-view";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";
import { usePaywallReturn } from "@/lib/use-paywall-return";

/**
 * Practice, the tab that was Tools (DECISIONS #157, #184, #292, #294).
 *
 * The weekly boss, then the games as tiles: Free above, then Premium.
 * What #317 asked for stays: one Premium block, its paid modes named,
 * and an Unlock that is not the tap's fill, so the boss keeps the one tap.
 *
 *  - The boss's sky stage IS its card (M13): the screen's one lifted
 *    thing, at the sheet radius, with Start on the ground under it.
 *  - A game's tile carries its ladder (the games plan, item 7; M6): the
 *    open level, pips toward the next count (sage when counted, earned),
 *    and the best at that level. A mastered game's glyph turns sage.
 *    Unknown is never drawn as Level 1: while the rounds are read the
 *    tile holds its height with nothing in the ladder's place, and a
 *    failed read leaves it the bare glyph and name it always was. A
 *    tap draws a question you have not answered and opens your level.
 *  - A free account plays one Premium game a day (item 12): today's is
 *    a real tile, "Free today", and after its round it says when it is
 *    free again and opens the paywall. The card names tomorrow's game
 *    and what the levels are (item 14).
 *  - Hostile Q&A is free since #478 and stands in Free beside Q&A, for
 *    every plan; Today opens it too. Upload is the section's wide door.
 *  - Nothing moves on load and nothing is guessed (practice-tab-2,
 *    -14): the week and the day are read on the device after mount, the
 *    plan slot holds a skeleton until the profile lands, and a failed
 *    read says so instead of showing a paying user the wall.
 *
 * Colour: the boss stage is the introduction's sky, with the full-body
 * clock pose standing in it. Under the stage everything is neutral
 * (STATE, #391): the tiles are cards with ink glyphs, sage only for a
 * counted pip and a mastered game, the tap is the page's ink (#459), and plum is
 * only the PremiumMark. No Demos on a tile: he is not furniture.
 */
const GLYPH: Record<string, (size: number) => ReactNode> = {
  qa: (s) => <IconBubble size={s} />,
  rush: (s) => <IconGauge size={s} />,
  /* The case, not the mic: the mic is Practice's own tab mark (D17),
     so on this screen it means Practice and nothing else. */
  interview: (s) => <IconCase size={s} />,
  /* Hostile's 3D mark (#503), the one Today's tile wears: a mode with no
     ladder, so the same object marks it wherever it is a door. */
  hostile: (s) => <StatIcon kind="hostile" size={s} />,
};

/** Demos on the boss stage, px: the stage's art at the house size. */
const BOSS_ART = 132;

/** The week (its start) the boss stage last welcomed Demos in. */
const SEEN_KEY = "ethos.practice.bossSeen";

/** The rounds the ladder reads: null while in flight, "failed" when the read did. */
type Rounds = GameRoundRow[] | null | "failed";

/** Whether this week's boss has a recording behind it, from the log's rows. */
function bossTaken(rows: RepRow[], week: Date): boolean {
  const since = week.getTime();
  return rows.some(
    (r) => (r.lesson_id ?? "").startsWith("boss:") && new Date(r.created_at).getTime() >= since
  );
}

export default function GamesPage() {
  const router = useRouter();
  /*
   * What this visit last read (#433, lib/held.ts): Practice opens on its
   * plan, its week and its ladders in the first frame and reads them
   * again behind that. Never while the server's page hydrates (`warm`),
   * which is also why the device's clock may be read here: a warm mount
   * has no server markup to disagree with (practice-tab-2).
   */
  const warm = useWarm();
  const heldRows = warm ? heldReps() : null;
  /* Null while the profile is in flight: a paying user must never see
     the wall flash and collapse into their grid (practice-tab-14). */
  const [premium, setPremium] = useState<boolean | null>(() => (warm ? heldPremium() : null));
  /** The plan is on screen: a later read is quiet, and its failure leaves it. */
  const planKnown = useRef(premium !== null);
  useStill(planKnown.current);
  /* The profile read failed: the slot says so and offers the retry,
     rather than showing a paying user the wall (#146). */
  const [planFailed, setPlanFailed] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall("Premium games"));
  /* Whether this week's boss has a recording behind it yet. Read once,
     from the same rows the log shows. Null while in flight; a failed
     read lands on false, and the card says nothing it cannot know. */
  const [bossDone, setBossDone] = useState<boolean | null>(() =>
    heldRows ? bossTaken(heldRows, weekStart()) : null
  );
  /* The same rows, for Hostile Q&A's allowance on its tile (#494): the
     line Today's tile says, counted from the takes of the last 24 hours.
     Null while in flight, so the line holds its place unseen. */
  const [rows, setRows] = useState<RepRow[] | null>(heldRows);
  /* Today on the device, for the game of the day; null until mounted. */
  const [now, setNow] = useState<Date | null>(() => (warm ? new Date() : null));
  /* Every game round the ladder reads (lib/client-data.ts). */
  const [rounds, setRounds] = useState<Rounds>(() => (warm ? heldGameRounds() : null));
  /* Practice says when its ladder is drawn (or failed), so what can wait
     for the screen does: Demos's idle clip, the tab swipe's neighbours,
     the worker's install (#508, lib/first-draw.ts). Left before the
     ladder lands, its leaving lets them go. */
  useLayoutEffect(() => expectDraw(), []);
  useEffect(() => {
    if (rounds !== null) markDrawn();
  }, [rounds]);
  /* Demos springs onto the stage on the first visit of the week and
     stands still after that: he appears at moments, never as furniture,
     and a tab you come back to is not a moment. Null until read, so he
     never pops in late on top of a still first frame. */
  const [arrive, setArrive] = useState<boolean | null>(null);

  function readPlan() {
    setPlanFailed(false);
    // A plan on screen stays there while it is read again (#433).
    if (!planKnown.current) setPremium(null);
    fetchProfile()
      .then((p) => {
        planKnown.current = true;
        setPremium(p?.premium ?? false);
      })
      .catch(() => {
        if (!planKnown.current) setPlanFailed(true);
      });
  }

  /** The week's rows and the ladders, read behind whatever is drawn. */
  function readWeek(week: Date) {
    fetchReps()
      .then((read) => {
        setBossDone(bossTaken(read, week));
        setRows(read);
      })
      // A failed first read lands on an open week; a failed later one
      // leaves what the screen says.
      .catch(() => setBossDone((was) => was ?? false));
    fetchGameRounds()
      .then(setRounds)
      .catch(() => setRounds((was) => (was === null ? "failed" : was)));
  }
  // Looked at again after a while, or back on the network: read again, quietly.
  useRevalidate(() => {
    /* The clock too, so Hostile's "Next in about N hours" and the
       week's topic are still true on a tab left open (#494). */
    setNow(new Date());
    readPlan();
    readWeek(weekStart());
  });

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
    setNow(new Date());

    readPlan();
    readWeek(week);
  }, []);

  const startLabel = bossDone ? "Again" : "Start";
  /* The week's topic is the stage's title (#494, one name and one face
     for the boss): read from the device's clock, so unknown until a
     cold open has mounted. Once the week is taken it is the topic the
     take stored (`bossCardTopic`, #494 review): a Spin or a pick takes
     another, and "Done this week" under the week's own named a take
     the Log's row says was on something else. */
  const topic = now ? bossCardTopic(rows, now) : null;
  /* Hostile Q&A's tile says what Today's says (lib/home-modes.ts): "3
     free today", "Next in about 5 hours", or on Premium the one rule. */
  const hostile = hostileTile({ now, premium, rows });

  const free = GAMES.filter((g) => !needsPremium(g));
  const paid = GAMES.filter(needsPremium);

  /* Today's free Premium game, once the device's day is known. */
  const today = now ? dayKey(now) : null;
  const dayGame = today ? gameById(gameOfTheDay(today)) : null;
  const dayGameState = dayGame
    ? dayState(dayGame, { dayKey: today, rows: rounds, now: now ?? undefined })
    : "unknown";
  /* What the card still sells a free account: every paid game but today's. */
  const rest = paid.filter((g) => g.id !== dayGame?.id);

  /** A game's ladder for its tile: "loading" while read, null when it failed. */
  function ladderOf(g: Game): TileLadder | "loading" | null {
    if (rounds === null || !now) return "loading";
    if (rounds === "failed") return null;
    return tileLadder(rounds, g.id, now);
  }

  /* A tap while the rounds are still being read waits for them (games
     review, finding 7): the link would otherwise leave the level off, and
     /rep only ever moves a level down, so a player with level 2 open
     played a level 1 round the ladder skips. Once read, the tap is
     played again, so a spent free game still meets its sheet. A read
     that fails goes to level 1, the one level that is always open. */
  const [pending, setPending] = useState<Game | null>(null);
  useEffect(() => {
    if (!pending || rounds === null || !now) return;
    setPending(null);
    play(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, rounds, now]);

  /** Into a round: a question not answered yet, at the level the ladder has open. */
  function go(g: Game) {
    if (ladderOf(g) === "loading") {
      setPending(g);
      return;
    }
    const rows = Array.isArray(rounds) ? rounds : [];
    const q = drawFresh(g, askedIdsFrom(lessonIdsNewestFirst(rows), g));
    const ladder = ladderOf(g);
    const level = ladder && ladder !== "loading" ? ladder.level : 1;
    router.push(repHref({ game: g.id, q: q.id, level }));
  }

  function play(g: Game) {
    if (needsPremium(g) && premium !== true) {
      // Today's free game, until its round is taken (an unknown day opens).
      if (premium === false && g.id === dayGame?.id && dayGameState !== "spent") return go(g);
      setPaywall(g.name);
      return;
    }
    go(g);
  }

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader title="Practice" />

      {/* The weekly headliner. The sky stage is the card itself, the
          screen's one lifted thing, with Demos standing in it holding
          his clock, "Weekly boss" over the week's topic on the left
          (#494). No time frame and no countdown (#486, Timothy: "they
          don't need to know any time frame"): the reading's clock runs
          on the reading. A week already taken says so in sage under the
          topic, the one state that is earned. Nothing on the stage is a tap; Start sits on
          the ground under it. */}
      <section aria-labelledby="boss-title" className="mt-5">
        {/* The house stage (components/ui/HeroStage.tsx): every tab's
            hero is this one, since the cohesion pass. */}
        <HeroStage
          eyebrow="Weekly boss"
          center
          /* The week's topic is the title (#494): "Weekly boss" names the
             boss here, on Today's tile, in the Log and on /boss, and the
             topic is what this week asks. It hangs in a box three lines
             tall at the topic's own size (`.boss-topic`), the most a
             topic takes at 320, so the stage holds one height whichever
             week it is and nothing moves when a cold open reads the
             clock. Under it, the line Today's tile says (lib/home-modes.ts
             bossTile): what the boss asks while the week is open, "Done
             this week" in sage once it is taken, so the stage, the tile
             and /boss are one face. Its slot is always there, so the
             eyebrow and the topic hold one y from the first frame to the
             week's read (#486 review): a no-break space while unknown. */
          line={
            <p
              className={`practice-week font-display mt-1 text-link font-bold ${bossDone !== null ? "arrive" : ""}`}
              data-done={bossDone || undefined}
              aria-hidden={bossDone === null ? true : undefined}
            >
              {bossDone === null ? "\u00a0" : bossDone ? BOSS_DONE_LINE : BOSS_ASK_LINE}
            </p>
          }
          artSize={BOSS_ART}
          art={
            arrive !== null && (
              <DemosArt
                pose="clock"
                size={BOSS_ART}
                pop={arrive}
                grounded
                halo={{ tone: "sky", kind: "stage" }}
              />
            )
          }
        >
          <h2 id="boss-title" className="boss-topic font-display mt-1.5">
            <span className={topic ? "arrive" : "invisible"}>
              {topic?.title ?? "\u00a0"}
            </span>
          </h2>
        </HeroStage>
        <Link
          href="/boss"
          aria-label={`${startLabel}: Weekly boss${topic ? `, ${topic.title}` : ""}`}
          className={`${ACTION_CLASS} relative mt-3`}
        >
          {startLabel}
        </Link>
        {/* The door to every boss and round you have played (#491): the
            Log's Games side (#486) had none. The quiet link under the
            one tap, as Retake stands under the results' way on and
            "Another topic" under Today's Start, so the boss keeps the
            screen's one tap and the scores are one tap from where games
            are chosen. Its 44pt box stands 12 into the section gap under
            it, so Free keeps the house's 28 from what is drawn. */}
        <div className="mt-1 -mb-3 flex justify-center">
          <Link
            href={GAMES_LOG_HREF}
            data-games-log-door
            className="press inline-flex min-h-11 items-center rounded-tap px-3 text-link text-stone-500"
          >
            {GAMES_LOG_LABEL}
          </Link>
        </div>
      </section>

      {/*
       * Free first, then Premium (26 Sep, Timothy: "free chillin above
       * them"). No blurbs: the name and the glyph say what the game is,
       * the ladder says where you are in it, and the game's own screen
       * says the rules.
       */}
      <div className="stagger mt-7">
        <h2 className="section-head">Free</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {free.map((g) => (
            <GameTile
              key={g.id}
              glyph={GLYPH[g.id](28)}
              name={g.name}
              ladder={ladderOf(g)}
              onPress={() => play(g)}
            />
          ))}
          {/* Free for every plan since #478, three rounds a day on the
              free plan, said on its own screen before the take. It has
              no ladder: its numbers are a model's read, never a rung. */}
          <GameTile
            glyph={GLYPH.hostile(28)}
            name="Hostile Q&A"
            href="/hostile"
            /* Its allowance in the line a game's ladder takes (#494),
               the words Today's tile says: what you can do today, in
               ink; at the cap, when the next opens, in stone, a date
               rather than a door. A no-break space until the plan,
               the rows and the clock are read. */
            note={hostile.line}
            noteQuiet={hostile.line.startsWith("Next in")}
          />
          {/* An input, not a game: the grid's one wide door. */}
          <WideTile glyph={<IconUpload size={28} />} name="Upload a recording" href="/upload" />
        </div>

        {/* The section's head names what is in it and its mark names the
            tier (D31, D04; #494): "Premium" over a PREMIUM chip said the
            tier twice on one row. The mark is a label at the head, never
            a filled tile. */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <h2 className="section-head">More games</h2>
          <PremiumMark variant="chip" />
        </div>
        {planFailed ? (
          <ErrorLine onRetry={readPlan} className="mt-3">
            Your plan didn&apos;t load.
          </ErrorLine>
        ) : premium === null ? (
          /* The free account's block at its landed height (principle
             8): a row of tiles with their allowance over the card, 312
             at 390. A subscriber's grid is shorter and lands with
             .arrive. */
          <div aria-hidden className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton rounded="rounded-card" className="h-[146px]" />
              <Skeleton rounded="rounded-card" className="h-[146px]" />
            </div>
            <Skeleton rounded="rounded-card" className="mt-3 h-[154px]" />
          </div>
        ) : premium ? (
          <div className="arrive mt-3 grid grid-cols-2 gap-3">
            {paid.map((g) => (
              <GameTile
                key={g.id}
                glyph={GLYPH[g.id](28)}
                name={g.name}
                ladder={ladderOf(g)}
                onPress={() => play(g)}
              />
            ))}
          </div>
        ) : (
          <div className="arrive mt-3">
            {/* What a free account can open today: the day's Premium
                game, a real door that says why. Spent, it says when it
                is free again and opens the paywall. */}
            <div className="grid grid-cols-2 gap-3">
              {dayGame && (
                <GameTile
                  glyph={GLYPH[dayGame.id](28)}
                  name={dayGame.name}
                  note={
                    dayGameState === "open"
                      ? "Free today"
                      : dayGameState === "spent"
                        ? (freeAgainLine(dayGame.id, now ?? undefined) ?? undefined)
                        : undefined
                  }
                  ladder={ladderOf(dayGame)}
                  paywall={dayGameState === "spent"}
                  onPress={() => play(dayGame)}
                  /* Alone in its row since Hostile left for Free (#478):
                     the grid's width, so no empty cell stands beside it. */
                  wide
                />
              )}
            </div>

            {/* One card, crisp (D31): the rest of Premium as rows that
                say what the levels are, tomorrow's free game, and one
                door. The rows are not doors; the Unlock is, as the
                secondary pill, so the boss's Start stays the screen's
                one tap. `premium-wall` is the hook the camera and
                check-sheet-touch open the paywall by. */}
            <div className="card mt-3 px-4 pb-4">
              <ul>
                {rest.map((g) => (
                  <li
                    key={g.id}
                    className="flex min-h-14 items-center gap-3 border-t border-hairline py-2 first:border-t-0"
                  >
                    {/* The tiles' own type over the tiles' own glyph: the
                        name as a tile names its game, what the levels are
                        in the ladder lines' grey, so the card reads as the
                        grid's next row and never as a second scale. */}
                    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center text-ink">
                      {GLYPH[g.id](28)}
                    </span>
                    <span className="min-w-0">
                      <span className="font-display block text-row text-ink">{g.name}</span>
                      <span className="block text-caption text-stone-500">
                        {PREMIUM_DEPTH[g.id] ?? g.blurb}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {/* A line of its own height, so the card never grows
                  when the day lands. */}
              <p className="mt-1 min-h-5 text-caption text-stone-500">
                {now ? tomorrowLine(now) : " "}
              </p>
              <button
                type="button"
                onClick={() => setPaywall("Premium games")}
                className="press premium-wall pill-on-raised font-display mt-3 flex min-h-11 w-full items-center justify-center rounded-tap border border-edge bg-surface px-6 text-body font-bold text-ink"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

/**
 * One game, as a tile (M6): its glyph bare in ink at 28 (E11), its
 * name, and for a game its ladder under them: the level with a pip per
 * count it takes, then its best. `note` is the tile's allowance ("Free
 * today") under the name. About 124 tall (a note
 * adds its line), so nothing moves when the rounds arrive.
 */
function GameTile({
  glyph,
  name,
  href,
  onPress,
  note,
  noteQuiet = false,
  ladder,
  paywall = false,
  wide = false,
}: {
  glyph: ReactNode;
  name: string;
  href?: string;
  onPress?: () => void;
  /** The allowance, under the name ("Free today", "3 free today"). */
  note?: string;
  /** The allowance is a date, not a door ("Next in about 5 hours"): stone, as a spent game's is. */
  noteQuiet?: boolean;
  /** A game's ladder; "loading" holds its place; absent or null draws none. */
  ladder?: TileLadder | "loading" | null;
  /** The tap opens the paywall. */
  paywall?: boolean;
  /** The grid's whole width: a tile alone in its row (#478). */
  wide?: boolean;
}) {
  const lad = ladder && ladder !== "loading" ? ladder : null;
  const inner = (
    <>
      {/* The bare glyph in ink, no tile of its own (E11); sage once
          the game is mastered, which is earned. */}
      <span
        aria-hidden
        className={`flex size-7 shrink-0 items-center justify-center ${lad?.mastered ? "text-sage-600" : "text-ink"}`}
      >
        {glyph}
      </span>
      <span className="font-display block pt-2.5 text-row text-ink">{name}</span>
      {/* The allowance, under the name it is about, in ink so it reads
          before the ladder's grey: what you can do today comes first.
          Spent, it steps back to stone: it is a date, not a door. In the
          body face, so it never reads as a second line of the name. */}
      {note && (
        <span
          className={`arrive mt-0.5 block text-caption font-semibold ${paywall || noteQuiet ? "text-stone-500" : "text-ink"}`}
        >
          {note}
        </span>
      )}
      {lad && <LadderLines ladder={lad} />}
    </>
  );
  const cls = `game-card card flex min-h-[124px] flex-col p-3 text-left${wide ? " col-span-2" : ""}`;
  return href ? (
    <Link href={href} className={`press ${cls}`}>
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onPress}
      aria-haspopup={paywall ? "dialog" : undefined}
      className={`press ${cls}`}
    >
      {inner}
    </button>
  );
}

/**
 * The ladder's two lines: "Level 2" with its dots (sage counted, the
 * level meter's track not yet), or "Mastered" in their place; then the best. The dots are
 * pictures; the sentence beside them is what a screen reader hears.
 * Round and unoutlined since #494: two 8px squares in a 1px outline on
 * sand read as a font's missing-glyph boxes.
 */
function LadderLines({ ladder }: { ladder: TileLadder }) {
  return (
    <span className="arrive mt-1.5 block">
      <span className="flex items-center gap-2">
        <span className="text-caption tabular-nums text-stone-500">Level {ladder.level}</span>
        {ladder.mastered ? (
          <span className="text-caption font-semibold text-sage-700">Mastered</span>
        ) : (
          <>
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: ladder.of }, (_, i) => (
                <span
                  key={i}
                  data-counted={i < ladder.counted || undefined}
                  className={`ladder-dot ${i < ladder.counted ? "bg-sage-600" : ""}`}
                />
              ))}
            </span>
            <span className="sr-only">
              {ladder.counted} of {ladder.of} counted
            </span>
          </>
        )}
      </span>
      {/* The best in the plaque's grammar at a tile's size (BestPlaque):
          the cup gold and bare, the number set apart in sage, since a
          best is earned. Its line is always there, so a tile with a best
          and one without stand the same height. A screen reader hears
          the one sentence. */}
      {ladder.bestParts ? (
        <span className="tile-best">
          <span className="sr-only">{ladder.best}</span>
          <span aria-hidden className="tile-best-cup">
            <StatIcon kind="trophy" size={18} />
          </span>
          <span aria-hidden className="min-w-0 truncate">
            <span className="tile-best-value">{ladder.bestParts.value}</span> {ladder.bestParts.rest}
          </span>
        </span>
      ) : (
        <span aria-hidden className="tile-best" />
      )}
    </span>
  );
}

/**
 * A door the width of the grid, for the one input that is not a game
 * (Upload, since #478; Hostile Q&A was this row on a Premium account):
 * its glyph, its name, the row's chevron.
 */
function WideTile({ glyph, name, href }: { glyph: ReactNode; name: string; href: string }) {
  return (
    <Link href={href} className="press game-card card col-span-2 flex min-h-14 items-center gap-3 px-3 py-2">
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center text-ink">
        {glyph}
      </span>
      <span className="font-display min-w-0 flex-1 text-row text-ink">{name}</span>
      <Disclosure />
    </Link>
  );
}
