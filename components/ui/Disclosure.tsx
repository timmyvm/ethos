/** iOS's disclosure mark: a small chevron, pointing where the row goes. */
export function Disclosure({ className = "text-stone-300" }: { className?: string }) {
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
