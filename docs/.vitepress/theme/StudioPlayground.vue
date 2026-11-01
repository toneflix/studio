<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 420 });
const bar = ref<HTMLElement>();
const host = ref<HTMLElement>();
let cleanup = () => {};

onMounted(async () => {
  const { AudioEngine, linkPlayback, StudioMixer, StudioTimeline, StudioToolbar, trackStrip, uid } = await import('@toneflix/studio');
  const { loadSample } = await import('../../../demo/sample.ts');
  const engine = new AudioEngine();
  const timeline = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: host.value!.clientWidth < 600 ? 120 : 160,
    createTrack: () => ({ id: uid('t'), name: 'New stem' }),
    renderHeader: trackStrip(engine),
  });
  const mixer = new StudioMixer(host.value!, { timeline, engine, hidden: true });
  const toolbar = new StudioToolbar(bar.value!, { timeline, engine, mixer });

  loadSample(timeline, { engine });

  const unlink = linkPlayback(timeline, engine);

  cleanup = () => {
    unlink();
    toolbar.destroy();
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
    <p class="studio-playground__hint">Press Space to play. Click the ruler to move the playhead, then split and drag the pieces. Select a range before Loop to loop it. The sliders button opens the mixer.</p>
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
