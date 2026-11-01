import type { AudioEngine } from '@toneflix/studio-audio';
import type { Track } from '@toneflix/studio-core';
import { renderIcon, type IconSet } from './icons.ts';
import { createMeter } from './meter.ts';
import { injectControlStyles } from './styles.ts';

export interface TrackStripOptions {
  /** Icons for mute and solo; without them the buttons show M and S, as in most DAWs */
  icons?: Partial<IconSet>;
  labels?: Partial<{ mute: string; solo: string; volume: string }>;
  /** Highest volume on the slider, as linear gain */
  maxVolume?: number;
  /** Show a level meter under the volume slider */
  meter?: boolean;
}

/**
 * Track headers with a colour tab, the name, mute, solo, a volume slider and a
 * level meter, wired to an engine's mixer. Pass the result as the timeline's `renderHeader`.
 */
export const trackStrip = (engine: AudioEngine, options: TrackStripOptions = {}) => {
  const labels = { mute: 'Mute', solo: 'Solo', volume: 'Volume', ...options.labels };

  return (track: Track, cell: HTMLElement) => {
    const doc = cell.ownerDocument;
    const strip = doc.createElement('div');
    const top = doc.createElement('div');
    const name = doc.createElement('span');
    const volume = doc.createElement('input');
    const body = doc.createElement('div');
    const tab = doc.createElement('i');
    const channel = () => engine.mixer.channel(track.id).settings;

    const toggle = (kind: 'mute' | 'solo') => {
      const button = doc.createElement('button');

      button.type = 'button';
      button.className = 'tfs-tool';
      button.dataset.tool = kind;
      button.title = labels[kind];
      button.setAttribute('aria-label', `${labels[kind]} ${track.name}`);
      if (options.icons?.[kind]) button.append(renderIcon(doc, kind, options.icons));
      else button.textContent = kind === 'mute' ? 'M' : 'S';
      button.addEventListener('click', () => engine.mixer.set(track.id, { [kind]: !channel()[kind] }));

      return button;
    };

    const mute = toggle('mute');
    const solo = toggle('solo');
    const show = () => {
      const now = channel();

      mute.setAttribute('aria-pressed', String(now.mute));
      solo.setAttribute('aria-pressed', String(now.solo));
      volume.value = String(now.volume);
    };

    injectControlStyles(doc);
    strip.className = 'tfs-strip';
    top.className = 'tfs-strip-top';
    name.className = 'tfs-strip-name';
    name.textContent = track.name;
    volume.type = 'range';
    volume.min = '0';
    volume.max = String(options.maxVolume ?? 1.5);
    volume.step = '0.01';
    volume.setAttribute('aria-label', `${labels.volume} ${track.name}`);
    volume.addEventListener('input', () => engine.mixer.set(track.id, { volume: Number(volume.value) }));
    volume.addEventListener('dblclick', () => engine.mixer.set(track.id, { volume: 1 }));
    tab.className = 'tfs-strip-tab';
    body.className = 'tfs-strip-body';
    top.append(name, mute, solo);
    body.append(top, volume);
    strip.append(tab, body);

    const meter = options.meter === false ? null : createMeter(doc, engine, () => engine.mixer.channel(track.id));

    if (meter) body.append(meter.element);
    cell.append(strip);
    show();

    const off = engine.mixer.on('change', ({ track: id }) => id === track.id && show());

    return () => {
      off();
      meter?.stop();
      strip.remove();
    };
  };
};
