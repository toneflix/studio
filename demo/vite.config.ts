import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  resolve: { conditions: ['@toneflix/source', ...defaultClientConditions] },
});
