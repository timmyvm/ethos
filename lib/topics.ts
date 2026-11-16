/**
 * The roulette pool — topics to speak on cold.
 *
 * Competitor note (Wellspoken): a spinning wheel of random topics before
 * the recording. The mechanic is good for a real reason: it removes the
 * "what do I even talk about" stall, and it makes the recording a
 * genuine cold open rather than something you quietly rehearsed while
 * deciding.
 *
 * These are deliberately answerable by anyone: opinions and experiences,
 * not knowledge. The Cold Topic boss is where not-knowing is the point
 * (lib/cold-topics.ts); here, not-knowing would just waste the recording.
 *
 * Structure tips are per-shape, not per-topic, so the advice is honest:
 * we know what shape of answer the prompt asks for, and nothing more.
 */

import type { Pool } from "@/content/portfolio";

export type TopicShape = "opinion" | "story" | "explain" | "pitch";

export interface Topic {
  id: string;
  prompt: string;
  shape: TopicShape;
  /** Pools this prompt doesn't fit (content/portfolio.ts): a school
   *  pool drops the job prompts, because a prompt you can't answer
   *  wastes the recording. */
  not?: Pool[];
}

export const TOPIC_SHAPES: Record<
  TopicShape,
  { label: string; tips: string[] }
> = {
  opinion: {
    label: "Take a side",
    tips: [
      "Say your position in the first sentence. Don't warm up to it.",
      "One reason, one example, then stop.",
      "Name the strongest objection and answer it in a line.",
    ],
  },
  story: {
    label: "Tell it straight",
    tips: [
      "Start in the middle of the action, not the background.",
      "One scene. Resist covering the whole week.",
      "End on what changed, not on 'so yeah'.",
    ],
  },
  explain: {
    label: "Make it land",
    tips: [
      "Open with what it IS in one sentence.",
      "One comparison to something they already know.",
      "Finish with why it matters to them.",
    ],
  },
  pitch: {
    label: "Sell it",
    tips: [
      "Problem first, and make it someone's actual problem.",
      "Your answer in one line a stranger could repeat.",
      "Close on the single next step.",
    ],
  },
};

