import { AUTOMATION_PARAMS, AUTOMATION_RANGES, automationAt, automationOf, automationSteps, Emitter, timelineEnd, type TimelineState } from '@toneflix/studio-core';
import { Metronome } from './metronome.ts';
import { Mixer, type Effect } from './mixer.ts';
import { clicksIn, gainSteps, heardRanges, loops, passesBetween, timelineAt, voicesIn, type Click, type Loop, type Voice } from './schedule.ts';

export interface AudioEngineOptions {
  /** The context to play in; one is made when left out */
  context?: BaseAudioContext;
  /** Seconds of audio scheduled ahead of the play position */
  lookahead?: number;
  /** Milliseconds between scheduling runs */
  interval?: number;
  /** Pause after the last clip ends, unless looping */
  stopAtEnd?: boolean;
}

export interface AudioEngineEvents extends Record<string, unknown> {
  play: { time: number };
  pause: { time: number };
  seek: { time: number };
  loop: { loop: Loop | null };
  /** Playback reached the end of the last clip and paused */
  end: { time: number };
}

export interface RenderOptions {
  /** Timeline start, 0 by default */
  from?: number;
  /** Timeline end, the end of the last clip by default */
  to?: number;
  sampleRate?: number;
  channels?: number;
  /** Effects for the render, made in its context. `track` is null for the master. */
  effects?: (track: string | null, context: BaseAudioContext) => Effect[] | Promise<Effect[]>;
}

interface Playing {
  source: AudioBufferSourceNode;
  edge: GainNode;
}

/** Time between pressing play and the first sound, so the first notes are not cut. */
const START_DELAY = 0.04;
/** Length of the ramps that smooth cuts into audio */
const EDGE = 0.004;

/**
 * Plays a timeline with Web Audio. Clips are scheduled a little ahead of the
 * play position, so edits, seeks and loops take effect right away.
 */
