import type { TimelineState, Track } from './types.ts';

/** The track settings that automation can change over time. */
export type AutomationParam = 'volume' | 'pan';

/** A value at a time on the timeline. Straight lines join the points. */
export interface AutomationPoint {
  time: number;
  value: number;
}

export type Automation = Partial<Record<AutomationParam, readonly AutomationPoint[]>>;

export interface AutomationRange {
  min: number;
  max: number;
  /** The value of a track without automation */
  neutral: number;
  /** Where a value sits in a lane, from 0 (bottom) to 1 (top) */
  toLevel: (value: number) => number;
  fromLevel: (level: number) => number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Volume is linear gain from silence to +6 dB, on the same cubic curve as a fader,
 * so 0 dB sits high in the lane. Pan runs from left (-1) to right (1).
 */
export const AUTOMATION_RANGES: Record<AutomationParam, AutomationRange> = {
  volume: {
    min: 0,
    max: 2,
    neutral: 1,
    toLevel: (value) => Math.cbrt(clamp(value, 0, 2) / 2),
    fromLevel: (level) => 2 * clamp(level, 0, 1) ** 3,
  },
  pan: {
    min: -1,
    max: 1,
    neutral: 0,
    toLevel: (value) => (clamp(value, -1, 1) + 1) / 2,
    fromLevel: (level) => clamp(level, 0, 1) * 2 - 1,
  },
};

export const AUTOMATION_PARAMS = Object.keys(AUTOMATION_RANGES) as AutomationParam[];

/** A track's points for a setting, by time. Empty when it has none. */
export const automationOf = (track: Pick<Track, 'automation'> | undefined, param: AutomationParam): readonly AutomationPoint[] => track?.automation?.[param] ?? [];

/**
 * The value at a time: the line between the points around it, the first point's
 * value before it and the last point's after it. `fallback` when there are no points.
 */
export const automationAt = (points: readonly AutomationPoint[], time: number, fallback: number) => {
  if (!points.length) return fallback;
  if (time <= points[0]!.time) return points[0]!.value;

  for (let i = 1; i < points.length; i++) {
    const b = points[i]!;

    if (time > b.time) continue;

    const a = points[i - 1]!;
    const span = b.time - a.time;

    return span > 0 ? a.value + ((b.value - a.value) * (time - a.time)) / span : b.value;
  }

  return points[points.length - 1]!.value;
};

/**
 * Breakpoints between two times: the values at both ends and every point between.
 * Straight lines from one to the next follow the automation exactly.
 */
export const automationSteps = (points: readonly AutomationPoint[], from: number, to: number, fallback: number) => {
  const steps = [{ time: from, value: automationAt(points, from, fallback) }];

  for (const point of points) if (point.time > from && point.time < to) steps.push({ time: point.time, value: point.value });

  if (to > from && Number.isFinite(to)) steps.push({ time: to, value: automationAt(points, to, fallback) });

  return steps;
};

/** Points sorted by time, with values in range and no two at the same time. */
export const cleanPoints = (param: AutomationParam, points: readonly AutomationPoint[]): AutomationPoint[] => {
  const { min, max } = AUTOMATION_RANGES[param];
  const sorted = points
    .map((point) => ({ time: Math.max(0, point.time), value: clamp(point.value, min, max) }))
    .sort((a, b) => a.time - b.time);

  return sorted.filter((point, i) => i === sorted.length - 1 || sorted[i + 1]!.time - point.time > 1e-6);
};

/** Replace a track's points for a setting; an empty list removes its automation. */
export const setAutomation = (state: TimelineState, track: string, param: AutomationParam, points: readonly AutomationPoint[]): TimelineState => ({
  ...state,
  tracks: state.tracks.map((t) => {
    if (t.id !== track) return t;

    const automation: Automation = { ...t.automation, [param]: cleanPoints(param, points) };
    const next: Track = { ...t, automation };

    if (!automation[param]!.length) delete automation[param];
    if (!Object.keys(automation).length) delete next.automation;

    return next;
  }),
});
