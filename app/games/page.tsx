"use client";

import Image from "next/image";
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
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { draw, GAMES, needsPremium, type Game } from "@/lib/games";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * Tools (DECISIONS #157, #184, #292).
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
 * The tab keeps its name; renaming it ripples through the bar, the
 * transitions and the tests, and is a call for Timothy.
 */
const GLYPH: Record<string, ReactNode> = {
  qa: <IconBubble size={20} />,
  rush: <IconGauge size={20} />,
  interview: <IconMic size={20} />,
};

const DAY_MS = 86_400_000;

export default function GamesPage() {
  const router = useRouter();
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  /* Whether this week's boss has a recording behind it yet. Read once,
     from the same rows the log shows; a failed read leaves it unknown
     and the card says "days left", which is true either way. */
  const [bossDone, setBossDone] = useState(false);

  useEffect(() => {
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
        Tools
      </h1>

      {/* The weekly headliner: the one lifted card and the one tap. */}
      <section className="elev-2 mt-4 rounded-sheet border border-card-edge bg-raised p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="label-data">This week&apos;s boss</div>
          <div className={`label-micro ${bossDone ? "!text-sage-700" : ""}`}>
            {bossDone
              ? "Done this week"
              : daysLeft === 1
                ? "Last day"
                : `${daysLeft} days left`}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Image
            src="/demos-practice.webp"
            alt=""
            width={92}
            height={92}
            className="demos w-[56px] shrink-0"
          />
          <div className="min-w-0">
            <div className="font-display text-[19px] font-bold leading-snug">
              Cold Topic
            </div>
            <p className="mt-1 text-body text-stone-500">
              A topic you haven&apos;t studied. 4 minutes to read, 90 seconds
              to explain, fact-checked.
            </p>
          </div>
        </div>
        <Link href="/boss" className={`${ACTION_CLASS} mt-5`}>
          {bossDone ? "Take it again" : "Take it on"}
        </Link>
      </section>

      {/* One staggered column (#242): eyebrow, four games, eyebrow, one
          door, each the next thing you read. */}
      <div className="stagger mt-7">
        <div className="label-data pb-3">Games</div>
        {GAMES.map((g) => (
          <Row
            key={g.id}
            glyph={GLYPH[g.id]}
            name={g.name}
            blurb={g.blurb}
            premium={needsPremium(g) && !premium}
            onPress={() => play(g)}
          />
        ))}
        {/* One a week is free, and the cap used to be unmarked: you found
            out by being refused (#280). The chip says where the tap goes. */}
        <Row
          glyph={<IconBoss size={20} />}
          name="Hostile Q&A"
          blurb="Demos interrogates your take. Two questions, no notes."
          premium={!premium}
          href="/hostile"
          last
        />

        <div className="label-data mt-7 pb-3">Bring your own</div>
        <Row
          glyph={<IconUpload size={20} />}
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
 * One door. A glyph tile, the name, one line, and at the right edge the
 * same arrow on every row, with the plum chip before it where the tap
 * leads to Premium first.
 */
function Row({
  glyph,
  name,
  blurb,
  premium = false,
  href,
  onPress,
  last = false,
}: {
  glyph: ReactNode;
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
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control border border-edge bg-surface text-stone-500"
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
