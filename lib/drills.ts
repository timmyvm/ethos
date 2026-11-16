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
    title: "The baseline",
    /* The first tip is docs/voice.md Part 3, verbatim (DECISIONS
       #209). The second was its partner there and the third this
       drill's own retired tip (#212), both rewritten for the two-second
       test (#483): "Most fillers land in the first five seconds" was a
       fact with no move in it, and "run out of road" asked for a
       picture. */
    prompt: "Introduce yourself and what you're building. Sixty seconds, no notes.",
    tips: [
      "Decide your first sentence before you start.",
      "Start slow. Most ums come in the first five seconds.",
      "One idea per sentence. End it where you'd add \"and\".",
    ],
  },
  {
    id: "f2",
    unit: "Filler Elimination",
    title: "Kill ‘like’",
    prompt: "Explain your favorite app to someone who's never used a phone.",
    tips: [
      "Instead of \"it's, like, fast\", say \"it opens in a second\".",
      "Feel a \"like\" coming? Close your mouth.",
      "Name things they can picture: \"the blue button\", not \"the feature\".",
    ],
  },
  {
    id: "f3",
    unit: "Filler Elimination",
    title: "Silence beats ‘um’",
    prompt: "Describe your morning routine. Pause wherever you'd say \"um\".",
    tips: [
      "Where you'd say \"um\", stay silent instead.",
      "Pause for one full second. It feels long, but it sounds calm.",
      "Said \"um\" anyway? Keep going. Starting over costs more.",
    ],
  },
  {
    id: "f4",
    unit: "Filler Elimination",
    title: "The clean minute",
    prompt: "Describe the last thing you made. 60 seconds, no \"um\" or \"like\".",
    tips: [
      "Need a moment? Slow down instead of saying \"um\".",
      "Know your next point before this one ends. Most ums come in between.",
      /* The stars read every "um", "like", "basically" and restart
         together (lib/metrics.ts, starsForDisfluencyRate), so a line
         naming only ums and restarts promised a star a "like" takes. */
      "Every star needs under 3 slip-ups a minute: an \"um\", a \"like\" or a restart.",
    ],
  },
  {
    id: "p1",
    unit: "Pace Control",
    title: "The 140 zone",
    prompt: "Tell the story of how you learned to code, at a walking pace.",
    tips: [
      "Aim for 130 to 160 words a minute, the speed of a calm chat.",
      "Take a full breath at the end of each sentence. It keeps you from rushing.",
      "Go quicker through the background, slower on the part that matters.",
    ],
  },
  {
    id: "p2",
    unit: "Pace Control",
    title: "Slow is smooth",
    prompt: "Explain compound interest to a 10-year-old, slower than feels natural.",
    tips: [
      "Say every number slower than the words around it.",
      "Use words a 10-year-old knows. Big words make you rush.",
      "Tripped on a word? Finish the sentence, then fix it.",
    ],
  },
  {
    id: "p3",
    unit: "Pace Control",
    title: "Move the pace",
    prompt: "Describe a game that came down to the end. Rise with the action, land slow.",
    tips: [
      "Speed up as the action builds. Slow right down for the big moment.",
      "Change speed between sentences. Changing mid-sentence sounds like a stumble.",
      "Say the last sentence slowly. It's the one people remember.",
    ],
  },
  {
    id: "p4",
    unit: "Pace Control",
    title: "The steady state",
    prompt: "Explain how something everyday works: a coffee machine, a traffic light. Hold 130 to 160 words a minute.",
    tips: [
      "Talk at calm chat speed, about 130 to 160 words a minute.",
      "Breathe at the end of each sentence. The breath slows you down.",
      "Too fast? Finish the sentence and pause, then carry on.",
    ],
  },
  {
    id: "h1",
    unit: "The Pause",
    title: "Hold one second",
    prompt: "Argue for your most controversial food opinion. One full second before each new point.",
    tips: [
      "Pause after you make a point, before you start the next.",
      "Stay quiet for 1 to 2 seconds. Past 3.5 seconds you sound stuck.",
      "Don't pause mid-sentence. It sounds like you're searching for a word.",
    ],
  },
  {
    id: "h2",
    unit: "The Pause",
    title: "Land the ending",
    prompt: "Pitch what you're building in 45 seconds. End on a sentence, then hold the silence.",
    tips: [
      "Know your last sentence before you start.",
      "After your last sentence, stop talking and let the silence sit.",
      "Pause right before your last sentence. It earns its own points.",
    ],
  },
  {
    id: "h3",
    unit: "The Pause",
    title: "Open with silence",
    prompt: "Hold one full second of silence, then answer: what's a rule you live by?",
    tips: [
      "Pause before your first word. It sounds calm and it scores.",
      "Count one second in your head. It sounds like you're choosing your words.",
      "While you pause, pick your first sentence. Then say it in one go.",
    ],
  },
  {
    id: "h4",
    unit: "The Pause",
    title: "Punctuate with silence",
    prompt: "Argue that one everyday habit is underrated. Full stop, one beat, next sentence.",
    tips: [
      "Pause at the end of each sentence, before the next idea.",
      "Pause for 1 to 2 seconds. Going past 3.5 seconds costs points.",
      "Don't say \"um\" right before or after a pause, or the pause won't score.",
    ],
  },
  {
    id: "s1",
    unit: "Structure",
    title: "Conclusion first",
    prompt: "Your best decision of the last year. Verdict in sentence one, then defend it.",
    tips: [
      "Say your answer in the first sentence.",
      "After your answer, only give reasons for it.",
      "End by saying your answer again, in new words.",
    ],
  },
  {
    id: "s2",
    unit: "Structure",
    title: "Three points, numbered",
    prompt: "Why does your favourite hobby deserve more respect? Three reasons, numbers out loud.",
    tips: [
      "\"First, second, third.\" The listener always knows where they are.",
      "Use your three best reasons. If the third is weak, stop at two.",
      "Spend the last ten seconds on the best point, not a summary.",
    ],
  },
  {
    id: "s3",
    unit: "Structure",
    title: "Signpost it",
    prompt: "A decision you're weighing: the options, the catch, where you're leaning.",
    tips: [
      "Start by saying what's coming: \"Two options, and one catch.\"",
      "Link your points with \"because\", \"but\" and \"so\".",
      "End by picking one: \"I'd take the bus, because it's cheaper.\"",
    ],
  },
  {
    id: "s4",
    unit: "Structure",
    title: "The story spine",
    prompt: "A time something went wrong and what you did next. Setup, turn, outcome.",
    tips: [
      "Set the scene in one sentence, then get to what happened.",
      "Say what went wrong in a few words: \"Then it broke.\"",
      "End on what changed, or what you'd do differently.",
    ],
  },
  {
    id: "s5",
    unit: "Structure",
    title: "Defend the ending",
    prompt: "Defend an ending people argue about. Make your last sentence quotable.",
    tips: [
      "Plan your last sentence first. Everything else leads to it.",
      "Pause right before your last sentence. That pause earns points.",
      "Stop after your last sentence. Adding \"so yeah\" undoes it.",
    ],
  },
  {
    id: "c1",
    unit: "Compression",
    title: "Half the words",
    prompt: "Explain your job to a stranger in 45 seconds. Every sentence earns its place.",
    tips: [
      "Pick the one thing they should remember, and only talk about that.",
      "Say what you actually do: \"I fix bikes\", not \"I'm in maintenance\".",
      "Said it all early? Stop. Filling the time sounds like repeating yourself.",
    ],
  },
  {
    id: "c2",
    unit: "Compression",
    title: "Kill the crutch",
    prompt: "Review the last thing you watched, without \"really\", \"very\", \"good\" or \"thing\".",
    tips: [
      "Your Variety score drops when you keep saying \"really\", \"very\" or \"good\".",
      "About to say \"really good\"? Name what it was instead: \"tense\", \"funny\".",
      "Name specifics: a scene, a line, a number.",
    ],
  },
  {
    id: "c3",
    unit: "Compression",
    title: "One idea per sentence",
    prompt: "Why a project of yours succeeded or failed. Short sentences, one idea each.",
    tips: [
      "Where you'd say \"and\" or \"which\", end the sentence and start a new one.",
      "Keep sentences short. Ums slip into long ones.",
      "Pause briefly at the end of every sentence.",
    ],
  },
  {
    id: "c4",
    unit: "Compression",
    title: "Retell it tighter",
    prompt: "A story you've told before, in half your usual time.",
    tips: [
      "Cut the second example. The first one worked.",
      "Start at the moment something happens, not with \"so basically\".",
      "Cut words, but keep the pause before the punchline.",
    ],
  },
  {
    id: "c5",
    unit: "Compression",
    title: "Define it",
    prompt: "Pin down a word everyone uses and nobody defines: \"authentic\", \"strategy\", \"talent\".",
    tips: [
      "Say what it means, give one example, then say what it doesn't mean.",
      "Give one real example you've seen, with a name or a number.",
      "Drop \"maybe\" and \"sort of\". Say what it is.",
    ],
  },
  {
    id: "t1",
    unit: "Thinking Under Fire",
    title: "Switch sides",
    prompt: "Argue the other side of an opinion you hold, like you mean it.",
    tips: [
      "Find the other side's best point, not its dumbest.",
      "Argue it like you mean it. Skip \"I don't really believe this\".",
      "Stalling? Describe who believes it and why.",
    ],
  },
  {
    id: "t2",
    unit: "Thinking Under Fire",
    title: "No hedges",
    prompt: "What should more people be doing? No \"I guess\", \"maybe\", \"sort of\".",
    tips: [
      "Your Steadiness score counts every \"maybe\", \"I guess\" and \"sort of\".",
      "Say \"Walk more, because it clears your head\", not \"I guess maybe walk more\".",
      "Unsure? Pause instead of saying \"maybe\". Silence sounds thoughtful.",
    ],
  },
  {
    id: "t3",
    unit: "Thinking Under Fire",
    title: "Cold open",
    prompt: "No think time. Your topic is the last object you touched. Go.",
    tips: [
      "Name it and give your opinion: \"This mug is too small.\"",
      "Stuck? Say who made it, what it cost, or what it replaced.",
      "Finish this sentence before you think about the next.",
    ],
  },
  {
    id: "t4",
    unit: "Thinking Under Fire",
    title: "Hold the unpopular corner",
    prompt: "Defend something mundane and unpopular: queues, ads, Mondays.",
    tips: [
      "Pick your side in the first sentence: \"Queues are good for us.\"",
      "One good point, explained fully, beats four you only list.",
      "Joke if you like, but don't back down.",
    ],
  },
  {
    id: "t5",
    unit: "Thinking Under Fire",
    title: "Finish every sentence",
    prompt: "What you'd change about your city. Every sentence you start, you finish.",
    tips: [
      "Starting over once a minute costs a third of your Follow-through score.",
      "Sentence going wrong? Finish it anyway, then fix it in the next one.",
      "Start a little slower and you'll start over less.",
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
