# Whisper parity at 32 kbps (#508, 18 Nov 2026)

Question: does recording speech at 32 kbps Opus (`lib/speech-recorder.ts`) instead of the browser's default of about 128 kbps cost Whisper any fillers? whisper-1 could not be called from the lab, so this is a local proxy: faster-whisper `small.en` (int8, beam 5, temperature 0, word timestamps), Ethos's `DISFLUENCY_PROMPT` verbatim, fillers counted by a port of `lib/metrics.ts` `fillerSpans`. Five 75 s public-domain clips of conversational speech (NASA podcasts and press audio, two archive.org oral histories, one from a 1985 cassette), each encoded with ffmpeg at 128k, 48k, 32k (libopus voip and audio) and 32k AAC-LC, plus three noise-floor versions of 128k (shifted 20 ms, turned down 1 dB).

**Verdict.** 32 kbps Opus keeps filler counts within run-to-run noise: every 32k Opus version came within one filler per clip of 128k, while inaudible changes to the 128k file itself moved counts by up to three. 32k Opus in audio mode matched 33 of 33 fillers. 32k AAC (ffmpeg's encoder, weaker than Apple's) matched 29 of 33, at the edge of the noise. 48k Opus was not measurably safer. Caveats: a smaller model than whisper-1, mastered audio rather than a phone in a room, 33 fillers in all. The field check is the cohort's fillers a minute before and after the deploy (aggregate only).

Pooled across the five clips, 128k Opus as the baseline:

| version | KB a minute | fillers | um/uh/erm | filler hits matched to 128k | mean WER vs 128k (all / without the cassette) |
|---|---|---|---|---|---|
| 128k Opus | 860 to 1100 | 33 | 9 | 33/33 | 0 |
| 128k, shifted 20 ms (noise) | same | 30 | 7 | 30/33 | 3.3% / 0.8% |
| 128k, -1 dB (noise) | same | 31 | 9 | 30/33 | 3.3% / 0.8% |
| 48k Opus | 345 to 378 | 34 | 9 | 33/33 | 4.2% / 1.1% |
| 32k Opus voip | 230 to 260 | 33 | 9 | 31/33 | 8.8% / 1.5% |
| 32k Opus audio | 230 to 260 | 34 | 10 | 33/33 | 3.6% / 0.55% |
| 32k AAC-LC | 246 to 252 | 30 | 9 | 29/33 | 6.5% / 2.1% |

Every filler that moved was Whisper deciding whether to write a quiet "uh" or "like", which it did as often in the lossless and noise-floor versions as at 32k. The cassette clip's large WER swings are Whisper's own instability on noisy audio (the lossless reference ended in a hallucination loop), not the codec.

Per clip:


### c1_ep402
| version | KB/min | words | fillers (all) | um/uh/erm | like | you know | kind/sort of | other | filler hits matched to 128k (±0.6 s) | WER vs 128k |
|---|---|---|---|---|---|---|---|---|---|---|
| ref | 5625 | 276 | 15 | 6 | 8 | 0 | 1 | 0 | 15/15 | 0.0% |
| opus128 | 1099 | 276 | 15 | 6 | 8 | 0 | 1 | 0 | 15/15 | 0.0% |
| opus128shift | 1099 | 270 | 12 | 4 | 7 | 0 | 1 | 0 | 12/15 | 3.3% |
| opus128gain | 1099 | 275 | 15 | 7 | 7 | 0 | 1 | 0 | 14/15 | 1.8% |
| opus48 | 375 | 279 | 16 | 6 | 8 | 0 | 2 | 0 | 15/15 | 3.3% |
| opus32voip | 256 | 279 | 16 | 6 | 8 | 0 | 2 | 0 | 15/15 | 3.3% |
| opus32voipshift | 256 | 275 | 15 | 6 | 7 | 0 | 2 | 0 | 14/15 | 5.8% |
| opus32audio | 256 | 277 | 15 | 6 | 8 | 0 | 1 | 0 | 15/15 | 0.4% |
| aac32 | 252 | 272 | 15 | 7 | 7 | 0 | 1 | 0 | 14/15 | 2.9% |

### c2_artemis
| version | KB/min | words | fillers (all) | um/uh/erm | like | you know | kind/sort of | other | filler hits matched to 128k (±0.6 s) | WER vs 128k |
|---|---|---|---|---|---|---|---|---|---|---|
| ref | 5625 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus128 | 1062 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus128shift | 1061 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus128gain | 1062 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus48 | 357 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus32voip | 242 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus32voipshift | 242 | 142 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 0.0% |
| opus32audio | 242 | 140 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 1.4% |
| aac32 | 250 | 140 | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 1.4% |

