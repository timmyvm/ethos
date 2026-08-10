"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Paywall } from "@/components/Paywall";
import { LexiconFlash } from "@/components/LexiconFlash";
import { ShareCard } from "@/components/ShareCard";
import { achievements } from "@/lib/achievements";
import {
  fetchLexicon,
  fetchReps,
  fetchXp,
  type LexiconRow,
  type RepRow,
} from "@/lib/client-data";
import { syncFreezes } from "@/lib/freeze-sync";
import { levelFromXp } from "@/lib/level";
import {
  computeStreak,
  MAX_EQUIPPED_FREEZES,
  type StreakState,
} from "@/lib/streak";
import { supabaseBrowser } from "@/lib/supabase-browser";

const FREE_LEXICON = 3; // free tier gets today's swap, not the archive

const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

export default function YouPage() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [lexicon, setLexicon] = useState<LexiconRow[]>([]);
  const [xp, setXp] = useState({ total: 0, week: 0 });
  const [anon, setAnon] = useState<boolean | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [flashing, setFlashing] = useState(false);
  const [freezes, setFreezes] = useState({ equipped: 0, used: 0 });

  useEffect(() => {
    fetchReps()
      .then(async (rows) => {
        setReps(rows);
        const dates = rows.map((r) => new Date(r.created_at));
        setStreak(computeStreak(dates));
        try {
          const sync = await syncFreezes(dates);
          setStreak(sync.streak);
          setFreezes({
            equipped: sync.equipped,
            used: sync.frozenDays.length,
          });
        } catch {}
      })
      .catch(() => {});
    fetchLexicon().then(setLexicon).catch(() => {});
    fetchXp().then(setXp).catch(() => {});
    const db = supabaseBrowser();
    db?.auth
      .getUser()
      .then(({ data }) => setAnon(data.user?.is_anonymous ?? null))
      .catch(() => setAnon(null));
  }, []);

  const level = levelFromXp(xp.total);
  const toNextFreeze = 7 - (streak.longest % 7);

  // "Save your progress" gate — appears only after there IS progress
  // (DECISIONS #15: never before the first rep).
  const showGate = anon === true && reps.length >= 1;

  async function saveProgress(e: React.FormEvent) {
    e.preventDefault();
    const db = supabaseBrowser();
    if (!db || !email) return;
    // Links the email to the SAME anonymous user — history is kept.
    const { error } = await db.auth.updateUser({ email });
    if (!error) setSent(true);
  }

  return (
    <main className="px-5 pb-24 pt-7">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">You</h1>
        <Link href="/settings" className="text-[13px] font-semibold text-stone-500">
          Settings
        </Link>
      </div>

      <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-5">
        <div className="flex items-center gap-4">
          <Image
            src="/demos-listening.webp"
            alt=""
            width={56}
            height={56}
            className="demos w-14 shrink-0"
          />
          <div className="flex-1">
            <div className="label-data">Level</div>
            <div className="font-display text-[30px] font-bold leading-none">
              {level.level}
            </div>
          </div>
          <div className="text-right">
            <div className="label-data">Total XP</div>
            <div className="font-display text-[22px] font-bold">
              {xp.total}
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{
              width: `${(level.intoLevel / level.forNext) * 100}%`,
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="label-data">
            {level.intoLevel}/{level.forNext} to level {level.level + 1}
          </span>
          <span className="label-data">XP = reps, never money</span>
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <Stat label="Streak" value={String(streak.current)} note="days" />
        <Stat label="Longest" value={String(streak.longest)} note="days" />
        <Stat label="This week" value={String(xp.week)} note="xp" />
      </div>

      {/* Freezes — earned by streak, never bought (non-negotiable). */}
      <div className="label-data mt-7">Streak freezes</div>
      <div className="mt-2 rounded-[18px] border border-hairline bg-surface lift p-5">
        <div className="flex items-center gap-2">
          {Array.from({ length: MAX_EQUIPPED_FREEZES }).map((_, i) => (
            <span
              key={i}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] ${
                i < freezes.equipped
                  ? "bg-amber-50 text-amber-500"
                  : "bg-sand text-stone-300"
              }`}
              aria-label={i < freezes.equipped ? "freeze ready" : "empty slot"}
            >
              ❄
            </span>
          ))}
          <div className="ml-2 flex-1 text-[13px] leading-relaxed text-stone-500">
            {freezes.equipped > 0
              ? "Miss a day and one of these covers it automatically."
              : `${toNextFreeze} more consecutive day${toNextFreeze === 1 ? "" : "s"} earns one.`}
          </div>
        </div>
        <p className="mt-3 border-t border-sand pt-3 text-[12.5px] leading-relaxed text-stone-500">
          One freeze per full week of streak, two maximum. Earned by
          speaking, never bought — and a frozen day keeps your streak
          without counting toward it.
          {freezes.used > 0 && (
            <>
              {" "}
              <span className="text-stone-600">
                {freezes.used} spent so far.
              </span>
            </>
          )}
        </p>
      </div>

      {/* Weekly league — the roster fills once there are other trainees. */}
      <div className="label-data mt-7">Weekly league</div>
      <div className="mt-2 rounded-[18px] border border-hairline bg-surface lift p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14.5px] font-semibold">Stone League</div>
            <div className="text-[12.5px] text-stone-500">
              Resets Monday · ranks effort, not scores
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[22px] font-bold">
              {xp.week}
            </div>
            <div className="label-data">your xp</div>
          </div>
        </div>
        <p className="mt-3 border-t border-sand pt-3 text-[12.5px] text-stone-500">
          Leagues open when there are 20 trainees to rank. Until then the
          only person to beat is last week&apos;s you.
        </p>
      </div>

      {/* Personal lexicon — the supply layer's archive (DECISIONS #12) */}
      <div className="label-data mt-7">Your lexicon</div>
      {lexicon.length === 0 ? (
        <p className="mt-2 text-[13px] text-stone-500">
          Every rep gives you one upgrade drawn from your own words. They
          collect here.
        </p>
      ) : (
        <>
          <div className="mt-2 space-y-2">
            {lexicon.slice(0, FREE_LEXICON).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-[18px] border border-hairline bg-surface lift px-4 py-3 text-[14px]"
              >
                <span className="text-stone-500 line-through">
                  {l.original}
                </span>
                <span aria-hidden className="text-stone-400">
                  →
                </span>
                <span className="font-semibold">{l.upgrade}</span>
              </div>
            ))}
          </div>
          {lexicon.length >= 3 && !flashing && (
            <button
              onClick={() => setFlashing(true)}
              className="press mt-2.5 w-full rounded-[18px] border border-black/10 bg-surface p-4 text-[13.5px] font-semibold lift"
            >
              Test yourself on these →
            </button>
          )}

          {flashing && (
            <div className="mt-2.5">
              <LexiconFlash
                lexicon={lexicon}
                onDone={() => setFlashing(false)}
              />
            </div>
          )}

          {lexicon.length > FREE_LEXICON && (
            <button
              onClick={() => setPaywall("Full lexicon · premium")}
              className="mt-2.5 w-full rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4 text-[13.5px] font-semibold"
            >
              {lexicon.length - FREE_LEXICON} more upgrade
              {lexicon.length - FREE_LEXICON === 1 ? "" : "s"} in your archive
            </button>
          )}
        </>
      )}

      {/* Badges — every one names the number that unlocked it. */}
      <div className="label-data mt-7">Earned</div>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {achievements(reps).map((a) => (
          <div
            key={a.id}
            className={`rounded-[18px] border p-4 ${
              a.earned
                ? "border-amber-500/30 bg-surface"
                : "border-hairline bg-surface opacity-60"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[13.5px] font-semibold">{a.name}</span>
              {a.earned && <span className="text-amber-500">●</span>}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-stone-500">
              {a.requirement}
            </p>
            {!a.earned && a.progress > 0 && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full bg-stone-400"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {reps.length >= 2 && (
        <>
          <div className="label-data mt-7">Day 1 vs now</div>
          <ShareCard reps={reps} />
        </>
      )}

      {showGate && (
        <div className="mt-7 rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-5">
          <div className="text-[14.5px] font-semibold">
            Save your progress
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
            {reps.length} rep{reps.length === 1 ? "" : "s"} and a{" "}
            {streak.current}-day streak live on this device. Add an email and
            they follow you anywhere.
          </p>
          {sent ? (
            <p className="mt-3 text-[13px] font-semibold text-terracotta-600">
              Check your inbox to confirm.
            </p>
          ) : (
            <form onSubmit={saveProgress} className="mt-3 flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="min-w-0 flex-1 rounded-[12px] border border-black/10 bg-surface px-3 py-2.5 text-[14px]"
              />
              <button
                type="submit"
                className="shrink-0 rounded-[12px] bg-terracotta-500 px-4 py-2.5 text-[14px] font-semibold text-cream"
              >
                Save
              </button>
            </form>
          )}
        </div>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-hairline bg-surface lift p-3.5">
      <div className="label-data">{label}</div>
      <div className="font-display text-[26px] font-bold leading-tight">
        {value}
      </div>
      <div className="text-[11.5px] text-stone-500">{note}</div>
    </div>
  );
}
