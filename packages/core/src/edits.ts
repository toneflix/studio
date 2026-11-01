import type { TempoChange } from './grid.ts';
import { clipEnd, type Clip, type ClipInput, type Marker, type Source, type TimelineState, type Track } from './types.ts';

/** Shortest clip a trim or split may leave, in seconds. */
export const MIN_CLIP = 0.01;

let counter = 0;

/** A short id that is unique in this page. */
export const uid = (prefix = 'c') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

type Sources = ReadonlyMap<string, Source>;

const sourceLength = (sources: Sources, clip: Clip) => sources.get(clip.source)?.duration ?? Infinity;

const replace = (state: TimelineState, ids: ReadonlySet<string>, fn: (clip: Clip) => Clip): TimelineState => ({
  ...state,
  clips: state.clips.map((clip) => (ids.has(clip.id) ? fn(clip) : clip)),
});

export const makeClip = (input: ClipInput): Clip => ({
  gain: 1,
  fadeIn: 0,
  fadeOut: 0,
  ...input,
  id: input.id ?? uid(),
});

export const addClips = (state: TimelineState, clips: Clip[]): TimelineState => ({
  ...state,
  clips: [...state.clips, ...clips],
});

export const removeClips = (state: TimelineState, ids: ReadonlySet<string>): TimelineState => ({
  ...state,
  clips: state.clips.filter((clip) => !ids.has(clip.id)),
});

export const addTrack = (state: TimelineState, track: Track, index = state.tracks.length): TimelineState => {
  const tracks = [...state.tracks];
  tracks.splice(index, 0, track);

  return { ...state, tracks };
};

/** Remove a track and its clips. */
export const removeTrack = (state: TimelineState, id: string): TimelineState => ({
  ...state,
  tracks: state.tracks.filter((track) => track.id !== id),
  clips: state.clips.filter((clip) => clip.track !== id),
});

export const moveTrack = (state: TimelineState, id: string, index: number): TimelineState => {
  const from = state.tracks.findIndex((track) => track.id === id);
  if (from < 0) return state;

  const tracks = [...state.tracks];
  const [track] = tracks.splice(from, 1);
  tracks.splice(Math.max(0, Math.min(index, tracks.length)), 0, track!);

  return { ...state, tracks };
};

export const updateTrack = (state: TimelineState, id: string, patch: Partial<Omit<Track, 'id'>>): TimelineState => ({
  ...state,
  tracks: state.tracks.map((track) => (track.id === id ? { ...track, ...patch } : track)),
});

/**
 * Move clips by a time shift and a number of lanes. Clips pass over and onto
 * other clips freely; only the timeline start and the outer lanes stop them.
 */
export const moveClips = (state: TimelineState, ids: ReadonlySet<string>, shift: number, lanes = 0): TimelineState => {
  const moving = state.clips.filter((clip) => ids.has(clip.id));
  if (!moving.length) return state;

  const index = new Map(state.tracks.map((track, i) => [track.id, i]));
  const earliest = Math.min(...moving.map((clip) => clip.start));
  const lanesOf = moving.map((clip) => index.get(clip.track) ?? 0);
  const time = Math.max(shift, -earliest);
  const lane = Math.max(-Math.min(...lanesOf), Math.min(lanes, state.tracks.length - 1 - Math.max(...lanesOf)));

  return replace(state, ids, (clip) => ({
    ...clip,
    start: clip.start + time,
    track: lane ? state.tracks[(index.get(clip.track) ?? 0) + lane]!.id : clip.track,
  }));
};

/** Move a clip's left edge to a timeline time, revealing or hiding the start of its audio. */
export const trimStart = (state: TimelineState, sources: Sources, id: string, time: number): TimelineState =>
  replace(state, new Set([id]), (clip) => {
    const earliest = Math.max(0, clip.start - clip.offset);
    const start = Math.min(Math.max(time, earliest), clipEnd(clip) - MIN_CLIP);
    const shift = start - clip.start;
    const duration = clip.duration - shift;

    return {
      ...clip,
      start,
      offset: clip.offset + shift,
      duration,
      fadeIn: Math.min(clip.fadeIn, duration),
      fadeOut: Math.min(clip.fadeOut, duration - Math.min(clip.fadeIn, duration)),
    };
  });

