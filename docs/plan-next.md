# Ethos: the next round of tweaks

Timothy's notes of 12 November 2026, organised. The app works and is nearly done; these are the things that stand between "done" and "people love it". Nothing here is built yet.

**The short version:** one thing glows, the mascot becomes an illustrated elephant who listens, Settings grows up, Hostile Q&A goes free, Premium becomes "support the maker", numbers get meaning, the weekly boss gets prep material and scenarios, and feedback has to stick.

---

## 1. Kill the glow (except one thing)

**What's wrong.** Everything is flat, clean, Apple-like, except the glowing 3D glass objects: on every lesson, in the Lessons list, and in the tiles at the bottom of Today. They clash with the rest, and even if nobody can say why, they feel it. They read as AI-generated.

**The rule.** Only one thing on a screen is 3D and glowing: the thing to do today ("Speak today", "Do your lesson today"). Everything else is flat.

**What changes**
- Today's practice card keeps its depth and its object. That's the one.
- Today's bottom tiles (Variety, Pace, Fillers, Restarts): flat, no glass objects.
- Lessons list and each lesson's screen: replace the 45 glass renders with flat, casual, modern illustrations or icons in the app's line style.
- The trait stages (the big coloured header on a lesson): flat colour, no glow behind the art.

**To decide**
- Who makes the new lesson art: a designer, an icon set, or generated in one flat style and cleaned up?
- Does the "today" object stay 3D glass, or does it also go flat and get its standout from size and colour alone?

**Size:** medium. Mostly art swap plus removing glow CSS.

---

## 2. New mascot: an elephant who listens

**What's wrong.** Demos is a red panda. A red panda has nothing to do with listening, and the 3D render reads as immature.

**The idea.** An elephant: intelligent, empathetic, and big ears. All he does is listen, then speak back. That's the whole character.

