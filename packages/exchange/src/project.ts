import { encodeWav, type AudioEngine, type ChannelSettings } from '@toneflix/studio-audio';
import type { TimelineState } from '@toneflix/studio-core';
import type { PluginRack, RackSnapshot } from '@toneflix/studio-plugins';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import { fromReaper, toReaper } from './rpp.ts';
import { unzip, zip, type ZipEntry } from './zip.ts';

/** The app that saves projects: its name labels its own format and every project it writes. */
export interface AppIdentity {
  /** Shown to people, for example in the save menu */
  name: string;
  /** Stays the same across versions; written to every project */
  id?: string;
  version?: string;
  description?: string;
  copyright?: string;
  author?: string;
  url?: string;
  /** File extension of the app's own projects, without the dot */
  extension?: string;
}

/** `app` is the app's own format, which keeps plugins; `reaper` opens in REAPER, without them. */
export type ProjectFormat = 'app' | 'reaper';

export const DEFAULT_APP: Required<Pick<AppIdentity, 'name' | 'id' | 'extension'>> = { name: 'Toneflix Studio', id: 'toneflix-studio', extension: 'tfstudio' };

/** Marks the manifest of a project in the app format. */
export const PROJECT_FORMAT = 'toneflix-studio-project';

/** The manifest of a project in the app format, saved as `project.json` beside its audio. */
export interface ProjectManifest {
  format: typeof PROJECT_FORMAT;
  version: 1;
  /** The app that saved it */
  app: AppIdentity;
  name: string;
  saved: string;
  bpm: number;
  meter: [number, number];
  state: TimelineState;
  mixer: { master: ChannelSettings; tracks: Record<string, ChannelSettings> };
  /** Plugin chains with their settings; plugins load again from their URLs */
  plugins?: RackSnapshot;
  /** Source id to its audio file in the archive */
  files: Record<string, string>;
}

export interface SaveProjectOptions {
  /** Project name, used for the file names inside the archive */
  name?: string;
  /** Who is saving; written to the project, and to REAPER's project notes */
  app?: AppIdentity;
  /** Plugins to keep in an app project */
  plugins?: PluginRack;
}

export interface OpenProjectOptions {
  /** Gets each source's decoded audio, for example to work out its waveform */
  onSource?: (id: string, buffer: AudioBuffer) => void;
  /** Loads an app project's plugins into this rack; a REAPER project clears it */
  plugins?: PluginRack;
}

export interface OpenedProject {
  format: ProjectFormat;
  /** Audio files the project names that could not be found or decoded */
  missing: string[];
  /** The app that saved it, for app projects */
  app?: AppIdentity;
  /** The project's own name, for app projects */
  name?: string;
  /** REAPER's project notes */
  notes?: string;
}

/** A file name that is safe on every system. */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'audio';

/** Each source the clips use as a WAV entry, with its path in the archive. */
const audioEntries = (timeline: StudioTimeline, engine: AudioEngine) => {
  const files = new Map<string, string>();
  const entries: ZipEntry[] = [];

  for (const source of new Set(timeline.state.clips.map((clip) => clip.source))) {
    const buffer = engine.getBuffer(source);
    if (!buffer) continue;

    let file = `audio/${safe(source)}.wav`;

    for (let n = 2; [...files.values()].includes(file); n++) file = `audio/${safe(source)}-${n}.wav`;

    files.set(source, file);
    entries.push({ name: file, data: new Uint8Array(encodeWav(buffer)) });
  }

  return { files, entries };
};

