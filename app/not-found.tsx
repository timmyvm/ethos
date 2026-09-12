import Image from "next/image";
import Link from "next/link";

/* `ACTION_CLASS` (components/LessonScreen.tsx), copied: that module is
   a client component, and a string imported from one into a server page
   arrives as a client reference rather than the class. */
const BACK_TO_TODAY =
  "press font-display block min-h-12 w-full rounded-control bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-on-accent transition-colors hover:bg-terracotta-600";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Image
        src="/demos-asleep.webp"
        alt=""
        width={140}
        height={140}
        className="demos w-[140px]"
      />
      <h1 className="font-display mt-5 text-title">Nothing here.</h1>
      <p className="mt-2 max-w-[280px] text-body leading-relaxed text-stone-500">
        Demos checked. Twice.
      </p>
      <Link href="/" className={`${BACK_TO_TODAY} mt-7 max-w-[300px]`}>
        Back to today
      </Link>
    </main>
  );
}
