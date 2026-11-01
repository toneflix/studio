import type { InstrumentChoice, Track } from '@toneflix/studio-core';

/** Something that turns notes into sound, like the built-in synth or a WAM instrument. */
export interface Instrument {
  /** Where its sound comes out; the engine connects it to the track's channel */
  readonly output: AudioNode;
  /** Play a note at a context time for a length in seconds. Velocity is 0 to 1 */
  play(pitch: number, velocity: number, when: number, duration: number): void;
  /** Start a note now and hold it, for keys played live */
  noteOn(pitch: number, velocity: number): void;
  noteOff(pitch: number): void;
  /** Stop every note from a context time on, including ones scheduled later */
  stopAll(when: number): void;
  /** Its settings, as saved in the track's instrument choice */
  getState?(): unknown;
  setState?(state: unknown): void;
  destroy(): void;
}

/** Makes the instrument a track asks for in a context, or null for one it doesn't know. */
export type InstrumentFactory = (choice: InstrumentChoice, context: BaseAudioContext, track: Track) => Instrument | Promise<Instrument> | null;

/** The note number's frequency, with A4 (69) at 440 Hz. */
export const noteFrequency = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** A sound started by `play` or `noteOn`, and how to end it. */
interface Sound {
  pitch: number;
  /** When it starts */
  from: number;
  /** Fade out from a context time and stop */
  end: (when: number) => void;
  /** When it stops on its own */
  until: number;
}

/** Keeps the sounds an instrument started, so they can be stopped. */
class Sounds {
  private list: Sound[] = [];

  add(sound: Sound) {
    this.list = this.list.filter((s) => s.until > sound.until - 60);
    this.list.push(sound);
  }

  /** Stop sounds of a pitch still playing at `when`: only held ones, unless `all`. */
  release(pitch: number, when: number, all = false) {
    for (const sound of this.list) {
      if (sound.pitch === pitch && sound.from <= when && sound.until > when && (all || sound.until === Infinity)) {
        sound.end(when);
        sound.until = when;
      }
    }
  }

  stopAll(when: number) {
    for (const sound of this.list) if (sound.until > when) sound.end(Math.max(when, sound.from));
    this.list = [];
  }
}

export interface SynthState {
  wave: OscillatorType;
  /** Second oscillator's detune in cents; 0 leaves it out */
  detune: number;
  attack: number;
  decay: number;
  /** 0 to 1 */
  sustain: number;
  release: number;
  /** Filter cutoff in Hz */
  cutoff: number;
  resonance: number;
  /** How far the envelope opens the filter, in octaves */
  envelope: number;
  /** 0 to 1 */
  volume: number;
}

export const DEFAULT_SYNTH: SynthState = {
  wave: 'sawtooth',
  detune: 8,
  attack: 0.005,
  decay: 0.3,
  sustain: 0.6,
  release: 0.25,
  cutoff: 1800,
  resonance: 2,
  envelope: 2,
  volume: 0.5,
};

/** A polyphonic subtractive synth: two oscillators, a low-pass filter and an envelope per note. */
export class Synth implements Instrument {
  readonly output: GainNode;
  private state: SynthState;
  private readonly sounds = new Sounds();

  private readonly context: BaseAudioContext;

  constructor(context: BaseAudioContext, state: Partial<SynthState> = {}) {
    this.context = context;
    this.state = { ...DEFAULT_SYNTH, ...state };
    this.output = new GainNode(context, { gain: this.state.volume });
  }

  play(pitch: number, velocity: number, when: number, duration: number) {
    this.voice(pitch, velocity, when, when + Math.max(0.01, duration));
  }

  noteOn(pitch: number, velocity: number) {
    this.voice(pitch, velocity, this.context.currentTime, Infinity);
  }

  noteOff(pitch: number) {
    this.sounds.release(pitch, this.context.currentTime);
  }

  stopAll(when: number) {
    this.sounds.stopAll(when);
  }

  getState() {
    return { ...this.state };
  }

  setState(state: unknown) {
    this.state = { ...this.state, ...(state as Partial<SynthState>) };
    this.output.gain.setTargetAtTime(this.state.volume, this.context.currentTime, 0.02);
  }

  destroy() {
    this.stopAll(this.context.currentTime);
    this.output.disconnect();
  }

