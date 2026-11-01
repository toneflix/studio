import { Emitter } from '@toneflix/studio-core';

/** An effect in a channel's chain: one node, or a chain with its own ends. */
export type Effect = AudioNode | { input: AudioNode; output: AudioNode };

export interface ChannelSettings {
  /** Linear gain, 1 is unchanged */
  volume: number;
  /** -1 is left, 1 is right */
  pan: number;
  mute: boolean;
  solo: boolean;
}

export const DEFAULT_CHANNEL: ChannelSettings = { volume: 1, pan: 0, mute: false, solo: false };

export const dbToGain = (db: number) => (db <= -96 ? 0 : 10 ** (db / 20));

export const gainToDb = (gain: number) => (gain <= 0 ? -Infinity : 20 * Math.log10(gain));

const ends = (effect: Effect) => ('input' in effect && 'output' in effect ? effect : { input: effect, output: effect });

/** Glide a parameter to a value so changes don't click. */
const glide = (param: AudioParam, value: number, context: BaseAudioContext) => {
  if (context.currentTime > 0) param.setTargetAtTime(value, context.currentTime, 0.015);
  else param.value = value;
};

/** A strip on the mixer: input, effects, volume, pan, then mute and solo. */
export class Channel {
  readonly context: BaseAudioContext;
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly volumeNode: GainNode;
  private readonly panner: StereoPannerNode;
  private chain: Effect[] = [];
  private current: ChannelSettings = { ...DEFAULT_CHANNEL };
  private silenced = false;

  constructor(context: BaseAudioContext) {
    this.context = context;
    this.input = context.createGain();
    this.volumeNode = context.createGain();
    this.panner = context.createStereoPanner();
    this.output = context.createGain();
    this.volumeNode.connect(this.panner);
    this.panner.connect(this.output);
    this.wire();
  }

  get settings(): ChannelSettings {
    return { ...this.current };
  }

  get effects() {
    return [...this.chain];
  }

  set(settings: Partial<ChannelSettings>) {
    this.current = { ...this.current, ...settings };
    glide(this.volumeNode.gain, Math.max(0, this.current.volume), this.context);
    glide(this.panner.pan, Math.min(1, Math.max(-1, this.current.pan)), this.context);
    this.applyAudible();
  }

  /** Replace the effects chain, first effect first. The nodes must belong to this channel's context. */
  setEffects(effects: Effect[]) {
    this.unwire();
    this.chain = [...effects];
    this.wire();
  }

  /** Silenced by another channel's solo. */
  setSilenced(silenced: boolean) {
    this.silenced = silenced;
    this.applyAudible();
  }

  destroy() {
    this.unwire();
    this.input.disconnect();
    this.volumeNode.disconnect();
    this.panner.disconnect();
    this.output.disconnect();
  }

  private applyAudible() {
    glide(this.output.gain, this.current.mute || this.silenced ? 0 : 1, this.context);
  }

  private wire() {
    let tail: AudioNode = this.input;

    for (const effect of this.chain) {
      const { input, output } = ends(effect);

      tail.connect(input);
      tail = output;
    }

    tail.connect(this.volumeNode);
  }

  private unwire() {
    this.input.disconnect();
    for (const effect of this.chain) ends(effect).output.disconnect();
  }
}

export interface MixerEvents extends Record<string, unknown> {
  /** A channel's settings changed; `track` is null for the master */
  change: { track: string | null; settings: ChannelSettings };
}

/** One channel per track, summed into a master channel. */
export class Mixer extends Emitter<MixerEvents> {
  readonly context: BaseAudioContext;
  readonly master: Channel;
  private readonly channels = new Map<string, Channel>();

  constructor(context: BaseAudioContext, destination: AudioNode = context.destination) {
    super();
    this.context = context;
    this.master = new Channel(context);
    this.master.output.connect(destination);
  }

  /** The channel of a track, made on first use. */
  channel(track: string) {
    let channel = this.channels.get(track);

    if (!channel) {
      channel = new Channel(this.context);
      channel.output.connect(this.master.input);
      this.channels.set(track, channel);
      this.applySolo();
    }

    return channel;
  }

  /** Change a track's settings, or the master's with `null`. */
  set(track: string | null, settings: Partial<ChannelSettings>) {
    const channel = track === null ? this.master : this.channel(track);

    channel.set(settings);
    if ('solo' in settings) this.applySolo();
    this.emit('change', { track, settings: channel.settings });
  }

  /** Drop the channels of tracks that are gone. */
  sync(tracks: readonly { id: string }[]) {
    const ids = new Set(tracks.map((track) => track.id));

    for (const [id, channel] of this.channels) {
      if (ids.has(id)) continue;

      channel.destroy();
      this.channels.delete(id);
    }

    this.applySolo();
  }

  /** Every channel's settings, to save with a project. */
  snapshot() {
    const tracks: Record<string, ChannelSettings> = {};

    for (const [id, channel] of this.channels) tracks[id] = channel.settings;

    return { master: this.master.settings, tracks };
  }

  /** Bring back settings from `snapshot()`. */
  restore(snapshot: { master?: Partial<ChannelSettings>; tracks?: Record<string, Partial<ChannelSettings>> }) {
    if (snapshot.master) this.master.set(snapshot.master);
    for (const [id, settings] of Object.entries(snapshot.tracks ?? {})) this.channel(id).set(settings);

    this.applySolo();
  }

  destroy() {
    for (const channel of this.channels.values()) channel.destroy();

    this.channels.clear();
    this.master.destroy();
    this.removeAllListeners();
  }

  private applySolo() {
    const soloing = [...this.channels.values()].some((channel) => channel.settings.solo);

    for (const channel of this.channels.values()) channel.setSilenced(soloing && !channel.settings.solo);
  }
}
