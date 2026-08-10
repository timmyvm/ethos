import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Image
        src="/demos-asleep.webp"
        alt=""
        width={140}
        height={140}
        className="w-[140px]"
      />
      <div className="font-display mt-4 text-[22px] font-bold">
        Nothing here.
      </div>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-stone-500">
        Demos checked. Twice.
      </p>
      <Link
        href="/"
        className="mt-6 w-full max-w-[300px] rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
      >
        Back to today
      </Link>
    </main>
  );
}
