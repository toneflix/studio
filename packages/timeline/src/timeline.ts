import {
  addClips,
  AUTOMATION_RANGES,
  automationAt,
  automationOf,
  type AutomationParam,
  type AutomationPoint,
  cleanPoints,
  setAutomation as writeAutomation,
  addTrack as insertTrack,
  type Clip,
  clipEnd,
  duplicateClips,
  Emitter,
  Grid,
  type GridOptions,
  type History,
  type InstrumentChoice,
  makeClip,
  makeNoteClip,
  type Marker,
  removeMarker as dropMarker,
  removeTempoChange as dropTempoChange,
  setMarker as writeMarker,
  setTempoChange as writeTempoChange,
  type TempoChange,
  moveTrack,
  moveClips,
  nearestSnap,
  type Peaks,
  removeClips,
  replaceNotes,
  removeTrack as dropTrack,
  setFades,
  type Source,
  splitClips,
  stackOrder,
  timelineEnd,
  TimelineModel,
  type TimelineState,
  type TimeRange,
  type Track,
  trimEnd,
  trimStart,
  uid,
  updateTrack,
} from '@toneflix/studio-core';
import { ClipView } from './clip-view.ts';
import { resolveContainer, type ContainerTarget } from './container.ts';
import { closeMenu, openMenu, type MenuItem } from './menu.ts';
import { injectStyles } from './styles.ts';

export interface TimelineOptions {
  /** Share a model, for example to drive several views */
  model?: TimelineModel;
  /** The editor's undo history, when the timeline isn't the only thing in it */
  history?: History;
  grid?: Partial<GridOptions>;
  /** Show bars and beats on the lanes and ruler */
  showGrid?: boolean;
  /** Zoom, in pixels per second */
  pxPerSecond?: number;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
  /** Default row height in pixels; a track's own `height` wins */
  trackHeight?: number;
  /** Let tracks be resized by dragging the bottom edge of their row */
  resizeTracks?: boolean;
  minTrackHeight?: number;
  maxTrackHeight?: number;
  /** Width of the track header column; 0 hides it */
  headerWidth?: number;
  readonly?: boolean;
  /** Snap to other clips' edges and the playhead when grid snapping is off */
  snapToClips?: boolean;
  /** Scroll to keep the playhead on screen */
  follow?: boolean;
  /** Handle the editing shortcuts (delete, split, undo…) while the timeline has focus */
  keyboard?: boolean;
  /** Colours for tracks without their own */
  palette?: string[];
  /** Fill a track's header cell. Return a function to clean it up. */
  renderHeader?: (track: Track, cell: HTMLElement) => void | (() => void);
  /** Makes the track a clip lands on when dragged below the last one; leave out to stop at the last */
  createTrack?: () => Track;
  /** Show the add track button and the track menu (rename, duplicate, move, delete) */
  editTracks?: boolean;
  /** Names for the add track button and the track menu, for example to translate them */
  trackLabels?: Partial<TrackLabels>;
  /**
   * Instrument tracks the add track button offers beside an audio track. The built-in
   * synth and drums by default; an empty list leaves only audio tracks.
   */
  instrumentTracks?: InstrumentTrackKind[];
  /**
   * Adds the add track menu's "Audio from a file" choice, which lets people pick audio
   * files from their device and gets them here; `importAudioFiles` from `@toneflix/studio`
   * puts each on a new track.
   */
  importAudio?: (files: File[]) => void | Promise<unknown>;
  /** Height in pixels of the automation lane under a track */
  automationHeight?: number;
  /** Show markers in the ruler, above the bar numbers */
  markers?: boolean;
  /** Show the tempo beside the bar numbers, where the tempo and meter can change during the song */
  tempoTrack?: boolean;
  /** Names for markers and tempo changes in the ruler, for example to translate them */
  rulerLabels?: Partial<RulerLabels>;
}

export interface RulerLabels {
  markers: string;
  tempo: string;
  addMarker: string;
  addTempo: string;
  rename: string;
  setTempo: string;
  deleteMarker: string;
  deleteTempo: string;
  /** Name of a new marker; `{n}` is its number */
  newMarker: string;
  /** Shown on the first tempo, which the transport display changes */
  startTempo: string;
}

export const DEFAULT_RULER_LABELS: RulerLabels = {
  markers: 'Markers',
  tempo: 'Tempo',
  addMarker: 'Add marker here',
  addTempo: 'Add tempo change at this bar',
  rename: 'Rename',
  setTempo: 'Set tempo',
  deleteMarker: 'Delete marker',
  deleteTempo: 'Delete tempo change',
  newMarker: 'Marker {n}',
  startTempo: 'Starting tempo; change it in the transport display',
};

const METERS: [number, number][] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [12, 8],
];

/** A kind of instrument track the add track button offers. */
export interface InstrumentTrackKind {
  /** In the add track menu */
  label: string;
  /** Name of a new track; `{n}` is its number */
  name: string;
  instrument: InstrumentChoice;
}

export const DEFAULT_INSTRUMENT_TRACKS: InstrumentTrackKind[] = [
  { label: 'Instrument track', name: 'Synth {n}', instrument: { id: 'synth' } },
  { label: 'Drum track', name: 'Drums {n}', instrument: { id: 'drums' } },
  { label: 'Sampler track', name: 'Sampler {n}', instrument: { id: 'sampler' } },
];

export interface TrackLabels {
  add: string;
  /** The add track menu's empty audio track */
  audioTrack: string;
  /** The add track menu's choice to pick audio files from the device */
  audioFile: string;
  addBelow: string;
  rename: string;
  duplicate: string;
  moveUp: string;
  moveDown: string;
  delete: string;
  menu: string;
  /** Name of a new track; `{n}` is its number */
  newTrack: string;
  volume: string;
  pan: string;
  showVolume: string;
  showPan: string;
  hideAutomation: string;
  clearAutomation: string;
}

export const DEFAULT_TRACK_LABELS: TrackLabels = {
  add: 'Add track',
  audioTrack: 'Empty audio track',
  audioFile: 'Audio from a file…',
  addBelow: 'Add track below',
  rename: 'Rename',
  duplicate: 'Duplicate',
  moveUp: 'Move up',
  moveDown: 'Move down',
  delete: 'Delete track',
  menu: 'Track options',
  newTrack: 'Track {n}',
  volume: 'Volume',
  pan: 'Pan',
  showVolume: 'Show volume automation',
  showPan: 'Show pan automation',
  hideAutomation: 'Hide automation',
  clearAutomation: 'Clear automation',
};

/** Fired by an element in a track header to open that track's menu, for custom headers. */
export const TRACK_MENU_EVENT = 'tfs-track-menu';

export interface TimelineEvents extends Record<string, unknown> {
  change: { state: TimelineState; label: string; final: boolean };
  select: { clips: string[] };
  range: { range: TimeRange | null };
  seek: { time: number };
  zoom: { pxPerSecond: number };
  /** An automation lane was shown, switched or hidden */
  automation: { track: string; param: AutomationParam | null };
  /** A clip was double-clicked, for example to open its notes in a piano roll */
  open: { clip: string };
}

