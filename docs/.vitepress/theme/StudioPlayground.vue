<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 420 });
const bar = ref<HTMLElement>();
const host = ref<HTMLElement>();
let cleanup = () => {};

onMounted(async () => {
  const studio = await import('@toneflix/studio');
  const { AudioEngine, linkNoteRecorder, linkPlayback, linkRecorder, NoteRecorder, PluginRack, Recorder, StudioBrowser, StudioKeys, StudioMixer, StudioPianoRoll, StudioTimeline, StudioToolbar, trackStrip, uid, Waveforms } = studio;
  const { demoSounds, loadSample } = await import('../../../demo/sample.ts');
  const engine = new AudioEngine();
  const recorder = new Recorder(engine);
  const notes = new NoteRecorder(engine);
  const plugins = new PluginRack(engine);

  engine.setInstruments(plugins.instruments());
  const waveforms = new Waveforms();
  const wams = { base: new URL(withBase('/wams/'), location.href).href };
  const timeline = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: host.value!.clientWidth < 600 ? 120 : 160,
    createTrack: () => ({ id: uid('t'), name: `Track ${timeline.state.tracks.length + 1}` }),
    renderHeader: trackStrip(engine, { recorder }),
    importAudio: (files) => studio.importAudioFiles(timeline, engine, files, { onSource: (id, buffer) => void waveforms.get(`file:${id}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)) }),
  });
  const catalog = studio.curatedWams(wams);
  const mixer = new StudioMixer(host.value!, { timeline, engine, plugins, catalog, hidden: true });
  const keys = new StudioKeys(host.value!, { timeline, engine, recorder, notes, hidden: true });
  const pianoRoll = new StudioPianoRoll(host.value!, { timeline, engine, keys, hidden: true });
  const browser = new StudioBrowser(host.value!, {
    timeline,
    engine,
    plugins,
    hidden: true,
    onSource: (id, buffer) => void waveforms.get(`library:${id}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
    sources: [
      studio.listSource('sounds', 'Sounds', demoSounds(engine)),
      studio.sessionSource(timeline, engine),
      studio.filesSource(document),
      studio.curatedWamSource(wams),
    ],
  });
  const toolbar = new StudioToolbar(bar.value!, {
    timeline,
    engine,
    mixer,
    browser,
    keys,
    recorder,
    notes,
    plugins,
    onProjectSource: (id, buffer) => void waveforms.get(`project:${id}:${buffer.length}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  });

  loadSample(timeline, { engine, waveforms });
  timeline.showAutomation('keys', 'volume');

  const unlink = linkPlayback(timeline, engine);
  const unlinkRecorder = linkRecorder(timeline, recorder, { waveforms });
  const unlinkNotes = linkNoteRecorder(timeline, notes);

  cleanup = () => {
    unlink();
    unlinkRecorder();
    unlinkNotes();
    recorder.destroy();
    notes.destroy();
    keys.destroy();
    toolbar.destroy();
    plugins.destroy();
    mixer.destroy();
    pianoRoll.destroy();
    browser.destroy();
    engine.destroy();
    timeline.destroy();
  };
});

onBeforeUnmount(() => cleanup());
</script>

<template>
  <div class="studio-playground">
    <div ref="bar" class="studio-playground__bar" />
    <div ref="host" class="studio-playground__timeline" :style="{ height: `${props.height}px` }" />
    <p class="studio-playground__hint">Press Space to play. Click the ruler to move the playhead, then split and drag the pieces. Drag on the ruler to pick a range to loop, or on the tracks to select clips. Drag the Keys volume curve, and right-click the ruler to add a marker or tempo change. The library button opens the browser: listen to a sound, then drag it onto a track. Arm a track with R and press the red button to record over the music. The sliders button opens the mixer, where + adds an Echo or Drive plugin to a track. Double-click the Lead or Beat clip to edit its notes in the piano roll.</p>
  </div>
</template>

<style scoped>
.studio-playground {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.studio-playground__bar {
  --tfs-toolbar-bg: var(--vp-c-bg-soft);
  --tfs-toolbar-text: var(--vp-c-text-1);
  --tfs-toolbar-active: var(--vp-c-brand-1);
  --tfs-toolbar-active-text: var(--tf-on-primary, #03141c);
  --tfs-toolbar-line: var(--vp-c-divider);
}
.studio-playground__hint {
  margin: 0 !important;
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 13px;
}
</style>
