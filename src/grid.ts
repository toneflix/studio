export type SnapTo = 'off' | 'bar' | 'beat' | '1/8' | '1/16' | '1/32';

export interface GridOptions {
  /** Quarter notes per minute */
  bpm: number;
  /** Beats per bar and the note value of one beat, like [6, 8] */
  meter: [number, number];
  snap: SnapTo;
}

/** Bars and beats for a tempo and meter, and snapping times to them. */
export class Grid {
  bpm: number;
  meter: [number, number];
  snap: SnapTo;

  constructor(options: Partial<GridOptions> = {}) {
    this.bpm = options.bpm ?? 120;
    this.meter = options.meter ?? [4, 4];
    this.snap = options.snap ?? 'beat';
  }

  set(options: Partial<GridOptions>) {
    if (options.bpm !== undefined) this.bpm = Math.min(999, Math.max(1, options.bpm));
    if (options.meter) this.meter = options.meter;
    if (options.snap) this.snap = options.snap;
  }

  /** Seconds in one beat of the meter (an eighth note in 6/8). */
  get beat() {
    return (60 / this.bpm) * (4 / this.meter[1]);
  }

  get bar() {
    return this.beat * this.meter[0];
  }

  /** Seconds between snap points, or 0 when snapping is off. */
  get step() {
    const quarter = 60 / this.bpm;

    switch (this.snap) {
      case 'bar':
        return this.bar;
      case 'beat':
        return this.beat;
      case '1/8':
        return quarter / 2;
      case '1/16':
        return quarter / 4;
      case '1/32':
        return quarter / 8;
      default:
        return 0;
    }
  }

  /** The nearest snap point to a time. */
  round(time: number) {
    const step = this.step;

    return step ? Math.round(time / step) * step : time;
  }

  /** Bar and beat (both from 1) at a time. */
  position(time: number) {
    const beats = Math.floor(time / this.beat + 1e-9);

    return { bar: Math.floor(beats / this.meter[0]) + 1, beat: (beats % this.meter[0]) + 1 };
  }
}

/**
 * Picks the closest of several candidate snap targets for a moving edge.
 * Returns the time shift to apply, or 0 when nothing is within reach.
 */
export const nearestSnap = (edges: number[], targets: number[], reach: number) => {
  let best = 0;
  let bestDistance = reach;

  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(target - edge);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = target - edge;
      }
    }
  }

  return best;
};
