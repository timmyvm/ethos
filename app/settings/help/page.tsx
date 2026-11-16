"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Disclosure } from "@/components/ui/Disclosure";
import { LinkRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { FAQ, SUPPORT_EMAIL, WHATS_NEW, problemMailto } from "@/content/settings-help";

/**
 * Help (#479): a person, a short FAQ, a way to report a problem, and
 * what changed lately in a few plain lines (content/settings-help.ts).
 * A question opens in place, as the phone's own disclosure rows do, and
 * its answer is a sentence or two.
 */
export default function HelpPage() {
  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Help" back={{ href: "/settings", label: "Settings" }} />

      <Section title="Contact" className="mt-5">
        <LinkRow href={`mailto:${SUPPORT_EMAIL}`} label="Email us" value={SUPPORT_EMAIL} external />
        <LinkRow href={problemMailto("Settings, Help")} label="Report a problem" external />
      </Section>

      <Section title="Questions">
        {FAQ.map((f) => (
          <details key={f.q} className="group/faq group-row !p-0">
            <summary className="press-row flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="font-display min-w-0 flex-1 text-row">{f.q}</span>
              <span className="dur-base transition-transform group-open/faq:rotate-90">
                <Disclosure />
              </span>
            </summary>
            <p className="px-4 pb-3.5 text-body text-pretty text-stone-600">{f.a}</p>
          </details>
        ))}
      </Section>

      <Section title="What's new">
        {WHATS_NEW.map((w) => (
          <div key={w.line} className="group-row flex gap-3">
            <span className="w-12 shrink-0 text-caption font-semibold tabular-nums text-stone-500">{w.date}</span>
            <span className="min-w-0 flex-1 text-body text-pretty text-stone-800">{w.line}</span>
          </div>
        ))}
      </Section>

      <Section title="About">
        <LinkRow href="/about?from=settings-help" label="What Ethos is" />
      </Section>
    </main>
  );
}
