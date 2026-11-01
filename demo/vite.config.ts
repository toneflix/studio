import { defaultClientConditions, defineConfig } from 'vite';
import { serveWams } from '../scripts/vite-wams.ts';

export default defineConfig({
  plugins: [serveWams()],
  resolve: { conditions: ['@toneflix/source', ...defaultClientConditions] },
});
