import { encodeWav, type AudioEngine } from '@toneflix/studio-audio';
import type { SnapTo } from '@toneflix/studio-core';
import { resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { createDisplay } from './display.ts';
import { renderIcon, type Icon, type IconName, type IconSet } from './icons.ts';
import { createInfoDialog, sessionInfo, type InfoRow } from './info.ts';
import { createMeter } from './meter.ts';
import type { StudioMixer } from './mixer-view.ts';
import { injectControlStyles } from './styles.ts';

/** A toolbar button, the snap picker, the transport display, the output meter, or `'|'` for a divider. */
export type ToolbarItem = Exclude<IconName, 'pause' | 'mute' | 'solo' | 'save' | 'close'> | 'display' | 'meter' | '|';

export type ToolbarLabels = Record<Exclude<ToolbarItem, '|'> | 'pause' | 'tempo' | 'timeSignature' | 'save' | 'close', string>;

/** What hooks and custom actions get to work with. */
export interface ToolbarContext {
  timeline: StudioTimeline;
  engine?: AudioEngine;
  toolbar: StudioToolbar;
  /** Render the mix as a WAV file; needs an engine */
  mix: () => Promise<Blob>;
  /** Download the mix, as the export button does without `onSave` */
  download: () => Promise<void>;
}

/** A button an app adds to the toolbar. */
export interface ToolbarAction {
  /** Names the button: its `data-tool`, and where `items` can place it */
  id: string;
  /** Tooltip and screen reader name */
  label: string;
  icon: Icon;
  onClick: (context: ToolbarContext) => void | Promise<void>;
  /** Put it just before or after a built-in item or another action; it goes at the end otherwise */
  before?: string;
  after?: string;
  /** Show it as switched on, read on every refresh */
  pressed?: (context: ToolbarContext) => boolean;
  /** Grey it out, read on every refresh */
  disabled?: (context: ToolbarContext) => boolean;
}

export interface ToolbarOptions {
  timeline: StudioTimeline;
  /** Needed for play, stop, loop, metronome and export; they are left out without it */
  engine?: AudioEngine;
  /** Built-in items and action ids, in order */
  items?: (ToolbarItem | (string & {}))[];
  /** Replace any of the icons */
  icons?: Partial<IconSet>;
  /** Button names, shown as tooltips and read by screen readers */
  labels?: Partial<ToolbarLabels>;
  /** File name of an exported mix */
  exportName?: string;
  /** Your own buttons; `addAction()` adds more later */
  actions?: ToolbarAction[];
  /**
   * Turns the export button into Save and calls this instead of downloading,
   * for example to upload the mix or store the project. The button waits while it runs.
   */
  onSave?: (context: ToolbarContext) => void | Promise<void>;
  /** A mixer view for the mixer button to show and hide; the button is left out without one */
  mixer?: StudioMixer;
  /** Rows for the info dialog; gets the default rows to extend or replace */
  info?: (rows: InfoRow[], context: ToolbarContext) => InfoRow[];
}

export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  'play',
  'stop',
  'loop',
  'metronome',
  '|',
  'display',
  '|',
  'split',
  'duplicate',
  'delete',
  '|',
  'undo',
  'redo',
  '|',
  'zoomOut',
  'fit',
  'zoomIn',
  '|',
  'snap',
  '|',
  'mixer',
  'export',
  'meter',
  'info',
];

export const DEFAULT_LABELS: ToolbarLabels = {
  play: 'Play (Space)',
  pause: 'Pause (Space)',
  stop: 'Stop',
  loop: 'Loop the selected range',
  metronome: 'Metronome',
  split: 'Split the selection at the playhead, or a range at its edges (S)',
  duplicate: 'Duplicate (Ctrl+D)',
  delete: 'Delete (Del)',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Shift+Z)',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit to view',
  snap: 'Snap',
  export: 'Export WAV',
  display: 'Playhead position',
  tempo: 'Tempo',
  timeSignature: 'Time signature',
  meter: 'Output level',
  info: 'Session info',
  mixer: 'Mixer',
  save: 'Save',
  close: 'Close',
};

