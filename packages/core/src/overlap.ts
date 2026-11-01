import { clipEnd, type Clip } from './types.ts';

export interface AudibleRange {
  clip: Clip;
  /** Timeline start of the part that is heard */
  start: number;
  end: number;
}

/**
 * Stacking order of a track's clips, bottom first. The clip that starts later
 * sits on top; clips that start together keep their order in the list.
 */
export const stackOrder = (clips: readonly Clip[]) =>
  clips
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => a.clip.start - b.clip.start || a.index - b.index)
    .map(({ clip }) => clip);

/**
 * The parts of each clip on one track that are heard: a clip is covered
 * wherever a clip above it in the stack plays.
 */
export const audibleRanges = (clips: readonly Clip[]): AudibleRange[] => {
  const stack = stackOrder(clips);
  const covered: [number, number][] = [];
  const ranges: AudibleRange[] = [];

  for (let i = stack.length - 1; i >= 0; i--) {
    const clip = stack[i]!;
    let parts: [number, number][] = [[clip.start, clipEnd(clip)]];

    for (const [from, to] of covered) {
      parts = parts.flatMap(([a, b]): [number, number][] => {
        if (to <= a || from >= b) return [[a, b]];

        const left: [number, number][] = from > a ? [[a, from]] : [];
        const right: [number, number][] = to < b ? [[to, b]] : [];

        return [...left, ...right];
      });
    }

    for (const [start, end] of parts) {
      if (end - start > 1e-6) ranges.push({ clip, start, end });
    }

    covered.push([clip.start, clipEnd(clip)]);
  }

  return ranges.sort((a, b) => a.start - b.start);
};
