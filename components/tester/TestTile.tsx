"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { keyClass, SendNumber } from "@/components/tester/SendNumber";
import { TesterChip } from "@/components/tester/TesterChip";
import { CONSENT, MATCH_COPY, PAUSED_COPY, TEST, TEST_COPY } from "@/content/tester";
import type { RepRow, RepSpine } from "@/lib/client-data";
import { isCurrentTester, showsMatchCheck } from "@/lib/tester";
import { testAsk, testRoad, zoneDayKey, type TestAsk, type TodayAnswer } from "@/lib/tester-days";
import {
  fetchMatch,
  markLit,
  readLit,
  readSent,
  useTesterNumber,
  type TestPresence,
} from "@/lib/tester-client";

/** Today's history as the tile reads it: in flight, failed, or landed. */
export type TileRecordings = "loading" | "failed" | { reps: RepRow[]; spine: RepSpine[] };

/**
 * The test tile on Today (#402), for a tester from the test's first day
 * to a week after its last: the Tester mark and their tester number, the
 * days spoken out of 14, the fourteen days as a road (sage where they
 * spoke, today ringed in ink, sand for a day gone by, outlined ahead) with
 * the window's dates at its ends, and one ask, the first that applies:
 * agree again (paused), send the number to Timothy, speak today, answer
 * today's "Did 665 feel right?", or the day is done. After the 12th the
 * road stands still and the ask says the test is over.
 *
 * The ask sits right under the mark and the number, above the count and
 * the road: on an iPhone the floating nav stands 34px higher than in a
 * desktop browser (the home indicator's inset), and the tile's last row
 * is under it when Today opens. "Send Timothy your tester number." is
 * the one line that must never be there.
 *
 * The bento's flat surface step, not a card: the practice card above it
 * keeps the screen's one lift and its one tap. One fixed
 * height, 208px, in every state, skeleton included, so nothing below it
 * moves when the reads land (DESIGN rule 8). It mounts only on a device
 * holding the tester hint (lib/tester-client.ts useTestPresence), so
 * nobody else's Today reads anything new.
 */
