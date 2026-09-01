import type { ReactNode } from "react";

/**
 * The state a screen is in before it has anything to show — which is the
 * state every screen is in on day one, so it gets designed rather than
 * defaulted. DESIGN-RULES.md, Definition of Done #1.
 *
 * Three rules, and they're the whole component:
 *  - it says what the space is FOR, not that it is empty
 *  - it offers exactly ONE action
 *  - Demos shows up here, because an empty screen is a moment
 *
 * `body` is one sentence (COPY-RULES.md). If it needs two, the mechanic
 * it's explaining belongs where the mechanic happens.
 */
export function EmptyState({
  art,
  title,
  body,
  action,
  className = "",
}: {
  art?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] border border-edge p-6 text-center ${className}`}
    >
      {art}
      <p className="mt-2 text-[14px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-relaxed text-stone-500">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
