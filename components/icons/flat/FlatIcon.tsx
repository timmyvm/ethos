import { useId } from "react";
import { FLAT_ICONS, fitTransform, type FlatKind, type Shape } from "./geometry";
import "./flat-icons.css";

/**
 * A flat icon (workbench only: app/workbench/icons is the one page that
 * draws these; nothing in the app does yet).
 *
 * The same drawing in every variant: `variant` only names which set of
 * tones the CSS reads (`.fi-a`, `.fi-b` in flat-icons.css). Each layer is
 * its own named group (`data-part`: base, shade, light, and the object's
 * own parts), filled from `--fi-<kind>-<role>`, so a token swaps a tone
 * and a part can pop or bounce on its own without a raster.
 *
 * The size ladder: under 24px an icon is its base and shade only (the
 * light leaves, as Duolingo's own small art drops detail before it
 * blurs); a light thinner than 8u waits for 32px.
 *
 * Decoration: `aria-hidden`, because the number or the name beside it
 * carries the words, as StatIcon's `alt=""` does.
 *
 *   <FlatIcon kind="streak" variant="b" size={22} lit={false} />
 */
export function FlatIcon({
  kind,
  variant,
  size = 24,
  lit = true,
  className = "",
}: {
  kind: FlatKind;
  variant: "a" | "b";
  /** CSS px, square. */
  size?: number;
  /** False draws the streak unlit (its own grey tones, not a filter). */
  lit?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const def = FLAT_ICONS[kind];
  const layers = def.layers.filter((l) => size >= (l.minPx ?? 0));
  /* One clip per distinct list of parts: a shade stays inside the union of what it names. */
  const clips = new Map<string, readonly string[]>();
  for (const l of layers) if (l.clip) clips.set(l.clip.join("-"), l.clip);
  const transform = fitTransform(def);
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      data-kind={kind}
      data-lit={lit ? undefined : "false"}
      className={`fi fi-${variant} ${className}`}
    >
      <g transform={transform}>
        {clips.size > 0 && (
          <defs>
            {[...clips].map(([key, parts]) => (
              <clipPath key={key} id={`${uid}-${key}`}>
                {def.layers
                  .filter((m) => parts.includes(m.part))
                  .flatMap((m) => m.shapes)
                  .map((s, i) => (
                    <ShapeEl key={i} s={s} />
                  ))}
              </clipPath>
            ))}
          </defs>
        )}
        {layers.map((l) => (
          <g
            key={l.part}
            data-part={l.part}
            fill={`var(--fi-${kind}-${l.tone})`}
            clipPath={l.clip ? `url(#${uid}-${l.clip.join("-")})` : undefined}
          >
            {l.shapes.map((s, i) => (
              <ShapeEl key={i} s={s} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

function ShapeEl({ s }: { s: Shape }) {
  if (s.kind === "circle") return <circle cx={s.cx} cy={s.cy} r={s.r} />;
  if (s.kind === "path")
    return <path d={s.d} fillRule={s.evenodd ? "evenodd" : undefined} clipRule={s.evenodd ? "evenodd" : undefined} />;
  const r = s.r ?? Math.min(s.w, s.h) / 2;
  return (
    <rect
      x={s.cx - s.w / 2}
      y={s.cy - s.h / 2}
      width={s.w}
      height={s.h}
      rx={r}
      transform={s.angle ? `rotate(${s.angle} ${s.cx} ${s.cy})` : undefined}
    />
  );
}
