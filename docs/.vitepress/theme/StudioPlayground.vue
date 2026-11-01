<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { StudioTimeline } from '../../../src/index.ts';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 420 });
const host = ref<HTMLElement>();
const timeline = shallowRef<StudioTimeline>();
const canUndo = ref(false);
const canRedo = ref(false);

onMounted(async () => {
  const { StudioTimeline, uid } = await import('../../../src/index.ts');
  const { loadSample } = await import('../../../demo/sample.ts');
  const view = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: host.value!.clientWidth < 600 ? 96 : 150,
    createTrack: () => ({ id: uid('t'), name: 'New stem' }),
  });

  view.history.on('change', (info) => {
    canUndo.value = info.canUndo;
    canRedo.value = info.canRedo;
  });

  loadSample(view);
  timeline.value = view;
});

onBeforeUnmount(() => timeline.value?.destroy());
</script>

<template>
  <div class="studio-playground">
    <div class="studio-playground__bar">
      <button type="button" @click="timeline?.split()">Split</button>
      <button type="button" :disabled="!canUndo" @click="timeline?.undo()">Undo</button>
      <button type="button" :disabled="!canRedo" @click="timeline?.redo()">Redo</button>
      <button type="button" @click="timeline?.fit()">Fit</button>
      <span>Click the ruler to move the playhead, then split and drag the pieces.</span>
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
.studio-playground__bar button:disabled {
  opacity: 0.4;
}
.studio-playground__bar span {
  margin-left: 4px;
  color: var(--vp-c-text-2);
}
</style>
