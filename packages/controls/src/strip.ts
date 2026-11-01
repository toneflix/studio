import type { AudioEngine } from '@toneflix/studio-audio';
import type { Track } from '@toneflix/studio-core';
import type { Recorder } from '@toneflix/studio-recorder';
import { TRACK_MENU_EVENT } from '@toneflix/studio-timeline';
import { renderIcon, type IconSet } from './icons.ts';
import { createMeter } from './meter.ts';
import { injectControlStyles } from './styles.ts';

export interface TrackStripOptions {
  /** Icons for mute and solo; without them the buttons show M and S, as in most DAWs */
  icons?: Partial<IconSet>;
  labels?: Partial<{ mute: string; solo: string; volume: string; arm: string }>;
  /** Highest volume on the slider, as linear gain */
  maxVolume?: number;
  /** Show a level meter under the volume slider */
  meter?: boolean;
  /** Adds an R button that arms the track for this recorder */
  recorder?: Recorder;
}

/**
 * Track headers with a colour tab, the name, mute, solo, a volume slider and a
 * level meter, wired to an engine's mixer. Pass the result as the timeline's `renderHeader`.
 */
export const trackStrip = (engine: AudioEngine, options: TrackStripOptions = {}) => {
  const labels = { mute: 'Mute', solo: 'Solo', volume: 'Volume', arm: 'Arm for recording', ...options.labels };
  const recorder = options.recorder;

  return (track: Track, cell: HTMLElement) => {
    const doc = cell.ownerDocument;
    const strip = doc.createElement('div');
    const top = doc.createElement('div');
    const name = doc.createElement('span');
    const volume = doc.createElement('input');
    const body = doc.createElement('div');
    const tab = doc.createElement('i');
    const channel = () => engine.mixer.channel(track.id).settings;

    const toggle = (kind: 'mute' | 'solo' | 'arm', letter: string, onClick: () => void) => {
      const button = doc.createElement('button');

      button.type = 'button';
      button.className = 'tfs-tool';
      button.dataset.tool = kind;
      button.title = labels[kind];
      button.setAttribute('aria-label', `${labels[kind]} ${track.name}`);
      if (kind !== 'arm' && options.icons?.[kind]) button.append(renderIcon(doc, kind, options.icons));
      else button.textContent = letter;
      button.addEventListener('click', onClick);

      return button;
    };

    const mute = toggle('mute', 'M', () => engine.mixer.set(track.id, { mute: !channel().mute }));
    const solo = toggle('solo', 'S', () => engine.mixer.set(track.id, { solo: !channel().solo }));
    const arm = recorder && toggle('arm', 'R', () => !recorder.isRecording && recorder.arm(recorder.armed === track.id ? null : track.id));
    const show = () => {
      const now = channel();

      mute.setAttribute('aria-pressed', String(now.mute));
      solo.setAttribute('aria-pressed', String(now.solo));
      arm?.setAttribute('aria-pressed', String(recorder!.armed === track.id));
      volume.value = String(now.volume);
    };

    injectControlStyles(doc);
    strip.className = 'tfs-strip';
    top.className = 'tfs-strip-top';
    // Clicking the name opens the timeline's track menu; double-clicking renames
    name.className = 'tfs-strip-name tfs-track-name';
    name.textContent = track.name;
    name.title = track.name;
    name.addEventListener('click', () => name.dispatchEvent(new CustomEvent(TRACK_MENU_EVENT, { bubbles: true })));
    volume.type = 'range';
    volume.min = '0';
    volume.max = String(options.maxVolume ?? 1.5);
    volume.step = '0.01';
    volume.setAttribute('aria-label', `${labels.volume} ${track.name}`);
    volume.addEventListener('input', () => engine.mixer.set(track.id, { volume: Number(volume.value) }));
    volume.addEventListener('dblclick', () => engine.mixer.set(track.id, { volume: 1 }));
    tab.className = 'tfs-strip-tab';
    body.className = 'tfs-strip-body';
    top.append(name, ...(arm ? [arm] : []), mute, solo);
    body.append(top, volume);
    strip.append(tab, body);

    const meter = options.meter === false ? null : createMeter(doc, engine, () => engine.mixer.channel(track.id));

    if (meter) body.append(meter.element);
    cell.append(strip);
    show();

    const off = engine.mixer.on('change', ({ track: id }) => id === track.id && show());
    const offArm = recorder?.on('arm', show);

    return () => {
      off();
      offArm?.();
      meter?.stop();
      strip.remove();
    };
  };
};
