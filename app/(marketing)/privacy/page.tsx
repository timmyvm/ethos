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
 *  - an upload goes as it is: app/upload/page.tsx (audio or video
 *    files) to app/api/analyze, stored by lib/db.ts saveRep under
 *    "rep" and its extension (lib/audio-name.ts), never its own name
 *  - no advertising trackers or third-party cookies; Vercel Speed
 *    Insights (app/layout.tsx, @vercel/speed-insights) times page loads
 *    without cookies
 *  - the introduction's answers: supabase/migrations/0009_onboarding.sql
 *    and 0010 (age band, goal, up to three pains, level, context, the
 *    reminder hour, the plan built from them), moved from the device to
 *    the account by lib/answers-sync.ts; the name is
 *    profiles.display_name
 *  - an account before the first recording: lib/account-gate.ts (#410,
 *    4 November 2026). A guest session (Supabase anonymous) is still
 *    made by lib/supabase-browser.ts ensureSession for a tester who
 *    enters a code first (lib/tester-client.ts), and older guests keep
 *    theirs; lib/auth.ts attaches either to the account, same user id
 *  - Google: lib/auth.ts signInWithGoogle asks Supabase's Google
 *    provider for nothing beyond its defaults (email and profile), and
 *    no screen reads the profile (no user_metadata anywhere in the app)
 *  - reminders: supabase/migrations/0008_push_subscriptions.sql and
 *    0019 (the browser's push address and keys, the hour, the zone,
 *    quiet hours, the last day sent), written by app/api/push/route.ts;
 *    app/api/push/cron/route.ts sends through web-push, which encrypts
 *    the message to the browser's own keys
 *  - on the device only: lib/prefs.ts (theme, sound, haptics, text
 *    size and the rest), the sign-in session, lib/rep-outbox.ts
 *  - payments: lib/billing.ts (Stripe Checkout holds the card; the
 *    customer is made with the email and metadata.user_id only), the
 *    billing row in supabase/migrations/0012_price_ladder.sql (ids,
 *    status, ladder_month, price_cents, next_price_cents,
 *    current_period_end, cancel_at_period_end), and
 *    app/api/account/route.ts (every plan cancelled and the Stripe
 *    customer, with its email and saved card, deleted before anything
 *    else is; Stripe keeps its own records of the payments)
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
      <p className="mt-2 text-caption text-stone-400">Last updated 11 November 2026</p>

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
        AI-generated. A file you upload goes the same way, as it is, video
        included.
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
          <Lead>Your answers.</Lead> What you tell the introduction: your
          age range, your goal, up to three things you notice in your own
          speaking, how much you have practised, where you speak most, and
          the plan built from them.
        </li>
        <li>
          <Lead>Your account.</Lead> Your email address, the name you gave
          if you gave one, and your plan, detailed under Payments. If you
          sign in with Google, Google also passes on the name and profile
          picture address on your Google account. Ethos uses neither.
        </li>
        <li>
          <Lead>Reminders.</Lead> If you turn them on: the address your
          browser gives us to send them to, the hour you chose, and your
          time zone.
        </li>
        <li>
          <Lead>Abuse protection.</Lead> Request timestamps keyed to your
          account, or to your IP address when there is no account.
        </li>
      </ul>
      <p className={READ}>
        Some things stay on your device only: preferences like theme, sound
        and text size, your sign-in session, and any recording waiting to
        upload.
      </p>

      <h2 className={HEAD}>Payments</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-read text-stone-800 marker:text-stone-300">
        <li>
          <Lead>What Stripe holds.</Lead> Your card. Stripe takes each payment
          for Premium, and Ethos never sees the card number.
        </li>
        <li>
          <Lead>What Stripe gets from us.</Lead> Your email address and
          account id, so the plan and its receipts reach you.
        </li>
        <li>
          <Lead>What we keep.</Lead> Stripe&apos;s ids for you and your plan,
          the plan&apos;s status, the months paid in a row, this month&apos;s
          and next month&apos;s price, the renewal date, and whether the plan
          is set to end.
        </li>
      </ul>

      <h2 className={HEAD}>Cookies and analytics</h2>
      <p className={READ}>
        Ethos runs no advertising trackers and sets no third-party cookies.
        Vercel Speed Insights measures how fast each page loads, without
        cookies. Your sign-in session is kept in your browser&apos;s own
        storage by Supabase, our database and login provider. Testers also
        send their usage, device and error details to our own server, as
        the Testers section says.
      </p>

      <h2 className={HEAD}>Who touches the data</h2>
      <p className={READ}>
        Five processors, each doing one job: Supabase (accounts, database and
        audio storage), OpenAI (transcription), Anthropic (feedback), Stripe
        (payments), and Vercel (hosting, with standard server logs and page
        load timings). Two more take part only if you use them. Google, when
        you sign in with it, confirms who you are and learns that you use
        Ethos. Your browser maker&apos;s push service (Apple, Google or
        Mozilla) delivers a reminder, encrypted so that only your browser can
        read it. We never sell your data and never share it beyond these
        services.
      </p>

      {/* #452. Until 4 November a person could practise first and sign
          up later (#15, #134); #410 put the account before the first
          recording, and this section still promised the old order. */}
      <h2 className={HEAD}>Before you have an account</h2>
      <p className={READ}>
        The introduction asks its questions before you have an account.
        Your answers stay in your browser until you make one, then they are
        saved to it. Ethos asks for the account before your first recording.
      </p>
      <p className={READ}>
        A few people have a guest session in their browser from before
        their account: a tester who entered a code first, or anyone who used
        Ethos before 4 November 2026. What they answered and recorded is
        kept under it, and making the account attaches it to them. If the
        browser&apos;s data is cleared first, they can no longer sign in to
        it, and it carries no email address.
      </p>

      {/* Tester mode: migrations 0020 to 0022 (testers, tester_feedback,
          tester_events, the tester_admin report only the service role
          reads), app/api/tester and app/api/tester/collect,
          lib/tester-collect.ts, content/tester.ts CONSENT (version 3),
          docs/testers.md. Says what the consent says. */}
      <section id="testers">
        <h2 className={HEAD}>Testers</h2>
        <p className={READ}>
          If you joined with a tester code and agreed to the list on the
          consent screen, Ethos keeps all of this while you test. Testing
          keeps going after 15 November until you tap Stop testing in
          Settings, Testing Ethos:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-read text-stone-800 marker:text-stone-300">
          <li>
            <Lead>Your recordings.</Lead> Every audio recording, every file
            you upload (video included), and the camera&apos;s numbers when
            it&apos;s on. The live camera&apos;s video stays on your phone.
          </li>
          <li>
            <Lead>Transcripts.</Lead> Everything you say, word for word, with
            timestamps.
          </li>
          <li>
            <Lead>Your scores.</Lead> Every score, star, streak and number
            Ethos gives you.
          </li>
          <li>
            <Lead>Your answers.</Lead> Everything you answer in the
            introduction (your name, age, goal and the hour you picked), your
            email if you make an account, and every answer and note after a
            recording.
          </li>
          <li>
            <Lead>How you use it.</Lead> Which screens you open, what you tap,
            when, and for how long. A tap is kept by the button&apos;s name,
            never by anything you type.
          </li>
          <li>
            <Lead>Your device.</Lead> Phone model, operating system, browser,
            screen size, language, time zone, and whether Ethos is on your
            home screen.
          </li>
          <li>
            <Lead>Your connection.</Lead> IP address and basic network info.
          </li>
          <li>
            <Lead>Problems.</Lead> Errors and crashes, and what was on screen
            when they happened.
          </li>
        </ul>
        <p className={READ}>
          It&apos;s for making the scores accurate and fixing what breaks.
          Timothy, who makes Ethos, is the only person who reads it. Nothing is
          sold, and it goes only to the services that run the app, the
          processors above (Supabase, OpenAI, Anthropic and Vercel). It&apos;s
          kept up to 12 months after the test ends, then deleted; if you keep
          using Ethos, your recordings and scores stay in your account, as
          everyone&apos;s do. Ask him and
          it&apos;s all deleted within 7 days; deleting your account in
          Settings deletes it too. If you&apos;re under 18, a parent or
          guardian says yes first.
        </p>
      </section>

      <h2 className={HEAD}>Keeping it, deleting it</h2>
      <p className={READ}>
        We keep your data until you delete your account. Settings has a
        delete-account control. It ends any plan at once, then removes
        everything: recordings, transcripts, scores, progress, plan details,
        and the account itself. Your email and saved card are deleted at
        Stripe too. Stripe keeps its records of the payments already made,
        which the law requires it to hold. You can also write to{" "}
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