const AUDIO: ToolbarItem[] = ['play', 'stop', 'loop', 'metronome', 'export', 'meter'];
const SNAPS: [SnapTo, string][] = [
  ['off', 'Off'],
  ['bar', 'Bar'],
  ['beat', 'Beat'],
  ['1/8', '1/8'],
  ['1/16', '1/16'],
  ['1/32', '1/32'],
];

/** Transport and editing buttons for a timeline, drawn as icons. */
export class StudioToolbar {
  readonly root: HTMLDivElement;
  private readonly timeline: StudioTimeline;
  private readonly engine?: AudioEngine;
  private readonly icons: Partial<IconSet>;
  private readonly labels: ToolbarLabels;
  private readonly exportName: string;
  private readonly doc: Document;
  private readonly buttons = new Map<ToolbarItem, HTMLButtonElement>();
  private readonly placed = new Map<string, HTMLElement>();
  private readonly actions = new Map<string, { action: ToolbarAction; button: HTMLButtonElement }>();
  private readonly unsubscribe: (() => void)[] = [];
  private readonly onSave?: ToolbarOptions['onSave'];
  private readonly infoRows?: ToolbarOptions['info'];
  private readonly mixer?: StudioMixer;
  private infoDialog?: ReturnType<typeof createInfoDialog>;

  constructor(target: ContainerTarget, options: ToolbarOptions) {
    const container = resolveContainer(target);

    this.doc = container.ownerDocument;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.icons = options.icons ?? {};
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.exportName = options.exportName ?? 'mix.wav';
    this.onSave = options.onSave;
    this.infoRows = options.info;
    this.mixer = options.mixer;
    this.root = this.doc.createElement('div');
    this.root.className = 'tfs-toolbar';
    this.root.setAttribute('role', 'toolbar');
    injectControlStyles(this.doc);

    const actions = new Map((options.actions ?? []).map((action) => [action.id, action]));
    const items = (options.items ?? DEFAULT_TOOLBAR).filter(
      (item) =>
        actions.has(item) ||
        (item === 'mixer' ? !!this.mixer : this.engine || !AUDIO.includes(item as ToolbarItem) || (item === 'export' && this.onSave)),
    );

    for (const [i, item] of items.entries()) {
      const action = actions.get(item);

      if (action) {
        actions.delete(item);
        this.root.append(this.actionButton(action));
      } else if (item === '|') {
        if (i > 0 && items[i - 1] !== '|' && i < items.length - 1) this.root.append(this.divider());
      } else if (item === 'snap') this.place(item, this.snapPicker());
      else if (item === 'display') this.place(item, this.display());
      else if (item === 'meter') this.place(item, this.outputMeter());
      else this.place(item, this.button(item as Exclude<ToolbarItem, '|' | 'snap' | 'display' | 'meter'>));
    }

    for (const action of actions.values()) this.addAction(action);

    container.append(this.root);
    this.listen();
    this.refresh();
  }

  /** What hooks and actions are given. */
  get context(): ToolbarContext {
    return {
      timeline: this.timeline,
      engine: this.engine,
      toolbar: this,
      mix: () => this.mix(),
      download: () => this.download(),
    };
  }

  /**
   * Add a button. It goes before or after the item its `before` or `after`
   * names, or at the end. Returns a function that removes it.
   */
  addAction(action: ToolbarAction) {
    this.removeAction(action.id);

    const button = this.actionButton(action);
    const anchor = this.placed.get(action.before ?? action.after ?? '');

    if (anchor && action.before) anchor.before(button);
    else if (anchor) anchor.after(button);
    else this.root.append(button);

    this.refresh();

    return () => this.removeAction(action.id);
  }

