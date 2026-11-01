<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

<template>
  <div class="hero-shot">
    <img :src="withBase('/screenshot.png')" alt="A multitrack timeline with drums, bass, keys and vocal clips, one drum clip split and moved" />
  </div>
</template>

<style scoped>
.hero-shot {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px 48px;
}
.hero-shot img {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
@media (min-width: 960px) {
  .hero-shot {
    padding: 0 64px 64px;
  }
}
</style>
