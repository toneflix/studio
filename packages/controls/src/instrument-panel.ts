import { INSTRUMENT_DEFAULTS, INSTRUMENT_PARAMS, type AudioEngine, type Instrument, type InstrumentParam } from '@toneflix/studio-audio';
import { Emitter, updateTrack, type InstrumentChoice, type Track } from '@toneflix/studio-core';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import { openFloatingWindow } from './floating-window.ts';
import type { IconSet } from './icons.ts';
import { createKnob } from './knob.ts';
import { injectControlStyles } from './styles.ts';

export interface InstrumentPanelLabels {
  /** Track menu item that opens the panel */
  menuItem: string;
  instrument: string;
  reset: string;
  close: string;
  loading: string;
  failed: string;
  /** Shown for an instrument that has no settings and no editor of its own */
  noSettings: string;
  /** Names of the settings by key, over the built-in English ones */
  params: Record<string, string>;
}

export const DEFAULT_INSTRUMENT_PANEL_LABELS: InstrumentPanelLabels = {
  menuItem: 'Instrument settings…',
  instrument: 'Instrument',
  reset: 'Reset',
  close: 'Close',
  loading: 'Loading…',
  failed: 'The instrument failed to load',
  noSettings: 'This instrument has no settings to show.',
  params: {},
};

/** An instrument offered in the panel's instrument picker. */
export interface InstrumentOption {
  label: string;
  instrument: InstrumentChoice;
}

export const DEFAULT_INSTRUMENT_OPTIONS: InstrumentOption[] = [
  { label: 'Synth', instrument: { id: 'synth' } },
  { label: 'Drums', instrument: { id: 'drums' } },
  { label: 'Sampler', instrument: { id: 'sampler' } },
];

export interface InstrumentPanelOptions {
  timeline: StudioTimeline;
  /** Plays the changes as they are made, before they are saved */
  engine: AudioEngine;
  /** Instruments to switch to; the built-in synth, drums and sampler by default */
  instruments?: InstrumentOption[];
  /** Add "Instrument settings…" to instrument tracks' menus; true unless given */
  trackMenu?: boolean;
  labels?: Partial<InstrumentPanelLabels>;
  icons?: Partial<IconSet>;
}

export interface InstrumentPanelEvents extends Record<string, unknown> {
  /** A track's panel opened or closed */
  toggle: { track: string; open: boolean };
}

/** A WAM instrument, which brings its own editor. */
interface WithEditor {
  plugin: {
    createGui(): Promise<Element>;
    destroyGui(gui: Element): void;
    audioNode: { getState(): Promise<unknown> };
  };
}

const hasEditor = (instrument: Instrument | null): instrument is Instrument & WithEditor =>
  !!instrument && 'plugin' in instrument && typeof (instrument as Partial<WithEditor>).plugin?.createGui === 'function';

const builtIn = (id: string): id is keyof typeof INSTRUMENT_PARAMS => id in INSTRUMENT_PARAMS;

interface OpenPanel {
  window: ReturnType<typeof openFloatingWindow>;
  /** The instrument id the body was built for */
  id: string;
  /** Show the saved settings again, after an undo or a change elsewhere */
  refresh: (state: Record<string, unknown>) => void;
  /** Save a WAM editor's settings and let it go */
  release?: () => Promise<void>;
}

/**
 * Settings windows for instrument tracks: knobs for the built-in synth, drum kit and
 * sampler, or a WAM instrument's own editor, plus a picker to change the instrument.
 * Changes are heard as they are made, and each finished change is one undo step.
 */
export class StudioInstrumentPanel extends Emitter<InstrumentPanelEvents> {
  private readonly timeline: StudioTimeline;
  private readonly engine: AudioEngine;
  private readonly labels: InstrumentPanelLabels;
  private readonly icons?: Partial<IconSet>;
  private readonly instruments: InstrumentOption[];
  private readonly doc: Document;
  private readonly panels = new Map<string, OpenPanel>();
  private readonly unsubscribe: (() => void)[] = [];

  constructor(options: InstrumentPanelOptions) {
    super();
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.labels = { ...DEFAULT_INSTRUMENT_PANEL_LABELS, ...options.labels };
    this.icons = options.icons;
    this.instruments = options.instruments ?? DEFAULT_INSTRUMENT_OPTIONS;
    this.doc = this.timeline.root.ownerDocument;
    injectControlStyles(this.doc);

    if (options.trackMenu ?? true) {
      this.unsubscribe.push(
        this.timeline.addTrackMenuItems((track) => (track.instrument ? [{ label: this.labels.menuItem, onSelect: () => this.open(track.id) }] : [])),
      );
    }

    this.unsubscribe.push(
      this.timeline.on('change', () => this.sync()),
      this.engine.on('instrument', ({ track }) => {
        const panel = this.panels.get(track);

        // A WAM instrument finished loading after its panel opened
        if (panel && !builtIn(panel.id)) this.rebuild(track);
      }),
    );
  }

