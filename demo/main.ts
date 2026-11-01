import { AudioEngine, linkPlayback, StudioTimeline, StudioToolbar, trackStrip, uid } from '@toneflix/studio';
import { loadSample } from './sample.ts';

const engine = new AudioEngine();
const timeline = new StudioTimeline('#timeline', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 120 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  renderHeader: trackStrip(engine),
});

const toolbar = new StudioToolbar('#toolbar', { timeline, engine });
loadSample(timeline, { engine });
linkPlayback(timeline, engine);

Object.assign(window, { timeline, engine, toolbar, StudioToolbar });