export const TOPICS: Topic[] = [
  { id: "t1", prompt: "The most overrated piece of advice you've been given", shape: "opinion" },
  { id: "t2", prompt: "Something you changed your mind about this year", shape: "opinion" },
  { id: "t3", prompt: "A rule you think everyone should break", shape: "opinion" },
  { id: "t4", prompt: "Whether being busy is a choice", shape: "opinion" },
  { id: "t5", prompt: "The best thing you own under $50", shape: "opinion" },
  { id: "t6", prompt: "A time you were completely wrong in public", shape: "story" },
  { id: "t7", prompt: "The last time you were genuinely nervous", shape: "story" },
  { id: "t8", prompt: "How you met someone who matters to you", shape: "story" },
  { id: "t9", prompt: "A decision you nearly didn't make", shape: "story" },
  { id: "t10", prompt: "The worst job you've ever done", shape: "story", not: ["school"] },
  { id: "t11", prompt: "Explain your work to a ten-year-old", shape: "explain", not: ["school"] },
  { id: "t12", prompt: "Explain how interest works to someone who's never had a bank account", shape: "explain" },
  { id: "t13", prompt: "Explain why the sky changes colour at sunset", shape: "explain" },
  { id: "t14", prompt: "Explain a hobby of yours to someone who finds it boring", shape: "explain" },
  { id: "t15", prompt: "Explain what makes a good friend", shape: "explain" },
  { id: "t16", prompt: "Pitch your city to someone deciding where to move", shape: "pitch" },
  { id: "t17", prompt: "Pitch a book or film you love, without spoiling it", shape: "pitch" },
  { id: "t18", prompt: "Pitch yourself for a job you're not qualified for", shape: "pitch", not: ["school"] },
  { id: "t19", prompt: "Pitch a change your workplace or school should make", shape: "pitch" },
  { id: "t20", prompt: "Pitch the last thing you spent real money on", shape: "pitch" },
  /*
   * The second forty (#473). The test's roulette cycled: "it kept
   * cycling over the same ones", "I always get the same few when
   * rerolling", "it needed more prompts". Written for someone 16 to 28
   * who wants more, and held to the rule above: answerable cold in 60
   * to 90 seconds, by anyone, with nothing to look up, no money to have
   * spent and no job to have held, so none of them leaves a pool. The
   * shapes take turns, opinion, story, explain, pitch, so the path's
   * slice of each tier (content/path.ts) gets both of that tier's
   * shapes, whichever trait it is cut for. The longest is 48
   * characters, and each was measured holding Today's card in three
   * lines at 375 and 390 and the reel's four-line window at 320
   * (scripts/look-topics.mjs `fit`, its numbers in
   * docs/look/topics/after/fit.json): characters are only a proxy, so a
   * new topic is measured, not counted.
   */
  { id: "t21", prompt: "Whether phones belong in classrooms", shape: "opinion" },
  { id: "t22", prompt: "A time you stood up for someone", shape: "story" },
  { id: "t23", prompt: "Explain how to make your favourite meal", shape: "explain" },
  { id: "t24", prompt: "Pitch a new public holiday", shape: "pitch" },
  { id: "t25", prompt: "Whether talent or effort matters more", shape: "opinion" },
  { id: "t26", prompt: "A time you were properly lost", shape: "story" },
  { id: "t27", prompt: "Explain the rules of a game you know well", shape: "explain" },
  { id: "t28", prompt: "Pitch a club you'd want to start", shape: "pitch" },
  { id: "t29", prompt: "The skill school should teach and doesn't", shape: "opinion" },
  { id: "t30", prompt: "Something you taught yourself", shape: "story" },
  { id: "t31", prompt: "Explain how you'd pack for a week away", shape: "explain" },
  { id: "t32", prompt: "Pitch a habit you swear by", shape: "pitch" },
  { id: "t33", prompt: "Whether you need a five-year plan", shape: "opinion" },
  { id: "t34", prompt: "The hardest thing you've ever finished", shape: "story" },
  { id: "t35", prompt: "Explain how a group chat falls apart", shape: "explain" },
  { id: "t36", prompt: "Pitch an app that doesn't exist yet", shape: "pitch" },
  { id: "t37", prompt: "The most underrated app on your phone", shape: "opinion" },
  { id: "t38", prompt: "The kindest thing a stranger did for you", shape: "story" },
  { id: "t39", prompt: "Explain how you decide what to watch next", shape: "explain" },
  { id: "t40", prompt: "Pitch a fix for something that annoys everyone", shape: "pitch" },
  { id: "t41", prompt: "A trend you hope disappears", shape: "opinion" },
  { id: "t42", prompt: "Your first day somewhere new", shape: "story" },
  { id: "t43", prompt: "Explain how to start talking to a stranger", shape: "explain" },
  { id: "t44", prompt: "Pitch a game to someone who doesn't play games", shape: "pitch" },
  { id: "t45", prompt: "Whether morning people really get more done", shape: "opinion" },
  { id: "t46", prompt: "A day that didn't go to plan", shape: "story" },
  { id: "t47", prompt: "Explain how you learn something new fast", shape: "explain" },
  { id: "t48", prompt: "Pitch someone you know for an award", shape: "pitch" },
  { id: "t49", prompt: "A food everyone loves that you don't", shape: "opinion" },
  { id: "t50", prompt: "The last time you laughed until it hurt", shape: "story" },
  { id: "t51", prompt: "Explain how you'd teach someone to ride a bike", shape: "explain" },
  { id: "t52", prompt: "Pitch a four-day week", shape: "pitch" },
  { id: "t53", prompt: "The best way to spend a free Sunday", shape: "opinion" },
  { id: "t54", prompt: "A time you changed someone's mind", shape: "story" },
  { id: "t55", prompt: "Explain how to tell if a news story is true", shape: "explain" },
  { id: "t56", prompt: "Pitch your favourite season", shape: "pitch" },
  { id: "t57", prompt: "Whether to be great at one thing or good at many", shape: "opinion" },
  { id: "t58", prompt: "Something you made or fixed with your hands", shape: "story" },
  { id: "t59", prompt: "Explain what makes a good teacher", shape: "explain" },
  { id: "t60", prompt: "Pitch a song everyone should hear once", shape: "pitch" },
  /*
   * The rest of the year (#481): Timothy asked for 365, one a day, so
   * t61 to t365 are 305 more, held to the same rule as the forty above
   * and taking the same turns (opinion, story, explain, pitch; the extra
   * opinion is t365). Written in five themes (ambition, choices, ideas,
   * people, the world) and judged whole: near-duplicates of each other
   * and of the sixty cut, anything needing a job, money, a partner or a
   * flaw to answer cut. A story prompt with an obvious experience offers
   * a way in without it ("or one you've known well", "of any kind").
   * None carries `not`, so the school pool is 362. Each was measured on
   * the card and in the reel at 320, 375 and 390, as the forty were
   * (docs/look/topics/365/fit.json), and the eight that ran Today's card
   * to four lines at 375 or 390 were reworded to the idea in fewer or
   * shorter words: a 38-character topic with "community" in it breaks
   * where a 44-character one of short words does not. The review read
   * all 305 and replaced 21 in place, each with its id and shape: school
   * essay titles (zoos, museums, school in 2050), sermons ("starting
   * before you feel ready", "celebrating small wins", fair and equal, a
   * want from a need), near-twins of another topic (a big decision and
   * gut or list, turning down plans and leaving a conversation, a habit
   * and a phrase picked up from someone), and ones too thin or vague to
   * fill a minute. Their replacements ask for something everyone has
   * done or can picture: a shoelace, a text, a blanket fort, the front
   * seat.
   */
  { id: "t61", prompt: "The longest you can leave a text unanswered", shape: "opinion" },
  { id: "t62", prompt: "Someone who taught you by accident", shape: "story" },
  { id: "t63", prompt: "Explain why your feed seems to agree with you", shape: "explain" },
  { id: "t64", prompt: "Pitch a food to someone who swears they hate it", shape: "pitch" },
  { id: "t65", prompt: "Whether everyone should go to university", shape: "opinion" },
  { id: "t66", prompt: "The first game, of any kind, you got hooked on", shape: "story" },
  { id: "t67", prompt: "Explain how to keep a houseplant alive", shape: "explain" },
  { id: "t68", prompt: "Pitch a law you'd pass tomorrow", shape: "pitch" },
  { id: "t69", prompt: "Whether AI makes people lazier or smarter", shape: "opinion" },
  { id: "t70", prompt: "The first thing you learnt to cook, even toast", shape: "story" },
  { id: "t71", prompt: "Explain how to tie a shoelace using only words", shape: "explain" },
  { id: "t72", prompt: "Pitch a street party to your neighbours", shape: "pitch" },
  { id: "t73", prompt: "Whether to live in a city or the countryside", shape: "opinion" },
  { id: "t74", prompt: "The first big decision you made on your own", shape: "story" },
  { id: "t75", prompt: "Explain a tradition your family or friends keep", shape: "explain" },
  { id: "t76", prompt: "Pitch a language everyone should learn", shape: "pitch" },
  { id: "t77", prompt: "Whether you'd rather be respected or liked", shape: "opinion" },
  { id: "t78", prompt: "A meal you remember for who was at the table", shape: "story" },
  { id: "t79", prompt: "Explain how to revise for an exam in a week", shape: "explain" },
  { id: "t80", prompt: "Pitch an invention that makes mornings easier", shape: "pitch" },
  { id: "t81", prompt: "Whether the oldest or youngest child has it best", shape: "opinion" },
  { id: "t82", prompt: "A group project that actually worked", shape: "story" },
  { id: "t83", prompt: "Explain a slang word to someone twice your age", shape: "explain" },
  { id: "t84", prompt: "Pitch a food truck you'd run", shape: "pitch" },
  { id: "t85", prompt: "Whether grades measure anything that matters", shape: "opinion" },
  { id: "t86", prompt: "A song that takes you straight back somewhere", shape: "story" },
  { id: "t87", prompt: "Explain why people love a sport you don't get", shape: "explain" },
  { id: "t88", prompt: "Pitch a rule change for any sport or game", shape: "pitch" },
  { id: "t89", prompt: "Whether the book is always better than the film", shape: "opinion" },
  { id: "t90", prompt: "A place from childhood you can still picture", shape: "story" },
  { id: "t91", prompt: "Explain the point of a rule you used to hate", shape: "explain" },
  { id: "t92", prompt: "Pitch a new rule for your group chat", shape: "pitch" },
  { id: "t93", prompt: "Whether breakfast is the best meal of the day", shape: "opinion" },
  { id: "t94", prompt: "A time you told the truth when a lie was easier", shape: "story" },
  { id: "t95", prompt: "Explain your morning routine, step by step", shape: "explain" },
  { id: "t96", prompt: "Pitch a business you could start this weekend", shape: "pitch" },
  { id: "t97", prompt: "Whether it's better to be right or kind", shape: "opinion" },
  { id: "t98", prompt: "The best birthday you've had or been to", shape: "story" },
  { id: "t99", prompt: "Explain how to take good notes", shape: "explain" },
  { id: "t100", prompt: "Pitch a video game set in your town", shape: "pitch" },
  { id: "t101", prompt: "The point where running late becomes rude", shape: "opinion" },
  { id: "t102", prompt: "A goal you hit that nobody saw", shape: "story" },
  { id: "t103", prompt: "Explain the internet to someone from 1900", shape: "explain" },
  { id: "t104", prompt: "Pitch a new ice cream flavour", shape: "pitch" },
  { id: "t105", prompt: "Whether homework should exist", shape: "opinion" },
  { id: "t106", prompt: "A film you saw at exactly the right time", shape: "story" },
  { id: "t107", prompt: "Explain what makes a good villain", shape: "explain" },
  { id: "t108", prompt: "Pitch the film of your life so far", shape: "pitch" },
  { id: "t109", prompt: "Whether you can separate the art from the artist", shape: "opinion" },
  { id: "t110", prompt: "The hottest or coldest you've ever been", shape: "story" },
  { id: "t111", prompt: "Explain what you'd do with one extra hour a day", shape: "explain" },
  { id: "t112", prompt: "Pitch a phone-free dinner to your friends", shape: "pitch" },
  { id: "t113", prompt: "Whether esports count as sport", shape: "opinion" },
  { id: "t114", prompt: "A time you said what everyone was thinking", shape: "story" },
  { id: "t115", prompt: "Explain how to be a good guest in someone's home", shape: "explain" },
  { id: "t116", prompt: "Pitch a skill you could teach in ten minutes", shape: "pitch" },
  { id: "t117", prompt: "Whether you'd see your future if you could", shape: "opinion" },
  { id: "t118", prompt: "The neighbour you remember most", shape: "story" },
  { id: "t119", prompt: "Explain how to write a text no one can misread", shape: "explain" },
  { id: "t120", prompt: "Pitch a channel or creator you never miss", shape: "pitch" },
  { id: "t121", prompt: "Whether to tell a friend a hard truth", shape: "opinion" },
  { id: "t122", prompt: "A time you asked for help and it worked", shape: "story" },
  { id: "t123", prompt: "Explain blue to someone who's never seen colour", shape: "explain" },
  { id: "t124", prompt: "Pitch a holiday somewhere no one thinks to go", shape: "pitch" },
  { id: "t125", prompt: "Whether you should tell people your goals", shape: "opinion" },
  { id: "t126", prompt: "The first tech that felt like magic to you", shape: "story" },
  { id: "t127", prompt: "Explain how people end up supporting a team", shape: "explain" },
  { id: "t128", prompt: "Pitch a fairer way to queue", shape: "pitch" },
  { id: "t129", prompt: "An invention the world would be better without", shape: "opinion" },
  { id: "t130", prompt: "A pet you've had or one you've known well", shape: "story" },
  { id: "t131", prompt: "Explain how a toy you loved as a kid worked", shape: "explain" },
  { id: "t132", prompt: "Pitch the dish someone you know makes best", shape: "pitch" },
  { id: "t133", prompt: "Whether to binge a series or wait each week", shape: "opinion" },
  { id: "t134", prompt: "A day you'd happily live again", shape: "story" },
  { id: "t135", prompt: "Explain an inside joke to an outsider", shape: "explain" },
  { id: "t136", prompt: "Pitch a thirty-day challenge to a friend", shape: "pitch" },
  { id: "t137", prompt: "Whether you'd want to live forever", shape: "opinion" },
  { id: "t138", prompt: "A chat with a stranger that stuck with you", shape: "story" },
  { id: "t139", prompt: "Explain how to choose what to study", shape: "explain" },
  { id: "t140", prompt: "Pitch a museum about something ordinary", shape: "pitch" },
  { id: "t141", prompt: "Whether going to the cinema alone is underrated", shape: "opinion" },
  { id: "t142", prompt: "The day something you were learning clicked", shape: "story" },
  { id: "t143", prompt: "Explain why a song gets stuck in your head", shape: "explain" },
  { id: "t144", prompt: "Pitch a fictional world you'd live in", shape: "pitch" },
  { id: "t145", prompt: "Whether to follow your gut or make a list", shape: "opinion" },
  { id: "t146", prompt: "A time you went down an internet rabbit hole", shape: "story" },
  { id: "t147", prompt: "Explain how to explore a new town in a day", shape: "explain" },
  { id: "t148", prompt: "Pitch a week of saying yes to everything", shape: "pitch" },
  { id: "t149", prompt: "Whether you'd trust a self-driving car", shape: "opinion" },
  { id: "t150", prompt: "The loudest you've ever cheered for anything", shape: "story" },
  { id: "t151", prompt: "Explain how being kind differs from being nice", shape: "explain" },
  { id: "t152", prompt: "Pitch a shared garden for your street", shape: "pitch" },
  { id: "t153", prompt: "The one dish everyone should know how to cook", shape: "opinion" },
  { id: "t154", prompt: "A decision you still think was unfair", shape: "story" },
  { id: "t155", prompt: "Explain how to cheer up a friend on a bad day", shape: "explain" },
  { id: "t156", prompt: "Pitch a gap year to someone who's against it", shape: "pitch" },
  { id: "t157", prompt: "The first thing you'd change about the internet", shape: "opinion" },
  { id: "t158", prompt: "The last time you made someone's day", shape: "story" },
  { id: "t159", prompt: "Explain how to remember what you read", shape: "explain" },
  { id: "t160", prompt: "Pitch a new word the language needs", shape: "pitch" },
  { id: "t161", prompt: "Whether small talk is a waste of time", shape: "opinion" },
  { id: "t162", prompt: "The night before a big day", shape: "story" },
  { id: "t163", prompt: "Explain why people love being scared by films", shape: "explain" },
  { id: "t164", prompt: "Pitch a craft that deserves a comeback", shape: "pitch" },
  { id: "t165", prompt: "Whether you learn more from teachers or videos", shape: "opinion" },
  { id: "t166", prompt: "A time you helped someone older with their phone", shape: "story" },
  { id: "t167", prompt: "Explain how to look after a pet for a weekend", shape: "explain" },
  { id: "t168", prompt: "Pitch writing a letter to your future self", shape: "pitch" },
  { id: "t169", prompt: "Whether everyone should learn to code", shape: "opinion" },
  { id: "t170", prompt: "A trip, however short, you still think about", shape: "story" },
  { id: "t171", prompt: "Explain how to plan a scavenger hunt", shape: "explain" },
  { id: "t172", prompt: "Pitch a quiet night in over a night out", shape: "pitch" },
  { id: "t173", prompt: "Whether to travel alone or with friends", shape: "opinion" },
  { id: "t174", prompt: "A time you put someone else first", shape: "story" },
  { id: "t175", prompt: "Explain how to stay close to a friend far away", shape: "explain" },
  { id: "t176", prompt: "Pitch what you'd build with a free summer", shape: "pitch" },
  { id: "t177", prompt: "Something older people get wrong about your age", shape: "opinion" },
  { id: "t178", prompt: "A time someone remembered a small thing", shape: "story" },
  { id: "t179", prompt: "Explain how to get unstuck on a problem", shape: "explain" },
  { id: "t180", prompt: "Pitch a sequel to a film that doesn't have one", shape: "pitch" },
  { id: "t181", prompt: "Whether online friends are real friends", shape: "opinion" },
  { id: "t182", prompt: "A time you chose the harder option", shape: "story" },
  { id: "t183", prompt: "Explain what makes a joke funny", shape: "explain" },
  { id: "t184", prompt: "Pitch a night of camping to a city friend", shape: "pitch" },
  { id: "t185", prompt: "Whether every team needs a leader", shape: "opinion" },
  { id: "t186", prompt: "A word or phrase you picked up from someone", shape: "story" },
  { id: "t187", prompt: "Explain why food tastes better outside", shape: "explain" },
  { id: "t188", prompt: "Pitch keeping a one-line diary", shape: "pitch" },
  { id: "t189", prompt: "Whether slang makes language better or worse", shape: "opinion" },
  { id: "t190", prompt: "Something you noticed on a walk recently", shape: "story" },
  { id: "t191", prompt: "Explain how to find something you've lost", shape: "explain" },
  { id: "t192", prompt: "Pitch a birthday with no presents", shape: "pitch" },
  { id: "t193", prompt: "The best place to think", shape: "opinion" },
  { id: "t194", prompt: "A promise someone kept to you", shape: "story" },
  { id: "t195", prompt: "Explain how to remember people's names", shape: "explain" },
  { id: "t196", prompt: "Pitch school starting an hour later", shape: "pitch" },
  { id: "t197", prompt: "The one thing you'd save in a fire", shape: "opinion" },
  { id: "t198", prompt: "The first friend you can remember", shape: "story" },
  { id: "t199", prompt: "Explain how to build a good blanket fort", shape: "explain" },
  { id: "t200", prompt: "Pitch a new sport for the Olympics", shape: "pitch" },
  { id: "t201", prompt: "Whether surprise parties are a good idea", shape: "opinion" },
  { id: "t202", prompt: "Advice that only made sense later", shape: "story" },
  { id: "t203", prompt: "Explain how a game keeps you playing", shape: "explain" },
  { id: "t204", prompt: "Pitch a new kind of umbrella", shape: "pitch" },
  { id: "t205", prompt: "Whether competition makes us better", shape: "opinion" },
  { id: "t206", prompt: "A plot twist that got you completely", shape: "story" },
  { id: "t207", prompt: "Explain how to build the perfect sandwich", shape: "explain" },
  { id: "t208", prompt: "Pitch taking the long way home", shape: "pitch" },
  { id: "t209", prompt: "Whether a film should ever be over two hours", shape: "opinion" },
  { id: "t210", prompt: "A food you hated as a kid and love now", shape: "story" },
  { id: "t211", prompt: "Explain a world where nobody can lie", shape: "explain" },
  { id: "t212", prompt: "Pitch a walk as the best way to catch up", shape: "pitch" },
  { id: "t213", prompt: "Whether you need to be good at a hobby", shape: "opinion" },
  { id: "t214", prompt: "A time you gave someone a second chance", shape: "story" },
  { id: "t215", prompt: "Explain how to pick a gift that means something", shape: "explain" },
  { id: "t216", prompt: "Pitch your goal for this year to a sceptic", shape: "pitch" },
  { id: "t217", prompt: "Whether you'd take a year of being famous", shape: "opinion" },
  { id: "t218", prompt: "A story your friends or family always retell", shape: "story" },
  { id: "t219", prompt: "Explain how to pick a name for a band", shape: "explain" },
  { id: "t220", prompt: "Pitch a kind of music most people skip", shape: "pitch" },
  { id: "t221", prompt: "Whether a phone call beats a text", shape: "opinion" },
  { id: "t222", prompt: "The first time you led something", shape: "story" },
  { id: "t223", prompt: "Explain how to take a good photo on your phone", shape: "explain" },
  { id: "t224", prompt: "Pitch the best-kept secret where you live", shape: "pitch" },
  { id: "t225", prompt: "Whether all-nighters are ever worth it", shape: "opinion" },
  { id: "t226", prompt: "A piece of art that made you stop and look", shape: "story" },
  { id: "t227", prompt: "Explain a view you love so someone can see it", shape: "explain" },
  { id: "t228", prompt: "Pitch a better superpower than flying", shape: "pitch" },
  { id: "t229", prompt: "Whether AI art is really art", shape: "opinion" },
  { id: "t230", prompt: "Your first journey without an adult", shape: "story" },
  { id: "t231", prompt: "Explain how to apologise properly", shape: "explain" },
  { id: "t232", prompt: "Pitch a reunion for an old class or team", shape: "pitch" },
  { id: "t233", prompt: "The most underrated animal", shape: "opinion" },
  { id: "t234", prompt: "A time saying no was the right call", shape: "story" },
  { id: "t235", prompt: "Explain how to exit a conversation politely", shape: "explain" },
  { id: "t236", prompt: "Pitch a study group to people you barely know", shape: "pitch" },
  { id: "t237", prompt: "The best age to be", shape: "opinion" },
  { id: "t238", prompt: "A time you said yes to a last-minute plan", shape: "story" },
  { id: "t239", prompt: "Explain how to tidy a room in ten minutes", shape: "explain" },
  { id: "t240", prompt: "Pitch a chore you'd hand over to AI", shape: "pitch" },
  { id: "t241", prompt: "Whether you can leave a party without saying bye", shape: "opinion" },
  { id: "t242", prompt: "The last time you competed at anything", shape: "story" },
  { id: "t243", prompt: "Explain how something goes viral", shape: "explain" },
  { id: "t244", prompt: "Pitch the perfect pet for a small flat", shape: "pitch" },
  { id: "t245", prompt: "Whether to do what you love for a living", shape: "opinion" },
  { id: "t246", prompt: "A time technology failed at the worst moment", shape: "story" },
  { id: "t247", prompt: "Explain how to find your way without a phone", shape: "explain" },
  { id: "t248", prompt: "Pitch being bored on purpose", shape: "pitch" },
  { id: "t249", prompt: "Whether audiobooks count as reading", shape: "opinion" },
  { id: "t250", prompt: "A day you spent outside from morning to night", shape: "story" },
  { id: "t251", prompt: "Explain your plan for a day of being invisible", shape: "explain" },
  { id: "t252", prompt: "Pitch a sunrise to someone who loves sleep", shape: "pitch" },
  { id: "t253", prompt: "A sport that deserves more fans", shape: "opinion" },
  { id: "t254", prompt: "The fairest person you know", shape: "story" },
  { id: "t255", prompt: "Explain how to make a playlist for a party", shape: "explain" },
  { id: "t256", prompt: "Pitch a library to someone who's never been", shape: "pitch" },
  { id: "t257", prompt: "Whether you should keep score in friendships", shape: "opinion" },
  { id: "t258", prompt: "The strangest thing you've seen in public", shape: "story" },
  { id: "t259", prompt: "Explain how to get a group to agree", shape: "explain" },
  { id: "t260", prompt: "Pitch a mural for a wall you walk past", shape: "pitch" },
  { id: "t261", prompt: "A small courtesy that's dying out", shape: "opinion" },
  { id: "t262", prompt: "A deadline you only just made", shape: "story" },
  { id: "t263", prompt: "Explain how a good trailer hooks you", shape: "explain" },
  { id: "t264", prompt: "Pitch living somewhere it always rains", shape: "pitch" },
  { id: "t265", prompt: "A skill that's easier to learn than people think", shape: "opinion" },
  { id: "t266", prompt: "A show you made someone else watch", shape: "story" },
  { id: "t267", prompt: "Explain how your town changes with the seasons", shape: "explain" },
  { id: "t268", prompt: "Pitch planting a tree you'll never sit under", shape: "pitch" },
  { id: "t269", prompt: "Whether you'd take a one-way ticket to Mars", shape: "opinion" },
  { id: "t270", prompt: "Something you collected as a kid", shape: "story" },
  { id: "t271", prompt: "Explain how to settle who sits in the front seat", shape: "explain" },
  { id: "t272", prompt: "Pitch a picnic over a restaurant", shape: "pitch" },
  { id: "t273", prompt: "Whether spicy food is worth the pain", shape: "opinion" },
  { id: "t274", prompt: "A time you kept a secret for a good reason", shape: "story" },
  { id: "t275", prompt: "Explain the unwritten rules of your home", shape: "explain" },
  { id: "t276", prompt: "Pitch a podcast you'd host and its first guest", shape: "pitch" },
  { id: "t277", prompt: "Whether the person who cooks should wash up", shape: "opinion" },
  { id: "t278", prompt: "The last time you got caught in the rain", shape: "story" },
  { id: "t279", prompt: "Explain how to give someone honest feedback", shape: "explain" },
  { id: "t280", prompt: "Pitch a theme park ride worth a two-hour queue", shape: "pitch" },
  { id: "t281", prompt: "The one thing friends have to agree on", shape: "opinion" },
  { id: "t282", prompt: "Someone who made you want to work harder", shape: "story" },
  { id: "t283", prompt: "Explain how you'd build a city on the moon", shape: "explain" },
  { id: "t284", prompt: "Pitch an animal as your town's mascot", shape: "pitch" },
  { id: "t285", prompt: "The most useful thing school taught you", shape: "opinion" },
  { id: "t286", prompt: "A night the wifi or power went out", shape: "story" },
  { id: "t287", prompt: "Explain how to make a long journey go faster", shape: "explain" },
  { id: "t288", prompt: "Pitch giving a Saturday to a good cause", shape: "pitch" },
  { id: "t289", prompt: "Whether the internet should forget old posts", shape: "opinion" },
  { id: "t290", prompt: "A casual game that got far too serious", shape: "story" },
  { id: "t291", prompt: "Explain the three things a good day needs", shape: "explain" },
  { id: "t292", prompt: "Pitch a playground for grown-ups", shape: "pitch" },
  { id: "t293", prompt: "The best smell in the world", shape: "opinion" },
  { id: "t294", prompt: "A time someone bent the rules and was right to", shape: "story" },
  { id: "t295", prompt: "Explain how to tell a story at the dinner table", shape: "explain" },
  { id: "t296", prompt: "Pitch a competition you'd run in your town", shape: "pitch" },
  { id: "t297", prompt: "When finders keepers stops being fair", shape: "opinion" },
  { id: "t298", prompt: "A message or card you've kept", shape: "story" },
  { id: "t299", prompt: "Explain why good teams beat star players", shape: "explain" },
  { id: "t300", prompt: "Pitch the book you'd write if you had to", shape: "pitch" },
  { id: "t301", prompt: "The perfect size for a friend group", shape: "opinion" },
  { id: "t302", prompt: "The best class you've ever taken", shape: "story" },
  { id: "t303", prompt: "Explain where dreams might come from", shape: "explain" },
  { id: "t304", prompt: "Pitch making something instead of buying it", shape: "pitch" },
  { id: "t305", prompt: "The best thing about being a beginner", shape: "opinion" },
  { id: "t306", prompt: "A time AI genuinely surprised you", shape: "story" },
  { id: "t307", prompt: "Explain how to fold a paper plane that flies", shape: "explain" },
  { id: "t308", prompt: "Pitch picking up an instrument at any age", shape: "pitch" },
  { id: "t309", prompt: "Whether we should bring back extinct animals", shape: "opinion" },
  { id: "t310", prompt: "The best sky you've ever seen", shape: "story" },
  { id: "t311", prompt: "Explain what makes a place feel like home", shape: "explain" },
  { id: "t312", prompt: "Pitch inviting the new person along", shape: "pitch" },
  { id: "t313", prompt: "The month you'd skip if you could", shape: "opinion" },
  { id: "t314", prompt: "The best swap you've ever made", shape: "story" },
  { id: "t315", prompt: "Explain how to write a good birthday message", shape: "explain" },
  { id: "t316", prompt: "Pitch learning something useless", shape: "pitch" },
  { id: "t317", prompt: "Whether a promise made as a kid still counts", shape: "opinion" },
  { id: "t318", prompt: "The best compliment you've ever had", shape: "story" },
  { id: "t319", prompt: "Explain how to keep a little kid busy all day", shape: "explain" },
  { id: "t320", prompt: "Pitch a day in history worth travelling back to", shape: "pitch" },
  { id: "t321", prompt: "Whether you become who you spend time with", shape: "opinion" },
  { id: "t322", prompt: "Something you're glad you quit", shape: "story" },
  { id: "t323", prompt: "Explain the best idea you've heard this year", shape: "explain" },
  { id: "t324", prompt: "Pitch a day trip you could do by bike", shape: "pitch" },
  { id: "t325", prompt: "The fairest way to pick a team", shape: "opinion" },
  { id: "t326", prompt: "Something you tried because you saw it online", shape: "story" },
  { id: "t327", prompt: "Explain how to win at rock, paper, scissors", shape: "explain" },
  { id: "t328", prompt: "Pitch a dinner where everyone brings one dish", shape: "pitch" },
  { id: "t329", prompt: "Whether being an influencer counts as work", shape: "opinion" },
  { id: "t330", prompt: "The cleverest thing you've seen an animal do", shape: "story" },
  { id: "t331", prompt: "Explain what phones will do that they can't yet", shape: "explain" },
  { id: "t332", prompt: "Pitch yourself as class captain", shape: "pitch" },
  { id: "t333", prompt: "Whether to stick with a team that always loses", shape: "opinion" },
  { id: "t334", prompt: "The future you pictured when you were eight", shape: "story" },
  { id: "t335", prompt: "Explain how to make friends in a new place", shape: "explain" },
  { id: "t336", prompt: "Pitch a reality show you'd actually watch", shape: "pitch" },
  { id: "t337", prompt: "Whether you should let a kid win at games", shape: "opinion" },
  { id: "t338", prompt: "A time you were proud of someone else", shape: "story" },
  { id: "t339", prompt: "Explain how to stay focused for an hour", shape: "explain" },
  { id: "t340", prompt: "Pitch swimming outdoors, whatever the weather", shape: "pitch" },
  { id: "t341", prompt: "The most overrated celebration of the year", shape: "opinion" },
  { id: "t342", prompt: "Your proudest moment at school", shape: "story" },
  { id: "t343", prompt: "Explain a saying you grew up hearing", shape: "explain" },
  { id: "t344", prompt: "Pitch an evening routine to a night owl", shape: "pitch" },
  { id: "t345", prompt: "Advice for someone new to high school", shape: "opinion" },
  { id: "t346", prompt: "A line from a film or show you still quote", shape: "story" },
  { id: "t347", prompt: "Explain how you know who to trust", shape: "explain" },
  { id: "t348", prompt: "Pitch a cartoon you grew up with to a kid today", shape: "pitch" },
  { id: "t349", prompt: "The best decade for music", shape: "opinion" },
  { id: "t350", prompt: "A meal you ate somewhere unusual", shape: "story" },
  { id: "t351", prompt: "Explain how your phone's home screen is laid out", shape: "explain" },
  { id: "t352", prompt: "Pitch an emoji that should exist", shape: "pitch" },
  { id: "t353", prompt: "Whether to stay in your hometown or leave", shape: "opinion" },
  { id: "t354", prompt: "A rule you made up that people actually followed", shape: "story" },
  { id: "t355", prompt: "Explain how to split work fairly in a group", shape: "explain" },
  { id: "t356", prompt: "Pitch a better greeting than a handshake", shape: "pitch" },
  { id: "t357", prompt: "Whether sixteen-year-olds should vote", shape: "opinion" },
  { id: "t358", prompt: "A stranger you see so often they feel familiar", shape: "story" },
  { id: "t359", prompt: "Explain what you'd put in a time capsule", shape: "explain" },
  { id: "t360", prompt: "Pitch a pencil like it's the latest phone", shape: "pitch" },
  { id: "t361", prompt: "Whether spoilers really ruin a story", shape: "opinion" },
  { id: "t362", prompt: "The highest place you've ever stood", shape: "story" },
  { id: "t363", prompt: "Explain your music taste in three songs", shape: "explain" },
  { id: "t364", prompt: "Pitch who your town should put up a statue of", shape: "pitch" },
  { id: "t365", prompt: "The person you'd swap lives with for a day", shape: "opinion" },
];

/**
 * Pick a topic at random, never repeating the one on screen.
 *
 * `rand` is injected so the spin is testable — Math.random() in a
 * component is untestable by construction.
 */
export function spin(
  exclude: string | null = null,
  rand: () => number = Math.random,
  /** The pool to draw from; the profile narrows it (lib/profile.ts). */
  from: Topic[] = TOPICS
): Topic {
  const pool = exclude ? from.filter((t) => t.id !== exclude) : from;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

export function topicById(id: string | null | undefined): Topic | null {
  if (!id) return null;
  return TOPICS.find((t) => t.id === id) ?? null;
}

export function tipsFor(shape: TopicShape): string[] {
  return TOPIC_SHAPES[shape].tips;
}

/**
 * Where a topic in display type (Today's card, the recorder's ready
 * card, `.home-display`) steps down a size: past 40 characters to 34px,
 * and past 60 to 28, the reel's own size (#473). At 34px t12, the one
 * prompt over 60, ran five lines and stretched Today's card 58px past
 * its 376 at 390 (docs/look/topics/before/card-longest-390-light.png).
 */
export const LONG_TOPIC = 40;
export const LONGER_TOPIC = 60;
