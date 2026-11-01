import { AudioEngine, linkPlayback, linkRecorder, PluginRack, Recorder, StudioMixer, StudioTimeline, StudioToolbar, trackStrip, uid, Waveforms } from '@toneflix/studio';
import { loadSample } from './sample.ts';

const engine = new AudioEngine();
const recorder = new Recorder(engine);
const plugins = new PluginRack(engine);
const waveforms = new Waveforms();
const timeline = new StudioTimeline('#timeline', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 120 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  renderHeader: trackStrip(engine, { recorder }),
});

// Full URLs, so the dev server hands the plugin files over untouched
const catalog = [
  { name: 'Echo', url: new URL('/plugins/echo.js', location.href).href },
  { name: 'Drive', url: new URL('/plugins/drive.js', location.href).href },
];
const mixer = new StudioMixer('#timeline', { timeline, engine, plugins, catalog, hidden: true });
const toolbar = new StudioToolbar('#toolbar', { timeline, engine, mixer, recorder, plugins });
loadSample(timeline, { engine, waveforms });
linkPlayback(timeline, engine);
linkRecorder(timeline, recorder, { waveforms });

Object.assign(window, { timeline, engine, mixer, recorder, plugins, toolbar, StudioToolbar });
