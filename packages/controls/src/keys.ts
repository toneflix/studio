import { DRUM_NAMES, type AudioEngine } from '@toneflix/studio-audio';
import { Emitter, isBlackKey, MAX_PITCH, noteName, type Track } from '@toneflix/studio-core';
import type { NoteRecorder, Recorder } from '@toneflix/studio-recorder';
import { resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { renderIcon, type IconSet } from './icons.ts';
import { injectControlStyles } from './styles.ts';

export interface KeysLabels {
  title: string;
  /** The track the keys play */
  track: string;
  /** Shown when there is no instrument track to play */
  noTrack: string;
  octaveDown: string;
  octaveUp: string;
  velocity: string;
  /** The button that connects MIDI devices */
  midi: string;
  /** Its title once connected; `{n}` is the number of devices */
  midiOn: string;
  midiNone: string;
  midiDenied: string;
  close: string;
}

export const DEFAULT_KEYS_LABELS: KeysLabels = {
  title: 'Keys',
  track: 'Track',
  noTrack: 'Add an instrument track to play',
  octaveDown: 'Octave down (Z)',
  octaveUp: 'Octave up (X)',
  velocity: 'Velocity',
  midi: 'MIDI',
  midiOn: '{n} MIDI device(s) connected',
  midiNone: 'No MIDI device found; plug one in',
  midiDenied: 'MIDI is not available in this browser',
  close: 'Close',
};

export interface KeysOptions {
  timeline: StudioTimeline;
  /** Plays the notes through the track's instrument */
  engine: AudioEngine;
  /** Its armed track is played when it is an instrument track */
  recorder?: Recorder;
  /** Records the notes played while it records */
  notes?: NoteRecorder;
  icons?: Partial<IconSet>;
  labels?: Partial<KeysLabels>;
  hidden?: boolean;
  /** Sit in the page flow; by default it slides up over the bottom of its container */
  docked?: boolean;
  /** The lowest octave shown, with C4 as middle C; 3 unless given */
  octave?: number;
  /** Play notes from the computer keyboard while the keys are open; true unless false */
  computerKeys?: boolean;
}

export interface KeysEvents extends Record<string, unknown> {
  toggle: { visible: boolean };
  /** A note started (`velocity` above 0) or ended (`velocity` 0) on a track */
  note: { track: string; pitch: number; velocity: number };
  /** MIDI devices connected or changed */
  midi: { inputs: string[] };
}

/** Computer keys by `KeyboardEvent.code`, as semitones from the lowest C shown. */
const COMPUTER_KEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};
const KEY_LETTERS = Object.fromEntries(Object.entries(COMPUTER_KEYS).map(([code, n]) => [n, code === 'Semicolon' ? ';' : code.slice(3)]));
const OCTAVES = 3;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Web MIDI, as far as the keys use it. */
interface MidiAccess {
  inputs: Map<string, { name?: string | null; onmidimessage: ((e: { data: Uint8Array }) => void) | null }>;
  onstatechange: (() => void) | null;
}

/**
 * Keys that play an instrument track live: on screen with a mouse or touch, from the
 * computer keyboard, or from MIDI devices. While a note recorder records, what is
 * played is recorded onto its track.
 */
export class StudioKeys extends Emitter<KeysEvents> {
  readonly root: HTMLDivElement;
  private readonly timeline: StudioTimeline;
  private readonly engine: AudioEngine;
  private readonly recorder?: Recorder;
  private readonly notes?: NoteRecorder;
  private readonly labels: KeysLabels;
  private readonly doc: Document;
  private readonly container: HTMLElement;
  private readonly trackSelect: HTMLSelectElement;
  private readonly octaveOutput: HTMLOutputElement;
  private readonly velocityInput: HTMLInputElement;
  private readonly midiButton: HTMLButtonElement | null;
  private readonly scroller: HTMLDivElement;
  private readonly keyboard: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private readonly keyEls = new Map<number, HTMLDivElement>();
  private readonly unsubscribe: (() => void)[] = [];
  /** Sounding notes: the track each plays on, by a key for its source */
  private readonly down = new Map<string, { track: string; pitch: number }>();
  private readonly computerKeys: boolean;
  private chosen: string | null = null;
  private lowest: number;
  private midi: MidiAccess | null = null;

