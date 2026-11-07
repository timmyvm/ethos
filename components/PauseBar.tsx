import { IconBubble } from "@/components/Icon";
import type { Pause } from "@/lib/metrics";
import type { PauseVerdict } from "@/lib/pause-quality";

/** Stored rows carry a verdict once they've been judged. */
type MaybeJudged = Pause & { verdict?: PauseVerdict };

interface Seg {
  type: "speech" | "pause" | "mark";
  len: number;
  kind?: Pause["kind"];
  verdict?: PauseVerdict;
}

/** The marks, one class each, shared by the bar and its legend, so the
    legend is the mark rather than a picture of it (recording-24, #304).
    A searching pause is hollow, so it differs from the speech ticks by
    fill as well as by width. On the raised card (D52) every mark holds
    3:1 against the card in both themes (lib/pause-map.test.ts): speech
    stone-400, landed sage-600, searching a 1.5px ink outline. */
export const SPEECH_MARK = "bg-stone-400";
export const LANDED_MARK = "bg-sage-600";
export const SEARCHING_MARK = "border-[1.5px] border-ink bg-transparent";

/** Whether a held pause landed a point: the verdict when there is one,
    the old kind check for rows recorded before verdicts existed. */
const landed = (p: { kind?: Pause["kind"]; verdict?: PauseVerdict }) =>
  p.verdict ? p.verdict === "landing" || p.verdict === "opening" : p.kind === "pre";

/**
 * The signature element (DECISIONS.md #8): silence rendered sage as
 * achievement.
 *
 * Sage is EARNED, so it follows the verdict rather than the raw kind. A
 * pre-sentence pause with an "um" leaning on it, or one that ran into
 * dead air, is still a pre-sentence pause — but it isn't an
 * achievement, and painting it as one was the same flattery the pause
 * score itself was guilty of. Rows recorded before the verdicts existed
 * fall back to the old kind check.
 *
 * The eyebrow names the thing and nothing else (log-10, recording-11):
 * the legend carries what the colours mean, once.
 */
