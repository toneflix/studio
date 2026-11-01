import {
  addClips,
  addTrack as insertTrack,
  type Clip,
  clipEnd,
  duplicateClips,
  Emitter,
  Grid,
  type GridOptions,
  type History,
  makeClip,
  moveTrack,
  moveClips,
  nearestSnap,
  type Peaks,
  removeClips,
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
import { closeMenu, openMenu } from './menu.ts';
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
}

export interface TrackLabels {
  add: string;
  addBelow: string;
  rename: string;
  duplicate: string;
  moveUp: string;
  moveDown: string;
  delete: string;
  menu: string;
  /** Name of a new track; `{n}` is its number */
  newTrack: string;
}

export const DEFAULT_TRACK_LABELS: TrackLabels = {
  add: 'Add track',
  addBelow: 'Add track below',
  rename: 'Rename',
  duplicate: 'Duplicate',
  moveUp: 'Move up',
  moveDown: 'Move down',
  delete: 'Delete track',
  menu: 'Track options',
  newTrack: 'Track {n}',
};

/** Fired by an element in a track header to open that track's menu, for custom headers. */
export const TRACK_MENU_EVENT = 'tfs-track-menu';

export interface TimelineEvents extends Record<string, unknown> {
  change: { state: TimelineState; label: string; final: boolean };
  select: { clips: string[] };
  range: { range: TimeRange | null };
  seek: { time: number };
  zoom: { pxPerSecond: number };
}

