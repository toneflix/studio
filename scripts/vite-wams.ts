import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** The curated plugins, served by the demo and the docs at `<base>wams/`. */
const root = resolve(import.meta.dirname, '../packages/wams/plugins');
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

/** Serves the curated plugins at `wams/` under the site's base while developing. */
export const serveWams = (): Plugin => {
  let base = '/';

  return {
    name: 'toneflix-wams',
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use(`${base}wams`, (req, res, next) => {
        const file = join(root, normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)));

        if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();

        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
};

/** Copies the curated plugins into a built site's `wams` folder. */
export const copyWams = (outDir: string) => cpSync(root, join(outDir, 'wams'), { recursive: true });
