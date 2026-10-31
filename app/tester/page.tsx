"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { SpeechBubble } from "@/components/SpeechBubble";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SendNumber } from "@/components/tester/SendNumber";
import { CODE_COPY, CONSENT, JOINED_COPY } from "@/content/tester";
import {
  askedFrom,
  CODE_LENGTH,
  codeDigits,
  codeReady,
  isCurrentTester,
  type TesterRow,
} from "@/lib/tester";
import { checkTesterCode, fetchTester, joinTesting, useTesterNumber } from "@/lib/tester-client";
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
 * that agreed to an older consent opens on the new one, with no code to
 * type (the server finds their row): from Settings, or once on their
 * next open (`from=open`, components/tester/TesterLayer.tsx), which
 * goes back to the screen it opened over.
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
  const router = useRouter();
  const fromParam = params.get("from");
  const from: "settings" | "welcome" | "open" =
    fromParam === "settings" ? "settings" : fromParam === "open" ? "open" : "welcome";
  /* Where back goes, after its slash: the door this came through, or,
     for the ask on the way in, the screen it opened over. */
  const backPath = (from === "open" ? askedFrom(params.get("back")) : `/${from}`).slice(1);
  const backHref = `/${backPath}`;
  const backLabel = from === "settings" ? "Settings" : "Back";
  const onward = from === "settings" ? JOINED_COPY.toSettings : JOINED_COPY.toWelcome;

  const [phase, setPhase] = useState<Phase>("reading");
  const [tester, setTester] = useState<TesterRow | null>(null);
  /** A tester on an older consent, reading the new one: no code asked. */
  const [renewing, setRenewing] = useState(false);
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
        if (isCurrentTester(t)) setPhase("joined");
        else if (t) {
          setRenewing(true);
          setPhase("consent");
        } else setPhase("code");
      })
      .catch(() => setPhase("code"));
  }, []);

  /* The words land after the read, behind an empty main, and Chrome's
     scroll anchoring then carried Settings' scroll in: the page opened
     part way down, its title cut and its back link off screen. Once
     the read lands, it stands at its top. */
  const reading = phase === "reading";
  useLayoutEffect(() => {
    if (!reading) window.scrollTo(0, 0);
  }, [reading]);

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
    const answer = await joinTesting(renewing ? null : code);
    setBusy(false);
    if (answer.ok && answer.tester) {
      setTester(answer.tester);
      if (renewing && from === "open") {
        // Asked on the way in: carry on where they were.
        router.replace(backHref);
        return;
      }
      // A first agree is the moment; agreeing again is just the facts.
      setJustJoined(!renewing);
      setRenewing(false);
      setPhase("joined");
      window.scrollTo({ top: 0 });
    } else if (!answer.ok) {
      // A wrong code here means the screen sat open while it changed, or
      // the row a renewing tester had is gone: back to the code, which
      // says so.
      if (answer.status === 403) {
        setCode("");
        setRenewing(false);
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
        back={{ href: `/${backPath}`, label: backLabel }}
        onward={{ href: backHref, label: onward }}
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
          subtitle={renewing ? CONSENT.renewLine : CONSENT.line}
          back={{ href: `/${backPath}`, label: backLabel }}
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
            <Link href={backHref} className="text-link inline-flex min-h-11 items-center px-3">
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
        back={{ href: `/${backPath}`, label: backLabel }}
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
        /* No maxLength: it would cut a paste (" 1234", "Code: 1234") to
           its first four characters before codeDigits picks out the
           digits, which already keeps four at most. */
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

/**
 * What testing keeps (every item named, consent version 3), then what
 * for, who sees it, how long, how it goes, and the parent: one list of
 * leads, the first holding the named list as lines of its own.
 */
function ConsentList() {
  return (
    <dl className="divide-y divide-hairline border-y border-hairline">
      <div className="py-3.5">
        <dt className="font-display text-row text-ink">{CONSENT.keptLead}</dt>
        <dd className="mt-1.5">
          <ul className="list-disc space-y-2 pl-5 marker:text-stone-300">
            {CONSENT.kept.map((k) => (
              <li key={k.lead} className="text-body text-pretty text-stone-600">
                <span className="font-semibold text-ink">{k.lead}.</span> {k.text}
              </li>
            ))}
          </ul>
        </dd>
      </div>
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
 * row in his report is theirs, with Send (the share sheet, the number
 * typed in, #402) or Copy where the phone has none. Read from the
 * session after mount; a phone with no session shows nothing rather
 * than a guess.
 */
function TesterNumber({ className = "" }: { className?: string }) {
  const number = useTesterNumber() ?? null;
  return (
    <div className={`flex min-h-14 items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="eyebrow">{JOINED_COPY.number}</p>
        <p className="font-display mt-0.5 min-h-7 text-num-m tabular-nums text-ink" aria-live="polite">
          {number ?? ""}
        </p>
      </div>
      {/* Sent and Copied are said from beside the key (SendNumber). */}
      {number && <SendNumber number={number} />}
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
