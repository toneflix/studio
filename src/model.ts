import { Emitter } from './emitter.ts';
import { History } from './history.ts';
import type { Peaks } from './peaks.ts';
import type { Source, TimelineState } from './types.ts';

export interface ModelEvents extends Record<string, unknown> {
  /** The tracks or clips changed. `final` is false while a drag is still going. */
  change: { state: TimelineState; label: string; final: boolean };
  /** A source's length or peaks arrived */
  source: { id: string };
}

/**
 * The timeline's tracks and clips, with every finished edit recorded in the
 * shared undo history. State objects are never changed in place.
 */
export class TimelineModel extends Emitter<ModelEvents> {
  private current: TimelineState;
  private draftFrom: TimelineState | null = null;
  readonly sources = new Map<string, Source>();
  readonly peaks = new Map<string, Peaks>();
  readonly history: History;

  constructor(state: TimelineState = { tracks: [], clips: [] }, history = new History()) {
    super();
    this.current = state;
    this.history = history;
  }

  get state() {
    return this.current;
  }

  /** Apply an edit as one undo step. */
  apply(label: string, edit: (state: TimelineState) => TimelineState) {
    const before = this.draftFrom ?? this.current;
    const after = edit(this.current);

    this.draftFrom = null;
    if (after === before) return;

    this.set(after, label, true);
    this.record(label, before, after);
  }

  /** Show an edit in progress, like a drag, without an undo step yet. */
  draft(label: string, edit: (state: TimelineState) => TimelineState) {
    this.draftFrom ??= this.current;
    this.set(edit(this.draftFrom), label, false);
  }

  /** Finish a draft as one undo step, or drop it when nothing changed. */
  commit(label: string) {
    const before = this.draftFrom;
    if (!before) return;

    this.draftFrom = null;

    if (before === this.current) return;

    this.set(this.current, label, true);
    this.record(label, before, this.current);
  }

  /** Throw a draft away. */
  cancel() {
    if (!this.draftFrom) return;

    const before = this.draftFrom;
    this.draftFrom = null;
    this.set(before, 'Cancel', true);
  }

  get drafting() {
    return this.draftFrom !== null;
  }

  /** Replace everything without an undo step, as when a project loads. */
  load(state: TimelineState) {
    this.draftFrom = null;
    this.set(state, 'Load', true);
  }

  setSource(source: Source, peaks?: Peaks) {
    this.sources.set(source.id, { ...this.sources.get(source.id), ...source });
    if (peaks) this.peaks.set(source.id, peaks);

    this.emit('source', { id: source.id });
  }

  private set(state: TimelineState, label: string, final: boolean) {
    this.current = state;
    this.emit('change', { state, label, final });
  }

  private record(label: string, before: TimelineState, after: TimelineState) {
    this.history.push({
      label,
      undo: () => this.set(before, `Undo ${label}`, true),
      redo: () => this.set(after, `Redo ${label}`, true),
    });
  }
}
