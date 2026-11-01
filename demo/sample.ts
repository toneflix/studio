import { makeClip, Waveforms, type AudioEngine, type StudioTimeline } from '@toneflix/studio';

const rate = 22050;

/** A few seconds of made-up audio, so demos need no files. */
const synth = (seconds: number, voice: (t: number) => number) => {
  const data = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < data.length; i++) data[i] = voice(i / rate);

  return { sampleRate: rate, numberOfChannels: 1, getChannelData: () => data, duration: seconds };
};

const TAU = 2 * Math.PI;
/** Am, F, C, G: one chord per bar at 120 BPM, as root frequencies */
const roots = [55, 43.65, 65.41, 49];
const chord = (t: number) => roots[Math.floor(t / 2) % roots.length]!;
const thirds = [1.189, 1.26, 1.26, 1.26];
const third = (t: number) => thirds[Math.floor(t / 2) % thirds.length]!;
const noise = (t: number) => (Math.sin(t * 91234.567) * 43758.5453) % 1;
const melody = [4, 3, 2, 3, 4, 4, 4, 0, 3, 3, 3, 0, 4, 5, 5, 0];
const scale = [220, 246.94, 261.63, 293.66, 329.63, 392];

const voices = {
  drums: [16, (t: number) => {
    const b = t % 0.5;
    const kick = Math.exp(-b * 22) * Math.sin(TAU * 50 * t * (1 + Math.exp(-b * 40)));
    const h = (t + 0.25) % 0.5;

    return 0.9 * kick + 0.12 * noise(t) * Math.exp(-h * 60);
  }],
  bass: [16, (t: number) => 0.5 * Math.sin(TAU * chord(t) * t) * Math.exp(-(t % 0.25) * 6)],
  keys: [12, (t: number) => {
    const r = chord(t) * 4;
    const swell = Math.sin(Math.PI * ((t % 2) / 2));

    return 0.12 * swell * (Math.sin(TAU * r * t) + Math.sin(TAU * r * third(t) * t) + Math.sin(TAU * r * 1.498 * t));
  }],
  vocal: [10, (t: number) => {
    const step = melody[Math.floor(t * 2) % melody.length]!;
    const note = (t * 2) % 1;

    return step ? 0.35 * Math.sin(TAU * scale[step]! * t + 0.4 * Math.sin(TAU * 5.5 * t)) * Math.min(1, note * 20) * Math.exp(-note * 1.5) : 0;
  }],
} as const;

export interface SampleOptions {
  waveforms?: Waveforms;
  /** Gets the stems' audio, so the sample can be played */
  engine?: AudioEngine;
}

/** Load four made-up stems into a timeline, draw their waveforms and hand their audio to an engine. */
export const loadSample = (timeline: StudioTimeline, { waveforms = new Waveforms(), engine }: SampleOptions = {}) => {
  const sources = Object.entries(voices).map(([id, [seconds, voice]]) => ({ id, audio: synth(seconds, voice) }));

  timeline.load({
    tracks: sources.map(({ id }) => ({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      // The keys swell in over two bars and dip at the end
      ...(id === 'keys' && {
        automation: {
          volume: [
            { time: 4, value: 0.15 },
            { time: 8, value: 1 },
            { time: 12, value: 1 },
            { time: 15, value: 0.4 },
          ],
        },
      }),
    })),
    markers: [
      { id: 'intro', time: 0, name: 'Intro' },
      { id: 'verse', time: 6, name: 'Verse' },
      { id: 'outro', time: 14, name: 'Outro' },
    ],
    clips: sources.map(({ id, audio }, i) =>
      makeClip({ id: `${id}-1`, track: id, source: id, name: id[0]!.toUpperCase() + id.slice(1), start: i * 2, offset: 0, duration: audio.duration, fadeIn: i === 3 ? 1 : 0 }),
    ),
  });

  for (const { id, audio } of sources) {
    timeline.setSource({ id, duration: audio.duration });
    waveforms.get(`sample:${id}`, () => audio).then((peaks) => timeline.setSource({ id }, peaks));

    if (engine) {
      const buffer = new AudioBuffer({ length: audio.getChannelData().length, sampleRate: audio.sampleRate, numberOfChannels: 1 });

      buffer.copyToChannel(audio.getChannelData(), 0);
      engine.setBuffer(id, buffer);
    }
  }

  engine?.load(timeline.state);

  return waveforms;
};
