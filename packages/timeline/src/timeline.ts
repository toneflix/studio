import {
  addTrack,
  type Clip,
  clipEnd,
  duplicateClips,
  Emitter,
  Grid,
  type GridOptions,
  type History,
  moveClips,
  nearestSnap,
  type Peaks,
  removeClips,
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
} from '@toneflix/studio-core';
import { ClipView } from './clip-view.ts';
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
  trackHeight?: number;
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
}

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
  | { kind: 'click-clip'; id: number; x: number; y: number; clip: Clip };

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
  private snapEl: HTMLDivElement;
  private trackRows = new Map<string, { row: HTMLDivElement; header: HTMLDivElement; lane: HTMLDivElement; cleanup?: () => void }>();
  private clipViews = new Map<string, ClipView>();
  private selected = new Set<string>();
  private currentRange: TimeRange | null = null;
  private gesture: Gesture | null = null;
  private frame = 0;
  private resize?: ResizeObserver;
  private unsubscribe: (() => void)[] = [];
  private options: Required<Omit<TimelineOptions, 'model' | 'history' | 'grid' | 'renderHeader' | 'createTrack'>> &
    Pick<TimelineOptions, 'renderHeader' | 'createTrack'>;
  private pps: number;
  private playheadTime = 0;

  constructor(container: HTMLElement, options: TimelineOptions = {}) {
    super();
    this.doc = container.ownerDocument;
    this.model = options.model ?? new TimelineModel(undefined, options.history);
    this.grid = new Grid(options.grid);
    this.options = {
      showGrid: options.showGrid ?? true,
      pxPerSecond: options.pxPerSecond ?? 40,
      minPxPerSecond: options.minPxPerSecond ?? 2,
      maxPxPerSecond: options.maxPxPerSecond ?? 2000,
      trackHeight: options.trackHeight ?? 96,
      headerWidth: options.headerWidth ?? 180,
      readonly: options.readonly ?? false,
      snapToClips: options.snapToClips ?? true,
      follow: options.follow ?? true,
      keyboard: options.keyboard ?? true,
      palette: options.palette ?? PALETTE,
      renderHeader: options.renderHeader,
      createTrack: options.createTrack,
    };
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
    this.ruler = el('div', 'tfs-ruler', rulerRow);
    this.rows = el('div', 'tfs-rows', this.content);
    this.overlay = el('div', 'tfs-overlay', this.content);
    this.rangeEl = el('div', 'tfs-range', this.overlay);
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

  setOptions(options: Partial<Pick<TimelineOptions, 'readonly' | 'follow' | 'snapToClips' | 'trackHeight' | 'keyboard'>>) {
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
  split(time = this.playheadTime) {
    const ids = this.selected.size
      ? this.selected
      : new Set(this.state.clips.filter((clip) => clip.start < time && clipEnd(clip) > time).map((clip) => clip.id));
    this.model.apply('Split', (state) => {
      const result = splitClips(state, ids, time);

      return result.created.length ? result.state : state;
    });
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

  destroy() {
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
    this.ruler.style.width = `${width}px`;
    this.overlay.style.left = `${headerWidth}px`;
    this.overlay.style.width = `${width}px`;

    this.renderTracks(state, width);
    this.renderClips(state);
    this.renderRuler();
    this.renderRange();
    this.placePlayhead();
    this.paint();
  }

  private renderTracks(state: TimelineState, width: number) {
    const { trackHeight, headerWidth } = this.options;
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
        rowEl.append(header, lane);
        row = { row: rowEl, header, lane };
        this.trackRows.set(track.id, row);
        this.fillHeader(track, row);
      } else if (row.header.dataset.name !== track.name || row.header.dataset.color !== this.trackColor(track, index)) {
        row.cleanup?.();
        this.fillHeader(track, row);
      }

      row.row.style.height = `${trackHeight}px`;
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
    cell.append(swatch, name);
    row.header.append(cell);
    row.cleanup = undefined;
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

    this.ruler.replaceChildren(...labels);
  }

  private renderRange() {
    const range = this.currentRange;
    const style = this.rangeEl.style;

    if (!range) {
      style.display = 'none';

      return;
    }

    const lanes = range.tracks.map((id) => this.state.tracks.findIndex((track) => track.id === id)).filter((i) => i >= 0);
    const ruler = this.ruler.offsetHeight;
    const first = lanes.length ? Math.min(...lanes) : 0;
    const last = lanes.length ? Math.max(...lanes) : this.state.tracks.length - 1;

    style.display = '';
    style.left = `${range.start * this.pps}px`;
    style.width = `${(range.end - range.start) * this.pps}px`;
    style.top = `${ruler + first * this.options.trackHeight}px`;
    style.height = `${(last - first + 1) * this.options.trackHeight}px`;
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
    on(this.scroller, 'wheel', (e) => this.onWheel(e), { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      this.resize = new ResizeObserver(() => this.schedule());
      this.resize.observe(this.root);
    }
  }

  private laneAt(clientY: number) {
    return Math.floor((clientY - this.rows.getBoundingClientRect().top) / this.options.trackHeight);
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || this.gesture) return;

    const target = e.target as HTMLElement;
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
      state = addTrack(base, g.track);
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
    } else if (g.started) {
      const labels = { move: 'Move', 'trim-start': 'Trim', 'trim-end': 'Trim', 'fade-in': 'Fade in', 'fade-out': 'Fade out' } as const;
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
