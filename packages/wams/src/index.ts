import { CURATED_WAMS, type CuratedWam } from './catalog.ts';
import { WAMS_VERSION } from './version.ts';

export * from './catalog.ts';
export * from './version.ts';

export interface CuratedWamsOptions {
  /**
   * Where the package's `plugins` folder is served, ending in a slash. By default
   * jsDelivr, pinned to this package's version, so the code never changes under you.
   */
  base?: string;
  /** Which of the plugins to offer */
  allow?: (plugin: CuratedWam) => boolean;
}

/** A plugin ready for the browser's plugin tabs or the mixer's catalog. */
export interface CuratedWamItem {
  id: string;
  name: string;
  kind: 'plugin';
  url: string;
  detail: string;
  /** A picture of its editor, when it has one */
  image?: string;
  data: CuratedWam;
}

/** The `plugins` folder of a version of this package on jsDelivr. */
export const wamsBase = (version = WAMS_VERSION) => `https://cdn.jsdelivr.net/npm/@toneflix/studio-wams@${version}/plugins/`;

/** The curated plugins, with their module URLs under `base`. */
export const curatedWams = (options: CuratedWamsOptions = {}): CuratedWamItem[] => {
  const base = options.base ?? wamsBase();

  return CURATED_WAMS.filter((plugin) => options.allow?.(plugin) ?? true).map((plugin) => ({
    id: plugin.identifier,
    name: plugin.name,
    kind: 'plugin',
    url: new URL(plugin.path, base).href,
    detail: `${plugin.vendor} · ${plugin.description}`,
    ...(plugin.thumbnail && { image: new URL(plugin.thumbnail, base).href }),
    data: plugin,
  }));
};

export interface CuratedWamSourceOptions extends CuratedWamsOptions {
  id?: string;
  label?: string;
}

/**
 * A tab of the curated plugins for `StudioBrowser`, searched by name, vendor,
 * description and keywords.
 */
export const curatedWamSource = (options: CuratedWamSourceOptions = {}) => {
  const items = curatedWams(options);

  return {
    id: options.id ?? 'curated-wams',
    label: options.label ?? 'Plugins',
    list: ({ search }: { search: string }) => {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      const found = items.filter((item) => {
        const text = `${item.name} ${item.detail} ${item.data.keywords.join(' ')}`.toLowerCase();

        return words.every((word) => text.includes(word));
      });

      return { items: found, more: false };
    },
  };
};
