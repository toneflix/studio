import { makeClip, makeNoteClip, Waveforms, type AudioEngine, type Note, type StudioTimeline } from '@toneflix/studio';

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

/** An arpeggio over the chords, in eighth notes, as MIDI notes for the synth. */
const lead = (): Note[] => {
  const chords = [
    [69, 72, 76],
    [65, 69, 72],
    [72, 76, 79],
    [67, 71, 74],
  ];

  return chords.flatMap((chord, bar) =>
    [0, 1, 2, 1, 0, 1, 2, 1].map((step, i) => ({ pitch: chord[step]! + (i >= 4 && step === 2 ? 12 : 0), start: bar * 2 + i * 0.25, duration: 0.22, velocity: i % 2 ? 0.6 : 0.85 })),
  );
};

/** Two bars of kick, snare and hats for the drum kit. */
const beat = (): Note[] =>
  Array.from({ length: 16 }, (_, i): Note[] => {
    const at = i * 0.25;
    const hits: Note[] = [{ pitch: 42, start: at, duration: 0.1, velocity: i % 2 ? 0.5 : 0.8 }];

    if (i % 8 === 0 || i === 11) hits.push({ pitch: 36, start: at, duration: 0.1, velocity: 1 });
    if (i % 8 === 4) hits.push({ pitch: 38, start: at, duration: 0.1, velocity: 0.9 });

    return hits;
  }).flat();

export interface SampleOptions {
  waveforms?: Waveforms;
  /** Gets the stems' audio, so the sample can be played */
  engine?: AudioEngine;
}

/** Load four made-up stems into a timeline, draw their waveforms and hand their audio to an engine. */
export const loadSample = (timeline: StudioTimeline, { waveforms = new Waveforms(), engine }: SampleOptions = {}) => {
  // Stem n starts n bars in, so each voice reads the song's time to stay on its chords
  const sources = Object.entries(voices).map(([id, [seconds, voice]], i) => ({ id, audio: synth(seconds, (t) => voice(t + i * 2)) }));

  timeline.load({
    tracks: [
      ...sources.map(({ id }) => ({
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
      { id: 'lead', name: 'Lead', instrument: { id: 'synth' } },
      { id: 'beat', name: 'Beat', instrument: { id: 'drums' } },
    ],
    markers: [
      { id: 'intro', time: 0, name: 'Intro' },
      { id: 'verse', time: 6, name: 'Verse' },
      { id: 'outro', time: 14, name: 'Outro' },
    ],
    clips: [
      ...sources.map(({ id, audio }, i) =>
        makeClip({ id: `${id}-1`, track: id, source: id, name: id[0]!.toUpperCase() + id.slice(1), start: i * 2, offset: 0, duration: audio.duration, fadeIn: i === 3 ? 1 : 0 }),
      ),
      makeNoteClip({ id: 'lead-1', track: 'lead', name: 'Lead', start: 8, duration: 8, notes: lead() }),
      // One two-bar pattern, played three times: editing any copy edits them all
      ...[4, 8, 12].map((start, i) => ({ ...makeNoteClip({ id: `beat-${i + 1}`, track: 'beat', name: 'Beat', start, duration: 4, notes: beat() }), source: 'notes:beat' })),
    ],
  });

  for (const { id, audio } of sources) {
    timeline.setSource({ id, duration: audio.duration });
    waveforms.get(`sample:${id}:song-time`, () => audio).then((peaks) => timeline.setSource({ id }, peaks));

    if (engine) {
      const buffer = new AudioBuffer({ length: audio.getChannelData().length, sampleRate: audio.sampleRate, numberOfChannels: 1 });

      buffer.copyToChannel(audio.getChannelData(), 0);
      engine.setBuffer(id, buffer);
    }
  }

  engine?.load(timeline.state);

  return waveforms;
};

/** One-shots and loops, made up like the stems, for the browser's Sounds tab. */
const oneShots: [string, string, number, (t: number) => number][] = [
  ['kick', 'Kick', 0.6, (t) => Math.exp(-t * 9) * Math.sin(TAU * 50 * t * (1 + Math.exp(-t * 40)))],
  ['snare', 'Snare', 0.4, (t) => Math.exp(-t * 14) * (0.6 * noise(t) + 0.4 * Math.sin(TAU * 190 * t))],
  ['hat', 'Closed hat', 0.15, (t) => 0.4 * Math.exp(-t * 60) * noise(t * 3.1)],
  ['riser', 'Noise riser', 4, (t) => 0.3 * (t / 4) ** 2 * noise(t)],
  ['pad', 'Warm pad', 8, (t) => 0.1 * Math.min(1, t / 2, (8 - t) / 2) * (Math.sin(TAU * 220 * t) + Math.sin(TAU * 277.18 * t) + Math.sin(TAU * 329.63 * t))],
  ['sub', 'Sub drop', 2, (t) => 0.6 * Math.exp(-t * 1.5) * Math.sin(TAU * (60 - 20 * t) * t)],
];

/** The demo's sound library, decoded on demand into the engine's sample rate. */
export const demoSounds = (engine: AudioEngine) =>
  oneShots.map(([id, name, seconds, voice]) => ({
    id,
    name,
    kind: 'audio' as const,
    detail: seconds < 1 ? 'One-shot' : 'Loop',
    duration: seconds,
    load: async () => {
      const audio = synth(seconds, voice);
      const buffer = engine.context.createBuffer(1, audio.getChannelData().length, rate);

      buffer.copyToChannel(audio.getChannelData(), 0);

      return buffer;
    },
  }));
