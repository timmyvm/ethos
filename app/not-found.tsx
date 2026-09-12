import Image from "next/image";
import { ACTION_CLASS as BACK_TO_TODAY } from "@/lib/ui";
import Link from "next/link";


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
