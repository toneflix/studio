import { encodeWav, type AudioEngine } from '@toneflix/studio-audio';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import { fromReaper, toReaper } from './rpp.ts';
import { unzip, zip, type ZipEntry } from './zip.ts';

export interface SaveProjectOptions {
  /** Name of the .rpp file inside the archive */
  name?: string;
}

export interface OpenProjectOptions {
  /** Gets each source's decoded audio, for example to work out its waveform */
  onSource?: (id: string, buffer: AudioBuffer) => void;
}

/** A file name that is safe on every system. */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'audio';

/**
 * Pack the session as a REAPER project: a zip with the .rpp and every source
 * the clips use as a WAV file, ready to unzip and open in REAPER.
 */
export const saveReaperProject = async (timeline: StudioTimeline, engine: AudioEngine, options: SaveProjectOptions = {}) => {
  const name = safe(options.name ?? 'Toneflix Studio');
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

  const text = toReaper(timeline.state, {
    bpm: timeline.grid.bpm,
    meter: timeline.grid.meter,
    mixer: engine.mixer.snapshot(),
    file: (source) => files.get(source) ?? `audio/${safe(source)}.wav`,
    colorOf: (track) => timeline.colorOf(track),
  });

  entries.unshift({ name: `${name}.rpp`, data: new TextEncoder().encode(text) });

  return new Blob([zip(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
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

/**
 * Open a REAPER project into the timeline and engine: a zip with the .rpp and its
 * audio, or the files of a project folder. Replaces what is loaded, sets the tempo,
 * meter and mixer, and returns the audio files it could not find or decode.
 */
export const openReaperProject = async (input: Blob | readonly File[], timeline: StudioTimeline, engine: AudioEngine, options: OpenProjectOptions = {}) => {
  const entries = await filesOf(input);
  const rpp = entries.find((entry) => entry.name.toLowerCase().endsWith('.rpp'));
  if (!rpp) throw new Error('No REAPER project (.rpp) found');

  const project = fromReaper(new TextDecoder().decode(rpp.data));
  const missing: string[] = [];
  const context = engine.context;

  await Promise.all(
    Object.entries(project.files).map(async ([id, path]) => {
      const file = findFile(entries, path);

      try {
        if (!file) throw new Error('missing');

        const buffer = await context.decodeAudioData(file.data.slice().buffer);

        engine.setBuffer(id, buffer);
        timeline.setSource({ id, duration: buffer.duration });
        options.onSource?.(id, buffer);
      } catch {
        missing.push(path);
      }
    }),
  );

  timeline.setGrid({ bpm: project.bpm, meter: project.meter });
  engine.metronome.grid.set({ bpm: project.bpm, meter: project.meter });
  engine.mixer.restore(project.mixer);
  timeline.load(project.state);
  engine.load(project.state);

  return { missing };
};
