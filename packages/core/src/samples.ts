import type { TimelineState, Track } from './types.ts';

/** An audio file an instrument plays, like a drum pad's sound or a sampler's zone. */
export interface SampleRef {
  /** The source id of its decoded audio */
  source: string;
  name?: string;
  /** The note it plays at its own pitch; samplers repitch it for other notes */
  root?: number;
  /** Semitones up or down */
  tune?: number;
  /** Level, 1 as recorded */
  gain?: number;
  /**
   * How a sampler plays it: `gate` (the default) for as long as the note is held,
   * `oneShot` to its end whatever the note's length, or `loop` round its loop points
   * for as long as the note is held
   */
  mode?: SampleMode;
  /** Where the loop starts and ends in the sample, in seconds; the whole sample by default */
  loopStart?: number;
  loopEnd?: number;
}

export type SampleMode = 'gate' | 'oneShot' | 'loop';

const isSample = (value: unknown): value is SampleRef =>
  !!value && typeof value === 'object' && typeof (value as SampleRef).source === 'string';

/**
 * The samples a track's instrument plays. They live in its state under `samples`,
 * as a list (a sampler's zones) or by note number (a drum kit's pads).
 */
export const trackSamples = (track: Track): SampleRef[] => {
  const samples = (track.instrument?.state as { samples?: unknown } | undefined)?.samples;
  const list = Array.isArray(samples) ? samples : samples && typeof samples === 'object' ? Object.values(samples) : [];

  return list.filter(isSample);
};

/** Every source the session needs: the clips' audio and the instruments' samples. */
export const sourcesInUse = (state: TimelineState) =>
  [...new Set([...state.clips.map((clip) => clip.source), ...state.tracks.flatMap((track) => trackSamples(track).map((sample) => sample.source))])];
