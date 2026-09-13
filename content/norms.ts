/**
 * The population distributions (DECISIONS #256, #262). What a
 * percentile is measured against.
 *
 * This is the file that decides whether the whole model is honest. A
 * percentile is a claim about everybody else, and the only thing that
 * makes it a measurement rather than a decoration is a real
 * distribution from real published data, with the leaps written down.
 *
 * So every norm carries its sources and its assumptions, and
 * `lib/norms.test.ts` refuses to pass while a norm claims better
 * evidence than it has. `docs/percentiles.md` is the long version: what
 * was searched for, what was found, what the audit sent back, and which
 * of the app's own constants the reading changed.
 *
 * ALL FIVE ARE PROVISIONAL, and that is the finding rather than a
 * placeholder. Four researchers read the primary literature per trait
 * and every one came back with the same shape of answer: the CENTRES
 * are published and convergent, and the between-speaker SPREAD, which
 * is the half a percentile is actually made of, is not. A ring drawn
 * from a centre with a borrowed spread would look exactly like a
 * working feature. So the parameters below are the best estimate
 * available, the ring draws its trough dashed, the card says "scale
 * provisional" in words, and no lesson is chosen on any of them.
 */

import { fromMedian, type Norm } from "@/lib/percentile";
import type { TraitId } from "./traits";

/**
 * How much the PLACEMENT is worth trusting. Never the measurement: what
 * somebody did is known either way, and this is only about whether the
 * population it is being compared to is real.
 *
 *   good         published distributions, with dispersion, on a
 *                population and task close enough to this one
 *   partial      published central values, but the spread is estimated,
 *                or the population is a stretch
 *   provisional  no usable published spread. The UI draws the ring's
 *                TROUGH dashed and says so in words, and `nextTrait`
 *                refuses to send anybody to a lesson on the strength
 *                of it.
 */
export type NormQuality = "good" | "partial" | "provisional";

export interface SourcedNorm extends Norm {
  quality: NormQuality;
  /** Real citations with URLs. Empty is only allowed for provisional. */
  sources: string[];
  /** Every leap from the sources to these parameters. */
  assumptions: string[];
  /** One sentence: why this is not better than provisional yet. */
  blocker?: string;
  /** Set while the numbers are placeholders. The test fails on it. */
  pending?: true;
}

/**
 * Landed pauses a minute: held silences that fall at a boundary.
 *
 * The two thresholds under this number are the best-evidenced constants
 * in the engine, and the placement itself is the oldest replicated
 * result in the field. The POSITION is the part with nothing under it.
 */
const pause: SourcedNorm = {
  ...fromMedian(3.5, 2),
  shape: "lognormal",
  direction: "higher",
  quality: "provisional",
  blocker:
    "Every published pause distribution is a distribution of PAUSES, not of SPEAKERS. A ring needs the between-speaker spread of a per-speaker summary, and for pause placement in L1 English that number appears to be unpublished.",
  sources: [
    "Campione, E. & Véronis, J. (2002). A Large-Scale Multilingual Study of Silent Pause Duration. Speech Prosody 2002, 199-202. http://sprosig.org/sp2002/pdf/campione-veronis.pdf",
    "De Jong, N. H. & Bosker, H. R. (2013). Choosing a threshold for silent pauses to measure second language fluency. DiSS 2013, TMH-QPSR 54(1), 17-20. https://pure.mpg.de/rest/items/item_1900232_6/component/file_1900231/content",
    "Grosjean, F., Grosjean, L. & Lane, H. (1979). The Patterns of Silence. Cognitive Psychology 11, 58-81. https://www.francoisgrosjean.ch/speech_prod/6.%20Grosjean,%20Grosjean%20&%20Lane.pdf",
    "Gilden, D. L. & Mezaraups, T. M. (2022). Laws for Pauses. JEP:LMC 48(1), 139-157. doi:10.1037/xlm0001103",
  ],
  assumptions: [
    "THE CENTRE IS DERIVED, NOT MEASURED. 20 to 22 silent pauses a minute is convergent across four labs and two languages; about 70% fall at major constituent breaks (Grosjean & Deschamps); at Ethos's 0.8s line roughly 24% of all pauses count as held. Multiplying those gives about 3.5 landed pauses a minute. No paper reports that quantity.",
    "THE SPREAD IS INVENTED. ratio84 = 2 is a wide guess chosen to avoid false confidence. Nothing published supports it, and it is the single reason this trait cannot rise above provisional.",
    "ETHOS COUNTS, THE LITERATURE RATIOS. Every placement result in the field is a PROPORTION of pauses at boundaries. Ethos's trait is a COUNT per minute, which moves when somebody talks more as well as when they pause better.",
    "MORE IS ASSUMED BETTER, WITH NO CEILING FOUND. No study identifies a point where additional landed pauses start to cost. That is an absence of evidence, not evidence of absence.",
    "ONE MINUTE IS TOO SHORT. About 20 pauses of which about 5 clear the held line, so a placement of 3 in 5 carries a 95% interval of roughly 15% to 95%.",
    "PAUSE LENGTH SCALES WITH BODY HEIGHT (Gilden), explaining 18 to 36% of the variance, so any duration-based placement partly ranks people by stature.",
    "THE BOUNDARY COMES FROM WHISPER'S PUNCTUATION, not from the acoustics. Final lengthening and pitch reset are the published acoustic markers of a prosodic boundary and Ethos reads neither, so the error in the one thing this trait scores is unmeasured.",
  ],
};