  constructor(target: ContainerTarget, options: KeysOptions) {
    super();

    const container = resolveContainer(target);
    const doc = container.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = doc.createElement(tag);

      node.className = className;
      parent?.append(node);

      return node;
    };
    const tool = (name: 'close', label: string, parent: HTMLElement) => {
      const node = el('button', 'tfs-tool', parent);

      node.type = 'button';
      node.title = label;
      node.setAttribute('aria-label', label);
      node.append(renderIcon(doc, name, options.icons));

      return node;
    };
    const text = (label: string, title: string, parent: HTMLElement) => {
      const node = el('button', 'tfs-roll-text', parent);

      node.type = 'button';
      node.textContent = label;
      node.title = title;
      node.setAttribute('aria-label', title);

      return node;
    };

    this.doc = doc;
    this.container = container;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.recorder = options.recorder;
    this.notes = options.notes;
    this.labels = { ...DEFAULT_KEYS_LABELS, ...options.labels };
    this.lowest = 12 * ((options.octave ?? 3) + 1);
    this.computerKeys = options.computerKeys ?? true;
    injectControlStyles(doc);

    this.root = el('div', 'tfs-keys');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', this.labels.title);
    this.root.hidden = !!options.hidden;

    if (!options.docked) {
      this.root.classList.add('tfs-keys--overlay');

      if (doc.defaultView?.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    const bar = el('div', 'tfs-roll-bar', this.root);
    const trackLabel = el('label', 'tfs-roll-snap', bar);
    const octave = el('div', 'tfs-keys-octave', bar);
    const velocity = el('label', 'tfs-roll-snap tfs-keys-velocity', bar);

    el('strong', 'tfs-roll-title', bar).textContent = this.labels.title;
    bar.prepend(bar.lastElementChild!);
    trackLabel.append(this.labels.track);
    this.trackSelect = el('select', '', trackLabel);
    text('−', this.labels.octaveDown, octave).addEventListener('click', () => this.shift(-1));
    this.octaveOutput = el('output', 'tfs-keys-value', octave);
    text('+', this.labels.octaveUp, octave).addEventListener('click', () => this.shift(1));
    velocity.append(this.labels.velocity);
    this.velocityInput = el('input', '', velocity);
    this.velocityInput.type = 'range';
    this.velocityInput.min = '1';
    this.velocityInput.max = '127';
    this.velocityInput.value = '100';

    const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

    this.midiButton = supported ? text(this.labels.midi, this.labels.midi, bar) : null;
    this.midiButton?.setAttribute('aria-pressed', 'false');
    this.midiButton?.addEventListener('click', () => void this.connectMidi());
    el('span', 'tfs-roll-gap', bar);
    tool('close', this.labels.close, bar).addEventListener('click', () => this.hide());

    this.scroller = el('div', 'tfs-keys-scroller', this.root);
    this.keyboard = el('div', 'tfs-keys-board', this.scroller);
    this.keyboard.setAttribute('aria-label', this.labels.title);
    this.emptyEl = el('div', 'tfs-keys-empty', this.root);
    this.emptyEl.textContent = this.labels.noTrack;
    this.trackSelect.addEventListener('change', () => {
      this.releaseAll();
      this.chosen = this.trackSelect.value || null;
    });

    container.append(this.root);
    this.listen();
    this.renderKeys();
    this.render();
    this.place();
  }

  get visible() {
    return !this.root.hidden;
  }

  /** The instrument track the keys play: the recording one, the one picked, the armed one, the picked clip's, or the first. */
  get track(): string | null {
    if (this.notes?.track) return this.notes.track;

    const tracks = this.instrumentTracks();
    const has = (id: string | null | undefined) => (id && tracks.some((t) => t.id === id) ? id : null);
    const picked = this.timeline.state.clips.find((clip) => this.timeline.selection.includes(clip.id));

    return has(this.chosen) ?? has(this.recorder?.armed) ?? has(picked?.track) ?? tracks[0]?.id ?? null;
  }

  /** Play a track's instrument from now on, or null to follow the armed or picked track. */
  setTrack(track: string | null) {
    this.releaseAll();
    this.chosen = track;
    this.render();
  }

  /** The lowest octave shown, with C4 as middle C. */
  get octave() {
    return this.lowest / 12 - 1;
  }

  setOctave(octave: number) {
    const next = 12 * (Math.round(octave) + 1);
    const clamped = Math.max(0, Math.min(MAX_PITCH + 1 - 12 * OCTAVES, next));

    if (clamped === this.lowest) return;

    this.releaseAll();
    this.lowest = clamped;
    this.renderKeys();
  }

  show() {
    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
  }

  toggle() {
    this.setVisible(!this.visible);
  }

  /** Start a note on the keys' track, as if a key were pressed. `source` tells presses of the same note apart. */
  press(pitch: number, velocity = this.velocity, source = `api:${pitch}`) {
    const track = this.track;
    if (!track || this.down.has(source)) return;

    const context = this.engine.context;

    if (context instanceof AudioContext && context.state === 'suspended') void context.resume();

    this.down.set(source, { track, pitch });
    this.engine.instrument(track)?.noteOn(pitch, velocity);
    if (this.notes?.track === track) this.notes.noteOn(pitch, velocity);
    this.light(pitch);
    this.emit('note', { track, pitch, velocity });
  }

  /** End a note started with `press`. */
  release(pitch: number, source = `api:${pitch}`) {
    const sound = this.down.get(source);
    if (!sound) return;

    this.down.delete(source);
    // Another source may still hold the same note on the same track
    if ([...this.down.values()].some((s) => s.track === sound.track && s.pitch === sound.pitch)) return;

    this.engine.instrument(sound.track)?.noteOff(sound.pitch);
    if (this.notes?.track === sound.track) this.notes.noteOff(sound.pitch);
    this.light(sound.pitch);
    this.emit('note', { track: sound.track, pitch: sound.pitch, velocity: 0 });
  }

  /** End every note held. */
  releaseAll() {
    for (const source of [...this.down.keys()]) this.release(this.down.get(source)!.pitch, source);
  }

  destroy() {
    this.releaseAll();
    for (const off of this.unsubscribe) off();
    this.disconnectMidi();
    this.setVisible(false);
    this.root.remove();
    this.removeAllListeners();
  }

  private get velocity() {
    return Number(this.velocityInput.value) / 127;
  }

  private instrumentTracks(): Track[] {
    return this.timeline.state.tracks.filter((track) => track.instrument);
  }

  private shift(by: number) {
    this.setOctave(this.octave + by);
  }

  private setVisible(visible: boolean) {
    if (visible === this.visible) return;

    if (!visible) this.releaseAll();
    this.root.hidden = !visible;
    this.place();
    this.emit('toggle', { visible });
    if (visible) this.render();
  }

  /** Let overlays at the bottom of the container, like the piano roll, sit above the keys. */
  private place() {
    const overlay = this.root.classList.contains('tfs-keys--overlay');

    this.container.style.setProperty('--tfs-keys-offset', overlay && this.visible ? `${this.root.offsetHeight}px` : '0px');
  }

  private listen() {
    const { timeline, keyboard } = this;
    const pointers = new Map<number, number>();
    const pitchAt = (x: number, y: number) => {
      const key = this.doc.elementFromPoint(x, y)?.closest<HTMLElement>('.tfs-keys-key');

      return key && keyboard.contains(key) ? Number(key.dataset.pitch) : null;
    };
    const slide = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;

      const pitch = pitchAt(e.clientX, e.clientY);
      const from = pointers.get(e.pointerId)!;

      if (pitch === null || pitch === from) return;

      this.release(from, `pointer:${e.pointerId}`);
      pointers.set(e.pointerId, pitch);
      this.press(pitch, this.velocity, `pointer:${e.pointerId}`);
    };
    const lift = (e: PointerEvent) => {
      const pitch = pointers.get(e.pointerId);
      if (pitch === undefined) return;

      pointers.delete(e.pointerId);
      this.release(pitch, `pointer:${e.pointerId}`);
    };

    keyboard.addEventListener('pointerdown', (e) => {
      const key = (e.target as HTMLElement).closest<HTMLElement>('.tfs-keys-key');
      if (!key || e.button !== 0) return;

      const pitch = Number(key.dataset.pitch);

      e.preventDefault();
      keyboard.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, pitch);
      // Lower on the key is louder, like pressing a real key harder
      const box = key.getBoundingClientRect();
      const depth = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));

