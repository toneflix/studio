import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  // The docs' public folder holds the demo plugins
  publicDir: '../docs/public',
  resolve: { conditions: ['@toneflix/source', ...defaultClientConditions] },
});
