"use client";

import Link from "next/link";
import type { DailyTask } from "@/lib/daily";

/**
 * The daily set. Four rows, one dominant card above them (the rep) —
 * so this is a checklist of what's LEFT, not a menu competing with the
 * floor for attention.
 *
 * A row the user can't complete yet says why instead of sitting there
 * greyed out and mysterious.
 */
export function DailyTasks({
  tasks,
  onOpen,
  progress,
}: {
  tasks: DailyTask[];
  onOpen: (id: DailyTask["id"]) => void;
  progress: { done: number; available: number; allDone: boolean };
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="label-data">Today&apos;s set</div>
        <div className="label-data">
          {progress.done}/{progress.available} done
        </div>
      </div>

      <div className="mt-2 divide-y divide-sand overflow-hidden rounded-[18px] border border-black/5 bg-white lift">
        {tasks.map((task) => {
          const body = (
            <>
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  task.done
                    ? "bg-amber-500 text-cream"
                    : task.available
                      ? "border-2 border-stone-300"
                      : "border-2 border-dashed border-stone-200"
                }`}
                aria-hidden
              >
                {task.done ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`text-[14.5px] font-semibold ${
                      task.done ? "text-stone-400 line-through" : ""
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="label-data shrink-0">{task.cost}</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-stone-500">
                  {task.available ? task.blurb : task.lockedNote}
                </span>
              </span>
            </>
          );

          const cls =
            "flex w-full items-start gap-3 p-4 text-left transition-colors";

          if (!task.available) {
            return (
              <div key={task.id} className={`${cls} opacity-55`}>
                {body}
              </div>
            );
          }

          if (task.href) {
            return (
              <Link
                key={task.id}
                href={task.href}
                onClick={() => onOpen(task.id)}
                className={`${cls} press`}
              >
                {body}
              </Link>
            );
          }

          return (
            <button
              key={task.id}
              onClick={() => onOpen(task.id)}
              className={`${cls} press`}
            >
              {body}
            </button>
          );
        })}
      </div>

      {progress.allDone && (
        <p className="mt-2 text-center text-[12.5px] text-stone-500">
          Set complete. Anything else today is extra.
        </p>
      )}
    </div>
  );
}
