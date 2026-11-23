import { createElement, useId } from "react";
import { drawingPlan, shapeElement, type FlatIconDef, type Shape } from "./primitives";
import "./flat-icons.css";

/**
 * One flat drawing as inline SVG: what FlatIcon (the stat icons) and
 * FlatLessonIcon (the lessons' objects) both render. It reads the same
 * plan as the SVG string (primitives.ts `drawingPlan`), so a page and an
 * exported file never draw a different icon.
 *
 * Each layer is its own named group (`data-part`: base, shade, light, and
 * the object's own parts), filled from `--fi-<kind>-<role>`
 * (flat-icons.css), so a token swaps a tone and a part can pop or bounce
 * on its own without a raster.
 *
 * Decoration: `aria-hidden`, because the number or the name beside it
 * carries the words.
 */
export function FlatDrawing({
  kind,
  def,
  size,
  lit = true,
  fallback,
  className = "",
}: {
  /** The name its tones are read under: `--fi-<kind>-<role>`. */
  kind: string;
  def: FlatIconDef;
  /** CSS px, square. Under 24px the light leaves (the size ladder). */
  size: number;
  /** False draws it in its unlit greys (flat-icons.css), never a filter. */
  lit?: boolean;
  /**
   * Each role's hex where the stylesheet is missing (stat-tones.ts), the
   * fallback in `var(--fi-<kind>-<role>, <hex>)`: a stat mark offline
   * before its CSS was kept would otherwise draw black.
   */
  fallback?: Readonly<Record<string, string>>;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const plan = drawingPlan(def, size, uid);
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      data-kind={kind}
      data-lit={lit ? undefined : "false"}
      className={className ? `fi ${className}` : "fi"}
    >
      <g transform={plan.transform}>
        {plan.clips.length > 0 && (
          <defs>
            {plan.clips.map((c) => (
              <clipPath key={c.id} id={c.id}>
                <Shapes shapes={c.shapes} />
              </clipPath>
            ))}
          </defs>
        )}
        {plan.layers.map((l) => (
          <g
            key={l.part}
            data-part={l.part}
            fill={fallback?.[l.tone] ? `var(--fi-${kind}-${l.tone}, ${fallback[l.tone]})` : `var(--fi-${kind}-${l.tone})`}
            clipPath={l.clipId ? `url(#${l.clipId})` : undefined}
          >
            <Shapes shapes={l.shapes} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Shapes({ shapes }: { shapes: readonly Shape[] }) {
  return shapes.map((s, i) => {
    const el = shapeElement(s);
    return createElement(el.tag, { key: i, ...el.attrs });
  });
}
