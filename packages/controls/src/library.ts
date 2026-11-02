import type { AudioEngine } from '@toneflix/studio-audio';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import type { PluginChoice } from './inserts.ts';

/** Something the browser lists: a sound to put on a track, or a plugin to add to one. */
export interface LibraryItem {
  /** Unique within its source */
  id: string;
  name: string;
  kind: 'audio' | 'plugin';
  /** A second line, like the artist, vendor or tags */
  detail?: string;
  /** A picture shown in place of the kind icon, like a plugin's editor */
  image?: string;
  /** Length in seconds, shown beside audio */
  duration?: number;
  /** Audio: where to fetch the file. Plugin: the Web Audio Module's URL */
  url?: string;
  /** Audio: get the file yourself, for example with your own auth; used instead of `url` */
  load?: (signal: AbortSignal) => Promise<Blob | ArrayBuffer | AudioBuffer>;
  /** Audio: a shorter or lighter file to listen to before adding it; `url` or `load` otherwise */
  preview?: string;
  /** Audio: the session source id to use, so a sound added twice shares its audio; made from the source and item ids otherwise */
  source?: string;
  /** Anything your app wants back in the browser's events */
  data?: unknown;
}

export interface LibraryQuery {
  search: string;
  /** From 1 */
  page: number;
  /** Aborted when the search changes or the browser closes */
  signal: AbortSignal;
}

export interface LibraryPage {
  items: LibraryItem[];
  /** There is another page */
  more?: boolean;
}

/** A tab in the browser, with items from anywhere: the app's library, a sound search, plugins. */
export interface LibrarySource {
  id: string;
  label: string;
  list: (query: LibraryQuery) => LibraryPage | Promise<LibraryPage>;
  /** A button above the list, like Import files; the list reloads after it runs */
  action?: { label: string; run: () => void | Promise<void> };
  /**
   * Shows a remove button on each item, like Delete on your own uploads.
   * Ask first if you need to; return false to keep the item, and the row goes otherwise.
   */
  remove?: (item: LibraryItem) => boolean | void | Promise<boolean | void>;
}

export interface ListSourceOptions {
  /** Items per page */
  pageSize?: number;
}

/** Matches every word of a search against an item's name and detail. */
export const matchesSearch = (item: Pick<LibraryItem, 'name' | 'detail'>, search: string) => {
  const text = `${item.name} ${item.detail ?? ''}`.toLowerCase();

  return search
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
};

/** A source over a fixed list, or a function that gives one; search and paging happen in the browser. */
export const listSource = (
  id: string,
  label: string,
  items: readonly LibraryItem[] | ((signal: AbortSignal) => readonly LibraryItem[] | Promise<readonly LibraryItem[]>),
  options: ListSourceOptions = {},
): LibrarySource => {
  const size = options.pageSize ?? 50;

  return {
    id,
    label,
    list: async ({ search, page, signal }) => {
      const all = typeof items === 'function' ? await items(signal) : items;
      const found = search.trim() ? all.filter((item) => matchesSearch(item, search)) : all;

      return { items: found.slice((page - 1) * size, page * size), more: found.length > page * size };
    },
  };
};

/** The sounds the session's clips use, to place them again. */
export const sessionSource = (timeline: StudioTimeline, engine: AudioEngine, label = 'Loaded'): LibrarySource =>
  listSource('session', label, () => {
    const names = new Map<string, string>();

    for (const clip of timeline.state.clips) if (!names.has(clip.source)) names.set(clip.source, clip.name ?? clip.source);

    return [...names].flatMap(([source, name]) => {
      const buffer = engine.getBuffer(source);

      return buffer ? [{ id: source, source, name, kind: 'audio' as const, duration: buffer.duration, load: async () => buffer }] : [];
    });
  });

export interface FilesSourceOptions {
  label?: string;
  /** Text of the import button */
  importLabel?: string;
}

/**
 * Audio files people pick from their device. They stay in the page until it
 * closes; nothing is uploaded.
 */