### c3_ep441
| version | KB/min | words | fillers (all) | um/uh/erm | like | you know | kind/sort of | other | filler hits matched to 128k (±0.6 s) | WER vs 128k |
|---|---|---|---|---|---|---|---|---|---|---|
| ref | 5625 | 223 | 7 | 0 | 3 | 2 | 2 | 0 | 7/9 | 0.9% |
| opus128 | 1095 | 225 | 9 | 1 | 4 | 2 | 2 | 0 | 9/9 | 0.0% |
| opus128shift | 1095 | 225 | 9 | 1 | 4 | 2 | 2 | 0 | 9/9 | 0.0% |
| opus128gain | 1095 | 224 | 7 | 0 | 3 | 2 | 2 | 0 | 7/9 | 1.3% |
| opus48 | 378 | 227 | 9 | 1 | 4 | 2 | 2 | 0 | 9/9 | 0.9% |
| opus32voip | 258 | 224 | 8 | 1 | 3 | 2 | 2 | 0 | 8/9 | 1.8% |
| opus32voipshift | 258 | 224 | 8 | 1 | 3 | 2 | 2 | 0 | 8/9 | 0.4% |
| opus32audio | 258 | 225 | 9 | 1 | 4 | 2 | 2 | 0 | 9/9 | 0.4% |
| aac32 | 252 | 222 | 7 | 0 | 3 | 2 | 2 | 0 | 7/9 | 2.2% |

### c4_nelson
| version | KB/min | words | fillers (all) | um/uh/erm | like | you know | kind/sort of | other | filler hits matched to 128k (±0.6 s) | WER vs 128k |
|---|---|---|---|---|---|---|---|---|---|---|
| ref | 5625 | 198 | 6 | 1 | 1 | 3 | 1 | 0 | 4/5 | 37.7% |
| opus128 | 857 | 223 | 5 | 0 | 1 | 3 | 1 | 0 | 5/5 | 0.0% |
| opus128shift | 856 | 215 | 5 | 0 | 1 | 3 | 1 | 0 | 5/5 | 13.0% |
| opus128gain | 857 | 210 | 5 | 0 | 1 | 3 | 1 | 0 | 5/5 | 13.5% |
| opus48 | 345 | 219 | 5 | 0 | 1 | 3 | 1 | 0 | 5/5 | 17.0% |
| opus32voip | 230 | 158 | 6 | 1 | 1 | 3 | 1 | 0 | 5/5 | 38.1% |
| opus32voipshift | 230 | 204 | 4 | 0 | 1 | 2 | 1 | 0 | 4/5 | 24.2% |
| opus32audio | 230 | 228 | 6 | 1 | 1 | 3 | 1 | 0 | 5/5 | 15.7% |
| aac32 | 250 | 206 | 4 | 0 | 0 | 3 | 1 | 0 | 4/5 | 23.8% |

### c5_adams
| version | KB/min | words | fillers (all) | um/uh/erm | like | you know | kind/sort of | other | filler hits matched to 128k (±0.6 s) | WER vs 128k |
|---|---|---|---|---|---|---|---|---|---|---|
| ref | 5625 | 151 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 1.3% |
| opus128 | 989 | 149 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 0.0% |
| opus128shift | 989 | 149 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 0.0% |
| opus128gain | 989 | 149 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 0.0% |
| opus48 | 378 | 149 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 0.0% |
| opus32voip | 260 | 148 | 1 | 1 | 0 | 0 | 0 | 0 | 1/2 | 0.7% |
| opus32voipshift | 260 | 150 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 2.7% |
| opus32audio | 260 | 149 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 0.0% |
| aac32 | 246 | 152 | 2 | 2 | 0 | 0 | 0 | 0 | 2/2 | 2.0% |

### All clips pooled
| version | words | fillers | um/uh/erm | matched to 128k | mean WER vs 128k |
|---|---|---|---|---|---|
| ref | 990 | 32 | 9 | 30/33 | 8.0% |
| opus128 | 1015 | 33 | 9 | 33/33 | 0.0% |
| opus128shift | 1001 | 30 | 7 | 30/33 | 3.3% |
| opus128gain | 1000 | 31 | 9 | 30/33 | 3.3% |
| opus48 | 1016 | 34 | 9 | 33/33 | 4.2% |
| opus32voip | 951 | 33 | 9 | 31/33 | 8.8% |
| opus32voipshift | 995 | 31 | 9 | 30/33 | 6.6% |
| opus32audio | 1019 | 34 | 10 | 33/33 | 3.6% |
| aac32 | 992 | 30 | 9 | 29/33 | 6.5% |

Clips (all public domain: NASA works, or archive.org items under the Public Domain Mark 1.0), 75 s each:
1. c1, 10:00 to 11:15: https://images-assets.nasa.gov/audio/Ep402_On_A_Desert_Island_With_the_2025_Class_of_Astronaut_Candidates/Ep402_On_A_Desert_Island_With_the_2025_Class_of_Astronaut_Candidates~orig.mp3
2. c2, 10:00 to 11:15: https://images-assets.nasa.gov/audio/KSC-20250730-AU-LMM01-0001-Artemis_II_Crew_Media_Event_Press_Site_Bullpen-M15737/KSC-20250730-AU-LMM01-0001-Artemis_II_Crew_Media_Event_Press_Site_Bullpen-M15737~orig.mp3
3. c3, 10:00 to 11:15: https://images-assets.nasa.gov/audio/Ep441_Reflections_After_Artemis_II/Ep441_Reflections_After_Artemis_II~orig.mp3
4. c4, 5:00 to 6:15: https://archive.org/download/hms-147.22.-nelson/HMS147.22.Nelson.flac
5. c5, 15:00 to 16:15: https://archive.org/download/shirley-adams-2007-oralhistoryinterview/ShirleyAdams-OH-19may2007.mp3
