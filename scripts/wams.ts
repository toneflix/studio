import { writeFileSync } from 'node:fs';
import { CURATED_WAMS } from '../packages/wams/src/catalog.ts';

/** Writes the curated plugins' list in the WAM community list's shape. Run with `node scripts/wams.ts`. */
writeFileSync('packages/wams/plugins/plugins.json', JSON.stringify(CURATED_WAMS, null, 2) + '\n');
