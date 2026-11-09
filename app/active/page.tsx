"use client";

import { useCallback, useEffect, useState } from "react";
import NotFound from "@/app/not-found";
import { IconFlame } from "@/components/Icon";
import { ErrorState } from "@/components/ui/ErrorState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ActiveRow, ActiveView, DayMark } from "@/lib/active";
import type { ClockSource, ClockView } from "@/lib/push-clock";
import { readFailure } from "@/lib/load";
import { sessionToken } from "@/lib/supabase-browser";
import { useHourLabel } from "@/lib/time-label";

/**
 * Who is active (#431): Timothy's page for watching whether testers come
 * back, and whether the reminders and the ready recorder help. Each
 * current tester as a row, the last fourteen days as a strip (recorded
 * in sage, opened without recording as an outline, nothing as the bare
 * trough), their streak and their reminder's hour; above them, each
 * day's count of who recorded and who only opened the app.
 *
 * Only the founder gets an answer (app/api/active: a confirmed address
 * on ADMIN_EMAILS, on the server); anyone else meets the app's own
 * Nothing here. Not on the tab bar and linked from nowhere: Timothy
 * types the address.
 */

type Load =
  | { kind: "loading" }
  | { kind: "ok"; view: ActiveView; clock: ClockView | null }
  | { kind: "none" }
  | { kind: "failed" };

/** The strip's grid: a 16px key column, then the fourteen days. */
const GRID = "grid grid-cols-[16px_repeat(14,minmax(0,1fr))] gap-x-[3px]";

const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const dateOf = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const short = (key: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(dateOf(key));

export default function ActivePage() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const token = await sessionToken();
      if (!token) return setLoad({ kind: "none" });
      const res = await fetch("/api/active", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 404) return setLoad({ kind: "none" });
      if (!res.ok) return setLoad({ kind: "failed" });
      const body = (await res.json()) as { view?: ActiveView; clock?: ClockView | null };
      setLoad(body.view ? { kind: "ok", view: body.view, clock: body.clock ?? null } : { kind: "failed" });
    } catch {
      setLoad({ kind: "failed" });
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  if (load.kind === "none") return <NotFound />;
  const failure = readFailure("Who is active");

  return (
    <main className="px-5 pb-10 pt-7">
      <ScreenHeader title="Active" dated back={{ href: "/", label: "Today" }} />
      {load.kind === "failed" ? (
        <ErrorState
          className="arrive mt-5"
          title={failure.title}
          body={typeof navigator !== "undefined" && navigator.onLine === false ? failure.body : "The server didn't answer."}
          onRetry={() => void read()}
        />
      ) : load.kind === "loading" ? (
        <ActiveSkeleton />
      ) : (
        <Active view={load.view} clock={load.clock} />
      )}
    </main>
  );
}

function Active({ view, clock }: { view: ActiveView; clock: ClockView | null }) {
  const watched = view.rows.filter((r) => !r.you).length;
  const today = view.totals[view.totals.length - 1];
  return (
    <div className="arrive">
      {/* Each day: who recorded, and who opened the app without recording. */}
      <section aria-labelledby="active-days" className="card mt-5 p-4">
        <h2 id="active-days" className="sr-only">
          Each day
        </h2>
        <div className="flex gap-8">
          <Stat value={today.recorded} label="Recorded today" mark="recorded" />
          <Stat value={today.opened} label="Opened only" mark="opened" />
        </div>
        <Totals view={view} scale={Math.max(1, ...view.totals.map((t) => t.recorded + t.opened))} />
      </section>

      <Clock clock={clock} />

      <section aria-labelledby="active-testers" className="mt-7">
        <div className="flex items-baseline justify-between pr-4">
          <h2 id="active-testers" className="font-display text-lead font-bold">
            Testers <span className="text-stone-400 tabular-nums">{watched}</span>
          </h2>
          <span aria-hidden className="flex gap-4">
            <span className="label-data w-10 text-right">Streak</span>
            <span className="label-data w-16 text-right">Reminder</span>
          </span>
        </div>
        <ul className="card mt-3 px-4">
          {view.rows.map((r) => (
            <TesterRow key={r.number} row={r} days={view.days} />
          ))}
        </ul>
        <Legend />
      </section>
    </div>
  );
}

const CALLER: Record<ClockSource["caller"], string> = {
  database: "Database",
  "cron-job.org": "cron-job.org",
  github: "GitHub",
  other: "Other",
};