export function TestTile({
  presence,
  recordings,
  className = "",
}: {
  presence: TestPresence;
  recordings: TileRecordings;
  className?: string;
}) {
  const number = useTesterNumber();
  /* Whether this number was sent from this device; read before paint
     once the number is known, so the ask never flashes Send. */
  const [sentFlag, setSentFlag] = useState(false);
  useLayoutEffect(() => {
    if (number) setSentFlag(readSent(number));
  }, [number]);
  /* For 2s after a Send the ask stays and the key says Sent; then the
     day's ask arrives. */
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), 2000);
    return () => clearTimeout(t);
  }, [held]);
  const sent = sentFlag && !held;

  const row = typeof presence.tester === "object" ? presence.tester : null;
  const spine = typeof recordings === "object" ? recordings.spine : null;
  const road = useMemo(
    () =>
      testRoad({
        today: presence.today,
        joined: row?.created_at ?? null,
        spoken: recordings === "failed" ? null : (spine ?? []).map((r) => r.created_at),
        zone: presence.zone,
      }),
    [presence.today, presence.zone, row?.created_at, recordings, spine]
  );

  /* Today's question after the score: the newest of today's recordings
     the question is asked about, and whether it was answered. */
  const target = useMemo(() => {
    if (!row || !isCurrentTester(row) || presence.phase !== "on" || road.spokenToday !== true) return null;
    if (typeof recordings !== "object") return null;
    for (let i = recordings.reps.length - 1; i >= 0; i--) {
      const rep = recordings.reps[i];
      if (zoneDayKey(rep.created_at, presence.zone) !== presence.today) continue;
      if (showsMatchCheck({ tester: row, scorable: rep.ethos_index !== null, clientId: rep.client_id })) return rep;
    }
    return null;
  }, [row, presence.phase, presence.today, presence.zone, road.spokenToday, recordings]);
  const [given, setGiven] = useState<{ key: string; answer: TodayAnswer } | null>(null);
  useEffect(() => {
    if (!target?.client_id) return;
    const key = target.client_id;
    let live = true;
    fetchMatch(key)
      .then((g) => {
        if (!live) return;
        setGiven({
          key,
          answer: g?.answer ? { state: "answered" } : { state: "open", repId: target.id, index: target.ethos_index },
        });
      })
      .catch(() => {
        if (live) setGiven({ key, answer: { state: "failed" } });
      });
    return () => {
      live = false;
    };
  }, [target?.client_id, target?.id, target?.ethos_index]);
  /* A read about another recording, or none yet, is still loading. */
  const answer: TodayAnswer = !target
    ? { state: "none" }
    : given && given.key === target.client_id
      ? given.answer
      : { state: "loading" };

  const ready = recordings !== "loading" && presence.tester !== "loading" && number !== undefined;
  const ask = testAsk({
    phase: presence.phase === "after" ? "after" : presence.phase === "before" ? "before" : "on",
    day: presence.day,
    tester: presence.tester,
    number: number ?? null,
    sent,
    spokenToday: road.spokenToday,
    answer,
  });

  /* Today's slot fills once per day on this device, the first time the
     tile lands with it spoken: the recording just made arriving on the
     road. Decided once, as the body lands. */
  const [land, setLand] = useState<boolean | null>(null);
  const firstKind = useRef<TestAsk["kind"] | null>(null);
  useLayoutEffect(() => {
    if (!ready || land !== null) return;
    firstKind.current = ask.kind;
    const lands = road.spokenToday === true && readLit() !== presence.today;
    setLand(lands);
    if (lands) markLit(presence.today);
  }, [ready, land, ask.kind, road.spokenToday, presence.today]);

  /* Focus across the ask's change after a Send: the key that held it
     unmounts when the next ask arrives, and focus fell to <body>,
     throwing a keyboard or VoiceOver user back to the top. It moves to
     the new ask's row, which reads it out. Only after a tap here, never
     when a read lands. */
  const askRow = useRef<HTMLDivElement>(null);
  const shownKind = useRef<TestAsk["kind"]>(ask.kind);
  const tapped = useRef(false);
  useLayoutEffect(() => {
    const was = shownKind.current;
    shownKind.current = ask.kind;
    if (was === ask.kind || was !== "send" || !tapped.current) return;
    tapped.current = false;
    const active = document.activeElement;
    const tile = askRow.current?.closest("[data-test]");
    if (!active || active === document.body || tile?.contains(active)) askRow.current?.focus();
  }, [ask.kind]);

  return (
    <section aria-label={CONSENT.title} data-test className={`home-tile ${className}`}>
      <div className="flex h-[22px] items-center justify-between gap-3">
        <TesterChip />
        {number ? (
          <span className="fade-in font-display text-row tabular-nums text-stone-500">
            <span className="sr-only">Tester number </span>
            {number}
          </span>
        ) : (
          <span className="min-w-[9ch]" />
        )}
      </div>
      {ready ? (
        <div key="ready" className="arrive">
          {/* Focusable only from code (after a Send); the global
              :focus-visible ring shows where focus went for a keyboard,
              never for a tap. */}
          <div ref={askRow} tabIndex={-1} data-test-ask className="-mx-2 mt-2 min-h-11 rounded-control px-2">
            <AskRow
              key={ask.kind}
              ask={ask}
              number={number ?? null}
              className={firstKind.current !== null && ask.kind !== firstKind.current ? "arrive" : ""}
              onSent={() => {
                tapped.current = true;
                setSentFlag(true);
                setHeld(true);
              }}
            />
          </div>
          <TestNum n={road.spoken} />
          <div aria-hidden className="test-road mt-3">
            {road.slots.map((s) => {
              const landing = land === true && s.today && s.state === "spoken";
              return (
                <span
                  key={s.key}
                  className="home-day test-day"
                  data-state={landing ? "landing" : s.state}
                  data-today={s.today || undefined}
                >
                  {landing && <span className="test-day-fill star-land" style={{ "--land-after": "200ms" } as CSSProperties} />}
                </span>
              );
            })}
          </div>
          <Ends />
        </div>
      ) : (
        <SkeletonRegion label="Loading your test days">
          <span data-test-ask className="mt-2 flex min-h-11 items-center">
            <Skeleton className="h-3 w-48" />
          </span>
          <span className="mt-3 flex h-9 items-center">
            <Skeleton className="h-7 w-24" />
          </span>
          <span className="mt-3 flex h-6">
            <Skeleton className="h-6 w-full" />
          </span>
          <Ends />
        </SkeletonRegion>
      )}
    </section>
  );
}