  /** Tracks whose panel is open. */
  get openTracks() {
    return [...this.panels.keys()];
  }

  isOpen(track: string) {
    return this.panels.has(track);
  }

  /** Open an instrument track's settings, or bring them forward when open. */
  open(track: string) {
    const existing = this.panels.get(track);

    if (existing) {
      existing.window.raise();
      return;
    }

    const found = this.track(track);
    if (!found?.instrument) return;

    const window = openFloatingWindow(this.doc, {
      title: found.name,
      close: this.labels.close,
      icons: this.icons,
      onClose: () => {
        const panel = this.panels.get(track);

        this.panels.delete(track);
        void panel?.release?.();
        this.emit('toggle', { track, open: false });
      },
    });

    window.element.classList.add('tfs-instrument-window');
    this.panels.set(track, { window, id: found.instrument.id, refresh: () => {} });
    this.rebuild(track);
    this.emit('toggle', { track, open: true });
  }

  close(track: string) {
    this.panels.get(track)?.window.close();
  }

  toggle(track: string) {
    if (this.isOpen(track)) this.close(track);
    else this.open(track);
  }

  destroy() {
    for (const track of [...this.panels.keys()]) this.close(track);
    for (const off of this.unsubscribe) off();
    this.removeAllListeners();
  }

  private track(id: string): Track | undefined {
    return this.timeline.state.tracks.find((track) => track.id === id);
  }

  /** The track's saved settings over the instrument's defaults. */
  private settings(choice: InstrumentChoice) {
    const defaults = builtIn(choice.id) ? (INSTRUMENT_DEFAULTS[choice.id] as unknown as Record<string, unknown>) : {};

    return { ...defaults, ...((choice.state as Record<string, unknown> | undefined) ?? {}) };
  }

  /** Keep open panels in step with the timeline: close for gone tracks, rebuild for new instruments. */
  private sync() {
    for (const [id, panel] of this.panels) {
      const track = this.track(id);

      if (!track?.instrument) {
        panel.window.close();
        continue;
      }

      panel.window.title.textContent = track.name;
      if (track.instrument.id !== panel.id) this.rebuild(id);
      else panel.refresh(this.settings(track.instrument));
    }
  }

  /** Save a changed setting as one undo step. */
  private save(track: string, patch: Record<string, unknown>) {
    const choice = this.track(track)?.instrument;
    if (!choice) return;

    const state = { ...((choice.state as Record<string, unknown> | undefined) ?? {}), ...patch };

    this.timeline.model.apply('Instrument settings', (s) => updateTrack(s, track, { instrument: { ...choice, state } }));
  }

  /** Hear a setting before it is saved. */
  private preview(track: string, patch: Record<string, unknown>) {
    const choice = this.track(track)?.instrument;
    const instrument = this.engine.instrument(track);

    if (choice && instrument?.setState) instrument.setState({ ...this.settings(choice), ...patch });
  }

  private rebuild(track: string) {
    const panel = this.panels.get(track);
    const choice = this.track(track)?.instrument;
    if (!panel || !choice) return;

    const doc = this.doc;
    const body = panel.window.body;
    const head = doc.createElement('div');
    const picker = doc.createElement('select');
    const known = this.instruments.some((option) => option.instrument.id === choice.id);

    void panel.release?.();
    panel.release = undefined;
    panel.id = choice.id;
    panel.refresh = () => {};
    body.replaceChildren(head);
    head.className = 'tfs-instrument-head';
    picker.className = 'tfs-instrument-pick';
    picker.setAttribute('aria-label', this.labels.instrument);
    head.append(picker);

    // An instrument not on the list shows by its folder name, like `synth101` for `…/synth101/index.js`
    const other = { label: choice.id.split('/').filter(Boolean).at(-2) ?? choice.id, instrument: choice };

    for (const option of known ? this.instruments : [...this.instruments, other]) {
      const item = doc.createElement('option');

      item.value = option.instrument.id;
      item.textContent = option.label;
      picker.append(item);
    }

    picker.value = choice.id;
    picker.disabled = this.timeline.readonly;
    picker.addEventListener('change', () => {
      const next = this.instruments.find((option) => option.instrument.id === picker.value);
      if (!next) return;

      this.timeline.setInstrument(track, next.instrument);
    });

    if (builtIn(choice.id)) this.buildKnobs(track, panel, head, INSTRUMENT_PARAMS[choice.id]);
    else this.buildEditor(track, panel);
    panel.window.fit();
  }