/**
 * Filled pauses per hundred words: um, uh, erm. Not the discourse
 * markers, which are counted, timestamped and never placed (#260).
 *
 * The only trait whose proposal was audited before the session ran out,
 * and the audit changed both parameters: the centre down from 4.53 to
 * 3.0, and the spread UP from 0.75 to 1.0.
 */
const fillers: SourcedNorm = {
  ...fromMedian(3.0, 2.72),
  shape: "lognormal",
  direction: "lower",
  quality: "provisional",
  blocker:
    "The monologue-versus-dialogue direction is genuinely undetermined and worth a factor of two on the centre, and one minute of speech carries about 39 percentile points of Poisson noise on a count of seven.",
  sources: [
    "Clark, H. H. & Fox Tree, J. E. (2002). Using uh and um in spontaneous speaking. Cognition 84(1), 73-111. http://www.columbia.edu/~rmk7/HC/HC_Readings/Clark_Fox.pdf",
    "Bortfeld, H. et al. (2001). Disfluency rates in conversation. Language and Speech 44(2), 123-147. https://heatherbortfeld.com/wp-content/uploads/2016/09/bortfeld_etal_ls2001.pdf",
    "Shriberg, E. (1996). Disfluencies in Switchboard. ICSLP 96 Addendum, 11-14. https://www.sri.com/wp-content/uploads/2021/12/disfluencies_in_switchboard.pdf",
    "Tagliamonte, S. (2005). So who? Like how? Just what? Journal of Pragmatics 37(11), 1896-1915. https://www.gloriacappelli.it/wp-content/uploads/2009/05/youngcanadians.pdf",
  ],
  assumptions: [
    "THE CENTRE IS A CEILING, NOT A MIDPOINT. The English primary cluster is 1.7 to 3.0 per 100 words: Clark & Fox Tree's per-speaker median 1.73 (n=65), Bortfeld 2.56, Switchboard 2.95, the Pear monologue corpus roughly 1.4 to 3.5. That centres near 2.5. It is set at 3.0 because the monologue direction is unresolved and 3.0 leans to the disfluent side of the uncertainty.",
    "THE YOUTH ADJUSTMENT IS ONE STUDY. The only quantified age-on-rate finding anywhere is a parliamentary-speech corpus at IRR 0.862 per decade. Applied to Ethos's band it is worth roughly 1.2 to 1.5x, and it is a single source in another language family.",
    "THE SPREAD IS ENGLISH AND PER-SPEAKER, WHICH IS THE GOOD NEWS. Clark & Fox Tree section 7.3: 65 speakers with over 1,000 words each, 1.2 to 88.5 fillers per 1,000 words, median 17.3. Read as expected extremes for n=65 that gives sigma about 0.99. It is still face-to-face dialogue, not a scored monologue.",
    "MONOLOGUE VERSUS DIALOGUE IS UNDETERMINED AND WORTH A FACTOR OF TWO. Oviatt and Broen & Siegel have monologue MORE fluent; the answering-machine corpus and a secondary report of Roberts have it less. The centre here is a compromise, not a resolution.",
    "NOTHING MEASURES FILLED-PAUSE RATE IN 16 TO 24 YEAR OLDS. Bortfeld's 'young' group has a mean age of 28;10, at or above the top of Ethos's band.",
    "THE SEX GAP IS NOT SETTLED. Bortfeld has men 47% higher and Shriberg replicates the direction; the parliamentary corpus reverses it in two of four languages. One population model is used, which will be wrong for somebody either way.",
    "WHISPER IS NOT A TRAINED TRANSCRIBER. Every source corpus was hand-coded with multiple passes specifically to catch fillers, and transcription convention alone can move this number fourfold.",
    "ZERO IS NOT THE GOAL. Clark and Fox Tree's whole thesis is that uh and um are conventional signals rather than noise. Nothing identifies a floor below which too few becomes a problem; zero is simply outside the observed range, and no copy should imply otherwise.",
  ],
};

