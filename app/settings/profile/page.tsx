"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorLine } from "@/components/ui/ErrorState";
import { TapTick } from "@/components/ui/TapTick";
import { CheckMark, LinkRow, PAGE_CLASS, PoseAvatar, Section } from "@/components/settings/Rows";
import { cleanName, MAX_NAME, readOnboarding, writeOnboarding } from "@/lib/answers";
import { fetchProfile, fetchWholeLedger, updateDisplayName, updateEquippedPose } from "@/lib/client-data";
import { adoptAccountPose, wearPose } from "@/lib/pose-save";
import { readPrefs } from "@/lib/prefs";
import { goalWord } from "@/lib/settings-index";
import { POSE_STAGE, SHOP, ownedFrom } from "@/lib/shop";
import { useRovingRadio } from "@/lib/use-roving-radio";

/** Hello is worn when nothing is: the pose every account has. */
const HELLO = "hello";

/** A pose's name in the picker: the Shop's, without "Demos, ". */
function poseName(id: string): string {
  if (id === HELLO) return "Hello";
  const name = SHOP.find((s) => s.id === id)?.name.replace(/^Demos,\s*/, "") ?? id;
  return `${name[0].toUpperCase()}${name.slice(1)}`;
}

/**
 * Profile (#479): the picture, the name and the goal. The picture is
 * Demos in a pose the account owns (the Shop's poses, #395): hello for
 * everyone, and each pose the coin ledger proves was bought; wearing one
 * here wears it on You, saved through the same pending mark the Shop
 * uses (lib/pose-save.ts). The name is `profiles.display_name`, the one
 * field you type. The goal is the introduction's answer.
 */
export default function ProfilePage() {
  const [worn, setWorn] = useState<string | null>(null);
  /** Poses the ledger proves; undefined until it is read. */
  const [owned, setOwned] = useState<string[] | undefined>(undefined);
  const [poseNote, setPoseNote] = useState<string | null>(null);
  const turn = useRef(0);
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [nameSave, setNameSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [goal, setGoal] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setWorn(readPrefs().pose);
    setGoal(readOnboarding().answers.goal);
    const local = cleanName(readOnboarding().answers.name);
    fetchProfile()
      .then((p) => {
        const n = cleanName(p?.display_name) ?? local;
        setName(n);
        setDraft(n ?? "");
        if (p) setWorn(adoptAccountPose(p.equipped_pose));
      })
      .catch(() => {
        setName(local);
        setDraft(local ?? "");
      });
    fetchWholeLedger()
      .then((rows) => setOwned([...ownedFrom(rows).ids].filter((id) => id in POSE_STAGE)))
      .catch(() => setOwned([]));
  }, []);

  /* Hello, then every pose owned, and the one worn even before the
     ledger answers, so the picture on screen is always a choice here. */
  const poses = [HELLO, ...SHOP.filter((s) => s.id in POSE_STAGE && ((owned ?? []).includes(s.id) || s.id === worn)).map((s) => s.id)];
  const chosen = worn && poses.includes(worn) ? worn : HELLO;

  function wear(id: string) {
    const pose = id === HELLO ? null : id;
    setWorn(pose);
    setPoseNote(null);
    const mine = ++turn.current;
    void wearPose(pose, updateEquippedPose).then((saved) => {
      if (saved || mine !== turn.current) return;
      setPoseNote("Wearing it didn't save. Try again.");
      fetchProfile()
        .then((p) => {
          if (p && mine === turn.current) setWorn(adoptAccountPose(p.equipped_pose));
        })
        .catch(() => {});
    });
  }
  const { getItemProps } = useRovingRadio({ values: poses, value: chosen, onChange: wear });

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

      {/* The picture: Hello and every pose owned, one row each with a
          check on the one worn, the same list as Goal's and Focus's. */}
      <Section title="Picture" footer={poseNote ? <span role="alert" className="text-rust">{poseNote}</span> : "Demos stands on You in the pose you pick."}>
        <div role="radiogroup" aria-label="Picture" data-inset="icon">
          {poses.map((id, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosen === id}
              onClick={() => wear(id)}
              {...getItemProps(id, i)}
              className="group-row press-row flex w-full items-center gap-3.5 py-2 text-left"
            >
              <PoseAvatar pose={id === HELLO ? null : id} size={40} />
              <span className="font-display min-w-0 flex-1 text-row">{poseName(id)}</span>
              {chosen === id && <CheckMark />}
              <TapTick />
            </button>
          ))}
        </div>
        <LinkRow href="/shop" label="More poses in the Shop" />
      </Section>

      <Section title="About you">
        <LinkRow href="/settings/profile/goal" label="Goal" value={goal === undefined ? null : goalWord(goal)} />
      </Section>
    </main>
  );
}
