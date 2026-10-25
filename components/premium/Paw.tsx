/**
 * Demos's paw print: four toes and a pad, the token on the step you
 * stand on (docs/ladder-spec.md). It is his mark on the ladder, so he is
 * present at the price without standing on it as furniture. Filled in
 * currentColor, sized by its container.
 */
export function Paw({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <ellipse cx="5.4" cy="10.6" rx="2.3" ry="2.9" transform="rotate(-24 5.4 10.6)" />
      <ellipse cx="9.6" cy="5.9" rx="2.35" ry="3" transform="rotate(-8 9.6 5.9)" />
      <ellipse cx="14.4" cy="5.9" rx="2.35" ry="3" transform="rotate(8 14.4 5.9)" />
      <ellipse cx="18.6" cy="10.6" rx="2.3" ry="2.9" transform="rotate(24 18.6 10.6)" />
      <path d="M12 11.2c-2.9 0-6.6 4.3-6.6 7 0 1.9 1.5 2.8 3.2 2.8 1.4 0 2.2-.65 3.4-.65s2 .65 3.4.65c1.7 0 3.2-.9 3.2-2.8 0-2.7-3.7-7-6.6-7z" />
    </svg>
  );
}
