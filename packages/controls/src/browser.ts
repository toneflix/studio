import type { AudioEngine } from '@toneflix/studio-audio';
import { addClips, addTrack, Emitter, makeClip, uid, type Clip, type Track } from '@toneflix/studio-core';
import type { PluginRack } from '@toneflix/studio-plugins';
import { openMenu, resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { renderIcon, type IconSet } from './icons.ts';
import type { LibraryItem, LibrarySource } from './library.ts';
import { injectControlStyles } from './styles.ts';

export interface BrowserLabels {
  title: string;
  search: string;
  close: string;
  /** The add button on each item */
  add: string;
  preview: string;
  stop: string;
  newTrack: string;
  master: string;
  loadMore: string;
  loading: string;
  empty: string;
  /** Shown when a list can't load; the error's message follows it */
  failed: string;
}

export const DEFAULT_BROWSER_LABELS: BrowserLabels = {
  title: 'Browser',
  search: 'Search',
  close: 'Close',
  add: 'Add',
  preview: 'Listen',
  stop: 'Stop',
  newTrack: 'New track',
  master: 'Master',
  loadMore: 'Load more',
  loading: 'Loading…',
  empty: 'Nothing here yet',
  failed: 'Could not load this list.',
};

export interface BrowserOptions {
  timeline: StudioTimeline;
  engine: AudioEngine;
  /** Tabs, in order; `setSources()` changes them later */
  sources: LibrarySource[];
  /** Needed to add plugins; plugin items can't be added without it */
  plugins?: PluginRack;
  icons?: Partial<IconSet>;
  labels?: Partial<BrowserLabels>;
  /** Start hidden, to be opened with `show()` or the toolbar's browser button */
  hidden?: boolean;
  /** Sit in the page flow, first in its container; by default it slides in over the left of the container */
  docked?: boolean;
  /** Gets each sound's audio as it is added, for example to draw its waveform */
  onSource?: (id: string, buffer: AudioBuffer) => void;
}

export interface BrowserAddEvent {
  item: LibraryItem;
  source: LibrarySource;
  /** The track it went on; null for the master */
  track: string | null;
  /** The new clip, for sounds */
  clip?: Clip;
}

export interface BrowserEvents extends Record<string, unknown> {
  toggle: { visible: boolean };
  add: BrowserAddEvent;
  error: { item?: LibraryItem; source: LibrarySource; error: unknown };
}

/** Where a sound goes: a track (null for a new one) and a time. */
export interface AudioTarget {
  track?: string | null;
  time?: number;
}

export const DRAG_TYPE = 'application/x-toneflix-library-item';

/** A library sound being dragged out of a browser. */
export interface DraggedSound {
  name: string;
  /** The source id it gets in the session */
  source: string;
  load(): Promise<AudioBuffer>;
}

let dragged: DraggedSound | null = null;

/** The library sound being dragged out of a browser right now, if any, for drop targets outside the timeline. */
export const draggedSound = () => dragged;

const formatDuration = (seconds: number) =>
  seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * A drawer of sounds and plugins from any number of sources: the session, files
 * from the device, plugin lists, or the app's own library and search. Sounds are
 * dragged onto the timeline or added from their menu; plugins go on a track or the master.
 */
export class StudioBrowser extends Emitter<BrowserEvents> {
  readonly root: HTMLElement;
  private readonly timeline: StudioTimeline;
  private readonly engine: AudioEngine;
  private readonly plugins?: PluginRack;
  private readonly icons: Partial<IconSet>;
  private readonly labels: BrowserLabels;
  private readonly onSource?: BrowserOptions['onSource'];
  private readonly doc: Document;
  private readonly tabs: HTMLDivElement;
  private readonly searchInput: HTMLInputElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly list: HTMLUListElement;
  private readonly status: HTMLDivElement;
  private readonly more: HTMLButtonElement;
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly unsubscribe: (() => void)[] = [];
  private sources: LibrarySource[] = [];
  private current: LibrarySource | null = null;
  private items: LibraryItem[] = [];
  private page = 1;
  private request: AbortController | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private playing: { item: LibraryItem; node: AudioBufferSourceNode; button: HTMLButtonElement } | null = null;
  private dragging: { source: LibrarySource; item: LibraryItem } | null = null;

  constructor(target: ContainerTarget, options: BrowserOptions) {
    super();

    const container = resolveContainer(target);
    const doc = container.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = doc.createElement(tag);

      node.className = className;
      parent?.append(node);

      return node;
    };

    this.doc = doc;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.plugins = options.plugins;
    this.icons = options.icons ?? {};
    this.labels = { ...DEFAULT_BROWSER_LABELS, ...options.labels };
    this.onSource = options.onSource;
    injectControlStyles(doc);

    this.root = el('aside', 'tfs-browser');
    this.root.setAttribute('aria-label', this.labels.title);
    this.root.hidden = !!options.hidden;

    if (!options.docked) {
      this.root.classList.add('tfs-browser--overlay');

      const view = doc.defaultView;

      if (view && view.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    const head = el('div', 'tfs-browser-head', this.root);
    const title = el('h2', '', head);
    const close = el('button', 'tfs-tool', head);

    title.textContent = this.labels.title;
    close.type = 'button';
    close.title = this.labels.close;
    close.setAttribute('aria-label', this.labels.close);
    close.append(renderIcon(doc, 'close', this.icons));
    close.addEventListener('click', () => this.hide());

    this.tabs = el('div', 'tfs-browser-tabs', this.root);
    this.tabs.setAttribute('role', 'tablist');

    const search = el('label', 'tfs-browser-search', this.root);

    this.searchInput = el('input', '', search);
    this.searchInput.type = 'search';
    this.searchInput.placeholder = this.labels.search;
    this.searchInput.setAttribute('aria-label', this.labels.search);
    this.searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.reload(), 250);
    });
    this.searchInput.addEventListener('keydown', (e) => e.stopPropagation());

    this.actionButton = el('button', 'tfs-browser-action', this.root);
    this.actionButton.type = 'button';
    this.actionButton.addEventListener('click', () => void this.runAction());

    this.status = el('div', 'tfs-browser-status', this.root);
    this.list = el('ul', 'tfs-browser-list', this.root);
    this.more = el('button', 'tfs-browser-more', this.root);
    this.more.type = 'button';
    this.more.textContent = this.labels.loadMore;
    this.more.addEventListener('click', () => void this.load(this.page + 1));

    if (options.docked) container.prepend(this.root);
    else container.append(this.root);
    this.listenForDrops();
    this.setSources(options.sources);
  }

  get visible() {
    return !this.root.hidden;
  }

  /** The tab that is showing. */
  get source() {
    return this.current;
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

  /** Replace the tabs, keeping the open one when it is still there. */
  setSources(sources: LibrarySource[]) {
    const keep = sources.find((source) => source.id === this.current?.id);

    this.sources = [...sources];
    this.tabs.replaceChildren(
      ...this.sources.map((source) => {
        const tab = this.doc.createElement('button');

        tab.type = 'button';
        tab.className = 'tfs-browser-tab';
        tab.dataset.source = source.id;
        tab.setAttribute('role', 'tab');
        tab.textContent = source.label;
        tab.addEventListener('click', () => this.open(source.id));

        return tab;
      }),
    );
    this.tabs.hidden = this.sources.length < 2;
    this.open(keep?.id ?? this.sources[0]?.id ?? null, !keep);
  }

  /** Show a tab. */
  open(id: string | null, reload = true) {
    this.current = this.sources.find((source) => source.id === id) ?? null;

    for (const tab of this.tabs.querySelectorAll<HTMLElement>('.tfs-browser-tab')) tab.setAttribute('aria-selected', String(tab.dataset.source === id));

    this.actionButton.hidden = !this.current?.action;
    this.actionButton.textContent = this.current?.action?.label ?? '';
    if (reload || !this.items.length) this.reload();
  }

  /** Load the open tab again from its first page. */
  reload() {
    this.items = [];
    this.list.replaceChildren();
    if (this.visible) void this.load(1);
  }

  /**
   * Put a sound on a track: the one given, or a new track named after it when the
   * track is null or missing; at the time given, or the playhead. One undo step.
   */
  async addAudio(item: LibraryItem, source: LibrarySource, target: AudioTarget = {}) {
    const buffer = await this.bufferOf(item, source, false);
    const id = this.sourceId(item, source);
    const { timeline, engine } = this;

    if (engine.getBuffer(id) !== buffer) {
      engine.setBuffer(id, buffer);
      timeline.setSource({ id, duration: buffer.duration });
      this.onSource?.(id, buffer);
    }

    const existing = timeline.state.tracks.find((track) => track.id === target.track);
    const track: Track = existing ?? { id: uid('t'), name: item.name };
    const clip = makeClip({ id: uid('c'), track: track.id, source: id, name: item.name, start: Math.max(0, target.time ?? timeline.time), offset: 0, duration: buffer.duration });

    timeline.model.apply('Add sound', (state) => addClips(existing ? state : addTrack(state, track), [clip]));
    timeline.select([clip.id]);
    this.emit('add', { item, source, track: track.id, clip });

    return clip;
  }

  /** Add a plugin to a track's chain, or the master's with null. */
  async addPlugin(item: LibraryItem, source: LibrarySource, track: string | null) {
    if (!this.plugins || !item.url) throw new Error('Adding plugins needs a plugin rack and the plugin URL');

    await this.wake();

    const slot = await this.plugins.add(track, item.url);

    this.emit('add', { item, source, track });

    return slot;
  }

  destroy() {
    this.stopPreview();
    this.request?.abort();
    clearTimeout(this.searchTimer);
    for (const off of this.unsubscribe) off();

    this.root.remove();
  }

  private setVisible(visible: boolean) {
    if (visible === this.visible) return;

    this.root.hidden = !visible;
    if (visible && !this.items.length) void this.load(1);
    if (!visible) this.stopPreview();
    this.emit('toggle', { visible });
  }

  private async runAction() {
    const source = this.current;
    if (!source?.action) return;

    this.actionButton.disabled = true;

    try {
      await source.action.run();
      if (source === this.current) this.reload();
    } catch (error) {
      this.emit('error', { source, error });
    } finally {
      this.actionButton.disabled = false;
    }
  }

  /** Fetch a page of the open tab and add its rows. */
  private async load(page: number) {
    const source = this.current;

    this.request?.abort();
    this.more.hidden = true;
    if (!source) return this.setStatus('');

    const request = new AbortController();

    this.request = request;
    this.setStatus(this.labels.loading);

    try {
      const result = await source.list({ search: this.searchInput.value.trim(), page, signal: request.signal });
      if (request.signal.aborted) return;

      this.page = page;
      this.items.push(...result.items);
      this.list.append(...result.items.map((item) => this.row(item, source)));
      this.more.hidden = !result.more;
      this.setStatus(this.items.length ? '' : this.labels.empty);
    } catch (error) {
      if (request.signal.aborted) return;

      this.setStatus(`${this.labels.failed} ${error instanceof Error ? error.message : ''}`.trim(), true);
      this.emit('error', { source, error });
    }
  }

  private setStatus(text: string, failed = false) {
    this.status.textContent = text;
    this.status.hidden = !text;
    this.status.classList.toggle('tfs-browser-status--failed', failed);
  }

  private row(item: LibraryItem, source: LibrarySource) {
    const doc = this.doc;
    const row = doc.createElement('li');
    const text = doc.createElement('div');
    const name = doc.createElement('span');
    const add = doc.createElement('button');
    const audio = item.kind === 'audio';
    const canAdd = audio || (!!this.plugins && !!item.url);

    row.className = 'tfs-browser-item';
    row.dataset.kind = item.kind;
    row.draggable = canAdd;
    text.className = 'tfs-browser-text';
    name.className = 'tfs-browser-name';
    name.textContent = item.name;
    name.title = item.name;
    text.append(name);

    if (item.detail) {
      const detail = doc.createElement('span');

      detail.className = 'tfs-browser-detail';
      detail.textContent = item.detail;
      detail.title = item.detail;
      text.append(detail);
    }

    if (audio) {
      const preview = doc.createElement('button');

      preview.type = 'button';
      preview.className = 'tfs-tool tfs-browser-preview';
      this.setPreviewIcon(preview, false);
      preview.addEventListener('click', () => void this.togglePreview(item, source, preview));
      row.append(preview);
    } else {
      const icon = doc.createElement('span');

      icon.className = 'tfs-browser-kind';
      icon.append(renderIcon(doc, 'plugin', this.icons));
      row.append(icon);
    }

    if (item.image) {
      const image = doc.createElement('img');
      const kind = row.querySelector('.tfs-browser-kind');

      image.className = 'tfs-browser-image';
      image.src = item.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      // Keep the icon if the picture can't load
      image.addEventListener('error', () => image.replaceWith(...(kind ? [kind] : [])));
      if (kind) kind.replaceWith(image);
      else row.prepend(image);
    }

    row.append(text);

    if (audio && item.duration) {
      const length = doc.createElement('span');

      length.className = 'tfs-browser-length';
      length.textContent = formatDuration(item.duration);
      row.append(length);
    }

    add.type = 'button';
    add.className = 'tfs-tool tfs-browser-add';
    add.title = this.labels.add;
    add.setAttribute('aria-label', `${this.labels.add} ${item.name}`);
    add.hidden = !canAdd;
    add.append(renderIcon(doc, 'add', this.icons));
    add.addEventListener('click', () => this.showAddMenu(item, source, add, row));
    row.append(add);

    row.addEventListener('pointerdown', (e) => {
      if (canAdd && e.pointerType !== 'mouse' && !(e.target as Element).closest('button')) this.touchDrag(e, row, item, source);
    });
    row.addEventListener('dragstart', (e) => {
      this.dragging = { source, item };
      dragged = item.kind === 'audio' ? { name: item.name, source: this.sourceId(item, source), load: () => this.bufferOf(item, source, false) } : null;
      e.dataTransfer?.setData(DRAG_TYPE, `${source.id}\n${item.id}`);
      e.dataTransfer?.setData('text/plain', item.name);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
    });
    row.addEventListener('dragend', () => {
      this.dragging = null;
      dragged = null;
    });

    return row;
  }

  /**
   * Drag an item with a finger: hold it still for a moment, then move it where it
   * goes. The drawer fades so the tracks under it show, and letting go drops the item
   * there as a mouse drop would, so every drop target takes it. Moving before the
   * hold ends scrolls the list instead.
   */
  private touchDrag(e: PointerEvent, row: HTMLElement, item: LibraryItem, source: LibrarySource) {
    const doc = this.doc;
    const view = doc.defaultView;
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    let at = start;

    const lift = () => {
      ghost = doc.createElement('div');
      ghost.className = 'tfs-browser-ghost';
      ghost.textContent = item.name;
      doc.body.append(ghost);
      this.dragging = { source, item };
      dragged = item.kind === 'audio' ? { name: item.name, source: this.sourceId(item, source), load: () => this.bufferOf(item, source, false) } : null;
      this.root.classList.add('tfs-browser--lifted');
      row.classList.add('tfs-browser-item--lifted');
      navigator.vibrate?.(10);
      follow(at.x, at.y);
    };
    const follow = (x: number, y: number) => {
      if (ghost) ghost.style.transform = `translate(${x}px, ${y}px)`;
    };
    const timer = view?.setTimeout(lift, 350);
    // A lifted item keeps the page from scrolling under the finger
    const block = (t: TouchEvent) => {
      if (ghost) t.preventDefault();
    };
    const move = (m: PointerEvent) => {
      if (m.pointerId !== e.pointerId) return;

      at = { x: m.clientX, y: m.clientY };
      if (ghost) follow(at.x, at.y);
      else if (Math.hypot(at.x - start.x, at.y - start.y) > 8) end(false);
    };
    const up = (u: PointerEvent) => u.pointerId === e.pointerId && end(true);
    const cancel = (c: PointerEvent) => c.pointerId === e.pointerId && end(false);
    const menu = (c: Event) => c.preventDefault();
    const end = (drop: boolean) => {
      view?.clearTimeout(timer);
      row.removeEventListener('touchmove', block);
      row.removeEventListener('contextmenu', menu);
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      row.draggable = true;
      if (!ghost) return;

      ghost.remove();
      // Dropped while the drawer is still see-through, so the point finds what is under it
      if (drop) this.dropAt(at.x, at.y, item, source);
      this.root.classList.remove('tfs-browser--lifted');
      row.classList.remove('tfs-browser-item--lifted');
      this.dragging = null;
      dragged = null;
    };

    // The finger drag replaces the browser's own drag, which most phones don't offer
    row.draggable = false;
    row.addEventListener('touchmove', block, { passive: false });
    row.addEventListener('contextmenu', menu);
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
  }

  /** Drop a lifted item on whatever is under a point, with the same events a mouse drop sends. */
  private dropAt(x: number, y: number, item: LibraryItem, source: LibrarySource) {
    const target = this.doc.elementFromPoint(x, y);
    if (!target || this.root.contains(target)) return;

    const data = new DataTransfer();

    data.setData(DRAG_TYPE, `${source.id}\n${item.id}`);
    data.setData('text/plain', item.name);

    const send = (type: string) => {
      const event = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: data });

      target.dispatchEvent(event);

      return event.defaultPrevented;
    };

    if (send('dragover')) send('drop');
  }

  /** The tracks to add to, and a new track for sounds or the master for plugins. */
  private showAddMenu(item: LibraryItem, source: LibrarySource, button: HTMLButtonElement, row: HTMLElement) {
    const box = button.getBoundingClientRect();
    const tracks = this.timeline.state.tracks;
    const run = (work: () => Promise<unknown>) => void this.busy(row, item, source, work);
    const items =
      item.kind === 'audio'
        ? [{ label: this.labels.newTrack, onSelect: () => run(() => this.addAudio(item, source, { track: null })) }, ...tracks.map((track) => ({ label: track.name, onSelect: () => run(() => this.addAudio(item, source, { track: track.id })) }))]
        : [...tracks.map((track) => ({ label: track.name, onSelect: () => run(() => this.addPlugin(item, source, track.id)) })), { label: this.labels.master, onSelect: () => run(() => this.addPlugin(item, source, null)) }];

    openMenu(this.doc, { x: box.left, y: box.bottom + 4 }, items, `${this.labels.add} ${item.name}`);
  }

  private async busy(row: HTMLElement, item: LibraryItem, source: LibrarySource, work: () => Promise<unknown>) {
    row.setAttribute('aria-busy', 'true');

    try {
      await work();
    } catch (error) {
      this.emit('error', { item, source, error });
    } finally {
      row.removeAttribute('aria-busy');
    }
  }

  /** Dropping a sound on a lane places it there, or on a new track below the last; a plugin goes on the track. */
  private listenForDrops() {
    const area = this.timeline.root;
    const accepts = (e: DragEvent) => !!this.dragging && !!e.dataTransfer?.types.includes(DRAG_TYPE);
    const onOver = (e: DragEvent) => {
      if (!accepts(e)) return;

      const plugin = this.dragging!.item.kind === 'plugin';
      if (plugin && !this.timeline.trackAt(e.clientY)) return;

      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };
    const onDrop = (e: DragEvent) => {
      if (!accepts(e)) return;

      const { item, source } = this.dragging!;
      const track = this.timeline.trackAt(e.clientY);
      const row = [...this.list.children].find((child, i) => this.items[i] === item) as HTMLElement | undefined;

      e.preventDefault();
      this.dragging = null;

      if (item.kind === 'plugin') {
        if (track) void this.busy(row ?? this.root, item, source, () => this.addPlugin(item, source, track.id));
      } else {
        const time = this.timeline.snap(this.timeline.timeAt(e.clientX));

        void this.busy(row ?? this.root, item, source, () => this.addAudio(item, source, { track: track?.id ?? null, time }));
      }
    };

    area.addEventListener('dragover', onOver);
    area.addEventListener('drop', onDrop);
    this.unsubscribe.push(() => {
      area.removeEventListener('dragover', onOver);
      area.removeEventListener('drop', onDrop);
    });
  }

  /** Start the audio context after a click, as browsers ask; offline contexts are left alone. */
  private async wake() {
    const context = this.engine.context as AudioContext;

    if ('close' in context && context.state === 'suspended') await context.resume();
  }

  private sourceId(item: LibraryItem, source: LibrarySource) {
    return item.source ?? `${source.id}:${item.id}`;
  }

  /** An item's decoded audio, fetched once; previews use the lighter file when there is one. */
  private bufferOf(item: LibraryItem, source: LibrarySource, preview: boolean) {
    const url = preview && item.preview ? item.preview : null;
    const key = `${url ? 'preview' : 'full'}\n${this.sourceId(item, source)}`;
    let buffer = this.buffers.get(key);

    if (!buffer) {
      const fetchData = async (): Promise<Blob | ArrayBuffer | AudioBuffer> => {
        if (!url && item.load) return item.load(new AbortController().signal);

        const response = await fetch(url ?? item.url ?? '');
        if (!response.ok) throw new Error(`Could not load ${item.name} (${response.status})`);

        return response.arrayBuffer();
      };

      buffer = fetchData().then(async (data) => {
        if (data instanceof AudioBuffer) return data;

        const bytes = data instanceof Blob ? await data.arrayBuffer() : data;

        return this.engine.context.decodeAudioData(bytes.slice(0));
      });
      buffer.catch(() => this.buffers.delete(key));
      this.buffers.set(key, buffer);
    }

    return buffer;
  }

  private async togglePreview(item: LibraryItem, source: LibrarySource, button: HTMLButtonElement) {
    const same = this.playing?.item === item;

    this.stopPreview();
    if (same) return;

    const context = this.engine.context;

    button.setAttribute('aria-busy', 'true');

    try {
      await this.wake();

      const buffer = await this.bufferOf(item, source, true);
      const node = context.createBufferSource();

      node.buffer = buffer;
      node.connect(context.destination);
      node.addEventListener('ended', () => this.playing?.node === node && this.stopPreview());
      node.start();
      this.playing = { item, node, button };
      this.setPreviewIcon(button, true);
    } catch (error) {
      this.emit('error', { item, source, error });
    } finally {
      button.removeAttribute('aria-busy');
    }
  }

  private stopPreview() {
    const playing = this.playing;
    if (!playing) return;

    this.playing = null;
    playing.node.stop();
    playing.node.disconnect();
    this.setPreviewIcon(playing.button, false);
  }

  private setPreviewIcon(button: HTMLButtonElement, playing: boolean) {
    const label = playing ? this.labels.stop : this.labels.preview;

    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(playing));
    button.replaceChildren(renderIcon(this.doc, playing ? 'stop' : 'play', this.icons));
  }
}
