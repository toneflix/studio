import type { AudioEngine } from '@toneflix/studio-audio';
import { Emitter, NoteTake, type Note } from '@toneflix/studio-core';

export interface NoteRecorderOptions {
  /**
   * Seconds between the engine's clock and what the player hears, taken off each
   * note so it lands where it was played. Worked out from the browser's output latency when left out.
   */
  latency?: number;
}

/** A finished note recording. Note times are on the timeline. */
export interface NoteTakeResult {
  track: string;
  /** Where recording began */
  from: number;
  /** Where it stopped */
  to: number;
  notes: Note[];
}

export interface NoteRecorderEvents extends Record<string, unknown> {
  start: { track: string; from: number };
  /** A note started or ended while recording */
  note: { track: string };
  /** Recording finished; `take` is null when no note was played */
  stop: { take: NoteTakeResult | null };
}

/**
 * Records notes played live (on keys, a computer keyboard or a MIDI device) onto an
 * instrument track while the engine plays. Feed it with `noteOn` and `noteOff`.
 * Recording starts playback when it is stopped, and ends when playback pauses, stops or seeks.
 */
export class NoteRecorder extends Emitter<NoteRecorderEvents> {
  readonly engine: AudioEngine;
  private readonly options: NoteRecorderOptions;
  private session: { track: string; from: number; take: NoteTake; loop: AudioEngine['loop']; stopAtEnd: boolean } | null = null;
  private readonly unlisten: (() => void)[];

  constructor(engine: AudioEngine, options: NoteRecorderOptions = {}) {
    super();
    this.engine = engine;
    this.options = options;

    const end = () => void this.stop();

    this.unlisten = [engine.on('pause', end), engine.on('seek', end)];
  }

  get isRecording() {
    return !!this.session;
  }

  /** The track being recorded onto, while recording. */
  get track() {
    return this.session?.track ?? null;
  }

  /** The latency taken off each note, in seconds. */
  get latency() {
    if (this.options.latency !== undefined) return this.options.latency;

    const context = this.engine.context as AudioContext;

    return (context.baseLatency ?? 0) + (context.outputLatency ?? 0);
  }

  /** The timeline time a note played now belongs at. */
  private now() {
    return Math.max(this.session?.from ?? 0, this.engine.time - this.latency);
  }

  /** Start recording onto an instrument track, from the play position unless already playing. */
  async start(track: string, from = this.engine.time) {
    if (this.session) return;

    const engine = this.engine;
    const at = engine.isPlaying ? engine.time : Math.max(0, from);

    this.session = { track, from: at, take: new NoteTake(), loop: engine.loop, stopAtEnd: engine.stopAtEnd };
    // A take runs straight on, so playback neither loops nor stops at the last clip
    engine.stopAtEnd = false;
    if (engine.loop) engine.setLoop(null);
    if (!engine.isPlaying) await engine.play(at);

    this.emit('start', { track, from: at });
  }

  noteOn(pitch: number, velocity: number) {
    if (!this.session) return;

    this.session.take.down(pitch, velocity, this.now());
    this.emit('note', { track: this.session.track });
  }

  noteOff(pitch: number) {
    if (!this.session) return;

    this.session.take.up(pitch, this.now());
    this.emit('note', { track: this.session.track });
  }

  /** The notes so far, held ones lasting until now. */
  notes() {
    return this.session?.take.notes(this.now()) ?? [];
  }

  /** Finish recording. Playback keeps going. */
  stop(): NoteTakeResult | null {
    const session = this.session;
    if (!session) return null;

    const to = this.now();

    this.session = null;
    this.engine.stopAtEnd = session.stopAtEnd;
    if (session.loop) this.engine.setLoop(session.loop);

    const take = session.take.empty ? null : { track: session.track, from: session.from, to, notes: session.take.finish(to) };

    this.emit('stop', { take });

    return take;
  }

  destroy() {
    this.stop();
    for (const off of this.unlisten) off();
    this.removeAllListeners();
  }
}