export class AudioEngine extends Emitter<AudioEngineEvents> {
  readonly context: BaseAudioContext;
  readonly mixer: Mixer;
  readonly metronome: Metronome;
  private readonly options: Required<Omit<AudioEngineOptions, 'context'>>;
  private readonly ownContext: boolean;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly voices = new Set<Playing>();
  private current: TimelineState = { tracks: [], clips: [] };
  private loopRange: Loop | null = null;
  private playing = false;
  /** Timeline time that playback began from */
  private origin = 0;
  /** Context time of play time 0 */
  private clockStart = 0;
  /** Play time scheduled up to */
  private scheduledTo = 0;
  /** Timeline time while paused */
  private position = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: AudioEngineOptions = {}) {
    super();
    this.ownContext = !options.context;
    this.context = options.context ?? new AudioContext({ latencyHint: 'interactive' });
    this.options = {
      lookahead: options.lookahead ?? 0.25,
      interval: options.interval ?? 25,
      stopAtEnd: options.stopAtEnd ?? true,
    };
    this.mixer = new Mixer(this.context);
    this.metronome = new Metronome(this.context);
  }

  get state() {
    return this.current;
  }

  get isPlaying() {
    return this.playing;
  }

  /** Pause after the last clip ends, unless looping */
  get stopAtEnd() {
    return this.options.stopAtEnd;
  }

  set stopAtEnd(stop: boolean) {
    this.options.stopAtEnd = stop;
  }

  get loop() {
    return this.loopRange;
  }

  /** The play position on the timeline. */
  get time() {
    if (!this.playing) return this.position;

    return timelineAt(this.origin, this.loopRange, Math.max(0, this.context.currentTime - this.clockStart));
  }

  /**
   * The timeline time that plays at a context time, counted straight on from where
   * playback began, without wrapping at the loop. Null while paused.
   */
  positionAt(contextTime: number) {
    return this.playing ? this.origin + contextTime - this.clockStart : null;
  }

  /** Play this timeline from now on. While playing, what is heard follows the change at once. */
  load(state: TimelineState) {
    this.current = state;
    this.mixer.sync(state.tracks);
    if (this.playing) this.restart();
    else this.holdAutomation(this.position);
  }

  /** The decoded audio of a source. */
  setBuffer(source: string, buffer: AudioBuffer) {
    this.buffers.set(source, buffer);
    if (this.playing && this.current.clips.some((clip) => clip.source === source)) this.restart();
  }

  hasBuffer(source: string) {
    return this.buffers.has(source);
  }

  deleteBuffer(source: string) {
    this.buffers.delete(source);
  }

  /** Start playing, from the current position unless a time is given. */
  async play(from = this.time) {
    const context = this.context as AudioContext;

    if ('close' in context && context.state === 'suspended') await context.resume();
    if (this.playing) this.silence();

    this.start(Math.max(0, from));
    this.emit('play', { time: this.origin });
  }

  pause() {
    if (!this.playing) return;

    this.position = this.time;
    this.playing = false;
    this.silence();
    clearInterval(this.timer);
    this.timer = undefined;
    this.emit('pause', { time: this.position });
  }

  /** Pause and go back to where playback began, or to the start when already stopped. */
  stop() {
    const back = this.playing ? this.origin : 0;

    this.pause();
    this.position = back;
    this.emit('seek', { time: back });
  }

  toggle() {
    if (this.playing) this.pause();
    else void this.play();
  }

  seek(time: number) {
    const to = Math.max(0, time);

    if (this.playing) {
      this.silence();
      this.start(to);
    } else {
      this.position = to;
      this.holdAutomation(to);
    }

    this.emit('seek', { time: to });
  }

  /** Repeat a stretch of the timeline while playing, or stop repeating with null. */
  setLoop(loop: Loop | null) {
    this.loopRange = loop && loop.end - loop.start > 1e-3 ? { start: Math.max(0, loop.start), end: loop.end } : null;
    if (this.playing) this.restart();

    this.emit('loop', { loop: this.loopRange });
  }

  /** Mix the timeline down to an AudioBuffer, faster than real time. */
  async render(options: RenderOptions = {}) {
    const from = Math.max(0, options.from ?? 0);
    const to = options.to ?? timelineEnd(this.current);
    const sampleRate = options.sampleRate ?? this.context.sampleRate;
    const offline = new OfflineAudioContext(options.channels ?? 2, Math.max(1, Math.ceil((to - from) * sampleRate)), sampleRate);
    const engine = new AudioEngine({ context: offline });

    for (const [id, buffer] of this.buffers) engine.buffers.set(id, buffer);

    engine.current = this.current;
    engine.mixer.restore(this.mixer.snapshot());

    if (options.effects) {
      engine.mixer.master.setEffects(await options.effects(null, offline));
      for (const track of this.current.tracks) engine.mixer.channel(track.id).setEffects(await options.effects(track.id, offline));
    }

    engine.origin = from;
    engine.holdAutomation(from);
    engine.scheduleBetween(0, to - from, 0);

    return offline.startRendering();
  }

  destroy() {
    this.pause();
    this.mixer.destroy();
    this.removeAllListeners();
    if (this.ownContext) void (this.context as AudioContext).close();
  }

  private start(from: number) {
    this.origin = from;
    this.clockStart = this.context.currentTime + START_DELAY;
    this.scheduledTo = 0;
    this.playing = true;
    this.pump();
    this.timer ??= setInterval(() => this.pump(), this.options.interval);
  }

  private restart() {
    const time = this.time;

    this.silence();
    this.start(time);
  }

  private pump() {
    if (!this.playing) return;

    const elapsed = Math.max(0, this.context.currentTime - this.clockStart);

    if (this.options.stopAtEnd && !loops(this.origin, this.loopRange)) {
      const end = timelineEnd(this.current);

      if (this.origin < end && this.origin + elapsed >= end) {
        this.pause();
        this.position = end;
        this.emit('end', { time: end });

        return;
      }
    }

    const until = elapsed + this.options.lookahead;

    if (until <= this.scheduledTo) return;

    this.scheduleBetween(this.scheduledTo, until, this.clockStart);
    this.scheduledTo = until;
  }

  private scheduleBetween(from: number, to: number, clockStart: number) {
    const ranges = heardRanges(this.current);
    const clicks: (Click & { when: number })[] = [];
    const now = this.context.currentTime;

    for (const pass of passesBetween(this.origin, this.loopRange, from, to)) {
      for (const voice of voicesIn(ranges, pass)) this.startVoice(voice, clockStart);
      this.scheduleAutomation(pass, clockStart, now);

      for (const click of clicksIn(this.metronome.grid, pass)) {
        const when = clockStart + click.at;

        if (when >= now) clicks.push({ ...click, when });
      }
    }

    this.metronome.play(clicks);
  }

  private startVoice(voice: Voice, clockStart: number) {
    const buffer = this.buffers.get(voice.clip.source);
    if (!buffer) return;

    const { clip } = voice;
    const context = this.context;
    const late = Math.max(0, context.currentTime - (clockStart + voice.at));
    const when = clockStart + voice.at + late;
    const offset = clip.offset + voice.start - clip.start + late;
    const duration = Math.min(voice.end - voice.start - late, buffer.duration - offset);

    if (duration <= EDGE) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    const edge = context.createGain();
    const steps = gainSteps(voice);

    source.buffer = buffer;
    gain.gain.setValueAtTime(steps[0]!.gain, clockStart + voice.at);
    for (const step of steps.slice(1)) gain.gain.linearRampToValueAtTime(step.gain, clockStart + voice.at + step.at);

    // Short ramps where the audio is cut, not at the clip's own edges, so cuts don't click
    const cutIn = voice.start > clip.start + 1e-4 || late > 0;
    const cutOut = voice.end < clip.start + clip.duration - 1e-4;

    edge.gain.setValueAtTime(cutIn ? 0 : 1, when);
    if (cutIn) edge.gain.linearRampToValueAtTime(1, when + EDGE);
    if (cutOut) {
      edge.gain.setValueAtTime(1, when + duration - EDGE);
      edge.gain.linearRampToValueAtTime(0, when + duration);
    }

    source.connect(gain).connect(edge).connect(this.mixer.channel(clip.track).input);
    source.start(when, offset, duration);

    const playing = { source, edge };

    this.voices.add(playing);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      edge.disconnect();
      this.voices.delete(playing);
    };
  }

  /** Ramp each automated setting along its points through a pass's window. */
  private scheduleAutomation(pass: { start: number; from: number; to: number; at: number }, clockStart: number, now: number) {
    for (const track of this.current.tracks) {
      if (!track.automation) continue;

      const channel = this.mixer.channel(track.id);

      for (const param of AUTOMATION_PARAMS) {
        const points = automationOf(track, param);
        if (!points.length) continue;

        const audio = channel.automation[param];
        const neutral = AUTOMATION_RANGES[param].neutral;
        const when = (time: number) => clockStart + pass.at + time - pass.start;
        const steps = automationSteps(points, pass.from, pass.to, neutral);
        const first = steps[0]!;
        const start = Math.max(when(first.time), now);

        audio.setValueAtTime(automationAt(points, pass.from + start - when(first.time), neutral), start);
        for (const step of steps.slice(1)) if (when(step.time) > start) audio.linearRampToValueAtTime(step.value, when(step.time));
      }
    }
  }

  /** Set every channel's automation to its value at a time and keep it there. */
  private holdAutomation(time: number) {
    const now = this.context.currentTime;

    for (const track of this.current.tracks) {
      const channel = this.mixer.channel(track.id);

      for (const param of AUTOMATION_PARAMS) {
        const audio = channel.automation[param];
        const value = automationAt(automationOf(track, param), time, AUTOMATION_RANGES[param].neutral);

        audio.cancelScheduledValues(now);
        audio.setValueAtTime(value, now);
      }
    }
  }

  /** Fade out and stop everything scheduled. */
  private silence() {
    const now = this.context.currentTime;

    this.holdAutomation(this.time);

    for (const { source, edge } of this.voices) {
      edge.gain.cancelScheduledValues(now);
      edge.gain.setValueAtTime(edge.gain.value, now);
      edge.gain.linearRampToValueAtTime(0, now + EDGE);
      source.stop(now + EDGE);
    }

    this.voices.clear();
  }
}
