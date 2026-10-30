"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { SpeechBubble } from "@/components/SpeechBubble";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { CODE_COPY, CONSENT, JOINED_COPY } from "@/content/tester";
import {
  CODE_LENGTH,
  codeDigits,
  codeReady,
  isCurrentTester,
  testerNumber,
  type TesterRow,
} from "@/lib/tester";
import { checkTesterCode, fetchTester, joinTesting } from "@/lib/tester-client";
import { currentSession } from "@/lib/supabase-browser";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

/**
 * Tester mode's door (migration 0020, docs/testers.md): the code, then
 * the consent, then testing. Reached from the introduction's first
 * screen ("I have a tester code") and from Settings' Tester code row,
 * and it goes back where it came from.
 *
 * Nothing is stored until the agree tap. The code is checked by the
 * server with no session made and nothing written, so backing out of
 * the consent leaves no trace; the agree tap sends the code again with
 * the consent's version, and the server writes both in one row.
 *
 * An account that is already a tester (Settings' "Testing Ethos" row)
 * opens on what it agreed to, since when, and its tester number. One
 * that agreed to an older consent is asked again, from the code.
 */
export default function TesterPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <Tester />
    </Suspense>
  );
}

type Phase = "reading" | "code" | "consent" | "joined";

function Tester() {
  const params = useSearchParams();
  const from: "settings" | "welcome" = params.get("from") === "settings" ? "settings" : "welcome";
  const backLabel = from === "settings" ? "Settings" : "Back";
  const onward = from === "settings" ? JOINED_COPY.toSettings : JOINED_COPY.toWelcome;

  const [phase, setPhase] = useState<Phase>("reading");
  const [tester, setTester] = useState<TesterRow | null>(null);
  /** Joined on this visit: the moment gets Demos; a return visit does not. */
  const [justJoined, setJustJoined] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTester()
      .then((t) => {
        setTester(t);
        setPhase(isCurrentTester(t) ? "joined" : "code");
      })
      .catch(() => setPhase("code"));
  }, []);

  async function check() {
    if (!codeReady(code) || busy) return;
    setBusy(true);
    setError(null);
    const sent = code;
    const answer = await checkTesterCode(sent);
    setBusy(false);
    if (answer.ok) {
      setPhase("consent");
      return;
    }
    setError(answer.error);
    // A wrong code empties the cells (their edges stay red until the
    // next digit), so the number pad types straight into them again;
    // digits typed while it was being checked are left as they are.
    if (answer.status === 403) {
      setCode((now) => (now === sent ? "" : now));
      codeInput.current?.focus();
    }
  }

  async function agree() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const answer = await joinTesting(code);
    setBusy(false);
    if (answer.ok && answer.tester) {
      setTester(answer.tester);
      setJustJoined(true);
      setPhase("joined");
      window.scrollTo({ top: 0 });
    } else if (!answer.ok) {
      // A wrong code here means the screen sat open while it changed:
      // back to the code, which says so.
      if (answer.status === 403) {
        setCode("");
        setPhase("code");
      }
      setError(answer.error);
    }
  }

  /* Until the account's row answers, nothing: a tester opening this
     from Settings never sees the code's title flash before their own. */
  if (phase === "reading") return <main className="px-5 pt-7" />;

  if (phase === "joined" && tester) {
    return (
      <Joined
        tester={tester}
        moment={justJoined}
        back={{ href: `/${from}`, label: backLabel }}
        onward={{ href: `/${from}`, label: onward }}
      />
    );
  }

  /* The consent's tap comes after its last line: the shelf follows the
     list instead of sticking over it, so on a short phone I agree is
     reached by scrolling past "Under 18?", never before it. */

  if (phase === "consent") {
    return (
      <main className="flex min-h-dvh flex-col px-5 pt-7">
        <ScreenHeader
          title={CONSENT.title}
          subtitle={CONSENT.line}
          back={{ href: `/${from}`, label: backLabel }}
        />
        <div key="consent" className="arrive-x mt-5 pb-8">
          <ConsentList />
        </div>
        <FooterShelf sticky={false}>
          {error && (
            <p role="alert" className="mb-3 text-caption font-semibold text-rust">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void agree()}
            aria-disabled={busy || undefined}
            className={`${ACTION_CLASS} ${DISABLED_CLASS}`}
          >
            {busy ? "Saving…" : CONSENT.agree}
          </button>
          {/* The decline leaves with nothing stored: the code was only
              checked, and no session was made for it. */}
          <div className="mt-1 flex justify-center">
            <Link href={`/${from}`} className="text-link inline-flex min-h-11 items-center px-3">
              {CONSENT.decline}
            </Link>
          </div>
        </FooterShelf>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pt-7">
      <ScreenHeader
        title={CODE_COPY.title}
        subtitle={CODE_COPY.line}
        back={{ href: `/${from}`, label: backLabel }}
      />
      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <CodeField
          inputRef={codeInput}
          value={code}
          invalid={error !== null}
          describedBy={error ? "tester-code-error" : undefined}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
        />
        {/* The line under the cells holds its height, so the answer
            arriving never moves them. */}
        <p
          id="tester-code-error"
          role="alert"
          className="mt-3 min-h-5 text-center text-caption font-semibold text-rust"
        >
          {error ?? ""}
        </p>
        {/* Under the cells, not on a shelf at the foot: a phone's number
            pad has no return key and covers the foot of the screen, so
            the tap stands where the pad leaves it in sight, as the
            sign-in form's does. */}
        <button
          type="submit"
          disabled={!codeReady(code)}
          aria-busy={busy || undefined}
          className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-4`}
        >
          {busy ? CODE_COPY.busy : CODE_COPY.action}
        </button>
      </form>
    </main>
  );
}

/**
 * Four digits as four cells, the introduction's answer object (a filled
 * surface, a 2px edge, a 4px lip): one real field lies over them, so the
 * phone's number pad, paste and one-time-code fill all work, and the
 * cells only draw what it holds. The next cell to fill wears the focus
 * edge while the field has focus.
 */
function CodeField({
  inputRef,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative mx-auto max-w-[296px]">
      <div aria-hidden className="grid grid-cols-4 gap-3">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = value[i] ?? "";
          const active = focused && (i === value.length || (i === CODE_LENGTH - 1 && value.length === CODE_LENGTH));
          return (
            <span
              key={i}
              className={`font-display flex h-16 items-center justify-center rounded-control border-2 border-b-4 bg-surface text-num-m tabular-nums text-ink transition-colors ${
                invalid
                  ? "border-rust"
                  : active
                    ? "border-terracotta-500"
                    : "border-edge"
              }`}
            >
              {digit}
              {active && !digit && <span className="code-caret" />}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        aria-label={CODE_COPY.label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        name="tester-code"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={CODE_LENGTH}
        autoFocus
        value={value}
        onChange={(e) => onChange(codeDigits(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full cursor-text rounded-control text-transparent caret-transparent opacity-0 focus-visible:outline-none!"
      />
    </div>
  );
}

/** What testing keeps, what for, who sees it, how it goes, and the parent. */
function ConsentList() {
  return (
    <dl className="divide-y divide-hairline border-y border-hairline">
      {CONSENT.items.map((item) => (
        <div key={item.lead} className="py-3.5">
          <dt className="font-display text-row text-ink">{item.lead}</dt>
          <dd className="mt-1 text-body text-pretty text-stone-600">
            {"link" in item ? <Linked text={item.text} link={item.link} /> : item.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A consent line with its one word linked: Privacy opens in a new tab
 * (in the installed app, a sheet over it), so the consent and the code
 * typed before it are still here when it closes.
 */
function Linked({ text, link }: { text: string; link: { word: string; href: string } }) {
  const at = text.lastIndexOf(link.word);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        target="_blank"
        rel="noopener"
        className="font-semibold text-ink underline decoration-[color-mix(in_srgb,currentColor_40%,transparent)] underline-offset-2"
      >
        {link.word}
      </a>
      {text.slice(at + link.word.length)}
    </>
  );
}

/**
 * The tester number (lib/tester.ts): how a friend tells Timothy which
 * row in his report is theirs. Read from the session after mount; a
 * phone with no session shows nothing rather than a guess.
 */
function TesterNumber({ className = "" }: { className?: string }) {
  const [number, setNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    void currentSession().then((me) => {
      if (live && me) setNumber(testerNumber(me.userId));
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className={`flex min-h-14 items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="eyebrow">{JOINED_COPY.number}</p>
        <p className="font-display mt-0.5 min-h-7 text-num-m tabular-nums text-ink" aria-live="polite">
          {number ?? ""}
        </p>
      </div>
      {number && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(number)
              .then(() => setCopied(true))
              .catch(() => {});
          }}
          className="press font-display min-h-11 shrink-0 rounded-control border border-edge bg-surface px-4 text-row"
        >
          <span role="status">{copied ? JOINED_COPY.copied : JOINED_COPY.copy}</span>
        </button>
      )}
    </div>
  );
}

