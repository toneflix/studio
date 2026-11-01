import type { AudioEngine } from '@toneflix/studio-audio';
import { Emitter, uid } from '@toneflix/studio-core';
import { CAPTURE_PROCESSOR, loadCapture } from './capture.ts';
import { TakeBuilder } from './take.ts';

export interface RecorderOptions {
  /** 1 for mono (the default, like most microphones) or 2 for stereo */
  channels?: number;
  /**
   * Seconds between a sound being played and its recording reaching the recorder.
   * Worked out from the browser's latency figures when left out.
   */
  latency?: number;
  /** Extra constraints for `getUserMedia`; echo cancellation, noise suppression and auto gain are off by default */
  constraints?: MediaTrackConstraints;
  /** Frames per chunk sent from the audio thread */
  chunkSize?: number;
}

export interface StartRecordingOptions {
  /** Track to record onto; the armed track by default */
  track?: string;
  /** Timeline time to start at when not already playing; the play position by default */
  from?: number;
}

/** A finished recording. Its audio is already handed to the engine under `id`. */
export interface Take {
  /** Source id of the recorded audio */
  id: string;
  track: string;
  /** Where it starts on the timeline */
  start: number;
  duration: number;
  buffer: AudioBuffer;
}

export interface RecorderEvents extends Record<string, unknown> {
  /** The armed track changed */
  arm: { track: string | null };
  /** Recording began; the take's start comes with the first `data` */
  start: { id: string; track: string };
  /** New audio arrived: `channels` holds only the new samples */
  data: { id: string; track: string; start: number; duration: number; channels: Float32Array[]; sampleRate: number };
  /** Recording finished; `take` is null when nothing was recorded */
  stop: { take: Take | null };
  /** Opening the input or recording failed */
  error: { error: unknown };
}

interface Session {
  id: string;
  track: string;
  builder: TakeBuilder;
  node: AudioWorkletNode;
  sink: GainNode;
  loop: AudioEngine['loop'];
  stopAtEnd: boolean;
  done?: () => void;
}

/**
 * Records an input onto a track while the engine plays, so new parts line up
 * with what was heard. Recording starts playback when it is stopped, and ends
 * when playback pauses, stops or seeks.
 */
export class Recorder extends Emitter<RecorderEvents> {
  readonly engine: AudioEngine;
  private readonly options: RecorderOptions;
  private stream: MediaStream | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private monitorGain: GainNode | null = null;
  private armedTrack: string | null = null;
  private monitoring = false;
  private session: Session | null = null;
  private samples = new Float32Array(1024);
  private unlisten: (() => void)[];

  constructor(engine: AudioEngine, options: RecorderOptions = {}) {
    super();
    this.engine = engine;
    this.options = options;

    const end = () => void this.stop();

    this.unlisten = [engine.on('pause', end), engine.on('seek', end)];
  }

