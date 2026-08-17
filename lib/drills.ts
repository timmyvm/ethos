/**
 * The daily drill loop — build order step 2 (vision.md: app serves ONE
 * prompt a day). Units → lessons per mechanics.md; content ported from
 * the prototype. Boss modes are premium weekly content and stay out of
 * this rotation (DECISIONS.md #13).
 */

export interface Drill {
  id: string;
  unit: string;
  title: string;
  prompt: string;
  /**
   * How to do this drill — the technique, not encouragement.
   *
   * A lesson that names a target and doesn't say how to hit it is a
   * test, not a lesson. Each of these is one instruction you can act on
   * inside sixty seconds, and each maps to something the engine
   * actually measures, so the feedback afterwards is about the same
   * thing the tip was about.
   */
  tips: string[];
}

export const DRILLS: Drill[] = [
  {
    id: "f1",
    unit: "Filler Elimination",
    title: "The baseline rep",
    prompt: "Introduce yourself and what you're building. 60 seconds, no notes.",
    tips: [
      "Decide your first sentence before you start. Most fillers land in the first five seconds.",
      "One idea per sentence. Long ones run out of road.",
      "Land on a full stop, not on \"yeah, so\".",
    ],
  },
  {
    id: "f2",
    unit: "Filler Elimination",
    title: "Kill 'like'",
    prompt: "Explain your favorite app to someone who's never used a phone.",
    tips: [
      "\"Like\" holds the place of a comparison you haven't found. Stop, find it, say it.",
      "Feel one coming? Close your mouth. A closed mouth cannot say \"like\".",
      "Explaining to a beginner forces concrete nouns, and concrete nouns need no filler.",
    ],
  },
  {
    id: "f3",
    unit: "Filler Elimination",
    title: "Silence beats 'um'",
    prompt: "Describe your morning routine. Pause wherever you'd say a filler.",
    tips: [
      "Silence INSTEAD of the \"um\", not either side of it.",
      "A one-second gap feels like ten inside and like composure outside.",
      "Caught mid-\"um\"? Finish it and keep going. Restarting costs more.",
    ],
  },
  {
    id: "f4",
    unit: "Filler Elimination",
    title: "The clean minute",
    prompt: "Describe the last thing you made. 60 seconds, zero fillers.",
    tips: [
      "Slow the sentence down instead of filling it.",
      "Fillers cluster at transitions. Know your next point before you finish this one.",
      "Under 3 a minute is three stars.",
    ],
  },
  {
    id: "p1",
    unit: "Pace Control",
    title: "The 140 zone",
    prompt: "Tell the story of how you learned to code, at a walking pace.",
    tips: [
      "130 to 160 words a minute is the zone.",
      "Pace comes from breathing. Full breath at every full stop.",
      "Steady is not monotone. Speed through the setup, slow on the point.",
    ],
  },
  {
    id: "p2",
    unit: "Pace Control",
    title: "Slow is smooth",
    prompt: "Explain compound interest to a 10-year-old, slower than feels natural.",
    tips: [
      "Say the hard number slower than the words around it.",
      "Explaining to a child bans jargon, and jargon is where rushing starts.",
      "Rushing? Finish the sentence before you correct.",
    ],
  },
  {
    id: "p3",
    unit: "Pace Control",
    title: "Move the pace",
    prompt: "Describe a game that came down to the end. Rise with the action, land slow.",
    tips: [
      "The score rewards pace that moves. Speed the build-up, brake for the moment.",
      "Change pace at sentence joints. A swerve mid-sentence reads as a stumble.",
      "End at walking pace. The last sentence sets the whole feel.",
    ],
  },
  {
    id: "p4",
    unit: "Pace Control",
    title: "The steady state",
    prompt: "Explain how something everyday works: a coffee machine, a traffic light. Hold 130 to 160 wpm.",
    tips: [
      "130 to 160 is the zone the score pays.",
      "Breathe at the full stops. Pace is air, not willpower.",
      "Rushing? Finish, pause, resume. The pause scores better than the sprint.",
    ],
  },
  {
    id: "h1",
    unit: "The Pause",
    title: "Hold one second",
    prompt: "Argue for your most controversial food opinion. One full second before each new point.",
    tips: [
      "The pause goes at the joint: after a point, before the next.",
      "One to two seconds. Under one is a breath, past three and a half is lost.",
      "Finish the point first. Half a thought has nothing to land.",
    ],
  },
  {
    id: "h2",
    unit: "The Pause",
    title: "Land the ending",
    prompt: "Pitch what you're building in 45 seconds. End on a sentence, then hold the silence.",
    tips: [
      "Know your last sentence before you start.",
      "Stop on the full stop. The silence is the summary.",
      "A held pause in the last fifth of the rep scores on its own.",
    ],
  },
  {
    id: "h3",
    unit: "The Pause",
    title: "Open with silence",
    prompt: "Hold one full second of silence, then answer: what's a rule you live by?",
    tips: [
      "A pause before your first word scores as composure.",
      "One second. Count it. From outside it reads as weighing your words.",
      "Decide sentence one during the silence, then say it whole.",
    ],
  },
  {
    id: "h4",
    unit: "The Pause",
    title: "Punctuate with silence",
    prompt: "Argue that one everyday habit is underrated. Full stop, one beat, next sentence.",
    tips: [
      "The beat goes after the full stop, before the next idea.",
      "One to two seconds reads as command. Past three and a half it costs.",
      "Don't fill it. A pause with an \"um\" leaning on it earns nothing.",
    ],
  },
  {
    id: "s1",
    unit: "Structure",
    title: "Conclusion first",
    prompt: "Your best decision of the last year. Verdict in sentence one, then defend it.",
    tips: [
      "Open with the claim, not the run-up.",
      "Everything after sentence one is evidence. Cut what isn't.",
      "Restate the claim in different words to land it.",
    ],
  },
  {
    id: "s2",
    unit: "Structure",
    title: "Three points, numbered",
    prompt: "Why does your favourite hobby deserve more respect? Three reasons, numbers out loud.",
    tips: [
      "\"First, second, third.\" The listener always knows where they are.",
      "Three strongest, not three fastest. A weak third costs more than no third.",
      "Spend the last ten seconds on the best point, not a summary.",
    ],
  },
  {
    id: "s3",
    unit: "Structure",
    title: "Signpost it",
    prompt: "A decision you're weighing: the options, the trade-off, where you're leaning.",
    tips: [
      "Say the map before you walk it: \"two options, one trade-off\".",
      "\"Because\", \"but\", \"so\". Connectives are what make points ordered.",
      "Land on the lean. \"I'm leaning X because Y\" beats \"I don't know\".",
    ],
  },
  {
    id: "s4",
    unit: "Structure",
    title: "The story spine",
    prompt: "A time something went wrong and what you did next. Setup, turn, outcome.",
    tips: [
      "One sentence of setup. Stories die in background detail.",
      "Name the turn plainly. \"Then it broke\" beats ten sentences of drift.",
      "End on what changed, or what you'd do differently.",
    ],
  },
  {
    id: "s5",
    unit: "Structure",
    title: "Defend the ending",
    prompt: "Defend an ending people argue about. Make your last sentence quotable.",
    tips: [
      "Write the last sentence first. The talk is the road to it.",
      "A held pause before the final sentence scores on its own.",
      "Stop on the full stop. \"So yeah\" refunds the ending.",
    ],
  },
  {
    id: "c1",
    unit: "Compression",
    title: "Half the words",
    prompt: "Explain your job to a stranger in 45 seconds. Every sentence earns its place.",
    tips: [
      "Decide the one thing they must remember. Everything else auditions.",
      "Concrete is shorter: \"I ship the paywall\" beats \"I work on monetisation\".",
      "Finish early if you're done. Padding reads as repetition.",
    ],
  },
  {
    id: "c2",
    unit: "Compression",
    title: "Kill the crutch",
    prompt: "Review the last thing you watched, without \"really\", \"very\", \"good\" or \"thing\".",
    tips: [
      "The range score counts crutch words. \"Very good\" is an empty slot.",
      "Crutch coming? Stop and pick the precise word.",
      "Name specifics: a scene, a line, a number.",
    ],
  },
  {
    id: "c3",
    unit: "Compression",
    title: "One idea per sentence",
    prompt: "Why a project of yours succeeded or failed. Short sentences, one idea each.",
    tips: [
      "\"And, which, but\" is three sentences in a coat. Full stop, breathe, next.",
      "Short sentences leave nowhere for fillers to hide.",
      "Every full stop earns a beat of silence.",
    ],
  },
  {
    id: "c4",
    unit: "Compression",
    title: "Retell it tighter",
    prompt: "A story you've told before, in half your usual time.",
    tips: [
      "Cut the second example. The first one worked.",
      "Start inside the story, not at \"so basically\".",
      "Keep the pause before the punchline. Compression cuts words, never silence.",
    ],
  },
  {
    id: "c5",
    unit: "Compression",
    title: "Define it",
    prompt: "Pin down a word everyone uses and nobody defines: \"authentic\", \"strategy\", \"talent\".",
    tips: [
      "What it is, what it looks like, what it isn't. Three sentences.",
      "The example carries it. Use one you saw, with a name or a number in it.",
      "Watch the hedges. A definition that hedges isn't one.",
    ],
  },
  {
    id: "t1",
    unit: "Thinking Under Fire",
    title: "Switch sides",
    prompt: "Argue the other side of an opinion you hold, like you mean it.",
    tips: [
      "Find the other side's best point, not its dumbest.",
      "No winking. \"Obviously I don't believe this\" is a restart in disguise.",
      "Stalling? Describe who believes it and why.",
    ],
  },
  {
    id: "t2",
    unit: "Thinking Under Fire",
    title: "No hedges",
    prompt: "What should more people be doing? No \"I guess\", \"maybe\", \"sort of\".",
    tips: [
      "The engine counts hedges and the Steadiness score reads them.",
      "Swap \"I think maybe X\" for \"X, because Y\".",
      "A pause beats a hedge. Silence reads as weighing, hedging reads as retreat.",
    ],
  },
  {
    id: "t3",
    unit: "Thinking Under Fire",
    title: "Cold open",
    prompt: "No think time. Your topic is the last object you touched. Go.",
    tips: [
      "Sentence one: name it, claim one thing. Momentum beats brilliance.",
      "Running dry? Zoom in: who made it, what it costs, what it replaced.",
      "Finish the sentence you're in, then aim the next one.",
    ],
  },
  {
    id: "t4",
    unit: "Thinking Under Fire",
    title: "Hold the unpopular corner",
    prompt: "Defend something mundane and unpopular: queues, ads, Mondays.",
    tips: [
      "Commit early. \"Meetings are underrated\" beats \"meetings maybe aren't bad\".",
      "One concrete benefit, fully built, beats four asserted ones.",
      "Humour is allowed, retreat isn't.",
    ],
  },
  {
    id: "t5",
    unit: "Thinking Under Fire",
    title: "Finish every sentence",
    prompt: "What you'd change about your city. Every sentence you start, you finish.",
    tips: [
      "A repair drops the thread. One a minute costs a third of that score.",
      "Sentence going wrong? Land it plainly, correct in the next one.",
      "Slower start, fewer rebuilds.",
    ],
  },
];

/** The drill after this one, for "next lesson". Wraps at the end. */
export function nextDrill(id: string | null): Drill {
  const i = DRILLS.findIndex((d) => d.id === id);
  return DRILLS[(i + 1 + DRILLS.length) % DRILLS.length];
}

/** Dogfood day zero — the rotation anchor. */
const EPOCH = new Date(2026, 7, 9); // 9 Aug 2026, local time

/** One drill per local calendar day, rotating through the list. */
export function todaysDrill(now = new Date()): Drill {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(
    0,
    Math.round((a.getTime() - EPOCH.getTime()) / 86_400_000)
  );
  return DRILLS[days % DRILLS.length];
}