/**
 * Restarts per hundred words: a sentence abandoned and begun again a
 * different way. Not verbatim repeats, which `detectRepairs` does not
 * look for.
 */
const repairs: SourcedNorm = {
  ...fromMedian(1.94, 2.72),
  shape: "lognormal",
  direction: "lower",
  quality: "provisional",
  blocker:
    "One published centre, no published spread at all, and Ethos's own raw value is recovered by inverting a score rather than stored.",
  sources: [
    "Bortfeld, H. et al. (2001). Disfluency rates in conversation. Language and Speech 44(2), 123-147, Table 2. https://heatherbortfeld.com/wp-content/uploads/2016/09/bortfeld_etal_ls2001.pdf",
  ],
  assumptions: [
    "ONE SOURCE FOR THE CENTRE. Bortfeld's restart rate of 1.94 per 100 words, from dyadic task-oriented conversation between married, college-educated adults with a mean age of 28;10.",
    "REPEATS ARE EXCLUDED ON PURPOSE. Bortfeld's further 1.47 per 100 words of verbatim repetition is not counted, because `detectRepairs` looks for a phrase restarted with a DIFFERENT landing.",
    "THE SPREAD IS BORROWED FROM FILLERS, which is the thing the fillers audit criticised the fillers proposal for doing. It is done here knowingly and only because restarts have no published spread of any kind, and it is why this trait cannot rise above provisional.",
    "THE RAW VALUE IS RECOVERED, NOT STORED. There is no repairs_per_min column, so the rate is reconstructed by inverting repairScore: exact to about 0.015 a minute, and lower-bounded at the floor, where a score of 0 means 'three a minute or worse' and cannot say which.",
    "DISFLUENCIES MOVE INDEPENDENTLY. Filled pauses are 40 to 45% of all disfluencies and Verdonik's data has fillers and restarts moving in OPPOSITE directions between public and private speech, so this cannot be folded into the filler norm.",
  ],
};

/**
 * Words a minute, silence included: "speaking rate", not articulation
 * rate. The trait with the most real data, and the one whose reading
 * most clearly indicts a shipped constant.
 */
