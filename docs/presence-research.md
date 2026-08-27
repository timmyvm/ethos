# Presence research — who else scores body language, and what exactly they measure

> One focused pass (27 Aug 2026, CLAUDE.md protocol), run after the first
> two real calibration sessions (#188, #189). Question: does camera-based
> presence scoring exist elsewhere, what precisely is measured, and what
> should Ethos adopt, keep, or refuse. Adoptions are flagged for
> DECISIONS, never silently applied. Findings recorded in #190.

## Products

| Product | Visual signals | How scored | Processing |
|---|---|---|---|
| **Yoodli** | Eye contact (% of time at camera), gestures, some facial expression | Post-session dashboard %, LLM comments | Cloud, algorithm undocumented |
| **Poised** | NONE today. 2021–23 marketing claimed body language/eye contact; quietly retreated to audio-only | n/a | Cloud |
| **Orai** | "Expressiveness, eye contact, tension" via video | Undocumented | Cloud |
| **Speeko** | None (audio only) | n/a | — |
| **VirtualSpeech** (VR) | Eye-contact heatmap across virtual audience. States openly that gaze is proxied by HEAD orientation | Zone heatmap, neglected-zone flags | Headset |
| **PitchVantage** | Virtual audience reacts live to 10 delivery elements incl. eye contact, gestures | Avatars engage/disengage; annotated replay | Undocumented |
| **MS Speaker Coach** | PowerPoint-web only, off by default: facing-camera, distance, lighting, attire, clear-view. Setup checks, not skill scores. Teams version retired Aug 2025 (low usage) | One critique at a time + report | Cloud |
| **Virtual Sapiens** | ~25 metrics: posture, gestures, gaze, expressivity, nodding + separate setup tier (framing, lighting). Flags only behaviours repeated over a time window, never single frames | In-call nudges + assessment | **Local in browser, no video stored** — the closest architectural comp to ours |
| **Google Interview Warmup** | Never had a camera. Retired | — | — |

## Academic systems (where the definitions live)

- **MACH** (MIT, UbiComp 2013): per-frame smile intensity, binary head
  nods/shakes, plotted as timelines. Validated: only the MACH group
  improved on counselor-rated interviews (n=90).
- **ROC Speak** (Rochester 2015): smile 0–100/frame; body movement =
  mean absolute pixel difference between frames (deliberately
  webcam-only). 10-week deployment, significant gains.
- **AutoManner** (IUI 2016): the only system measuring gesture
  REPETITIVENESS — sparse coding finds ~2s recurring mannerisms and
  replays them for awareness. Nobody productised it.
- **Presentation Trainer** (2015): rule-based Kinect. The one published
  gesture-cadence threshold anywhere: **speaking >6 seconds with no
  gesture = flagged**. One feedback item at a time (cognitive-load
  rationale — independently the same call as our one-focus rule).
- **USC ICT / Cicero line** (2015–16): the best validation numbers in
  the field. Gaze = head direction toward audience; eye-contact ratio =
  fraction of time audience-directed. Automatic prediction vs expert
  ratings: overall r = 0.745, **gesture usage r = 0.820** (highest of
  all items), eye contact r = 0.559, posture r = 0.540. Humans
  annotating "eye contact" only agree at alpha = 0.751.
- **ETS** (2016): hand-speed mean correlates r = .531 with holistic
  human scores; posture as "bounding volume" openness; head features =
  mean/SD of head angle from camera-zero — near-identical to our
  pitch/yaw proxy and head-stability MAD.

## What this validates about the engine (no change needed)

1. **Eye line as head pose is the industry method** — VirtualSpeech
   admits it, USC and ETS formalise it; everyone else ships it silently
   as "eye contact". Our copy already says "head up and facing the
   camera", which is more honest than the market standard. The pupil
   gap Timothy found (#189) is real but shared by everyone without an
   iris model.
2. **Gesture RATE is the single best-validated visual correlate of
   speaking quality** (r = .820 USC; hand-speed r = .531 ETS). The
   burst-rate dimension is pointed at the right signal.
3. **The 6-second no-gesture rule** (Presentation Trainer) supports our
   zone floor of ~8/min.
4. **Time-windowed flagging** (Virtual Sapiens): never score one frame.
   Our burst minimums, moment durations and trailing ring window
   already comply.
5. **Local-only, derived-numbers-persist is the strongest privacy
   stance in market** (Virtual Sapiens states it as a selling point;
   Yoodli/Orai are cloud and opaque). Ours is already this. Say it in
   marketing.

## What to refuse, now recorded rather than implicit (#190)

- **Facial expression / smile scoring.** HireVue dropped facial
  analysis in Jan 2021 under an FTC complaint and bias findings
  (neurodivergent users, facial differences), and by its own admission
  visual signals carried ~0.25% of predictive power. Smile-rate targets
  are also culturally loaded. MACH/ROC Speak measure smiles in research
  settings; no consumer product survives shipping it.
- **Emotion or confidence inference from the face** ("you looked
  nervous"): unverifiable, contested, horoscope feedback by definition.
- **Attire/background judgments** (Speaker Coach scores attire):
  surveillance-flavoured, skill-irrelevant.

## Open ideas, queued not adopted

- **Iris-based gaze** (MediaPipe Face Landmarker, ~3MB, on-device):
  the honest fix for eyes-vs-head (#189). Real upgrade path.
- **Mannerism detection** (AutoManner): repetitive-gesture flagging is
  unowned territory and fits "every claim traces to a moment" —
  post-MVP.
- **Posture as openness** (ETS bounding volume): candidate slump
  replacement if raw-frame analysis kills headLift; test offline
  against the bench downloads first.
- **Gesture-speech synchrony**: nobody measures it; we uniquely have
  word timestamps + pose timelines in one product.

## Competitive bottom line

Among daily-practice apps, camera scoring is rare and retreating
(Poised dropped it, Speaker Coach setup-checks only, Speeko/Warmup
never had it); those who do it (Yoodli, Orai) are cloud-based and
opaque. **On-device pose scoring with published metric definitions and
target zones has no direct competitor**, and every Ethos dimension
except head stability has a citable validation anchor (head stability
is indirectly supported by ETS head-angle SD).
