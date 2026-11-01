import { audibleRanges, envelopeAt, type AudibleRange, type Clip, type Grid, type TimelineState } from '@toneflix/studio-core';

/** A stretch of the timeline that repeats while playback loops over it. */
export interface Loop {
  start: number;
  end: number;
}

/**
 * One run of the timeline played without a jump, and the part of it that falls
 * inside a scheduling window. `at` is the play time (seconds since play began)
 * when the run passes `start`.
 */
export interface Pass {
  start: number;
  end: number;
  from: number;
  to: number;
  at: number;
}

/** A heard part of a clip, placed on the play clock. */
export interface Voice {
  clip: Clip;
  /** Timeline start and end of what plays */
  start: number;
  end: number;
  /** Play time when it starts */
  at: number;
}

export interface Click {
  time: number;
  /** The first beat of a bar */
  accent: boolean;
  at: number;
}

const heard = new WeakMap<TimelineState, AudibleRange[]>();

/** The heard parts of every track's clips, by start. Worked out once per state. */
export const heardRanges = (state: TimelineState) => {
  let ranges = heard.get(state);

  if (!ranges) {
    const byTrack = new Map<string, Clip[]>();

    for (const clip of state.clips) {
      const list = byTrack.get(clip.track);

      if (list) list.push(clip);
      else byTrack.set(clip.track, [clip]);
    }

    ranges = [...byTrack.values()].flatMap((clips) => audibleRanges(clips)).sort((a, b) => a.start - b.start);
    heard.set(state, ranges);
  }

  return ranges;
};

/** Whether a loop applies to playback that starts at `origin`. */
export const loops = (origin: number, loop: Loop | null): loop is Loop => !!loop && loop.end - loop.start > 1e-3 && origin < loop.end;

/** The timeline time after `elapsed` seconds of playback that began at `origin`. */
export const timelineAt = (origin: number, loop: Loop | null, elapsed: number) => {
  if (!loops(origin, loop)) return origin + elapsed;

  const first = loop.end - origin;

  return elapsed < first ? origin + elapsed : loop.start + ((elapsed - first) % (loop.end - loop.start));
};

/** The runs of the timeline heard between two play times. */
export const passesBetween = (origin: number, loop: Loop | null, from: number, to: number): Pass[] => {
  if (to <= from) return [];
  if (!loops(origin, loop)) return [{ start: origin, end: Infinity, from: origin + from, to: origin + to, at: 0 }];

  const passes: Pass[] = [];
  const length = loop.end - loop.start;
  let run = { start: origin, end: loop.end, at: 0 };

  if (from >= loop.end - origin) {
    const lap = Math.floor((from - (loop.end - origin)) / length);

    run = { start: loop.start, end: loop.end, at: loop.end - origin + lap * length };
  }

  while (run.at < to) {
    const runFrom = Math.max(run.start, run.start + from - run.at);
    const runTo = Math.min(run.end, run.start + to - run.at);

    if (runTo > runFrom) passes.push({ ...run, from: runFrom, to: runTo });

    run = { start: loop.start, end: loop.end, at: run.at + run.end - run.start };
  }

  return passes;
};

/**
 * Parts of clips to start during a pass. A part is started in the window where it
 * begins, so windows that follow each other start every part once.
 */
export const voicesIn = (ranges: readonly AudibleRange[], pass: Pass): Voice[] => {
  const voices: Voice[] = [];

  for (const range of ranges) {
    if (range.start >= pass.to) break;
    if (range.end <= pass.start) continue;

    const start = Math.max(range.start, pass.start);
    const end = Math.min(range.end, pass.end);

    if (start >= pass.from && start < pass.to && end - start > 1e-4) {
      voices.push({ clip: range.clip, start, end, at: pass.at + start - pass.start });
    }
  }

  return voices;
};

/**
 * Gain breakpoints of a voice, in seconds from its start. Straight lines between
 * them give the clip's gain and fades.
 */
export const gainSteps = (voice: Pick<Voice, 'clip' | 'start' | 'end'>) => {
  const { clip } = voice;
  const from = voice.start - clip.start;
  const to = voice.end - clip.start;
  const points = [from, clip.fadeIn, clip.duration - clip.fadeOut, to].filter((p) => p >= from && p <= to);

  return [...new Set(points)].sort((a, b) => a - b).map((p) => ({ at: p - from, gain: envelopeAt(clip, p) }));
};

/** Metronome beats in a pass's window. */
export const clicksIn = (grid: Grid, pass: Pass): Click[] => {
  const clicks: Click[] = [];
  const beat = grid.beat;

  for (let n = Math.ceil(pass.from / beat - 1e-9); n * beat < pass.to; n++) {
    const time = n * beat;

    clicks.push({ time, accent: n % grid.meter[0] === 0, at: pass.at + time - pass.start });
  }

  return clicks;
};