**What changes**
- Flat illustration, not 3D. Same line language as the rest of the app.
- Poses he needs (the current set, redrawn): listening (ears forward), speaking back, celebrating, idle, thinking, hello. Plus the ear moves: ears perk up while you speak (today Demos' ears already react to your voice).
- Rename? "Demos" was chosen for the red panda. Keep the name or give the elephant his own.
- The Shop sells poses for Demos; those become the elephant's.

**Already in motion:** a designer (Eugene) was quoting a Rive-rigged mascot. Rive suits this: one rig, ears that move with your voice.

**To decide:** the name; Rive animation versus still illustrations; when the switch ships (all at once, or Today first).

**Size:** large (art), small (code: the poses are swapped in one place).

---

## 3. Settings, done properly

**What's wrong.** Settings is thin. Basic things people expect are missing, like changing your password.

**The reference set:** Duolingo, Stripe, YouTube, Instagram. Copy what a user would actually look for.

**Missing today**
- **Account:** change email, change password, sign-in methods (Google linked or not), sign out of all devices.
- **Profile:** name, photo or avatar, the goal and focus you picked in the introduction (change them later).
- **Notifications:** more than one daily reminder switch. Reminder time, streak-at-risk nudge, weekly boss nudge, each on or off.
- **Practice:** default recording length, think time before recording, which traits to focus on, Video on or off by default.
- **Accessibility:** text size (follows the phone, already built), reduced motion (built), captions on playback, high contrast, haptics (built), sound (built).
- **Privacy and data:** download your data (built), what's stored, delete recordings (one or all), delete account (built).
- **Plan:** see your plan, manage or cancel, receipts (Stripe's customer portal does most of this).
- **Help:** contact, FAQ, report a problem, what's new.

**Size:** medium. Mostly layout plus a few Supabase calls (email and password change are built into Supabase Auth).

---

## 4. Make it fun: Hostile Q&A goes free

**What Timothy noticed.** The most fun thing in the app is Hostile Q&A. It's locked to once a week on the free plan.

**What changes**
- Hostile Q&A free for everyone (still rate-limited for cost).
- Look at what makes it fun (a real back-and-forth, someone pushing on what you said) and bring more of that into the daily practice.

**Size:** small.

---

## 5. Premium becomes "support the maker"

**The shift.** Keep it freemium, but frame Premium as supporting the creator, not as a wall. The core loop is free and complete.

**What stays free:** the daily practice, lessons, all games including Hostile Q&A, the score and the feedback.

**What supporters get (to decide):** full history, more of the judged coaching reads, Video, the cosmetic Shop items, an early look at new things, a supporter badge.

**To decide:** price (the monthly price ladder that drops while you stay is built; keep it or simplify), and wording ("Support Ethos", "Back the maker").

**Size:** small to medium. Mostly copy and which features check the plan.

---

## 6. What Ethos is really selling

**The insight.** Nobody wants to "learn to speak" for a year the way they learn a language. Duolingo works because a language obviously takes years. With speaking, people don't want lessons; they want to *be* confident. The need spikes around interviews, presentations, dates, a new job.

**The direction.** Market the outcome, not the skill:
- sound confident
- get to the point
- make people listen

**But show it, don't say it.** No "become confident!" copy. The app should demonstrate it: hear your take from day one beside today's, the before and after.

**What changes**
- The marketing site and the App Store page lead with moments people care about (the interview next week, the pitch Friday), not "practise speaking daily".
- Scenario practice (section 8) is the product answer to "the spike".

**Size:** copy and marketing; feeds sections 7 and 8.

---

## 7. Numbers that mean something

**What's wrong.** "2.8 fillers a minute" means nothing to someone new. Timothy's example: "you ran a 6-minute kilometre" is meaningless if you don't run.

**The fix.** Every number says what it means in plain terms, still traced to the recording:
- **A comparison people feel:** "about one 'um' every 20 seconds".
- **Where you sit:** "fewer than most people starting out" (the percentiles exist; say them in words).
- **What it sounds like:** play the moment. "Here's 0:14, where you rushed." Your own voice explains a number better than any label.
- **One headline in words, numbers underneath.** Lead with "You sounded steady and got to the point", then the numbers for anyone who wants them.
- **The trend in words:** "Half the ums of your first week."

**Rule kept:** every sentence still points to a timestamp or a number. Words are added on top of the numbers, they don't replace them.

**Size:** medium. Copy plus small UI changes on the results and the Log.

---

## 8. The weekly boss, and practising for real moments

**What's wrong.** The weekly boss is great but nobody would know why. Even its maker feels it undersells itself.

**The idea:** treat it like a podcast guest's prep sheet. "This is what we'll ask you about. Read up, take notes, then come on."

**What changes**
- **A prep page for each topic:** a short readable brief, a few key facts, two or three sources or passages, the likely questions.
- **Notes on the side** while you read, which you can glance at before you start (the boss already hides notes once the clock runs).
- **Explain why it matters:** "Interviews and meetings throw a topic at you with a day's notice. This is that."

**Scenarios: practice for real moments**
- Job interview
- Casual conversation
- Debate (Hostile Q&A lives here)
- Explaining a big topic
- Teaching someone

Each scenario is a set of prompts, a way of being scored that fits it (an interview cares about structure and concrete examples; casual conversation about warmth and pace), and the feedback in its own terms. This is also the answer to section 6: someone with an interview Thursday picks "Job interview" and practises for that.

**Size:** large. Content (briefs, sources, prompts) is most of it.

---

## 9. Feedback that actually sticks

**The problem, in Timothy's words.** You read "kill like", you understand it, and tomorrow you do the same thing. Not because you're bad at speaking or bad at learning. You can't think about a rule and speak at the same time, and a reminder doesn't fix that, because the reminder is just more to think about while talking.

**Why it happens.** Knowing and doing are separate. Speaking is automatic; advice is conscious. Advice read once after a take never reaches the automatic part.

**Ideas to try (pick one or two first)**
1. **One thing only.** The result ends on a single cue to carry, not a list. "Tomorrow: pause instead of 'like'."
2. **Rehearse the cue before the take.** Before tomorrow's recording, a 10-second warm-up on only that cue (say one sentence, hold the pause where the "like" was). Practising it alone, with nothing else to think about, is what makes it automatic.
3. **Close the loop the next day.** Tomorrow's result answers yesterday's cue first: "You said 'like' 3 times, down from 9."
4. **Hear it, don't read it.** Play back the exact moment the filler happened, then the same sentence from a take where you didn't. Hearing yourself sticks better than reading about yourself.
5. **Silence as the replacement.** "Kill like" fails because it leaves a gap. "Pause where 'like' was" gives the brain something to do instead. The app already suggests this; make it the cue.
6. **Spaced repeats.** A cue comes back after 1, 3 and 7 days until it holds, then retires.

**Size:** medium. Mostly the results' last step, the recorder's opening, and a small store of "the cue you're carrying".

---

## Suggested order

1. **Kill the glow** and **Hostile Q&A free**: fast, visible, nothing to decide on art except the lesson images.
2. **Feedback that sticks** (one cue, rehearsed, checked the next day): the biggest change to whether people actually improve.
3. **Numbers that mean something**: makes every result readable to a newcomer.
4. **Settings**: expected basics, low risk.
5. **Premium as support the maker**: copy and plan checks.
6. **Weekly boss prep and scenarios**: biggest build, mostly content.
7. **The elephant**: when the art is ready.

## Open questions for Timothy

- New lesson art: who makes it, and what style exactly (a reference or two would settle it)?
- The elephant's name, and Rive or still illustrations?
- What supporters get, and the price.
- Which scenario to build first (job interview is the likeliest spike).
- For feedback that sticks: start with "one cue, rehearsed before the take, checked the next day"?
