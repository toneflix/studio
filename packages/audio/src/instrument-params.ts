import { DEFAULT_DRUMS, DEFAULT_SAMPLER, DEFAULT_SYNTH } from './instruments.ts';

/** A setting of a built-in instrument, for building controls for it. */
export type InstrumentParam =
  | {
      kind: 'number';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      /** Best turned in equal ratios, like a frequency */
      log?: boolean;
      /** How the value reads, like "120 ms" */
      format: (value: number) => string;
    }
  | { kind: 'choice'; key: string; label: string; options: { value: string; label: string }[] };

const seconds = (value: number) => (value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`);
const percent = (value: number) => `${Math.round(value * 100)}%`;
const semitones = (value: number) => `${value > 0 ? '+' : ''}${value} st`;

const volume: InstrumentParam = { kind: 'number', key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, format: percent };

/** The settings of the built-in synth, drum kit and sampler, in the order to show them. */
export const INSTRUMENT_PARAMS: Record<'synth' | 'drums' | 'sampler', InstrumentParam[]> = {
  synth: [
    {
      kind: 'choice',
      key: 'wave',
      label: 'Wave',
      options: [
        { value: 'sawtooth', label: 'Saw' },
        { value: 'square', label: 'Square' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'sine', label: 'Sine' },
      ],
    },
    { kind: 'number', key: 'detune', label: 'Detune', min: 0, max: 50, step: 1, format: (v) => `${v} ct` },
    { kind: 'number', key: 'cutoff', label: 'Cutoff', min: 80, max: 12000, step: 10, log: true, format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v} Hz`) },
    { kind: 'number', key: 'resonance', label: 'Resonance', min: 0.1, max: 20, step: 0.1, format: (v) => v.toFixed(1) },
    { kind: 'number', key: 'envelope', label: 'Filter env', min: 0, max: 5, step: 0.1, format: (v) => `${v.toFixed(1)} oct` },
    { kind: 'number', key: 'attack', label: 'Attack', min: 0.001, max: 2, step: 0.001, log: true, format: seconds },
    { kind: 'number', key: 'decay', label: 'Decay', min: 0.01, max: 3, step: 0.01, log: true, format: seconds },
    { kind: 'number', key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01, format: percent },
    { kind: 'number', key: 'release', label: 'Release', min: 0.01, max: 4, step: 0.01, log: true, format: seconds },
    volume,
  ],
  drums: [
    { kind: 'number', key: 'tune', label: 'Tune', min: -12, max: 12, step: 1, format: semitones },
    { kind: 'number', key: 'decay', label: 'Decay', min: 0.25, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
    volume,
  ],
  sampler: [
    { kind: 'number', key: 'attack', label: 'Attack', min: 0.001, max: 2, step: 0.001, log: true, format: seconds },
    { kind: 'number', key: 'release', label: 'Release', min: 0.01, max: 4, step: 0.01, log: true, format: seconds },
    volume,
  ],
};

/** Settings of each built-in instrument before anything is changed. */
export const INSTRUMENT_DEFAULTS = { synth: DEFAULT_SYNTH, drums: DEFAULT_DRUMS, sampler: DEFAULT_SAMPLER } as const;