      this.press(pitch, Math.min(1, this.velocity * (0.75 + depth * 0.5)), `pointer:${e.pointerId}`);
    });
    keyboard.addEventListener('pointermove', slide);
    keyboard.addEventListener('pointerup', lift);
    keyboard.addEventListener('pointercancel', lift);
    keyboard.addEventListener('contextmenu', (e) => e.preventDefault());

    const view = this.doc.defaultView;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.visible || !this.computerKeys || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;

      const step = COMPUTER_KEYS[e.code];

      if (step === undefined && e.code !== 'KeyZ' && e.code !== 'KeyX') return;

      // While the keys are open, these keys play notes instead of the timeline's shortcuts
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;

      if (e.code === 'KeyZ') this.shift(-1);
      else if (e.code === 'KeyX') this.shift(1);
      else this.press(this.lowest + step!, this.velocity, `key:${e.code}`);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const sound = this.down.get(`key:${e.code}`);

      if (sound) this.release(sound.pitch, `key:${e.code}`);
    };
    const onBlur = () => this.releaseAll();
    const onResize = () => this.place();

    this.doc.addEventListener('keydown', onKeyDown, true);
    this.doc.addEventListener('keyup', onKeyUp, true);
    view?.addEventListener('blur', onBlur);
    view?.addEventListener('resize', onResize);

    this.unsubscribe.push(
      () => {
        this.doc.removeEventListener('keydown', onKeyDown, true);
        this.doc.removeEventListener('keyup', onKeyUp, true);
        view?.removeEventListener('blur', onBlur);
        view?.removeEventListener('resize', onResize);
      },
      timeline.on('change', () => this.render()),
      timeline.on('select', () => this.render()),
    );

    if (this.recorder) this.unsubscribe.push(this.recorder.on('arm', () => this.render()));
    if (this.notes) {
      for (const event of ['start', 'stop'] as const) this.unsubscribe.push(this.notes.on(event, () => this.render()));
    }
  }

  /** Draw the keys of the octaves shown, labelled with their computer keys. */
  private renderKeys() {
    this.keyEls.clear();
    this.keyboard.replaceChildren();
    this.octaveOutput.value = noteName(this.lowest);

    let white = 0;

    for (let pitch = this.lowest; pitch < this.lowest + 12 * OCTAVES + 1 && pitch <= MAX_PITCH; pitch++) {
      const black = isBlackKey(pitch);
      const key = this.doc.createElement('div');
      const letter = KEY_LETTERS[pitch - this.lowest];

      key.className = `tfs-keys-key ${black ? 'tfs-keys-key--black' : 'tfs-keys-key--white'}`;
      key.dataset.pitch = String(pitch);
      key.title = noteName(pitch);
      key.style.setProperty('--i', String(black ? white : white++));
      if (letter && this.computerKeys) key.dataset.letter = letter;
      if (pitch % 12 === 0) key.dataset.name = noteName(pitch);
      this.keyEls.set(pitch, key);
      this.keyboard.append(key);
    }

    this.keyboard.style.setProperty('--whites', String(white));

    for (const sound of this.down.values()) this.light(sound.pitch);
    this.render();
  }

  /** Refresh the track choice, and drum names on drum tracks. */
  private render() {
    const tracks = this.instrumentTracks();
    const track = this.track;
    const options = tracks.map((t) => `${t.id}\n${t.name}`).join('\n');

    if (this.trackSelect.dataset.options !== options) {
      this.trackSelect.dataset.options = options;
      this.trackSelect.replaceChildren(
        ...tracks.map((t) => {
          const option = this.doc.createElement('option');

          option.value = t.id;
          option.textContent = t.name;

          return option;
        }),
      );
    }

    this.trackSelect.value = track ?? '';
    this.trackSelect.disabled = !tracks.length || !!this.notes?.isRecording;
    this.emptyEl.hidden = !!tracks.length;
    this.scroller.hidden = !tracks.length;

    const instrument = tracks.find((t) => t.id === track)?.instrument;
    const drums = instrument?.id === 'drums';
    const samples = (instrument?.state as { samples?: Record<string, { name?: string }> } | undefined)?.samples;

    for (const [pitch, key] of this.keyEls) {
      const name = drums ? ((samples && !Array.isArray(samples) && samples[pitch]?.name) || DRUM_NAMES[pitch]) : undefined;

      key.title = name ? `${name} (${noteName(pitch)})` : noteName(pitch);
    }

    this.root.style.setProperty('--clip', instrument && track ? this.timeline.colorOf(tracks.find((t) => t.id === track)!) : '#4f9cf9');
    this.root.classList.toggle('tfs-keys--recording', !!this.notes?.isRecording);
  }

  private light(pitch: number) {
    const on = [...this.down.values()].some((sound) => sound.pitch === pitch);

    this.keyEls.get(pitch)?.classList.toggle('tfs-keys-key--down', on);
  }

  /** Ask for MIDI devices and play what they send; a second click lets them go. */
  private async connectMidi() {
    const button = this.midiButton;
    if (!button) return;

    if (this.midi) {
      this.disconnectMidi();

      return;
    }

    try {
      const access = (await (navigator as unknown as { requestMIDIAccess(): Promise<MidiAccess> }).requestMIDIAccess()) as MidiAccess;

      this.midi = access;
      access.onstatechange = () => this.wireMidi();
      this.wireMidi();
    } catch {
      button.title = this.labels.midiDenied;
      button.setAttribute('aria-pressed', 'false');
    }
  }

  private wireMidi() {
    const access = this.midi;
    const button = this.midiButton;
    if (!access || !button) return;

    const names: string[] = [];

    for (const [id, input] of access.inputs) {
      names.push(input.name ?? id);
      input.onmidimessage = ({ data }) => {
        const [status = 0, pitch = 0, value = 0] = data;
        const kind = status & 0xf0;
        const source = `midi:${id}:${status & 0x0f}:${pitch}`;

        if (kind === 0x90 && value > 0) this.press(pitch, value / 127, source);
        else if (kind === 0x80 || kind === 0x90) this.release(pitch, source);
      };
    }

    button.setAttribute('aria-pressed', 'true');
    button.title = names.length ? `${this.labels.midiOn.replace('{n}', String(names.length))}: ${names.join(', ')}` : this.labels.midiNone;
    button.classList.toggle('tfs-keys-midi--none', !names.length);
    this.emit('midi', { inputs: names });
  }

  private disconnectMidi() {
    const access = this.midi;
    if (!access) return;

    this.midi = null;
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
    for (const source of [...this.down.keys()]) if (source.startsWith('midi:')) this.release(this.down.get(source)!.pitch, source);
    if (this.midiButton) {
      this.midiButton.setAttribute('aria-pressed', 'false');
      this.midiButton.title = this.labels.midi;
      this.midiButton.classList.remove('tfs-keys-midi--none');
    }
  }
}