export const filesSource = (doc: Document, options: FilesSourceOptions = {}): LibrarySource & { add: (files: Iterable<File>) => void } => {
  const files: File[] = [];
  const add = (picked: Iterable<File>) => {
    for (const file of picked) if (file.type.startsWith('audio/') || /\.(wav|mp3|ogg|oga|flac|m4a|aac|webm)$/i.test(file.name)) files.push(file);
  };
  const source = listSource('files', options.label ?? 'My files', () =>
    files.map((file, i) => ({ id: `${i}:${file.name}`, name: file.name.replace(/\.[^.]+$/, ''), detail: file.name, kind: 'audio' as const, load: async () => file })),
  );

  return {
    ...source,
    add,
    action: {
      label: options.importLabel ?? 'Import files…',
      run: () =>
        new Promise<void>((resolve) => {
          const input = doc.createElement('input');

          input.type = 'file';
          input.accept = 'audio/*';
          input.multiple = true;
          input.addEventListener('change', () => {
            add(input.files ?? []);
            resolve();
          });
          input.addEventListener('cancel', () => resolve());
          input.click();
        }),
    },
  };
};

/** Plugins from a list, like the mixer's catalog. */
export const pluginSource = (catalog: readonly PluginChoice[], label = 'Plugins'): LibrarySource =>
  listSource(
    'plugins',
    label,
    catalog.map((choice) => ({ id: choice.url, name: choice.name, kind: 'plugin' as const, url: choice.url })),
  );

/** The Web Audio Modules community list. */
export const WAM_COMMUNITY_URL = 'https://www.webaudiomodules.com/community/plugins.json';

/** A plugin as the WAM community list describes it. */
export interface WamListing {
  identifier?: string;
  name?: string;
  vendor?: string;
  description?: string;
  keywords?: string[];
  path?: string;
  url?: string;
  thumbnail?: string;
  isInstrument?: boolean;
  [key: string]: unknown;
}

export interface WamCommunityOptions {
  /** Another list in the same shape, for example a copy you host and review */
  url?: string;
  /**
   * Where the plugins' paths start, ending in a slash: by default the `plugins/`
   * folder beside the list, as the community list is laid out
   */
  base?: string;
  /**
   * Which plugins to offer. Each one runs as code in your page, with the page's
   * access to cookies, storage and your API, so offer only plugins you trust.
   */
  allow: (plugin: WamListing & { url: string }) => boolean;
  label?: string;
  /** Leave out instruments; the studio hosts effects */
  effectsOnly?: boolean;
}

/**
 * Plugins from the Web Audio Modules community list, or a list in the same shape.
 * Nothing is fetched until the tab opens, and only plugins `allow` accepts are shown.
 */
export const wamCommunitySource = (options: WamCommunityOptions): LibrarySource => {
  const url = options.url ?? WAM_COMMUNITY_URL;
  const base = new URL(options.base ?? 'plugins/', url).href;
  let listing: Promise<LibraryItem[]> | null = null;

  const load = async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load the plugin list (${response.status})`);

    const body = (await response.json()) as WamListing[] | { plugins?: WamListing[] };
    const plugins = Array.isArray(body) ? body : (body.plugins ?? []);

    return plugins.flatMap((plugin) => {
      const path = plugin.url ?? plugin.path;
      if (!path || !plugin.name || (options.effectsOnly !== false && plugin.isInstrument)) return [];

      const module = new URL(path, base).href;
      if (!options.allow({ ...plugin, url: module })) return [];

      const detail = [plugin.vendor, plugin.description].filter(Boolean).join(' · ');

      const image = plugin.thumbnail && new URL(plugin.thumbnail, base).href;

      return [{ id: plugin.identifier ?? module, name: plugin.name, kind: 'plugin' as const, url: module, ...(detail && { detail }), ...(image && { image }), data: plugin }];
    });
  };

  return listSource('wam-community', options.label ?? 'WAM community', () => {
    listing ??= load().catch((error: unknown) => {
      listing = null;
      throw error;
    });

    return listing;
  });
};