/** Move a clip's right edge to a timeline time, up to the end of its audio. */
export const trimEnd = (state: TimelineState, sources: Sources, id: string, time: number): TimelineState =>
  replace(state, new Set([id]), (clip) => {
    const latest = clip.start + sourceLength(sources, clip) - clip.offset;
    const end = Math.max(Math.min(time, latest), clip.start + MIN_CLIP);
    const duration = end - clip.start;

    return {
      ...clip,
      duration,
      fadeOut: Math.min(clip.fadeOut, duration),
      fadeIn: Math.min(clip.fadeIn, duration - Math.min(clip.fadeOut, duration)),
    };
  });

export const setFades = (state: TimelineState, id: string, fades: { fadeIn?: number; fadeOut?: number }): TimelineState =>
  replace(state, new Set([id]), (clip) => {
    const fadeIn = Math.max(0, Math.min(fades.fadeIn ?? clip.fadeIn, clip.duration));
    const fadeOut = Math.max(0, Math.min(fades.fadeOut ?? clip.fadeOut, clip.duration - fadeIn));

    return { ...clip, fadeIn, fadeOut };
  });

export const setGain = (state: TimelineState, ids: ReadonlySet<string>, gain: number): TimelineState =>
  replace(state, ids, (clip) => ({ ...clip, gain: Math.max(0, gain) }));

/**
 * Split clips at a timeline time. The left piece keeps the clip's id and fade
 * in; the right piece gets a new id and the fade out. Returns the new ids too.
 */
export const splitClips = (state: TimelineState, ids: ReadonlySet<string>, time: number) => {
  const created: string[] = [];
  const clips: Clip[] = [];

  for (const clip of state.clips) {
    const cut = time - clip.start;

    if (!ids.has(clip.id) || cut < MIN_CLIP || clip.duration - cut < MIN_CLIP) {
      clips.push(clip);
      continue;
    }

    const right: Clip = {
      ...clip,
      id: uid(),
      start: time,
      offset: clip.offset + cut,
      duration: clip.duration - cut,
      fadeIn: 0,
      fadeOut: Math.min(clip.fadeOut, clip.duration - cut),
    };

    created.push(right.id);
    clips.push({ ...clip, duration: cut, fadeIn: Math.min(clip.fadeIn, cut), fadeOut: 0 }, right);
  }

  return { state: { ...state, clips }, created };
};

/** Copy clips to just after the latest of them, on the same tracks. */
export const duplicateClips = (state: TimelineState, ids: ReadonlySet<string>) => {
  const picked = state.clips.filter((clip) => ids.has(clip.id));
  if (!picked.length) return { state, created: [] as string[] };

  const from = Math.min(...picked.map((clip) => clip.start));
  const to = Math.max(...picked.map(clipEnd));
  const copies = picked.map((clip) => ({ ...clip, id: uid(), start: clip.start + (to - from) }));

  return { state: addClips(state, copies), created: copies.map((clip) => clip.id) };
};

/** Timeline length: the end of the last clip. */
export const timelineEnd = (state: TimelineState) => state.clips.reduce((end, clip) => Math.max(end, clipEnd(clip)), 0);

const byTime = <T extends { time: number }>(items: readonly T[]) => [...items].sort((a, b) => a.time - b.time);

/** Add a marker, or replace the one with its id. */
export const setMarker = (state: TimelineState, marker: Marker): TimelineState => ({
  ...state,
  markers: byTime([...(state.markers ?? []).filter((m) => m.id !== marker.id), { ...marker, time: Math.max(0, marker.time) }]),
});

export const removeMarker = (state: TimelineState, id: string): TimelineState => ({
  ...state,
  markers: (state.markers ?? []).filter((marker) => marker.id !== id),
});

/** Add a tempo change, or replace the one with its id. A change at the very start is left out. */
export const setTempoChange = (state: TimelineState, change: TempoChange): TimelineState => ({
  ...state,
  tempo: byTime([...(state.tempo ?? []).filter((c) => c.id !== change.id && Math.abs(c.time - change.time) > 1e-6), change].filter((c) => c.time > 1e-6)),
});

export const removeTempoChange = (state: TimelineState, id: string): TimelineState => ({
  ...state,
  tempo: (state.tempo ?? []).filter((change) => change.id !== id),
});