const archive = (entries: ZipEntry[]) => new Blob([zip(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });

/** The app's details as lines of text. */
const describe = (app: AppIdentity) =>
  [`${app.name}${app.version ? ` ${app.version}` : ''}`, app.description, app.author, app.copyright, app.url].filter(Boolean).join('\n');

/**
 * Pack the session as a REAPER project: a zip with the .rpp and every source
 * the clips use as a WAV file, ready to unzip and open in REAPER. Plugins stay out,
 * since REAPER can't load them.
 */
export const saveReaperProject = async (timeline: StudioTimeline, engine: AudioEngine, options: SaveProjectOptions = {}) => {
  const app = options.app ?? DEFAULT_APP;
  const name = safe(options.name ?? app.name);
  const { files, entries } = audioEntries(timeline, engine);

  const text = toReaper(timeline.state, {
    bpm: timeline.grid.bpm,
    meter: timeline.grid.meter,
    mixer: engine.mixer.snapshot(),
    file: (source) => files.get(source) ?? `audio/${safe(source)}.wav`,
    colorOf: (track) => timeline.colorOf(track),
    notes: `Made with ${describe(app)}`,
  });

  entries.unshift({ name: `${name}.rpp`, data: new TextEncoder().encode(text) });

  return archive(entries);
};

/**
 * Pack the session in the app's own format: a zip with `project.json` and every
 * source as a WAV file. It keeps everything the session has, plugins included.
 */
export const saveAppProject = async (timeline: StudioTimeline, engine: AudioEngine, options: SaveProjectOptions = {}) => {
  const app = options.app ?? DEFAULT_APP;
  const { files, entries } = audioEntries(timeline, engine);
  const plugins = await options.plugins?.snapshot();

  const manifest: ProjectManifest = {
    format: PROJECT_FORMAT,
    version: 1,
    app,
    name: options.name ?? app.name,
    saved: new Date().toISOString(),
    bpm: timeline.grid.bpm,
    meter: timeline.grid.meter,
    state: timeline.state,
    mixer: engine.mixer.snapshot(),
    ...(plugins && { plugins }),
    files: Object.fromEntries(files),
  };

  entries.unshift({ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });

  return archive(entries);
};

/** Save in either format. Gives the archive and a file name for it. */
export const saveProject = async (format: ProjectFormat, timeline: StudioTimeline, engine: AudioEngine, options: SaveProjectOptions = {}) => {
  const app = options.app ?? DEFAULT_APP;
  const name = safe(options.name ?? app.name);

  if (format === 'reaper') return { blob: await saveReaperProject(timeline, engine, options), fileName: `${name}.zip` };

  return { blob: await saveAppProject(timeline, engine, options), fileName: `${name}.${app.extension ?? DEFAULT_APP.extension}` };
};

/** The archive's or folder's files, by path with forward slashes. */
const filesOf = async (input: Blob | readonly File[]): Promise<ZipEntry[]> => {
  if (!(input instanceof Blob)) {
    return Promise.all(input.map(async (file) => ({ name: file.webkitRelativePath || file.name, data: new Uint8Array(await file.arrayBuffer()) })));
  }

  const data = new Uint8Array(await input.arrayBuffer());
  const name = input instanceof File ? input.name : '';

  return name.toLowerCase().endsWith('.rpp') ? [{ name, data }] : unzip(data);
};

/** The file a project names, matched by its path's end, then by its name alone. */
const findFile = (entries: ZipEntry[], path: string) => {
  const parts = path.toLowerCase().split(/[\\/]/);

  for (let take = parts.length; take > 0; take--) {
    const tail = parts.slice(-take).join('/');
    const hit = entries.find((entry) => {
      const name = entry.name.toLowerCase();

      return name === tail || name.endsWith(`/${tail}`);
    });

    if (hit) return hit;
  }

  return undefined;
};

/** Decode each source's file into the engine and timeline. Returns the paths that failed. */
const loadAudio = async (entries: ZipEntry[], files: Record<string, string>, timeline: StudioTimeline, engine: AudioEngine, options: OpenProjectOptions) => {
  const missing: string[] = [];

  await Promise.all(
    Object.entries(files).map(async ([id, path]) => {
      const file = findFile(entries, path);

      try {
        if (!file) throw new Error('missing');

        const buffer = await engine.context.decodeAudioData(file.data.slice().buffer);

        engine.setBuffer(id, buffer);
        timeline.setSource({ id, duration: buffer.duration });
        options.onSource?.(id, buffer);
      } catch {
        missing.push(path);
      }
    }),
  );

  return missing;
};

/** Put a project's grid, mixer and clips in place of what is loaded. */
const apply = (timeline: StudioTimeline, engine: AudioEngine, project: { bpm: number; meter: [number, number]; state: TimelineState }) => {
  timeline.setGrid({ bpm: project.bpm, meter: project.meter });
  engine.metronome.grid.set({ bpm: project.bpm, meter: project.meter });
  timeline.load(project.state);
  engine.load(project.state);
};

const reaperFrom = async (entries: ZipEntry[], timeline: StudioTimeline, engine: AudioEngine, options: OpenProjectOptions): Promise<OpenedProject> => {
  const rpp = entries.find((entry) => entry.name.toLowerCase().endsWith('.rpp'));
  if (!rpp) throw new Error('No REAPER project (.rpp) found');

  const project = fromReaper(new TextDecoder().decode(rpp.data));
  const missing = await loadAudio(entries, project.files, timeline, engine, options);

  engine.mixer.restore(project.mixer);
  apply(timeline, engine, project);
  await options.plugins?.restore({ master: [], tracks: {} });

  return { format: 'reaper', missing, ...(project.notes && { notes: project.notes }) };
};

/**
 * Open a REAPER project into the timeline and engine: a zip with the .rpp and its
 * audio, or the files of a project folder. Replaces what is loaded, sets the tempo,
 * meter and mixer, and returns the audio files it could not find or decode.
 */
export const openReaperProject = async (input: Blob | readonly File[], timeline: StudioTimeline, engine: AudioEngine, options: OpenProjectOptions = {}) =>
  reaperFrom(await filesOf(input), timeline, engine, options);

/**
 * Open a project saved in either format: an app project, or a REAPER project as a zip,
 * an .rpp with its audio files, or a project folder. Replaces what is loaded, plugins
 * included when a rack is given and the project has them.
 */
export const openProject = async (input: Blob | readonly File[], timeline: StudioTimeline, engine: AudioEngine, options: OpenProjectOptions = {}): Promise<OpenedProject> => {
  const entries = await filesOf(input);
  const json = entries.find((entry) => entry.name.split('/').pop() === 'project.json');
  const manifest = json && (JSON.parse(new TextDecoder().decode(json.data)) as Partial<ProjectManifest>);

  if (manifest?.format !== PROJECT_FORMAT) return reaperFrom(entries, timeline, engine, options);

  const missing = await loadAudio(entries, manifest.files ?? {}, timeline, engine, options);

  engine.mixer.restore(manifest.mixer ?? {});
  apply(timeline, engine, { bpm: manifest.bpm ?? 120, meter: manifest.meter ?? [4, 4], state: manifest.state ?? { tracks: [], clips: [] } });
  if (options.plugins) await options.plugins.restore(manifest.plugins ?? { master: [], tracks: {} });

  return { format: 'app', missing, app: manifest.app, name: manifest.name };
};
