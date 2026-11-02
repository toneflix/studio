export type SnapTo = 'off' | 'bar' | 'beat' | '1/8' | '1/16' | '1/32';

/** A tempo, and optionally a meter, that takes over at a time. */
export interface TempoChange {
  id: string;
  time: number;
  /** Quarter notes per minute */
  bpm: number;
  /** Beats per bar and beat value; the meter before it when left out */
  meter?: [number, number];
}

/** A stretch of the timeline with one tempo and meter. */
export interface TempoSection {
  start: number;
  end: number;
  bpm: number;
  meter: [number, number];
  /** Seconds in one beat and one bar */
  beat: number;
  bar: number;
  /** Bars before this section, so its first bar is `firstBar + 1` */
  firstBar: number;
}

const beatLength = (bpm: number, meter: [number, number]) => (60 / bpm) * (4 / meter[1]);

export interface GridOptions {
  /** Quarter notes per minute */
  bpm: number;
  /** Beats per bar and the note value of one beat, like [6, 8] */
  meter: [number, number];
  snap: SnapTo;
}

/**
 * Bars and beats for a tempo and meter, and snapping times to them. Tempo
 * changes later in the song start new sections; `bpm` and `meter` are the
 * tempo at the start.
 */
export class Grid {
  bpm: number;
  meter: [number, number];
  snap: SnapTo;
  private changes: TempoChange[] = [];
  private cached: TempoSection[] | null = null;

  constructor(options: Partial<GridOptions> = {}) {
    this.bpm = options.bpm ?? 120;
    this.meter = options.meter ?? [4, 4];
    this.snap = options.snap ?? 'beat';
  }

  set(options: Partial<GridOptions>) {
    if (options.bpm !== undefined) this.bpm = Math.min(999, Math.max(1, options.bpm));
    if (options.meter) this.meter = options.meter;
    if (options.snap) this.snap = options.snap;
    this.cached = null;
  }

  /** The tempo changes after the start, as kept in `TimelineState.tempo`. */
  get tempo(): readonly TempoChange[] {
    return this.changes;
  }

  setTempo(changes: readonly TempoChange[] = []) {
    this.changes = changes.filter((change) => change.time > 1e-6 && change.bpm > 0).sort((a, b) => a.time - b.time);
    this.cached = null;
  }

  /** Every stretch of one tempo and meter, from the start on. The last one never ends. */
  get sections(): readonly TempoSection[] {
    if (this.cached) return this.cached;

    const sections: TempoSection[] = [];
    let current = { start: 0, bpm: this.bpm, meter: this.meter, firstBar: 0 };

    for (const change of this.changes) {
      const beat = beatLength(current.bpm, current.meter);
      const bar = beat * current.meter[0];

      if (change.time <= current.start) continue;

      sections.push({ ...current, end: change.time, beat, bar });
      current = {
        start: change.time,
        bpm: Math.min(999, Math.max(1, change.bpm)),
        meter: change.meter ?? current.meter,
        firstBar: current.firstBar + Math.ceil((change.time - current.start) / bar - 1e-6),
      };
    }

    const beat = beatLength(current.bpm, current.meter);

    sections.push({ ...current, end: Infinity, beat, bar: beat * current.meter[0] });
    this.cached = sections;

    return sections;
  }

  /** The section that plays at a time. */
  sectionAt(time: number) {
    const sections = this.sections;

    for (let i = sections.length - 1; i > 0; i--) if (time >= sections[i]!.start - 1e-9) return sections[i]!;

    return sections[0]!;
  }

  /** Seconds in one beat of the meter at the start (an eighth note in 6/8). */
  get beat() {
    return beatLength(this.bpm, this.meter);
  }

  /** Seconds in one bar at the start */
  get bar() {
    return this.beat * this.meter[0];
  }

  /** Seconds between snap points at the start, or 0 when snapping is off. */
  get step() {
    return this.stepIn(this.sections[0]!);
  }

  private stepIn(section: TempoSection) {
    const quarter = 60 / section.bpm;

    switch (this.snap) {
      case 'bar':
        return section.bar;
      case 'beat':
        return section.beat;
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

  /** The nearest snap point to a time, counted from the start of its tempo section. */
  round(time: number) {
    const section = this.sectionAt(time);
    const step = this.stepIn(section);
    if (!step) return time;

    const snapped = section.start + Math.round((time - section.start) / step) * step;

    // A point past the section's end goes to the start of the next one
    return Math.min(snapped, section.end);
  }

  /** Bar, beat and sixteenth (all from 1) at a time. */
  position(time: number) {
    const section = this.sectionAt(time);
    const beats = (time - section.start) / section.beat + 1e-9;
    const whole = Math.floor(beats);

    return {
      bar: section.firstBar + Math.floor(whole / section.meter[0]) + 1,
      beat: (whole % section.meter[0]) + 1,
      sixteenth: Math.floor((beats - whole) * (16 / section.meter[1])) + 1,
    };
  }

  /** Quarter notes from the start to a time, through every tempo change. */
  quarters(time: number) {
    let total = 0;

    for (const section of this.sections) {
      if (time <= section.start) break;
      total += ((Math.min(time, section.end) - section.start) * section.bpm) / 60;
    }

    return total;
  }

  /** The time a number of quarter notes from the start falls at. */
  timeAtQuarters(quarters: number) {
    let left = Math.max(0, quarters);

    for (const section of this.sections) {
      const span = ((section.end - section.start) * section.bpm) / 60;

      if (left <= span || section.end === Infinity) return section.start + (left * 60) / section.bpm;
      left -= span;
    }

    return 0;
  }

  /** The time where a bar (from 1) starts. */
  barTime(bar: number) {
    const index = bar - 1;
    const section = [...this.sections].reverse().find((s) => s.firstBar <= index) ?? this.sections[0]!;

    return section.start + (index - section.firstBar) * section.bar;
  }

  /** Bar lines from one time to another, with their numbers from 1. */
  bars(from: number, to: number) {
    const bars: { time: number; bar: number }[] = [];

    for (const section of this.sections) {
      if (section.end <= from || section.start >= to) continue;

      const first = Math.max(0, Math.ceil((from - section.start) / section.bar - 1e-9));

      for (let n = first; ; n++) {
        const time = section.start + n * section.bar;

        if (time >= to || time >= section.end - 1e-9) break;
        bars.push({ time, bar: section.firstBar + n + 1 });
      }
    }

    return bars;
  }

  /** Beats from one time to another; `accent` marks the first beat of a bar. */
  beats(from: number, to: number) {
    const beats: { time: number; accent: boolean }[] = [];

    for (const section of this.sections) {
      if (section.end <= from || section.start >= to) continue;

      const first = Math.max(0, Math.ceil((from - section.start) / section.beat - 1e-9));

      for (let n = first; ; n++) {
        const time = section.start + n * section.beat;

        if (time >= to || time >= section.end - 1e-9) break;
        beats.push({ time, accent: n % section.meter[0] === 0 });
      }
    }

    return beats;
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
