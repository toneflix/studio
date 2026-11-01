import type { AudioEngine } from '@toneflix/studio-audio';
import { addClips, addTrack, makeClip, uid, type Clip, type TimelineState, type Track } from '@toneflix/studio-core';
import type { StudioTimeline } from '@toneflix/studio-timeline';

export interface ImportAudioOptions {
  /** Gets each file's audio once decoded, for example to draw its waveform */
  onSource?: (id: string, buffer: AudioBuffer) => void;
  /** Where the clips start; the playhead unless given */
  time?: number;
}

export interface ImportedAudio {
  clips: Clip[];
  /** Files that could not be decoded as audio */
  failed: File[];
}

/**
 * Put audio files from the device on new tracks, one track per file named after it,
 * as one undo step. Nothing is uploaded. Made for the timeline's `importAudio` option.
 */
export const importAudioFiles = async (timeline: StudioTimeline, engine: AudioEngine, files: Iterable<File>, options: ImportAudioOptions = {}): Promise<ImportedAudio> => {
  const start = Math.max(0, options.time ?? timeline.time);
  const added: { track: Track; clip: Clip }[] = [];
  const failed: File[] = [];

  for (const file of files) {
    let buffer: AudioBuffer;

    try {
      buffer = await engine.context.decodeAudioData(await file.arrayBuffer());
    } catch {
      failed.push(file);
      continue;
    }

    const id = uid('file');
    const name = file.name.replace(/\.[^.]+$/, '') || file.name;
    const track: Track = { id: uid('t'), name };

    engine.setBuffer(id, buffer);
    timeline.setSource({ id, duration: buffer.duration });
    options.onSource?.(id, buffer);
    added.push({ track, clip: makeClip({ id: uid('c'), track: track.id, source: id, name, start, offset: 0, duration: buffer.duration }) });
  }

  if (added.length) {
    timeline.model.apply('Import audio', (state) =>
      addClips(
        added.reduce((next: TimelineState, { track }) => addTrack(next, track), state),
        added.map(({ clip }) => clip),
      ),
    );
    timeline.select(added.map(({ clip }) => clip.id));
  }

  return { clips: added.map(({ clip }) => clip), failed };
};