  private buildKnobs(track: string, panel: OpenPanel, head: HTMLElement, params: InstrumentParam[]) {
    const doc = this.doc;
    const body = panel.window.body;
    const grid = doc.createElement('div');
    const reset = doc.createElement('button');
    const readonly = this.timeline.readonly;
    const choice = this.track(track)!.instrument!;
    const settings = this.settings(choice);
    const updates: ((state: Record<string, unknown>) => void)[] = [];

    reset.type = 'button';
    reset.className = 'tfs-roll-text';
    reset.textContent = this.labels.reset;
    reset.disabled = readonly;
    reset.addEventListener('click', () => {
      const defaults = INSTRUMENT_DEFAULTS[choice.id as keyof typeof INSTRUMENT_DEFAULTS] as unknown as Record<string, unknown>;
      const patch = Object.fromEntries(params.map((param) => [param.key, defaults[param.key]]));

      this.save(track, patch);
    });
    head.append(reset);
    grid.className = 'tfs-instrument-params';
    body.append(grid);

    for (const param of params) {
      const cell = doc.createElement('div');
      const name = doc.createElement('span');
      const label = this.labels.params[param.key] ?? param.label;

      cell.className = 'tfs-instrument-param';
      name.className = 'tfs-instrument-name';
      name.textContent = label;

      if (param.kind === 'choice') {
        const group = doc.createElement('div');
        const buttons = param.options.map((option) => {
          const button = doc.createElement('button');

          button.type = 'button';
          button.className = 'tfs-roll-view';
          button.textContent = option.label;
          button.disabled = readonly;
          button.addEventListener('click', () => this.save(track, { [param.key]: option.value }));
          group.append(button);

          return button;
        });
        const show = (state: Record<string, unknown>) => {
          param.options.forEach((option, i) => buttons[i]!.setAttribute('aria-pressed', String(state[param.key] === option.value)));
        };

        cell.classList.add('tfs-instrument-param--choice');
        group.className = 'tfs-roll-views';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', label);
        cell.append(name, group);
        show(settings);
        updates.push(show);
      } else {
        const value = doc.createElement('span');
        const current = Number(settings[param.key] ?? param.min);
        const knob = createKnob(doc, {
          label,
          min: param.min,
          max: param.max,
          initial: Number((INSTRUMENT_DEFAULTS[choice.id as keyof typeof INSTRUMENT_DEFAULTS] as unknown as Record<string, unknown>)[param.key] ?? param.min),
          step: param.step,
          log: param.log,
          format: param.format,
          onInput: (next) => {
            value.textContent = param.format(next);
            this.preview(track, { [param.key]: next });
          },
          onCommit: (next) => this.save(track, { [param.key]: next }),
        });

        knob.set(current);
        value.className = 'tfs-instrument-value';
        value.textContent = param.format(current);
        if (readonly) {
          knob.element.setAttribute('aria-disabled', 'true');
          knob.element.style.pointerEvents = 'none';
          knob.element.tabIndex = -1;
        }
        cell.append(name, knob.element, value);
        updates.push((state) => {
          const next = Number(state[param.key] ?? param.min);

          knob.set(next);
          value.textContent = param.format(next);
        });
      }

      grid.append(cell);
    }

    panel.refresh = (state) => {
      for (const update of updates) update(state);
    };
  }

  private buildEditor(track: string, panel: OpenPanel) {
    const doc = this.doc;
    const body = panel.window.body;
    const holder = doc.createElement('div');
    const instrument = this.engine.instrument(track);

    holder.className = 'tfs-instrument-editor';
    body.append(holder);

    if (!hasEditor(instrument)) {
      holder.textContent = instrument ? this.labels.noSettings : this.labels.loading;
      return;
    }

    let gui: Element | null = null;
    let released = false;

    // Save the editor's settings when the window closes or the instrument changes
    panel.release = async () => {
      released = true;
      if (gui) instrument.plugin.destroyGui(gui);

      const choice = this.track(track)?.instrument;
      if (!choice || choice.id !== panel.id || this.timeline.readonly) return;

      const state = await instrument.plugin.audioNode.getState();

      if (JSON.stringify(state) !== JSON.stringify(choice.state ?? null)) {
        this.timeline.model.apply('Instrument settings', (s) => updateTrack(s, track, { instrument: { ...choice, state } }));
      }
    };

    holder.textContent = this.labels.loading;
    instrument.plugin.createGui().then(
      (element) => {
        if (released) return instrument.plugin.destroyGui(element);

        gui = element;
        holder.replaceChildren(element);
        panel.window.fit();
      },
      () => {
        holder.textContent = this.labels.failed;
      },
    );
  }
}
