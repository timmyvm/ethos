import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingHeader, MarketingLink } from "@/components/MarketingBack";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export const metadata: Metadata = {
  title: "Privacy · Ethos",
  description:
    "What Ethos records, where it goes, and what never leaves your device.",
  openGraph: {
    title: "Privacy · Ethos",
    description:
      "What Ethos records, where it goes, and what never leaves your device.",
  },
};

/** A heading on the page, and the paragraph under it (marketing-3, -15). */
const HEAD = "section-head mt-8";
const READ = "mt-3 text-read text-stone-800";

/** An inline link: underlined at 40% of its colour, full on hover, so it
    reads as a link in both themes (marketing-17). */
const INLINE_LINK =
  "font-semibold text-terracotta-700 underline decoration-[color-mix(in_srgb,currentColor_40%,transparent)] underline-offset-2 hover:decoration-current";

/** A footer link: a 44px target in the caption's voice (marketing-9). */
const FOOT_LINK =
  "press inline-flex min-h-11 items-center px-3 font-semibold text-stone-500 hover:text-ink";

/** A list item's lead, the way About's daily loop names each step. */
function Lead({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-ink">{children}</span>;
}

/*
 * Every claim on this page is checked against the code that makes it
 * true, and the code references are kept here so the next edit checks
 * them again:
 *  - audio upload + third parties: lib/transcribe.ts (OpenAI),
 *    lib/coach.ts + lib/accuracy.ts (Anthropic)
 *  - camera stays on-device: lib/pose-client.ts + app/rep/page.tsx
 *    (five numbers and timestamped notes, never frames)
 *  - what's stored: lib/db.ts saveRep + supabase/migrations/*
 *  - no analytics: nothing in package.json or app/ loads any
 */
export default function Privacy() {
  return (
    <main className="px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-7">
      {/* Static for a stranger (back to the landing page); back to
          Settings for somebody who came from there (marketing-3). */}
      <Suspense
        fallback={
          <ScreenHeader title="Privacy" back={{ href: "/about", label: "Ethos" }} />
        }
      >
        <MarketingHeader title="Privacy" />
      </Suspense>
      <p className="mt-2 text-caption text-stone-400">Last updated 25 August 2026</p>

      <p className="mt-5 text-read text-stone-800">
        You record yourself, the recording gets measured, you get feedback.
        Here is what happens to your recordings.
      </p>

      <div className="card elev-2 mt-7 p-5">
        <h2 className="font-display text-lead font-bold">Your camera never uploads</h2>
        <p className="mt-3 text-read text-stone-800">
          Body-language analysis runs entirely on your device, using MediaPipe
          in your browser. Video frames never leave it, are never uploaded and
          are never stored by us. What we keep is five derived numbers (things
          like gesture rate and posture drift) and short timestamped notes.
          The optional local replay clip lives only in that browser tab.
        </p>
      </div>

      <h2 className={HEAD}>Audio, and where it goes</h2>
      <p className={READ}>
        When you finish a recording, the audio uploads to our server to be
        scored. Two third-party AI services process it on our behalf: OpenAI
        (Whisper) turns the audio into a transcript with word timings, and
        Anthropic (Claude) turns the transcript and your numbers into written
        feedback. Both run under API terms that keep your audio and
        transcripts out of model training. All feedback in Ethos is
        AI-generated.
      </p>

      <h2 className={HEAD}>What we store</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-read text-stone-800 marker:text-stone-300">
        <li>
          <Lead>Your recordings.</Lead> The audio files, transcripts
          (including the raw transcription output), and the AI feedback
          written about them.
        </li>
        <li>
          <Lead>Your numbers.</Lead> Pace, fillers, pauses, scores, stars,
          and the on-device presence numbers described above.
        </li>
        <li>
          <Lead>Your progress.</Lead> Streaks, freezes, XP, coins, and the
          word upgrades pulled from your own transcripts.
        </li>
        <li>
          <Lead>Your account.</Lead> Email address once you create one, an
          optional display name, and your plan.
        </li>
        <li>
          <Lead>Abuse protection.</Lead> Request timestamps keyed to your
          account, or to your IP address when there is no account.
        </li>
      </ul>
      <p className={READ}>
        Some things stay on your device only: preferences like theme and
        reminder hour, your sign-in session, and any recording waiting to
        upload.
      </p>

      <h2 className={HEAD}>Cookies and analytics</h2>
      <p className={READ}>
        Ethos runs no analytics scripts, advertising trackers or third-party
        cookies. Your sign-in session is kept in your browser&apos;s own
        storage by Supabase, our database and login provider.
      </p>

      <h2 className={HEAD}>Who touches the data</h2>
      <p className={READ}>
        Four processors, each doing one job: Supabase (accounts, database and
        audio storage), OpenAI (transcription), Anthropic (feedback), and
        Vercel (hosting, with standard server logs). We never sell your data
        and never share it beyond these services.
      </p>

      <h2 className={HEAD}>Practising without an account</h2>
      <p className={READ}>
        You can practise before signing up. That progress is tied to an
        anonymous session in your browser; creating an account later attaches
        it to you. If you clear your browser data first, the anonymous
        progress can&apos;t be traced back to anyone, including you.
      </p>

      <h2 className={HEAD}>Keeping it, deleting it</h2>
      <p className={READ}>
        We keep your data until you delete your account. Settings has a
        delete-account control that removes everything: recordings,
        transcripts, scores, progress, and the account itself. You can also
        write to{" "}
        <a href="mailto:hello@speakethos.com" className={INLINE_LINK}>
          hello@speakethos.com
        </a>{" "}
        for deletion, access or correction.
      </p>

      <h2 className={HEAD}>Where we operate</h2>
      <p className={READ}>
        Ethos is operated from Australia and handles personal information
        under the Australian Privacy Principles. If you think we&apos;ve
        handled yours badly, tell us first; if we don&apos;t sort it out, you
        can complain to the Office of the Australian Information Commissioner.
      </p>

      <footer className="mt-12 border-t border-hairline pt-6 text-center text-caption text-stone-400">
        <div className="flex flex-wrap justify-center">
          <MarketingLink href="/terms" className={FOOT_LINK}>
            Terms
          </MarketingLink>
          <a href="mailto:hello@speakethos.com" className={FOOT_LINK}>
            hello@speakethos.com
          </a>
        </div>
      </footer>
    </main>
  );
}
