import { AudioEngine, encodeWav, linkPlayback, StudioTimeline, uid, type SnapTo } from '@toneflix/studio';
import { mixerHeader } from './mixer-header.ts';
import { loadSample } from './sample.ts';

const container = document.getElementById('timeline')!;
const engine = new AudioEngine();
const timeline = new StudioTimeline(container, {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 96 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  renderHeader: mixerHeader(engine),
});

loadSample(timeline, { engine });
linkPlayback(timeline, engine);

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
button('play', () => engine.toggle());
button('stop', () => engine.stop());
button('loop', () => {
  const range = timeline.range;

  engine.setLoop(engine.loop ? null : range ? { start: range.start, end: range.end } : { start: 0, end: 8 });
});
button('click', () => {
  engine.metronome.enabled = !engine.metronome.enabled;
  document.getElementById('click')!.setAttribute('aria-pressed', String(engine.metronome.enabled));
});
button('export', async () => {
  const mix = await engine.render();
  const link = document.createElement('a');

  link.href = URL.createObjectURL(new Blob([encodeWav(mix)], { type: 'audio/wav' }));
  link.download = 'mix.wav';
  link.click();
  URL.revokeObjectURL(link.href);
});
engine.on('play', () => (document.getElementById('play')!.textContent = 'Pause'));
engine.on('pause', () => (document.getElementById('play')!.textContent = 'Play'));
engine.on('loop', ({ loop }) => document.getElementById('loop')!.setAttribute('aria-pressed', String(!!loop)));

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
engine.on('pause', refresh);
engine.on('seek', refresh);
refresh();

Object.assign(window, { timeline, engine });