  /** The audio inputs the browser can see. Their names show only once the user has allowed one. */
  static async inputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices.filter((device) => device.kind === 'audioinput');
  }

  get armed() {
    return this.armedTrack;
  }

  get isOpen() {
    return !!this.input;
  }

  get isRecording() {
    return !!this.session;
  }

  /** Whether the input is heard through the armed track */
  get monitor() {
    return this.monitoring;
  }

  /** The latency used to line takes up, in seconds. */
  get latency() {
    if (this.options.latency !== undefined) return this.options.latency;

    const context = this.engine.context as AudioContext;
    const input = this.stream?.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;

    return (context.baseLatency ?? 0) + (context.outputLatency ?? 0) + (input?.latency ?? 0);
  }

  /** Set the latency by hand, for example after a loopback test; null works it out again. */
  setLatency(seconds: number | null) {
    this.options.latency = seconds ?? undefined;
  }

  /** Pick the track that records; null disarms. */
  arm(track: string | null) {
    if (track === this.armedTrack) return;

    this.armedTrack = track;
    this.routeMonitor();
    this.emit('arm', { track });
  }

  /** Ask for an input, the default one unless a device id is given. */
  async open(deviceId?: string) {
    this.close();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: this.options.channels ?? 1,
          ...this.options.constraints,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      const context = this.engine.context as AudioContext;

      this.stream = stream;
      this.input = context.createMediaStreamSource(stream);
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = this.samples.length;
      this.input.connect(this.analyser);
      this.routeMonitor();
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }
  }

  /** Let go of the input, ending any recording. */
  close() {
    if (this.session) void this.stop();

    this.input?.disconnect();
    this.monitorGain?.disconnect();
    for (const track of this.stream?.getTracks() ?? []) track.stop();

    this.stream = null;
    this.input = null;
    this.analyser = null;
    this.monitorGain = null;
  }

  /** Hear the input through the armed track's channel, effects included. */
  setMonitor(on: boolean) {
    this.monitoring = on;
    this.routeMonitor();
  }

  /** The input's peak level since the last call, 0 to 1. */
  level() {
    if (!this.analyser) return 0;

    this.analyser.getFloatTimeDomainData(this.samples);

    let peak = 0;

    for (const sample of this.samples) peak = Math.max(peak, Math.abs(sample));

    return Math.min(1, peak);
  }

  /** Start recording onto a track, opening the input first if needed. */
  async start(options: StartRecordingOptions = {}) {
    const track = options.track ?? this.armedTrack;

    if (this.session) return;
    if (!track) throw new Error('Arm a track or pass one to record onto');

    if (!this.input) await this.open();

    try {
      await loadCapture(this.engine.context);
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }

    const engine = this.engine;
    const context = engine.context;
    const channels = this.options.channels ?? 1;
    const node = new AudioWorkletNode(context, CAPTURE_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: channels,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: { size: this.options.chunkSize ?? 4096 },
    });
    const sink = context.createGain();
    const from = engine.isPlaying ? engine.time : Math.max(0, options.from ?? engine.time);
    const session: Session = {
      id: uid('rec'),
      track,
      builder: new TakeBuilder(context.sampleRate, channels, from),
      node,
      sink,
      loop: engine.loop,
      stopAtEnd: engine.stopAtEnd,
    };

    // A take runs straight on, so playback neither loops nor stops at the last clip
    this.session = session;
    engine.stopAtEnd = false;
    if (session.loop) engine.setLoop(null);
    if (!engine.isPlaying) await engine.play(from);

    sink.gain.value = 0;
    node.port.onmessage = ({ data }) => this.receive(session, data);
    this.input!.connect(node);
    node.connect(sink).connect(context.destination);
    this.emit('start', { id: session.id, track });
  }

  /** Finish recording and hand the take to the engine. Playback keeps going. */
  async stop(): Promise<Take | null> {
    const session = this.session;
    if (!session) return null;

    this.session = null;
    await new Promise<void>((resolve) => {
      session.done = resolve;
      session.node.port.postMessage('flush');
      setTimeout(resolve, 500);
    });

    this.input?.disconnect(session.node);
    session.node.disconnect();
    session.sink.disconnect();
    session.node.port.onmessage = null;
    this.engine.stopAtEnd = session.stopAtEnd;
    if (session.loop) this.engine.setLoop(session.loop);

    const { builder } = session;
    let take: Take | null = null;

    if (builder.start !== null && builder.length > 0) {
      const buffer = new AudioBuffer({ length: builder.length, numberOfChannels: builder.channelCount, sampleRate: builder.sampleRate });

      builder.build().forEach((data, c) => buffer.copyToChannel(data as Float32Array<ArrayBuffer>, c));
      this.engine.setBuffer(session.id, buffer);
      take = { id: session.id, track: session.track, start: builder.start, duration: builder.duration, buffer };
    }

    this.emit('stop', { take });

    return take;
  }

  destroy() {
    this.close();
    for (const off of this.unlisten) off();
    this.removeAllListeners();
  }

  private receive(session: Session, data: { frame?: number; channels?: Float32Array[]; done?: boolean }) {
    if (data.done) return session.done?.();
    if (!data.channels || data.frame === undefined) return;

    const { builder } = session;
    const sampleRate = builder.sampleRate;
    let at = builder.start === null ? null : builder.start + builder.duration;

    at ??= this.engine.positionAt(data.frame / sampleRate - this.latency);
    if (at === null) return;

    const kept = builder.push(at, data.channels);

    if (kept) {
      this.emit('data', { id: session.id, track: session.track, start: builder.start!, duration: builder.duration, channels: kept, sampleRate });
    }
  }

  private routeMonitor() {
    this.monitorGain?.disconnect();
    this.monitorGain = null;
    if (!this.input || !this.monitoring || !this.armedTrack) return;

    this.monitorGain = this.engine.context.createGain();
    this.input.connect(this.monitorGain).connect(this.engine.mixer.channel(this.armedTrack).input);
  }
}
