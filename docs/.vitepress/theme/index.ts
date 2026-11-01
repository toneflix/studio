import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import HeroShot from './HeroShot.vue';
import StudioPlayground from './StudioPlayground.vue';

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(HeroShot) }),
  enhanceApp({ app }) {
    app.component('StudioPlayground', StudioPlayground);
  },
} satisfies Theme;