const pace: SourcedNorm = {
  ...fromMedian(148, Math.exp(0.198)),
  shape: "lognormal",
  direction: "band",
  /*
   * 130 to 160 is the app's one zone (#21), kept here so the trait card
   * and the Index cannot disagree about what "in the zone" means. The
   * evidence says it is the 26th to the 65th percentile and should move
   * to roughly 125 to 175 with an asymmetric penalty. That is one
   * change across index-score.ts and this file, made deliberately, not
   * half of it inside a research pass. docs/percentiles.md, Pace.
   */
  band: { lo: 130, hi: 160 },
  quality: "provisional",
  blocker:
    "The centre is solid and four-ways convergent; the spread comes from two indirect estimates agreeing, not from a published one. And the band this is ranked against is known to be in the wrong place.",
  sources: [
    "Bradlow, A. R., Kim, M. & Blasingame, M. (2017). JASA 141(2), 886-899. https://pmc.ncbi.nlm.nih.gov/articles/PMC5848867/",
    "Venkatagiri, H. S. (1999). Clinical measurement of rate of reading and discourse in young adults. Journal of Fluency Disorders 24(3), 209-226. doi:10.1016/S0094-730X(99)00010-8",
    "Jacewicz, E., Fox, R. A. & Wei, L. (2010). JASA 128(2), 839-850. https://u.osu.edu/spalab/files/2017/09/Jacewicz_Fox_Wei_2010-ptcnko.pdf",
    "Yuan, J., Liberman, M. & Cieri, C. (2006). Towards an Integrated Understanding of Speaking Rate in Conversation. INTERSPEECH 2006, 541-544. https://www.isca-archive.org/interspeech_2006/yuan06_interspeech.pdf",
    "Wingrove, P. (2017). How suitable are TED talks for academic listening? JEAP 30, 79-95. doi:10.1016/j.jeap.2017.10.010",
  ],
  assumptions: [
    "THE CENTRE IS FOUR-WAYS CONVERGENT AND THE AUDIT NARROWED WHAT THAT BUYS. Bradlow's 27 first-language speakers at a mean age of 23 give 141 to 146 on Ethos's exact measure; Jacewicz discounted by Bradlow's own pause fraction gives 150 to 160; Yuan's Fisher speakers aged 16 to 28 give about 157 as an upper bound; Venkatagiri was quoted as a direct words-a-minute measurement and the audit found that percentile label attached to different numbers in the source, so route A is withdrawn. Bradlow's own 11% acoustic-syllable under-count was also available and unapplied, which moves two routes up 14 to 20. Read 148 as a rough prior over roughly 145 to 165, not as a point estimate.",
    "THE SPREAD IS TWO INDIRECT ESTIMATES AGREEING, AND THE AUDIT FOUND BOTH DERIVED WRONGLY. A Jordanian young-adult sample at CV 20.4% (right age, wrong language) and Yuan's Switchboard range un-averaged to about 19.7%, where the range-to-deviation divisor used is the constant for a sample of about 500 against Switchboard's 2,438, and the un-averaging assumes two people on a phone call vary independently when the entrainment literature says they converge.",
    "THE SPREAD IS WHAT THE USER ACTUALLY SEES, AND IT IS UNMEASURED. Holding the centre at 148 and sweeping sigma across the plausible range, somebody recorded at 127 words a minute sits anywhere from the 10th percentile to the 32nd. That is the audit's verdict in one line: ship the band change, do not ship the percentile.",
    "SYLLABLES ARE NOT WORDS. Three of the four routes convert through 1.38 syllables per word, derived from studies reporting both units on the same samples.",
    "THE BAND IS TREATED AS SYMMETRIC AND THE EVIDENCE SAYS IT IS NOT. Below about 115 wpm a young speaker is audibly labouring and listeners penalise it. Above, native listeners comprehend at 200 to 250 wpm, TED speakers average 169, and persuasion experiments use 180 as their MODERATE condition. Nothing supports a penalty starting at 161.",
    "THE FAMOUS 150 WPM FIGURE HAS NO FLOOR. It traces to the National Center for Voice and Speech with no paper, no sample, no method and no year. It happens to be close to what the real literature says, which is luck.",
    "A BANDED PERCENTILE RANKS DISTANCE FROM THE MIDDLE, computed in log space here, and treats both sides as costing the same. That is the shakiest structural assumption in the model and the first thing to revisit with real data.",
  ],
};

/**
 * Distinct words per hundred spoken. No researcher was assigned to this
 * one, and the reason it stays provisional is arithmetic rather than a
 * gap in the literature.
 */
const range: SourcedNorm = {
  shape: "normal",
  mu: 58,
  sigma: 9,
  direction: "higher",
  quality: "provisional",
  blocker:
    "Type-token ratio falls as a sample grows, so a figure computed over 150 words is not comparable to a corpus figure computed over thousands. A percentile against a published TTR would be a different measurement wearing the same name.",
  sources: [],
  assumptions: [
    "NO PUBLISHED DISTRIBUTION CAN APPLY. Type-token ratio is length-dependent by construction (Heaps' law), and no published figure is computed over the roughly 150 words a sixty-second recording produces.",
    "THE PARAMETERS ARE A PLACEHOLDER WITH AN HONEST LABEL. 58 distinct words per hundred is the range spontaneous speech typically falls in at this sample length; the spread is a guess. Neither is sourced and the UI says so.",
    "THIS IS THE SAME ERROR AS THE FILLER CONSTRUCT MISMATCH, caught before it shipped rather than after: placing somebody against a number measured a different way.",
    "IT CAN ONLY BE FIXED WITH ETHOS'S OWN RECORDINGS, which are the only sample that matches on length.",
  ],
};

export const NORMS: Record<TraitId, SourcedNorm> = {
  pause,
  fillers,
  repairs,
  pace,
  range,
};
