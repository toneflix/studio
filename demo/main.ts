import { AudioEngine, linkPlayback, StudioTimeline, StudioToolbar, trackStrip, uid } from '@toneflix/studio';
import { loadSample } from './sample.ts';

const engine = new AudioEngine();
const timeline = new StudioTimeline('#timeline', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 120 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  renderHeader: trackStrip(engine),
});

new StudioToolbar('#toolbar', { timeline, engine });
loadSample(timeline, { engine });
linkPlayback(timeline, engine);

const info = document.getElementById('info')!;
const refresh = () => {
  info.textContent = `${timeline.state.clips.length} clips · ${timeline.selection.length} selected · ${timeline.time.toFixed(2)}s`;
};

timeline.on('select', refresh);
timeline.on('seek', refresh);
timeline.on('change', refresh);
engine.on('pause', refresh);
engine.on('seek', refresh);
refresh();

Object.assign(window, { timeline, engine });
