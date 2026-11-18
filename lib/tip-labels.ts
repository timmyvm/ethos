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

export type TipGlyph = "pause" | "hold" | "start" | "end" | "slow" | "word" | "one" | "cut";

export interface TipFace {
  label: string;
  glyph: TipGlyph;
}

const L: Record<string, [string, TipGlyph]> = {
  // content/traits.ts
  "Pause when a sentence ends, never halfway through it.": ["Finish, then pause", "pause"],
  "Pause long enough to count to two in your head.": ["Pause, count to two", "hold"],
  'Don\'t say "um" right before or after a pause.': ['Pause without "um"', "cut"],
  'Close your mouth between sentences. You can\'t say "um" with it shut.': ['Mouth shut, no "um"', "cut"],
  'Take a breath before each sentence. That\'s where "um" sneaks in.': ["Breathe, then speak", "slow"],
  'Need a second to think? Stay quiet instead of saying "um".': ["Quiet instead of um", "pause"],
  "Finish the sentence you started, even if a better one comes to mind.": ["Finish every sentence", "end"],
  "Said it wrong? Finish the sentence, then say the right version as a new one.": ["Fix it once you finish", "word"],
  "Know how a sentence ends before you start saying it.": ["Know the ending first", "start"],
  "Say your most important sentence slower than the rest.": ["Slow the key sentence", "slow"],
  "Slow down for your last sentence.": ["Slow down at the end", "end"],
  "Catch yourself rushing? Pause for a second, then keep going.": ["Rushing? Pause", "pause"],
  /* Not "Name it once": that is the lesson's title and a path angle,
     and the heading over the tiles never repeats a tile (E50,
     lib/daily-practice.test.ts). */
  'Name a thing in full once, like "my new phone". Then just say "it".': ['Say "it" the second time', "one"],
  'Skip "really" and "very". Say the exact word instead.': ['Skip "really" and "very"', "cut"],
  'Say exactly what it is: "exams", not "stuff".': ['Say "exams", not "stuff"', "word"],

  // lib/topics.ts, TOPIC_SHAPES
  "Say which side you're on in your first sentence.": ["Say your side first", "start"],
  "One reason, one example, then stop.": ["One reason, one example", "one"],
  "Say the best point against you, then answer it in one sentence.": ["Answer the other side", "word"],
  /* A plain hyphen: Figtree has no U+2011, so TipStrip keeps a
     hyphenated word on one line instead ("mid-" never ends a line). */
  "Start in the middle of the action, not the background.": ["Start mid-action", "start"],
  "Pick one moment and tell just that.": ["One moment only", "one"],
  "End on what changed, not on 'so yeah'.": ["End on what changed", "end"],
  "Open with what it IS in one sentence.": ["Say what it is", "start"],
  "Compare it to one thing they already know.": ["Compare it to one thing", "one"],
  "Finish with why it matters to them.": ["End on why it matters", "end"],
  "Start with the problem, and say who has it.": ["Start with the problem", "start"],
  "Sum up your idea in one line a stranger could repeat.": ["Your idea in one line", "one"],
  "End by telling them the one thing to do next.": ["End with their next step", "end"],

  // lib/drills.ts
  "Decide your first sentence before you start.": ["Know your first sentence", "start"],
  "Start slow. Most ums come in the first five seconds.": ["Slow down at the start", "slow"],
  'One idea per sentence. End it where you\'d add "and".': ["One idea a sentence", "one"],
  'Instead of "it\'s, like, fast", say "it opens in a second".': ['Swap "like" for a detail', "word"],
  'Feel a "like" coming? Close your mouth.': ['Hold back "like"', "cut"],
  'Name things they can picture: "the blue button", not "the feature".': ["Name what they can see", "word"],
  'Where you\'d say "um", stay silent instead.': ["Silence instead of um", "pause"],
  "Pause for one full second. It feels long, but it sounds calm.": ["Pause one full second", "hold"],
  'Said "um" anyway? Keep going. Starting over costs more.': ['Said "um"? Keep going', "end"],
  'Need a moment? Slow down instead of saying "um".': ['Slow down, skip the "um"', "slow"],
  "Know your next point before this one ends. Most ums come in between.": ["Know your next point", "start"],
  'Three stars means under 3 slips a minute: an "um", a "like" or a restart.': ["Under 3 slips a minute", "cut"],
  "Aim for 130 to 160 words a minute, the speed of a calm chat.": ["Talk at calm chat speed", "slow"],
  "Take a full breath at the end of each sentence. It keeps you from rushing.": ["Breathe at full stops", "pause"],
  "Go quicker through the background, slower on the part that matters.": ["Slow down for the point", "slow"],
  "Say every number slower than the words around it.": ["Slow down on numbers", "slow"],
  "Use words a 10-year-old knows. Big words make you rush.": ["Use words a kid knows", "word"],
  "Tripped on a word? Finish the sentence, then fix it.": ["Finish, then fix it", "end"],
  "Speed up as the action builds. Slow right down for the big moment.": ["Speed up, slow down", "slow"],
  "Change speed between sentences. Changing mid-sentence sounds like a stumble.": ["Change pace at full stops", "slow"],
  "Say the last sentence slowly. It's the one people remember.": ["Say the last line slowly", "end"],
  "Talk at calm chat speed, about 130 to 160 words a minute.": ["Talk at calm chat speed", "slow"],
  "Breathe at the end of each sentence. The breath slows you down.": ["Breathe at full stops", "pause"],
  "Too fast? Finish the sentence and pause, then carry on.": ["Too fast? Pause", "pause"],
  "Pause after you make a point, before you start the next.": ["Pause after a point", "pause"],
  "Stay quiet for 1 to 2 seconds. Past 3.5 seconds you sound stuck.": ["Pause 1 to 2 seconds", "hold"],
  "Don't pause mid-sentence. It sounds like you're searching for a word.": ["No pauses mid-sentence", "cut"],
  "Know your last sentence before you start.": ["Know your last sentence", "end"],
  "After your last sentence, stop talking and let the silence sit.": ["End, then stay silent", "end"],
  "Pause right before your last sentence. It earns its own points.": ["Pause before the last line", "pause"],
  "Pause before your first word. It sounds calm and it scores.": ["Pause before you start", "pause"],
  "Count one second in your head. It sounds like you're choosing your words.": ["Count one second", "hold"],
  "While you pause, pick your first sentence. Then say it in one go.": ["Plan your first sentence", "start"],
  "Pause at the end of each sentence, before the next idea.": ["Pause at full stops", "pause"],
  "Pause for 1 to 2 seconds. Going past 3.5 seconds costs points.": ["Pause 1 to 2 seconds", "hold"],
  'Don\'t say "um" right before or after a pause, or the pause won\'t score.': ['Pause without "um"', "cut"],
  "Say your answer in the first sentence.": ["Your answer goes first", "start"],
  "After your answer, only give reasons for it.": ["Back it up with reasons", "word"],
  "End by saying your answer again, in new words.": ["End on your answer again", "end"],
  '"First, second, third." The listener always knows where they are.': ["First, second, third", "one"],
  "Use your three best reasons. If the third is weak, stop at two.": ["Your three best reasons", "one"],
  "Spend the last ten seconds on the best point, not a summary.": ["Best point last", "end"],
  'Start by saying what\'s coming: "Two options, and one catch."': ["Say what's coming first", "start"],
  'Link your points with "because", "but" and "so".': ["Use because, but, so", "word"],
  'End by picking one: "I\'d take the bus, because it\'s cheaper."': ["End on your pick", "end"],
  "Set the scene in one sentence, then get to what happened.": ["One sentence of setup", "start"],
  'Say what went wrong in a few words: "Then it broke."': ["Say what went wrong", "word"],
  "End on what changed, or what you'd do differently.": ["End on what changed", "end"],
  "Plan your last sentence first. Everything else leads to it.": ["Plan your last line first", "end"],
  "Pause right before your last sentence. That pause earns points.": ["Pause before the last line", "pause"],
  'Stop after your last sentence. Adding "so yeah" undoes it.': ['No "so yeah"', "end"],
  "Pick the one thing they should remember, and only talk about that.": ["One thing to remember", "one"],
  'Say what you actually do: "I fix bikes", not "I\'m in maintenance".': ["Say what you actually do", "word"],
  "Said it all early? Stop. Filling the time sounds like repeating yourself.": ["Done? Stop early", "end"],
  'Your Variety score drops when you keep saying "really", "very" or "good".': ['Say "really" less', "word"],
  'About to say "really good"? Name what it was instead: "tense", "funny".': ["Pick the exact word", "word"],
  "Name specifics: a scene, a line, a number.": ["Name a scene or line", "one"],
  'Where you\'d say "and" or "which", end the sentence and start a new one.': ['Full stop, not "and"', "cut"],
  "Keep sentences short. Ums slip into long ones.": ["Short sentences", "cut"],
  "Pause briefly at the end of every sentence.": ["Pause at full stops", "pause"],
  "Cut the second example. The first one worked.": ["One example only", "one"],
  'Start at the moment something happens, not with "so basically".': ["Start at the action", "start"],
  "Cut words, but keep the pause before the punchline.": ["Pause before the punchline", "pause"],
  "Say what it means, give one example, then say what it doesn't mean.": ["Say what it means", "one"],
  "Give one real example you've seen, with a name or a number.": ["A real example", "one"],
  'Drop "maybe" and "sort of". Say what it is.': ['Drop "maybe" and "sort of"', "cut"],
  "Find the other side's best point, not its dumbest.": ["Argue their best point", "word"],
  'Argue it like you mean it. Skip "I don\'t really believe this".': ["Argue like you mean it", "start"],
  "Stalling? Describe who believes it and why.": ["Stuck? Who believes it", "word"],
  'Your Steadiness score counts every "maybe", "I guess" and "sort of".': ['Say "maybe" less', "cut"],
  'Say "Walk more, because it clears your head", not "I guess maybe walk more".': ['Skip "I guess", say why', "word"],
  'Unsure? Pause instead of saying "maybe". Silence sounds thoughtful.': ['Pause instead of "maybe"', "pause"],
  'Name it and give your opinion: "This mug is too small."': ["Name it, give your take", "start"],
  "Stuck? Say who made it, what it cost, or what it replaced.": ["Stuck? Say who made it", "word"],
  "Finish this sentence before you think about the next.": ["Finish this sentence first", "end"],
  'Pick your side in the first sentence: "Queues are good for us."': ["Pick a side right away", "start"],
  "One good point, explained fully, beats four you only list.": ["One point, in full", "one"],
  "Joke if you like, but don't back down.": ["Joke, don't back down", "word"],
  "Starting over once a minute costs a third of your Restart control score.": ["Don't start over", "end"],
  "Sentence going wrong? Finish it anyway, then fix it in the next one.": ["Finish it, then fix it", "end"],
  "Start a little slower and you'll start over less.": ["Start slower", "slow"],

  // lib/games.ts
  "When Demos cuts in, stop. Wait a second, then answer. That pause is timed.": ["Pause before answering", "pause"],
  "Answer what Demos asked, then go back to your point.": ["Answer, then carry on", "word"],
  "Finish the sentence you started. Starting over costs points.": ["Finish every sentence", "end"],
  "Make your point in the first sentence, before the clock runs down.": ["Make your point first", "start"],
  "One point, one example, stop.": ["One point, one example", "one"],
  "Talk for at least half the time, then stop before it runs out.": ["Stop after halfway", "end"],
  "Answer the question in your first sentence. The story comes second.": ["Answer first", "start"],
  'Say what you did: "I ran the bake sale", not "I\'m organised".': ["Say what you did", "word"],
  "End on the result, with a number if you have one.": ["End on the result", "end"],

  // lib/path.ts, the unit intro
  "Know your first sentence before you hit record.": ["Know your first sentence", "start"],
  'When you feel an "um" coming, just close your mouth.': ["Um coming? Mouth shut", "cut"],
  "Pause longer than feels right. It sounds shorter to everyone else.": ["Pause a bit longer", "hold"],

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
 * A prompt as the recording screen shows it: its last sentence, when it
 * has more than one, as a rule that changes how the recording is scored
 * (the boss's "wrong claims cost more"), and everything before it as the
 * one line of what to do ("Notes are gone. 90 seconds, from memory.").
 * The rule is not cut for being long: it shows as a tactic face, with
 * the sentence one tap away, because a score may not mark someone down
 * for something the screen never said.
 */
export function splitPrompt(prompt: string): { line: string; rule: string | null } {
  const sentences = prompt.trim().match(/[^.?!]+[.?!]+/g);
  if (!sentences || sentences.length < 2) return { line: prompt, rule: null };
  const rule = sentences[sentences.length - 1].trim();
  const line = sentences.slice(0, -1).join("").trim();
  return { line, rule };
}
