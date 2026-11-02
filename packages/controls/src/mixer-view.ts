import type { AudioEngine, ChannelSettings } from '@toneflix/studio-audio';
import { Emitter, type Track } from '@toneflix/studio-core';
import type { PluginRack } from '@toneflix/studio-plugins';
import { onDoubleTap, resolveContainer, type ContainerTarget, type StudioTimeline } from '@toneflix/studio-timeline';
import { faderToGain, formatDb, formatPan, gainToFader } from './fader.ts';
import { renderIcon, type IconSet } from './icons.ts';
import { createInserts, DEFAULT_INSERTS_LABELS, type InsertsLabels, type PluginChoice } from './inserts.ts';
import { createKnob } from './knob.ts';
import { createMeter } from './meter.ts';
import { injectControlStyles } from './styles.ts';

export interface MixerLabels {
  master: string;
  volume: string;
  pan: string;
  mute: string;
  solo: string;
  /** Insert slot buttons and the plugin window */
  inserts: InsertsLabels;
}

export interface MixerOptions {
  timeline: StudioTimeline;
  engine: AudioEngine;
  /** Icons for mute and solo; without them the buttons show M and S */
  icons?: Partial<IconSet>;
  labels?: Partial<Omit<MixerLabels, 'inserts'>> & { inserts?: Partial<InsertsLabels> };
  /** Top of the faders, as linear gain; 2 is +6 dB */
  maxVolume?: number;
  /** Start hidden, to be opened with `show()` or the toolbar's mixer button */
  hidden?: boolean;
  /**
   * Sit in the page flow under whatever comes before it, taking its own height.
   * By default it slides up over the bottom of its container, so opening it
   * leaves the layout alone.
   */
  docked?: boolean;
  /** Shows insert slots on every strip, for plugins hosted by this rack */
  plugins?: PluginRack;
  /** Plugins the add button offers */
  catalog?: PluginChoice[];
  /** Pick a plugin your own way instead of the built-in menu */
  pickPlugin?: (track: string | null) => Promise<PluginChoice | null>;
}

export interface MixerViewEvents extends Record<string, unknown> {
  toggle: { visible: boolean };
}

export const DEFAULT_MIXER_LABELS: MixerLabels = { master: 'Master', volume: 'Volume', pan: 'Pan', mute: 'Mute', solo: 'Solo', inserts: DEFAULT_INSERTS_LABELS };

/** dB marks beside each fader. */
const SCALE = [6, 0, -6, -12, -24, -48];

interface Strip {
  element: HTMLElement;
  key: string;
  show: (settings: ChannelSettings) => void;
  stop: () => void;
}

/**
 * A mixing desk view: a channel strip for every track, with pan, mute, solo,
 * a fader and a level meter, and a master strip at the end. Strips follow the
 * timeline's tracks and the engine's mixer both ways.
 */