type Gesture =
  | { kind: 'move'; id: number; x: number; y: number; started: boolean; clip: Clip; ids: Set<string>; lane: number; base: TimelineState; track?: Track }
  | { kind: 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out'; id: number; x: number; started: boolean; clip: Clip }
  | { kind: 'range'; id: number; x: number; y: number; started: boolean; time: number; lane: number; additive: boolean; ruler: boolean; touch: boolean }
  | { kind: 'range-edge'; id: number; x: number; y: number; started: boolean; edge: 'start' | 'end'; range: TimeRange }
  | { kind: 'click-clip'; id: number; x: number; y: number; clip: Clip }
  | { kind: 'resize-track'; id: number; x: number; y: number; started: boolean; track: Track; height: number };

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
  private trackRows = new Map<string, { row: HTMLDivElement; header: HTMLDivElement; lane: HTMLDivElement; grip: HTMLDivElement; cleanup?: () => void }>();
  private clipViews = new Map<string, ClipView>();
  private selected = new Set<string>();
  private currentRange: TimeRange | null = null;
  private loopRange: { start: number; end: number } | null = null;
  private gesture: Gesture | null = null;
  private lastGrip: { track: string; at: number } | null = null;
  private frame = 0;
  private resize?: ResizeObserver;
  private unsubscribe: (() => void)[] = [];
  private options: Required<Omit<TimelineOptions, 'model' | 'history' | 'grid' | 'renderHeader' | 'createTrack' | 'trackLabels'>> &
    Pick<TimelineOptions, 'renderHeader' | 'createTrack'>;
  private readonly trackLabels: TrackLabels;
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
      createTrack: options.createTrack,
      editTracks: options.editTracks ?? true,
    };
    this.trackLabels = { ...DEFAULT_TRACK_LABELS, ...options.trackLabels };
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
      const track = this.addTrack();

      if (track) this.editTrackName(track.id);
    });
    this.ruler = el('div', 'tfs-ruler', rulerRow);
    this.rows = el('div', 'tfs-rows', this.content);
    this.overlay = el('div', 'tfs-overlay', this.content);
    this.loopEl = this.doc.createElement('div');
    this.loopEl.className = 'tfs-loop';
    this.rangeEl = el('div', 'tfs-range', this.overlay);
    this.rangeMark = this.doc.createElement('div');
    this.rangeMark.className = 'tfs-range-mark';

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

    const copy: Track = { ...this.makeTrack(), color: this.trackColor(track, index), height: track.height, name: `${track.name} copy` };
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
        { label: labels.delete, danger: true, onSelect: () => this.removeTrack(id) },
      ],
      `${labels.menu}: ${this.state.tracks[index]!.name}`,
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
      else if (box.top < view.top + this.ruler.offsetHeight) this.scroller.scrollTop -= view.top + this.ruler.offsetHeight - box.top;
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

    this.renderTracks(state, width);
    this.renderClips(state);
    this.renderRuler();
    this.renderRange();
    this.renderLoop();
    this.placePlayhead();
    this.paint();
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

        rowEl.className = 'tfs-row';
        header.className = 'tfs-header';
        lane.className = 'tfs-lane';
        lane.dataset.track = track.id;
        const grip = this.doc.createElement('div');

        grip.className = 'tfs-row-resize';
        grip.dataset.track = track.id;
        rowEl.append(header, lane, grip);
        row = { row: rowEl, header, lane, grip };
        this.trackRows.set(track.id, row);
        this.fillHeader(track, row);
      } else if (row.header.dataset.name !== track.name || row.header.dataset.color !== this.trackColor(track, index)) {
        row.cleanup?.();
        this.fillHeader(track, row);
      }

      row.row.style.height = `${this.heightOf(track)}px`;
      row.grip.style.display = resizable ? '' : 'none';
      row.row.style.boxSizing = 'border-box';
      row.row.style.setProperty('--clip', this.trackColor(track, index));
      row.header.style.width = `${headerWidth}px`;
      row.header.style.display = headerWidth ? '' : 'none';
      row.lane.style.width = `${width}px`;
      row.row.classList.toggle('tfs-row--new', this.gesture?.kind === 'move' && this.gesture.track?.id === track.id);

      if (this.rows.children[index] !== row.row) this.rows.insertBefore(row.row, this.rows.children[index] ?? null);
    });

    for (const [id, row] of this.trackRows) {
      if (seen.has(id)) continue;

      row.cleanup?.();
      row.row.remove();
      this.trackRows.delete(id);
    }
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

  /** A track's row height in pixels. */
  heightOf(track: Track) {
    return clamp(Math.round(track.height ?? this.options.trackHeight), this.options.minTrackHeight, this.options.maxTrackHeight);
  }

  /** Top of a lane, in pixels below the ruler. */
  private laneTop(index: number) {
    let top = 0;

    for (let i = 0; i < index && i < this.state.tracks.length; i++) top += this.heightOf(this.state.tracks[i]!);

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
    };

    if (this.options.showGrid) {
      let every = 1;
      while (this.grid.bar * every * this.pps < 48) every *= 2;

      const step = this.grid.bar * every;
      for (let bar = Math.floor(from / step) * every; bar * this.grid.bar < to; bar += every) add(bar * this.grid.bar, String(bar + 1));
    } else {
      const step = LABELS.find((s) => s * this.pps >= 70) ?? 600;
      for (let time = Math.floor(from / step) * step; time < to; time += step) add(time, formatTime(time, step));
    }

    this.ruler.replaceChildren(this.loopEl, this.rangeMark, ...labels);
  }

  private renderRange() {
    const range = this.currentRange;
    const style = this.rangeEl.style;
    const mark = this.rangeMark.style;

    if (!range) {
      style.display = 'none';
      mark.display = 'none';

      return;
    }

    mark.display = 'block';
    mark.left = `${range.start * this.pps}px`;
    mark.width = `${(range.end - range.start) * this.pps}px`;

    const lanes = range.tracks.map((id) => this.state.tracks.findIndex((track) => track.id === id)).filter((i) => i >= 0);
    const ruler = this.ruler.offsetHeight;
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
  }

  // ---- input ----

  private listen() {
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.unsubscribe.push(() => target.removeEventListener(type, fn, opts));
    };

    this.unsubscribe.push(
      this.model.on('change', (event) => {
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
    on(this.rows, 'dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('.tfs-track-name')) return;

      const id = this.headerTrack(e.target);

      if (id && this.tracksEditable) {
        closeMenu();
        this.editTrackName(id);
      }
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
      top += this.heightOf(track);
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

    if (target.closest('.tfs-header, .tfs-corner')) return;

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
        const snap = (t: number) => (free || !this.options.showGrid ? t : this.grid.round(t));
        const start = snap(Math.min(g.time, time));
        const end = snap(Math.max(g.time, time));
        const lanes = g.ruler ? [0, this.state.tracks.length - 1] : [g.lane, this.laneAt(e.clientY)].sort((a, b) => a - b);
        const tracks = this.state.tracks.slice(Math.max(0, lanes[0]!), Math.max(0, lanes[1]!) + 1).map((track) => track.id);

        this.currentRange = { start, end, tracks };
        this.renderRange();
        break;
      }
    }
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
    } else if (g.kind === 'range') {
      this.endRange(g);
    } else if (g.kind === 'range-edge') {
      if (g.started) this.setRange(this.currentRange);
    } else if (g.started) {
      const labels = { move: 'Move', 'trim-start': 'Trim', 'trim-end': 'Trim', 'fade-in': 'Fade in', 'fade-out': 'Fade out', 'resize-track': 'Resize track' } as const;
      this.model.commit(g.kind === 'move' && g.ids.size > 1 ? 'Move clips' : labels[g.kind]);
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

    if (g.additive && range) {
      const hit = this.state.clips.filter((clip) => range.tracks.includes(clip.track) && clip.start < range.end && clipEnd(clip) > range.start);

      this.select([...this.selected, ...hit.map((clip) => clip.id)]);
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
