import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Landing from './Landing.vue';
import StudioPlayground from './StudioPlayground.vue';
import './brand.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Landing', Landing);
    app.component('StudioPlayground', StudioPlayground);
  },
} satisfies Theme;
