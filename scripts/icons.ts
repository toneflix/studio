import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Writes the default icons of @toneflix/studio-controls from the lucide package. */
const icons: Record<string, string> = {
  play: 'play',
  pause: 'pause',
  stop: 'square',
  loop: 'repeat',
  metronome: 'metronome',
  split: 'scissors',
  duplicate: 'copy-plus',
  delete: 'trash',
  undo: 'undo-2',
  redo: 'redo-2',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  fit: 'maximize-2',
  export: 'download',
  snap: 'magnet',
  mute: 'volume-x',
  solo: 'headphones',
  info: 'info',
  save: 'save',
  close: 'x',
  mixer: 'sliders-vertical',
};

/** Icons drawn as solid shapes, like the transport buttons on hardware. */
const filled = new Set(['play', 'pause', 'stop']);

const root = dirname(createRequire(import.meta.url).resolve('lucide/package.json'));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const attrs = (a: Record<string, string>) => Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('');

const lines = Object.entries(icons).map(([name, file]) => {
  const source = readFileSync(join(root, 'dist/esm/icons', `${file}.mjs`), 'utf8');
  const nodes = JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1).replace(/(\w+):/g, '"$1":')) as [string, Record<string, string>][];
  const body = nodes.map(([tag, a]) => `<${tag}${attrs(filled.has(name) ? { ...a, fill: 'currentColor' } : a)}/>`).join('');

  return `  ${name}: '${body}',`;
});

writeFileSync(
  'packages/controls/src/lucide.ts',
  `/**
 * Default icons, from Lucide ${version} (https://lucide.dev, ISC License,
 * Copyright (c) Lucide Icons and Contributors). Made by \`node scripts/icons.ts\`.
 */
export const lucideIcons = {
${lines.join('\n')}
};
`,
);
