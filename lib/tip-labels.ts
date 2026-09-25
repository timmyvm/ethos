/**
 * The glanceable face of every tactic (feedback round, 25 Sep).
 *
 * A first-time user in the target audience looked at the recording
 * screen's three numbered sentences and said she would not read them.
 * The sentences stay (they are the substance, and they open on tap);
 * what the screen SHOWS is this: at most five words and a glyph, so the
 * three tactics can be taken in in the time it takes to look at them.
 *
 * Keyed on the exact sentence, because the sentences live in six content
 * files (traits, shapes, drills, games, units, lessons) and are composed
 * into 120 path items. `lib/tip-labels.test.ts` walks every one of those
 * sources and fails on a tactic with no label here, so a new sentence
 * cannot ship as a wall of text by accident.
 */

export type TipGlyph = "pause" | "start" | "end" | "slow" | "word" | "one" | "cut";

export interface TipFace {
  label: string;
  glyph: TipGlyph;
}

const L: Record<string, [string, TipGlyph]> = {
  // content/traits.ts
  "The beat goes after the full stop, before the next idea. Inside a sentence it reads as searching.": ["Pause after the full stop", "pause"],
  "One to two seconds reads as command. Past three and a half it costs you.": ["Hold one to two seconds", "pause"],
  'Do not fill it. A pause with an "um" leaning on it earns nothing.': ["Leave the silence empty", "cut"],
  "Close your mouth at the end of a clause. Most fillers happen with it already open.": ["Close your mouth", "cut"],
  "Slow the run-up, not the words. Fillers cluster where the sentence starts.": ["Slow the run-up", "slow"],
  "Let the gap sit. One second of silence costs nothing and buys the next sentence.": ["Let the gap sit", "pause"],
  "Finish the sentence you started, even when you can hear a better one.": ["Finish every sentence", "end"],
  'Say the correction as a new sentence: "Or rather," then the better version.': ['Fix it with "or rather"', "word"],
  "Decide the ending before the beginning. Most restarts are a sentence with nowhere to land.": ["Know the ending first", "end"],
  "Slow the sentence that carries the point, and only that one.": ["Slow the key sentence", "slow"],
  "Speed is a tool for the middle of a list and a liability at the end of an argument.": ["Never rush the ending", "slow"],
  "If you are rushing, you are usually afraid of the silence. Take the silence.": ["Rushing? Take the silence", "pause"],
  "Name the thing once properly, then use a pronoun. Repeating the full phrase is what reads as padding.": ["Name it once", "word"],
  "Your crutch word is the one you cannot hear. The recording can.": ["Catch your crutch word", "word"],
  "A short concrete noun beats a long abstract one every time.": ["Short, concrete nouns", "word"],

  // lib/topics.ts, TOPIC_SHAPES
  "Say your position in the first sentence. Don't warm up to it.": ["Your side, sentence one", "start"],
  "One reason, one example, then stop.": ["One reason, one example", "one"],
  "Name the strongest objection and answer it in a line.": ["Answer the best objection", "word"],
  "Start in the middle of the action, not the background.": ["Start mid-action", "start"],
  "One scene. Resist covering the whole week.": ["One scene only", "one"],
  "End on what changed, not on 'so yeah'.": ["End on what changed", "end"],
  "Open with what it IS in one sentence.": ["Say what it is", "start"],
  "One comparison to something they already know.": ["One comparison", "one"],
  "Finish with why it matters to them.": ["End on why it matters", "end"],
  "Problem first, and make it someone's actual problem.": ["Problem first", "start"],
  "Your answer in one line a stranger could repeat.": ["Answer in one line", "one"],
  "Close on the single next step.": ["End on the next step", "end"],

  // lib/drills.ts
  "Decide your first sentence before you start.": ["Know your first sentence", "start"],
  "Most fillers land in the first five seconds.": ["Clean first five seconds", "start"],
  "One idea per sentence. Long ones run out of road.": ["One idea a sentence", "one"],
  '"Like" holds the place of a comparison you haven\'t found. Stop, find it, say it.': ['Swap "like" for specifics', "word"],
  'Feel one coming? Close your mouth. A closed mouth cannot say "like".': ["Close your mouth", "cut"],
  "Explaining to a beginner forces concrete nouns, and concrete nouns need no filler.": ["Explain it to a beginner", "word"],
  'Silence INSTEAD of the "um", not either side of it.': ["Silence instead of um", "pause"],
  "A one-second gap feels like ten inside and like composure outside.": ["One second reads as calm", "pause"],
  'Caught mid-"um"? Finish it and keep going. Restarting costs more.': ["Caught one? Keep going", "end"],
  "Slow the sentence down instead of filling it.": ["Slow down, don't fill", "slow"],
  "Fillers cluster at transitions. Know your next point before you finish this one.": ["Know your next point", "start"],
  "Under 3 a minute is three stars.": ["Under 3 a minute", "cut"],
  "130 to 160 words a minute is the zone.": ["130 to 160 a minute", "slow"],
  "Pace comes from breathing. Full breath at every full stop.": ["Breathe at full stops", "pause"],
  "Steady is not monotone. Speed through the setup, slow on the point.": ["Fast setup, slow point", "slow"],
  "Say the hard number slower than the words around it.": ["Slow the hard number", "slow"],
  "Explaining to a child bans jargon, and jargon is where rushing starts.": ["Explain it to a child", "word"],
  "Rushing? Finish the sentence before you correct.": ["Finish, then correct", "end"],
  "The score rewards pace that moves. Speed the build-up, brake for the moment.": ["Speed up, then brake", "slow"],
  "Change pace at sentence joints. A swerve mid-sentence reads as a stumble.": ["Change pace between sentences", "slow"],
  "End at walking pace. The last sentence sets the whole feel.": ["End at walking pace", "end"],
  "130 to 160 is the zone the score pays.": ["130 to 160 a minute", "slow"],
  "Breathe at the full stops. Pace is air, not willpower.": ["Breathe at full stops", "pause"],
  "Rushing? Finish, pause, resume. The pause scores better than the sprint.": ["Finish, pause, resume", "pause"],
  "The pause goes at the joint: after a point, before the next.": ["Pause between points", "pause"],
  "One to two seconds. Under one is a breath, past three and a half is lost.": ["Hold one to two seconds", "pause"],
  "Finish the point first. Half a thought has nothing to land.": ["Finish the point first", "end"],
  "Know your last sentence before you start.": ["Know your last sentence", "end"],
  "Stop on the full stop. The silence is the summary.": ["Stop on the full stop", "end"],
  "A held pause in the last fifth scores on its own.": ["Pause near the end", "pause"],
  "A pause before your first word scores as composure.": ["Pause before you start", "pause"],
  "One second. Count it. From outside it reads as weighing your words.": ["Count one second", "pause"],
  "Decide sentence one during the silence, then say it whole.": ["Plan sentence one silently", "start"],
  "The beat goes after the full stop, before the next idea.": ["Pause after the full stop", "pause"],
  "One to two seconds reads as command. Past three and a half it costs.": ["Hold one to two seconds", "pause"],
  'Don\'t fill it. A pause with an "um" leaning on it earns nothing.': ["Leave the silence empty", "cut"],
  "Open with the claim, not the run-up.": ["Open with the claim", "start"],
  "Everything after sentence one is evidence. Cut what isn't.": ["Then only evidence", "cut"],
  "Restate the claim in different words to land it.": ["Restate the claim to end", "end"],
  '"First, second, third." The listener always knows where they are.': ["First, second, third", "one"],
  "Three strongest, not three fastest. A weak third costs more than no third.": ["Three strongest points", "one"],
  "Spend the last ten seconds on the best point, not a summary.": ["Best point last", "end"],
  'Say the map before you walk it: "two options, one trade-off".': ["Say the map first", "start"],
  '"Because", "but", "so". Connectives are what make points ordered.': ["Because, but, so", "word"],
  'Land on the lean. "I\'m leaning X because Y" beats "I don\'t know".': ["Land on your lean", "end"],
  "One sentence of setup. Stories die in background detail.": ["One sentence of setup", "start"],
  'Name the turn plainly. "Then it broke" beats ten sentences of drift.': ["Name the turn plainly", "word"],
  "End on what changed, or what you'd do differently.": ["End on what changed", "end"],
  "Write the last sentence first. The talk is the road to it.": ["Last sentence first", "end"],
  "A held pause before the final sentence scores on its own.": ["Pause before the last line", "pause"],
  'Stop on the full stop. "So yeah" refunds the ending.': ['No "so yeah"', "end"],
  "Decide the one thing they must remember. Everything else auditions.": ["One thing to remember", "one"],
  'Concrete is shorter: "I ship the paywall" beats "I work on monetisation".': ["Concrete beats vague", "word"],
  "Finish early if you're done. Padding reads as repetition.": ["Done? Stop early", "end"],
  'The range score counts crutch words. "Very good" is an empty slot.': ["Skip the crutch words", "word"],
  "Crutch coming? Stop and pick the precise word.": ["Pick the precise word", "word"],
  "Name specifics: a scene, a line, a number.": ["Scene, line, number", "one"],
  '"And, which, but" is three sentences in a coat. Full stop, breathe, next.': ["Short sentences", "cut"],
  "Short sentences leave nowhere for fillers to hide.": ["Short sentences", "cut"],
  "Every full stop earns a beat of silence.": ["Beat at every full stop", "pause"],
  "Cut the second example. The first one worked.": ["One example only", "one"],
  'Start inside the story, not at "so basically".': ["Start inside the story", "start"],
  "Keep the pause before the punchline. Compression cuts words, never silence.": ["Pause before the punchline", "pause"],
  "What it is, what it looks like, what it isn't. Three sentences.": ["Is, looks like, isn't", "one"],
  "The example carries it. Use one you saw, with a name or a number in it.": ["A real example", "one"],
  "Watch the hedges. A definition that hedges isn't one.": ["No hedging", "cut"],
  "Find the other side's best point, not its dumbest.": ["Their best point", "word"],
  'No winking. "Obviously I don\'t believe this" is a restart in disguise.': ["Commit to it", "start"],
  "Stalling? Describe who believes it and why.": ["Stuck? Who believes it", "word"],
  "The engine counts hedges and the Steadiness score reads them.": ["Hedges are counted", "cut"],
  'Swap "I think maybe X" for "X, because Y".': ['"X, because Y"', "word"],
  "A pause beats a hedge. Silence reads as weighing, hedging reads as retreat.": ["Pause, don't hedge", "pause"],
  "Sentence one: name it, claim one thing. Momentum beats brilliance.": ["Name it, claim it", "start"],
  "Running dry? Zoom in: who made it, what it costs, what it replaced.": ["Stuck? Zoom in", "word"],
  "Finish the sentence you're in, then aim the next one.": ["Finish, then aim", "end"],
  'Commit early. "Meetings are underrated" beats "meetings maybe aren\'t bad".': ["Commit early", "start"],
  "One concrete benefit, fully built, beats four asserted ones.": ["One benefit, fully built", "one"],
  "Humour is allowed, retreat isn't.": ["Jokes yes, retreat no", "word"],
  "A repair drops the thread. One a minute costs a third of that score.": ["Don't restart", "end"],
  "Sentence going wrong? Land it plainly, correct in the next one.": ["Land it, then correct", "end"],
  "Slower start, fewer rebuilds.": ["Start slower", "slow"],

  // lib/games.ts
  "Pause before you answer the interruption. A held pause reads as composure, and the engine scores it.": ["Pause before answering", "pause"],
  "Answer the question asked, then walk back to your point.": ["Answer, then return", "word"],
  "Finish the sentence you started. A restart is scored as a repair.": ["Finish every sentence", "end"],
  "Your first sentence is the point. The wind-up is what the clock eats.": ["Point first", "start"],
  "One point, one example, stop.": ["One point, one example", "one"],
  "Finishing early beats getting cut off.": ["Finish early", "end"],
  "Answer the question in your first sentence. The story comes second.": ["Answer first", "start"],
  "One specific beats three adjectives. Name the thing you did.": ["One specific thing", "one"],
  "Land on the result, with a number if you have one.": ["End on a number", "end"],

  // lib/path.ts, the unit intro
  "Know your first sentence before you hit record.": ["Know your first sentence", "start"],
  'When you feel an "um" coming, just close your mouth.': ["Close your mouth", "cut"],
  "The silence always feels longer to you than it does to anyone listening.": ["Silence feels longer inside", "pause"],

  // lib/rep-config.ts, the boss prompt's scoring rule (splitPrompt)
  "Wrong claims stated as fact cost more than saying you're unsure.": ["Unsure beats wrong", "cut"],
};

