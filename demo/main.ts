import {
  AudioEngine,
  filesSource,
  importAudioFiles,
  linkPlayback,
  linkNoteRecorder,
  linkRecorder,
  listSource,
  NoteRecorder,
  PluginRack,
  Recorder,
  curatedWams,
  curatedWamSource,
  sessionSource,
  StudioBrowser,
  StudioInstrumentPanel,
  StudioKeys,
  StudioMixer,
  StudioPianoRoll,
  StudioTimeline,
  StudioToolbar,
  trackStrip,
  uid,
  Waveforms,
} from '@toneflix/studio';
import { demoSounds, loadSample } from './sample.ts';

const engine = new AudioEngine();
const recorder = new Recorder(engine);
// Records notes played on the keys onto instrument tracks
const notes = new NoteRecorder(engine);
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
// Play instrument tracks on screen, from the computer keyboard (A to ;) or a MIDI device
const keys = new StudioKeys('#timeline', { timeline, engine, recorder, notes, hidden: true });
// Knobs for instrument tracks, from a track's menu or the piano roll's Sound button
const instruments = new StudioInstrumentPanel({ timeline, engine });
// Opens on a double-click on a note clip; its Keys button shows the keys
const pianoRoll = new StudioPianoRoll('#timeline', { timeline, engine, keys, instrumentPanel: instruments, hidden: true });
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
  ],
});
const toolbar = new StudioToolbar('#toolbar', {
  timeline,
  engine,
  mixer,
  browser,
  keys,
  recorder,
  notes,
  plugins,
  app: { name: 'Toneflix Studio', id: 'toneflix-studio-demo', version: '0.4', description: 'Demo session', copyright: '© Toneflix', extension: 'tfstudio' },
  onProjectSource: (id, buffer) => void waveforms.get(`project:${id}:${buffer.length}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  onProjectOpen: ({ missing }) => missing.length && console.warn('Audio not found:', missing),
});
loadSample(timeline, { engine, waveforms });
timeline.showAutomation('keys', 'volume');
linkPlayback(timeline, engine);
linkRecorder(timeline, recorder, { waveforms });
linkNoteRecorder(timeline, notes);

Object.assign(window, { timeline, engine, mixer, pianoRoll, instruments, keys, notes, browser, recorder, plugins, toolbar, StudioToolbar });