  /** One note from `when`, released at `off` (Infinity holds it). */
  private voice(pitch: number, velocity: number, when: number, off: number) {
    const s = this.state;
    const context = this.context;
    const frequency = noteFrequency(pitch);
    const oscillators = [new OscillatorNode(context, { type: s.wave, frequency })];
    const filter = new BiquadFilterNode(context, { type: 'lowpass', Q: s.resonance });
    const amp = new GainNode(context, { gain: 0 });
    const peak = Math.max(0.0001, velocity) * 0.5;
    const top = Math.min(18000, s.cutoff * 2 ** s.envelope);

    if (s.detune) oscillators.push(new OscillatorNode(context, { type: s.wave, frequency, detune: s.detune }));

    for (const oscillator of oscillators) oscillator.connect(filter);
    filter.connect(amp).connect(this.output);

    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(peak / oscillators.length, when + s.attack);
    amp.gain.setTargetAtTime((peak * s.sustain) / oscillators.length, when + s.attack, s.decay / 3);
    filter.frequency.setValueAtTime(s.cutoff, when);
    filter.frequency.linearRampToValueAtTime(top, when + s.attack);
    filter.frequency.setTargetAtTime(s.cutoff + (top - s.cutoff) * s.sustain, when + s.attack, s.decay / 3);

    for (const oscillator of oscillators) oscillator.start(when);

    let stopped = false;
    const end = (at: number) => {
      if (stopped) return;
      stopped = true;

      const from = Math.max(at, when);

      amp.gain.cancelScheduledValues(from);
      amp.gain.setTargetAtTime(0, from, Math.max(0.005, s.release / 4));
      for (const oscillator of oscillators) oscillator.stop(from + s.release + 0.05);
    };

    oscillators[0]!.onended = () => {
      for (const oscillator of oscillators) oscillator.disconnect();
      filter.disconnect();
      amp.disconnect();
    };

    if (off !== Infinity) end(off);
    this.sounds.add({ pitch, from: when, end, until: off === Infinity ? Infinity : off + s.release });
  }
}

/** General MIDI drum notes the kit plays. */
export const DRUM_NOTES = {
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  closedHat: 42,
  lowTom: 45,
  pedalHat: 44,
  openHat: 46,
  midTom: 47,
  crash: 49,
  highTom: 50,
  ride: 51,
  cowbell: 56,
} as const;

/** Names for the kit's notes, by note number. */
export const DRUM_NAMES: Record<number, string> = {
  36: 'Kick',
  37: 'Rim',
  38: 'Snare',
  39: 'Clap',
  42: 'Closed hat',
  44: 'Pedal hat',
  45: 'Low tom',
  46: 'Open hat',
  47: 'Mid tom',
  49: 'Crash',
  50: 'High tom',
  51: 'Ride',
  56: 'Cowbell',
};

const noise = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, made once per context. */
const noiseOf = (context: BaseAudioContext) => {
  let buffer = noise.get(context);

  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);

    const data = buffer.getChannelData(0);
    let seed = 7;

    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2 ** 31 - 1;
    }

    noise.set(context, buffer);
  }

  return buffer;
};

export interface DrumKitState {
  /** 0 to 1 */
  volume: number;
  /** Semitones up or down for every drum */
  tune: number;
  /** Longer or shorter decays, 1 is as made */
  decay: number;
}

export const DEFAULT_DRUMS: DrumKitState = { volume: 0.7, tune: 0, decay: 1 };

/** A drum machine made of oscillators and noise, on General MIDI drum notes. */
export class DrumKit implements Instrument {
  readonly output: GainNode;
  private state: DrumKitState;
  private readonly sounds = new Sounds();

  private readonly context: BaseAudioContext;

  constructor(context: BaseAudioContext, state: Partial<DrumKitState> = {}) {
    this.context = context;
    this.state = { ...DEFAULT_DRUMS, ...state };
    this.output = new GainNode(context, { gain: this.state.volume });
  }

  play(pitch: number, velocity: number, when: number) {
    this.hit(pitch, velocity, when);
  }

  noteOn(pitch: number, velocity: number) {
    this.hit(pitch, velocity, this.context.currentTime);
  }

  noteOff() {}

  stopAll(when: number) {
    this.sounds.stopAll(when);
  }

  getState() {
    return { ...this.state };
  }

  setState(state: unknown) {
    this.state = { ...this.state, ...(state as Partial<DrumKitState>) };
    this.output.gain.setTargetAtTime(this.state.volume, this.context.currentTime, 0.02);
  }

  destroy() {
    this.stopAll(this.context.currentTime);
    this.output.disconnect();
  }

