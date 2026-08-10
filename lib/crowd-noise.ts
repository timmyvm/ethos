/**
 * The "crowd noise" stress mod, synthesised — no audio asset to ship,
 * no CDN request, works offline.
 *
 * Brown noise through a low bandpass reads as room rumble; a second,
 * slower-modulated band around the vocal range reads as babble; sparse
 * high pings read as cutlery. It's a café bed, not a recording of one,
 * which is the honest version: we're adding a distraction, not
 * pretending you're somewhere.
 *
 * Headphones matter — through speakers this bleeds into the mic and
 * corrupts the transcript the rep is scored on. The UI says so.
 */

export interface CrowdNoise {
  stop: () => void;
}

function brownNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

export function startCrowdNoise(ctx: AudioContext, volume = 0.22): CrowdNoise {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  // Fade in — a hard start sounds like a bug, not a room.
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);

  const buffer = brownNoiseBuffer(ctx);
  const sources: AudioBufferSourceNode[] = [];

  // Layer 1 — room rumble.
  const rumble = ctx.createBufferSource();
  rumble.buffer = buffer;
  rumble.loop = true;
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 320;
  rumble.connect(rumbleFilter).connect(master);
  rumble.start();
  sources.push(rumble);

  // Layer 2 — babble: the vocal band, gain wandering so it never sits
  // still enough to tune out.
  const babble = ctx.createBufferSource();
  babble.buffer = buffer;
  babble.loop = true;
  babble.playbackRate.value = 1.4;
  const babbleFilter = ctx.createBiquadFilter();
  babbleFilter.type = "bandpass";
  babbleFilter.frequency.value = 900;
  babbleFilter.Q.value = 0.8;
  const babbleGain = ctx.createGain();
  babbleGain.gain.value = 0.5;
  babble.connect(babbleFilter).connect(babbleGain).connect(master);
  babble.start();
  sources.push(babble);

  const wander = setInterval(() => {
    const t = ctx.currentTime;
    babbleGain.gain.linearRampToValueAtTime(0.3 + Math.random() * 0.5, t + 1.5);
    babbleFilter.frequency.linearRampToValueAtTime(
      700 + Math.random() * 500,
      t + 1.5
    );
  }, 1500);

  // Layer 3 — cutlery. Sparse, quiet, never rhythmic.
  const clink = setInterval(() => {
    if (Math.random() > 0.45) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 1800 + Math.random() * 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.16);
  }, 2600);

  return {
    stop() {
      clearInterval(wander);
      clearInterval(clink);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      } catch {}
      setTimeout(() => {
        for (const s of sources) {
          try {
            s.stop();
          } catch {}
        }
        try {
          master.disconnect();
        } catch {}
      }, 300);
    },
  };
}
