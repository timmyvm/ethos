"use client";

import { Fragment, useId, type ReactNode } from "react";
import { cueClock, cueTitle, warmupLead, warmupPieces, warmupSentence, type Cue } from "@/lib/carried-cue";

/**
 * The warm-up on the cue carried from yesterday (#477, plan section 9,
 * idea 2): on the ready recorder, before Record, in the tactic's place,
 * so the one thing to think about is the cue alone. The number behind it,
 * what to do instead, and one sentence to say with the pause marked where
 * the filler was, the take's own words where it kept them. Optional: Skip
 * is one tap, Record works from the first frame, and nothing is recorded,
 * scored or sent.
 */
export function CueWarmup({ cue, onSkip, className = "" }: { cue: Cue; onSkip: () => void; className?: string }) {
  const pieces = warmupPieces(warmupSentence(cue));
  const at = cue.line?.at;
  const titleId = useId();
  /* The mark never ends a line on its own: it is held to the word after
     it ("‖ they compound."), so a wrap reads as the pause leading in. */
  const said: ReactNode[] = [];
  pieces.forEach((p, i) => {
    if (p.kind === "words") {
      if (pieces[i - 1]?.kind === "pause") return;
      said.push(<span key={i}>{p.text}</span>);
      return;
    }
    const next = pieces[i + 1];
    const words = next?.kind === "words" ? next.text : "";
    const cut = words.indexOf(" ");
    const head = cut === -1 ? words : words.slice(0, cut);
    const rest = cut === -1 ? "" : words.slice(cut);
    said.push(
      <Fragment key={i}>
        {i > 0 ? " " : ""}
        <span className="whitespace-nowrap">
          <PauseMark />
          {head ? ` ${head}` : ""}
        </span>
        {rest}
        {words && pieces[i + 2] ? " " : ""}
      </Fragment>
    );
  });
  return (
    /* Named by what to do (the #477 review), not "Warm up": the region a
       screen reader lands on says the cue itself. */
    <section data-warmup aria-labelledby={titleId} className={className}>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow min-w-0">{warmupLead(cue)}</p>
        <button type="button" onClick={onSkip} className="text-link -my-3 shrink-0 py-3">
          Skip
        </button>
      </div>
      <h2 id={titleId} className="detail-head mt-0.5 text-balance">{cueTitle(cue)}</h2>
      <p data-warmup-line className="mt-1.5 text-body leading-snug text-balance text-ink">
        “{said}”
      </p>
      {/* Under 600pt tall (320x568) the line goes, so Record stays on the first screen. */}
      <p className="mt-1 text-caption text-stone-500 [@media(max-height:600px)]:hidden">
        {typeof at === "number" ? `Your words at ${cueClock(at)}. ` : ""}Say it twice, out loud.
      </p>
    </section>
  );
}

/**
 * Where the pause goes: a gap drawn as two short bars in Pausing's tone,
 * named "pause" for a screen reader (a shape is never the whole message).
 */
function PauseMark() {
  return (
    <span data-trait="pause" className="pause-mark" role="img" aria-label="pause">
      <i />
      <i />
    </span>
  );
}