function Joined({
  tester,
  moment,
  back,
  onward,
}: {
  tester: TesterRow;
  moment: boolean;
  back: { href: string; label: string };
  onward: { href: string; label: string };
}) {
  /* The date in the device's own words, after mount, so the server's
     render and the phone's agree. */
  const [since, setSince] = useState<string | null>(null);
  useEffect(() => {
    setSince(
      new Date(tester.consented_at).toLocaleDateString(undefined, { day: "numeric", month: "long" })
    );
  }, [tester.consented_at]);

  /* One way back on each (DESIGN 5): the moment's is its tap, onward
     to where the door was; the page of facts keeps the header's back
     and needs no tap of its own. */
  if (moment) {
    return (
      <main className="flex min-h-dvh flex-col px-5 pt-7">
        <ScreenHeader title={JOINED_COPY.title} subtitle={JOINED_COPY.line} />
        {/* The moment it switches on is an arrival, so Demos is there for
            it, on the introduction's stage (mint, as its beat), with one
            line, and the stage takes the room the screen has. The consent
            was the screen before, so it is not said twice. */}
        <div className="intro-stage tone-mint arrive mt-5 flex min-h-0 flex-1 flex-col px-4 pb-5 pt-5">
          <SpeechBubble tail="down" className="mx-auto max-w-[300px] text-center text-balance">
            {JOINED_COPY.demos}
          </SpeechBubble>
          <div className="demos-fit mt-3 w-full flex-1">
            <div className="demos-fit-room">
              <DemosArt pose="celebrate" size={280} fit />
            </div>
          </div>
        </div>
        <TesterNumber className="mt-3 mb-1" />
        {/* The number is what this screen is for, so the shelf follows it
            rather than sitting over it: on a 320x568 phone the stage
            cannot shrink past Demos, and a sticky shelf hid the number. */}
        <FooterShelf hairline={false} sticky={false}>
          <Link href={onward.href} className={ACTION_CLASS}>
            {onward.label}
          </Link>
        </FooterShelf>
      </main>
    );
  }

  /* A return visit from Settings is a page of facts: since when, the
     number, and what was agreed to. */
  return (
    <main className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7">
      <ScreenHeader title={JOINED_COPY.title} subtitle={JOINED_COPY.line} back={back} />
      <p className="mt-5 min-h-5 text-caption text-stone-500">
        {since ? JOINED_COPY.since(since) : ""}
      </p>
      <TesterNumber className="mt-3" />
      <h2 className="section-head mt-7">{JOINED_COPY.agreed}</h2>
      <div className="mt-3">
        <ConsentList />
      </div>
    </main>
  );
}
