import Link from "next/link";
import type { Metadata } from "next";

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
    <main className="px-5 pb-24 pt-10">
      <Link href="/about" className="text-sm text-stone-500">
        ← ethos
      </Link>
      <h1 className="font-display mt-6 text-[34px] leading-[1.15]">Privacy</h1>
      <p className="mt-2 text-[12.5px] text-stone-400">
        Last updated 25 August 2026
      </p>

      <p className="mt-5 text-[15px] leading-relaxed text-stone-600">
        Ethos is a speaking gym: you record yourself, the recording gets
        measured, you get feedback. That only works if we handle recordings of
        your voice, so here is exactly what happens to them, in plain words.
      </p>

      <div className="mt-6 rounded-[24px] border border-hairline bg-surface lift p-5">
        <h2 className="font-display text-[19px]">Your camera never uploads</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          Body-language analysis runs entirely on your device, using MediaPipe
          in your browser. Video frames never leave it, are never uploaded and
          are never stored by us. What we keep is five derived numbers (things
          like gesture rate and posture drift) and short timestamped notes.
          The optional local replay clip lives only in that browser tab.
        </p>
      </div>

      <h2 className="font-display mt-8 text-[19px]">Audio, and where it goes</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        When you finish a recording, the audio uploads to our server to be
        scored. Two third-party AI services process it on our behalf: OpenAI
        (Whisper) turns the audio into a transcript with word timings, and
        Anthropic (Claude) turns the transcript and your numbers into written
        feedback. Both run under API terms that keep your audio and
        transcripts out of model training. All feedback in Ethos is
        AI-generated.
      </p>

      <h2 className="font-display mt-8 text-[19px]">What we store</h2>
      <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-stone-600">
        <li>
          · Your recordings: the audio files, transcripts (including the raw
          transcription output), and the AI feedback written about them
        </li>
        <li>
          · Your numbers: pace, fillers, pauses, scores, stars, and the
          on-device presence numbers described above
        </li>
        <li>· Your progress: streaks, freezes, XP, coins, and the word
          upgrades pulled from your own transcripts</li>
        <li>
          · Your account: email address once you create one, an optional
          display name, and your plan
        </li>
        <li>
          · Abuse protection: request timestamps keyed to your account, or to
          your IP address when there is no account
        </li>
      </ul>
      <p className="mt-3 text-[14px] leading-relaxed text-stone-600">
        Some things stay on your device only: preferences like theme and
        reminder hour, your sign-in session, and any recording waiting to
        upload.
      </p>

      <h2 className="font-display mt-8 text-[19px]">Cookies and analytics</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        None. No analytics scripts, no advertising trackers, no third-party
        cookies. Your sign-in session is kept in your browser&apos;s own
        storage by Supabase, our database and login provider.
      </p>

      <h2 className="font-display mt-8 text-[19px]">Who touches the data</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        Four processors, each doing one job: Supabase (accounts, database and
        audio storage), OpenAI (transcription), Anthropic (feedback), and
        Vercel (hosting, with standard server logs). We never sell your data
        and never share it beyond these services.
      </p>

      <h2 className="font-display mt-8 text-[19px]">Practising without an account</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        You can practise before signing up. That progress is tied to an
        anonymous session in your browser; creating an account later attaches
        it to you. If you clear your browser data first, the anonymous
        progress can&apos;t be traced back to anyone, including you.
      </p>

      <h2 className="font-display mt-8 text-[19px]">Keeping it, deleting it</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        We keep your data until you delete your account. Settings has a
        delete-account control that removes everything: recordings,
        transcripts, scores, progress, and the account itself. You can also
        write to{" "}
        <a
          href="mailto:hello@speakethos.com"
          className="font-semibold text-terracotta-700"
        >
          hello@speakethos.com
        </a>{" "}
        for deletion, access or correction.
      </p>

      <h2 className="font-display mt-8 text-[19px]">Where we operate</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
        Ethos is operated from Australia and handles personal information
        under the Australian Privacy Principles. If you think we&apos;ve
        handled yours badly, tell us first; if we don&apos;t sort it out, you
        can complain to the Office of the Australian Information Commissioner.
      </p>

      <p className="mt-10 text-center text-[12.5px] text-stone-400">
        <Link href="/terms" className="font-semibold text-stone-500">
          Terms
        </Link>{" "}
        · <span>hello@speakethos.com</span>
      </p>
    </main>
  );
}
