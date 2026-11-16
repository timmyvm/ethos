"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorLine } from "@/components/ui/ErrorState";
import { LinkRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { PictureChoices, PictureProblem } from "@/components/picture/PictureChoices";
import { usePicture } from "@/components/picture/usePicture";
import { cleanName, MAX_NAME, readOnboarding, writeOnboarding } from "@/lib/answers";
import { fetchProfile, updateDisplayName } from "@/lib/client-data";
import { PICTURE_COPY } from "@/lib/picture";
import { goalWord } from "@/lib/settings-index";

/**
 * Profile (#479): the name, the picture and the goal. The name is
 * `profiles.display_name`, the one field you type. The picture is the
 * person's one picture (#488, components/picture/usePicture.tsx): your
 * photo, your initial, Demos's hello, or a pose the coin ledger proves
 * you bought, with the photo's own doors under them. The same rows open
 * from You's coin, so both doors set one thing, and every surface that
 * shows a picture of you draws what is checked here. The goal is the
 * introduction's answer.
 */
export default function ProfilePage() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [nameSave, setNameSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [goal, setGoal] = useState<string | null | undefined>(undefined);
  const picture = usePicture({ name: name ?? null, nameKnown: name !== undefined, choices: true });

  useEffect(() => {
    setGoal(readOnboarding().answers.goal);
    const local = cleanName(readOnboarding().answers.name);
    fetchProfile()
      .then((p) => {
        const n = cleanName(p?.display_name) ?? local;
        setName(n);
        setDraft(n ?? "");
      })
      .catch(() => {
        setName(local);
        setDraft(local ?? "");
      });
  }, []);

  async function saveName() {
    const next = cleanName(draft);
    setNameSave("saving");
    const ok = await updateDisplayName(next ?? "");
    if (!ok) {
      setNameSave("failed");
      return;
    }
    // The introduction's copy follows, so no screen greets the old name.
    const answers = readOnboarding().answers;
    writeOnboarding({ answers: { ...answers, name: next }, synced: readOnboarding().synced });
    setName(next);
    setDraft(next ?? "");
    setNameSave("saved");
  }

  const changed = name !== undefined && (cleanName(draft) ?? null) !== (name ?? null);

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Profile" back={{ href: "/settings", label: "Settings" }} />

      {/* The name is the row itself, as a phone's own name field is: no
          box in the box. Save appears beside it once it has changed. */}
      <Section
        title="Name"
        className="mt-5"
        footer={
          nameSave === "failed" ? (
            <ErrorLine onRetry={() => void saveName()}>Your name didn&apos;t save.</ErrorLine>
          ) : (
            <span role="status">{nameSave === "saved" ? "Saved." : "What Demos and Today call you."}</span>
          )
        }
      >
        <form
          className="group-row flex items-center gap-2 py-0 pr-2 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed) void saveName();
          }}
        >
          <input
            name="displayName"
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="done"
            spellCheck={false}
            aria-label="Your name"
            maxLength={MAX_NAME}
            value={draft}
            disabled={name === undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setNameSave("idle");
            }}
            placeholder="Add your name"
            className="font-display min-h-12 min-w-0 flex-1 bg-transparent text-read font-bold text-ink outline-none placeholder:font-normal placeholder:text-stone-400"
          />
          {changed && (
            <button type="submit" disabled={nameSave === "saving"} className="press font-display min-h-11 shrink-0 rounded-tap px-3 text-row text-terracotta-700 disabled:opacity-60">
              {nameSave === "saving" ? "Saving…" : "Save"}
            </button>
          )}
        </form>
      </Section>

      {/* The picture (#488): every picture you can wear, one row each
          with a check on the one worn, the photo's doors, the Shop. The
          same rows You's coin opens on a sheet. */}
      <Section
        title={PICTURE_COPY.section}
        footer={picture.error ? <PictureProblem state={picture} className="" /> : undefined}
      >
        <PictureChoices state={picture} />
      </Section>
      {picture.input}

      <Section title="About you">
        <LinkRow href="/settings/profile/goal" label="Goal" value={goal === undefined ? null : goalWord(goal)} />
      </Section>
    </main>
  );
}