/**
 * The face for one tactic. A sentence nobody labelled still gets a face
 * (its first clause, cut to five words) so the screen never breaks, but
 * the test above makes sure that path is never taken by shipped content.
 */
export function tipFace(tip: string): TipFace {
  const hit = L[tip];
  if (hit) return { label: hit[0], glyph: hit[1] };
  const clause = tip.split(/[.:;?,]/)[0].trim();
  const words = clause.split(/\s+/);
  return {
    label: words.length > 5 ? `${words.slice(0, 5).join(" ")}…` : clause,
    glyph: "one",
  };
}

/** For the test: whether a tactic has a hand-written face. */
export function hasTipFace(tip: string): boolean {
  return tip in L;
}

/**
 * A prompt as the recording screen shows it: its first sentence as the
 * one line of what to do, and whatever follows as a rule that changes
 * how the recording is scored (the boss's "wrong claims cost more"). The
 * rule is not cut for being long: it shows as a tactic face, with the
 * sentence one tap away, because a score may not mark someone down for
 * something the screen never said.
 */
export function splitPrompt(prompt: string): { line: string; rule: string | null } {
  const m = prompt.match(/^[^.?!]*[.?!]/);
  if (!m) return { line: prompt, rule: null };
  const rest = prompt.slice(m[0].length).trim();
  return { line: m[0], rule: rest.length > 0 ? rest : null };
}
