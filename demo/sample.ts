import { makeClip, Waveforms, type StudioTimeline } from '../src/index.ts';

const rate = 22050;

/** A few seconds of made-up audio, so demos need no files. */
const synth = (seconds: number, voice: (t: number) => number) => {
  const data = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < data.length; i++) data[i] = voice(i / rate);

  return { sampleRate: rate, numberOfChannels: 1, getChannelData: () => data, duration: seconds };
};

const beat = (t: number) => (t * 2) % 1;

const voices = {
  drums: [16, (t: number) => Math.exp(-beat(t) * 18) * Math.sin(t * 2 * Math.PI * 60 * (1 - beat(t) * 0.5))],
  bass: [16, (t: number) => 0.6 * Math.sin(t * 2 * Math.PI * 55) * (0.6 + 0.4 * Math.sin(t * Math.PI))],
  keys: [12, (t: number) => 0.4 * Math.sin(t * 2 * Math.PI * 330) * Math.max(0, Math.sin(t * Math.PI * 0.5))],
  vocal: [10, (t: number) => 0.7 * Math.sin(t * 2 * Math.PI * 220) * Math.abs(Math.sin(t * 3)) * Math.exp(-((t % 2.5) * 0.6))],
} as const;

/** Load four made-up stems into a timeline and draw their waveforms. */
export const loadSample = (timeline: StudioTimeline, waveforms = new Waveforms()) => {
  const sources = Object.entries(voices).map(([id, [seconds, voice]]) => ({ id, audio: synth(seconds, voice) }));

  timeline.load({
    tracks: sources.map(({ id }) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })),
    clips: sources.map(({ id, audio }, i) =>
      makeClip({ track: id, source: id, name: id[0]!.toUpperCase() + id.slice(1), start: i * 2, offset: 0, duration: audio.duration, fadeIn: i === 3 ? 1 : 0 }),
    ),
  });

  for (const { id, audio } of sources) {
    timeline.setSource({ id, duration: audio.duration });
    waveforms.get(`sample:${id}`, () => audio).then((peaks) => timeline.setSource({ id }, peaks));
  }

  return waveforms;
};
