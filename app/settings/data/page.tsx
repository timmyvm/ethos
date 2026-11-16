"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorLine } from "@/components/ui/ErrorState";
import { ActionRow, LinkRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { deleteAccount } from "@/lib/auth";
import { fetchAllLexicon, fetchAllReps } from "@/lib/client-data";
import { avatarForExport } from "@/lib/avatar-client";
import { readable } from "@/lib/load";
import { prefersReducedMotion } from "@/lib/prefs";
import { cancelReminder } from "@/lib/reminders";
import { deleteAllRecordings } from "@/lib/recordings-delete";
import { DELETE_ANY_PLAN, deletePlanLine, hasPlan } from "@/lib/plan-view";
import { usePlan } from "@/lib/use-plan";
import { useAccount } from "@/lib/use-account";
import { DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";

/** The confirm's two buttons: the way back leads, the deletion trails (#445). */
const CONFIRM_BUTTON = `press font-display min-h-11 flex-1 rounded-tap border border-edge px-4 py-2.5 text-row ${DISABLED_CLASS}`;

/**
 * Privacy and data (#479): what Ethos keeps, said plainly (#452), your
 * data as one file (built), every recording deleted with the account
 * kept (app/api/recordings), and the account itself, last and alone,
 * behind a typed confirmation. Each confirm opens in view with its way
 * back first (#445).
 */
export default function DataPage() {
  const { account } = useAccount();
  const plan = usePlan();
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  /* Delete my recordings. */
  const [wiping, setWiping] = useState<"closed" | "asking" | "busy" | "failed">("closed");
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wiped, setWiped] = useState<number | null>(null);
  const wipeDoor = useRef<HTMLButtonElement>(null);
  const wipeCard = useRef<HTMLDivElement>(null);
  const wipeKeep = useRef<HTMLButtonElement>(null);

  /* Delete my account. */
  const [arming, setArming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [hadPlan, setHadPlan] = useState(false);
  const deleteDoor = useRef<HTMLButtonElement>(null);
  const confirmCard = useRef<HTMLDivElement>(null);
  const confirmField = useRef<HTMLInputElement>(null);

  const signedIn = account?.kind === "account";
  /* Deleting ends a plan at once, with no refund for the rest of its
     month: said in the confirm, before anyone types DELETE. */
  const planKnown = plan.today !== null && plan.view.kind !== "unknown";
  const deleteLine = planKnown ? deletePlanLine(plan.view, plan.today as Date) : signedIn ? DELETE_ANY_PLAN : null;

  /**
   * Everything the app knows about you, as one JSON file. Every row,
   * paged, and a failed read is a failure: an empty file passed off as a
   * backup is the worst thing this row could do.
   */
  async function exportData() {
    setExporting(true);
    setExportFailed(false);
    try {
      // The profile photo too (#485), the picture itself, not a link.
      const read = await readable(() => Promise.all([fetchAllReps(), fetchAllLexicon(), avatarForExport()]), 30_000);
      if (!read.ok) {
        setExportFailed(true);
        return;
      }
      const [reps, lexicon, photo] = read.data;
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), reps, lexicon, photo }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ethos-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function askWipe() {
    flushSync(() => {
      setWiping("asking");
      setWipeError(null);
      setWiped(null);
    });
    wipeKeep.current?.focus({ preventScroll: true });
    wipeCard.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
  function keepRecordings() {
    flushSync(() => setWiping("closed"));
    wipeDoor.current?.focus({ preventScroll: true });
  }
  async function wipe() {
    setWiping("busy");
    setWipeError(null);
    const r = await deleteAllRecordings();
    if (!r.ok) {
      setWiping("failed");
      setWipeError(r.error ?? "That didn't go through. Try again.");
      return;
    }
    setWiped(r.deleted ?? 0);
    setWiping("closed");
  }

  /* The account's confirm opens where its row stood and comes into view
     whole, its field focused in the tap's own stack so an iPhone raises
     its keyboard with it (#445). */
  function armDelete() {
    flushSync(() => {
      setArming(true);
      setConfirmText("");
      setDeleteError(null);
    });
    confirmField.current?.focus({ preventScroll: true });
    confirmCard.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
  function disarmDelete() {
    flushSync(() => setArming(false));
    deleteDoor.current?.focus({ preventScroll: true });
  }
  async function runDelete() {
    setDeleting(true);
    setDeleteError(null);
    const withPlan = planKnown ? hasPlan(plan.view) : signedIn;
    setHadPlan(planKnown && hasPlan(plan.view));
    const result = await deleteAccount({ plan: withPlan });
    if (!result.ok) {
      setDeleteError(result.error ?? "That didn't go through.");
      setDeleting(false);
      return;
    }
    // The server side is gone; empty the device to match.
    cancelReminder();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ethos"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    try {
      indexedDB.deleteDatabase("ethos-outbox");
    } catch {}
    setDeleted(true);
    setTimeout(() => {
      window.location.href = "/about";
    }, 3500);
  }

  // The goodbye: by the time this renders, the server holds nothing.
  if (deleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-[var(--nav-clear)] text-center">
        <Image src="/demos-asleep.webp" alt="" width={160} height={160} className="demos w-[160px]" />
        <h1 className="font-display mt-5 text-title font-extrabold">All gone</h1>
        <p className="mt-2 max-w-[280px] text-body text-pretty text-stone-500">
          {hadPlan && "Plan ended. "}Recordings, scores, streaks, account: deleted. Thanks for speaking with us.
        </p>
        <Link href="/about" className="text-link mt-6 text-terracotta-700">
          The door stays open
        </Link>
      </main>
    );
  }

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Privacy and data" back={{ href: "/settings", label: "Settings" }} />

      <Section title="Privacy" className="mt-5">
        <LinkRow href="/settings/data/stored" label="What Ethos keeps" />
        <LinkRow href="/privacy?from=settings-data" label="Privacy policy" />
      </Section>

      <Section title="Your data" footer="Every recording, transcript, score and lexicon entry, as one file.">
        <ActionRow
          label={exporting ? "Building your file…" : "Download your data"}
          onClick={() => void exportData()}
          disabled={exporting}
          trailing={
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-400">
              <path d="M12 4v11" />
              <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
              <path d="M5 19.5h14" />
            </svg>
          }
        />
        {exportFailed && (
          <div className="group-row">
            <ErrorLine onRetry={() => void exportData()}>Your file didn&apos;t build, so nothing was downloaded.</ErrorLine>
          </div>
        )}
      </Section>

      <Section title="Recordings" footer={wiping === "closed" && wiped === null ? "Your account, XP, coins and saved words stay." : undefined}>
        {wiping === "closed" ? (
          <ActionRow buttonRef={wipeDoor} label="Delete my recordings" tone="destructive" onClick={askWipe} center />
        ) : (
          <div ref={wipeCard} className="group-row scroll-mb-[var(--nav-clear)] scroll-mt-16 py-4">
            <p className="text-read text-pretty text-stone-800">
              Every recording goes, with its audio, words and scores. Your streak, stars and Index start again from your next one.
            </p>
            {wipeError && (
              <p role="alert" className="mt-2 text-caption font-semibold text-rust">
                {wipeError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button ref={wipeKeep} type="button" onClick={keepRecordings} disabled={wiping === "busy"} className={`${CONFIRM_BUTTON} bg-ground`}>
                Keep them
              </button>
              <button type="button" onClick={() => void wipe()} disabled={wiping === "busy"} className={`${CONFIRM_BUTTON} bg-ground text-destructive`}>
                {wiping === "busy" ? "Deleting…" : "Delete recordings"}
              </button>
            </div>
          </div>
        )}
      </Section>
      {wiped !== null && (
        <p role="status" className="group-foot">
          {wiped === 1 ? "1 recording deleted." : `${wiped} recordings deleted.`}
        </p>
      )}

      {/*
       * Last on the page, alone, behind a typed confirmation: an
       * irreversible action never sits where a thumb lands on the way to
       * something else, and it never wears the colour that means "tap
       * this".
       */}
      <div className="mt-10">
        {!arming ? (
          <div className="inset-group">
            <button
              ref={deleteDoor}
              type="button"
              onClick={armDelete}
              className="group-row press-row font-display w-full text-center text-row text-destructive"
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div ref={confirmCard} className="card scroll-mb-[var(--nav-clear)] scroll-mt-16 p-4">
            <p className="text-read text-pretty text-stone-800">
              This permanently deletes every recording, transcript, score, streak and the account itself.
            </p>
            {deleteLine && <p className="mt-2 text-read text-pretty text-stone-800">{deleteLine}</p>}
            <label className="eyebrow mt-4 block" htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input
              ref={confirmField}
              id="delete-confirm"
              name="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                // Return puts the keyboard away and deletes nothing.
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape" && !deleting) disarmDelete();
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="characters"
              enterKeyHint="done"
              placeholder="DELETE"
              className={`${INPUT_CLASS} mt-1.5`}
            />
            {deleteError && (
              <p role="alert" className="mt-2 text-caption font-semibold text-rust">
                {deleteError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={disarmDelete} disabled={deleting} className={`${CONFIRM_BUTTON} bg-surface`}>
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void runDelete()}
                disabled={confirmText.trim() !== "DELETE" || deleting}
                className={`${CONFIRM_BUTTON} bg-surface text-destructive`}
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
