import type { Automation } from './automation.ts';
import type { TempoChange } from './grid.ts';

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
  /**
   * Notes to play through the track's instrument, which makes this a note clip.
   * Note times count from the clip's content start, like audio.
   */
  notes?: readonly Note[];
}

/** One note of a note clip. */
export interface Note {
  /** MIDI note number, 60 is middle C */
  pitch: number;
  /** Seconds from the start of the clip's content */
  start: number;
  duration: number;
  /** From 0 to 1 */
  velocity: number;
}

/** The instrument an instrument track plays its note clips with. */
export interface InstrumentChoice {
  /** A built-in instrument (`synth`, `drums`) or a Web Audio Module's URL */
  id: string;
  /** Its settings */
  state?: unknown;
}

/** A lane of clips, like a stem. */
export interface Track {
  id: string;
  name: string;
  color?: string;
  /** Row height in pixels; the timeline's `trackHeight` when left out */
  height?: number;
  /** Volume and pan changes over time, played through the track's mixer channel */
  automation?: Automation;
  /** Makes this an instrument track, whose note clips play through it */
  instrument?: InstrumentChoice;
  /** Anything the host app keeps with the track */
  data?: unknown;
}

/** What the timeline knows about a clip's audio. */
export interface Source {
  id: string;
  /** Length of the audio in seconds; unknown while it loads */
  duration?: number;
}

/** A named point on the timeline, like Verse or Chorus. */
export interface Marker {
  id: string;
  time: number;
  name: string;
  color?: string;
}

/** Everything that undo and redo restore. */
export interface TimelineState {
  tracks: readonly Track[];
  clips: readonly Clip[];
  /** Named points on the ruler, by time */
  markers?: readonly Marker[];
  /** Tempo and meter changes after the start; the grid's tempo plays before the first */
  tempo?: readonly TempoChange[];
}

/** A time range picked on the timeline, with the tracks it covers. */
export interface TimeRange {
  start: number;
  end: number;
  tracks: string[];
}

export type ClipInput = Omit<Clip, 'id' | 'gain' | 'fadeIn' | 'fadeOut'> & Partial<Pick<Clip, 'id' | 'gain' | 'fadeIn' | 'fadeOut'>>;

/** Whether a clip plays notes rather than audio. */
export const isNoteClip = (clip: Pick<Clip, 'notes'>) => clip.notes !== undefined;

export const clipEnd = (clip: Pick<Clip, 'start' | 'duration'>) => clip.start + clip.duration;

/** Min/max pairs of an audio file at one resolution, scaled to 16-bit. */
export interface PeakLevel {
  samplesPerPeak: number;
  /** min, max, min, max… */
  data: Int16Array;
}

/** A waveform overview of audio at several resolutions, finest first. */
export interface Peaks {
  sampleRate: number;
  /** Audio length in samples */
  length: number;
  levels: PeakLevel[];
}
