/**
 * Two microphones for the room's gates (#475): Chromium plays a WAV as
 * its fake mic (--use-file-for-fake-audio-capture), looped.
 *
 *   speaking.wav  a short pause, then about six and a half seconds of
 *                 voice-like sound (a fundamental with its harmonics,
 *                 four syllables a second with the dips between them),
 *                 then silence long enough for a turn to end
 *   silent.wav    a quiet room: a little noise and nothing else
 *
 * The room measures only a level a frame, so a voice's shape is enough;
 * nothing here is speech and nothing needs to be.
 *
 *   node scripts/room-wavs.mjs <dir>     writes both, prints their paths
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 48_000;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

let seed = 11;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function silence(sec, noise = 0.0015) {
  return Array.from({ length: Math.round(sec * RATE) }, () => (rnd() * 2 - 1) * noise);
}

/* Syllables of a harmonic voice: 180 to 260 ms each, 40 to 90 ms apart. */
function voice(sec) {
  const out = [];
  let phase = 0;
  while (out.length < sec * RATE) {
    const syl = Math.round((0.18 + rnd() * 0.08) * RATE);
    const gap = Math.round((0.04 + rnd() * 0.05) * RATE);
    const f0 = 125 + rnd() * 50;
    for (let i = 0; i < syl; i++) {
      const env = Math.sin((Math.PI * i) / syl);
      let v = 0;
      for (let k = 1; k <= 10; k++) v += Math.sin(phase * k) / k;
      phase += (2 * Math.PI * f0) / RATE;
      out.push(0.3 * env * v * 0.6 + (rnd() * 2 - 1) * 0.0015);
    }
    out.push(...silence(gap / RATE));
  }
  return out;
}

export function writeRoomWavs(dir) {
  mkdirSync(dir, { recursive: true });
  const speaking = join(dir, "room-speaking.wav");
  const silent = join(dir, "room-silent.wav");
  writeFileSync(speaking, wav([...silence(0.6), ...voice(6.5), ...silence(4.5)]));
  writeFileSync(silent, wav(silence(12)));
  return { speaking, silent };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = writeRoomWavs(process.argv[2] ?? "/tmp/room-wavs");
  console.log(out.speaking);
  console.log(out.silent);
}