  private hit(pitch: number, velocity: number, when: number) {
    const level = Math.max(0.0001, velocity);
    const tune = 2 ** (this.state.tune / 12);
    const decay = this.state.decay;
    const n = DRUM_NOTES;

    // A closed or pedal hat chokes an open one
    if (pitch === n.closedHat || pitch === n.pedalHat) this.sounds.release(n.openHat, when, true);

    switch (pitch) {
      case 35:
      case n.kick:
        return this.tone(pitch, when, level, { from: 150 * tune, to: 45 * tune, sweep: 0.06, decay: 0.45 * decay, wave: 'sine' });
      case n.rim:
        return this.noise(pitch, when, level * 0.6, { type: 'bandpass', frequency: 1800 * tune, q: 4, decay: 0.03 * decay });
      case 40:
      case n.snare:
        this.tone(pitch, when, level * 0.6, { from: 240 * tune, to: 180 * tune, sweep: 0.05, decay: 0.12 * decay, wave: 'triangle' });
        return this.noise(pitch, when, level * 0.7, { type: 'highpass', frequency: 1500, q: 0.7, decay: 0.18 * decay });
      case n.clap:
        for (const lag of [0, 0.012, 0.024]) this.noise(pitch, when + lag, level * 0.6, { type: 'bandpass', frequency: 1200, q: 1.5, decay: lag === 0.024 ? 0.15 * decay : 0.01 });
        return;
      case n.closedHat:
      case n.pedalHat:
        return this.noise(pitch, when, level * 0.45, { type: 'highpass', frequency: 7500, q: 0.8, decay: (pitch === n.pedalHat ? 0.07 : 0.05) * decay });
      case n.openHat:
        return this.noise(pitch, when, level * 0.4, { type: 'highpass', frequency: 7000, q: 0.8, decay: 0.4 * decay });
      case 41:
      case n.lowTom:
        return this.tone(pitch, when, level * 0.8, { from: 140 * tune, to: 90 * tune, sweep: 0.12, decay: 0.35 * decay, wave: 'sine' });
      case 48:
      case n.midTom:
        return this.tone(pitch, when, level * 0.8, { from: 200 * tune, to: 130 * tune, sweep: 0.12, decay: 0.3 * decay, wave: 'sine' });
      case 43:
      case n.highTom:
        return this.tone(pitch, when, level * 0.8, { from: 280 * tune, to: 190 * tune, sweep: 0.1, decay: 0.25 * decay, wave: 'sine' });
      case 57:
      case n.crash:
        return this.noise(pitch, when, level * 0.4, { type: 'highpass', frequency: 4000, q: 0.5, decay: 1.4 * decay });
      case 59:
      case n.ride:
        this.tone(pitch, when, level * 0.15, { from: 3200 * tune, to: 3200 * tune, sweep: 0.01, decay: 0.9 * decay, wave: 'square' });
        return this.noise(pitch, when, level * 0.2, { type: 'highpass', frequency: 9000, q: 0.5, decay: 0.8 * decay });
      case n.cowbell:
        this.tone(pitch, when, level * 0.25, { from: 800 * tune, to: 800 * tune, sweep: 0.01, decay: 0.25 * decay, wave: 'square' });
        return this.tone(pitch, when, level * 0.25, { from: 540 * tune, to: 540 * tune, sweep: 0.01, decay: 0.25 * decay, wave: 'square' });
      default:
        // Any other note: a short tuned blip, so nothing is silent
        return this.tone(pitch, when, level * 0.4, { from: noteFrequency(pitch), to: noteFrequency(pitch), sweep: 0.01, decay: 0.15 * decay, wave: 'triangle' });
    }
  }

  /** A pitched hit that sweeps from one frequency to another. */
  private tone(pitch: number, when: number, level: number, o: { from: number; to: number; sweep: number; decay: number; wave: OscillatorType }) {
    const oscillator = new OscillatorNode(this.context, { type: o.wave, frequency: o.from });
    const amp = new GainNode(this.context, { gain: 0 });

    oscillator.frequency.setValueAtTime(o.from, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), when + o.sweep);
    this.envelope(amp, when, level, o.decay);
    oscillator.connect(amp).connect(this.output);
    oscillator.start(when);
    oscillator.stop(when + o.decay * 4 + 0.05);
    oscillator.onended = () => amp.disconnect();
    this.track(pitch, amp, oscillator, when, when + o.decay * 4);
  }

  /** A filtered noise hit. */
  private noise(pitch: number, when: number, level: number, o: { type: BiquadFilterType; frequency: number; q: number; decay: number }) {
    const source = new AudioBufferSourceNode(this.context, { buffer: noiseOf(this.context), loop: true });
    const filter = new BiquadFilterNode(this.context, { type: o.type, frequency: o.frequency, Q: o.q });
    const amp = new GainNode(this.context, { gain: 0 });

    this.envelope(amp, when, level, o.decay);
    source.connect(filter).connect(amp).connect(this.output);
    source.start(when, Math.random());
    source.stop(when + o.decay * 4 + 0.05);
    source.onended = () => {
      filter.disconnect();
      amp.disconnect();
    };
    this.track(pitch, amp, source, when, when + o.decay * 4);
  }

  private envelope(amp: GainNode, when: number, level: number, decay: number) {
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(level, when + 0.002);
    amp.gain.setTargetAtTime(0, when + 0.002, decay / 3);
  }

  /** Keep a hit so it can be stopped or choked. */
  private track(pitch: number, amp: GainNode, source: AudioScheduledSourceNode, from: number, until: number) {
    let stopped = false;
    const end = (at: number) => {
      if (stopped) return;
      stopped = true;
      amp.gain.cancelScheduledValues(at);
      amp.gain.setTargetAtTime(0, at, 0.008);
      try {
        source.stop(at + 0.05);
      } catch {
        // Already stopping sooner
      }
    };

    this.sounds.add({ pitch, from, end, until });
  }
}

/** The built-in instruments: `synth` and `drums`. */
export const builtInInstruments: InstrumentFactory = (choice, context) => {
  if (choice.id === 'synth') return new Synth(context, (choice.state ?? {}) as Partial<SynthState>);
  if (choice.id === 'drums') return new DrumKit(context, (choice.state ?? {}) as Partial<DrumKitState>);

  return null;
};
