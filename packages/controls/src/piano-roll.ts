import { DRUM_NAMES, type AudioEngine } from '@toneflix/studio-audio';
import {
  changeVelocity,
  deleteNotes,
  duplicateNotes,
  Emitter,
  Grid,
  isBlackKey,
  MAX_PITCH,
  moveNotes,
  noteName,
  quantizeNotes,
  replaceNotes,
  linkedClips,
  patternsOf,
  resizeNotes,
  uid,
  updateTrack,
  type Clip,
  type Note,
  type SampleRef,
  type SnapTo,
  type Track,
} from '@toneflix/studio-core';
import { openMenu, resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { renderIcon, type IconSet } from './icons.ts';
import type { StudioKeys } from './keys.ts';
import { mayCarrySample, pickAudioFile, sampleInputOf, StepGrid, type SampleInput, type StepGridLabels } from './step-grid.ts';
import { injectControlStyles } from './styles.ts';

export interface PianoRollLabels extends StepGridLabels {
  title: string;
  /** The view switch: notes on keys, or a step sequencer grid */
  notesView: string;
  stepsView: string;
  close: string;
  /** Loops the open clip on its own */
  playClip: string;
  stopClip: string;
  snap: string;
  /** Snap choices */
  snapOff: string;
  bar: string;
  beat: string;
  quantize: string;
  delete: string;
  zoomIn: string;
  zoomOut: string;
  keys: string;
  velocity: string;
  /** A sampler track's samples menu */
  samples: string;
  /** Shows the keys, to play the open clip's track live */
  playKeys: string;
  /** The patterns menu, opened from the clip's name */
  patterns: string;
  /** Gives the open clip a copy of its pattern to edit on its own */
  makeUnique: string;
  /** Gives the open clip a new, empty pattern */
  newPattern: string;
  /** Adds a sample on a key; `{note}` is the key last played */
  addSampleOn: string;
  /** Shown when no note clip is open */
  empty: string;
}

export const DEFAULT_PIANO_ROLL_LABELS: PianoRollLabels = {
  title: 'Piano roll',
  notesView: 'Notes',
  stepsView: 'Steps',
  length: 'Bars',
  swing: 'Swing',
  accent: 'Accent',
  close: 'Close',
  playClip: 'Play clip (Space)',
  stopClip: 'Stop clip (Space)',
  snap: 'Snap',
  snapOff: 'Off',
  bar: 'Bar',
  beat: 'Beat',
  quantize: 'Quantize',
  delete: 'Delete notes',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  keys: 'Keys',
  velocity: 'Velocity',
  samples: 'Samples',
  playKeys: 'Keys',
  patterns: 'Patterns',
  makeUnique: 'Make unique',
  newPattern: 'New empty pattern',
  addSampleOn: 'Add sample on {note}…',
  loadSample: 'Load sample…',
  builtInSound: 'Use built-in sound',
  removeSample: 'Remove sample',
  removePad: 'Remove pad',
  addPad: 'Add pad',
  empty: 'Double-click a note clip to edit its notes.',
};

export interface PianoRollOptions {
  timeline: StudioTimeline;
  /** Plays notes through the track's instrument as they are drawn, and moves the playhead */
  engine: AudioEngine;
  icons?: Partial<IconSet>;
  labels?: Partial<PianoRollLabels>;
  /** Start hidden, to be opened with `show()`, `edit()` or a double-click on a note clip */
  hidden?: boolean;
  /**
   * Sit in the page flow under whatever comes before it, taking its own height.
   * By default it slides up over the bottom of its container.
   */
  docked?: boolean;
  /** Snap for drawing and moving notes; 1/16 unless given */
  snap?: SnapTo;
  /** Width of one beat in pixels at the start; 64 unless given */
  beatWidth?: number;
  /** Open drum track clips in the step grid instead of on keys; true unless given */
  stepsForDrums?: boolean;
  /** Gets the decoded audio of each sample loaded, for example to upload it */
  onSource?: (id: string, buffer: AudioBuffer) => void;
  /** Keys for a Keys button to show and hide; they play the open clip's track */
  keys?: StudioKeys;
}

export interface PianoRollEvents extends Record<string, unknown> {
  toggle: { visible: boolean };
  /** A note clip opened, or null when none is open */
  open: { clip: string | null };
  /** The picked notes changed, by index in the clip's notes */
  select: { notes: number[] };
}

type Gesture =
  | { kind: 'move' | 'resize'; id: number; x: number; y: number; started: boolean; index: number; base: readonly Note[]; pitch: number }
  | { kind: 'empty'; id: number; x: number; y: number; started: boolean; mouse: boolean; additive: boolean; before: Set<number> }
  | { kind: 'velocity'; id: number; y: number; started: boolean; index: number; base: readonly Note[] }
  | { kind: 'key'; id: number; pitch: number };

const SNAPS: SnapTo[] = ['bar', 'beat', '1/8', '1/16', '1/32', 'off'];
const RULER = 22;
const VELOCITY = 56;
const ZOOM = [12, 512] as const;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * A piano roll for a note clip: draw notes on a grid of keys and time, then move,
 * resize, delete and set their velocity. Every finished edit is one step in the
 * timeline's undo history. Works with a mouse, a keyboard and touch.
 */
export class StudioPianoRoll extends Emitter<PianoRollEvents> {
  readonly root: HTMLDivElement;
  private readonly timeline: StudioTimeline;
  private readonly engine: AudioEngine;
  private readonly labels: PianoRollLabels;
  private readonly doc: Document;
  private readonly grid: Grid;
  private readonly titleEl: HTMLElement;
  private readonly patternButton: HTMLButtonElement;
  private readonly snapSelect: HTMLSelectElement;
  private readonly buttons: Record<'quantize' | 'delete' | 'zoomIn' | 'zoomOut', HTMLButtonElement>;
  private readonly scroller: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly ruler: HTMLDivElement;
  private readonly keys: HTMLDivElement;
  private readonly area: HTMLDivElement;
  private readonly lines: HTMLDivElement;
  private readonly before: HTMLDivElement;
  private readonly after: HTMLDivElement;
  private readonly box: HTMLDivElement;
  private readonly playhead: HTMLDivElement;
  private readonly velocity: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private readonly noteEls: HTMLDivElement[] = [];
  private readonly stalkEls: HTMLDivElement[] = [];
  private readonly keyEls: HTMLDivElement[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  private clipId: string | null = null;
  private picked = new Set<number>();
  private gesture: Gesture | null = null;
  private beatWidth: number;
  private rowHeight = 14;
  private length: number | null = null;
  private lastVelocity = 0.8;
  private lastTap: { index: number; time: number } | null = null;
  private frameKey = '';
  private drums: boolean | null = null;
  private keysKey = '';
  private frame = 0;
  private view: 'notes' | 'steps' = 'notes';
  private readonly stepsForDrums: boolean;
  private readonly steps: StepGrid;
  private readonly viewButtons: Record<'notes' | 'steps', HTMLButtonElement>;
  private readonly samplesButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;
  private readonly icons?: Partial<IconSet>;
  /** While the open clip loops on its own: the loop, position and isolation to go back to */
  private preview: { loop: AudioEngine['loop']; clip: string; time: number; isolated: readonly string[] | null } | null = null;
  private readonly onSource?: PianoRollOptions['onSource'];
  /** The key last pressed, where a sampler's next sample goes */
  private lastKey = 60;

  constructor(target: ContainerTarget, options: PianoRollOptions) {
    super();

    const container = resolveContainer(target);
    const doc = container.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = doc.createElement(tag);

      node.className = className;
      parent?.append(node);

      return node;
    };
    const button = (name: 'quantize' | 'delete' | 'zoomIn' | 'zoomOut' | 'close', parent: HTMLElement, text?: string) => {
      const node = el('button', text ? 'tfs-roll-text' : 'tfs-tool', parent);
      const label = name === 'close' ? this.labels.close : this.labels[name];

      node.type = 'button';
      node.title = label;
      node.setAttribute('aria-label', label);
      if (text) node.textContent = text;
      else node.append(renderIcon(doc, name as Exclude<typeof name, 'quantize'>, options.icons));

      return node;
    };

    this.doc = doc;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.labels = { ...DEFAULT_PIANO_ROLL_LABELS, ...options.labels };
    this.grid = new Grid({ snap: options.snap ?? '1/16' });
    this.beatWidth = options.beatWidth ?? 64;
    this.stepsForDrums = options.stepsForDrums ?? true;
    this.onSource = options.onSource;
    this.icons = options.icons;
    injectControlStyles(doc);

    this.root = el('div', 'tfs-roll');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', this.labels.title);
    this.root.hidden = !!options.hidden;

    if (!options.docked) {
      this.root.classList.add('tfs-roll--overlay');

      if (doc.defaultView?.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    const bar = el('div', 'tfs-roll-bar', this.root);
    const snapLabel = el('label', 'tfs-roll-snap', bar);

    // The clip's name opens the patterns menu
    const pattern = el('button', 'tfs-roll-pattern', bar);

    pattern.type = 'button';
    pattern.setAttribute('aria-haspopup', 'menu');
    pattern.title = this.labels.patterns;
    this.titleEl = el('strong', 'tfs-roll-title', pattern);
    pattern.append(renderIcon(doc, 'chevron', options.icons));
    pattern.addEventListener('click', () => this.openPatternMenu(pattern));
    this.patternButton = pattern;
    bar.prepend(pattern);

    const views = el('div', 'tfs-roll-views', bar);
    const viewButton = (view: 'notes' | 'steps', text: string) => {
      const node = el('button', 'tfs-roll-view', views);

      node.type = 'button';
      node.textContent = text;
      node.addEventListener('click', () => this.setView(view));

      return node;
    };

    views.setAttribute('role', 'group');
    pattern.after(views);
    this.viewButtons = { notes: viewButton('notes', this.labels.notesView), steps: viewButton('steps', this.labels.stepsView) };
    this.playButton = el('button', 'tfs-tool tfs-roll-play', bar);
    this.playButton.type = 'button';
    this.playButton.addEventListener('click', () => this.togglePreview());
    views.after(this.playButton);
    snapLabel.append(this.labels.snap);
    this.snapSelect = el('select', '', snapLabel);

    for (const snap of SNAPS) {
      const option = el('option', '', this.snapSelect);

      option.value = snap;
      option.textContent = snap === 'off' ? this.labels.snapOff : snap === 'bar' ? this.labels.bar : snap === 'beat' ? this.labels.beat : snap;
    }

    this.snapSelect.value = this.grid.snap;
    this.snapSelect.addEventListener('change', () => this.setSnap(this.snapSelect.value as SnapTo));
    this.buttons = {
      quantize: button('quantize', bar, this.labels.quantize),
      delete: button('delete', bar),
      zoomOut: button('zoomOut', bar),
      zoomIn: button('zoomIn', bar),
    };
    this.samplesButton = el('button', 'tfs-roll-text', bar);
    this.samplesButton.type = 'button';
    this.samplesButton.textContent = this.labels.samples;
    this.samplesButton.setAttribute('aria-haspopup', 'menu');
    this.samplesButton.addEventListener('click', () => this.openSamplesMenu());
    if (options.keys) {
      const keys = options.keys;
      const toggle = el('button', 'tfs-roll-text', bar);
      const pressed = () => toggle.setAttribute('aria-pressed', String(keys.visible));

      toggle.type = 'button';
      toggle.textContent = this.labels.playKeys;
      toggle.addEventListener('click', () => {
        const clip = this.clip;

        if (!keys.visible && clip) keys.setTrack(clip.track);
        keys.toggle();
      });
      pressed();
      this.unsubscribe.push(keys.on('toggle', pressed));
    }

    el('span', 'tfs-roll-gap', bar);
    button('close', bar).addEventListener('click', () => this.hide());
    this.buttons.quantize.addEventListener('click', () => this.quantize());
    this.buttons.delete.addEventListener('click', () => this.deletePicked());
    this.buttons.zoomIn.addEventListener('click', () => this.zoom(1.5));
    this.buttons.zoomOut.addEventListener('click', () => this.zoom(1 / 1.5));

    this.scroller = el('div', 'tfs-roll-scroller', this.root);
    this.content = el('div', 'tfs-roll-content', this.scroller);

    const top = el('div', 'tfs-roll-row tfs-roll-top', this.content);
    const middle = el('div', 'tfs-roll-row', this.content);
    const bottom = el('div', 'tfs-roll-row tfs-roll-bottom', this.content);
    const velocityName = el('div', 'tfs-roll-corner', bottom);

    el('div', 'tfs-roll-corner', top);
    this.ruler = el('div', 'tfs-roll-ruler', top);
    this.keys = el('div', 'tfs-roll-keys', middle);
    this.keys.setAttribute('aria-label', this.labels.keys);
    this.area = el('div', 'tfs-roll-area', middle);
    this.area.tabIndex = 0;
    this.area.setAttribute('aria-label', this.labels.title);
    this.lines = el('div', 'tfs-roll-lines', this.area);
    this.before = el('div', 'tfs-roll-outside', this.area);
    this.after = el('div', 'tfs-roll-outside', this.area);
    this.box = el('div', 'tfs-roll-box', this.area);
    this.box.hidden = true;
    this.playhead = el('div', 'tfs-roll-playhead', this.area);
    velocityName.textContent = this.labels.velocity;
    this.velocity = el('div', 'tfs-roll-velocity', bottom);
    this.velocity.setAttribute('aria-label', this.labels.velocity);
    this.steps = new StepGrid(doc, this.stepHost(), this.labels);
    this.root.append(this.steps.root);
    this.emptyEl = el('div', 'tfs-roll-empty', this.root);
    this.emptyEl.textContent = this.labels.empty;

    for (let pitch = MAX_PITCH; pitch >= 0; pitch--) {
      const key = el('div', isBlackKey(pitch) ? 'tfs-roll-key tfs-roll-key--black' : 'tfs-roll-key', this.keys);

      key.dataset.pitch = String(pitch);
      this.keyEls[pitch] = key;
    }

    container.append(this.root);
    this.listen();
    this.render();
  }

  get visible() {
    return !this.root.hidden;
  }

  /** The open note clip, if any. */
  get clip(): Clip | null {
    return this.timeline.state.clips.find((clip) => clip.id === this.clipId && clip.notes) ?? null;
  }

  /** Indices of the picked notes in the open clip. */
  get selection() {
    return [...this.picked].sort((a, b) => a - b);
  }

  /** Open a note clip, or none, and show the piano roll when one opens. */
  edit(id: string | null) {
    const clip = id === null ? null : this.timeline.state.clips.find((c) => c.id === id && c.notes);
    const next = clip?.id ?? null;

    if (next !== this.clipId) {
      this.clipId = next;
      this.picked.clear();
      if (clip) this.view = this.stepsForDrums && this.isDrums(clip) ? 'steps' : 'notes';
      this.frameKey = '';
      this.render();
      this.followPreview();
      this.emit('open', { clip: next });
    }

    if (next) {
      this.show();
      this.reveal();
    }
  }

  show() {
    if (!this.clip) this.edit(this.pickClip());
    this.setVisible(true);
  }

  hide() {
    this.stopPreview();
    this.setVisible(false);
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Pick notes by index in the open clip. */
  select(indices: Iterable<number>) {
    const count = this.clip?.notes?.length ?? 0;

    this.picked = new Set([...indices].filter((i) => i >= 0 && i < count));
    this.renderNotes();
    this.emit('select', { notes: this.selection });
  }

  setSnap(snap: SnapTo) {
    this.grid.set({ snap });
    this.snapSelect.value = snap;
    this.frameKey = '';
    this.render();
  }

  /** Whether the open clip is looping on its own. */
  get previewing() {
    return !!this.preview;
  }

  /**
   * Loop the open clip on its own, like a pattern, from its start. Stopping puts
   * the loop and play position back as they were.
   */
  playPreview() {
    const clip = this.clip;
    if (!clip) return;

    const engine = this.engine;

    this.preview ??= { loop: engine.loop, time: engine.time, isolated: engine.isolated, clip: clip.id };
    this.preview.clip = clip.id;
    engine.isolate([clip.id]);
    engine.setLoop({ start: clip.start, end: clip.start + clip.duration });
    void engine.play(clip.start);
    this.renderPlay();
  }

  stopPreview() {
    const preview = this.preview;
    if (!preview) return;

    const engine = this.engine;

    this.preview = null;
    engine.pause();
    engine.isolate(preview.isolated);
    engine.setLoop(preview.loop);
    engine.seek(preview.time);
    this.renderPlay();
  }

  togglePreview() {
    if (this.preview) this.stopPreview();
    else this.playPreview();
  }

  /** Keep a running preview on the open clip's place and length as they change. */
  private followPreview() {
    const preview = this.preview;
    if (!preview) return;

    const clip = this.clip;
    if (!clip) return this.stopPreview();
    if (clip.id !== preview.clip) return this.playPreview();

    const loop = this.engine.loop;
    const end = clip.start + clip.duration;

    if (loop && Math.abs(loop.start - clip.start) < 1e-6 && Math.abs(loop.end - end) < 1e-6) return;

    const time = this.engine.time;

    this.engine.setLoop({ start: clip.start, end });
    if (time < clip.start || time >= end) this.engine.seek(clip.start);
  }

  private renderPlay() {
    const playing = !!this.preview;
    const label = playing ? this.labels.stopClip : this.labels.playClip;
    const button = this.playButton;

    button.replaceChildren(renderIcon(this.doc, playing ? 'stop' : 'play', this.icons));
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(playing));
    button.disabled = !this.clip;
  }

  /** Show the notes on keys, or as a step sequencer grid. */
  setView(view: 'notes' | 'steps') {
    if (view === this.view) return;

    this.view = view;
    this.frameKey = '';
    this.render();
    this.reveal();
  }

  private isDrums(clip: Clip) {
    return this.timeline.state.tracks.find((track) => track.id === clip.track)?.instrument?.id === 'drums';
  }

  private trackOf(clip: Clip | null = this.clip) {
    return clip ? this.timeline.state.tracks.find((track) => track.id === clip.track) : undefined;
  }

  /** How the open clip's instrument takes samples: per drum pad, per sampler root note, or not at all. */
  private sampling(): 'pads' | 'zones' | null {
    const id = this.trackOf()?.instrument?.id;

    return id === 'drums' ? 'pads' : id === 'sampler' ? 'zones' : null;
  }

  /** The open clip's instrument samples by note number. */
  private samples(track: Track | undefined = this.trackOf()) {
    const samples = (track?.instrument?.state as { samples?: unknown } | undefined)?.samples;
    const map = new Map<number, SampleRef>();

    if (Array.isArray(samples)) for (const sample of samples as SampleRef[]) map.set(sample.root ?? 60, sample);
    else if (samples && typeof samples === 'object') for (const [pitch, sample] of Object.entries(samples as Record<string, SampleRef>)) map.set(Number(pitch), sample);

    return map;
  }

  /** Decode a file or library sound into the engine, as a sample source. */
  private async sourceOf(input: SampleInput) {
    if (input instanceof File) {
      const buffer = await this.engine.context.decodeAudioData(await input.arrayBuffer());

      return { source: uid('sample'), name: input.name.replace(/\.[^.]+$/, ''), buffer };
    }

    return { source: input.source, name: input.name, buffer: await input.load() };
  }

  /** Put a sample on a note of the open clip's instrument, or take it off with null, as one undo step. */
  async useSample(pitch: number, input: SampleInput | null) {
    const track = this.trackOf();
    const sampling = this.sampling();
    if (!track?.instrument || !sampling || !this.editable) return;

    let sample: SampleRef | null = null;

    if (input) {
      const { source, name, buffer } = await this.sourceOf(input);

      if (this.engine.getBuffer(source) !== buffer) {
        this.engine.setBuffer(source, buffer);
        this.timeline.setSource({ id: source, duration: buffer.duration });
        this.onSource?.(source, buffer);
      }

      sample = sampling === 'zones' ? { source, name, root: pitch } : { source, name };
    }

    this.writeSamples(track.id, input ? 'Load sample' : 'Remove sample', (samples) => {
      samples.delete(pitch);
      if (sample) samples.set(pitch, sample);
    });
    if (sample) this.audition(pitch, this.lastVelocity);
  }

  /** Change a track's samples and maybe its clips' notes, as one undo step. */
  private writeSamples(id: string, label: string, change: (samples: Map<number, SampleRef>) => void, notes?: (clip: Clip) => Note[]) {
    this.timeline.model.apply(label, (state) => {
      const track = state.tracks.find((t) => t.id === id);
      if (!track?.instrument) return state;

      const samples = this.samples(track);

      change(samples);

      const zones = track.instrument.id === 'sampler';
      const value = zones ? [...samples.values()] : Object.fromEntries([...samples].sort((a, b) => a[0] - b[0]));
      const next = updateTrack(state, id, { instrument: { ...track.instrument, state: { ...(track.instrument.state as object | undefined), samples: value } } });

      return notes ? { ...next, clips: next.clips.map((clip) => (clip.track === id && clip.notes ? { ...clip, notes: notes(clip) } : clip)) } : next;
    });
  }

  /** Take a drum pad's sample off and delete the track's notes on it. */
  private removePad(pitch: number) {
    const track = this.trackOf();

    if (track && this.editable) {
      this.writeSamples(
        track.id,
        'Remove pad',
        (samples) => samples.delete(pitch),
        (clip) => clip.notes!.filter((note) => note.pitch !== pitch),
      );
    }
  }

  /** A sampler's samples: add one on the last key played, or remove one. */
  private openSamplesMenu() {
    if (this.sampling() !== 'zones') return;

    const box = this.samplesButton.getBoundingClientRect();
    const key = this.lastKey;
    const add = {
      label: this.labels.addSampleOn.replace('{note}', noteName(key)),
      onSelect: () => void pickAudioFile(this.doc).then((file) => file && this.useSample(key, file)),
      disabled: !this.editable,
    };
    const remove = [...this.samples()].map(([pitch, sample]) => ({
      label: `${this.labels.removeSample}: ${sample.name ?? sample.source} (${noteName(pitch)})`,
      onSelect: () => void this.useSample(pitch, null),
      disabled: !this.editable,
      danger: true,
    }));

    openMenu(this.doc, { x: box.left, y: box.bottom + 4 }, [add, ...remove], this.labels.samples);
  }

  /** The patterns on the open clip's track, to switch to, and ways to start a new one. */
  private openPatternMenu(anchor: HTMLElement) {
    const clip = this.clip;
    if (!clip) return;

    const box = anchor.getBoundingClientRect();
    const state = this.timeline.state;
    const linked = linkedClips(state, clip.id).length;
    const edit = this.editable;
    const patterns = patternsOf(state, clip.track).map((pattern) => ({
      label: `${pattern.source === clip.source ? '✓ ' : ''}${pattern.name || this.labels.title} (${pattern.clips.length})`,
      disabled: !edit || pattern.source === clip.source,
      onSelect: () => this.timeline.usePattern(clip.id, pattern.source),
    }));

    openMenu(
      this.doc,
      { x: box.left, y: box.bottom + 4 },
      [
        ...patterns,
        { label: this.labels.makeUnique, disabled: !edit || linked < 2, onSelect: () => void this.timeline.makeUnique(clip.id) },
        { label: this.labels.newPattern, disabled: !edit, onSelect: () => void this.timeline.makeUnique(clip.id, []) },
      ],
      this.labels.patterns,
    );
  }

  /** Seconds in one step of the step grid: the snap when it is finer than a beat, otherwise a sixteenth. */
  private stepLength() {
    const section = this.grid.sectionAt(this.origin);
    const step = this.stepAt(0);

    return step && step < section.beat ? step : 60 / section.bpm / 4;
  }

  private stepHost() {
    const model = () => this.timeline.model;

    return {
      clip: () => {
        const clip = this.clip;

        return clip ? { clip, drums: this.isDrums(clip) } : null;
      },
      step: () => this.stepLength(),
      bar: () => this.grid.sectionAt(this.origin).bar,
      editable: () => this.editable,
      draft: (label: string, notes: readonly Note[]) => this.draft(label, notes),
      commit: (label: string) => model().commit(label),
      cancel: () => model().cancel(),
      setLength: (duration: number) => {
        const id = this.clipId;

        if (!id || !this.editable) return;

        // Copies of the pattern that show all of it, as this clip does, change length with it
        model().apply('Pattern length', (state) => {
          const open = state.clips.find((clip) => clip.id === id);
          if (!open) return state;

          const whole = new Set(
            linkedClips(state, id)
              .filter((clip) => Math.abs(clip.offset - open.offset) < 1e-6 && Math.abs(clip.duration - open.duration) < 1e-6)
              .map((clip) => clip.id),
          );

          return {
            ...state,
            clips: state.clips.map((clip) => (whole.has(clip.id) ? { ...clip, duration: Math.max(0.05, duration - clip.offset) } : clip)),
          };
        });
      },
      audition: (pitch: number, velocity: number) => this.audition(pitch, velocity),
      sampling: () => this.sampling(),
      samples: () => this.samples(),
      useSample: (pitch: number, input: SampleInput | null) => void this.useSample(pitch, input),
      removePad: (pitch: number) => this.removePad(pitch),
    };
  }

  /** Put the picked notes' starts on the snap grid, or every note when none are picked, as one undo step. */
  quantize() {
    const clip = this.clip;
    if (!clip?.notes || !this.editable) return;

    const origin = clip.start - clip.offset;

    this.commitNotes(
      quantizeNotes(clip.notes, this.picked, (time) => this.grid.round(time + origin) - origin),
      'Quantize',
    );
  }

  destroy() {
    for (const off of this.unsubscribe) off();

    cancelAnimationFrame(this.frame);
    this.root.remove();
  }

  private get editable() {
    return !this.timeline.readonly;
  }

  private setVisible(visible: boolean) {
    if (visible === this.visible) return;

    this.root.hidden = !visible;
    this.emit('toggle', { visible });

    if (visible) {
      this.render();
      this.reveal();
      this.follow();
    }
  }

  /** The note clip to open when none is: the picked one, or the first. */
  private pickClip() {
    const clips = this.timeline.state.clips.filter((clip) => clip.notes);
    const picked = new Set(this.timeline.selection);

    return (clips.find((clip) => picked.has(clip.id)) ?? clips[0])?.id ?? null;
  }

  private listen() {
    const { timeline, engine, area, velocity, keys } = this;

    this.unsubscribe.push(
      timeline.on('change', () => {
        if (this.clipId && !this.clip) this.edit(null);

        const count = this.clip?.notes?.length ?? 0;

        if ([...this.picked].some((i) => i >= count)) this.picked.clear();

        this.followPreview();
        this.render();
      }),
      timeline.on('open', ({ clip }) => {
        if (timeline.state.clips.some((c) => c.id === clip && c.notes)) this.edit(clip);
      }),
      timeline.on('select', ({ clips }) => {
        const [only] = clips;

        if (this.visible && clips.length === 1 && only !== this.clipId && timeline.state.clips.some((c) => c.id === only && c.notes)) this.edit(only!);
      }),
      timeline.on('zoom', () => this.render()),
      engine.on('play', () => this.follow()),
      engine.on('pause', () => {
        // Pausing from anywhere else ends the clip preview too
        this.stopPreview();
        this.placePlayhead();
      }),
      engine.on('seek', () => this.placePlayhead()),
      engine.on('end', () => {
        this.stopPreview();
        this.placePlayhead();
      }),
    );

    area.addEventListener('pointerdown', (e) => this.onAreaDown(e));
    area.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const index = this.noteAt(e.target);

      if (index !== null && this.editable) this.commitNotes(deleteNotes(this.clip?.notes ?? [], new Set([index])), 'Delete notes', new Set());
    });
    velocity.addEventListener('pointerdown', (e) => this.onVelocityDown(e));
    keys.addEventListener('pointerdown', (e) => {
      const key = (e.target as HTMLElement).closest<HTMLElement>('.tfs-roll-key');
      const instrument = this.instrument();
      if (key) this.lastKey = Number(key.dataset.pitch);
      if (!key || !instrument) return;

      const pitch = Number(key.dataset.pitch);

      e.preventDefault();
      keys.setPointerCapture(e.pointerId);
      this.resume();
      instrument.noteOn(pitch, this.lastVelocity);
      key.classList.add('tfs-roll-key--down');
      this.gesture = { kind: 'key', id: e.pointerId, pitch };
    });

    for (const target of [area, velocity, keys]) {
      target.addEventListener('pointermove', (e) => this.onMove(e));
      target.addEventListener('pointerup', (e) => this.onUp(e, false));
      target.addEventListener('pointercancel', (e) => this.onUp(e, true));
    }

    // An audio file or library sound dropped on a key or row puts a sample on that note
    for (const target of [keys, area]) {
      target.addEventListener('dragover', (e) => {
        if (!this.sampling() || !this.editable || !mayCarrySample(e)) return;

        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
      });
      target.addEventListener('drop', (e) => {
        const input = sampleInputOf(e);
        if (!this.sampling() || !this.editable || !input) return;

        e.preventDefault();
        void this.useSample(this.pitchAt(e.clientY), input);
      });
    }

    area.addEventListener('keydown', (e) => this.onKey(e));
    // Space loops the open clip while focus is anywhere in the piano roll
    this.root.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || (e.target instanceof HTMLElement && ['BUTTON', 'SELECT'].includes(e.target.tagName))) return;

      e.preventDefault();
      this.togglePreview();
    });
    this.scroller.addEventListener(
      'wheel',
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;

        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX);
      },
      { passive: false },
    );
  }

  /** Where the clip's content starts on the timeline; note times count from here. */
  private get origin() {
    const clip = this.clip;

    return clip ? clip.start - clip.offset : 0;
  }

  /** Pixels per second, from the beat width at the clip's tempo. */
  private get pps() {
    return this.beatWidth / this.grid.sectionAt(this.origin).beat;
  }

  /** Seconds between snap points at a time from the content start, or 0 with snapping off. */
  private stepAt(time: number) {
    const section = this.grid.sectionAt(time + this.origin);
    const quarter = 60 / section.bpm;
    const steps: Record<SnapTo, number> = { bar: section.bar, beat: section.beat, '1/8': quarter / 2, '1/16': quarter / 4, '1/32': quarter / 8, off: 0 };

    return steps[this.grid.snap];
  }

  private round(time: number) {
    return this.grid.round(time + this.origin) - this.origin;
  }

  /** The snap point at or before a time, to place a note in the cell that was clicked. */
  private floor(time: number) {
    const step = this.stepAt(time);
    if (!step) return time;

    const section = this.grid.sectionAt(time + this.origin);

    return section.start + Math.floor((time + this.origin - section.start) / step + 1e-6) * step - this.origin;
  }

  private instrument() {
    const clip = this.clip;

    return clip ? this.engine.instrument(clip.track) : null;
  }

  private resume() {
    const context = this.engine.context;

    if (context instanceof AudioContext && context.state === 'suspended') void context.resume();
  }

  /** Play a note briefly through the track's instrument. */
  private audition(pitch: number, velocity: number) {
    const instrument = this.instrument();
    if (!instrument) return;

    this.resume();
    instrument.play(pitch, velocity, this.engine.context.currentTime, 0.25);
  }

  private noteAt(target: EventTarget | null) {
    const note = (target as HTMLElement | null)?.closest?.<HTMLElement>('.tfs-roll-note');

    return note ? Number(note.dataset.index) : null;
  }

  private timeAt(clientX: number) {
    return (clientX - this.area.getBoundingClientRect().left) / this.pps;
  }

  private pitchAt(clientY: number) {
    return clamp(MAX_PITCH - Math.floor((clientY - this.area.getBoundingClientRect().top) / this.rowHeight), 0, MAX_PITCH);
  }

  private draft(label: string, notes: readonly Note[]) {
    const id = this.clipId;

    if (id) this.timeline.model.draft(label, (state) => replaceNotes(state, id, notes));
  }

  /** Save notes as one undo step, then pick `picked` when given. */
  private commitNotes(notes: readonly Note[], label: string, picked?: Set<number>) {
    if (!this.clipId) return;
    if (picked) this.picked = picked;

    this.timeline.setNotes(this.clipId, notes, label);
    this.emit('select', { notes: this.selection });
  }

  private deletePicked() {
    const notes = this.clip?.notes;

    if (notes && this.picked.size && this.editable) this.commitNotes(deleteNotes(notes, this.picked), 'Delete notes', new Set());
  }

  private onAreaDown(e: PointerEvent) {
    const clip = this.clip;
    if (!clip?.notes || e.button !== 0 || this.gesture) return;

    const index = this.noteAt(e.target);
    const mouse = e.pointerType === 'mouse';
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    this.area.focus({ preventScroll: true });

    if (index === null) {
      // A mouse drag picks notes in a box; a touch drag scrolls, so only a tap counts
      if (mouse) {
        e.preventDefault();
        this.area.setPointerCapture(e.pointerId);
      }

      this.gesture = { kind: 'empty', id: e.pointerId, x: e.clientX, y: e.clientY, started: false, mouse, additive, before: additive ? new Set(this.picked) : new Set() };

      return;
    }

    e.preventDefault();
    this.area.setPointerCapture(e.pointerId);

    const now = e.timeStamp;

    if (this.lastTap?.index === index && now - this.lastTap.time < 350 && this.editable) {
      this.lastTap = null;
      this.commitNotes(deleteNotes(clip.notes, new Set([index])), 'Delete notes', new Set());

      return;
    }

    if (additive && this.picked.has(index)) {
      this.picked.delete(index);
      this.select(this.picked);

      return;
    }

    if (!this.picked.has(index)) this.select(additive ? [...this.picked, index] : [index]);

    const note = clip.notes[index]!;
    const element = this.noteEls[index]!;
    const handle = Math.min(e.pointerType === 'mouse' ? 8 : 16, element.offsetWidth / 3);
    const resize = element.getBoundingClientRect().right - e.clientX <= handle;

    this.audition(note.pitch, note.velocity);
    this.gesture = { kind: resize ? 'resize' : 'move', id: e.pointerId, x: e.clientX, y: e.clientY, started: false, index, base: clip.notes, pitch: note.pitch };
  }

  private onVelocityDown(e: PointerEvent) {
    const clip = this.clip;
    if (!clip?.notes?.length || e.button !== 0 || this.gesture || !this.editable) return;

    const time = this.timeAt(e.clientX);
    const reach = 10 / this.pps;
    let index = -1;
    let best = reach;

    // The nearest stalk, preferring picked notes where several stand together
    clip.notes.forEach((note, i) => {
      const distance = Math.abs(note.start - time) - (this.picked.has(i) ? reach / 2 : 0);

      if (distance < best) {
        best = distance;
        index = i;
      }
    });

    if (index < 0) return;

    e.preventDefault();
    this.velocity.setPointerCapture(e.pointerId);
    if (!this.picked.has(index)) this.select([index]);

    this.gesture = { kind: 'velocity', id: e.pointerId, y: e.clientY, started: false, index, base: clip.notes };
    this.onMove(e);
  }

  private onMove(e: PointerEvent) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId || g.kind === 'key') return;

    if (g.kind === 'velocity') {
      const box = this.velocity.getBoundingClientRect();
      const value = clamp(1 - (e.clientY - box.top) / box.height, 0.01, 1);
      const picked = this.picked.size ? this.picked : new Set([g.index]);

      g.started = true;
      this.lastVelocity = value;
      this.draft('Velocity', changeVelocity(g.base, picked, value - g.base[g.index]!.velocity));

      return;
    }

    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (!g.started && Math.hypot(dx, dy) < 4) return;

    g.started = true;

    if (g.kind === 'empty') {
      if (!g.mouse) return;

      const box = this.area.getBoundingClientRect();
      const x1 = Math.min(g.x, e.clientX) - box.left;
      const x2 = Math.max(g.x, e.clientX) - box.left;
      const y1 = Math.min(g.y, e.clientY) - box.top;
      const y2 = Math.max(g.y, e.clientY) - box.top;
      const inside = new Set(g.before);

      Object.assign(this.box.style, { left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });
      this.box.hidden = false;

      this.clip?.notes?.forEach((note, i) => {
        const top = (MAX_PITCH - note.pitch) * this.rowHeight;

        if (note.start * this.pps < x2 && (note.start + note.duration) * this.pps > x1 && top < y2 && top + this.rowHeight > y1) inside.add(i);
      });

      this.select(inside);

      return;
    }

    if (!this.editable) return;

    const note = g.base[g.index]!;
    const free = e.altKey;
    const picked = this.picked.size ? this.picked : new Set([g.index]);

    if (g.kind === 'move') {
      const start = free ? note.start + dx / this.pps : this.round(note.start + dx / this.pps);
      const notes = moveNotes(g.base, picked, start - note.start, -Math.round(dy / this.rowHeight));
      const pitch = notes[g.index]!.pitch;

      if (pitch !== g.pitch) {
        g.pitch = pitch;
        this.audition(pitch, note.velocity);
      }

      this.draft('Move notes', notes);
    } else {
      const end = note.start + note.duration + dx / this.pps;
      const min = this.stepAt(note.start) || 0.02;
      const snapped = free ? end : this.round(end);
      const duration = Math.max(min, snapped - note.start);

      this.length = duration;
      this.draft('Resize notes', resizeNotes(g.base, picked, duration - note.duration, Math.min(min, 0.02)));
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;

    this.gesture = null;
    this.box.hidden = true;

    if (g.kind === 'key') {
      this.instrument()?.noteOff(g.pitch);
      this.keyEls[g.pitch]?.classList.remove('tfs-roll-key--down');

      return;
    }

    if (cancelled) {
      if (this.timeline.model.drafting) this.timeline.model.cancel();

      return;
    }

    if (g.kind === 'empty') {
      if (!g.started) {
        if (!g.additive && this.picked.size) this.select([]);
        this.addNote(this.timeAt(e.clientX), this.pitchAt(e.clientY));
      }

      return;
    }

    if (!g.started) {
      if (g.kind !== 'velocity') this.lastTap = { index: g.index, time: e.timeStamp };

      return;
    }

    const label = g.kind === 'velocity' ? 'Velocity' : g.kind === 'move' ? 'Move notes' : 'Resize notes';

    this.timeline.model.commit(label);
    this.lastTap = null;
  }

  /** Draw a note in the clicked cell, as long as the last one drawn or resized. */
  private addNote(time: number, pitch: number) {
    const clip = this.clip;
    if (!clip?.notes || !this.editable || time < 0) return;

    const start = Math.max(0, this.floor(time));
    const duration = this.length ?? (this.stepAt(start) || this.grid.sectionAt(start + this.origin).beat / 4);
    const note: Note = { pitch, start, duration, velocity: this.lastVelocity };

    this.audition(pitch, note.velocity);
    this.commitNotes([...clip.notes, note], 'Add note', new Set([clip.notes.length]));
  }

  private onKey(e: KeyboardEvent) {
    const clip = this.clip;
    if (!clip?.notes || isTyping(e.target)) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const edit = this.editable;
    const step = this.stepAt(0) || this.grid.sectionAt(this.origin).beat / 4;
    const move = (time: number, semitones: number) => this.picked.size && this.commitNotes(moveNotes(clip.notes!, this.picked, time, semitones), 'Move notes');
    let handled = true;

    if (mod && key === 'z' && edit) {
      if (e.shiftKey) this.timeline.redo();
      else this.timeline.undo();
    } else if (mod && key === 'y' && edit) this.timeline.redo();
    else if (mod && key === 'a') this.select(clip.notes.keys());
    else if (mod && key === 'd' && edit && this.picked.size) {
      const { notes, created } = duplicateNotes(clip.notes, this.picked, this.grid.sectionAt(this.origin).beat);

      this.commitNotes(notes, 'Duplicate notes', created);
    } else if ((key === 'delete' || key === 'backspace') && edit) this.deletePicked();
    else if (key === 'q' && !mod && edit) this.quantize();
    else if (key === 'escape') this.select([]);
    else if (key === 'arrowup' && edit) move(0, e.shiftKey ? 12 : 1);
    else if (key === 'arrowdown' && edit) move(0, e.shiftKey ? -12 : -1);
    else if (key === 'arrowleft' && edit) move(-step, 0);
    else if (key === 'arrowright' && edit) move(step, 0);
    else handled = false;

    if (handled) e.preventDefault();
  }

  /** Change the beat width, keeping the time under `clientX` (or the middle) in place. */
  private zoom(factor: number, clientX?: number) {
    const box = this.area.getBoundingClientRect();
    const view = this.scroller.getBoundingClientRect();
    const x = clientX ?? view.left + (view.width + this.keys.offsetWidth) / 2;
    const time = (x - box.left) / this.pps;
    const next = clamp(this.beatWidth * factor, ZOOM[0], ZOOM[1]);

    if (next === this.beatWidth) return;

    this.beatWidth = next;
    this.render();
    this.scroller.scrollLeft += time * this.pps - (x - this.area.getBoundingClientRect().left);
  }

  /** Scroll so the clip's start and its notes (or middle C, or the drums) are in view. */
  private reveal() {
    const clip = this.clip;
    if (!clip?.notes || !this.visible) return;

    const pitches = clip.notes.map((n) => n.pitch);
    const middle = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : this.drums ? 42 : 60;
    const area = this.scroller.clientHeight - RULER - VELOCITY;

    this.scroller.scrollTop = (MAX_PITCH - middle) * this.rowHeight - area / 2;
    this.scroller.scrollLeft = clip.offset * this.pps;
  }

  /** Keep the playhead moving while the engine plays. */
  private follow() {
    cancelAnimationFrame(this.frame);
    this.placePlayhead();

    if (!this.visible || !this.engine.isPlaying) return;

    const view = this.doc.defaultView;

    this.frame = view ? view.requestAnimationFrame(() => this.follow()) : 0;
  }

  private placePlayhead() {
    const time = this.engine.time - this.origin;
    const clip = this.clip;

    this.steps.setPlaying(clip && this.engine.isPlaying && time < clip.offset + clip.duration ? time : null);
    this.playhead.hidden = !clip || time < 0;
    this.playhead.style.transform = `translateX(${time * this.pps}px)`;
  }

  private render() {
    const clip = this.clip;
    const track = clip && this.timeline.state.tracks.find((t) => t.id === clip.track);

    this.root.classList.toggle('tfs-roll--empty', !clip);
    this.emptyEl.hidden = !!clip;
    this.titleEl.textContent = clip ? `${clip.name ?? track?.name ?? ''}` : this.labels.title;
    this.patternButton.disabled = !clip;

    for (const b of Object.values(this.buttons)) b.disabled = !clip;
    this.renderPlay();

    this.root.classList.toggle('tfs-roll--steps', this.view === 'steps');
    this.samplesButton.hidden = !clip || this.sampling() !== 'zones';
    this.viewButtons.notes.setAttribute('aria-pressed', String(this.view === 'notes'));
    this.viewButtons.steps.setAttribute('aria-pressed', String(this.view === 'steps'));

    if (!clip?.notes || !this.visible) return;

    const timelineGrid = this.timeline.grid;

    this.grid.set({ bpm: timelineGrid.bpm, meter: timelineGrid.meter });
    this.grid.setTempo(timelineGrid.tempo);

    if (this.view === 'steps') {
      this.root.style.setProperty('--clip', track ? this.timeline.colorOf(track) : '#4f9cf9');
      this.buttons.quantize.disabled = !clip.notes.length || !this.editable || this.grid.snap === 'off';
      this.steps.render();
      this.placePlayhead();

      return;
    }

    this.rowHeight = parseFloat(this.doc.defaultView?.getComputedStyle(this.root).getPropertyValue('--tfs-roll-row') ?? '') || 14;
    this.root.style.setProperty('--clip', track ? this.timeline.colorOf(track) : '#4f9cf9');
    this.buttons.delete.disabled = !this.picked.size || !this.editable;
    this.buttons.quantize.disabled = !clip.notes.length || !this.editable || this.grid.snap === 'off';
    this.renderKeys(track?.instrument?.id === 'drums', this.samples(track ?? undefined));
    this.renderFrame(clip);
    this.renderNotes();
    this.placePlayhead();
  }

  /** Name the keys: drum names on drum tracks, sample names where samples sit, C notes otherwise. */
  private renderKeys(drums: boolean, samples: ReadonlyMap<number, SampleRef>) {
    const names = [...samples].map(([pitch, sample]) => `${pitch}:${sample.name ?? sample.source}`).join('\n');
    const key = `${drums}|${names}`;

    if (key === this.keysKey) return;

    this.keysKey = key;
    this.drums = drums;
    this.root.classList.toggle('tfs-roll--drums', drums);
    this.root.classList.toggle('tfs-roll--sampled', !drums && samples.size > 0);

    this.keyEls.forEach((el, pitch) => {
      const sample = samples.get(pitch);
      const name = sample ? (sample.name ?? sample.source) : drums ? DRUM_NAMES[pitch] : pitch % 12 === 0 ? noteName(pitch) : '';

      el.textContent = name ?? '';
      el.title = (drums || sample) && name ? `${name} (${noteName(pitch)})` : noteName(pitch);
      el.classList.toggle('tfs-roll-key--named', !!name);
      el.classList.toggle('tfs-roll-key--sample', !!sample);
    });
  }

  /** Size the grid and draw its bar, beat and snap lines and the ruler, when they change. */
  private renderFrame(clip: Clip) {
    const pps = this.pps;
    const origin = this.origin;
    const lastNote = Math.max(0, ...clip.notes!.map((n) => n.start + n.duration));
    const end = clip.offset + clip.duration;
    const span = Math.max(end, lastNote) + this.grid.sectionAt(origin + end).bar;
    const key = [pps, origin, span, end, clip.offset, this.rowHeight, this.grid.snap, this.grid.sections.map((s) => `${s.start},${s.bpm},${s.meter}`).join(';')].join('|');

    if (key === this.frameKey) return;

    this.frameKey = key;

    const width = Math.ceil(span * pps);
    const height = (MAX_PITCH + 1) * this.rowHeight;
    const lines: string[] = [];
    const marks: string[] = [];

    const row = this.rowHeight;
    const bands = Array.from({ length: 12 }, (_, i) => `${isBlackKey(MAX_PITCH - i) ? 'rgba(0, 0, 0, 0.22)' : 'transparent'} ${i * row}px ${(i + 1) * row}px`);

    this.lines.style.background = `repeating-linear-gradient(to bottom, ${bands.join(', ')})`;
    this.content.style.setProperty('--tfs-roll-width', `${width}px`);
    this.content.style.setProperty('--tfs-roll-height-px', `${height}px`);

    for (const beat of this.grid.beats(origin, origin + span)) {
      lines.push(`<i class="${beat.accent ? 'tfs-roll-bar-line' : 'tfs-roll-beat-line'}" style="left:${((beat.time - origin) * pps).toFixed(1)}px"></i>`);
    }

    // Snap lines between beats, when they are far enough apart to read
    const step = this.stepAt(0);
    const beat = this.grid.sectionAt(origin).beat;

    if (step && step < beat && step * pps >= 8 && span / step < 4000) {
      for (let t = 0; t < span; t += step) {
        if (Math.abs(t / beat - Math.round(t / beat)) > 1e-3) lines.push(`<i class="tfs-roll-step-line" style="left:${(t * pps).toFixed(1)}px"></i>`);
      }
    }

    for (const { time, bar } of this.grid.bars(origin, origin + span)) marks.push(`<span style="left:${((time - origin) * pps).toFixed(1)}px">${bar}</span>`);

    this.lines.innerHTML = lines.join('');
    this.ruler.innerHTML = marks.join('');
    this.before.style.width = `${clip.offset * pps}px`;
    Object.assign(this.after.style, { left: `${end * pps}px`, width: `${Math.max(0, width - end * pps)}px` });
  }

  private renderNotes() {
    const notes = this.clip?.notes ?? [];
    const pps = this.pps;

    notes.forEach((note, i) => {
      let element = this.noteEls[i];
      let stalk = this.stalkEls[i];

      if (!element || !stalk) {
        element = this.doc.createElement('div');
        stalk = this.doc.createElement('div');
        element.className = 'tfs-roll-note';
        stalk.className = 'tfs-roll-stalk';
        this.noteEls[i] = element;
        this.stalkEls[i] = stalk;
        this.area.insertBefore(element, this.box);
        this.velocity.append(stalk);
      }

      const picked = this.picked.has(i);

      element.dataset.index = String(i);
      element.title = `${this.keyEls[note.pitch]?.title ?? noteName(note.pitch)} · ${Math.round(note.velocity * 127)}`;
      element.style.transform = `translate(${note.start * pps}px, ${(MAX_PITCH - note.pitch) * this.rowHeight}px)`;
      element.style.width = `${Math.max(4, note.duration * pps)}px`;
      element.style.setProperty('--v', String(note.velocity));
      element.classList.toggle('tfs-roll-note--picked', picked);
      stalk.style.left = `${note.start * pps}px`;
      stalk.style.height = `calc(${note.velocity} * (100% - 6px))`;
      stalk.classList.toggle('tfs-roll-stalk--picked', picked);
    });

    for (const element of this.noteEls.splice(notes.length)) element.remove();
    for (const stalk of this.stalkEls.splice(notes.length)) stalk.remove();

    if (this.clip) this.buttons.delete.disabled = !this.picked.size || !this.editable;
  }
}
