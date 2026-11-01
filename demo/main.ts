import { makeClip, StudioTimeline, uid, Waveforms, type SnapTo } from '../src/index.ts';

const rate = 22050;

/** A few seconds of made-up audio so the demo needs no files. */
const synth = (seconds: number, voice: (t: number) => number) => {
  const data = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < data.length; i++) data[i] = voice(i / rate);

  return { sampleRate: rate, numberOfChannels: 1, getChannelData: () => data, duration: seconds };
};

const beat = (t: number) => (t * 2) % 1;
const sources = {
  drums: synth(16, (t) => Math.exp(-beat(t) * 18) * Math.sin(t * 2 * Math.PI * 60 * (1 - beat(t) * 0.5))),
  bass: synth(16, (t) => 0.6 * Math.sin(t * 2 * Math.PI * 55) * (0.6 + 0.4 * Math.sin(t * Math.PI))),
  keys: synth(12, (t) => 0.4 * Math.sin(t * 2 * Math.PI * 330) * Math.max(0, Math.sin(t * Math.PI * 0.5))),
  vocal: synth(10, (t) => 0.7 * Math.sin(t * 2 * Math.PI * 220) * Math.abs(Math.sin(t * 3)) * Math.exp(-((t % 2.5) * 0.6))),
};

const container = document.getElementById('timeline')!;
const timeline = new StudioTimeline(container, {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 96 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
});

timeline.load({
  tracks: [
    { id: 'drums', name: 'Drums' },
    { id: 'bass', name: 'Bass' },
    { id: 'keys', name: 'Keys' },
    { id: 'vocal', name: 'Vocal' },
  ],
  clips: Object.entries(sources).map(([id, audio], i) =>
    makeClip({ track: id, source: id, name: id[0]!.toUpperCase() + id.slice(1), start: i * 2, offset: 0, duration: audio.duration, fadeIn: i === 3 ? 1 : 0 }),
  ),
});

const waveforms = new Waveforms();

for (const [id, audio] of Object.entries(sources)) {
  timeline.setSource({ id, duration: audio.duration });
  waveforms.get(`demo:${id}`, () => audio).then((peaks) => timeline.setSource({ id }, peaks));
}

const button = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener('click', fn);
const undo = document.getElementById('undo') as HTMLButtonElement;
const redo = document.getElementById('redo') as HTMLButtonElement;
const info = document.getElementById('info')!;

button('split', () => timeline.split());
button('duplicate', () => timeline.duplicateSelected());
button('delete', () => timeline.deleteSelected());
button('undo', () => timeline.undo());
button('redo', () => timeline.redo());
button('zoom-in', () => timeline.setZoom(timeline.pxPerSecond * 1.5));
button('zoom-out', () => timeline.setZoom(timeline.pxPerSecond / 1.5));
button('fit', () => timeline.fit());

document.getElementById('snap')!.addEventListener('change', (e) => timeline.setGrid({ snap: (e.target as HTMLSelectElement).value as SnapTo }));

const refresh = () => {
  undo.disabled = !timeline.history.canUndo;
  redo.disabled = !timeline.history.canRedo;
  undo.title = timeline.history.info.undoLabel ?? '';
  info.textContent = `${timeline.state.clips.length} clips · ${timeline.selection.length} selected · ${timeline.time.toFixed(2)}s`;
};

timeline.history.on('change', refresh);
timeline.on('select', refresh);
timeline.on('seek', refresh);
timeline.on('change', refresh);
refresh();

Object.assign(window, { timeline });
