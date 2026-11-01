<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { AudioEngine, StudioTimeline } from '@toneflix/studio';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 420 });
const host = ref<HTMLElement>();
const timeline = shallowRef<StudioTimeline>();
const engine = shallowRef<AudioEngine>();
const playing = ref(false);
const looping = ref(false);
const clicking = ref(false);
let unlink = () => {};
const canUndo = ref(false);
const canRedo = ref(false);

onMounted(async () => {
  const { AudioEngine, linkPlayback, StudioTimeline, uid } = await import('@toneflix/studio');
  const { loadSample } = await import('../../../demo/sample.ts');
  const { mixerHeader } = await import('../../../demo/mixer-header.ts');
  const audio = new AudioEngine();
  const view = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: host.value!.clientWidth < 600 ? 96 : 150,
    createTrack: () => ({ id: uid('t'), name: 'New stem' }),
    renderHeader: mixerHeader(audio),
  });

  view.history.on('change', (info) => {
    canUndo.value = info.canUndo;
    canRedo.value = info.canRedo;
  });

  audio.on('play', () => (playing.value = true));
  audio.on('pause', () => (playing.value = false));
  audio.on('end', () => (playing.value = false));
  audio.on('loop', ({ loop }) => (looping.value = !!loop));

  loadSample(view, { engine: audio });
  unlink = linkPlayback(view, audio);
  timeline.value = view;
  engine.value = audio;
});

const toggleLoop = () => {
  const range = timeline.value?.range;

  engine.value?.setLoop(looping.value ? null : range ? { start: range.start, end: range.end } : { start: 0, end: 8 });
};

const toggleClick = () => {
  if (!engine.value) return;

  clicking.value = !clicking.value;
  engine.value.metronome.enabled = clicking.value;
};

onBeforeUnmount(() => {
  unlink();
  engine.value?.destroy();
  timeline.value?.destroy();
});
</script>

<template>
  <div class="studio-playground">
    <div class="studio-playground__bar">
      <button type="button" class="primary" @click="engine?.toggle()">{{ playing ? 'Pause' : 'Play' }}</button>
      <button type="button" @click="engine?.stop()">Stop</button>
      <button type="button" :aria-pressed="looping" @click="toggleLoop">Loop</button>
      <button type="button" :aria-pressed="clicking" @click="toggleClick">Click</button>
      <button type="button" @click="timeline?.split()">Split</button>
      <button type="button" :disabled="!canUndo" @click="timeline?.undo()">Undo</button>
      <button type="button" :disabled="!canRedo" @click="timeline?.redo()">Redo</button>
      <button type="button" @click="timeline?.fit()">Fit</button>
      <span>Press Space to play. Click the ruler to move the playhead, then split and drag the pieces. Select a range before Loop to loop it.</span>
    </div>
    <div ref="host" class="studio-playground__timeline" :style="{ height: `${props.height}px` }" />
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}
.studio-playground__bar button {
  padding: 2px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
}
.studio-playground__bar button.primary,
.studio-playground__bar button[aria-pressed='true'] {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: var(--tf-on-primary, #03141c);
}
.studio-playground__bar button:disabled {
  opacity: 0.4;
}
.studio-playground__bar span {
  margin-left: 4px;
  color: var(--vp-c-text-2);
}
</style>
