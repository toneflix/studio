/** A piece of audio on the timeline, in seconds. */
export interface Clip {
  id: string;
  /** The track (lane) the clip sits on */
  track: string;
  /** The audio the clip plays, by source id */
  source: string;
  /** Where the clip starts on the timeline */
  start: number;
  /** How far into the source the clip starts */
  offset: number;
  /** How long the clip plays */
  duration: number;
  /** Linear gain, 1 is unchanged */
  gain: number;
  fadeIn: number;
  fadeOut: number;
  name?: string;
  color?: string;
}

/** A lane of clips, like a stem. */
export interface Track {
  id: string;
  name: string;
  color?: string;
  /** Anything the host app keeps with the track */
  data?: unknown;
}

/** What the timeline knows about a clip's audio. */
export interface Source {
  id: string;
  /** Length of the audio in seconds; unknown while it loads */
  duration?: number;
}

/** Everything that undo and redo restore. */
export interface TimelineState {
  tracks: readonly Track[];
  clips: readonly Clip[];
}

/** A time range picked on the timeline, with the tracks it covers. */
export interface TimeRange {
  start: number;
  end: number;
  tracks: string[];
}

export type ClipInput = Omit<Clip, 'id' | 'gain' | 'fadeIn' | 'fadeOut'> & Partial<Pick<Clip, 'id' | 'gain' | 'fadeIn' | 'fadeOut'>>;

export const clipEnd = (clip: Pick<Clip, 'start' | 'duration'>) => clip.start + clip.duration;
