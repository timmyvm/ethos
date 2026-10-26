import type { CSSProperties, ReactNode } from "react";
import { TRAIT, type TraitId } from "@/content/traits";

/**
 * The hero stage: the one material every tab opens on (the cohesion
 * pass, 26 Oct; docs/refs/feedback/2026-10-25-dark-tabs.md).
 *
 * A first-time tester went through the five tabs in dark and said "none
 * of the pages match really": each tab had its own colour world (an
 * amber floor card, a deep sage score card, a grey identity card, a
 * wall of candy icons), and the one she liked was Practice, a sky stage
 * holding Demos over one terracotta tap with everything else neutral.
 * So Practice's stage is the house grammar, and this is it, once:
 *
 *  - the material: the introduction's sky (`.intro-stage.tone-sky`), lit
 *    from above with a floor band, at the sheet radius
 *    (`.practice-stage`), the screen's one `elev-2`, p-5, 160px at least;
 *  - the grammar: an eyebrow, a title, one line or number at the foot,
 *    and the art at the right standing on the stage's floor. The words
 *    keep to the left 60% so the art has its room.
 *
 * Nothing on the stage is the tap. A tab that has one puts it on the
 * ground under the stage, edge to edge with it, as Practice does.
 */
export function HeroStage({
  eyebrow,
  title,
  line,
  art,
  artSize = 132,
  corner,
  children,
  titleId,
  label,
  className = "",
  minHeight,
  eyebrowWide = false,
  artBleed = false,
  artFluid = false,
  ...rest
}: {
  /** Sentence case, the stage's ink. A node, so a trait chip can lead it. */
  eyebrow?: ReactNode;
  /** The stage's title: Outfit 26/800 in ink. */
  title?: ReactNode;
  /** One line or number at the stage's foot. Strings take the stage ink. */
  line?: ReactNode;
  /** The picture at the right, standing on the floor (bottom-right). */
  art?: ReactNode;
  /** The art's square, in px. Practice's Demos is 132. */
  artSize?: number;
  /** Top-right controls (Today's spin and difficulty glyphs). */
  corner?: ReactNode;
  /** Anything between the title and the line (a number row, a bar). */
  children?: ReactNode;
  titleId?: string;
  /** An accessible name for the stage when its title is not a heading. */
  label?: string;
  className?: string;
  /** A taller floor, for a stage whose words run long (Today's prompt). */
  minHeight?: number;
  /** The eyebrow spans the stage's width up to the corner (a node only). */
  eyebrowWide?: boolean;
  /**
   * The art runs to the stage's edge and its corner clips it (the Log's
   * hill, whose fill would otherwise stop in a hard vertical cut short of
   * the edge). A figure stands 2px up and 4px in instead.
   */
  artBleed?: boolean;
  /**
   * The art may narrow to 38% of the stage on a small phone (the Log's
   * hill, which would otherwise run under the words at 320px). Its own
   * drawing scales to fit.
   */
  artFluid?: boolean;
  "data-trait"?: string;
  "data-look"?: string;
}) {
  /* A figure (Demos, a lesson's object) holds its own square; the words
     keep clear of it as well as to their 60%, because at 320px 60% of
     the stage reached 20px into his tail (the fix round). A fluid art
     (the hill) narrows itself instead. `--art` is the figure's square,
     which `.hero-stage` scales down under 360px (`--art-k`). */
  const figure = !!art && !artFluid;
  const style = {
    ...(minHeight ? { minHeight } : {}),
    ...(figure ? { "--art": `${artSize}px` } : {}),
  } as CSSProperties;
  return (
    <div
      {...rest}
      role={label ? "group" : undefined}
      aria-label={label}
      data-figure={figure || undefined}
      className={`intro-stage tone-sky practice-stage hero-stage elev-2 flex min-h-[160px] flex-col p-5 ${className}`}
      style={style}
    >
      {/* A wide eyebrow (a chip and a lead) runs to the corner's edge
          rather than wrapping inside the words' 60%. */}
      {eyebrowWide && eyebrow !== undefined && (
        <div className="relative z-[2] min-w-0 pr-16">{eyebrow}</div>
      )}
      <div className="hero-words relative z-[2] flex min-w-0 flex-1 flex-col">
        {!eyebrowWide &&
          eyebrow !== undefined &&
          (typeof eyebrow === "string" ? (
            <p className="eyebrow stage-ink">{eyebrow}</p>
          ) : (
            eyebrow
          ))}
        {title !== undefined && (
          <h2 id={titleId} className="font-display mt-1.5 text-title font-extrabold">
            {title}
          </h2>
        )}
        {children}
        {line !== undefined &&
          (typeof line === "string" ? (
            <p className="stage-ink font-display mt-auto pt-3 text-link font-bold">{line}</p>
          ) : (
            line
          ))}
      </div>
      {corner && <div className="absolute right-3 top-3 z-[3] flex">{corner}</div>}
      {art && (
        <div
          aria-hidden
          className={`absolute z-[1] ${artBleed ? "bottom-0 right-0" : "bottom-[2px] right-1"} ${
            figure ? "hero-figure" : ""
          }`}
          style={{ width: artFluid ? `min(${artSize}px, 38%)` : artSize, height: artSize }}
        >
          {art}
        </div>
      )}
    </div>
  );
}

/**
 * A trait on the stage: the quiet pill (`.stage-chip`), the trait's 8px
 * mark and its name in the stage's ink. The solid tone chip
 * (`TraitChip`) stays for the screens off the bar.
 */
export function StageChip({ trait }: { trait: TraitId }) {
  return (
    <span data-trait={trait} className="stage-chip font-display text-caption font-bold leading-none">
      <span aria-hidden className="trait-dot" />
      {TRAIT[trait].name}
    </span>
  );
}
