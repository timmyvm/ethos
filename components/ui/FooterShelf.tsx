import type { ReactNode } from "react";

/**
 * The shelf a flow's one tap stands on at the bottom of the screen: the
 * walk's footer (A3), results (B4), the introduction (B12). It sticks to
 * the bottom of the scrolling column on the ground colour, so content
 * scrolls under it and the tap never moves, and it clears the home
 * indicator. A hairline says where the content stops; pass
 * `hairline={false}` where the ground above is already open.
 *
 * It reaches out over the screen's px-5 gutter itself (-mx-5 px-5), so a
 * screen drops it in as the last child of its column and nothing else.
 * `mt-auto` pushes it down a flex column that is shorter than the screen.
 *
 *   <FooterShelf><button className={ACTION_CLASS}>Next</button></FooterShelf>
 */
export function FooterShelf({
  children,
  hairline = true,
  className = "",
}: {
  children: ReactNode;
  hairline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-5 mt-auto bg-ground px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
        hairline ? "border-t border-hairline" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
