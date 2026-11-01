import { encodeWav, type AudioEngine } from '@toneflix/studio-audio';
import type { SnapTo } from '@toneflix/studio-core';
import { resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { createDisplay } from './display.ts';
import { renderIcon, type IconName, type IconSet } from './icons.ts';
import { createMeter } from './meter.ts';
import { injectControlStyles } from './styles.ts';

/** A toolbar button, the snap picker, the transport display, the output meter, or `'|'` for a divider. */
export type ToolbarItem = Exclude<IconName, 'pause' | 'mute' | 'solo'> | 'display' | 'meter' | '|';

export type ToolbarLabels = Record<Exclude<ToolbarItem, '|'> | 'pause' | 'tempo' | 'timeSignature', string>;

export interface ToolbarOptions {
  timeline: StudioTimeline;
  /** Needed for play, stop, loop, metronome and export; they are left out without it */
  engine?: AudioEngine;
  items?: ToolbarItem[];
  /** Replace any of the icons */
  icons?: Partial<IconSet>;
  /** Button names, shown as tooltips and read by screen readers */
  labels?: Partial<ToolbarLabels>;
  /** File name of an exported mix */
  exportName?: string;
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
  'export',
  'meter',
];

export const DEFAULT_LABELS: ToolbarLabels = {
  play: 'Play (Space)',
  pause: 'Pause (Space)',
  stop: 'Stop',
  loop: 'Loop the selected range',
  metronome: 'Metronome',
  split: 'Split at the playhead (S)',
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
  private readonly unsubscribe: (() => void)[] = [];

  constructor(target: ContainerTarget, options: ToolbarOptions) {
    const container = resolveContainer(target);

    this.doc = container.ownerDocument;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.icons = options.icons ?? {};
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.exportName = options.exportName ?? 'mix.wav';
    this.root = this.doc.createElement('div');
    this.root.className = 'tfs-toolbar';
    this.root.setAttribute('role', 'toolbar');
    injectControlStyles(this.doc);

    const items = (options.items ?? DEFAULT_TOOLBAR).filter((item) => this.engine || !AUDIO.includes(item));

    for (const [i, item] of items.entries()) {
      if (item === '|') {
        if (i > 0 && items[i - 1] !== '|' && i < items.length - 1) this.root.append(this.divider());
      } else if (item === 'snap') this.root.append(this.snapPicker());
      else if (item === 'display') this.root.append(this.display());
      else if (item === 'meter') this.root.append(this.outputMeter());
      else this.root.append(this.button(item));
    }

    container.append(this.root);
    this.listen();
    this.refresh();
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
        void this.exportMix();
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

  private async exportMix() {
    if (!this.engine) return;

    const mix = await this.engine.render();
    const link = this.doc.createElement('a');

    link.href = URL.createObjectURL(new Blob([encodeWav(mix)], { type: 'audio/wav' }));
    link.download = this.exportName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
    this.setIcon(button, item, this.labels[item]);
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

    this.unsubscribe.push(this.timeline.history.on('change', refresh), this.timeline.on('select', refresh), this.timeline.on('change', refresh));

    if (this.engine) {
      for (const event of ['play', 'pause', 'end', 'loop'] as const) this.unsubscribe.push(this.engine.on(event, refresh));
    }
  }
}
