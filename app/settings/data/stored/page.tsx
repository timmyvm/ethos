import Link from "next/link";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { InfoRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { STORED } from "@/content/settings-help";

/**
 * What Ethos keeps (#479): the privacy page's list (#452) as Settings'
 * rows, in three groups, with the whole policy one tap away. Static.
 */
export default function StoredPage() {
  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="What Ethos keeps" back={{ href: "/settings/data", label: "Privacy and data" }} />

      <Section title="On your account" className="mt-5" footer="Kept until you delete them or the account.">
        {STORED.account.map((s) => (
          <InfoRow key={s.label} label={s.label} note={s.note} />
        ))}
      </Section>

      <Section title="On this phone only">
        {STORED.phone.map((s) => (
          <InfoRow key={s.label} label={s.label} note={s.note} />
        ))}
      </Section>

      <Section title="Who handles it" footer="Nothing is sold.">
        {STORED.services.map((s) => (
          <InfoRow key={s.label} label={s.label} note={s.note} />
        ))}
      </Section>

      <p className="mt-5 text-center">
        <Link href="/privacy?from=settings-stored" className="press inline-flex min-h-11 items-center px-3 text-caption font-semibold text-stone-500">
          Read the privacy policy
        </Link>
      </p>
    </main>
  );
}
