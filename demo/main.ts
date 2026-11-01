import {
  AudioEngine,
  filesSource,
  importAudioFiles,
  linkPlayback,
  linkRecorder,
  listSource,
  PluginRack,
  Recorder,
  curatedWams,
  curatedWamSource,
  sessionSource,
  StudioBrowser,
  StudioMixer,
  StudioPianoRoll,
  StudioTimeline,
  StudioToolbar,
  trackStrip,
  uid,
  wamCommunitySource,
  Waveforms,
} from '@toneflix/studio';
import { demoSounds, loadSample } from './sample.ts';

const engine = new AudioEngine();
const recorder = new Recorder(engine);
const plugins = new PluginRack(engine);

// Instrument tracks play the built-in synth and drums, or a WAM instrument by URL
engine.setInstruments(plugins.instruments());
const waveforms = new Waveforms();
const timeline = new StudioTimeline('#timeline', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  headerWidth: innerWidth < 600 ? 120 : 180,
  createTrack: () => ({ id: uid('t'), name: `Track ${timeline.state.tracks.length + 1}` }),
  renderHeader: trackStrip(engine, { recorder }),
  // The add track menu's "Audio from a file" puts picked files on new tracks
  importAudio: (files) => importAudioFiles(timeline, engine, files, { onSource: drawWaveform }),
});

// The curated plugins, served by the dev server; apps use jsDelivr, the default
const wams = { base: new URL('/wams/', location.href).href };
const catalog = curatedWams(wams);
const mixer = new StudioMixer('#timeline', { timeline, engine, plugins, catalog, hidden: true });
// Opens on a double-click on a note clip
const pianoRoll = new StudioPianoRoll('#timeline', { timeline, engine, hidden: true });
const drawWaveform = (id: string, buffer: AudioBuffer) => void waveforms.get(`library:${id}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks));
const browser = new StudioBrowser('#timeline', {
  timeline,
  engine,
  plugins,
  hidden: true,
  onSource: drawWaveform,
  sources: [
    listSource('sounds', 'Sounds', demoSounds(engine)),
    sessionSource(timeline, engine),
    filesSource(document),
    curatedWamSource(wams),
    // Community plugins run as code in this page; a demo with no sign-in can take them all
    wamCommunitySource({ allow: () => true }),
  ],
});
const toolbar = new StudioToolbar('#toolbar', {
  timeline,
  engine,
  mixer,
  browser,
  recorder,
  plugins,
  app: { name: 'Toneflix Studio', id: 'toneflix-studio-demo', version: '0.4', description: 'Demo session', copyright: '© Toneflix', extension: 'tfstudio' },
  onProjectSource: (id, buffer) => void waveforms.get(`project:${id}:${buffer.length}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  onProjectOpen: ({ missing }) => missing.length && console.warn('Audio not found:', missing),
});
loadSample(timeline, { engine, waveforms });
timeline.showAutomation('keys', 'volume');
linkPlayback(timeline, engine);
linkRecorder(timeline, recorder, { waveforms });

Object.assign(window, { timeline, engine, mixer, pianoRoll, browser, recorder, plugins, toolbar, StudioToolbar });