  removeAction(id: string) {
    const added = this.actions.get(id);
    if (!added) return;

    added.button.remove();
    this.actions.delete(id);
    this.placed.delete(id);
  }

  /** Open the info dialog. */
  showInfo() {
    this.infoDialog ??= createInfoDialog(this.doc, this.timeline, this.engine, {
      title: this.labels.info,
      closeLabel: this.labels.close,
      icons: this.icons,
      rows: () => {
        const rows = sessionInfo(this.timeline);

        return this.infoRows ? this.infoRows(rows, this.context) : rows;
      },
    });
    this.infoDialog.open();
  }

  /** Bring button states up to date; called on its own after timeline and engine events. */
  refresh() {
    const { timeline, engine } = this;
    const set = (item: ToolbarItem, update: (button: HTMLButtonElement) => void) => {
      const button = this.buttons.get(item);
      if (button) update(button);
    };

    set('undo', (b) => (b.disabled = !timeline.history.canUndo));
    set('redo', (b) => (b.disabled = !timeline.history.canRedo));
    set('duplicate', (b) => (b.disabled = !timeline.selection.length));
    set('delete', (b) => (b.disabled = !timeline.selection.length));
    set('split', (b) => (b.disabled = !timeline.canSplit));
    set('mixer', (b) => b.setAttribute('aria-pressed', String(!!this.mixer?.visible)));

    for (const { action, button } of this.actions.values()) {
      const context = this.context;

      if (action.pressed) button.setAttribute('aria-pressed', String(action.pressed(context)));
      if (action.disabled && button.getAttribute('aria-busy') !== 'true') button.disabled = action.disabled(context);
    }

    this.infoDialog?.update();

    if (!engine) return;

    set('play', (b) => {
      const name = engine.isPlaying ? 'pause' : 'play';

      if (b.dataset.icon !== name) this.setIcon(b, name, this.labels[name]);
    });
    set('loop', (b) => b.setAttribute('aria-pressed', String(!!engine.loop)));
    set('metronome', (b) => b.setAttribute('aria-pressed', String(engine.metronome.enabled)));
  }

  destroy() {
    for (const off of this.unsubscribe) off();

    this.infoDialog?.destroy();
    this.root.remove();
  }

  private run(item: ToolbarItem) {
    const { timeline, engine } = this;

    switch (item) {
      case 'play':
        engine?.toggle();
        break;
      case 'stop':
        engine?.stop();
        break;
      case 'loop':
        engine?.setLoop(engine.loop ? null : this.loopRange());
        break;
      case 'metronome':
        if (engine) engine.metronome.enabled = !engine.metronome.enabled;
        break;
      case 'split':
        timeline.split();
        break;
      case 'duplicate':
        timeline.duplicateSelected();
        break;
      case 'delete':
        timeline.deleteSelected();
        break;
      case 'undo':
        timeline.undo();
        break;
      case 'redo':
        timeline.redo();
        break;
      case 'zoomIn':
        timeline.setZoom(timeline.pxPerSecond * 1.5);
        break;
      case 'zoomOut':
        timeline.setZoom(timeline.pxPerSecond / 1.5);
        break;
      case 'fit':
        timeline.fit();
        break;
      case 'export':
        void this.busy(this.buttons.get('export'), () => (this.onSave ? this.onSave(this.context) : this.download()));
        break;
      case 'info':
        this.showInfo();
        break;
      case 'mixer':
        this.mixer?.toggle();
        break;
    }

    this.refresh();
  }

  /** The selected range, or four bars from the bar under the playhead. */
  private loopRange() {
    const range = this.timeline.range;
    if (range) return { start: range.start, end: range.end };

    const bar = this.timeline.grid.bar;
    const start = Math.floor(this.timeline.time / bar) * bar;

    return { start, end: start + bar * 4 };
  }

  private async mix() {
    if (!this.engine) throw new Error('Rendering a mix needs an engine');

    const audio = await this.engine.render();

    return new Blob([encodeWav(audio)], { type: 'audio/wav' });
  }

