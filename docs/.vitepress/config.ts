import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@toneflix/studio',
  description: 'The studio engine for the web: multitrack audio editing that feels like a desktop DAW, in any browser app.',
  base: process.env.DOCS_BASE || '/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#4f9cf9' }]],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/timeline' },
      { text: 'Playground', link: '/playground' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Editing', link: '/guide/editing' },
          { text: 'Waveforms', link: '/guide/waveforms' },
          { text: 'Undo history', link: '/guide/history' },
          { text: 'Styling and headers', link: '/guide/styling' },
          { text: 'Saving projects', link: '/guide/saving' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: 'StudioTimeline', link: '/api/timeline' },
          { text: 'Model and history', link: '/api/model' },
          { text: 'Edits', link: '/api/edits' },
          { text: 'Waveforms', link: '/api/waveforms' },
        ],
      },
      { text: 'Playground', link: '/playground' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/toneflix/studio' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@toneflix/studio' },
    ],
    editLink: { pattern: 'https://github.com/toneflix/studio/edit/main/docs/:path' },
    search: { provider: 'local' },
    footer: { message: 'Released under the MIT License.' },
  },
});