export function PauseBar({
  pauses,
  durationS,
  marks = [],
}: {
  pauses: MaybeJudged[];
  durationS: number;
  /**
   * Moments to stand on the map (the games plan, item 4): when Demos cut
   * in, as a 2px ink rule at its second, with its line under the bar,
   * so the answer pause reads beside the thing it answered.
   */
  marks?: { t: number; label: string }[];
}) {
  const segs: Seg[] = [];
  const pending = [...marks].filter((m) => Number.isFinite(m.t)).sort((a, b) => a.t - b.t);
  // Speech runs render as ticks sized so the whole rep fits one row,
  // with height varied deterministically for texture.
  const tick = Math.max(1.6, durationS / 34);
  const speech = (len: number) => {
    const ticks = Math.max(1, Math.round(len / tick));
    for (let i = 0; i < ticks; i++) {
      segs.push({ type: "speech", len: 2 + Math.sin(segs.length * 2.7) });
    }
  };
  /* Speech up to `to`, with any mark that falls inside it set at its
     second; a mark inside a pause stands at the pause's start. */
  let cursor = 0;
  const speechTo = (to: number) => {
    while (pending.length && pending[0].t <= to) {
      const m = pending.shift()!;
      if (m.t > cursor) speech(m.t - cursor);
      segs.push({ type: "mark", len: 0 });
      cursor = Math.max(cursor, m.t);
    }
    if (to > cursor) speech(to - cursor);
  };
  for (const p of pauses) {
    speechTo(p.t);
    segs.push({ type: "pause", len: p.len, kind: p.kind, verdict: p.verdict });
    cursor = p.t + p.len;
  }
  speechTo(Math.max(durationS, cursor));

  // The bar's text alternative: held pauses exclude beats.
  const held = pauses.filter((p) => p.kind !== "beat");
  const landedCount = held.filter(landed).length;
  const searchingCount = held.length - landedCount;

  return (
    /* D52: a raised `.card` that follows the theme, like every other
       card on the numbers step; the dark stage panel was the only black
       card in the light theme. */
    <div className="card px-4 pb-3.5 pt-4">
      <div className="eyebrow">Pauses</div>
      <div
        role="img"
        aria-label={`${held.length} held pause${held.length === 1 ? "" : "s"}, ${landedCount} landed a point`}
        className="forced-color-adjust-none mt-3 flex h-14 items-center gap-[3px] overflow-hidden"
      >
        {clip(segs).map((s, i) => {
          if (s.type === "mark") {
            return <span key={i} aria-hidden className="h-full w-[2px] shrink-0 bg-ink" />;
          }
          if (s.type === "speech") {
            return (
              <span
                key={i}
                aria-hidden
                className={`min-w-[2px] shrink ${SPEECH_MARK}`}
                style={{ flex: "0 1 5px", height: 16 + Math.min(34, s.len * 11) }}
              />
            );
          }
          if (s.kind === "beat") {
            return (
              <span
                key={i}
                aria-hidden
                className={`h-1.5 min-w-[3px] shrink ${SPEECH_MARK}`}
                style={{ flex: "0 1 6px" }}
              />
            );
          }
          return (
            <span
              key={i}
              aria-hidden
              className={`h-3 min-w-[8px] shrink ${
                landed(s) ? LANDED_MARK : SEARCHING_MARK
              }`}
              style={{ flex: `0 1 ${Math.min(34, 12 + s.len * 10)}px` }}
            />
          );
        })}
      </div>
      {(held.length > 0 || marks.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-stone-500">
          {marks.map((m, i) => (
            <span key={`m${i}`} className="inline-flex items-center gap-1.5 text-ink">
              <span aria-hidden className="inline-flex">
                <IconBubble size={14} />
              </span>
              {m.label}
            </span>
          ))}
          {landedCount > 0 && (
            <span aria-hidden className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-2.5 ${LANDED_MARK}`} />
              landed a point
            </span>
          )}
          {searchingCount > 0 && (
            <span aria-hidden className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-2.5 ${SEARCHING_MARK}`} />
              searching
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The most marks the bar holds: at 390 each is 2px or more with a 3px gap. */
const MAX_MARKS = 48;

/**
 * The bar fitted to MAX_MARKS without losing a pause (review of #424).
 * It used to keep the first 48 marks, so a take with more than about 24
 * gaps lost its tail, and the Pause row under it named moments the map
 * never drew. Speech gives way first, thinned across the whole take so
 * each run between two pauses keeps a tick; then the beats, drawn in
 * speech's grey, fold into the speech around them. Every held pause and
 * every cut-in stays. A take with more held pauses than the bar has room
 * for loses the ones that landed first, so a pause the row names is
 * always hollow on the map.
 */
function clip(segs: Seg[]): Seg[] {
  if (segs.length <= MAX_MARKS) return segs;
  const thinned = thin(segs);
  if (thinned.length <= MAX_MARKS) return thinned;
  const unbeaten = segs.filter((s) => !(s.type === "pause" && s.kind === "beat"));
  const folded = thin(unbeaten);
  if (folded.length <= MAX_MARKS) return folded;
  return crowd(unbeaten);
}

/** Each run of speech cut to its share of the room left, one tick at least. */
function thin(segs: Seg[]): Seg[] {
  const items: (Seg | Seg[])[] = [];
  for (const s of segs) {
    const last = items[items.length - 1];
    if (s.type !== "speech") items.push(s);
    else if (Array.isArray(last)) last.push(s);
    else items.push([s]);
  }
  const runs = items.filter((it): it is Seg[] => Array.isArray(it));
  const extra = MAX_MARKS - (items.length - runs.length) - runs.length;
  const spare = runs.reduce((n, r) => n + r.length - 1, 0);
  return items.flatMap((it) => {
    if (!Array.isArray(it)) return [it];
    const share = extra > 0 && spare > 0 ? Math.floor(((it.length - 1) * extra) / spare) : 0;
    return it.slice(0, 1 + Math.min(it.length - 1, share));
  });
}

/** More held pauses than room: they and the cut-ins first, landed ones last, then speech spread over what is left. */
function crowd(segs: Seg[]): Seg[] {
  const marks = segs.flatMap((s, i) => (s.type === "speech" ? [] : [i]));
  const speech = segs.flatMap((s, i) => (s.type === "speech" ? [i] : []));
  marks.sort((a, b) => Number(landed(segs[a])) - Number(landed(segs[b])) || a - b);
  const kept = new Set(marks.slice(0, MAX_MARKS));
  const room = Math.min(MAX_MARKS - kept.size, speech.length);
  for (let k = 0; k < room; k++) kept.add(speech[Math.round(((k + 1) * speech.length) / room) - 1]);
  return segs.filter((_, i) => kept.has(i));
}
