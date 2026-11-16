"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorLine } from "@/components/ui/ErrorState";
import { CheckMark, Section } from "@/components/settings/Rows";
import { readOnboarding, writeOnboarding, type Answers } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { useRovingRadio } from "@/lib/use-roving-radio";

/**
 * One of the introduction's answers, changed later (#479): Goal on
 * Profile, Focus on Practice. A list of the answers with the chosen one
 * checked, one tab stop with the arrows moving the choice (#448's radio
 * group). The phone has the answer at once (every screen reads it from
 * there, lib/answers.ts); the account hears it next (lib/answers-sync.ts),
 * and a failed save says so with its retry.
 */
export function AnswerPicker<T extends string>({
  title,
  options,
  read,
  write,
  footer,
}: {
  title: string;
  options: readonly { id: T; label: string }[];
  /** The chosen answer, read from the introduction's answers. */
  read: (a: Answers) => T | null;
  /** The answers with this one chosen. */
  write: (a: Answers, id: T) => Partial<Answers>;
  footer?: string;
}) {
  const [chosen, setChosen] = useState<T | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "failed">("idle");

  useEffect(() => setChosen(read(readOnboarding().answers)), [read]);

  const push = useCallback(async () => {
    setSave("saving");
    const after = await syncOnboarding().catch(() => null);
    // A walk that never finished keeps its answers on the phone (they
    // go up when it does); a finished one has to be synced to count.
    setSave(after && (after.synced || !after.done) ? "idle" : "failed");
  }, []);

  const choose = useCallback(
    (id: T) => {
      const now = readOnboarding().answers;
      writeOnboarding({ answers: { ...now, ...write(now, id) } });
      setChosen(id);
      void push();
    },
    [write, push]
  );

  const values = options.map((o) => o.id);
  const { getItemProps } = useRovingRadio({ values, value: chosen, onChange: choose });

  return (
    <>
      <Section title={title} className="mt-5" footer={footer}>
        <div role="radiogroup" aria-label={title}>
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={chosen === o.id}
              onClick={() => choose(o.id)}
              {...getItemProps(o.id, i)}
              className="group-row press-row flex w-full items-center gap-3 text-left"
            >
              <span className="font-display min-w-0 flex-1 text-row">{o.label}</span>
              {chosen === o.id && <CheckMark />}
            </button>
          ))}
        </div>
      </Section>
      <div className="mt-2 min-h-5 px-4">
        {save === "saving" && (
          <p role="status" className="text-caption text-stone-500">
            Saving
          </p>
        )}
        {save === "failed" && (
          <ErrorLine onRetry={() => void push()}>Saved on this phone, but your account didn&apos;t take it.</ErrorLine>
        )}
      </div>
    </>
  );
}
