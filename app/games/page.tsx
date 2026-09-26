"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  IconBoss,
  IconBubble,
  IconGauge,
  IconMic,
  IconUpload,
} from "@/components/Icon";
import { DemosArt } from "@/components/DemosArt";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { draw, GAMES, needsPremium, type Game } from "@/lib/games";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * Practice, the tab that was Tools (DECISIONS #157, #184, #292, #294).
 *
 * The page is a headliner and a list of doors. The 16 Sep review
 * (#292) found the list unreadable to a cold user, and each of its
 * points is answered in the markup below rather than argued with:
 *
 *  - ONE affordance. Every row ends in the same arrow, so "this
 *    navigates" is said once and the same way. It used to be an XP
 *    pill on some rows, an arrow on others and nothing on Interview,
 *    which made the one free game look like the dead row.
 *  - PREMIUM SAYS WHERE THE TAP GOES. A premium row carries the plum
 *    chip at its right edge, beside the arrow, in place of the word
 *    beside the title that read as a badge. No padlock and no dimming
 *    (#200, #280: the mark is a door, and a dimmed row is a disabled
 *    row, which would be a lie because the tap works): the chip names
 *    the destination.
 *  - No multipliers on the rows. "×2 XP" was a multiple of an unknown
 *    base; the game's own screen still pays and says what it pays.
 *  - Real glyphs in the tiles, at one weight, from the icon set.
 *  - Copy a first-timer can read: no "90s", "answered cold", "same
 *    engine" or "more doors".
 *  - Sections that hold: Games, with Hostile Q&A where it belongs, and
 *    "Bring your own" for the one row that is an input, not a
 *    challenge.
 *  - The boss card is the one lifted card and carries the screen's one
 *    terracotta tap, in place of an outlined card whose outline meant
 *    "featured" here and "selected" elsewhere. It also has state: days
 *    left in the week, and whether it was taken this week.
 *
 * The tab was renamed Practice in #294, on Timothy's call.
 *
 * Colour (the tabs' colour pass, after "pop with colour"): the boss
 * card is a stage in the introduction's sky, with the full-body clock
 * pose standing in it, and every game has its own picture-tone tile so
 * the list reads as four things to play. Picture colour only: the tap
 * stays terracotta, the chip stays the only plum, and no tile is a
 * trait tone, because no game here trains one trait and a trait's
 * colour means that trait everywhere else in the app.
 */
const GLYPH: Record<string, ReactNode> = {
  qa: <IconBubble size={22} />,
  rush: <IconGauge size={22} />,
  interview: <IconMic size={22} />,
};

/* Each game's tile tone (globals.css, `.tone-*` and "practice (/games)").
   Mint, sun and sky from the introduction; Hostile Q&A stands in the
   hot seat, a charcoal tile with a light shield (not gold: gold on black
   reads as a Pro badge beside a plum chip), since the fourth pastel
   (coral) is his coat and in terracotta's family. Nothing blue or violet
   sits beside a plum chip: sky is on Interview, the free row. */
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
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  /* Whether this week's boss has a recording behind it yet. Read once,
     from the same rows the log shows; a failed read leaves it unknown
     and the card says "days left", which is true either way. */
  const [bossDone, setBossDone] = useState(false);
  /* Demos springs onto the stage on the first visit of the week and
     stands still after that: he appears at moments, never as furniture,
     and a tab you come back to is not a moment. Null until read, so he
     never pops in late on top of a still first frame. */
  const [arrive, setArrive] = useState<boolean | null>(null);

  useEffect(() => {
    const week = weekStart().toISOString();
    let first = true;
    try {
      first = localStorage.getItem(SEEN_KEY) !== week;
      localStorage.setItem(SEEN_KEY, week);
    } catch {
      /* No storage: treat every visit as the first. */
    }
    setArrive(first);

    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
    fetchReps()
      .then((rows) => {
        const since = weekStart().getTime();
        setBossDone(
          rows.some(
            (r) =>
              (r.lesson_id ?? "").startsWith("boss:") &&
              new Date(r.created_at).getTime() >= since
          )
        );
      })
      .catch(() => {});
  }, []);

  const daysLeft = Math.max(
    1,
    7 - Math.floor((Date.now() - weekStart().getTime()) / DAY_MS)
  );

  function play(g: Game) {
    if (needsPremium(g) && !premium) {
      setPaywall(`${g.name} · premium mods`);
      return;
    }
    router.push(repHref({ game: g.id, q: draw(g).id }));
  }

  return (
    <main className="px-5 pb-22 pt-7">
      <h1 className="font-display text-[24px] font-extrabold leading-tight">
        Practice
      </h1>

      {/* The weekly headliner: the one lifted card and the one tap. Its
          top is a stage in sky, Demos standing in it with his clock (the
          boss is timed), the name and the week's state on the left. The
          state is a label, not a chip: nothing on the stage is a tap. */}
      <section className="elev-2 mt-4 rounded-sheet border border-card-edge bg-raised p-2">
        <div className="intro-stage tone-sky practice-stage h-[140px]">
          <div className="relative z-[2] flex h-full max-w-[60%] flex-col p-4">
            <div className="label-data practice-stage-ink">This week&apos;s boss</div>
            <div className="font-display mt-2 text-[26px] font-extrabold leading-[1.1]">
              Cold Topic
            </div>
            <span className="practice-week label-micro mt-auto" data-done={bossDone || undefined}>
              {bossDone
                ? "Done this week"
                : daysLeft === 1
                  ? "Last day"
                  : `${daysLeft} days left`}
            </span>
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
        <div className="px-3 pb-3 pt-4">
          <p className="text-body text-stone-500">
            A topic you haven&apos;t studied. 4 minutes to read, 90 seconds
            to explain, fact-checked.
          </p>
          <Link href="/boss" className={`${ACTION_CLASS} mt-4`}>
            {bossDone ? "Take it again" : "Take it on"}
          </Link>
        </div>
      </section>

      {/* One staggered column (#242): eyebrow, four games, eyebrow, one
          door, each the next thing you read. */}
      <div className="stagger mt-7">
        <div className="label-data pb-3">Games</div>
        {GAMES.map((g) => (
          <Row
            key={g.id}
            glyph={GLYPH[g.id]}
            tile={TILE[g.id]}
            name={g.name}
            blurb={g.blurb}
            premium={needsPremium(g) && !premium}
            onPress={() => play(g)}
          />
        ))}
        {/* One a week is free, and the cap used to be unmarked: you found
            out by being refused (#280). The chip says where the tap goes. */}
        <Row
          glyph={<IconBoss size={22} />}
          tile="game-tile-seat"
          name="Hostile Q&A"
          blurb="Demos interrogates your take. Two questions, no notes."
          premium={!premium}
          href="/hostile"
          last
        />

        <div className="label-data mt-7 pb-3">Bring your own</div>
        <Row
          glyph={<IconUpload size={22} />}
          tile="game-tile-plain"
          name="Upload a recording"
          blurb="A real meeting or a voice memo, scored the same way."
          href="/upload"
          last
        />
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

/**
 * One door. A glyph tile in its tone, the name, one line, and at the right edge the
 * same arrow on every row, with the plum chip before it where the tap
 * leads to Premium first.
 */
function Row({
  glyph,
  tile,
  name,
  blurb,
  premium = false,
  href,
  onPress,
  last = false,
}: {
  glyph: ReactNode;
  /** The tile's tone class: a `.tone-*`, or one of the two named tiles. */
  tile: string;
  name: string;
  blurb: string;
  premium?: boolean;
  href?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={`game-tile ${tile}`}
      >
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[14px] font-bold">{name}</span>
        <span className="mt-0.5 block text-caption text-stone-500">{blurb}</span>
      </span>
      {premium && <PremiumMark variant="chip" />}
      <span aria-hidden className="shrink-0 text-stone-400">
        →
      </span>
    </>
  );
  const cls = `press flex w-full items-center gap-3.5 border-t border-hairline py-3 text-left ${
    last ? "border-b" : ""
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onPress} className={cls}>
      {inner}
    </button>
  );
}
