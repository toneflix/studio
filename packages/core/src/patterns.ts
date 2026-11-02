import { uid } from './edits.ts';
import type { Clip, Note, TimelineState } from './types.ts';

/**
 * A pattern: the notes that note clips sharing one source play. Duplicating or
 * splitting a note clip keeps its source, so every copy plays the same pattern.
 */
export interface Pattern {
  source: string;
  /** The name of its first clip */
  name: string;
  notes: readonly Note[];
  /** Ids of the clips that play it, by start */
  clips: string[];
}

/** The note clips that play the same pattern as a clip, itself included. */
export const linkedClips = (state: TimelineState, id: string): Clip[] => {
  const source = state.clips.find((clip) => clip.id === id && clip.notes)?.source;

  return source === undefined ? [] : state.clips.filter((clip) => clip.notes && clip.source === source);
};

/** The patterns played on a track, or on every track, in the order their first clips start. */
export const patternsOf = (state: TimelineState, track?: string): Pattern[] => {
  const patterns = new Map<string, Pattern>();
  const clips = state.clips.filter((clip) => clip.notes && (track === undefined || clip.track === track)).sort((a, b) => a.start - b.start);

  for (const clip of clips) {
    const known = patterns.get(clip.source);

    if (known) known.clips.push(clip.id);
    else patterns.set(clip.source, { source: clip.source, name: clip.name ?? '', notes: clip.notes!, clips: [clip.id] });
  }

  return [...patterns.values()];
};

/** A name for a new pattern from `base`, numbered past the names already on the track, like "Beat 2". */
export const nextPatternName = (state: TimelineState, track: string, base: string) => {
  const stem = base.replace(/\s+\d+$/, '') || 'Pattern';
  const taken = new Set(patternsOf(state, track).map((pattern) => pattern.name));
  let n = 2;

  while (taken.has(`${stem} ${n}`)) n++;

  return `${stem} ${n}`;
};

/**
 * Give a note clip a pattern of its own: a new source with a copy of its notes, or
 * with `notes` when given, so later edits leave the other copies alone.
 */
export const unlinkClip = (state: TimelineState, id: string, options: { name?: string; notes?: readonly Note[] } = {}) => {
  const clip = state.clips.find((c) => c.id === id && c.notes);
  if (!clip) return { state, source: null };

  const source = `notes:${uid('p')}`;
  const name = options.name ?? nextPatternName(state, clip.track, clip.name ?? '');
  const next: Clip = { ...clip, source, name, notes: options.notes ?? clip.notes };

  return { state: { ...state, clips: state.clips.map((c) => (c.id === id ? next : c)) }, source };
};

/** Make a note clip play another pattern, keeping its place and length. */
export const usePattern = (state: TimelineState, id: string, source: string): TimelineState => {
  const pattern = state.clips.find((clip) => clip.notes && clip.source === source);
  if (!pattern) return state;

  return {
    ...state,
    clips: state.clips.map((clip) => (clip.id === id && clip.notes ? { ...clip, source, name: pattern.name, notes: pattern.notes } : clip)),
  };
};
