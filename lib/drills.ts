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
    prompt:
      "Introduce yourself and what you're building — 60 seconds, no notes.",
    tips: [
      "Decide your first sentence before you start. Most fillers happen in the first five seconds, while you work out where to begin.",
      "One idea per sentence. Long sentences run out of road and you fill the gap with \"um\".",
      "Land on a full stop rather than trailing into \"...yeah, so\".",
    ],
  },
  {
    id: "f2",
    unit: "Filler Elimination",
    title: "Kill 'like'",
    prompt: "Explain your favorite app to someone who's never used a phone.",
    tips: [
      "\"Like\" is usually a placeholder for a comparison you haven't found yet. Stop, find it, then say it.",
      "When you feel one coming, close your mouth. A closed mouth cannot say \"like\".",
      "Explaining to someone who knows nothing forces concrete nouns, and concrete nouns leave no room for filler.",
    ],
  },
  {
    id: "f3",
    unit: "Filler Elimination",
    title: "Silence beats 'um'",
    prompt:
      "Describe your morning routine. Every time you'd say a filler — pause instead.",
    tips: [
      "The swap is silence INSTEAD of the \"um\", not silence either side of it. A pause with an \"um\" leaning on it scores as a filled hesitation here.",
      "A one-second gap feels like ten from the inside and like composure from the outside. Trust the outside.",
      "If you catch yourself mid-\"um\", finish the word and keep going. Stopping to restart costs more than the filler did.",
    ],
  },
  {
    id: "f4",
    unit: "Filler Elimination",
    title: "The clean minute",
    prompt:
      "Describe the last thing you built or made — 60 seconds, and the goal is zero fillers.",
    tips: [
      "Slow the sentence down instead of filling it. A stretched word is still cleaner than an \"um\".",
      "Fillers cluster at transitions. Know your next point before you finish this one and there's nothing to fill.",
      "Under 3 a minute is three stars. You've done clean minutes without noticing — do one on purpose.",
    ],
  },
  {
    id: "p1",
    unit: "Pace Control",
    title: "The 140 zone",
    prompt: "Tell the story of how you learned to code, at a walking pace.",
    tips: [
      "130–160 words a minute is the zone. That's slower than you talk to friends and faster than you think a speech should be.",
      "Pace is set by breathing, not by effort. Full breath at each full stop and the rate takes care of itself.",
      "Steady is not monotone — the score rewards pace that MOVES, so speed up through the setup and slow down on the point.",
    ],
  },
  {
    id: "p2",
    unit: "Pace Control",
    title: "Slow is smooth",
    prompt:
      "Explain compound interest to a 10-year-old. Slower than feels natural.",
    tips: [
      "Say the hard number slower than the words around it. That contrast is what makes it land.",
      "Explaining to a child bans jargon, and jargon is where speeding up starts.",
      "When you notice you're rushing, finish the sentence you're in before you correct. Mid-sentence corrections cost you twice.",
    ],
  },
  {
    id: "p3",
    unit: "Pace Control",
    title: "Move the pace",
    prompt:
      "Describe a match, race, or game that came down to the end. Let the pace rise with the action, then land slow.",
    tips: [
      "The score rewards pace that moves. Speed through the build-up, brake hard for the moment that matters.",
      "Change pace at sentence joints, not mid-thought — a swerve inside a sentence reads as a stumble.",
      "End at walking pace. The last sentence sets what the whole thing felt like.",
    ],
  },
  {
    id: "p4",
    unit: "Pace Control",
    title: "The steady state",
    prompt:
      "Explain how something in your daily life actually works — a coffee machine, a traffic light, face unlock — at 130 to 160 words a minute, the whole way.",
    tips: [
      "130–160 is the zone the score pays. It feels slower inside your head than it sounds outside it.",
      "Breathe at the full stops. Pace is set by air, not willpower.",
      "If you hear yourself rushing, finish the sentence, pause, resume. The pause scores better than the sprint.",
    ],
  },
  {
    id: "h1",
    unit: "The Pause",
    title: "Hold one second",
    prompt:
      "Argue for your most controversial food opinion. Pause a full second before each new point.",
    tips: [
      "The pause goes at the JOINT — after you finish a point, before you start the next. Inside a sentence it reads as searching, and it's scored that way.",
      "One to two seconds. Under one is a breath; past three and a half it reads as lost.",
      "Finish the point first. A pause after half a thought has nothing to land.",
    ],
  },
  {
    id: "h2",
    unit: "The Pause",
    title: "Land the ending",
    prompt:
      "Pitch what you're building in 45 seconds. End on a sentence, then hold the silence.",
    tips: [
      "Know your last sentence before you start. Endings are where people trail off into \"...so yeah\".",
      "Stop on the full stop. Don't add the summary — the silence is the summary.",
      "A held pause in the last fifth of the rep scores separately here. That's the one that makes an ending sound decided.",
    ],
  },
  {
    id: "h3",
    unit: "The Pause",
    title: "Open with silence",
    prompt:
      "You've just been handed a question you like. Hold one full second of silence, then answer: what's a rule you live by?",
    tips: [
      "A pause before your first word is scored as an opening pause — composure, not blankness.",
      "One second. Count it. From the outside it reads as weighing your words.",
      "Decide the first sentence during the silence, then say it whole. The pause buys planning time — spend it there.",
    ],
  },
  {
    id: "h4",
    unit: "The Pause",
    title: "Punctuate with silence",
    prompt:
      "Argue that one everyday habit is underrated. Full stop, one beat of silence, next sentence — every time.",
    tips: [
      "The beat goes AFTER the full stop, before the next idea — that placement is the whole score.",
      "One to two seconds reads as command. Past three and a half it starts reading as lost, and it costs.",
      "Don't fill the beat. A pause with an \"um\" leaning on it earns nothing.",
    ],
  },
  {
    id: "s1",
    unit: "Structure",
    title: "Conclusion first",
    prompt:
      "What's the best decision you've made in the last year? Give the verdict in sentence one, then defend it.",
    tips: [
      "Open with the claim, not the run-up. The judge scores whether a listener knows your point by the end of sentence one.",
      "Everything after sentence one is evidence. If a sentence doesn't defend the verdict, it's padding — cut it.",
      "Restate the claim in different words to land. Same words reads as running out; different words reads as decided.",
    ],
  },
  {
    id: "s2",
    unit: "Structure",
    title: "Three points, numbered",
    prompt:
      "Why does your favourite hobby deserve more respect? Exactly three reasons, and say the numbers out loud.",
    tips: [
      "\"First… second… third…\" — the listener always knows where they are, and the judge scores ordered points.",
      "Three strongest, not three fastest. A weak third point costs more than no third point.",
      "Spend the last ten seconds on the best point, not a summary of all three. Endings that re-list trail off.",
    ],
  },
  {
    id: "s3",
    unit: "Structure",
    title: "Signpost it",
    prompt:
      "Explain a decision you're currently weighing — the options, the trade-off, where you're leaning.",
    tips: [
      "Say the map before you walk it: \"two options, one trade-off\". Announced shape is what the judge scores as ordered.",
      "\"Because\", \"but\", \"so\" — connectives are what make points ordered instead of merely adjacent.",
      "Land on the lean. \"I don't know\" is honest, but \"I'm leaning X because Y\" is honest with a decision in it.",
    ],
  },
  {
    id: "s4",
    unit: "Structure",
    title: "The story spine",
    prompt:
      "Tell about a time something went wrong and what you did next. Setup, turn, outcome — in that order.",
    tips: [
      "One sentence of setup is enough. Stories die in the background detail.",
      "Name the turn plainly — \"then it broke\" beats ten sentences of drift.",
      "The outcome is yours: what changed, or what you'd do differently. That's the part the judge scores as an ending.",
    ],
  },
  {
    id: "s5",
    unit: "Structure",
    title: "Defend the ending",
    prompt:
      "Pick a film, book, or game whose ending people argue about, and defend it. Your last sentence should be quotable.",
    tips: [
      "Write the last sentence in your head first. The whole talk is the road to it.",
      "A held pause before the final sentence scores separately — it tells the room the ending is on purpose.",
      "Stop on the full stop. \"…so yeah\" refunds the whole ending.",
    ],
  },
  {
    id: "c1",
    unit: "Compression",
    title: "Half the words",
    prompt:
      "Explain your job — or your week — to a stranger in 45 seconds. Every sentence earns its place.",
    tips: [
      "Decide the one thing they must remember. Everything else auditions for the remaining forty seconds.",
      "Concrete beats abstract and is shorter: \"I ship the app's paywall\" beats \"I work on monetisation initiatives\".",
      "Finish early if you're done. Padding to the buzzer is what the range score reads as repetition.",
    ],
  },
  {
    id: "c2",
    unit: "Compression",
    title: "Kill the crutch",
    prompt:
      "Review the last thing you watched — without \"really\", \"very\", \"good\", or \"thing\".",
    tips: [
      "The range score counts crutch words. \"Very good\" is a slot where a real adjective should be.",
      "When a crutch is coming, stop and pick the precise word. The pause costs less than \"really really\".",
      "Name specifics — a scene, a line, a number. Specifics don't need intensifiers.",
    ],
  },
  {
    id: "c3",
    unit: "Compression",
    title: "One idea per sentence",
    prompt:
      "Explain why a project of yours succeeded or failed. Short sentences. One idea each.",
    tips: [
      "When a sentence hits \"and… which… but\", it's three sentences wearing a coat. Full stop, breathe, next.",
      "Short sentences leave nowhere for fillers to hide — most \"um\"s live in the joints of long ones.",
      "A full stop earns a beat of silence. Short sentences buy you more scored pauses.",
    ],
  },
  {
    id: "c4",
    unit: "Compression",
    title: "Retell it tighter",
    prompt:
      "Take a story you've told before — one you know lands — and tell it in half your usual time.",
    tips: [
      "Cut the second example. If the first one worked, the second is a victory lap.",
      "Trim the entrance: start inside the story, not at \"so basically what happened was\".",
      "Keep the pause before the punchline. Compression cuts words, never the silence that sells them.",
    ],
  },
  {
    id: "c5",
    unit: "Compression",
    title: "Define it",
    prompt:
      "Pick a word everyone uses and nobody defines — \"authentic\", \"strategy\", \"talent\" — and pin it down in 60 seconds.",
    tips: [
      "A definition, an example, a border: what it is, what it looks like, what it isn't. Three sentences, real shape.",
      "The example carries the definition. Make it one you actually saw, with a name or a number in it.",
      "Watch the hedges — \"sort of\", \"I guess\" — the anchor counts them, and a definition that hedges isn't one.",
    ],
  },
  {
    id: "t1",
    unit: "Thinking Under Fire",
    title: "Switch sides",
    prompt:
      "Take an opinion you hold and argue the other side like you mean it, for 60 seconds.",
    tips: [
      "Steelman, don't strawman: find the other side's best point, not its dumbest. The judge scores commitment to claims.",
      "No winking at the camera. \"Obviously I don't believe this\" is a restart in disguise — argue it straight.",
      "If you stall, describe who believes this and why. People are easier to argue for than positions.",
    ],
  },
  {
    id: "t2",
    unit: "Thinking Under Fire",
    title: "No hedges",
    prompt:
      "What should more people be doing? Take a stance — no \"I guess\", \"maybe\", \"sort of\", \"I feel like\".",
    tips: [
      "The engine counts hedge words and the Steadiness score reads them. Say the thing or don't.",
      "Swap \"I think maybe X\" for \"X, because Y\". The because is what makes bare claims safe to commit to.",
      "A pause beats a hedge: silence while you decide reads as weighing; \"sort of\" while you decide reads as retreat.",
    ],
  },
  {
    id: "t3",
    unit: "Thinking Under Fire",
    title: "Cold open",
    prompt:
      "No think time on this one. The topic is the last object you touched before this rep. Go.",
    tips: [
      "First sentence: name the thing and one claim about it. Momentum beats brilliance in the opening five seconds.",
      "When the well runs dry, zoom: who made it, what it costs, what it replaced. Concrete questions refill fast.",
      "A restart costs more than a wobble. Finish the sentence you're in, even imperfectly, then aim the next one.",
    ],
  },
  {
    id: "t4",
    unit: "Thinking Under Fire",
    title: "Hold the unpopular corner",
    prompt:
      "Defend something mundane and unpopular — queues, ads, Mondays, meetings. Make the room consider it.",
    tips: [
      "Commit early: \"meetings are underrated\" beats \"meetings maybe aren't all bad\". Half-claims count as hedges.",
      "One concrete benefit, fully built, beats four asserted ones.",
      "Humour is allowed; retreat isn't. You can smile while you argue — you can't take it back mid-sentence.",
    ],
  },
  {
    id: "t5",
    unit: "Thinking Under Fire",
    title: "Finish every sentence",
    prompt:
      "Explain what you'd change about your city. One rule: every sentence you start, you finish — no rebuilds.",
    tips: [
      "The engine hears a repair like a listener does: the thread drops. One a minute already costs a third of that score.",
      "If a sentence goes wrong, land it plainly and correct in the NEXT one. \"I mean—\" is the expensive way to fix it.",
      "Slower start, fewer rebuilds. Most abandoned sentences were launched before the thought was ready.",
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