  private async download() {
    const link = this.doc.createElement('a');

    link.href = URL.createObjectURL(await this.mix());
    link.download = this.exportName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  /** Disable a button while its work runs, so it can't start twice. */
  private async busy(button: HTMLButtonElement | undefined, work: () => void | Promise<void>) {
    if (button?.getAttribute('aria-busy') === 'true') return;

    button?.setAttribute('aria-busy', 'true');
    if (button) button.disabled = true;

    try {
      await work();
    } finally {
      button?.removeAttribute('aria-busy');
      if (button) button.disabled = false;
      this.refresh();
    }
  }

  private place(id: string, element: HTMLElement) {
    if (!this.placed.has(id)) this.placed.set(id, element);
    this.root.append(element);
  }

  private actionButton(action: ToolbarAction) {
    const button = this.doc.createElement('button');

    button.type = 'button';
    button.className = 'tfs-tool';
    button.dataset.tool = action.id;
    button.title = action.label;
    button.setAttribute('aria-label', action.label);
    button.append(renderIcon(this.doc, 'info', { info: action.icon }));
    button.addEventListener('click', () => void this.busy(button, () => action.onClick(this.context)));
    this.actions.set(action.id, { action, button });
    this.placed.set(action.id, button);

    return button;
  }

  private display() {
    const display = createDisplay(this.doc, this.timeline, this.engine, {
      position: this.labels.display,
      tempo: this.labels.tempo,
      meter: this.labels.timeSignature,
    });

    this.unsubscribe.push(display.destroy);

    return display.element;
  }

  private outputMeter() {
    const engine = this.engine!;
    const meter = createMeter(this.doc, engine, () => engine.mixer.master);

    meter.element.classList.add('tfs-meter--output');
    meter.element.title = this.labels.meter;
    this.unsubscribe.push(meter.stop);

    return meter.element;
  }

  private button(item: Exclude<ToolbarItem, '|' | 'snap' | 'display' | 'meter'>) {
    const button = this.doc.createElement('button');

    button.type = 'button';
    button.className = 'tfs-tool';
    button.dataset.tool = item;
    if (item === 'play') button.classList.add('tfs-tool--primary');
    if (item === 'export' && this.onSave) this.setIcon(button, 'save', this.labels.save);
    else this.setIcon(button, item, this.labels[item]);
    button.addEventListener('click', () => this.run(item));
    this.buttons.set(item, button);

    return button;
  }

  private setIcon(button: HTMLButtonElement, name: IconName, label: string) {
    button.dataset.icon = name;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.replaceChildren(renderIcon(this.doc, name, this.icons));
  }

  private snapPicker() {
    const wrap = this.doc.createElement('label');
    const select = this.doc.createElement('select');

    wrap.className = 'tfs-snap-pick';
    wrap.title = this.labels.snap;
    select.setAttribute('aria-label', this.labels.snap);

    for (const [value, text] of SNAPS) select.add(new Option(text, value, false, value === this.timeline.grid.snap));

    select.addEventListener('change', () => this.timeline.setGrid({ snap: select.value as SnapTo }));
    wrap.append(renderIcon(this.doc, 'snap', this.icons), select);

    return wrap;
  }

  private divider() {
    const divider = this.doc.createElement('span');

    divider.className = 'tfs-toolbar-gap';
    divider.setAttribute('role', 'separator');

    return divider;
  }

  private listen() {
    const refresh = () => this.refresh();

    this.unsubscribe.push(this.timeline.history.on('change', refresh), this.timeline.on('select', refresh), this.timeline.on('range', refresh), this.timeline.on('change', refresh));

    if (this.mixer) this.unsubscribe.push(this.mixer.on('toggle', refresh));

    if (this.engine) {
      for (const event of ['play', 'pause', 'end', 'loop'] as const) this.unsubscribe.push(this.engine.on(event, refresh));
    }
  }
}
