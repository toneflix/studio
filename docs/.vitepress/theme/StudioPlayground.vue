<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 420 });
const bar = ref<HTMLElement>();
const host = ref<HTMLElement>();
let cleanup = () => {};

onMounted(async () => {
  const { AudioEngine, linkPlayback, linkRecorder, PluginRack, Recorder, StudioMixer, StudioTimeline, StudioToolbar, trackStrip, uid, Waveforms } = await import('@toneflix/studio');
  const { loadSample } = await import('../../../demo/sample.ts');
  const engine = new AudioEngine();
  const recorder = new Recorder(engine);
  const plugins = new PluginRack(engine);
  const waveforms = new Waveforms();
  const plugin = (name: string, file: string) => ({ name, url: new URL(withBase(`/plugins/${file}`), location.href).href });
  const timeline = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: host.value!.clientWidth < 600 ? 120 : 160,
    createTrack: () => ({ id: uid('t'), name: `Track ${timeline.state.tracks.length + 1}` }),
    renderHeader: trackStrip(engine, { recorder }),
  });
  const mixer = new StudioMixer(host.value!, { timeline, engine, plugins, catalog: [plugin('Echo', 'echo.js'), plugin('Drive', 'drive.js')], hidden: true });
  const toolbar = new StudioToolbar(bar.value!, { timeline, engine, mixer, recorder, plugins });

  loadSample(timeline, { engine, waveforms });
  timeline.showAutomation('keys', 'volume');

  const unlink = linkPlayback(timeline, engine);
  const unlinkRecorder = linkRecorder(timeline, recorder, { waveforms });

  cleanup = () => {
    unlink();
    unlinkRecorder();
    recorder.destroy();
    toolbar.destroy();
    plugins.destroy();
    mixer.destroy();
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
    <p class="studio-playground__hint">Press Space to play. Click the ruler to move the playhead, then split and drag the pieces. Drag on the ruler to pick a range to loop, or on the tracks to select clips. Drag the Keys volume curve, and add markers or tempo changes with the + buttons under the ruler. Arm a track with R and press the red button to record over the music. The sliders button opens the mixer, where + adds an Echo or Drive plugin to a track.</p>
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