type Gesture =
  | { kind: 'move'; id: number; x: number; y: number; started: boolean; clip: Clip; ids: Set<string>; lane: number; base: TimelineState; track?: Track }
  | { kind: 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out'; id: number; x: number; started: boolean; clip: Clip }
  | { kind: 'range'; id: number; x: number; y: number; started: boolean; time: number; lane: number; additive: boolean; ruler: boolean; touch: boolean }
  | { kind: 'range-edge'; id: number; x: number; y: number; started: boolean; edge: 'start' | 'end'; range: TimeRange }
  | { kind: 'click-clip'; id: number; x: number; y: number; clip: Clip }
  | { kind: 'resize-track'; id: number; x: number; y: number; started: boolean; track: Track; height: number }
  | { kind: 'marker'; id: number; x: number; started: boolean; marker: Marker }
  | { kind: 'tempo'; id: number; x: number; started: boolean; change: TempoChange }
  | { kind: 'point'; id: number; x: number; y: number; started: boolean; track: string; param: AutomationParam; others: AutomationPoint[]; adding: boolean };

interface Row {
  row: HTMLDivElement;
  header: HTMLDivElement;
  lane: HTMLDivElement;
  grip: HTMLDivElement;
  /** The automation lane's name cell and drawing area */
  autoHead: HTMLDivElement;
  autoLane: HTMLDivElement;
  cleanup?: () => void;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Space above and below the line in an automation lane, in pixels */
const AUTO_PAD = 5;

const formatValue = (param: AutomationParam, value: number) => {
  if (param === 'pan') {
    const amount = Math.round(Math.abs(value) * 100);

    return amount === 0 ? 'C' : `${value < 0 ? 'L' : 'R'} ${amount}`;
  }

  if (value <= 0.00001) return '-∞ dB';

  const db = 20 * Math.log10(value);

  return `${db > 0.05 ? '+' : ''}${db.toFixed(1)} dB`;
};

const PALETTE = ['#4f9cf9', '#f97362', '#5fd08a', '#c58af9', '#f9c74f', '#4fd1d9', '#f98fc4', '#a3b18a'];

const LABELS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatTime = (seconds: number, step: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const digits = step < 1 ? 1 : 0;

  return `${minutes}:${rest.toFixed(digits).padStart(digits ? 4 : 2, '0')}`;
};

/**
 * A multitrack timeline: lanes of clips that drag freely by the body, overlap,
 * move between lanes, trim, fade, split and snap, with one undo history.
 */
export class StudioTimeline extends Emitter<TimelineEvents> {
  readonly model: TimelineModel;
  readonly grid: Grid;
  readonly root: HTMLDivElement;
  private doc: Document;
  private scroller: HTMLDivElement;
  private content: HTMLDivElement;
  private corner: HTMLDivElement;
  private ruler: HTMLDivElement;
  private rows: HTMLDivElement;
  private overlay: HTMLDivElement;
  private playhead: HTMLDivElement;
  private rangeEl: HTMLDivElement;
  private rangeMark: HTMLDivElement;
  private loopEl: HTMLDivElement;
  private snapEl: HTMLDivElement;
  private trackRows = new Map<string, Row>();
  private automationShown = new Map<string, AutomationParam>();
  private clipViews = new Map<string, ClipView>();
  private selected = new Set<string>();
  private currentRange: TimeRange | null = null;
  private loopRange: { start: number; end: number } | null = null;
  private gesture: Gesture | null = null;
  private lastGrip: { track: string; at: number } | null = null;
  private lastPoint: { track: string; index: number; at: number } | null = null;
  private frame = 0;
  private resize?: ResizeObserver;
  private unsubscribe: (() => void)[] = [];
  private options: Required<Omit<TimelineOptions, 'model' | 'history' | 'grid' | 'renderHeader' | 'createTrack' | 'trackLabels' | 'rulerLabels' | 'importAudio'>> &
    Pick<TimelineOptions, 'renderHeader' | 'createTrack' | 'importAudio'>;
  private readonly trackLabels: TrackLabels;
  private readonly trackMenuExtras = new Set<(track: Track) => MenuItem[]>();
  private readonly rulerLabels: RulerLabels;
  private markerStrip!: HTMLDivElement;
  private barLabels!: HTMLDivElement;
  private lastMarker: { id: string; at: number } | null = null;
  private lastStripPress = 0;
  private addButton!: HTMLButtonElement;
  private pps: number;
  private playheadTime = 0;

  /** Renders into an element, or the element a CSS selector like `'#editor'` points to. */
  constructor(target: ContainerTarget, options: TimelineOptions = {}) {
    super();

    const container = resolveContainer(target);

    this.doc = container.ownerDocument;
    this.model = options.model ?? new TimelineModel(undefined, options.history);
    this.grid = new Grid(options.grid);
    this.options = {
      showGrid: options.showGrid ?? true,
      pxPerSecond: options.pxPerSecond ?? 40,
      minPxPerSecond: options.minPxPerSecond ?? 2,
      maxPxPerSecond: options.maxPxPerSecond ?? 2000,
      trackHeight: options.trackHeight ?? 72,
      resizeTracks: options.resizeTracks ?? true,
      minTrackHeight: options.minTrackHeight ?? 40,
      maxTrackHeight: options.maxTrackHeight ?? 320,
      headerWidth: options.headerWidth ?? 180,
      readonly: options.readonly ?? false,
      snapToClips: options.snapToClips ?? true,
      follow: options.follow ?? true,
      keyboard: options.keyboard ?? true,
      palette: options.palette ?? PALETTE,
      renderHeader: options.renderHeader,
      importAudio: options.importAudio,
      createTrack: options.createTrack,
      editTracks: options.editTracks ?? true,
      automationHeight: options.automationHeight ?? 64,
      markers: options.markers ?? true,
      tempoTrack: options.tempoTrack ?? true,
      instrumentTracks: options.instrumentTracks ?? DEFAULT_INSTRUMENT_TRACKS,
    };
    this.trackLabels = { ...DEFAULT_TRACK_LABELS, ...options.trackLabels };
    this.rulerLabels = { ...DEFAULT_RULER_LABELS, ...options.rulerLabels };
    this.grid.setTempo(this.model.state.tempo);
    this.pps = clamp(this.options.pxPerSecond, this.options.minPxPerSecond, this.options.maxPxPerSecond);

    injectStyles(this.doc);

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = this.doc.createElement(tag);
      node.className = className;
      parent?.append(node);

      return node;
    };

    this.root = el('div', 'tfs');
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', 'Timeline');
    this.scroller = el('div', 'tfs-scroll', this.root);
    this.content = el('div', 'tfs-content', this.scroller);
    const rulerRow = el('div', 'tfs-ruler-row', this.content);
    this.corner = el('div', 'tfs-corner', rulerRow);
    this.addButton = el('button', 'tfs-add-track', this.corner);
    this.addButton.type = 'button';
    this.addButton.textContent = '+';
    this.addButton.title = this.trackLabels.add;
    this.addButton.setAttribute('aria-label', this.trackLabels.add);
    this.addButton.addEventListener('click', () => {
      const kinds = this.options.instrumentTracks;
      const add = (track?: Track) => {
        const added = this.addTrack(track);

        if (added) this.editTrackName(added.id);
      };

      const importAudio = this.options.importAudio;

      if (!kinds.length && !importAudio) return add();

      const box = this.addButton.getBoundingClientRect();

      openMenu(
        this.doc,
        { x: box.left, y: box.bottom + 2 },
        [
          { label: this.trackLabels.audioTrack, onSelect: () => add() },
          ...(importAudio ? [{ label: this.trackLabels.audioFile, onSelect: () => this.pickAudioFiles(importAudio) }] : []),
          ...kinds.map((kind) => ({ label: kind.label, onSelect: () => add(this.makeInstrumentTrack(kind)) })),
        ],
        this.trackLabels.add,
      );
    });
    this.ruler = el('div', 'tfs-ruler', rulerRow);
    this.loopEl = el('div', 'tfs-loop', this.ruler);
    this.rangeMark = el('div', 'tfs-range-mark', this.ruler);
    this.markerStrip = el('div', 'tfs-ruler-markers', this.ruler);
    this.markerStrip.setAttribute('aria-label', this.rulerLabels.markers);
    this.barLabels = el('div', 'tfs-bar-labels', this.ruler);
    this.rows = el('div', 'tfs-rows', this.content);
    this.overlay = el('div', 'tfs-overlay', this.content);
    this.rangeEl = el('div', 'tfs-range', this.overlay);

    for (const edge of ['start', 'end']) {
      el('div', 'tfs-range-edge', this.rangeEl).dataset.rangeEdge = edge;
      el('div', 'tfs-range-grip', this.rangeMark).dataset.rangeEdge = edge;
    }

    this.snapEl = el('div', 'tfs-snap', this.overlay);
    this.playhead = el('div', 'tfs-playhead', this.overlay);
    this.snapEl.style.display = 'none';
    this.ruler.style.touchAction = 'none';
    container.append(this.root);

    this.listen();
    this.render();
  }

  // ---- state ----

  get state() {
    return this.model.state;
  }

  get history() {
    return this.model.history;
  }

  get pxPerSecond() {
    return this.pps;
  }

  get time() {
    return this.playheadTime;
  }

  get selection() {
    return [...this.selected];
  }

  get range() {
    return this.currentRange;
  }

  get loop() {
    return this.loopRange;
  }

  /** Replace the tracks and clips without an undo step. */
  load(state: TimelineState) {
    this.model.load(state);
  }

  /** Tell the timeline a source's length, and its peaks once known. */
  setSource(source: Source, peaks?: Peaks) {
    this.model.setSource(source, peaks);
  }

  setGrid(options: Partial<GridOptions> & { show?: boolean }) {
    this.grid.set(options);
    if (options.show !== undefined) this.options.showGrid = options.show;

    this.schedule();
  }

  get readonly() {
    return this.options.readonly;
  }

  setOptions(options: Partial<Pick<TimelineOptions, 'readonly' | 'follow' | 'snapToClips' | 'trackHeight' | 'resizeTracks' | 'keyboard' | 'editTracks'>>) {
    Object.assign(this.options, options);
    for (const view of this.clipViews.values()) view.invalidate();

    this.schedule();
  }

  select(ids: Iterable<string>) {
    this.selected = new Set([...ids].filter((id) => this.state.clips.some((clip) => clip.id === id)));
    this.emit('select', { clips: this.selection });
    this.schedule();
  }

  setRange(range: TimeRange | null) {
    this.currentRange = range && range.end - range.start > 1e-3 ? range : null;
    this.emit('range', { range: this.currentRange });
    this.schedule();
  }

  /** Mark the stretch that playback repeats on the ruler, or clear it with null. */
  setLoop(loop: { start: number; end: number } | null) {
    this.loopRange = loop && loop.end > loop.start ? { start: loop.start, end: loop.end } : null;
    this.schedule();
  }

  /** Move the playhead. While following, the view scrolls to keep it in sight. */
  setTime(time: number) {
    this.playheadTime = Math.max(0, time);
    this.placePlayhead();

    if (this.options.follow && !this.gesture) {
      const x = this.playheadTime * this.pps;
      const left = this.scroller.scrollLeft;
      const width = this.scroller.clientWidth - this.options.headerWidth;

      if (x < left || x > left + width - 24) this.scroller.scrollLeft = Math.max(0, x - width * 0.1);
    }
  }

  /** Zoom to a number of pixels per second, keeping `anchor` (a time) still on screen. */
  setZoom(pxPerSecond: number, anchor = this.playheadTime) {
    const next = clamp(pxPerSecond, this.options.minPxPerSecond, this.options.maxPxPerSecond);
    if (next === this.pps) return;

    const screenX = anchor * this.pps - this.scroller.scrollLeft;
    this.pps = next;
    this.render();
    this.scroller.scrollLeft = Math.max(0, anchor * next - screenX);
    this.emit('zoom', { pxPerSecond: next });
  }

  /** Zoom so every clip fits on screen. */
  fit() {
    const end = timelineEnd(this.state);
    const width = this.scroller.clientWidth - this.options.headerWidth - 24;

    if (end > 0 && width > 0) this.setZoom(width / end, 0);
    this.scroller.scrollLeft = 0;
  }

  /** The timeline time under a point on screen. */
  timeAt(clientX: number) {
    return Math.max(0, (clientX - this.ruler.getBoundingClientRect().left) / this.pps);
  }

  /** The track under a point on the page, or null below the last track or outside the lanes. */
  trackAt(clientY: number) {
    return this.state.tracks[this.laneAt(clientY)] ?? null;
  }

  /** A time rounded to the snap setting when the grid shows, otherwise as is. */
  snap(time: number) {
    return this.snapToGrid(time);
  }

  // ---- edits ----

  undo() {
    return this.history.undo();
  }

  redo() {
    return this.history.redo();
  }

  /**
   * Split the selected clips at a time, or every clip under it when none are
   * selected. Only the left pieces stay selected, so the right ones drag alone.
   */
  /**
   * Split the selected clips at a time, the playhead by default. With no clips
   * selected, a selected range is cut at both of its edges on its tracks.
   * Nothing happens when nothing is selected.
   */
  split(time = this.playheadTime) {
    const range = this.currentRange;

    if (this.selected.size) {
      const ids = this.selected;

      this.model.apply('Split', (state) => {
        const result = splitClips(state, ids, time);

        return result.created.length ? result.state : state;
      });
    } else if (range) {
      const at = (state: TimelineState, cut: number) => {
        const ids = new Set(state.clips.filter((clip) => range.tracks.includes(clip.track) && clip.start < cut && clipEnd(clip) > cut).map((clip) => clip.id));

        return ids.size ? splitClips(state, ids, cut).state : state;
      };

      this.model.apply('Split', (state) => at(at(state, range.start), range.end));
    }
  }

  /** Whether `split()` has anything to cut: selected clips or a range. */
  get canSplit() {
    return this.selected.size > 0 || !!this.currentRange;
  }

  deleteSelected() {
    if (!this.selected.size) return;

    const ids = new Set(this.selected);
    this.model.apply(ids.size > 1 ? 'Delete clips' : 'Delete clip', (state) => removeClips(state, ids));
    this.select([]);
  }

  duplicateSelected() {
    if (!this.selected.size) return;

    let created: string[] = [];
    this.model.apply('Duplicate', (state) => {
      const result = duplicateClips(state, this.selected);
      created = result.created;

      return result.state;
    });
    this.select(created);
  }

  /** Move the selected clips by a time and a number of lanes. */
  nudge(seconds: number, lanes = 0) {
    if (!this.selected.size) return;

    this.model.apply('Move', (state) => moveClips(state, this.selected, seconds, lanes));
  }

  // ---- tracks ----

  private get tracksEditable() {
    return this.options.editTracks && !this.options.readonly;
  }

  /** A new track from `createTrack`, or one named Track n. */
  private makeTrack(): Track {
    if (this.options.createTrack) return this.options.createTrack();

    const names = new Set(this.state.tracks.map((track) => track.name));
    let n = this.state.tracks.length + 1;

    while (names.has(this.trackLabels.newTrack.replace('{n}', String(n)))) n++;

    return { id: uid('t'), name: this.trackLabels.newTrack.replace('{n}', String(n)) };
  }

  /** A new instrument track of a kind, numbered after the others with its name. */
  private makeInstrumentTrack(kind: InstrumentTrackKind): Track {
    const names = new Set(this.state.tracks.map((track) => track.name));
    let n = 1;

    while (names.has(kind.name.replace('{n}', String(n)))) n++;

    return { ...this.makeTrack(), name: kind.name.replace('{n}', String(n)), instrument: { ...kind.instrument } };
  }

  /** Let people pick audio files from their device, and pass them on. */
  private pickAudioFiles(importAudio: (files: File[]) => void | Promise<unknown>) {
    const input = this.doc.createElement('input');

    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])];

      if (files.length) void Promise.resolve(importAudio(files)).catch((error: unknown) => console.error(error));
    });
    input.click();
  }

  /**
   * Add an empty note clip on an instrument track, as one undo step, and select it.
   * It starts at the bar `time` falls in and lasts `bars` bars.
   */
  addNoteClip(track: string, time: number, bars = 1) {
    const lane = this.state.tracks.find((t) => t.id === track);
    if (!lane?.instrument) return null;

    const bar = this.grid.position(time).bar;
    const start = this.grid.barTime(bar);
    const clip = makeNoteClip({ track, start, duration: this.grid.barTime(bar + bars) - start, name: lane.name });

    this.model.apply('Add note clip', (state) => addClips(state, [clip]));
    this.select([clip.id]);

    return clip;
  }

  /** Change the notes of a note clip, as one undo step. */
  setNotes(id: string, notes: Clip['notes'] & {}, label = 'Edit notes') {
    if (!this.state.clips.some((clip) => clip.id === id && clip.notes)) return;

    this.model.apply(label, (state) => replaceNotes(state, id, notes));
  }

  /** Choose a track's instrument, or its settings, as one undo step. */
  setInstrument(track: string, instrument: InstrumentChoice | undefined) {
    this.model.apply('Change instrument', (state) => updateTrack(state, track, { instrument }));
  }

  /** Add a track, at the end unless an index is given, as one undo step. Returns it. */
  addTrack(track: Track = this.makeTrack(), index = this.state.tracks.length) {
    if (this.state.tracks.some((t) => t.id === track.id)) return null;

    this.model.apply('Add track', (state) => insertTrack(state, track, index));
    this.scrollToTrack(track.id);

    return track;
  }

  /** Delete a track and its clips, as one undo step. */
  removeTrack(id: string) {
    if (!this.state.tracks.some((track) => track.id === id)) return;

    const gone = this.state.clips.filter((clip) => clip.track === id).map((clip) => clip.id);

    if (gone.some((clip) => this.selected.has(clip))) this.select(this.selection.filter((clip) => !gone.includes(clip)));
    if (this.currentRange?.tracks.includes(id)) {
      const tracks = this.currentRange.tracks.filter((track) => track !== id);

      this.setRange(tracks.length ? { ...this.currentRange, tracks } : null);
    }

    this.model.apply('Delete track', (state) => dropTrack(state, id));
  }

  renameTrack(id: string, name: string) {
    const trimmed = name.trim();
    const track = this.state.tracks.find((t) => t.id === id);
    if (!track || !trimmed || trimmed === track.name) return;

    this.model.apply('Rename track', (state) => updateTrack(state, id, { name: trimmed }));
  }

  /** Copy a track and its clips just below it. Returns the copy. */
  duplicateTrack(id: string) {
    const index = this.state.tracks.findIndex((track) => track.id === id);
    const track = this.state.tracks[index];
    if (!track) return null;

    const copy: Track = {
      ...this.makeTrack(),
      color: this.trackColor(track, index),
      height: track.height,
      automation: track.automation,
      name: `${track.name} copy`,
    };
    const clips = this.state.clips.filter((clip) => clip.track === id).map((clip) => makeClip({ ...clip, id: undefined, track: copy.id }));

    this.model.apply('Duplicate track', (state) => addClips(insertTrack(state, copy, index + 1), clips));

    return copy;
  }

  /** Move a track to another place, as one undo step. */
  moveTrack(id: string, index: number) {
    const from = this.state.tracks.findIndex((track) => track.id === id);
    if (from < 0 || from === index) return;

    this.model.apply('Move track', (state) => moveTrack(state, id, index));
  }

  /** Type a new name for a track in its header. */
  editTrackName(id: string, tries = 3) {
    const row = this.trackRows.get(id);
    const track = this.state.tracks.find((t) => t.id === id);
    if (!track || this.options.readonly) return;

    // A track that was just added gets its row on the next frame
    if (!row?.header.offsetWidth) {
      if (tries > 0) requestAnimationFrame(() => this.editTrackName(id, tries - 1));
      return;
    }

    const input = this.doc.createElement('input');
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;

      done = true;
      input.remove();
      if (save) this.renameTrack(id, input.value);
      this.root.focus({ preventScroll: true });
    };

    input.className = 'tfs-rename';
    input.value = track.name;
    input.setAttribute('aria-label', this.trackLabels.rename);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    row.header.append(input);
    input.focus();
    input.select();
  }

  /** Open a track's menu at a point on the page, or under its header. */
  /** Add items of your own to every track menu, above Delete. Returns a function that takes them out. */
  addTrackMenuItems(items: (track: Track) => MenuItem[]) {
    this.trackMenuExtras.add(items);

    return () => void this.trackMenuExtras.delete(items);
  }

  showTrackMenu(id: string, at?: { x: number; y: number }) {
    const index = this.state.tracks.findIndex((track) => track.id === id);
    const row = this.trackRows.get(id);
    if (index < 0 || !row || !this.tracksEditable) return;

    const box = row.header.getBoundingClientRect();
    const labels = this.trackLabels;
    const last = this.state.tracks.length - 1;

    openMenu(
      this.doc,
      at ?? { x: box.left + 8, y: box.top + 24 },
      [
        { label: labels.rename, onSelect: () => this.editTrackName(id) },
        { label: labels.duplicate, onSelect: () => this.duplicateTrack(id) },
        {
          label: labels.addBelow,
          onSelect: () => {
            const track = this.addTrack(undefined, index + 1);

            if (track) this.editTrackName(track.id);
          },
        },
        { label: labels.moveUp, disabled: index === 0, onSelect: () => this.moveTrack(id, index - 1) },
        { label: labels.moveDown, disabled: index === last, onSelect: () => this.moveTrack(id, index + 1) },
        ...this.automationItems(id),
        ...[...this.trackMenuExtras].flatMap((items) => items(this.state.tracks[index]!)),
        { label: labels.delete, danger: true, onSelect: () => this.removeTrack(id) },
      ],
      `${labels.menu}: ${this.state.tracks[index]!.name}`,
    );
  }

  // ---- markers and tempo ----

  get markers(): readonly Marker[] {
    return this.state.markers ?? [];
  }

  /** Add a marker, at the playhead (on the grid) unless a time is given, as one undo step. Returns it. */
  addMarker(time = this.snapToGrid(this.playheadTime), name?: string) {
    const names = new Set(this.markers.map((marker) => marker.name));
    let n = this.markers.length + 1;

    while (!name && names.has(this.rulerLabels.newMarker.replace('{n}', String(n)))) n++;

    const marker: Marker = { id: uid('m'), time: Math.max(0, time), name: name ?? this.rulerLabels.newMarker.replace('{n}', String(n)) };

    this.model.apply('Add marker', (state) => writeMarker(state, marker));

    return marker;
  }

  /** Change a marker's name, time or colour, as one undo step. */
  updateMarker(id: string, patch: Partial<Omit<Marker, 'id'>>) {
    const marker = this.markers.find((m) => m.id === id);
    if (!marker) return;

    const label = patch.name !== undefined ? 'Rename marker' : 'Move marker';

    this.model.apply(label, (state) => writeMarker(state, { ...marker, ...patch, name: patch.name?.trim() || marker.name }));
  }

  removeMarker(id: string) {
    if (!this.markers.some((marker) => marker.id === id)) return;

    this.model.apply('Delete marker', (state) => dropMarker(state, id));
  }

  /** Type a new name for a marker in its flag. */
  editMarkerName(id: string, tries = 3) {
    const marker = this.markers.find((m) => m.id === id);
    const flag = this.markerStrip.querySelector<HTMLElement>(`[data-marker="${id}"]`);
    if (!marker || this.options.readonly) return;

    if (!flag) {
      if (tries > 0) requestAnimationFrame(() => this.editMarkerName(id, tries - 1));
      return;
    }

    this.inlineInput(flag, marker.time, marker.name, this.rulerLabels.rename, (value) => this.updateMarker(id, { name: value }));
  }

  /** Add a tempo change, at the bar after the playhead unless a time is given, as one undo step. Returns it. */
  addTempoChange(time?: number, bpm?: number, meter?: [number, number]) {
    const at = time ?? this.grid.barTime(this.grid.position(this.playheadTime).bar + 1);
    const section = this.grid.sectionAt(at);
    const change: TempoChange = { id: uid('tc'), time: at, bpm: bpm ?? section.bpm, ...(meter && { meter }) };

    if (at <= 1e-6) return null;

    this.model.apply('Add tempo change', (state) => writeTempoChange(state, change));

    return change;
  }

  /** Change a tempo change's time, tempo or meter, as one undo step. */
  updateTempoChange(id: string, patch: Partial<Omit<TempoChange, 'id'>>) {
    const change = this.grid.tempo.find((c) => c.id === id);
    if (!change) return;

    const label = patch.time !== undefined ? 'Move tempo change' : 'Change tempo';

    this.model.apply(label, (state) => writeTempoChange(state, { ...change, ...patch, bpm: Math.min(999, Math.max(20, patch.bpm ?? change.bpm)) }));
  }

  removeTempoChange(id: string) {
    if (!this.grid.tempo.some((change) => change.id === id)) return;

    this.model.apply('Delete tempo change', (state) => dropTempoChange(state, id));
  }

  /** Type a new tempo into a tempo change. */
  editTempo(id: string, tries = 3) {
    const change = this.grid.tempo.find((c) => c.id === id);
    const flag = this.ruler.querySelector<HTMLElement>(`[data-tempo="${id}"]`);
    if (!change || this.options.readonly) return;

    if (!flag) {
      if (tries > 0) requestAnimationFrame(() => this.editTempo(id, tries - 1));
      return;
    }

    const save = (value: string) => {
      const bpm = Math.round(Number(value));

      if (bpm >= 20 && bpm <= 999) this.updateTempoChange(id, { bpm });
    };

    this.inlineInput(flag, change.time, String(change.bpm), this.rulerLabels.setTempo, save, 'number');
  }

  private showMarkerMenu(id: string, at: { x: number; y: number }) {
    const marker = this.markers.find((m) => m.id === id);
    if (!marker || this.options.readonly) return;

    openMenu(
      this.doc,
      at,
      [
        { label: this.rulerLabels.rename, onSelect: () => this.editMarkerName(id) },
        { label: this.rulerLabels.deleteMarker, danger: true, onSelect: () => this.removeMarker(id) },
      ],
      marker.name,
    );
  }

  /** Add a marker or a tempo change where the ruler was right-clicked. */
  private showRulerMenu(time: number, at: { x: number; y: number }) {
    const { markers, tempoTrack, showGrid } = this.options;
    const items = [
      ...(markers ? [{ label: this.rulerLabels.addMarker, onSelect: () => this.editMarkerName(this.addMarker(this.snapToGrid(time)).id) }] : []),
      ...(tempoTrack && showGrid ? [{ label: this.rulerLabels.addTempo, onSelect: () => this.addTempoChange(this.nearestBar(time, '')) }] : []),
    ];

    if (items.length) openMenu(this.doc, at, items);
  }

  private showTempoMenu(id: string, at: { x: number; y: number }) {
    const change = this.grid.tempo.find((c) => c.id === id);
    if (!change || this.options.readonly) return;

    const meter = this.grid.sectionAt(change.time).meter.join('/');

    openMenu(
      this.doc,
      at,
      [
        { label: this.rulerLabels.setTempo, onSelect: () => this.editTempo(id) },
        ...METERS.map((m) => ({ label: m.join('/'), disabled: m.join('/') === meter, onSelect: () => this.updateTempoChange(id, { meter: m }) })),
        { label: this.rulerLabels.deleteTempo, danger: true, onSelect: () => this.removeTempoChange(id) },
      ],
      `${this.rulerLabels.tempo} ${change.bpm}`,
    );
  }

  /**
   * An input over a marker or tempo flag that saves on Enter or leaving it, and
   * cancels on Escape. It sits in the ruler's row, which keeps it while the ruler redraws.
   */
  private inlineInput(flag: HTMLElement, time: number, value: string, label: string, save: (value: string) => void, type = 'text') {
    const input = this.doc.createElement('input');
    const parent = this.ruler.parentElement!;
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;

      done = true;
      input.remove();
      if (keep) save(input.value);
      this.root.focus({ preventScroll: true });
    };

    input.className = 'tfs-inline-edit';
    input.type = type;
    input.style.left = `${this.ruler.offsetLeft + time * this.pps}px`;
    input.style.top = `${flag.getBoundingClientRect().top - parent.getBoundingClientRect().top}px`;
    input.value = value;
    input.setAttribute('aria-label', label);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    parent.append(input);
    input.focus();
    input.select();
  }

  /** A time on the grid when it shows, otherwise as is. */
  private snapToGrid(time: number) {
    return this.options.showGrid ? this.grid.round(time) : time;
  }

  /** The nearest bar line to a time, leaving one tempo change out of the grid. */
  private nearestBar(time: number, without: string) {
    const grid = new Grid({ bpm: this.grid.bpm, meter: this.grid.meter, snap: 'bar' });

    grid.setTempo(this.grid.tempo.filter((change) => change.id !== without));

    return grid.round(time);
  }

  // ---- automation ----

  /** The automation lane shown under a track, if any. */
  automationView(track: string) {
    return this.automationShown.get(track) ?? null;
  }

  /** Show a track's volume or pan automation in a lane under it, or hide the lane with null. */
  showAutomation(track: string, param: AutomationParam | null) {
    if (!this.state.tracks.some((t) => t.id === track) || this.automationView(track) === param) return;

    if (param) this.automationShown.set(track, param);
    else this.automationShown.delete(track);

    this.emit('automation', { track, param });
    this.schedule();
  }

  /** Replace a track's points for a setting, as one undo step. An empty list clears it. */
  setAutomation(track: string, param: AutomationParam, points: readonly AutomationPoint[]) {
    this.model.apply(points.length ? 'Automation' : 'Clear automation', (state) => writeAutomation(state, track, param, points));
  }

  /** Remove one point, as one undo step. */
  removeAutomationPoint(track: string, param: AutomationParam, index: number) {
    const points = automationOf(this.state.tracks.find((t) => t.id === track), param);
    if (!points[index]) return;

    this.model.apply('Delete point', (state) => writeAutomation(state, track, param, points.filter((_, i) => i !== index)));
  }

  private automationItems(id: string) {
    const labels = this.trackLabels;
    const shown = this.automationView(id);
    const items = [];

    if (shown !== 'volume') items.push({ label: labels.showVolume, onSelect: () => this.showAutomation(id, 'volume') });
    if (shown !== 'pan') items.push({ label: labels.showPan, onSelect: () => this.showAutomation(id, 'pan') });
    if (shown) items.push({ label: labels.hideAutomation, onSelect: () => this.showAutomation(id, null) });

    return items;
  }

  /** The menu of an automation lane's name: switch setting, clear or hide. */
  private showAutomationMenu(id: string, at: { x: number; y: number }) {
    const param = this.automationView(id);
    const track = this.state.tracks.find((t) => t.id === id);
    if (!param || !track) return;

    const labels = this.trackLabels;
    const editable = !this.options.readonly;

    openMenu(
      this.doc,
      at,
      [
        { label: labels.volume, disabled: param === 'volume', onSelect: () => this.showAutomation(id, 'volume') },
        { label: labels.pan, disabled: param === 'pan', onSelect: () => this.showAutomation(id, 'pan') },
        { label: labels.clearAutomation, danger: true, disabled: !editable || !automationOf(track, param).length, onSelect: () => this.setAutomation(id, param, []) },
        { label: labels.hideAutomation, onSelect: () => this.showAutomation(id, null) },
      ],
      `${labels[param]}: ${track.name}`,
    );
  }

  /** Scroll the timeline, not the page, so a track's row is in view. */
  private scrollToTrack(id: string) {
    requestAnimationFrame(() => {
      const row = this.trackRows.get(id)?.row;
      if (!row) return;

      const view = this.scroller.getBoundingClientRect();
      const box = row.getBoundingClientRect();

      if (box.bottom > view.bottom) this.scroller.scrollTop += box.bottom - view.bottom;
      else if (box.top < view.top + this.rows.offsetTop) this.scroller.scrollTop -= view.top + this.rows.offsetTop - box.top;
    });
  }

  destroy() {
    closeMenu();
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    for (const off of this.unsubscribe) off();
    for (const row of this.trackRows.values()) row.cleanup?.();

    this.root.remove();
    this.removeAllListeners();
  }

  // ---- rendering ----

  private schedule() {
    if (this.frame) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render() {
    const { headerWidth } = this.options;
    const state = this.state;
    const viewport = Math.max(0, this.scroller.clientWidth - headerWidth);
    const width = Math.max(viewport, (timelineEnd(state) + 30) * this.pps, (this.playheadTime + 5) * this.pps);

    this.root.classList.toggle('tfs--grid', this.options.showGrid);
    this.root.classList.toggle('tfs--readonly', this.options.readonly);
    this.root.style.setProperty('--tfs-beat-px', `${this.grid.beat * this.pps}px`);
    this.root.style.setProperty('--tfs-bar-px', `${this.grid.bar * this.pps}px`);
    this.content.style.width = `${headerWidth + width}px`;
    this.corner.style.width = `${headerWidth}px`;
    this.addButton.hidden = !this.tracksEditable;
    this.ruler.style.width = `${width}px`;
    this.overlay.style.left = `${headerWidth}px`;
    this.overlay.style.width = `${width}px`;

    this.renderMarkers(state);
    this.renderTracks(state, width);
    this.renderClips(state);
    this.renderRuler();
    this.renderRange();
    this.renderLoop();
    this.placePlayhead();
    this.paint();
  }

  /** Marker flags along the top of the ruler. */
  private renderMarkers(state: TimelineState) {
    const show = this.options.markers;

    this.root.classList.toggle('tfs--markers', show);
    this.markerStrip.hidden = !show;
    this.markerStrip.replaceChildren(
      ...(show ? (state.markers ?? []) : []).map((marker) => {
        const node = this.flag('tfs-marker', marker.time, marker.name);

        node.dataset.marker = marker.id;

        return node;
      }),
    );
  }

  /** A marker or tempo flag in the ruler. */
  private flag(className: string, time: number | null, text: string, title = text) {
    const node = this.doc.createElement('div');
    const label = this.doc.createElement('span');

    node.className = className;
    if (time !== null) node.style.left = `${time * this.pps}px`;
    node.title = title;
    label.textContent = text;
    node.append(label);

    return node;
  }

  /** Bar and beat lines for each tempo section, drawn in a lane. */
  private renderGridLines(lane: HTMLElement, width: number) {
    let layer = lane.querySelector<HTMLDivElement>(':scope > .tfs-lane-grid');

    if (!this.options.showGrid) {
      layer?.remove();
      return;
    }

    const key = `${this.pps}|${width}|${this.grid.sections.map((s) => `${s.start},${s.bar},${s.beat}`).join(';')}`;

    if (!layer) {
      layer = this.doc.createElement('div');
      layer.className = 'tfs-lane-grid';
      lane.prepend(layer);
    }

    if (layer.dataset.key === key) return;

    layer.dataset.key = key;
    layer.replaceChildren(
      ...this.grid.sections
        .filter((section) => section.start * this.pps < width)
        .map((section) => {
          const part = this.doc.createElement('div');
          const end = Math.min(section.end * this.pps, width);

          part.className = 'tfs-grid-section';
          part.style.left = `${section.start * this.pps}px`;
          part.style.width = `${end - section.start * this.pps}px`;
          part.style.setProperty('--tfs-bar-px', `${section.bar * this.pps}px`);
          part.style.setProperty('--tfs-beat-px', `${section.beat * this.pps}px`);

          return part;
        }),
    );
  }

  private renderTracks(state: TimelineState, width: number) {
    const { headerWidth } = this.options;
    const resizable = this.options.resizeTracks && !this.options.readonly;
    const seen = new Set<string>();

    state.tracks.forEach((track, index) => {
      seen.add(track.id);
      let row = this.trackRows.get(track.id);

      if (!row) {
        const rowEl = this.doc.createElement('div');
        const header = this.doc.createElement('div');
        const lane = this.doc.createElement('div');

        const grip = this.doc.createElement('div');
        const autoHead = this.doc.createElement('div');
        const autoLane = this.doc.createElement('div');

        rowEl.className = 'tfs-row';
        header.className = 'tfs-header';
        lane.className = 'tfs-lane';
        lane.dataset.track = track.id;
        grip.className = 'tfs-row-resize';
        grip.dataset.track = track.id;
        autoHead.className = 'tfs-auto-head';
        autoLane.className = 'tfs-auto-lane';
        autoLane.dataset.track = track.id;
        rowEl.append(header, lane, autoHead, autoLane, grip);
        row = { row: rowEl, header, lane, grip, autoHead, autoLane };
        this.trackRows.set(track.id, row);
        this.fillHeader(track, row);
      } else if (row.header.dataset.name !== track.name || row.header.dataset.color !== this.trackColor(track, index)) {
        row.cleanup?.();
        this.fillHeader(track, row);
      }

      const param = this.automationView(track.id);

      row.row.style.height = `${this.rowHeight(track)}px`;
      row.row.style.gridTemplateRows = param ? `minmax(0, 1fr) ${this.options.automationHeight}px` : 'minmax(0, 1fr)';
      row.autoHead.style.display = param && headerWidth ? '' : 'none';
      row.autoLane.style.display = param ? '' : 'none';
      row.autoHead.style.width = `${headerWidth}px`;
      row.autoLane.style.width = `${width}px`;
      if (param) {
        this.renderAutomation(track, param, row, width);
        this.renderGridLines(row.autoLane, width);
      }
      row.grip.style.display = resizable ? '' : 'none';
      row.row.style.boxSizing = 'border-box';
      row.row.style.setProperty('--clip', this.trackColor(track, index));
      row.header.style.width = `${headerWidth}px`;
      row.header.style.display = headerWidth ? '' : 'none';
      row.lane.style.width = `${width}px`;
      this.renderGridLines(row.lane, width);
      row.row.classList.toggle('tfs-row--new', this.gesture?.kind === 'move' && this.gesture.track?.id === track.id);

      if (this.rows.children[index] !== row.row) this.rows.insertBefore(row.row, this.rows.children[index] ?? null);
    });

    for (const [id, row] of this.trackRows) {
      if (seen.has(id)) continue;

      row.cleanup?.();
      row.row.remove();
      this.trackRows.delete(id);
    }

    for (const id of this.automationShown.keys()) if (!seen.has(id)) this.automationShown.delete(id);
  }

  /** Draw a track's automation line and points, with the setting's name and value at the playhead. */
  private renderAutomation(track: Track, param: AutomationParam, row: Row, width: number) {
    const height = this.options.automationHeight;
    const range = AUTOMATION_RANGES[param];
    const points = automationOf(track, param);
    const y = (value: number) => AUTO_PAD + (1 - range.toLevel(value)) * (height - AUTO_PAD * 2);
    const svg = this.doc.createElementNS(SVG, 'svg');
    const line = this.doc.createElementNS(SVG, 'polyline');
    const coords = [`0,${y(automationAt(points, 0, range.neutral))}`, ...points.map((p) => `${p.time * this.pps},${y(p.value)}`)];

    coords.push(`${width},${y(automationAt(points, Infinity, range.neutral))}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    line.setAttribute('points', coords.join(' '));
    line.setAttribute('class', points.length ? 'tfs-auto-line' : 'tfs-auto-line tfs-auto-line--flat');
    svg.append(line);

    points.forEach((point, index) => {
      const dot = this.doc.createElementNS(SVG, 'circle');

      dot.setAttribute('cx', String(point.time * this.pps));
      dot.setAttribute('cy', String(y(point.value)));
      dot.setAttribute('r', '4');
      dot.setAttribute('class', 'tfs-auto-point');
      dot.dataset.point = String(index);
      svg.append(dot);
    });

    row.autoLane.replaceChildren(svg);

    const name = this.doc.createElement('button');
    const value = this.doc.createElement('span');

    name.type = 'button';
    name.className = 'tfs-auto-name';
    name.textContent = this.trackLabels[param];
    name.title = this.trackLabels[param];
    value.className = 'tfs-auto-value';
    value.textContent = formatValue(param, automationAt(points, this.playheadTime, range.neutral));
    row.autoHead.replaceChildren(name, value);
  }

  /** The automation value under a point in a track's automation lane. */
  private automationValueAt(row: Row, param: AutomationParam, clientY: number) {
    const box = row.autoLane.getBoundingClientRect();
    const level = 1 - (clientY - box.top - AUTO_PAD) / (box.height - AUTO_PAD * 2);

    return AUTOMATION_RANGES[param].fromLevel(level);
  }

  private fillHeader(track: Track, row: { header: HTMLDivElement; cleanup?: () => void }) {
    const index = this.state.tracks.indexOf(track);

    row.header.replaceChildren();
    row.header.dataset.name = track.name;
    row.header.dataset.color = this.trackColor(track, index);

    if (this.options.renderHeader) {
      row.cleanup = this.options.renderHeader(track, row.header) || undefined;

      return;
    }

    const cell = this.doc.createElement('div');
    const swatch = this.doc.createElement('i');
    const name = this.doc.createElement('span');

    cell.className = 'tfs-header-default';
    name.textContent = track.name;
    name.className = 'tfs-track-name';
    name.addEventListener('click', () => name.dispatchEvent(new CustomEvent(TRACK_MENU_EVENT, { bubbles: true })));
    cell.append(swatch, name);
    row.header.append(cell);
    row.cleanup = undefined;
  }

  /** Height in pixels of a track's clip lane. */
  heightOf(track: Track) {
    return clamp(Math.round(track.height ?? this.options.trackHeight), this.options.minTrackHeight, this.options.maxTrackHeight);
  }

  /** Height of a track's whole row: its clip lane and any automation lane. */
  private rowHeight(track: Track) {
    return this.heightOf(track) + (this.automationShown.has(track.id) ? this.options.automationHeight : 0);
  }

  /** Top of a lane, in pixels below the ruler. */
  private laneTop(index: number) {
    let top = 0;

    for (let i = 0; i < index && i < this.state.tracks.length; i++) top += this.rowHeight(this.state.tracks[i]!);

    return top;
  }

  /** A track's colour: its own, or one from the palette by its place. */
  colorOf(track: Track) {
    return this.trackColor(track, this.state.tracks.indexOf(track));
  }

  private trackColor(track: Track, index: number) {
    return track.color ?? this.options.palette[Math.max(0, index) % this.options.palette.length]!;
  }

  private renderClips(state: TimelineState) {
    const seen = new Set<string>();
    const colors = new Map(state.tracks.map((track, index) => [track.id, this.trackColor(track, index)]));

    for (const track of state.tracks) {
      const lane = this.trackRows.get(track.id)!.lane;
      const stack = stackOrder(state.clips.filter((clip) => clip.track === track.id));

      stack.forEach((clip, z) => {
        seen.add(clip.id);
        let view = this.clipViews.get(clip.id);

        if (!view) {
          view = new ClipView(clip, this.doc);
          this.clipViews.set(clip.id, view);
        }

        if (view.el.parentElement !== lane) lane.append(view.el);

        view.layout(clip, this.pps, z + 1, this.selected.has(clip.id), clip.color ?? colors.get(track.id)!);
        view.el.classList.toggle('tfs-clip--dragging', this.gesture?.kind === 'move' && this.gesture.started && this.gesture.ids.has(clip.id));
      });
    }

    for (const [id, view] of this.clipViews) {
      if (seen.has(id)) continue;

      view.el.remove();
      this.clipViews.delete(id);
    }

    for (const id of this.selected) if (!seen.has(id)) this.selected.delete(id);
  }

  /** Draw waveforms for what is on screen. */
  private paint() {
    const left = this.scroller.scrollLeft;
    const right = left + this.scroller.clientWidth;
    const ratio = this.doc.defaultView?.devicePixelRatio || 1;

    for (const view of this.clipViews.values()) {
      const x = view.clip.start * this.pps;
      const peaks = this.model.peaks.get(view.clip.source);

      if (x + view.clip.duration * this.pps < left - this.scroller.clientWidth || x > right + this.scroller.clientWidth) continue;

      view.paint(left - x, right - x, this.pps, peaks, ratio);
    }

    this.renderRuler();
  }

  private renderRuler() {
    const left = this.scroller.scrollLeft;
    const span = this.scroller.clientWidth;
    const from = Math.max(0, (left - span) / this.pps);
    const to = (left + span * 2) / this.pps;
    const labels: HTMLElement[] = [];

    const add = (time: number, text: string) => {
      const label = this.doc.createElement('span');
      label.className = 'tfs-ruler-label';
      label.style.left = `${time * this.pps}px`;
      label.textContent = text;
      labels.push(label);

      return label;
    };
    const sections = this.grid.sections;

    if (this.options.showGrid) {
      let free = -Infinity;

      // Leave out bars that would crowd the one before, but never the first bar of a tempo section
      // Counted from the start, so the same bars keep their labels while scrolling
      for (const { time, bar } of this.grid.bars(0, to)) {
        const x = time * this.pps;
        const index = sections.findIndex((section) => Math.abs(section.start - time) < 1e-6);

        if (x < free && index < 0) continue;

        const label = time >= from ? add(time, String(bar)) : null;
        const tempo = index >= 0 && this.options.tempoTrack ? this.tempoFlag(index) : null;

        if (label && tempo) label.append(tempo);
        // Room for the bar number, and a tempo flag's text at about 6.5px a character
        free = x + Math.max(48, tempo ? 40 + tempo.textContent!.length * 6.5 : 0);
      }
    } else {
      const step = LABELS.find((s) => s * this.pps >= 70) ?? 600;
      for (let time = Math.floor(from / step) * step; time < to; time += step) add(time, formatTime(time, step));
    }

    this.barLabels.replaceChildren(...labels);
  }

  /** The tempo, and the meter where it changes, beside the bar number a tempo section starts on. */
  private tempoFlag(index: number) {
    const sections = this.grid.sections;
    const section = sections[index]!;
    const meterChanged = index === 0 || section.meter.join('/') !== sections[index - 1]!.meter.join('/');
    const text = `${section.bpm}${meterChanged ? ` · ${section.meter.join('/')}` : ''}`;
    const change = index ? this.grid.tempo.find((c) => Math.abs(c.time - section.start) < 1e-6) : undefined;
    const node = this.flag('tfs-tempo', null, text, index ? `${this.rulerLabels.tempo} ${text}` : this.rulerLabels.startTempo);

    node.dataset.tempo = change?.id ?? '';
    if (!index) node.classList.add('tfs-tempo--start');

    return node;
  }

  private renderRange() {
    const range = this.currentRange;
    const style = this.rangeEl.style;
    const mark = this.rangeMark.style;

    this.rangeEl.classList.remove('tfs-range--box');

    if (!range) {
      style.display = 'none';
      mark.display = 'none';

      return;
    }

    mark.display = 'block';
    mark.left = `${range.start * this.pps}px`;
    mark.width = `${(range.end - range.start) * this.pps}px`;

    const lanes = range.tracks.map((id) => this.state.tracks.findIndex((track) => track.id === id)).filter((i) => i >= 0);
    const ruler = this.rows.offsetTop;
    const first = lanes.length ? Math.min(...lanes) : 0;
    const last = lanes.length ? Math.max(...lanes) : this.state.tracks.length - 1;

    style.display = '';
    style.left = `${range.start * this.pps}px`;
    style.width = `${(range.end - range.start) * this.pps}px`;
    const top = this.laneTop(first);

    style.top = `${ruler + top}px`;
    style.height = `${this.laneTop(last + 1) - top}px`;
  }

  private renderLoop() {
    const loop = this.loopRange;
    const style = this.loopEl.style;

    style.display = loop ? '' : 'none';
    if (!loop) return;

    style.left = `${loop.start * this.pps}px`;
    style.width = `${(loop.end - loop.start) * this.pps}px`;
  }

  private placePlayhead() {
    this.playhead.style.transform = `translateX(${this.playheadTime * this.pps}px)`;

    for (const [id, param] of this.automationShown) {
      const readout = this.trackRows.get(id)?.autoHead.querySelector('.tfs-auto-value');
      const track = this.state.tracks.find((t) => t.id === id);

      if (readout && track && this.gesture?.kind !== 'point') {
        readout.textContent = formatValue(param, automationAt(automationOf(track, param), this.playheadTime, AUTOMATION_RANGES[param].neutral));
      }
    }
  }

  // ---- input ----

  private listen() {
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.unsubscribe.push(() => target.removeEventListener(type, fn, opts));
    };

    this.unsubscribe.push(
      this.model.on('change', (event) => {
        this.grid.setTempo(event.state.tempo);
        this.schedule();
        this.emit('change', event);
      }),
      this.model.on('source', ({ id }) => {
        for (const view of this.clipViews.values()) if (view.clip.source === id) view.invalidate();

        this.schedule();
      }),
    );

    on(this.scroller, 'scroll', () => this.paint(), { passive: true });
    on(this.content, 'pointerdown', (e) => this.onPointerDown(e));
    on(this.content, 'pointermove', (e) => this.onPointerMove(e));
    on(this.content, 'pointerup', (e) => this.onPointerUp(e));
    on(this.content, 'pointercancel', () => this.cancelGesture());
    on(this.root, 'keydown', (e) => this.onKey(e));
    on(this.rows, 'contextmenu', (e) => {
      const id = this.headerTrack(e.target);
      if (!id || !this.tracksEditable) return;

      e.preventDefault();
      this.showTrackMenu(id, { x: e.clientX, y: e.clientY });
    });
    const onMenuEvent = (e: Event) => {
      const id = this.headerTrack(e.target);
      const box = (e.target as HTMLElement).getBoundingClientRect();

      if (id) this.showTrackMenu(id, { x: box.left, y: box.bottom + 2 });
    };

    this.rows.addEventListener(TRACK_MENU_EVENT, onMenuEvent);
    this.unsubscribe.push(() => this.rows.removeEventListener(TRACK_MENU_EVENT, onMenuEvent));
    on(this.ruler, 'contextmenu', (e) => {
      const target = e.target as HTMLElement;
      const marker = target.closest<HTMLElement>('[data-marker]')?.dataset.marker;
      const tempo = target.closest<HTMLElement>('[data-tempo]')?.dataset.tempo;

      if (this.options.readonly) return;

      e.preventDefault();
      if (marker) this.showMarkerMenu(marker, { x: e.clientX, y: e.clientY });
      else if (tempo) this.showTempoMenu(tempo, { x: e.clientX, y: e.clientY });
      else this.showRulerMenu(this.timeAt(e.clientX), { x: e.clientX, y: e.clientY });
    });
    on(this.rows, 'click', (e) => {
      const name = (e.target as HTMLElement).closest<HTMLElement>('.tfs-auto-name');
      const id = name && [...this.trackRows].find(([, row]) => row.autoHead.contains(name))?.[0];

      if (!id) return;

      const box = name.getBoundingClientRect();

      this.showAutomationMenu(id, { x: box.left, y: box.bottom + 2 });
    });
    on(this.rows, 'dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('.tfs-track-name')) return;

      const id = this.headerTrack(e.target);

      if (id && this.tracksEditable) {
        closeMenu();
        this.editTrackName(id);
      }
    });
    // A clip opens; an empty spot on an instrument track's lane gets a note clip. Found by
    // position, since a drag's pointer capture can move the event's target off the lane.
    on(this.root, 'dblclick', (e) => {
      if ((e.target as HTMLElement).closest('.tfs-header, .tfs-ruler-row')) return;
      if (e.clientX < this.ruler.getBoundingClientRect().left) return;

      const track = this.trackAt(e.clientY);
      const time = this.timeAt(e.clientX);
      const clip = track && [...this.state.clips].reverse().find((c) => c.track === track.id && time >= c.start && time < clipEnd(c));

      if (clip) this.emit('open', { clip: clip.id });
      else if (track?.instrument && !this.options.readonly) this.addNoteClip(track.id, time);
    });
    on(this.scroller, 'wheel', (e) => this.onWheel(e), { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      this.resize = new ResizeObserver(() => this.schedule());
      this.resize.observe(this.root);
    }
  }

  /** The track whose header holds an element. */
  private headerTrack(target: EventTarget | null) {
    const header = (target as HTMLElement | null)?.closest?.('.tfs-header');

    for (const [id, row] of this.trackRows) if (row.header === header) return id;

    return null;
  }

  /** The lane under a point. Above the first it is -1; below the last it counts on in default-height rows. */
  private laneAt(clientY: number) {
    const y = clientY - this.rows.getBoundingClientRect().top;
    if (y < 0) return Math.floor(y / this.options.trackHeight);

    let top = 0;

    for (const [index, track] of this.state.tracks.entries()) {
      top += this.rowHeight(track);
      if (y < top) return index;
    }

    return this.state.tracks.length + Math.floor((y - top) / this.options.trackHeight);
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || this.gesture) return;

    const target = e.target as HTMLElement;
    const grip = target.closest<HTMLElement>('.tfs-row-resize');
    const resizing = grip ? this.state.tracks.find((track) => track.id === grip.dataset.track) : undefined;

    if (resizing) {
      e.preventDefault();

      const last = this.lastGrip;

      this.lastGrip = { track: resizing.id, at: e.timeStamp };

      // A double click gives the row the default height again.
      if (last && last.track === resizing.id && e.timeStamp - last.at < 400) {
        this.lastGrip = null;
        if (resizing.height !== undefined) this.model.apply('Resize track', (state) => updateTrack(state, resizing.id, { height: undefined }));

        return;
      }

      this.gesture = { kind: 'resize-track', id: e.pointerId, x: e.clientX, y: e.clientY, started: false, track: resizing, height: this.heightOf(resizing) };
      this.content.setPointerCapture?.(e.pointerId);

      return;
    }

    const edge = target.closest<HTMLElement>('[data-range-edge]')?.dataset.rangeEdge as 'start' | 'end' | undefined;

    if (edge && this.currentRange && !this.options.readonly) {
      e.preventDefault();
      this.gesture = { kind: 'range-edge', id: e.pointerId, x: e.clientX, y: e.clientY, started: false, edge, range: this.currentRange };
      this.content.setPointerCapture?.(e.pointerId);

      return;
    }

    if (target.closest('.tfs-ruler [data-marker], .tfs-ruler [data-tempo]')) {
      this.flagPointerDown(e, target);

      return;
    }

    // A double click on the marker strip adds a marker there
    if (target === this.markerStrip && !this.options.readonly) {
      const last = this.lastStripPress;

      this.lastStripPress = e.timeStamp;
      if (e.timeStamp - last < 400) {
        e.preventDefault();
        this.lastStripPress = 0;
        this.editMarkerName(this.addMarker(this.snapToGrid(this.timeAt(e.clientX))).id);

        return;
      }
    }

    if (target.closest('.tfs-header, .tfs-corner, .tfs-auto-head')) return;

    const autoLane = target.closest<HTMLElement>('.tfs-auto-lane');

    if (autoLane) {
      this.startPoint(e, autoLane.dataset.track!, target.dataset.point);

      return;
    }

    const clipEl = target.closest<HTMLElement>('.tfs-clip');
    const clip = clipEl ? this.state.clips.find((c) => c.id === clipEl.dataset.clip) : undefined;
    const part = target.dataset.part;
    const touch = e.pointerType === 'touch';

    e.preventDefault();
    this.root.focus({ preventScroll: true });

    if (clip && this.options.readonly) {
      this.gesture = { kind: 'click-clip', id: e.pointerId, x: e.clientX, y: e.clientY, clip };
    } else if (clip && part && part !== 'body') {
      this.gesture = { kind: part as 'trim-start', id: e.pointerId, x: e.clientX, started: false, clip };
      this.select([clip.id]);
    } else if (clip) {
      const toggle = e.ctrlKey || e.metaKey;

      if (toggle || e.shiftKey) {
        const next = new Set(this.selected);

        if (toggle && next.has(clip.id)) next.delete(clip.id);
        else next.add(clip.id);

        this.select(next);
      } else if (!this.selected.has(clip.id)) {
        this.select([clip.id]);
      }

      if (!this.selected.has(clip.id)) return;

      this.gesture = {
        kind: 'move',
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        started: false,
        clip,
        ids: new Set(this.selected),
        lane: this.laneAt(e.clientY),
        base: this.state,
      };
    } else if (target.closest('.tfs-lane, .tfs-ruler')) {
      this.gesture = {
        kind: 'range',
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        started: false,
        time: this.timeAt(e.clientX),
        lane: this.laneAt(e.clientY),
        additive: e.shiftKey,
        ruler: !!target.closest('.tfs-ruler'),
        touch: touch && !target.closest('.tfs-ruler'),
      };
    } else {
      return;
    }

    if (!touch || this.gesture.kind !== 'range' || !this.gesture.touch) this.content.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerEvent) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId || g.kind === 'click-clip') return;

    if (!g.started) {
      if (Math.abs(e.clientX - g.x) < 3 && Math.abs(e.clientY - ('y' in g ? g.y : e.clientY)) < 3) return;
      if (g.kind === 'range' && g.touch) return;

      g.started = true;
    }

    if (g.kind === 'point') {
      this.dragPoint(g, e);

      return;
    }

    if (g.kind === 'marker') {
      const time = e.altKey ? this.timeAt(e.clientX) : this.snapToGrid(this.timeAt(e.clientX));

      this.autoScroll(e.clientX);
      this.model.draft('Move marker', (state) => writeMarker(state, { ...g.marker, time }));

      return;
    }

    if (g.kind === 'tempo') {
      const time = Math.max(1e-3, this.nearestBar(this.timeAt(e.clientX), g.change.id));

      this.autoScroll(e.clientX);
      this.model.draft('Move tempo change', (state) => writeTempoChange(state, { ...g.change, time }));

      return;
    }

    if (g.kind === 'resize-track') {
      const height = clamp(Math.round(g.height + e.clientY - g.y), this.options.minTrackHeight, this.options.maxTrackHeight);

      this.model.draft('Resize track', (state) => updateTrack(state, g.track.id, { height }));

      return;
    }

    this.autoScroll(e.clientX);

    const time = this.timeAt(e.clientX);
    const free = e.altKey;

    switch (g.kind) {
      case 'move':
        this.dragMove(g, e, free);
        break;
      case 'trim-start': {
        const snapped = this.snapTime(time, new Set([g.clip.id]), free);
        this.model.draft('Trim', (state) => trimStart(state, this.model.sources, g.clip.id, snapped));
        break;
      }
      case 'trim-end': {
        const snapped = this.snapTime(time, new Set([g.clip.id]), free);
        this.model.draft('Trim', (state) => trimEnd(state, this.model.sources, g.clip.id, snapped));
        break;
      }
      case 'fade-in':
        this.model.draft('Fade in', (state) => setFades(state, g.clip.id, { fadeIn: time - g.clip.start }));
        break;
      case 'fade-out':
        this.model.draft('Fade out', (state) => setFades(state, g.clip.id, { fadeOut: clipEnd(g.clip) - time }));
        break;
      case 'range-edge': {
        const moved = free || !this.options.showGrid ? time : this.grid.round(time);
        const other = g.edge === 'start' ? g.range.end : g.range.start;

        this.currentRange = { ...g.range, start: Math.max(0, Math.min(moved, other)), end: Math.max(moved, other) };
        this.renderRange();
        break;
      }
      case 'range': {
        const snap = (t: number) => (free || !g.ruler || !this.options.showGrid ? t : this.grid.round(t));
        const start = snap(Math.min(g.time, time));
        const end = snap(Math.max(g.time, time));
        const lanes = g.ruler ? [0, this.state.tracks.length - 1] : [g.lane, this.laneAt(e.clientY)].sort((a, b) => a - b);
        const tracks = this.state.tracks.slice(Math.max(0, lanes[0]!), Math.max(0, lanes[1]!) + 1).map((track) => track.id);

        this.currentRange = { start, end, tracks };
        this.renderRange();
        // Over the lanes it is a selection box, not a range
        this.rangeEl.classList.toggle('tfs-range--box', !g.ruler);
        if (!g.ruler) this.rangeMark.style.display = 'none';
        break;
      }
    }
  }

  /** Press on a flag in the ruler: grab a marker or tempo change, or rename a marker on a double click. */
  private flagPointerDown(e: PointerEvent, target: HTMLElement) {
    const markerId = target.closest<HTMLElement>('[data-marker]')?.dataset.marker;
    const tempoId = target.closest<HTMLElement>('[data-tempo]')?.dataset.tempo;
    const marker = this.markers.find((m) => m.id === markerId);
    const change = this.grid.tempo.find((c) => c.id === tempoId);

    if (marker) {
      e.preventDefault();

      const last = this.lastMarker;

      this.lastMarker = { id: marker.id, at: e.timeStamp };
      if (last?.id === marker.id && e.timeStamp - last.at < 400 && !this.options.readonly) {
        this.lastMarker = null;
        this.editMarkerName(marker.id);

        return;
      }

      if (this.options.readonly) {
        this.seek(marker.time);

        return;
      }

      this.gesture = { kind: 'marker', id: e.pointerId, x: e.clientX, started: false, marker };
    } else if (change) {
      e.preventDefault();
      this.gesture = { kind: 'tempo', id: e.pointerId, x: e.clientX, started: false, change };
    } else {
      return;
    }

    this.content.setPointerCapture?.(e.pointerId);
  }

  /** Grab a point in an automation lane, or add one where the lane is pressed. A double click removes a point. */
  private startPoint(e: PointerEvent, track: string, point: string | undefined) {
    const param = this.automationView(track);
    const row = this.trackRows.get(track);
    if (!param || !row || this.options.readonly) return;

    e.preventDefault();
    this.root.focus({ preventScroll: true });

    const points = [...automationOf(this.state.tracks.find((t) => t.id === track), param)];
    const index = point === undefined ? -1 : Number(point);

    const last = this.lastPoint;

    this.lastPoint = index >= 0 ? { track, index, at: e.timeStamp } : null;

    // A double click on a point removes it
    if (last && index >= 0 && last.track === track && last.index === index && e.timeStamp - last.at < 400) {
      this.lastPoint = null;
      this.removeAutomationPoint(track, param, index);

      return;
    }
    const adding = index < 0;
    const others = adding ? points : points.filter((_, i) => i !== index);

    this.gesture = { kind: 'point', id: e.pointerId, x: e.clientX, y: e.clientY, started: adding, track, param, others, adding };
    this.content.setPointerCapture?.(e.pointerId);
    if (adding) this.dragPoint(this.gesture, e);
  }

  private dragPoint(g: Extract<Gesture, { kind: 'point' }>, e: PointerEvent) {
    const row = this.trackRows.get(g.track);
    if (!row) return;

    const raw = this.timeAt(e.clientX);
    const time = e.altKey || !this.options.showGrid ? raw : this.grid.round(raw);
    const value = this.automationValueAt(row, g.param, e.clientY);

    this.model.draft(g.adding ? 'Add point' : 'Move point', (state) => writeAutomation(state, g.track, g.param, cleanPoints(g.param, [...g.others, { time, value }])));

    const readout = row.autoHead.querySelector('.tfs-auto-value');

    if (readout) readout.textContent = formatValue(g.param, value);
  }

  private dragMove(g: Extract<Gesture, { kind: 'move' }>, e: PointerEvent, free: boolean) {
    const base = g.base;
    const moving = base.clips.filter((clip) => g.ids.has(clip.id));
    const index = new Map(base.tracks.map((track, i) => [track.id, i]));
    const lowest = Math.max(...moving.map((clip) => index.get(clip.track) ?? 0));
    let lanes = this.laneAt(e.clientY) - g.lane;
    let state = base;

    if (this.options.createTrack && lowest + lanes >= base.tracks.length) {
      g.track ??= this.options.createTrack();
      state = insertTrack(base, g.track);
      lanes = base.tracks.length - lowest;
    }

    const raw = (e.clientX - g.x) / this.pps;
    const start = g.clip.start + raw;
    const shift = raw + this.snapShift([start, start + g.clip.duration], g.ids, free);

    this.model.draft('Move', () => moveClips(state, g.ids, shift, lanes));
  }

  private onPointerUp(e: PointerEvent) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;

    this.gesture = null;
    this.snapEl.style.display = 'none';

    if (g.kind === 'click-clip') {
      this.select([g.clip.id]);
    } else if (g.kind === 'marker' && !g.started) {
      this.seek(g.marker.time);
    } else if (g.kind === 'tempo' && !g.started) {
      if (!this.options.readonly) {
        const box = this.ruler.querySelector(`[data-tempo="${g.change.id}"]`)?.getBoundingClientRect();

        this.showTempoMenu(g.change.id, { x: box?.left ?? e.clientX, y: (box?.bottom ?? e.clientY) + 2 });
      }
    } else if (g.kind === 'range') {
      this.endRange(g);
    } else if (g.kind === 'range-edge') {
      if (g.started) this.setRange(this.currentRange);
    } else if (g.started) {
      const labels = {
        move: 'Move',
        'trim-start': 'Trim',
        'trim-end': 'Trim',
        'fade-in': 'Fade in',
        'fade-out': 'Fade out',
        'resize-track': 'Resize track',
        point: 'Move point',
        marker: 'Move marker',
        tempo: 'Move tempo change',
      } as const;
      const label = g.kind === 'move' && g.ids.size > 1 ? 'Move clips' : g.kind === 'point' && g.adding ? 'Add point' : labels[g.kind];

      this.model.commit(label);
    } else if (g.kind === 'move' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      this.select([g.clip.id]);
    }

    this.schedule();
  }

  private endRange(g: Extract<Gesture, { kind: 'range' }>) {
    const range = this.currentRange;

    if (!g.started) {
      this.select([]);
      this.setRange(null);
      this.seek(g.time);

      return;
    }

    // Dragging over the lanes selects the clips the box touches; only the ruler picks a range
    if ((g.additive || !g.ruler) && range) {
      const hit = this.state.clips.filter((clip) => range.tracks.includes(clip.track) && clip.start < range.end && clipEnd(clip) > range.start);

      this.select([...(g.additive ? this.selected : []), ...hit.map((clip) => clip.id)]);
      this.setRange(null);

      return;
    }

    this.select([]);
    this.setRange(range);
  }

  private cancelGesture() {
    const g = this.gesture;
    this.gesture = null;
    this.snapEl.style.display = 'none';

    if (g?.kind === 'range' && g.touch && !g.started) return;
    if (this.model.drafting) this.model.cancel();

    this.schedule();
  }

  private seek(time: number) {
    this.setTime(time);
    this.emit('seek', { time });
  }

  /** Grid snap when it is on, otherwise a pull towards nearby clip edges and the playhead. */
  private snapShift(edges: number[], exclude: Set<string>, free: boolean) {
    this.snapEl.style.display = 'none';
    if (free) return 0;

    if (this.options.showGrid && this.grid.snap !== 'off') {
      const shift = this.grid.round(edges[0]!) - edges[0]!;
      this.showSnap(edges[0]! + shift);

      return shift;
    }

    if (!this.options.snapToClips) return 0;

    const targets = [0, this.playheadTime];

    for (const clip of this.state.clips) {
      if (!exclude.has(clip.id)) targets.push(clip.start, clipEnd(clip));
    }

    const shift = nearestSnap(edges, targets, 8 / this.pps);
    if (shift) this.showSnap(edges.find((edge) => targets.some((t) => Math.abs(t - edge - shift) < 1e-9))! + shift);

    return shift;
  }

  private snapTime(time: number, exclude: Set<string>, free: boolean) {
    return Math.max(0, time + this.snapShift([time], exclude, free));
  }

  private showSnap(time: number) {
    this.snapEl.style.display = '';
    this.snapEl.style.transform = `translateX(${time * this.pps}px)`;
  }

  private autoScroll(clientX: number) {
    const rect = this.scroller.getBoundingClientRect();
    const edge = 32;

    if (clientX > rect.right - edge) this.scroller.scrollLeft += 16;
    else if (clientX < rect.left + this.options.headerWidth + edge) this.scroller.scrollLeft -= 16;
  }

  private onWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    this.setZoom(this.pps * Math.exp(-e.deltaY * 0.002), this.timeAt(e.clientX));
  }

  private onKey(e: KeyboardEvent) {
    if (!this.options.keyboard || isTyping(e.target)) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const step = this.options.showGrid && this.grid.step ? this.grid.step : 0.1;
    const edit = !this.options.readonly;
    let handled = true;

    if (mod && key === 'z' && edit) {
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && key === 'y' && edit) this.redo();
    else if (mod && key === 'a') this.select(this.state.clips.map((clip) => clip.id));
    else if (mod && key === 'd' && edit) this.duplicateSelected();
    else if ((key === 'delete' || key === 'backspace') && edit) this.deleteSelected();
    else if (key === 's' && !mod && edit) this.split();
    else if (key === 'escape') {
      if (this.gesture) this.cancelGesture();
      else {
        this.select([]);
        this.setRange(null);
      }
    } else if (key === 'arrowleft' && edit && this.selected.size) this.nudge(-step);
    else if (key === 'arrowright' && edit && this.selected.size) this.nudge(step);
    else if (key === 'arrowup' && edit && this.selected.size) this.nudge(0, -1);
    else if (key === 'arrowdown' && edit && this.selected.size) this.nudge(0, 1);
    else handled = false;

    if (handled) e.preventDefault();
  }
}
