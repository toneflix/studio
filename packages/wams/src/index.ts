import { CURATED_WAMS, type CuratedWam } from './catalog.ts';
import { COMMUNITY_WAMS, communityWamsBase, type CommunityWam } from './community.ts';
import { WAMS_VERSION } from './version.ts';

export * from './catalog.ts';
export * from './community.ts';
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

/** A browser tab over a fixed list, searched by name, detail and keywords. */
const searchSource = <T extends { name: string; detail: string; data: { keywords: string[] } }>(id: string, label: string, items: T[]) => {
  return {
    id,
    label,
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

/**
 * A tab of the curated plugins for `StudioBrowser`, searched by name, vendor,
 * description and keywords.
 */
export const curatedWamSource = (options: CuratedWamSourceOptions = {}) => searchSource(options.id ?? 'curated-wams', options.label ?? 'Plugins', curatedWams(options));

export interface CommunityWamsOptions {
  /**
   * Where the community `plugins` folder is served, ending in a slash. By default
   * jsDelivr, pinned to the version the plugins were tested at.
   */
  base?: string;
  /** Which of the plugins to offer */
  allow?: (plugin: CommunityWam) => boolean;
}

/** A vetted community plugin with its module URL. */
export interface CommunityWamItem extends Omit<CuratedWamItem, 'data'> {
  data: CommunityWam;
}

/** The vetted community plugins, effects and instruments, with their module URLs under `base`. */
export const communityWams = (options: CommunityWamsOptions = {}): CommunityWamItem[] => {
  const base = options.base ?? communityWamsBase();

  return COMMUNITY_WAMS.filter((plugin) => options.allow?.(plugin) ?? true).map((plugin) => ({
    id: plugin.identifier,
    name: plugin.name,
    kind: 'plugin',
    url: new URL(plugin.path, base).href,
    detail: `${plugin.vendor} · ${plugin.description}`,
    image: new URL(plugin.thumbnail, base).href,
    data: plugin,
  }));
};

/** A tab of the vetted community effects for `StudioBrowser`. */
export const communityWamSource = (options: CommunityWamsOptions & { id?: string; label?: string } = {}) =>
  searchSource(
    options.id ?? 'community-wams',
    options.label ?? 'Community',
    communityWams({ ...options, allow: (plugin) => !plugin.isInstrument && (options.allow?.(plugin) ?? true) }),
  );

/** The vetted community instruments, as choices for `StudioInstrumentPanel`'s `instruments`. */
export const communityWamInstruments = (options: CommunityWamsOptions = {}) =>
  communityWams({ ...options, allow: (plugin) => plugin.isInstrument && (options.allow?.(plugin) ?? true) }).map((item) => ({
    label: item.name,
    instrument: { id: item.url },
  }));

/**
 * True for a vetted community plugin whose editor only answers the mouse. Pass it
 * as `new PluginRack(engine, { mouseOnly })` so touches work on its editor.
 */
export const isMouseOnlyWam = (url: string, options: Pick<CommunityWamsOptions, 'base'> = {}) =>
  communityWams(options).some((item) => item.url === url && item.data.mouseOnly);