export class StudioMixer extends Emitter<MixerViewEvents> {
  readonly root: HTMLDivElement;
  private readonly timeline: StudioTimeline;
  private readonly engine: AudioEngine;
  private readonly icons: Partial<IconSet>;
  private readonly labels: MixerLabels;
  private readonly maxVolume: number;
  private readonly plugins?: Pick<MixerOptions, 'plugins' | 'catalog' | 'pickPlugin'>;
  private readonly doc: Document;
  private readonly container: HTMLElement;
  private readonly lane: HTMLDivElement;
  private readonly strips = new Map<string, Strip>();
  private readonly master: Strip;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(target: ContainerTarget, options: MixerOptions) {
    super();

    const container = resolveContainer(target);

    this.doc = container.ownerDocument;
    this.container = container;
    this.timeline = options.timeline;
    this.engine = options.engine;
    this.icons = options.icons ?? {};
    this.labels = { ...DEFAULT_MIXER_LABELS, ...options.labels, inserts: { ...DEFAULT_INSERTS_LABELS, ...options.labels?.inserts } };
    this.maxVolume = options.maxVolume ?? 2;
    this.plugins = options.plugins && { plugins: options.plugins, catalog: options.catalog, pickPlugin: options.pickPlugin };
    this.root = this.doc.createElement('div');
    this.lane = this.doc.createElement('div');
    this.root.className = 'tfs-mixer';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Mixer');
    this.root.hidden = !!options.hidden;

    if (!options.docked) {
      this.root.classList.add('tfs-mixer--overlay');

      const view = this.doc.defaultView;

      if (view && view.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    this.lane.className = 'tfs-mixer-strips';
    injectControlStyles(this.doc);

    this.master = this.strip(null, this.labels.master, 'var(--tfs-mixer-master, #8d8d96)');
    this.master.element.classList.add('tfs-channel--master');
    this.root.append(this.lane, this.master.element);
    container.append(this.root);

    this.sync();
    this.unsubscribe.push(
      this.timeline.on('change', () => this.sync()),
      this.engine.mixer.on('change', ({ track }) => {
        const strip = track === null ? this.master : this.strips.get(track);

        strip?.show(this.settingsOf(track));
      }),
    );
  }

  get visible() {
    return !this.root.hidden;
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

  destroy() {
    for (const off of this.unsubscribe) off();
    for (const strip of [...this.strips.values(), this.master]) strip.stop();

    this.strips.clear();
    this.root.remove();
  }

  private setVisible(visible: boolean) {
    if (visible === this.visible) return;

    this.root.hidden = !visible;
    this.emit('toggle', { visible });
  }

  private settingsOf(track: string | null) {
    return (track === null ? this.engine.mixer.master : this.engine.mixer.channel(track)).settings;
  }

  /** Add, remove, reorder and rename strips to match the timeline's tracks. */
  private sync() {
    const tracks = this.timeline.state.tracks;
    const seen = new Set<string>();

    tracks.forEach((track, index) => {
      const colour = this.timeline.colorOf(track);
      const key = `${track.name}|${colour}`;
      let strip = this.strips.get(track.id);

      seen.add(track.id);

      if (strip && strip.key !== key) {
        strip.stop();
        strip.element.remove();
        strip = undefined;
      }

      if (!strip) {
        strip = this.strip(track, track.name, colour);
        strip.key = key;
        this.strips.set(track.id, strip);
      }

      if (this.lane.children[index] !== strip.element) this.lane.insertBefore(strip.element, this.lane.children[index] ?? null);
    });

    for (const [id, strip] of this.strips) {
      if (seen.has(id)) continue;

      strip.stop();
      strip.element.remove();
      this.strips.delete(id);
    }
  }

  private strip(track: Track | null, name: string, colour: string): Strip {
    const { doc, engine, labels } = this;
    const id = track?.id ?? null;
    const element = doc.createElement('div');
    const buttons = doc.createElement('div');
    const body = doc.createElement('div');
    const scale = doc.createElement('div');
    const fader = doc.createElement('input');
    const readout = doc.createElement('output');
    const title = doc.createElement('div');
    const set = (settings: Partial<ChannelSettings>) => engine.mixer.set(id, settings);
    const channel = () => (id === null ? engine.mixer.master : engine.mixer.channel(id));
    const meter = createMeter(doc, engine, channel, { vertical: true });

    const pan = createKnob(doc, {
      label: `${labels.pan} ${name}`,
      min: -1,
      max: 1,
      initial: 0,
      step: 0.01,
      format: formatPan,
      onInput: (value) => set({ pan: value }),
    });
    const toggle = (kind: 'mute' | 'solo') => {
      const button = doc.createElement('button');

      button.type = 'button';
      button.className = 'tfs-tool';
      button.dataset.tool = kind;
      button.title = labels[kind];
      button.setAttribute('aria-label', `${labels[kind]} ${name}`);
      if (this.icons[kind]) button.append(renderIcon(doc, kind, this.icons));
      else button.textContent = kind === 'mute' ? 'M' : 'S';
      button.addEventListener('click', () => set({ [kind]: !channel().settings[kind] }));
      buttons.append(button);

      return button;
    };

    const mute = toggle('mute');
    const solo = id === null ? null : toggle('solo');

    element.className = 'tfs-channel';
    element.style.setProperty('--clip', colour);
    buttons.className = 'tfs-channel-buttons';
    body.className = 'tfs-channel-body';
    scale.className = 'tfs-channel-scale';
    scale.setAttribute('aria-hidden', 'true');

    for (const db of SCALE) {
      const mark = doc.createElement('span');

      mark.textContent = db > 0 ? `+${db}` : String(db);
      mark.style.bottom = `${gainToFader(10 ** (db / 20), this.maxVolume) * 100}%`;
      scale.append(mark);
    }

    fader.type = 'range';
    fader.className = 'tfs-fader';
    fader.min = '0';
    fader.max = '1';
    fader.step = '0.001';
    fader.setAttribute('aria-label', `${labels.volume} ${name}`);
    fader.addEventListener('input', () => set({ volume: faderToGain(Number(fader.value), this.maxVolume) }));
    onDoubleTap(fader, () => set({ volume: 1 }));
    readout.className = 'tfs-channel-db';
    title.className = 'tfs-channel-name';
    title.textContent = name;
    title.title = name;
    pan.element.classList.add('tfs-channel-pan');
    body.append(scale, fader, meter.element);
    const inserts = this.plugins?.plugins
      ? createInserts(doc, this.plugins.plugins, id, { catalog: this.plugins.catalog, pick: this.plugins.pickPlugin, labels: labels.inserts, icons: this.icons, container: this.container })
      : null;

    element.append(...(inserts ? [inserts.element] : []), pan.element, buttons, body, readout, title);

    const show = (settings: ChannelSettings) => {
      pan.set(settings.pan);
      mute.setAttribute('aria-pressed', String(settings.mute));
      solo?.setAttribute('aria-pressed', String(settings.solo));
      fader.value = String(gainToFader(settings.volume, this.maxVolume));
      fader.setAttribute('aria-valuetext', `${formatDb(settings.volume)} dB`);
      readout.textContent = formatDb(settings.volume);
    };

    show(channel().settings);

    return {
      element,
      key: '',
      show,
      stop: () => {
        meter.stop();
        inserts?.stop();
      },
    };
  }
}
