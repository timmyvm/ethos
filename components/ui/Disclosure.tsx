/**
 * iOS's disclosure mark: a small chevron, pointing where the row goes.
 * Stone-400 by default (wellspoken-lexicon s10): a functional glyph is
 * stone-400 everywhere, and stone-300 (about 1.9:1 on white) is for
 * dividers only.
 */
export function Disclosure({ className = "text-stone-400" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d="m1.5 1.5 5 5.5-5 5.5" />
    </svg>
  );
}
