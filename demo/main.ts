import { AudioEngine, linkPlayback, linkRecorder, Recorder, StudioMixer, StudioTimeline, StudioToolbar, trackStrip, uid, Waveforms } from '@toneflix/studio';
import { loadSample } from './sample.ts';

const engine = new AudioEngine();
const recorder = new Recorder(engine);
const waveforms = new Waveforms();
const timeline = new StudioTimeline('#timeline', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 120 : 180,
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  renderHeader: trackStrip(engine, { recorder }),
});

const mixer = new StudioMixer('#timeline', { timeline, engine, hidden: true });
const toolbar = new StudioToolbar('#toolbar', { timeline, engine, mixer, recorder });
loadSample(timeline, { engine, waveforms });
linkPlayback(timeline, engine);
linkRecorder(timeline, recorder, { waveforms });

Object.assign(window, { timeline, engine, mixer, recorder, toolbar, StudioToolbar });
