/**
 * The lesson art, drawn (26 Sep, Timothy: "change lesson preview photos,
 * modernise them with our simple art style").
 *
 * The risograph pictures were photographs of texture next to flat UI:
 * the only grain in an app of clean tiles and line marks. These are the
 * app's own grammar instead: the icon set's round strokes, the trait's
 * tone on its own wash, one idea per lesson drawn as a shape. Vector,
 * so the tile is sharp at 56px and at 84px, costs no request, and works
 * offline without the service worker holding fifteen files.
 *
 * Colour is the trait's (`[data-trait]` → `--tone`, `--tone-ink`,
 * `--tone-wash`), so the art changes with the palette and never needs
 * cutting again.
 */

const T = "var(--tone)";
const INK = "var(--tone-ink)";
const S = { stroke: T, strokeWidth: 7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const SI = { ...S, stroke: INK };

const ART: Record<string, React.ReactNode> = {
  /* Pausing */
  "the-landing": (
    <>
      <path d="M22 30 Q40 18 58 40" {...S} strokeDasharray="1 12" />
      <circle cx="66" cy="54" r="11" fill={INK} />
      <ellipse cx="66" cy="76" rx="14" ry="3.5" fill={T} opacity="0.45" />
      <path d="M18 76h18M84 76h0" {...S} />
    </>
  ),
  "inside-or-after": (
    <>
      <path d="M18 50h14M40 50h14" {...S} />
      <circle cx="84" cy="50" r="7" fill={INK} />
      <path d="M64 36v28" {...SI} strokeDasharray="2 9" strokeWidth={5} />
    </>
  ),
  "the-long-one": (
    <>
      <circle cx="20" cy="50" r="7" fill={INK} />
      <rect x="32" y="43" width="36" height="14" rx="7" fill={T} opacity="0.5" />
      <circle cx="80" cy="50" r="7" fill={INK} />
    </>
  ),
  /* Fillers */
  "the-cold-open": (
    <>
      <circle cx="50" cy="50" r="28" {...S} />
      <path d="M44 38 L62 50 L44 62 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    </>
  ),
  "closed-mouth": (
    <>
      <path d="M22 44 Q50 30 78 44" {...S} />
      <path d="M22 56 Q50 70 78 56" {...S} />
      <path d="M22 50h56" {...SI} />
    </>
  ),
  "the-crutch": (
    <>
      <path d="M20 58 q8 -18 16 0 q8 18 16 0 q8 -18 16 0 q6 12 12 4" {...S} />
      <path d="M26 30 L74 78" {...SI} />
    </>
  ),
  /* Restarts */
  "finish-it": (
    <>
      <path d="M18 64h44" {...S} />
      <path d="M52 52l12 12-12 12" {...S} />
      <path d="M76 30v48" {...SI} />
      <path d="M76 30h14l-4 7 4 7H76" fill={INK} />
    </>
  ),
  "know-the-landing": (
    <>
      <path d="M18 72 Q34 22 70 58" {...S} strokeDasharray="1 12" />
      <circle cx="74" cy="64" r="14" {...SI} strokeWidth={6} />
      <circle cx="74" cy="64" r="4" fill={INK} />
    </>
  ),
  "or-rather": (
    <>
      <path d="M16 62h30 q10 0 14 -10 l6 -14" {...S} />
      <path d="M16 62h30 q10 0 18 0 h20" {...SI} />
      <path d="M76 52l10 10-10 10" {...SI} />
    </>
  ),
  /* Pace */
  "room-to-land": (
    <>
      <circle cx="16" cy="50" r="5" fill={T} />
      <circle cx="28" cy="50" r="5" fill={T} />
      <circle cx="42" cy="50" r="5" fill={T} />
      <circle cx="60" cy="50" r="5" fill={T} />
      <circle cx="84" cy="50" r="8" fill={INK} />
    </>
  ),
  "one-gear-down": (
    <>
      <path d="M20 68 A30 30 0 1 1 80 68" {...S} />
      <path d="M50 64 L32 48" {...SI} />
      <circle cx="50" cy="64" r="6" fill={INK} />
    </>
  ),
  "change-gear": (
    <>
      <path d="M16 72h22v-16h22v-16h24" {...S} />
      <circle cx="60" cy="40" r="7" fill={INK} />
    </>
  ),
  /* Variety */
  "name-it-once": (
    <>
      <circle cx="34" cy="50" r="17" fill={INK} />
      <circle cx="64" cy="50" r="6" fill={T} />
      <circle cx="78" cy="50" r="4.5" fill={T} opacity="0.7" />
      <circle cx="89" cy="50" r="3" fill={T} opacity="0.5" />
    </>
  ),
  "short-and-concrete": (
    <>
      <rect x="18" y="32" width="28" height="28" rx="7" fill={INK} />
      <path d="M56 72h28" {...S} opacity="0.55" />
      <path d="M18 72h28" {...S} opacity="0.55" />
    </>
  ),
  "second-pass": (
    <>
      <path d="M26 64 A26 26 0 0 1 74 40" {...S} />
      <path d="M30 40 A26 26 0 0 0 76 62" {...SI} />
      <path d="M68 30l7 10-12 3" {...S} />
    </>
  ),
};

export function LessonGlyph({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      <rect width="100" height="100" fill="var(--tone-wash)" />
      <circle cx="78" cy="18" r="34" fill={T} opacity="0.14" />
      {ART[id] ?? <circle cx="50" cy="50" r="14" fill={INK} />}
    </svg>
  );
}