/** "6:01 pm", or "Sun 6:01 pm" before today, on this device's clock. */
function tickTime(iso: string): string {
  const at = new Date(iso);
  const sameDay = at.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(undefined, {
    weekday: sameDay ? undefined : "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/**
 * The reminder clock (#430 review): each caller's last tick and how many
 * of the last 24 hours it reached, and a plain line when nothing ticked
 * in the last hour, because a chosen hour is only served by a tick inside
 * it. GitHub alone reached about one hour in six.
 */
function Clock({ clock }: { clock: ClockView | null }) {
  return (
    <section aria-labelledby="active-clock" className="mt-7">
      <h2 id="active-clock" className="font-display text-lead font-bold">
        Reminder clock
      </h2>
      <div className="card mt-3 px-4" role="status">
        {clock === null ? (
          <p className="py-3 text-body text-stone-500">The clock&apos;s record didn&apos;t load.</p>
        ) : (
          <>
            {!clock.alive && (
              <p className="border-b border-hairline py-3 text-body font-semibold last:border-b-0">
                {clock.sources.length === 0 ? "No tick in two days." : "No tick in the last hour."} Reminders are not
                going out on time.
              </p>
            )}
            {clock.sources.map((s) => (
              <div
                key={`${s.secret}:${s.caller}`}
                className="flex items-center justify-between gap-3 border-b border-hairline py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="font-display text-body font-bold">{CALLER[s.caller]}</div>
                  <div className="truncate text-caption text-stone-500">{s.secret}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-body font-bold tabular-nums">{tickTime(s.last)}</div>
                  <div className="text-caption text-stone-500 tabular-nums">{s.hours} of 24 hours</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label, mark }: { value: number; label: string; mark: DayMark }) {
  return (
    <div>
      <div className="font-display text-num-l tabular-nums">{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-caption text-stone-500">
        <span aria-hidden className="active-day h-2.5 w-2.5 shrink-0" data-mark={mark} />
        {label}
      </div>
    </div>
  );
}

/**
 * The fourteen days' totals: a column per day, recorded in sage at the
 * foot and opened only as an outline on it, the busiest day full height,
 * with both counts under it (the numbers are the record; the columns are
 * the shape) and the day's letter.
 */
function Totals({ view, scale }: { view: ActiveView; scale: number }) {
  const last = view.days.length - 1;
  return (
    <div className="mt-5">
      <div className={`${GRID} h-14 items-end`} aria-hidden>
        <span />
        {view.totals.map((t, i) => (
          <span key={view.days[i]} className="flex h-full flex-col justify-end gap-[2px]">
            {t.opened > 0 && (
              <span className="active-day block" data-mark="opened" style={{ height: `${(t.opened / scale) * 100}%` }} />
            )}
            {t.recorded > 0 && (
              <span className="active-day block" data-mark="recorded" style={{ height: `${(t.recorded / scale) * 100}%` }} />
            )}
          </span>
        ))}
      </div>
      <table className="mt-2 w-full">
        <caption className="sr-only">Testers who recorded, and who opened only, each day</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Day</th>
            {view.days.map((d) => (
              <th key={d} scope="col">
                {short(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["recorded", "opened"] as const).map((k) => (
            <tr key={k} className={GRID}>
              <th scope="row" className="flex items-center">
                <span className="sr-only">{k === "recorded" ? "Recorded" : "Opened only"}</span>
                <span aria-hidden className="active-day h-2.5 w-2.5" data-mark={k} />
              </th>
              {view.totals.map((t, i) => (
                <td
                  key={view.days[i]}
                  className={`text-center font-display text-caption tabular-nums ${
                    k === "recorded" ? "font-bold text-ink" : "font-semibold text-stone-500"
                  } ${t[k] === 0 ? "text-stone-300" : ""}`}
                >
                  {t[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`${GRID} mt-1.5`} aria-hidden>
        <span />
        {view.days.map((d, i) => (
          <span
            key={d}
            className={`text-center font-display text-suffix ${
              i === last ? "font-extrabold text-ink" : "font-semibold text-stone-400"
            }`}
          >
            {DAY_LETTER[dateOf(d).getDay()]}
          </span>
        ))}
      </div>
      <div className={`${GRID} mt-1`} aria-hidden>
        <span />
        <span className="col-span-7 text-caption text-stone-400">{short(view.days[0])}</span>
        <span className="col-span-7 text-right text-caption text-stone-400">{short(view.days[last])}</span>
      </div>
    </div>
  );
}

const SAID: Record<DayMark, string> = { recorded: "recorded", opened: "opened only", none: "nothing" };

function TesterRow({ row, days }: { row: ActiveRow; days: string[] }) {
  const hour = useHourLabel();
  const recorded = row.days.filter((d) => d === "recorded").length;
  return (
    <li className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-display text-body font-bold">{row.label}</span>{" "}
          <span className="font-display text-caption font-semibold text-stone-500 tabular-nums">{row.number}</span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span
            className="flex w-10 items-center justify-end gap-1 font-display text-body font-extrabold tabular-nums"
            aria-label={`Streak ${row.streak}`}
          >
            <span aria-hidden className={row.streak > 0 ? "active-flame" : "text-stone-300"}>
              <IconFlame size={14} />
            </span>
            {row.streak}
          </span>
          <span
            className={`w-16 text-right text-caption tabular-nums ${
              row.reminder === null ? "text-stone-400" : "font-semibold text-ink"
            }`}
          >
            <span className="sr-only">Reminder </span>
            {row.reminder === null ? "Off" : hour(row.reminder)}
          </span>
        </div>
      </div>
      <div
        role="img"
        aria-label={`Recorded on ${recorded} of the last ${days.length} days. ${days
          .map((d, i) => `${short(d)} ${SAID[row.days[i]]}`)
          .join(", ")}.`}
        className={`${GRID} mt-2 h-4`}
      >
        <span />
        {row.days.map((m, i) => (
          <span key={days[i]} className="active-day" data-mark={m} />
        ))}
      </div>
    </li>
  );
}

function Legend() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-stone-500">
      {(["recorded", "opened", "none"] as const).map((m) => (
        <span key={m} className="flex items-center gap-1.5">
          <span aria-hidden className="active-day h-2.5 w-2.5" data-mark={m} />
          {m === "recorded" ? "Recorded" : m === "opened" ? "Opened only" : "Nothing"}
        </span>
      ))}
    </p>
  );
}

/** The landed page's shape: the day card, then rows at their height. */
function ActiveSkeleton() {
  return (
    <div aria-hidden>
      <div className="card mt-5 h-[254px] p-4">
        <Skeleton className="h-9 w-12" />
        <Skeleton className="mt-3 h-3 w-24" />
      </div>
      <div className="mt-7 flex h-7 items-center">
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="card mt-3 flex h-[66px] items-center justify-between px-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-7 flex h-7 items-center">
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="card mt-3 px-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="border-b border-hairline py-3 last:border-b-0">
            <div className="flex h-[25px] items-center">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