/** Days spoken out of the test's, on the bento's number line ("1 of 14 days spoken"). Unknown is a dash. */
function TestNum({ n }: { n: number | null }) {
  const shown = n === null ? "–" : String(n);
  return (
    <p
      className="home-num-line font-display mt-3 tabular-nums"
      style={{ "--num-em": shown.length * 0.58, "--unit-em": TEST_COPY.unit.length * 0.52 } as CSSProperties}
    >
      <span className={`home-num ${n === null ? "text-stone-400" : ""}`}>{shown}</span>
      <span className="home-unit">{TEST_COPY.unit}</span>
    </p>
  );
}

/** The window's first and last days under the road's ends, in the phone's words ("30 Oct", "12 Nov"). */
function Ends() {
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  return (
    <div aria-hidden className="mt-1.5 flex h-3 items-center justify-between font-display text-suffix text-stone-400">
      <span>{fmt(TEST.first)}</span>
      <span>{fmt(TEST.last)}</span>
    </div>
  );
}

function AskRow({
  ask,
  number,
  className,
  onSent,
}: {
  ask: TestAsk;
  number: string | null;
  className: string;
  onSent: () => void;
}) {
  const line = (text: string) => (
    <div className={`flex min-h-11 items-center ${className}`}>
      <p className="text-body leading-snug text-pretty text-stone-500">{text}</p>
    </div>
  );
  switch (ask.kind) {
    case "wait":
      return (
        <div className={`flex min-h-11 items-center ${className}`}>
          <Skeleton className="h-3 w-48" />
        </div>
      );
    case "none":
      return <div className="min-h-11" />;
    case "paused":
      /* Ranked above every other ask (nothing is kept until they agree),
         so it speaks in the tile's grammar: the line in ink and a key,
         never quieter than Send. TesterPaused stays the results' and the
         Log's way of saying it. */
      return (
        <div className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
          <p className="text-body leading-snug text-pretty font-semibold text-ink">{PAUSED_COPY.line}</p>
          <Link href="/tester?from=open&back=%2F" className={keyClass("tile")}>
            {PAUSED_COPY.action}
          </Link>
        </div>
      );
    case "send":
      return (
        <div className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
          <p className="text-body leading-snug text-pretty font-semibold text-ink">{TEST_COPY.ask.send}</p>
          {number && <SendNumber number={number} surface="tile" onSent={onSent} />}
        </div>
      );
    case "record":
      return line(TEST_COPY.ask.record);
    case "answer":
      /* The day's one open action, in Send's grammar: the line in ink and
         the key on the right, so neither ask is quieter than the other. */
      return (
        <div className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
          <p className="text-body leading-snug text-pretty font-semibold text-ink">{MATCH_COPY.questionFor(ask.index)}</p>
          <Link href={`/rep/${ask.repId}?from=today#match`} className={keyClass("tile")}>
            {TEST_COPY.ask.answer}
          </Link>
        </div>
      );
    case "done":
      return line(TEST_COPY.ask.done(ask.day));
    case "last":
      return line(TEST_COPY.ask.last);
    case "over":
      return line(TEST_COPY.ask.over);
    case "soon":
      return line(TEST_COPY.ask.soon);
  }
}
